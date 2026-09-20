import fs from "fs";
import path from "path";
import { DbcLaunchStock, METEORA_DEVNET_LAUNCH_STOCK } from "./meteora-dbc-types";

const DATA_DIR = path.join(process.cwd(), "data");
const LAUNCHED_POOLS_FILE = path.join(DATA_DIR, "launched_pools.json");

export const INITIAL_LAUNCHED_POOLS: DbcLaunchStock[] = [
  METEORA_DEVNET_LAUNCH_STOCK,
  {
    id: "dbc-hypr",
    ticker: "HYPR",
    name: "Hyperion Photonic Quantum",
    description: "Next-generation room-temperature photonic optical qubits for ultra-fast cloud computing.",
    sector: "Quantum Computing",
    preset: "GROWTH",
    baseMint: "HyprQ11111111111111111111111111111111111111",
    quoteMint: "So11111111111111111111111111111111111111112",
    poolAddress: "HyprPooL11111111111111111111111111111111111",
    configAddress: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
    migrationTarget: "Meteora DAMM v2",
    migrationThresholdSol: 50.0,
    totalCurveSupply: 10_000_000,
    network: "devnet",
    creatorPubkey: "8rLkM6Ljv6YdNTUFmxEyW7mXPXQvWw3PK9RjZWUpmSUJ",
    createdAt: Date.now() - 3600000 * 5,
    listingRulesSummary: "Unique fair-launch equity asset on Meteora DBC.",
  },
  {
    id: "dbc-synt",
    ticker: "SYNT",
    name: "SynthoBio Synthetic Enzymes",
    description: "Computational protein folding platform designing artificial biocatalysts for industrial carbon capture.",
    sector: "Clean Biotech",
    preset: "MOMENTUM",
    baseMint: "SyntQ11111111111111111111111111111111111111",
    quoteMint: "So11111111111111111111111111111111111111112",
    poolAddress: "SyntPooL11111111111111111111111111111111111",
    configAddress: "6XCMS8az62ebYLxK4LAYdKH8ETN2TwvY6rVdAdvPC6k",
    migrationTarget: "Meteora DAMM v2",
    migrationThresholdSol: 25.0,
    totalCurveSupply: 10_000_000,
    network: "devnet",
    creatorPubkey: "8rLkM6Ljv6YdNTUFmxEyW7mXPXQvWw3PK9RjZWUpmSUJ",
    createdAt: Date.now() - 3600000 * 12,
    listingRulesSummary: "Unique fair-launch equity asset on Meteora DBC.",
  }
];

let inMemoryCache: DbcLaunchStock[] | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Loads all launched pools from disk (survives restarts/reloads).
 */
export function getPersistedLaunchedPools(): DbcLaunchStock[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(LAUNCHED_POOLS_FILE)) {
      fs.writeFileSync(LAUNCHED_POOLS_FILE, JSON.stringify(INITIAL_LAUNCHED_POOLS, null, 2), "utf8");
      inMemoryCache = [...INITIAL_LAUNCHED_POOLS];
      return inMemoryCache;
    }

    const raw = fs.readFileSync(LAUNCHED_POOLS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryCache = parsed;
      return parsed;
    }
  } catch (err) {
    console.error("[DbcStorage] Error reading launched pools from disk:", err);
  }

  if (!inMemoryCache) {
    inMemoryCache = [...INITIAL_LAUNCHED_POOLS];
  }
  return inMemoryCache;
}

/**
 * Saves a newly created pool to persistent storage.
 */
export function savePersistedLaunchedPool(newPool: DbcLaunchStock): void {
  try {
    ensureDataDir();
    const current = getPersistedLaunchedPools();
    // Prepend new pool (or replace if existing ID)
    const filtered = current.filter((p) => p.id !== newPool.id && p.ticker !== newPool.ticker);
    const updated = [newPool, ...filtered];
    fs.writeFileSync(LAUNCHED_POOLS_FILE, JSON.stringify(updated, null, 2), "utf8");
    inMemoryCache = updated;
  } catch (err) {
    console.error("[DbcStorage] Error saving launched pool to disk:", err);
    if (inMemoryCache) {
      inMemoryCache.unshift(newPool);
    }
  }
}

/**
 * Checks if a ticker is already in use by any previously launched pool.
 */
export function isTickerAlreadyInUse(ticker: string): boolean {
  const clean = ticker.trim().toUpperCase().replace("$", "");
  const pools = getPersistedLaunchedPools();
  return pools.some((p) => p.ticker.toUpperCase().replace("$", "") === clean);
}
