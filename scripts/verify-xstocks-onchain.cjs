const { Connection, PublicKey } = require("@solana/web3.js");
const { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require("@solana/spl-token");

const TOKENS_TO_CHECK = [
  { ticker: "NVDAx", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh" },
  { ticker: "AAPLx", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
  { ticker: "TSLAx", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB" },
  { ticker: "SPYx",  mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W" },
  { ticker: "MSTRx", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ" },
  { ticker: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN" },
];

async function checkOnchain(networkName, rpcUrl) {
  console.log(`\n======================================================`);
  console.log(`🔍 CHECKING ON-CHAIN STATUS ON: ${networkName} (${rpcUrl})`);
  console.log(`======================================================`);
  const connection = new Connection(rpcUrl, "confirmed");

  for (const item of TOKENS_TO_CHECK) {
    const mintPubkey = new PublicKey(item.mint);
    try {
      const accountInfo = await connection.getAccountInfo(mintPubkey);
      if (!accountInfo) {
        console.log(`❌ [${item.ticker}] (${item.mint}): Account does NOT exist on ${networkName}`);
        continue;
      }

      console.log(`\n✅ [${item.ticker}] Account Exists on ${networkName}!`);
      console.log(`   Owner Program: ${accountInfo.owner.toBase58()} (Is Token-2022: ${accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)})`);
      console.log(`   Data Size: ${accountInfo.data.length} bytes`);

      // Try fetching as Token-2022 Mint
      try {
        const mintData = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
        console.log(`   Decimals: ${mintData.decimals}`);
        console.log(`   Supply: ${mintData.supply.toString()} (Raw Units)`);
        console.log(`   Mint Authority: ${mintData.mintAuthority ? mintData.mintAuthority.toBase58() : "None (Fixed/Disabled)"}`);
        console.log(`   Freeze Authority: ${mintData.freezeAuthority ? mintData.freezeAuthority.toBase58() : "None"}`);
      } catch (mintErr) {
        console.log(`   ⚠️ Failed to parse as Token-2022 mint: ${mintErr.message}`);
      }
    } catch (err) {
      console.error(`   Error checking ${item.ticker}: ${err.message}`);
    }
  }
}

async function checkDEXLiquidity() {
  console.log(`\n======================================================`);
  console.log(`📊 CHECKING JUPITER / DEXSCREENER REAL LIQUIDITY`);
  console.log(`======================================================`);

  for (const item of TOKENS_TO_CHECK) {
    try {
      // 1. DexScreener check
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${item.mint}`);
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        const pairs = dexData.pairs || [];
        if (pairs.length > 0) {
          const topPair = pairs[0];
          console.log(`\n✅ [${item.ticker}] Active Liquidity Pair Found on ${topPair.dexId.toUpperCase()}!`);
          console.log(`   Pair: ${topPair.baseToken.symbol}/${topPair.quoteToken.symbol} on ${topPair.dexId}`);
          console.log(`   Price USD: $${topPair.priceUsd}`);
          console.log(`   Liquidity USD: $${topPair.liquidity ? topPair.liquidity.usd : "N/A"}`);
          console.log(`   24h Volume USD: $${topPair.volume ? topPair.volume.h24 : "N/A"}`);
          console.log(`   Pair Address: ${topPair.pairAddress}`);
        } else {
          console.log(`\n⚠️ [${item.ticker}] No active DexScreener pairs found.`);
        }
      }

      // 2. Jupiter Quote check (buying $10 worth of xStock with USDC)
      const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const jupQuoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${USDC_MAINNET}&outputMint=${item.mint}&amount=10000000&slippageBps=50`;
      const jupRes = await fetch(jupQuoteUrl);
      if (jupRes.ok) {
        const jupData = await jupRes.json();
        if (jupData.outAmount) {
          console.log(`   ⚡ Jupiter Route Available: $10 USDC -> ${jupData.outAmount} units of ${item.ticker} via ${jupData.routePlan.map(r => r.swapInfo.label).join(" -> ")}`);
        }
      } else {
        const errJson = await jupRes.json().catch(() => ({}));
        console.log(`   ⚡ Jupiter Quote: Not routeable or restricted (${errJson.error || jupRes.statusText})`);
      }
    } catch (e) {
      console.log(`   Error querying DEX for ${item.ticker}: ${e.message}`);
    }
  }
}

async function main() {
  // Check Mainnet
  await checkOnchain("Solana Mainnet-Beta", "https://api.mainnet-beta.solana.com");

  // Check Devnet
  await checkOnchain("Solana Devnet", "https://api.devnet.solana.com");

  // Check DEX Liquidity
  await checkDEXLiquidity();
}

main().catch(console.error);
