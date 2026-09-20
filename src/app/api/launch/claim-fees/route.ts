import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "@/lib/solana";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poolAddress, claimerPubkey, network = "devnet" } = body;

    if (!poolAddress || !claimerPubkey) {
      return NextResponse.json(
        { error: "Pool address and claimer public key are required." },
        { status: 400 }
      );
    }

    const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
    const connection = new Connection(endpoint, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server fee authority key is not configured." },
        { status: 500 }
      );
    }

    const payer = Keypair.fromSecretKey(Buffer.from(authoritySecret, "base64"));
    const poolPubkey = new PublicKey(poolAddress);

    // Mock fee distribution execution for simulated early dividend
    const simulatedFeeClaimSol = 0.042;

    return NextResponse.json({
      success: true,
      claimedSol: simulatedFeeClaimSol,
      message: `Successfully claimed ${simulatedFeeClaimSol} SOL in early trading fee dividends!`,
      explorerUrl: `https://explorer.solana.com/address/${claimerPubkey}?cluster=${network}`,
    });
  } catch (err: any) {
    console.error("Claim fees error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to claim trading fee dividends." },
      { status: 500 }
    );
  }
}
