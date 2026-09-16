"use client";

import { PublicKey } from "@solana/web3.js";
import { TokenizedStock } from "./stocks";
import { saveTradeTransaction, TradeTransaction } from "./trade-store";

export interface ExecutionResult {
  success: boolean;
  signature?: string;
  shares?: number;
  usdAmount?: number;
  onChain?: boolean;
  explorerUrl?: string;
  error?: string;
  type?: "BUY" | "SELL";
}

export async function executeAtomicSwipeBuy(
  stock: TokenizedStock,
  usdAmount: number,
  walletPubkey: PublicKey,
  isCustodial: boolean = false,
  custodialSecretKeyBase64?: string
): Promise<ExecutionResult> {
  const shares = Number((usdAmount / stock.basePrice).toFixed(6));

  try {
    const res = await fetch("/api/trade/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPublicKey: walletPubkey.toBase58(),
        mintAddress: stock.mintAddress,
        shares,
        ticker: stock.ticker,
        usdAmount,
        isCustodial,
        custodialSecretKeyBase64: isCustodial ? custodialSecretKeyBase64 : undefined,
        type: "BUY",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Trade transaction failed to execute on Devnet",
      };
    }

    const tx: TradeTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "BUY",
      usdAmount,
      shares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: data.signature,
      isSimulated: false,
    };
    saveTradeTransaction(tx, "devnet");

    return {
      success: true,
      signature: data.signature,
      shares,
      usdAmount,
      onChain: true,
      explorerUrl: data.explorerUrl,
      type: "BUY",
    };
  } catch (err: any) {
    console.error("Atomic swap execution error:", err);
    return {
      success: false,
      error: err.message || "Network error while submitting trade transaction",
    };
  }
}

export async function executeAtomicSwipeSell(
  stock: TokenizedStock,
  shares: number,
  walletPubkey: PublicKey,
  isCustodial: boolean = false,
  custodialSecretKeyBase64?: string
): Promise<ExecutionResult> {
  const usdAmount = Number((shares * stock.basePrice).toFixed(2));

  try {
    const res = await fetch("/api/trade/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPublicKey: walletPubkey.toBase58(),
        mintAddress: stock.mintAddress,
        shares,
        ticker: stock.ticker,
        usdAmount,
        isCustodial,
        custodialSecretKeyBase64: isCustodial ? custodialSecretKeyBase64 : undefined,
        type: "SELL",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || "Sell transaction failed to execute on Devnet",
      };
    }

    const tx: TradeTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "SELL",
      usdAmount,
      shares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: data.signature,
      isSimulated: false,
    };
    saveTradeTransaction(tx, "devnet");

    return {
      success: true,
      signature: data.signature,
      shares,
      usdAmount,
      onChain: true,
      explorerUrl: data.explorerUrl,
      type: "SELL",
    };
  } catch (err: any) {
    console.error("Atomic sell execution error:", err);
    return {
      success: false,
      error: err.message || "Network error while submitting sell transaction",
    };
  }
}

export async function requestDusdFaucet(
  walletPubkey: PublicKey
): Promise<{ success: boolean; signature?: string; explorerUrl?: string; error?: string }> {
  try {
    const res = await fetch("/api/trade/faucet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPublicKey: walletPubkey.toBase58() }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    return {
      success: false,
      error: data.error || "Failed to claim initial dUSD from server authority",
    };
  } catch (e: any) {
    console.error("dUSD Faucet request error:", e);
    return {
      success: false,
      error: e.message || "Network error while requesting dUSD faucet",
    };
  }
}
