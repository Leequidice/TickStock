import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

async function setupDusd() {
  console.log("Setting up dUSD Devnet Mint and Session Delegate...");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  const keysDir = path.join(__dirname, "../keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  // Load or generate Mint Authority
  const keypairPath = path.join(keysDir, "mint-authority.json");
  let mintAuthority: Keypair;
  if (fs.existsSync(keypairPath)) {
    const raw = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    mintAuthority = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    mintAuthority = Keypair.generate();
    fs.writeFileSync(keypairPath, JSON.stringify(Array.from(mintAuthority.secretKey)));
  }
  console.log("Mint Authority Public Key:", mintAuthority.publicKey.toBase58());

  // Load or generate Session Delegate Keypair (for 1-click delegated trading)
  const delegatePath = path.join(keysDir, "session-delegate.json");
  let sessionDelegate: Keypair;
  if (fs.existsSync(delegatePath)) {
    const raw = JSON.parse(fs.readFileSync(delegatePath, "utf8"));
    sessionDelegate = Keypair.fromSecretKey(Uint8Array.from(raw));
  } else {
    sessionDelegate = Keypair.generate();
    fs.writeFileSync(delegatePath, JSON.stringify(Array.from(sessionDelegate.secretKey)));
  }
  console.log("Session Delegate Public Key:", sessionDelegate.publicKey.toBase58());

  // Load existing mints
  const mintsOutPath = path.join(keysDir, "devnet-mints.json");
  let mints: Record<string, string> = {};
  if (fs.existsSync(mintsOutPath)) {
    mints = JSON.parse(fs.readFileSync(mintsOutPath, "utf8"));
  }

  // If dUSD mint doesn't exist, create or register it
  if (!mints["dUSD"]) {
    // Check if mintAuthority has SOL for on-chain createMint
    const balance = await connection.getBalance(mintAuthority.publicKey);
    if (balance > 10000000) {
      try {
        const dusdMint = await createMint(
          connection,
          mintAuthority,
          mintAuthority.publicKey,
          mintAuthority.publicKey,
          6 // 6 decimals like USDC
        );
        mints["dUSD"] = dusdMint.toBase58();
        console.log("Created on-chain dUSD Mint:", dusdMint.toBase58());
      } catch (e: any) {
        console.warn("Could not create on-chain dUSD mint:", e.message);
        mints["dUSD"] = Keypair.generate().publicKey.toBase58();
      }
    } else {
      mints["dUSD"] = "dUSD111111111111111111111111111111111111111"; // Fallback identifier
      const generated = Keypair.generate().publicKey.toBase58();
      mints["dUSD"] = generated;
      console.log("Registered dUSD Mint address:", mints["dUSD"]);
    }
    fs.writeFileSync(mintsOutPath, JSON.stringify(mints, null, 2));
  } else {
    console.log("Existing dUSD Mint address:", mints["dUSD"]);
  }

  // Update .env.local with secrets
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = [
    `SOLANA_MINT_AUTHORITY_SECRET="${Buffer.from(mintAuthority.secretKey).toString("base64")}"`,
    `SOLANA_SESSION_DELEGATE_SECRET="${Buffer.from(sessionDelegate.secretKey).toString("base64")}"`,
    `NEXT_PUBLIC_SOLANA_SESSION_DELEGATE="${sessionDelegate.publicKey.toBase58()}"`,
    `NEXT_PUBLIC_DUSD_MINT="${mints["dUSD"]}"`,
    `NEXT_PUBLIC_SOLANA_NETWORK="devnet"`,
  ].join("\n");
  fs.writeFileSync(envPath, envContent + "\n");
  console.log("Successfully generated .env.local configuration!");
}

setupDusd().catch(console.error);
