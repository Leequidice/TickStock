export interface CurvePreset {
  id: "STEADY" | "GROWTH" | "MOMENTUM";
  name: string;
  badge: string;
  description: string;
  thresholdSol: number;
  initialPriceSol: number;
  graduationPriceSol: number;
  volatilityRating: "Low" | "Moderate" | "Dynamic";
  curveBehaviorExplanation: string;
  configAddressDevnet: string;
}

export const CURVE_PRESETS: Record<"STEADY" | "GROWTH" | "MOMENTUM", CurvePreset> = {
  STEADY: {
    id: "STEADY",
    name: "Steady Discovery",
    badge: "Institutional Grade",
    description: "Gentle linear bonding curve with deep liquidity and minimal slippage. Ideal for enterprise & yield assets.",
    thresholdSol: 84.15,
    initialPriceSol: 0.0000084,
    graduationPriceSol: 0.000042,
    volatilityRating: "Low",
    curveBehaviorExplanation: "Slow linear price appreciation designed for long-term equity-like valuation discovery with minimal volatility spikes.",
    configAddressDevnet: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth Trajectory",
    badge: "Balanced Growth",
    description: "Moderate parabolic slope balancing early-adopter incentives with healthy post-graduation depth.",
    thresholdSol: 50.0,
    initialPriceSol: 0.000005,
    graduationPriceSol: 0.000035,
    volatilityRating: "Moderate",
    curveBehaviorExplanation: "Balanced curve providing progressive rewards to conviction buyers while preserving steady liquidity.",
    configAddressDevnet: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
  },
  MOMENTUM: {
    id: "MOMENTUM",
    name: "Momentum Curve",
    badge: "High Velocity",
    description: "Steep exponential discovery curve for high-velocity early launches and rapid threshold achievement.",
    thresholdSol: 25.0,
    initialPriceSol: 0.0000025,
    graduationPriceSol: 0.000028,
    volatilityRating: "Dynamic",
    curveBehaviorExplanation: "Aggressive slope designed for fast price discovery and immediate market momentum.",
    configAddressDevnet: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
  },
};

export interface DbcLaunchStock {
  id: string;
  ticker: string;
  name: string;
  description: string;
  sector: string;
  preset: "STEADY" | "GROWTH" | "MOMENTUM";
  baseMint: string;
  quoteMint: string;
  poolAddress: string;
  configAddress: string;
  migrationTarget: string;
  migrationThresholdSol: number;
  totalCurveSupply: number;
  network: "devnet" | "mainnet";
  creatorPubkey: string;
  createdAt: number;
  listingRulesSummary?: string;
}

export const METEORA_DEVNET_LAUNCH_STOCK: DbcLaunchStock = {
  id: "dbc-aero",
  ticker: "AERO",
  name: "AeroOrbit Propulsion Labs",
  description:
    "Next-generation commercial orbital launch and reusable propulsion technology. Fair-launch price discovery on Meteora Dynamic Bonding Curve.",
  sector: "Aerospace & Deep Tech",
  preset: "STEADY",
  baseMint: "Gu6XmsKrk7AWn3JhN5dbgSNrJA37VAbr9QVXqcjczX3",
  quoteMint: "So11111111111111111111111111111111111111112",
  poolAddress: "3oEBVanZw9AZ8LvhpN4w9EGP8DffqLJay5Qpnd5rr1k9",
  configAddress: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
  migrationTarget: "Meteora DAMM v2",
  migrationThresholdSol: 84.15,
  totalCurveSupply: 10_000_000,
  network: "devnet",
  creatorPubkey: "8rLkM6Ljv6YdNTUFmxEyW7mXPXQvWw3PK9RjZWUpmSUJ",
  createdAt: Date.now() - 86400000 * 2,
  listingRulesSummary: "Unique fair-launch equity asset on Meteora DBC.",
};

export interface ConvictionMilestone {
  step: 1 | 2 | 3 | 4;
  percent: number;
  title: string;
  description: string;
  unlocked: boolean;
}

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
  uniqueBuyersCount: number;
  requiredUniqueBuyers: number;
  accumulatedFeesSol: number;
  canGraduate: boolean;
  milestones: ConvictionMilestone[];
  network: "devnet" | "mainnet";
}

// Real-world stock ticker blocklist
export const REAL_STOCK_TICKER_BLOCKLIST = new Set([
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "TSLA", "META", "BRK", "BRK.A", "BRK.B",
  "JPM", "V", "UNH", "XOM", "JNJ", "WMT", "PG", "MA", "HD", "CVX", "LLY", "MRK", "ABBV",
  "PEP", "KO", "BAC", "AVGO", "COST", "TMO", "MCD", "DIS", "CSCO", "ACN", "ABT", "DHR",
  "LIN", "VZ", "NEE", "ADBE", "NKE", "TXN", "PM", "BMY", "UPS", "MS", "AMD", "INTC",
  "QCOM", "RTX", "HON", "UNP", "LOW", "SPY", "QQQ", "VOO", "IWM", "DIA", "COIN", "PLTR",
  "NFLX", "UBER", "ABNB", "PYPL", "SQ", "SHOP", "SNOW", "CRM", "ORCL", "IBM", "BA", "GE",
  "GS", "C", "WFC", "BLK", "AXP", "MDLZ", "GILD", "ISRG", "VRTX", "REGN", "BKNG", "PANW"
]);

export const BLOCKED_CORPORATE_NAMES = [
  "apple inc", "microsoft corp", "nvidia corporation", "tesla inc", "amazon.com", "alphabet inc", "meta platforms"
];
