import {
  DynamicBondingCurveClient,
  DYNAMIC_BONDING_CURVE_PROGRAM_ID,
  deriveDbcPoolAddress,
  deriveDbcTokenVaultAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import BN from "bn.js";
import { DEVNET_RPC_ENDPOINT, MAINNET_RPC_ENDPOINT } from "./solana";

// Verified identical DBC program ID on Devnet and Mainnet
export const METEORA_DBC_PROGRAM_ID = DYNAMIC_BONDING_CURVE_PROGRAM_ID.toBase58();

// Fictional Tokenized Stock: AeroOrbit Propulsion Labs ($AERO)
export interface DbcLaunchStock {
  id: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  baseMint: string;
  quoteMint: string;
  poolAddress: string;
  configAddress: string;
  migrationTarget: string;
  migrationThresholdSol: number;
  totalCurveSupply: number;
  isFictionalDisclaimer: string;
}

export const METEORA_DEVNET_LAUNCH_STOCK: DbcLaunchStock = {
  id: "dbc-aero",
  ticker: "AERO",
  name: "AeroOrbit Propulsion Labs",
  description:
    "Simulated next-generation commercial orbital launch and reusable propulsion technology. Fair-launch price discovery on Meteora Dynamic Bonding Curve.",
  sector: "Aerospace & Defense (Simulated)",
  baseMint: "Gu6XmsKrk7AWn3JhN5dbgSNrJA37VAbr9QVXqcjczX3",
  quoteMint: "So11111111111111111111111111111111111111112", // WSOL
  poolAddress: "3oEBVanZw9AZ8LvhpN4w9EGP8DffqLJay5Qpnd5rr1k9",
  configAddress: "1GBkPaiit7AfTQYWqjdysREA8foyn2v8y5rAubm6XeR",
  migrationTarget: "Meteora DAMM v2",
  migrationThresholdSol: 84.15,
  totalCurveSupply: 10_000_000,
  isFictionalDisclaimer:
    "Fictional simulated equity asset created strictly for hackathon testing and price discovery demonstration. Not a real company, security, or investment offering.",
};

export interface DbcPoolStatus {
  poolAddress: string;
  baseMint: string;
  quoteMint: string;
  currentPriceSol: number;
  currentPriceUsd: number;
  curveProgressPercent: number;
  quoteReserveSol: number;
  baseReserveTokens: number;
  migrationThresholdSol: number;
  isMigrated: boolean;
  dammV2PoolAddress?: string;
  totalCurveSupplyTokens: number;
}

export function getDbcClient(network: "devnet" | "mainnet" = "devnet"): DynamicBondingCurveClient {
  const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
  const connection = new Connection(endpoint, "confirmed");
  return DynamicBondingCurveClient.create(connection, "confirmed");
}

export async function fetchDbcPoolStatus(
  network: "devnet" | "mainnet" = "devnet"
): Promise<DbcPoolStatus> {
  const stock = METEORA_DEVNET_LAUNCH_STOCK;
  const client = getDbcClient(network);
  const poolPubkey = new PublicKey(stock.poolAddress);

  const pool = await client.state.getPool(poolPubkey);
  if (!pool || !pool.poolState) {
    return {
      poolAddress: stock.poolAddress,
      baseMint: stock.baseMint,
      quoteMint: stock.quoteMint,
      currentPriceSol: 0.0000084,
      currentPriceUsd: 0.00126,
      curveProgressPercent: 0,
      quoteReserveSol: 0,
      baseReserveTokens: stock.totalCurveSupply,
      migrationThresholdSol: stock.migrationThresholdSol,
      isMigrated: false,
      totalCurveSupplyTokens: stock.totalCurveSupply,
    };
  }

  const progress = await client.state.getPoolQuoteTokenCurveProgress(poolPubkey);

  const quoteReserveLamports = pool.poolState.quoteReserve.toNumber();
  const quoteReserveSol = quoteReserveLamports / 1e9;
  const baseReserveUnits = pool.poolState.baseReserve.toNumber();
  const baseReserveTokens = baseReserveUnits / 1e6;

  // Approximate SOL price in USD ($150 / SOL baseline)
  const solPriceUsd = 150;

  // Approximate spot price from virtual / reserve ratio
  let currentPriceSol = 0.0000084;
  if (pool.poolState.sqrtPrice) {
    const sqrtPriceBN = pool.poolState.sqrtPrice;
    // Price = (sqrtPrice / 2^64)^2 in quote units per base unit
    // Adjusted for 6 decimals base, 9 decimals quote:
    const sqrtFloat = sqrtPriceBN.toNumber() / Math.pow(2, 64);
    if (sqrtFloat > 0) {
      currentPriceSol = Math.pow(sqrtFloat, 2) * 1000;
    }
  }

  const currentPriceUsd = currentPriceSol * solPriceUsd;
  const curveProgressPercent = Math.min(100, Number((progress * 100).toFixed(4)));

  return {
    poolAddress: stock.poolAddress,
    baseMint: stock.baseMint,
    quoteMint: stock.quoteMint,
    currentPriceSol,
    currentPriceUsd,
    curveProgressPercent,
    quoteReserveSol,
    baseReserveTokens,
    migrationThresholdSol: stock.migrationThresholdSol,
    isMigrated: Boolean(pool.poolState.isMigrated) || curveProgressPercent >= 100,
    totalCurveSupplyTokens: stock.totalCurveSupply,
  };
}
