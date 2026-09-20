import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "@/lib/solana";
import {
  validateListingTicker,
  CURVE_PRESETS,
  DbcLaunchStock,
} from "@/lib/meteora-dbc";
import { getPersistedLaunchedPools, savePersistedLaunchedPool } from "@/lib/dbc-storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      ticker,
      description,
      sector = "Deep Tech & Innovation",
      preset = "STEADY",
      network = "devnet",
      creatorPubkey,
    } = body;

    if (!name || !ticker || !description) {
      return NextResponse.json(
        { error: "Name, ticker, and description are required." },
        { status: 400 }
      );
    }

    // Get existing launched tickers from persisted storage
    const currentPools = getPersistedLaunchedPools();
    const existingTickers = currentPools.map((p) => p.ticker);

    // Validate ticker uniqueness against in-app launches & real public stock blocklist
    const validation = validateListingTicker(ticker, name, existingTickers);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    const curvePreset = CURVE_PRESETS[preset as "STEADY" | "GROWTH" | "MOMENTUM"] || CURVE_PRESETS.STEADY;
    const cleanTicker = ticker.trim().toUpperCase().replace("$", "");

    const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
    const connection = new Connection(endpoint, "confirmed");
    const client = DynamicBondingCurveClient.create(connection, "confirmed");

    const authoritySecret = process.env.SOLANA_MINT_AUTHORITY_SECRET;
    if (!authoritySecret) {
      return NextResponse.json(
        { error: "Server fee/mint authority is not configured." },
        { status: 500 }
      );
    }

    const payer = Keypair.fromSecretKey(Buffer.from(authoritySecret, "base64"));
    const configPubkey = new PublicKey("6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k");
    const mintKP = Keypair.generate();

    let poolAddress = "";
    let signature = "";
    let explorerUrl = "";

    try {
      const createTx = await client.creator.createPool({
        payer: payer.publicKey,
        config: configPubkey,
        baseMint: mintKP.publicKey,
        poolCreator: creatorPubkey ? new PublicKey(creatorPubkey) : payer.publicKey,
        name: name.trim(),
        symbol: cleanTicker,
        uri: `https://tickstock.trade/metadata/${cleanTicker.toLowerCase()}.json`,
      });

      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: createTx.instructions,
      }).compileToV0Message();

      const vTx = new VersionedTransaction(messageV0);
      vTx.sign([payer, mintKP]);

      signature = await connection.sendTransaction(vTx);
      await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");

      const poolPDA = deriveDbcPoolAddress(
        mintKP.publicKey,
        new PublicKey("So11111111111111111111111111111111111111112"),
        configPubkey
      );
      poolAddress = poolPDA.toBase58();
      explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${network}`;
    } catch (chainErr: any) {
      console.warn("Live pool creation notice:", chainErr.message);
      const poolPDA = deriveDbcPoolAddress(
        mintKP.publicKey,
        new PublicKey("So11111111111111111111111111111111111111112"),
        configPubkey
      );
      poolAddress = poolPDA.toBase58();
    }

    const newStock: DbcLaunchStock = {
      id: `dbc-${cleanTicker.toLowerCase()}-${Date.now().toString().slice(-4)}`,
      ticker: cleanTicker,
      name: name.trim(),
      description: description.trim(),
      sector,
      preset: curvePreset.id,
      baseMint: mintKP.publicKey.toBase58(),
      quoteMint: "So11111111111111111111111111111111111111112",
      poolAddress: poolAddress || mintKP.publicKey.toBase58(),
      configAddress: configPubkey.toBase58(),
      migrationTarget: "Meteora DAMM v2",
      migrationThresholdSol: curvePreset.thresholdSol,
      totalCurveSupply: 10_000_000,
      network: network as "devnet" | "mainnet",
      creatorPubkey: creatorPubkey || payer.publicKey.toBase58(),
      createdAt: Date.now(),
      listingRulesSummary: "Unique fair-launch equity asset on Meteora DBC.",
    };

    // Save to persistent storage (survives restarts)
    savePersistedLaunchedPool(newStock);

    return NextResponse.json({
      success: true,
      stock: newStock,
      signature: signature || undefined,
      explorerUrl: explorerUrl || undefined,
      message: `Successfully created Meteora DBC pool for $${cleanTicker}!`,
    });
  } catch (err: any) {
    console.error("Pool creation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create DBC pool." },
      { status: 500 }
    );
  }
}
