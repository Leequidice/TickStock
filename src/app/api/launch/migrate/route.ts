import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "@/lib/solana";
import { METEORA_DEVNET_LAUNCH_STOCK } from "@/lib/meteora-dbc";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { network = "devnet" } = body;

    const stock = METEORA_DEVNET_LAUNCH_STOCK;
    const poolPubkey = new PublicKey(stock.poolAddress);
    const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
    const connection = new Connection(endpoint, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");

    const pool = await client.state.getPool(poolPubkey);
    if (!pool || !pool.poolState) {
      return NextResponse.json(
        { error: "Meteora DBC pool not found" },
        { status: 404 }
      );
    }

    const progress = await client.state.getPoolQuoteTokenCurveProgress(poolPubkey);

    if (progress < 1.0 && !pool.poolState.isMigrated) {
      return NextResponse.json({
        success: false,
        message: `Curve is not yet ready for graduation. Current progress: ${(progress * 100).toFixed(2)}% / 100%`,
        curveProgressPercent: Number((progress * 100).toFixed(2)),
      });
    }

    if (pool.poolState.isMigrated) {
      return NextResponse.json({
        success: true,
        alreadyGraduated: true,
        message: "Pool has already graduated to Meteora DAMM v2 DEX Pool.",
        target: "Meteora DAMM v2",
      });
    }

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server fee authority key is not configured" },
        { status: 500 }
      );
    }

    const payer = Keypair.fromSecretKey(Buffer.from(authoritySecret, "base64"));

    const poolConfig = await client.state.getPoolConfig(pool.poolState.config);
    if (!poolConfig) {
      return NextResponse.json(
        { error: "Pool config not found" },
        { status: 404 }
      );
    }

    const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
      await client.migration.migrateToDammV2({
        pool: poolPubkey,
        dammConfig: pool.poolState.config,
        payer: payer.publicKey,
      });

    transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
    transaction.feePayer = payer.publicKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, firstPositionNftKeypair, secondPositionNftKeypair],
      { commitment: "confirmed" }
    );

    return NextResponse.json({
      success: true,
      graduated: true,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${network}`,
      message: "Successfully graduated DBC pool to Meteora DAMM v2!",
    });
  } catch (error: any) {
    console.error("Graduation migration error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute DAMM v2 graduation" },
      { status: 500 }
    );
  }
}
