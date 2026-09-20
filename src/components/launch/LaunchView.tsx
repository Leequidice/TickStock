"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  PlusCircle,
  Coins,
  ShieldAlert,
  Percent,
  Wallet,
  Check,
  ChevronRight,
  Flame,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  DbcPoolStatus,
  DbcLaunchStock,
  METEORA_DEVNET_LAUNCH_STOCK,
  CURVE_PRESETS,
  CurvePreset,
  validateListingTicker,
} from "@/lib/meteora-dbc";
import { fetchLiveRaydiumStockPools, RaydiumStockYieldPool } from "@/lib/raydium-earn";
import { formatCurrency, cn } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/solana";
import { DbcStockCard } from "./DbcStockCard";

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
  // Tabs: "fair-launch" | "create-pool" | "lp-earn"
  const [activeTab, setActiveTab] = useState<"fair-launch" | "create-pool" | "lp-earn">("fair-launch");

  // Live Pools & Status
  const [poolsList, setPoolsList] = useState<DbcLaunchStock[]>([METEORA_DEVNET_LAUNCH_STOCK]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [poolStatus, setPoolStatus] = useState<DbcPoolStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isClaimingFees, setIsClaimingFees] = useState(false);

  // Pool Creation Form State (Stage 1)
  const [formTicker, setFormTicker] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPreset, setFormPreset] = useState<"STEADY" | "GROWTH" | "MOMENTUM">("STEADY");
  const [formNetwork, setFormNetwork] = useState<"devnet" | "mainnet">(network);
  const [formValidationWarning, setFormValidationWarning] = useState<string | null>(null);
  const [isCreatingPool, setIsCreatingPool] = useState(false);
  const [confirmedTerms, setConfirmedTerms] = useState(true);

  // Raydium Earn Live Pools (Stage 4 Real xStocks Yield Preview)
  const [earnPools, setEarnPools] = useState<RaydiumStockYieldPool[]>([]);
  const [isLoadingEarn, setIsLoadingEarn] = useState(false);

  // Notifications
  const [lastNotification, setLastNotification] = useState<{
    type: "SUCCESS" | "ERROR" | "SKIP";
    message: string;
    subtext?: string;
    signature?: string;
    explorerUrl?: string;
  } | null>(null);

  const isMainnet = network === "mainnet";

  const currentStockIndex = poolsList.length > 0 ? currentIndex % poolsList.length : 0;
  const currentStock = poolsList[currentStockIndex] || METEORA_DEVNET_LAUNCH_STOCK;

  const fetchStatus = useCallback(async () => {
    try {
      const stockId = currentStock?.id || "dbc-aero";
      const res = await fetch(`/api/launch/pool?stockId=${stockId}&network=${network}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPoolStatus(data.pool);
          if (data.allStocks && data.allStocks.length > 0) {
            setPoolsList(data.allStocks);
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load DBC pool status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [network, currentStock?.id]);

  const fetchEarnPools = useCallback(async () => {
    try {
      setIsLoadingEarn(true);
      const res = await fetch("/api/earn");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pools) {
          setEarnPools(data.pools);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Raydium pools:", e);
    } finally {
      setIsLoadingEarn(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (activeTab === "lp-earn") {
      fetchEarnPools();
    }
  }, [activeTab, fetchEarnPools]);

  // Auto-dismiss notification after 6 seconds
  useEffect(() => {
    if (lastNotification) {
      const t = setTimeout(() => setLastNotification(null), 6000);
      return () => clearTimeout(t);
    }
  }, [lastNotification]);

  // Real-time unique ticker validation for Pool Creation
  useEffect(() => {
    if (!formTicker && !formName) {
      setFormValidationWarning(null);
      return;
    }
    const existingTickers = poolsList.map((p) => p.ticker);
    const val = validateListingTicker(formTicker || "TEST", formName || "Test Company", existingTickers);
    if (!val.valid) {
      setFormValidationWarning(val.reason || "Invalid asset name");
    } else {
      setFormValidationWarning(null);
    }
  }, [formTicker, formName, poolsList]);

  // Handle Swipe-Right (Buy on Curve)
  const handleSwipeRightBuy = async (targetStock: DbcLaunchStock) => {
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
          stockId: targetStock.id,
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
        message: `Bought ${data.shares?.toFixed(2)} $${targetStock.ticker}! 🚀`,
        subtext: `Executed on Meteora DBC (${data.solAmountSpent?.toFixed(3)} SOL)`,
        signature: data.signature,
        explorerUrl: data.explorerUrl,
      });

      // Advance to next card
      setCurrentIndex((prev) => prev + 1);
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

  // Handle Swipe-Left (Skip)
  const handleSwipeLeftSkip = (targetStock: DbcLaunchStock) => {
    setLastNotification({
      type: "SKIP",
      message: `Skipped $${targetStock.ticker}`,
    });
    setCurrentIndex((prev) => prev + 1);
  };

  const handleTriggerMigration = async () => {
    setIsMigrating(true);
    try {
      const res = await fetch("/api/launch/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, stockId: currentStock.id }),
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

  const handleClaimFees = async () => {
    setIsClaimingFees(true);
    try {
      const res = await fetch("/api/launch/claim-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPublicKey: activeWalletPubkey.toBase58(),
          network,
          stockId: currentStock.id,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLastNotification({
          type: "SUCCESS",
          message: `Claimed ${data.claimedSolAmount?.toFixed(4)} SOL fee dividend! 💰`,
          subtext: "Trading fee reward deposited to your wallet.",
          signature: data.signature,
          explorerUrl: data.explorerUrl,
        });
        fetchStatus();
      } else {
        setLastNotification({
          type: "ERROR",
          message: data.message || "No claimable fees available yet.",
        });
      }
    } catch (err: any) {
      setLastNotification({
        type: "ERROR",
        message: err.message || "Failed to claim fees.",
      });
    } finally {
      setIsClaimingFees(false);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTicker || !formName || !formDescription) {
      setLastNotification({
        type: "ERROR",
        message: "Please fill in all listing parameters.",
      });
      return;
    }

    const existingTickers = poolsList.map((p) => p.ticker);
    const val = validateListingTicker(formTicker, formName, existingTickers);
    if (!val.valid) {
      setLastNotification({
        type: "ERROR",
        message: val.reason || "Ticker validation failed.",
      });
      return;
    }

    setIsCreatingPool(true);
    try {
      const res = await fetch("/api/launch/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: formTicker.toUpperCase().trim(),
          name: formName.trim(),
          description: formDescription.trim(),
          preset: formPreset,
          network: formNetwork,
          creatorPublicKey: activeWalletPubkey.toBase58(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLastNotification({
          type: "SUCCESS",
          message: `DBC Pool for $${formTicker.toUpperCase()} Deployed! 🚀`,
          subtext: `Pool: ${data.stock?.poolAddress?.slice(0, 8)}...`,
          signature: data.signature,
          explorerUrl: data.explorerUrl,
        });

        // Reset form, refresh list and jump to fair launch tab
        setFormTicker("");
        setFormName("");
        setFormDescription("");
        setActiveTab("fair-launch");
        setCurrentIndex(0);
        fetchStatus();
      } else {
        setLastNotification({
          type: "ERROR",
          message: data.error || "Failed to create DBC pool.",
        });
      }
    } catch (err: any) {
      setLastNotification({
        type: "ERROR",
        message: err.message || "Error submitting pool creation.",
      });
    } finally {
      setIsCreatingPool(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 pb-20 sm:pb-8 relative animate-in fade-in duration-200">
      {/* Top-Right Notification Balloon */}
      {lastNotification && (
        <div className="fixed top-4 right-4 sm:top-5 sm:right-5 z-50 max-w-[340px] w-full animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          <div
            className={cn(
              "p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-2.5 border",
              lastNotification.type === "SUCCESS"
                ? "bg-surface-elevated/95 border-solana-green/50 text-white"
                : lastNotification.type === "SKIP"
                ? "bg-surface-elevated/95 border-slate-700 text-slate-300"
                : "bg-surface-elevated/95 border-loss/50 text-loss"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                  lastNotification.type === "SUCCESS"
                    ? "bg-solana-green/20"
                    : lastNotification.type === "SKIP"
                    ? "bg-slate-700"
                    : "bg-loss/20"
                )}
              >
                {lastNotification.type === "SUCCESS" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-solana-green" />
                ) : lastNotification.type === "SKIP" ? (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
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

      {/* Navigation Segment Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-surface-elevated/80 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab("fair-launch")}
          className={cn(
            "py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
            activeTab === "fair-launch"
              ? "bg-slate-800 text-solana-green shadow-md border border-slate-700/60"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Fair Launch</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("create-pool")}
          className={cn(
            "py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
            activeTab === "create-pool"
              ? "bg-slate-800 text-solana-purple shadow-md border border-slate-700/60"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Deploy Listing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("lp-earn")}
          className={cn(
            "py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all",
            activeTab === "lp-earn"
              ? "bg-slate-800 text-solana-blue shadow-md border border-slate-700/60"
              : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Yield Pools</span>
        </button>
      </div>

      {/* TAB 1: SWIPEABLE FAIR-LAUNCH DISCOVER CARDS */}
      {activeTab === "fair-launch" && (
        <div className="space-y-4">
          {/* Active Launched Pools Horizontal Carousel / Quick Switcher */}
          {poolsList.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {poolsList.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 border transition-all",
                    currentStock.id === p.id
                      ? "bg-solana-green/20 border-solana-green text-solana-green shadow-sm"
                      : "bg-surface-elevated/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  <span>${p.ticker}</span>
                  <span className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-[100px]">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clean Informative Header Pill */}
          <div className="bg-solana-purple/10 border border-solana-purple/30 rounded-2xl p-3 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-solana-purple shrink-0 mt-0.5" />
            <div className="text-slate-300 leading-relaxed text-[11px]">
              <strong className="text-white">Meteora DBC Fair-Launch:</strong> Swipe right to buy fractional equity directly from the dynamic bonding curve. All listings migrate permanently to Meteora DAMM v2 upon reaching graduation targets.
            </div>
          </div>

          {/* Swipeable Stock Card */}
          <DbcStockCard
            key={currentStock.id}
            stock={currentStock}
            poolStatus={poolStatus}
            tradeAmount={tradeAmount}
            network={network}
            onSwipeRight={handleSwipeRightBuy}
            onSwipeLeft={handleSwipeLeftSkip}
            isSwapping={isSwapping}
            onClaimFees={handleClaimFees}
            isClaimingFees={isClaimingFees}
            onTriggerMigration={handleTriggerMigration}
            isMigrating={isMigrating}
          />
        </div>
      )}

      {/* TAB 2: STAGE 1 - DEPLOY NEW LISTING */}
      {activeTab === "create-pool" && (
        <form
          onSubmit={handleCreatePool}
          className="bg-surface-card border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Rocket className="w-4 h-4 text-solana-purple" />
                <span>Deploy New Equity Asset Listing</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Deploy a dynamic bonding curve with automated liquidity migration to Meteora DAMM v2.
              </p>
            </div>
          </div>

          {/* Network Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Deployment Network</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormNetwork("devnet")}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all",
                  formNetwork === "devnet"
                    ? "bg-solana-green/10 border-solana-green text-white"
                    : "bg-surface-elevated border-slate-800 text-slate-400 hover:border-slate-700"
                )}
              >
                <div className="font-bold text-xs text-solana-green">Solana Devnet</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Free deployment • Instant testing</div>
              </button>

              <button
                type="button"
                onClick={() => setFormNetwork("mainnet")}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-all",
                  formNetwork === "mainnet"
                    ? "bg-solana-purple/10 border-solana-purple text-white"
                    : "bg-surface-elevated border-slate-800 text-slate-400 hover:border-slate-700"
                )}
              >
                <div className="font-bold text-xs text-solana-purple">Solana Mainnet-Beta</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Live bonding curve deployment</div>
              </button>
            </div>
          </div>

          {/* Ticker & Name Inputs with Uniqueness Validation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Ticker Symbol</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-mono text-slate-500">$</span>
                <input
                  type="text"
                  placeholder="ORBIT"
                  value={formTicker}
                  onChange={(e) => setFormTicker(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="w-full pl-6 pr-3 py-2 bg-surface-elevated border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-solana-purple"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Company / Project Name</label>
              <input
                type="text"
                placeholder="Orbit Technologies Inc."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={40}
                className="w-full px-3 py-2 bg-surface-elevated border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-solana-purple"
              />
            </div>
          </div>

          {/* Validation Rule Notice */}
          <div className="text-[10px] text-slate-400">
            Ticker must be unique — not already listed here or as a public security.
          </div>

          {/* Uniqueness & Blocklist Validation Warning */}
          {formValidationWarning && (
            <div className="bg-loss/10 border border-loss/30 rounded-xl p-2.5 text-xs text-loss flex items-start gap-2 animate-in fade-in duration-150">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-snug text-[11px] font-medium">{formValidationWarning}</div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">Company & Asset Thesis</label>
            <textarea
              rows={2}
              placeholder="Describe the company business model, technology thesis, and asset purpose..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-solana-purple resize-none"
            />
          </div>

          {/* Curve Preset Selection (3 Presets) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Bonding Curve Preset</span>
              <span className="text-[10px] text-slate-500">Curated pricing algorithms</span>
            </label>

            <div className="space-y-2">
              {(Object.values(CURVE_PRESETS) as CurvePreset[]).map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => setFormPreset(preset.id)}
                  className={cn(
                    "p-3 rounded-2xl border cursor-pointer transition-all",
                    formPreset === preset.id
                      ? "bg-solana-purple/15 border-solana-purple/80 text-white shadow-md"
                      : "bg-surface-elevated/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center",
                          formPreset === preset.id
                            ? "border-solana-purple bg-solana-purple"
                            : "border-slate-600"
                        )}
                      >
                        {formPreset === preset.id && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                      <span className="font-bold text-xs text-white">{preset.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-slate-700 text-slate-300">
                      Target: {preset.thresholdSol} SOL
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-1 pl-6 leading-tight">
                    {preset.curveBehaviorExplanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Terms Confirmation Checkbox */}
          <div className="p-3 bg-surface-elevated/40 border border-slate-800 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="confirmTerms"
              checked={confirmedTerms}
              onChange={(e) => setConfirmedTerms(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-solana-purple focus:ring-solana-purple h-4 w-4 bg-background"
            />
            <label htmlFor="confirmTerms" className="text-[11px] text-slate-300 leading-tight select-none cursor-pointer">
              I confirm this asset adheres to unique ticker listing rules and fair-launch parameter standards.
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isCreatingPool || !!formValidationWarning || !formTicker || !formName || !confirmedTerms}
            className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-solana-purple to-pink-500 text-white hover:opacity-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-solana-purple/20 active:scale-98"
          >
            {isCreatingPool ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deploying On-Chain DBC Pool...</span>
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                <span>Deploy DBC Fair Launch Pool</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* TAB 3: RAYDIUM EARN / LP YIELD PREVIEW */}
      {activeTab === "lp-earn" && (
        <div className="space-y-4">
          <div className="bg-surface-elevated/70 border border-slate-800 rounded-2xl p-3.5 text-xs flex items-start gap-2.5">
            <Coins className="w-4 h-4 text-solana-blue shrink-0 mt-0.5" />
            <div className="text-slate-300 text-[11px] leading-relaxed">
              <strong className="text-white">Raydium Concentrated & CPMM Yield Analytics:</strong> Real-time yield and APR data on tokenized equity assets (xStocks) powered by Raydium v3 API. In-app 1-click staking is currently under development (Coming Soon).
            </div>
          </div>

          {isLoadingEarn && earnPools.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-solana-blue" />
              <span>Fetching live pool APRs from Raydium API...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {earnPools.map((pool) => (
                <div
                  key={pool.id}
                  className="bg-surface-card border border-slate-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white font-mono">{pool.pairName}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-solana-blue/20 border border-solana-blue/40 text-solana-blue">
                          {pool.poolType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {pool.underlyingCompany} • Fee Tier: {pool.feeTierPercent}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        TVL: ${pool.tvlUsd.toLocaleString()} • 24h Vol: ${pool.volume24hUsd.toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-solana-green font-mono">
                        {pool.apr24h}% APR
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Fee: {pool.feeApr}% | Farm: {pool.rewardApr}%
                      </div>
                    </div>
                  </div>

                  {/* Impermanent Loss Risk & Analysis */}
                  <div className="p-2.5 rounded-xl bg-surface-elevated/50 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Impermanent Loss Risk:</span>
                      <span
                        className={cn(
                          "font-bold",
                          pool.impermanentLossRisk === "Low"
                            ? "text-solana-green"
                            : pool.impermanentLossRisk === "Moderate"
                            ? "text-amber-400"
                            : "text-loss"
                        )}
                      >
                        {pool.impermanentLossRisk} Risk
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      {pool.impermanentLossAnalysis}
                    </p>
                  </div>

                  {/* Staking Status & Coming Soon Badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Status:</span>
                      <span className="text-xs font-mono text-slate-300">
                        Live Yield Analytics Only
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="px-3.5 py-1.5 rounded-xl bg-surface-elevated text-slate-400 border border-slate-700 font-bold font-mono text-xs cursor-not-allowed flex items-center gap-1.5 opacity-80"
                      title="In-app 1-click staking for Raydium liquidity pools is coming soon"
                    >
                      <Coins className="w-3.5 h-3.5 text-solana-blue" />
                      <span>Stake LP</span>
                      <span className="text-[9px] bg-solana-blue/20 text-solana-blue px-1.5 py-0.2 rounded font-sans font-bold">
                        Coming Soon
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
