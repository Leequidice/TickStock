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
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";
import { DEVNET_RPC_ENDPOINT } from "@/lib/solana";
import { DEVNET_MOCK_STOCKS, DUSD_MINT_ADDRESS } from "@/lib/stocks";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inAppSecretKeyBase64, destinationPublicKey } = body;

    if (!inAppSecretKeyBase64 || !destinationPublicKey) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const inAppKeypair = Keypair.fromSecretKey(
      Buffer.from(inAppSecretKeyBase64, "base64")
    );
    const destPubkey = new PublicKey(destinationPublicKey);

    const connection = new Connection(DEVNET_RPC_ENDPOINT, "confirmed");

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json({ error: "Server authority not configured" }, { status: 500 });
    }

    const authorityKeypair = Keypair.fromSecretKey(
      Buffer.from(authoritySecret, "base64")
    );

    const tx = new Transaction();
    let transferredCount = 0;

    // Check dUSD balance
    const dusdMint = new PublicKey(DUSD_MINT_ADDRESS);
    try {
      const sourceDusdATA = await getAssociatedTokenAddress(dusdMint, inAppKeypair.publicKey, false);
      const destDusdATA = await getAssociatedTokenAddress(dusdMint, destPubkey, false);
      const dusdAcc = await getAccount(connection, sourceDusdATA, "confirmed");

      if (dusdAcc.amount > BigInt(0)) {
        tx.add(
          createAssociatedTokenAccountIdempotentInstruction(
            authorityKeypair.publicKey,
            destDusdATA,
            destPubkey,
            dusdMint
          ),
          createTransferInstruction(
            sourceDusdATA,
            destDusdATA,
            inAppKeypair.publicKey,
            dusdAcc.amount
          )
        );
        transferredCount++;
      }
    } catch {}

    // Check each stock balance
    for (const stock of DEVNET_MOCK_STOCKS) {
      try {
        const stockMint = new PublicKey(stock.mintAddress);
        const sourceStockATA = await getAssociatedTokenAddress(stockMint, inAppKeypair.publicKey, false);
        const destStockATA = await getAssociatedTokenAddress(stockMint, destPubkey, false);
        const stockAcc = await getAccount(connection, sourceStockATA, "confirmed");

        if (stockAcc.amount > BigInt(0)) {
          tx.add(
            createAssociatedTokenAccountIdempotentInstruction(
              authorityKeypair.publicKey,
              destStockATA,
              destPubkey,
              stockMint
            ),
            createTransferInstruction(
              sourceStockATA,
              destStockATA,
              inAppKeypair.publicKey,
              stockAcc.amount
            )
          );
          transferredCount++;
        }
      } catch {}
    }

    if (transferredCount === 0) {
      return NextResponse.json({
        success: true,
        message: "No non-zero balances to transfer",
      });
    }

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [authorityKeypair, inAppKeypair],
      { commitment: "confirmed" }
    );

    return NextResponse.json({
      success: true,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      transferredCount,
    });
  } catch (error: any) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transfer holdings" },
      { status: 500 }
    );
  }
}
