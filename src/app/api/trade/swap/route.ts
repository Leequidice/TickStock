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
  createBurnInstruction,
} from "@solana/spl-token";
import { DEVNET_RPC_ENDPOINT } from "@/lib/solana";
import { DEVNET_MOCK_STOCKS, DUSD_MINT_ADDRESS } from "@/lib/stocks";

const VALID_STOCK_MAP = new Map(
  DEVNET_MOCK_STOCKS.map((s) => [s.mintAddress, s])
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userPublicKey,
      mintAddress,
      shares,
      ticker,
      usdAmount,
      isCustodial,
      custodialSecretKeyBase64,
      type = "BUY", // "BUY" | "SELL"
    } = body;

    // 1. Validate required inputs
    if (!userPublicKey || !mintAddress || !shares || !usdAmount) {
      return NextResponse.json(
        { error: "Missing required trading parameters" },
        { status: 400 }
      );
    }

    if (usdAmount <= 0 || shares <= 0) {
      return NextResponse.json(
        { error: "Trade amount and shares must be greater than zero" },
        { status: 400 }
      );
    }

    // 2. Validate stock against Devnet mock catalog
    const devnetStock = VALID_STOCK_MAP.get(mintAddress);
    if (!devnetStock) {
      return NextResponse.json(
        { error: "Unauthorized or unlisted Devnet stock mint address" },
        { status: 400 }
      );
    }

    // 3. Validate ticker matches
    if (ticker && ticker.toUpperCase() !== devnetStock.ticker.toUpperCase()) {
      return NextResponse.json(
        { error: "Ticker does not match specified stock mint" },
        { status: 400 }
      );
    }

    // 4. Validate public keys
    let userPubkey: PublicKey;
    let stockMintPubkey: PublicKey;
    let dusdMintPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(userPublicKey);
      stockMintPubkey = new PublicKey(mintAddress);
      dusdMintPubkey = new PublicKey(DUSD_MINT_ADDRESS);
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana public key format" },
        { status: 400 }
      );
    }

    const connection = new Connection(DEVNET_RPC_ENDPOINT, "confirmed");
    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    const delegateSecret = process.env.SOLANA_SESSION_DELEGATE_SECRET;

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
          error: `Server sponsored fee payer (${authorityKeypair.publicKey.toBase58()}) has insufficient Devnet SOL (${authorityBalance / 1e9} SOL).`,
        },
        { status: 500 }
      );
    }

    const dusdAmountLamports = BigInt(Math.round(usdAmount * 1_000_000));
    const stockAmountLamports = BigInt(Math.round(shares * 1_000_000));

    const userDusdATA = await getAssociatedTokenAddress(
      dusdMintPubkey,
      userPubkey,
      false
    );

    const userStockATA = await getAssociatedTokenAddress(
      stockMintPubkey,
      userPubkey,
      false
    );

    // Pre-flight check: Verify user's dUSD ATA exists
    const userDusdAccountInfo = await connection.getAccountInfo(userDusdATA);
    if (!userDusdAccountInfo && type === "BUY") {
      return NextResponse.json(
        {
          error: "Your dUSD cash account is not initialized on Devnet. Please claim initial $1,000 dUSD.",
        },
        { status: 400 }
      );
    }

    const tx = new Transaction();
    const signers: Keypair[] = [authorityKeypair];

    // Determine signer for user debit
    let userSigner: Keypair | null = null;
    if (isCustodial && custodialSecretKeyBase64) {
      const custodialSecret = Buffer.from(custodialSecretKeyBase64, "base64");
      userSigner = Keypair.fromSecretKey(custodialSecret);
      signers.push(userSigner);
    } else if (delegateSecret) {
      const delegateKey = Buffer.from(delegateSecret, "base64");
      userSigner = Keypair.fromSecretKey(delegateKey);
      signers.push(userSigner);
    } else {
      return NextResponse.json(
        { error: "No valid signing authority (custodial or session delegate) provided" },
        { status: 400 }
      );
    }

    if (type === "BUY") {
      // 1. Debit/burn dUSD from user
      tx.add(
        createBurnInstruction(
          userDusdATA,
          dusdMintPubkey,
          userSigner.publicKey,
          dusdAmountLamports
        )
      );

      // 2. Credit stock token to user
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          authorityKeypair.publicKey,
          userStockATA,
          userPubkey,
          stockMintPubkey
        ),
        createMintToInstruction(
          stockMintPubkey,
          userStockATA,
          authorityKeypair.publicKey,
          stockAmountLamports
        )
      );
    } else if (type === "SELL") {
      // 1. Debit/burn stock tokens from user
      tx.add(
        createBurnInstruction(
          userStockATA,
          stockMintPubkey,
          userSigner.publicKey,
          stockAmountLamports
        )
      );

      // 2. Credit dUSD cash back to user
      tx.add(
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
          dusdAmountLamports
        )
      );
    } else {
      return NextResponse.json({ error: "Invalid trade type" }, { status: 400 });
    }

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      signers,
      { commitment: "confirmed" }
    );

    return NextResponse.json({
      success: true,
      onChain: true,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      shares,
      ticker: devnetStock.ticker,
      usdAmount,
      type,
    });
  } catch (error: any) {
    console.error("Swap API error:", error);
    return NextResponse.json(
      { error: error.message || "Trade transaction failed on Solana Devnet" },
      { status: 500 }
    );
  }
}
