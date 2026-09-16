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
import { DEVNET_MOCK_STOCKS } from "@/lib/stocks";

const ALLOWED_AMOUNTS = [10, 25, 50, 100];
const VALID_STOCK_MAP = new Map(
  DEVNET_MOCK_STOCKS.map((s) => [s.mintAddress, s])
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userPublicKey, mintAddress, shares, ticker, usdAmount } = body;

    // 1. Check required parameters
    if (!userPublicKey || !mintAddress || !shares || !usdAmount) {
      return NextResponse.json(
        { error: "Missing required trading parameters" },
        { status: 400 }
      );
    }

    // 2. Validate amount preset
    if (!ALLOWED_AMOUNTS.includes(usdAmount) && (usdAmount <= 0 || usdAmount > 1000)) {
      return NextResponse.json(
        { error: `Invalid trade amount. Allowed presets: $${ALLOWED_AMOUNTS.join(", $")}` },
        { status: 400 }
      );
    }

    // 3. Validate stock mint address against Devnet mock catalog
    const devnetStock = VALID_STOCK_MAP.get(mintAddress);
    if (!devnetStock) {
      return NextResponse.json(
        { error: "Unauthorized or unlisted Devnet stock mint address" },
        { status: 400 }
      );
    }

    // 4. Validate ticker matches mint
    if (ticker && ticker.toUpperCase() !== devnetStock.ticker.toUpperCase()) {
      return NextResponse.json(
        { error: "Ticker does not match specified stock mint" },
        { status: 400 }
      );
    }

    // 5. Validate calculated shares against price
    const expectedShares = usdAmount / devnetStock.basePrice;
    const deviation = Math.abs(shares - expectedShares) / expectedShares;
    if (deviation > 0.05) { // 5% tolerance for rounding/micro-fluctuations
      return NextResponse.json(
        { error: "Shares amount deviates from current market price calculation" },
        { status: 400 }
      );
    }

    // 6. Validate Solana public key
    let userPubkey: PublicKey;
    let mintPubkey: PublicKey;
    try {
      userPubkey = new PublicKey(userPublicKey);
      mintPubkey = new PublicKey(mintAddress);
    } catch (keyErr) {
      return NextResponse.json(
        { error: "Invalid Solana public key format" },
        { status: 400 }
      );
    }

    const connection = new Connection(DEVNET_RPC_ENDPOINT, "confirmed");

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;

    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server mint authority key is not configured on server" },
        { status: 500 }
      );
    }

    const secretKey = Buffer.from(authoritySecret, "base64");
    const authorityKeypair = Keypair.fromSecretKey(secretKey);

    const authorityBalance = await connection.getBalance(
      authorityKeypair.publicKey
    );

    if (authorityBalance < 5000) {
      return NextResponse.json(
        {
          error: `Server sponsored fee payer (${authorityKeypair.publicKey.toBase58()}) has insufficient Devnet SOL (${authorityBalance / 1e9} SOL). Please fund this fee payer with Devnet SOL.`,
        },
        { status: 500 }
      );
    }

    // Calculate token amount (6 decimals)
    const tokenAmount = BigInt(Math.round(shares * 1_000_000));

    // Get or create ATA
    const userAta = await getAssociatedTokenAddress(
      mintPubkey,
      userPubkey,
      false
    );

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        authorityKeypair.publicKey,
        userAta,
        userPubkey,
        mintPubkey
      ),
      createMintToInstruction(
        mintPubkey,
        userAta,
        authorityKeypair.publicKey,
        tokenAmount
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
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      shares,
      ticker: devnetStock.ticker,
      usdAmount,
    });
  } catch (error: any) {
    console.error("Trade API error:", error);
    return NextResponse.json(
      { error: error.message || "Minting transaction failed on Solana Devnet" },
      { status: 500 }
    );
  }
}
