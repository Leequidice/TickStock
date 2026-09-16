import { NextRequest, NextResponse } from "next/server";
import { getOrCreateVaultWallet, getExistingVaultWallet } from "@/lib/server-vault";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { DEVNET_RPC_ENDPOINT } from "@/lib/solana";
import { DUSD_MINT_ADDRESS } from "@/lib/stocks";
import { sendAndConfirmTransaction, Transaction } from "@solana/web3.js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, name, provider, email } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // 1. Get or create wallet from server encrypted vault
    const { publicKey, secretKeyBase64, isNew } = getOrCreateVaultWallet(userId, {
      name,
      provider,
      email,
    });

    // 2. If this is a brand new wallet, auto-fund with $1,000 dUSD starting balance
    let faucetSignature: string | undefined;
    if (isNew) {
      try {
        const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
        if (authoritySecret) {
          const authorityKeypair = Keypair.fromSecretKey(
            Buffer.from(authoritySecret, "base64")
          );
          const connection = new Connection(DEVNET_RPC_ENDPOINT, "confirmed");
          const userPubkey = new PublicKey(publicKey);
          const dusdMintPubkey = new PublicKey(DUSD_MINT_ADDRESS);

          const userDusdATA = await getAssociatedTokenAddress(
            dusdMintPubkey,
            userPubkey,
            false
          );

          const tx = new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(
              authorityKeypair.publicKey,
              userDusdATA,
              userPubkey,
              dusdMintPubkey
            ),
            createMintToInstruction(
              dusdMintPubkey,
              userDusdATA,
              authorityKeypair.publicKey,
              BigInt(1000 * 1_000_000)
            )
          );

          faucetSignature = await sendAndConfirmTransaction(
            connection,
            tx,
            [authorityKeypair],
            { commitment: "confirmed" }
          );
          console.log(`[Custodial Wallet Route] Auto-funded fresh wallet ${publicKey} with $1,000 dUSD (tx: ${faucetSignature})`);
        }
      } catch (faucetErr) {
        console.warn("[Custodial Wallet Route] Initial faucet funding warning:", faucetErr);
      }
    }

    return NextResponse.json({
      success: true,
      publicKey,
      secretKeyBase64,
      isNew,
      faucetSignature,
      user: {
        id: userId,
        name: name || "Explorer",
        provider: provider || "guest",
        email,
        publicKey,
      },
    });
  } catch (error: any) {
    console.error("[Custodial Wallet Route] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve or initialize custodial wallet" },
      { status: 500 }
    );
  }
}
