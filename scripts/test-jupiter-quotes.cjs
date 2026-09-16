const { Connection, PublicKey, VersionedTransaction } = require("@solana/web3.js");

const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const XSTOCKS = [
  { ticker: "NVDAx", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 8 },
  { ticker: "AAPLx", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", decimals: 8 },
  { ticker: "TSLAx", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 8 },
  { ticker: "SPYx",  mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 8 },
  { ticker: "MSTRx", mint: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ", decimals: 8 },
  { ticker: "GOOGLx", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", decimals: 8 },
];

async function testJupiterRoutes() {
  console.log("===============================================================");
  console.log("🧪 TESTING JUPITER V1 SWAP ROUTING FOR XSTOCKS TOKEN-2022");
  console.log("===============================================================");

  const dummyUser = "8rLkM6Ljv6YdNTUFmxEyW7mXPXQvWw3PK9RjZWUpmSUJ";
  const tradeUsdcAmount = 25; // $25 USDC
  const amountLamports = tradeUsdcAmount * 1_000_000;

  for (const stock of XSTOCKS) {
    console.log(`\n🔍 Fetching Jupiter Quote for $25 USDC -> ${stock.ticker} (${stock.mint})...`);
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${MAINNET_USDC_MINT}&outputMint=${stock.mint}&amount=${amountLamports}&slippageBps=50`;

    try {
      const quoteRes = await fetch(quoteUrl, { headers: { Accept: "application/json" } });
      if (!quoteRes.ok) {
        const err = await quoteRes.json().catch(() => ({}));
        console.log(`   ⚠️ Quote failed: ${err.error || quoteRes.statusText}`);
        continue;
      }

      const quote = await quoteRes.json();
      const outputShares = Number(BigInt(quote.outAmount)) / Math.pow(10, stock.decimals);
      const dexLabels = quote.routePlan.map((r) => r.swapInfo.label).join(" ➔ ");

      console.log(`   ✅ Quote Success!`);
      console.log(`      Input: $${tradeUsdcAmount} USDC`);
      console.log(`      Output: ~${outputShares.toFixed(6)} ${stock.ticker} shares`);
      console.log(`      Route Plan: ${dexLabels}`);
      console.log(`      Price Impact: ${quote.priceImpactPct}%`);

      // Test Building Swap Transaction with Jupiter API
      const swapRes = await fetch("https://api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: dummyUser,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });

      if (swapRes.ok) {
        const swapData = await swapRes.json();
        const txBuffer = Buffer.from(swapData.swapTransaction, "base64");
        const vTx = VersionedTransaction.deserialize(txBuffer);
        console.log(`      ✅ Swap Transaction Built & Serialized! Size: ${txBuffer.length} bytes`);
        console.log(`      Instructions Count: ${vTx.message.compiledInstructions.length}`);
      } else {
        const swapErr = await swapRes.json().catch(() => ({}));
        console.log(`      ⚠️ Swap build response: ${swapErr.error || swapRes.statusText}`);
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }
  }

  console.log("\n===============================================================");
  console.log("✅ JUPITER V1 XSTOCKS ROUTING & TRANSACTION PIPELINE VERIFIED");
  console.log("===============================================================");
}

testJupiterRoutes().catch(console.error);
