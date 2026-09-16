"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  Rocket,
  TrendingUp,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Info,
  Layers,
  Sparkles,
  Loader2,
  Award,
  ArrowRight,
  DollarSign,
  X,
} from "lucide-react";
import { DbcPoolStatus, DbcLaunchStock, METEORA_DEVNET_LAUNCH_STOCK } from "@/lib/meteora-dbc";
import { formatCurrency, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface LaunchViewProps {
  network: "devnet" | "mainnet";
  tradeAmount: number;
  cashBalance: number;
  activeWalletPubkey: PublicKey;
  onTradeExecuted: () => void;
  onOpenDepositModal?: () => void;
  onOpenAuthModal?: () => void;
}

export const LaunchView: React.FC<LaunchViewProps> = ({
  network,
  tradeAmount,
  cashBalance,
  activeWalletPubkey,
  onTradeExecuted,
  onOpenDepositModal,
  onOpenAuthModal,
}) => {
  const [stock, setStock] = useState<DbcLaunchStock>(METEORA_DEVNET_LAUNCH_STOCK);
  const [poolStatus, setPoolStatus] = useState<DbcPoolStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showEquityCurveExplainer, setShowEquityCurveExplainer] = useState(false);

  const [lastNotification, setLastNotification] = useState<{
    type: "SUCCESS" | "ERROR";
    message: string;
    subtext?: string;
    signature?: string;
    explorerUrl?: string;
  } | null>(null);

  const isMainnet = network === "mainnet";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/launch/pool?network=${network}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPoolStatus(data.pool);
          setStock(data.stock);
        }
      }
    } catch (err) {
      console.warn("Failed to load DBC pool status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [network]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (lastNotification) {
      const t = setTimeout(() => setLastNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [lastNotification]);

  const handleBuyDbc = async () => {
    if (isSwapping) return;

    if (!activeWalletPubkey || activeWalletPubkey.toBase58() === "11111111111111111111111111111111") {
      setLastNotification({
        type: "ERROR",
        message: "Please sign in or initialize a wallet first.",
      });
      return;
    }

    setIsSwapping(true);
    try {
      const res = await fetch("/api/launch/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: activeWalletPubkey.toBase58(),
          usdAmount: tradeAmount,
          network,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setLastNotification({
          type: "ERROR",
          message: data.error || "Failed to buy on Meteora DBC.",
        });
        setIsSwapping(false);
        return;
      }

      setLastNotification({
        type: "SUCCESS",
        message: `Bought ${data.shares?.toFixed(2)} $${stock.ticker}! 🚀`,
        subtext: `Executed on Meteora DBC (${data.solAmountSpent?.toFixed(3)} SOL)`,
        signature: data.signature,
        explorerUrl: data.explorerUrl,
      });

      fetchStatus();
      onTradeExecuted();
    } catch (err: any) {
      setLastNotification({
        type: "ERROR",
        message: err.message || "Network error while buying on DBC.",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const handleTriggerMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await fetch("/api/launch/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });

      const data = await res.json();

      if (data.success) {
        setLastNotification({
          type: "SUCCESS",
          message: "Pool successfully graduated to Meteora DAMM v2! 🎓",
          subtext: "Liquidity is now trading on the DAMM v2 DEX pool.",
          signature: data.signature,
          explorerUrl: data.explorerUrl,
        });
        fetchStatus();
      } else {
        setLastNotification({
          type: "ERROR",
          message: data.message || "Graduation criteria not met yet.",
        });
      }
    } catch (err: any) {
      setLastNotification({
        type: "ERROR",
        message: err.message || "Failed to graduate pool.",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const progressPct = poolStatus?.curveProgressPercent || 0;
  const isGraduated = poolStatus?.isMigrated || progressPct >= 100;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 pb-20 sm:pb-8 relative animate-in fade-in duration-200">
      {/* Top-Right Notification Balloon */}
      {lastNotification && (
        <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 max-w-[340px] w-full animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5 border",
              lastNotification.type === "SUCCESS"
                ? "bg-surface-elevated/95 border-solana-green/50 text-white"
                : "bg-surface-elevated/95 border-loss/50 text-loss"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                  lastNotification.type === "SUCCESS" ? "bg-solana-green/20" : "bg-loss/20"
                )}
              >
                {lastNotification.type === "SUCCESS" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-solana-green" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-loss" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{lastNotification.message}</div>
                {lastNotification.subtext && (
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {lastNotification.subtext}
                  </div>
                )}
                {lastNotification.explorerUrl && (
                  <a
                    href={lastNotification.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-solana-blue hover:underline inline-flex items-center gap-0.5 mt-0.5 font-mono"
                  >
                    <span>View on Solana Explorer</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            <button
              onClick={() => setLastNotification(null)}
              className="text-slate-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Fictional Disclaimer Header Pill */}
      <div className="bg-solana-purple/10 border border-solana-purple/30 rounded-2xl p-3 text-xs flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-solana-purple shrink-0 mt-0.5" />
        <div className="text-slate-300 leading-relaxed text-[11px]">
          <strong className="text-white">Meteora DBC Fair-Launch:</strong> Simulated tokenized equity price discovery. Official SDK integration (<span className="font-mono text-solana-purple">dbcij3...aqN</span>).
        </div>
      </div>

      {/* Main IPO / Launch Stock Card */}
      <div className="bg-surface-card border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-4">
        {/* Glow ambient */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-solana-green/15 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header: Ticker, Name, Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-solana-green p-0.5 flex items-center justify-center shadow-lg shrink-0">
              <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center font-mono font-black text-sm text-solana-green">
                ${stock.ticker}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">{stock.name}</h2>
                <a
                  href={getExplorerUrl(stock.poolAddress, "address", network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-solana-green transition-colors"
                  title="View Meteora DBC Pool on Solana Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {stock.sector} • Meteora Dynamic Bonding Curve
              </p>
            </div>
          </div>

          <span
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shrink-0",
              isGraduated
                ? "bg-solana-purple/20 border-solana-purple/40 text-solana-purple"
                : "bg-solana-green/20 border-solana-green/40 text-solana-green"
            )}
          >
            {isGraduated ? "🎓 Graduated DAMM v2" : "🚀 Active on Curve"}
          </span>
        </div>

        {/* Live Curve Spot Price */}
        <div className="flex items-baseline justify-between py-2 border-y border-slate-800/80">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-500">
              Current DBC Spot Price
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-tight">
              {poolStatus ? formatCurrency(poolStatus.currentPriceUsd) : "$0.00126"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              ≈ {poolStatus ? poolStatus.currentPriceSol.toFixed(8) : "0.00000840"} SOL / share
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase font-mono text-slate-500">
              Graduation Target
            </div>
            <div className="text-lg font-extrabold text-solana-blue font-mono">
              {stock.migrationThresholdSol} SOL
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Migrates to Meteora DAMM v2
            </div>
          </div>
        </div>

        {/* Dynamic Bonding Curve Progress Gauge */}
        <div className="space-y-2 bg-surface-elevated/70 border border-slate-800 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Layers className="w-3.5 h-3.5 text-solana-green" />
              <span>DBC Curve Progress</span>
            </div>
            <span className="font-extrabold text-solana-green">
              {progressPct.toFixed(2)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-slate-700/60 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-solana-green via-cyan-400 to-solana-purple rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(2, Math.min(100, progressPct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
            <span>Raised: <strong>{(poolStatus?.quoteReserveSol || 0).toFixed(3)} SOL</strong></span>
            <span>Goal: <strong>{stock.migrationThresholdSol} SOL</strong></span>
          </div>
        </div>

        {/* Equity Curve Rationale Expandable Info */}
        <div className="border border-slate-800 rounded-2xl p-3 bg-surface-elevated/40 text-xs">
          <button
            type="button"
            onClick={() => setShowEquityCurveExplainer(!showEquityCurveExplainer)}
            className="flex items-center justify-between w-full text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-3.5 h-3.5 text-solana-blue" />
              <span>Equity-Like Curve Architecture</span>
            </div>
            <span className="text-[10px] font-mono text-solana-blue">
              {showEquityCurveExplainer ? "Hide Details ▲" : "Why this curve? ▼"}
            </span>
          </button>

          {showEquityCurveExplainer && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1.5 leading-relaxed animate-in fade-in duration-150">
              <p>
                • <strong>Gradual Slope:</strong> Unlike memecoin curves designed for immediate 100x pumps, this equity curve uses a shallow, linear gradient to simulate stable, institutional price discovery.
              </p>
              <p>
                • <strong>0.25% Flat Fee Schedule:</strong> Configured with standard equity trading fees rather than 1-2% predatory launch fees.
              </p>
              <p>
                • <strong>Meteora DAMM v2 Migration:</strong> When {stock.migrationThresholdSol} SOL is reached, all liquidity seamlessly migrates to a full dynamic AMM pool with multi-fee distribution.
              </p>
            </div>
          )}
        </div>

        {/* Buy Action Section */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            disabled={isSwapping || isGraduated}
            onClick={handleBuyDbc}
            className={cn(
              "w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 disabled:opacity-50",
              isGraduated
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-solana-green to-emerald-400 text-slate-950 hover:opacity-95 shadow-solana-green/20"
            )}
          >
            {isSwapping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Executing Buy on DBC Curve...</span>
              </>
            ) : isGraduated ? (
              <>
                <Award className="w-4 h-4" />
                <span>Graduated to Meteora DAMM v2</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>BUY ${tradeAmount} ${stock.ticker} (on Meteora Curve)</span>
              </>
            )}
          </button>

          {/* Graduation Trigger Button if 100% */}
          {progressPct >= 100 && !poolStatus?.isMigrated && (
            <button
              type="button"
              disabled={isMigrating}
              onClick={handleTriggerMigration}
              className="w-full py-2.5 px-4 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/30 border border-solana-purple/50 text-solana-purple font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Migrating Liquidity to DAMM v2...</span>
                </>
              ) : (
                <>
                  <Award className="w-3.5 h-3.5" />
                  <span>Graduate Pool to Meteora DAMM v2</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1 pt-1">
            <span>Pool ID: {stock.poolAddress.slice(0, 4)}...{stock.poolAddress.slice(-4)}</span>
            <span>DBC Program: {stock.configAddress.slice(0, 4)}...{stock.configAddress.slice(-4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
