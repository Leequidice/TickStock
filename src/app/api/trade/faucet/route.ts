import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { DEVNET_RPC_ENDPOINT } from "@/lib/solana";
import { DUSD_MINT_ADDRESS } from "@/lib/stocks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userPublicKey } = body;

    if (!userPublicKey) {
      return NextResponse.json(
        { error: "Missing userPublicKey parameter" },
        { status: 400 }
      );
    }

    let userPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(userPublicKey);
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana public key format" },
        { status: 400 }
      );
    }

    const connection = new Connection(DEVNET_RPC_ENDPOINT, "confirmed");
    const dusdMint = new PublicKey(DUSD_MINT_ADDRESS);

    // Initial airdrop: $1,000 dUSD (6 decimals = 1,000,000,000 units)
    const amountDusd = BigInt(1_000 * 1_000_000);

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server mint authority key is not configured on server" },
        { status: 500 }
      );
    }

    const secretKey = Buffer.from(authoritySecret, "base64");
    const authorityKeypair = Keypair.fromSecretKey(secretKey);

    const authorityBalance = await connection.getBalance(authorityKeypair.publicKey);
    if (authorityBalance < 5000) {
      return NextResponse.json(
        {
          error: `Server sponsored fee payer (${authorityKeypair.publicKey.toBase58()}) has insufficient Devnet SOL (${authorityBalance / 1e9} SOL). Please fund this fee payer with Devnet SOL.`,
        },
        { status: 500 }
      );
    }

    const userDusdATA = await getAssociatedTokenAddress(
      dusdMint,
      userPubkey,
      false
    );

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authorityKeypair.publicKey,
        userDusdATA,
        userPubkey,
        dusdMint
      ),
      createMintToInstruction(
        dusdMint,
        userDusdATA,
        authorityKeypair.publicKey,
        amountDusd
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [authorityKeypair],
      { commitment: "confirmed" }
    );

    return NextResponse.json({
      success: true,
      onChain: true,
      amount: 1000,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (error: any) {
    console.error("dUSD Faucet error:", error);
    return NextResponse.json(
      { error: error.message || "dUSD faucet transaction failed on Solana Devnet" },
      { status: 500 }
    );
  }
}
