import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "@/lib/solana";
import { METEORA_DEVNET_LAUNCH_STOCK } from "@/lib/meteora-dbc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userPublicKey,
      usdAmount = 25,
      network = "devnet",
      isCustodial = false,
      custodialSecretKeyBase64,
    } = body;

    if (!userPublicKey) {
      return NextResponse.json(
        { error: "User public key is required" },
        { status: 400 }
      );
    }

    const stock = METEORA_DEVNET_LAUNCH_STOCK;
    const poolPubkey = new PublicKey(stock.poolAddress);
    const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
    const connection = new Connection(endpoint, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server mint/fee authority key is not configured" },
        { status: 500 }
      );
    }

    const authorityKeypair = Keypair.fromSecretKey(
      Buffer.from(authoritySecret, "base64")
    );

    // Calculate SOL amount to spend (assuming ~$150/SOL)
    const solPriceUsd = 150;
    const solAmount = usdAmount / solPriceUsd;
    const lamportsIn = new BN(Math.max(1_000_000, Math.round(solAmount * 1e9))); // at least 0.001 SOL

    // 1. Fetch pool & quote
    const pool = await client.state.getPool(poolPubkey);
    if (!pool || !pool.poolState) {
      return NextResponse.json(
        { error: "Meteora DBC pool not found" },
        { status: 404 }
      );
    }

    const poolConfig = await client.state.getPoolConfig(pool.poolState.config);
    if (!poolConfig) {
      return NextResponse.json(
        { error: "Meteora DBC pool config not found" },
        { status: 404 }
      );
    }
    const slot = await connection.getSlot();

    const swapQuote = client.pool.swapQuote({
      virtualPool: pool,
      config: poolConfig,
      swapBaseForQuote: false,
      amountIn: lamportsIn,
      slippageBps: 300, // 3% slippage tolerance
      hasReferral: false,
      eligibleForFirstSwapWithMinFee: false,
      currentPoint: new BN(slot),
    });

    const userPubkey = new PublicKey(userPublicKey);

    // 2. Build swap transaction via Meteora DBC SDK
    // Payer / owner is the user (or authority for sponsored devnet execution)
    const payer = authorityKeypair;
    const swapTx = await client.pool.swap({
      owner: payer.publicKey,
      payer: payer.publicKey,
      pool: poolPubkey,
      amountIn: lamportsIn,
      minimumAmountOut: swapQuote.minimumAmountOut,
      swapBaseForQuote: false,
      referralTokenAccount: null,
    });

    swapTx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    swapTx.feePayer = payer.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      swapTx,
      [payer],
      { commitment: "confirmed" }
    );

    const tokensReceived = swapQuote.outputAmount.toNumber() / 1e6;

    // Get updated progress
    const updatedProgress = await client.state.getPoolQuoteTokenCurveProgress(poolPubkey);

    return NextResponse.json({
      success: true,
      onChain: true,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${network}`,
      shares: tokensReceived,
      ticker: stock.ticker,
      usdAmount,
      solAmountSpent: lamportsIn.toNumber() / 1e9,
      curveProgressPercent: Math.min(100, Number((updatedProgress * 100).toFixed(4))),
    });
  } catch (error: any) {
    console.error("Meteora DBC swap execution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute swap on Meteora DBC" },
      { status: 500 }
    );
  }
}
