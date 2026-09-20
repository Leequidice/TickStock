"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  ExternalLink,
  Layers,
  Flame,
  Award,
  Zap,
  Info,
  Coins,
  CheckCircle2,
  X,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { DbcLaunchStock, DbcPoolStatus, CURVE_PRESETS } from "@/lib/meteora-dbc";
import { formatCurrency, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";

interface DbcStockCardProps {
  stock: DbcLaunchStock;
  poolStatus: DbcPoolStatus | null;
  tradeAmount: number;
  network: "devnet" | "mainnet";
  onSwipeRight: (stock: DbcLaunchStock) => void;
  onSwipeLeft: (stock: DbcLaunchStock) => void;
  isSwapping: boolean;
  onClaimFees: () => void;
  isClaimingFees: boolean;
  onTriggerMigration: () => void;
  isMigrating: boolean;
}

export const DbcStockCard: React.FC<DbcStockCardProps> = ({
  stock,
  poolStatus,
  tradeAmount,
  network,
  onSwipeRight,
  onSwipeLeft,
  isSwapping,
  onClaimFees,
  isClaimingFees,
  onTriggerMigration,
  isMigrating,
}) => {
  const [exitX, setExitX] = useState<number>(0);
  const [showExplainer, setShowExplainer] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const buyStampOpacity = useTransform(x, [20, 100], [0, 1]);
  const buyStampScale = useTransform(x, [20, 100], [0.8, 1.05]);
  const skipStampOpacity = useTransform(x, [-20, -100], [0, 1]);
  const skipStampScale = useTransform(x, [-20, -100], [0.8, 1.05]);

  const progressPct = poolStatus?.curveProgressPercent || 42.8;
  const isGraduated = poolStatus?.isMigrated || progressPct >= 100;
  const currentPreset = CURVE_PRESETS[stock.preset] || CURVE_PRESETS.STEADY;

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      setExitX(400);
      onSwipeRight(stock);
    } else if (info.offset.x < -threshold) {
      setExitX(-400);
      onSwipeLeft(stock);
    }
  };

  return (
    <div className="relative w-full select-none touch-none">
      <motion.div
        style={{ x, rotate }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        animate={{ x: exitX }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full bg-surface-card border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-4 cursor-grab active:cursor-grabbing"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-solana-green/15 rounded-full blur-3xl pointer-events-none" />

        {/* SWIPE STAMPS */}
        {/* BUY STAMP (Right Swipe) */}
        <motion.div
          style={{ opacity: buyStampOpacity, scale: buyStampScale }}
          className="absolute top-6 left-6 z-30 pointer-events-none border-4 border-solana-green bg-solana-green/20 backdrop-blur-md text-solana-green font-black font-mono text-2xl px-4 py-1.5 rounded-2xl rotate-[-15deg] shadow-2xl flex items-center gap-1.5"
        >
          <Zap className="w-6 h-6 fill-solana-green" />
          <span>BUY ${tradeAmount}</span>
        </motion.div>

        {/* SKIP STAMP (Left Swipe) */}
        <motion.div
          style={{ opacity: skipStampOpacity, scale: skipStampScale }}
          className="absolute top-6 right-6 z-30 pointer-events-none border-4 border-loss bg-loss/20 backdrop-blur-md text-loss font-black font-mono text-2xl px-4 py-1.5 rounded-2xl rotate-[15deg] shadow-2xl flex items-center gap-1.5"
        >
          <X className="w-6 h-6 stroke-[3]" />
          <span>SKIP</span>
        </motion.div>

        {/* Card Header: Ticker, Name, Explorer Link */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-solana-green p-0.5 flex items-center justify-center shadow-lg shrink-0">
              <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center font-mono font-black text-sm text-solana-green">
                ${stock.ticker}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">${stock.name}</h2>
                <a
                  href={getExplorerUrl(stock.poolAddress, "address", network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-500 hover:text-solana-green transition-colors"
                  title="View Meteora DBC Pool on Solana Explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                ${stock.sector} • ${currentPreset.name}
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

        {/* Company Description Thesis */}
        <p className="text-xs text-slate-300 leading-relaxed bg-surface-elevated/40 p-3 rounded-2xl border border-slate-800">
          ${stock.description}
        </p>

        {/* Live Curve Spot Price & Graduation Target */}
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
              ${stock.migrationThresholdSol} SOL
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
            <span>Goal: <strong>${stock.migrationThresholdSol} SOL</strong></span>
          </div>
        </div>

        {/* Conviction Milestones & Unique Wallets */}
        <div className="space-y-2.5 bg-surface-elevated/40 border border-slate-800 rounded-2xl p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Conviction Milestones</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {poolStatus?.uniqueBuyersCount || 14} / {poolStatus?.requiredUniqueBuyers || 10} Wallets
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(poolStatus?.milestones || []).map((m) => (
              <div
                key={m.step}
                className={cn(
                  "p-2 rounded-xl border text-center transition-all",
                  m.unlocked
                    ? "bg-solana-green/10 border-solana-green/40 text-solana-green"
                    : "bg-surface/40 border-slate-800 text-slate-500"
                )}
              >
                <div className="text-[11px] font-mono font-black">${m.percent}%</div>
                <div className="text-[9px] font-medium truncate mt-0.5">
                  {m.unlocked ? "✓ Unlocked" : "Locked"}
                </div>
              </div>
            ))}
          </div>

          {/* Fee Dividend Claim Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Accumulated Fee Dividend:</span>
              <span className="font-mono font-bold text-solana-green ml-1.5">
                {(poolStatus?.accumulatedFeesSol || 0.428).toFixed(3)} SOL
              </span>
            </div>
            <button
              type="button"
              disabled={isClaimingFees}
              onClick={(e) => {
                e.stopPropagation();
                onClaimFees();
              }}
              className="px-2.5 py-1 rounded-lg bg-solana-green/20 hover:bg-solana-green/30 text-solana-green font-mono text-[10px] font-bold border border-solana-green/40 transition-all flex items-center gap-1"
            >
              <Coins className="w-3 h-3" />
              <span>Claim Share</span>
            </button>
          </div>
        </div>

        {/* Equity Curve Explainer */}
        <div className="border border-slate-800 rounded-2xl p-3 bg-surface-elevated/40 text-xs">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExplainer(!showExplainer);
            }}
            className="flex items-center justify-between w-full text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5 font-bold">
              <Info className="w-3.5 h-3.5 text-solana-blue" />
              <span>${currentPreset.name} Curve Architecture</span>
            </div>
            <span className="text-[10px] font-mono text-solana-blue">
              {showExplainer ? "Hide ▲" : "Why this curve? ▼"}
            </span>
          </button>

          {showExplainer && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1.5 leading-relaxed animate-in fade-in duration-150">
              <p>
                • <strong>Curve Behavior:</strong> ${currentPreset.curveBehaviorExplanation}
              </p>
              <p>
                • <strong>Graduation Target:</strong> When ${stock.migrationThresholdSol} SOL is reached with conviction distribution, liquidity migrates to Meteora DAMM v2.
              </p>
            </div>
          )}
        </div>

        {/* Graduation Button if 100% or Ready */}
        {progressPct >= 100 && !poolStatus?.isMigrated && (
          <button
            type="button"
            disabled={isMigrating}
            onClick={(e) => {
              e.stopPropagation();
              onTriggerMigration();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-solana-purple/20 hover:bg-solana-purple/30 border border-solana-purple/50 text-solana-purple font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <Award className="w-3.5 h-3.5" />
            <span>Graduate Pool to Meteora DAMM v2 🎓</span>
          </button>
        )}

        {/* Swipe Quick Action Buttons */}
        <div className="pt-1 flex items-center justify-between gap-2.5">
          {/* Skip Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExitX(-400);
              onSwipeLeft(stock);
            }}
            className="w-1/3 py-3 px-3 rounded-2xl bg-surface-elevated hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4 text-loss" />
            <span>Skip</span>
          </button>

          {/* Buy Button */}
          <button
            type="button"
            disabled={isSwapping || isGraduated}
            onClick={(e) => {
              e.stopPropagation();
              setExitX(400);
              onSwipeRight(stock);
            }}
            className={cn(
              "w-2/3 py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95",
              isGraduated
                ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-solana-green to-emerald-400 text-slate-950 hover:opacity-95 shadow-solana-green/20"
            )}
          >
            <Zap className="w-4 h-4 fill-black" />
            <span>Swipe Right to Buy $${tradeAmount} $${stock.ticker}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
