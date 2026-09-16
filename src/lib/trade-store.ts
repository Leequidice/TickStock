"use client";

import { TokenizedStock } from "./stocks";

export interface TradePosition {
  stockId: string;
  ticker: string;
  name: string;
  shares: number;
  totalUsdInvested: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  pnlUsd: number;
  pnlPercent: number;
  isSimulated: boolean;
  transactions: TradeTransaction[];
}

export interface TradeTransaction {
  id: string;
  stockId: string;
  ticker: string;
  type: "BUY" | "SELL" | "SKIP";
  usdAmount: number;
  shares: number;
  price: number;
  timestamp: number;
  txHash?: string;
  isSimulated: boolean;
}

const STORAGE_KEY_TRADES_DEVNET = "tickstock_trades_devnet_v2";
const STORAGE_KEY_TRADES_MAINNET = "tickstock_trades_mainnet_v2";
const STORAGE_KEY_AMOUNT = "tickstock_trade_amount";
const STORAGE_KEY_RISK_ACCEPTED = "tickstock_mainnet_risk_accepted_v1";

export function getPreferredTradeAmount(): number {
  if (typeof window === "undefined") return 25;
  const stored = localStorage.getItem(STORAGE_KEY_AMOUNT);
  return stored ? parseFloat(stored) : 25;
}

export function setPreferredTradeAmount(amount: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_AMOUNT, amount.toString());
}

export function hasAcceptedMainnetRisk(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY_RISK_ACCEPTED) === "true";
}

export function setAcceptedMainnetRisk(accepted: boolean = true): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_RISK_ACCEPTED, accepted.toString());
}

export function getTradeHistory(network: "devnet" | "mainnet" = "devnet"): TradeTransaction[] {
  if (typeof window === "undefined") return [];
  const key = network === "mainnet" ? STORAGE_KEY_TRADES_MAINNET : STORAGE_KEY_TRADES_DEVNET;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Failed to load ${network} trade history:`, e);
    return [];
  }
}

export function saveTradeTransaction(
  tx: TradeTransaction,
  network: "devnet" | "mainnet" = "devnet"
): void {
  if (typeof window === "undefined") return;
  const key = network === "mainnet" ? STORAGE_KEY_TRADES_MAINNET : STORAGE_KEY_TRADES_DEVNET;
  try {
    const history = getTradeHistory(network);
    const updated = [tx, ...history];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error(`Failed to save ${network} trade transaction:`, e);
  }
}

export function clearTradeHistory(network: "devnet" | "mainnet" = "devnet"): void {
  if (typeof window === "undefined") return;
  const key = network === "mainnet" ? STORAGE_KEY_TRADES_MAINNET : STORAGE_KEY_TRADES_DEVNET;
  localStorage.removeItem(key);
}

/**
 * Aggregates all trade transactions into current portfolio positions
 */
export function calculatePortfolioPositions(
  stocks: TokenizedStock[],
  transactions: TradeTransaction[]
): {
  positions: TradePosition[];
  totalValue: number;
  totalCost: number;
  totalPnlUsd: number;
  totalPnlPercent: number;
  totalBuys: number;
  totalSkips: number;
} {
  const stockMap = new Map(stocks.map((s) => [s.id, s]));
  const posMap = new Map<string, TradePosition>();

  let totalSkips = 0;
  let totalBuys = 0;

  // Process transactions chronologically (oldest to newest)
  const sortedTx = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  for (const tx of sortedTx) {
    if (tx.type === "SKIP") {
      totalSkips++;
      continue;
    }

    const stock = stockMap.get(tx.stockId);
    const currentPrice = stock ? stock.basePrice : tx.price;

    let pos = posMap.get(tx.stockId);
    if (!pos) {
      pos = {
        stockId: tx.stockId,
        ticker: tx.ticker,
        name: stock ? stock.name : tx.ticker,
        shares: 0,
        totalUsdInvested: 0,
        averageBuyPrice: 0,
        currentPrice: currentPrice,
        currentValue: 0,
        pnlUsd: 0,
        pnlPercent: 0,
        isSimulated: tx.isSimulated,
        transactions: [],
      };
      posMap.set(tx.stockId, pos);
    }

    if (tx.type === "BUY") {
      totalBuys++;
      pos.shares += tx.shares;
      pos.totalUsdInvested += tx.usdAmount;
    } else if (tx.type === "SELL") {
      if (pos.shares > 0) {
        const ratio = Math.min(1, tx.shares / pos.shares);
        pos.totalUsdInvested -= pos.totalUsdInvested * ratio;
        pos.shares -= tx.shares;
        if (pos.shares < 0.000001) {
          pos.shares = 0;
          pos.totalUsdInvested = 0;
        }
      }
    }

    pos.transactions.push(tx);
  }

  // Calculate averages and PnL
  const positions: TradePosition[] = [];
  let totalValue = 0;
  let totalCost = 0;

  posMap.forEach((pos) => {
    if (pos.shares > 0.000001) {
      pos.averageBuyPrice = pos.shares > 0 ? pos.totalUsdInvested / pos.shares : 0;
      pos.currentValue = pos.shares * pos.currentPrice;
      pos.pnlUsd = pos.currentValue - pos.totalUsdInvested;
      pos.pnlPercent =
        pos.totalUsdInvested > 0 ? (pos.pnlUsd / pos.totalUsdInvested) * 100 : 0;

      totalValue += pos.currentValue;
      totalCost += pos.totalUsdInvested;
      positions.push(pos);
    }
  });

  const totalPnlUsd = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnlUsd / totalCost) * 100 : 0;

  return {
    positions,
    totalValue,
    totalCost,
    totalPnlUsd,
    totalPnlPercent,
    totalBuys,
    totalSkips,
  };
}
