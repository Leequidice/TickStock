const {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  createMint,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const STOCK_TICKERS = [
  { ticker: "NVDA", name: "NVIDIA Corporation", decimals: 6 },
  { ticker: "TSLA", name: "Tesla Inc", decimals: 6 },
  { ticker: "MSTR", name: "MicroStrategy Inc", decimals: 6 },
  { ticker: "COIN", name: "Coinbase Global", decimals: 6 },
  { ticker: "AAPL", name: "Apple Inc", decimals: 6 },
  { ticker: "MSFT", name: "Microsoft Corp", decimals: 6 },
  { ticker: "AMZN", name: "Amazon.com Inc", decimals: 6 },
  { ticker: "GOOGL", name: "Alphabet Inc", decimals: 6 },
  { ticker: "AMD", name: "Advanced Micro Devices", decimals: 6 },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", decimals: 6 },
  { ticker: "NFLX", name: "Netflix Inc", decimals: 6 },
  { ticker: "BABA", name: "Alibaba Group", decimals: 6 },
  { ticker: "dUSD", name: "Devnet USD", decimals: 6 },
];

async function main() {
  console.log("Connecting to Solana Devnet...");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const keysDir = path.join(__dirname, "../keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // 1. Load Mint Authority
  const keypairPath = path.join(keysDir, "mint-authority.json");
  const raw = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  console.log("Loaded mint authority:", payer.publicKey.toBase58());

  // 2. Load Session Delegate
  const delegatePath = path.join(keysDir, "session-delegate.json");
  let sessionDelegate;
  if (fs.existsSync(delegatePath)) {
    const delRaw = JSON.parse(fs.readFileSync(delegatePath, "utf8"));
    sessionDelegate = Keypair.fromSecretKey(Uint8Array.from(delRaw));
  } else {
    sessionDelegate = Keypair.generate();
    fs.writeFileSync(delegatePath, JSON.stringify(Array.from(sessionDelegate.secretKey)));
  }
  console.log("Session delegate:", sessionDelegate.publicKey.toBase58());

  const balance = await connection.getBalance(payer.publicKey);
  console.log("Authority Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    throw new Error("Mint authority has insufficient SOL balance to deploy mints.");
  }

  const mintResults = {};

  for (const s of STOCK_TICKERS) {
    console.log(`Creating Devnet SPL Token Mint for $${s.ticker}...`);
    const mint = await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      s.decimals
    );
    console.log(`✓ $${s.ticker} Mint: ${mint.toBase58()}`);
    mintResults[s.ticker] = mint.toBase58();
  }

  // Save mint mapping to keys/devnet-mints.json
  const mintsOutPath = path.join(keysDir, "devnet-mints.json");
  fs.writeFileSync(mintsOutPath, JSON.stringify(mintResults, null, 2));
  console.log("Saved devnet mint addresses to", mintsOutPath);

  // Write updated .env.local
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = [
    `SOLANA_MINT_AUTHORITY_SECRET="${Buffer.from(payer.secretKey).toString("base64")}"`,
    `SOLANA_SESSION_DELEGATE_SECRET="${Buffer.from(sessionDelegate.secretKey).toString("base64")}"`,
    `NEXT_PUBLIC_SOLANA_SESSION_DELEGATE="${sessionDelegate.publicKey.toBase58()}"`,
    `NEXT_PUBLIC_DUSD_MINT="${mintResults["dUSD"]}"`,
    `NEXT_PUBLIC_SOLANA_NETWORK="devnet"`,
  ].join("\n");
  fs.writeFileSync(envPath, envContent + "\n");
  console.log("Updated .env.local successfully!");
}

main().catch(console.error);
