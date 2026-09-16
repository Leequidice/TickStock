"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  TrendingUp,
  Settings2,
  DollarSign,
  HelpCircle,
  Coins,
  Wallet,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface HeaderBarProps {
  network: "devnet" | "mainnet";
  onToggleNetwork: (net: "devnet" | "mainnet") => void;
  tradeAmount: number;
  onChangeTradeAmount: (val: number) => void;
  activeTab: "feed" | "portfolio" | "leaderboard";
  onTabChange: (tab: "feed" | "portfolio" | "leaderboard") => void;
  cashBalance: number;
  delegatedAllowance: number;
  portfolioItemsCount?: number;
  onOpenGuide: () => void;
  onOpenDelegation: () => void;
  onOpenTransfer: () => void;
  onRequestDusdFaucet: () => void;
  isCustodial: boolean;
  activeProfile?: any;
  onOpenAuth: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  network,
  onToggleNetwork,
  tradeAmount,
  onChangeTradeAmount,
  activeTab,
  onTabChange,
  cashBalance,
  portfolioItemsCount = 0,
  onOpenGuide,
  onRequestDusdFaucet,
  activeProfile,
  onOpenAuth,
}) => {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [showSettings, setShowSettings] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const amountPresets = [10, 25, 50, 100];
  const isGuest = !activeProfile || activeProfile.provider === "guest";
  const isMainnet = network === "mainnet";
  const currencySymbol = isMainnet ? "USDC" : "dUSD";

  return (
    <header className={cn(
      "w-full border-b backdrop-blur-md sticky top-0 z-50 transition-colors",
      isMainnet
        ? "bg-[#0f0c08]/95 border-amber-500/20"
        : "bg-surface/95 border-slate-800/80"
    )}>
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Logo & Network Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Brand Logo (No technical subtitles) */}
          <div
            onClick={() => onTabChange("feed")}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className={cn(
              "w-8 h-8 rounded-xl p-0.5 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform",
              isMainnet
                ? "bg-gradient-to-tr from-amber-500 to-orange-500"
                : "bg-gradient-to-tr from-solana-purple to-solana-green"
            )}>
              <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center">
                <TrendingUp className={cn("w-4 h-4", isMainnet ? "text-amber-400" : "text-solana-green")} />
              </div>
            </div>
            <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              <span>Tick<span className={isMainnet ? "text-amber-400" : "solana-gradient-text"}>Stock</span></span>
              {isMainnet && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  MAINNET
                </span>
              )}
            </div>
          </div>

          {/* Sleek Network Toggle Switch */}
          <div className="flex items-center gap-1.5 bg-surface-card/90 px-2 py-1 rounded-full border border-slate-800 shadow-inner">
            <span className={cn(
              "text-[10px] font-mono font-bold transition-colors cursor-pointer select-none",
              !isMainnet ? "text-solana-green" : "text-slate-500 hover:text-slate-400"
            )}
            onClick={() => isMainnet && onToggleNetwork("devnet")}
            >
              Demo
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isMainnet}
              onClick={() => onToggleNetwork(isMainnet ? "devnet" : "mainnet")}
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isMainnet ? "bg-amber-500" : "bg-slate-700"
              )}
              title={isMainnet ? "Switch to Devnet Demo" : "Switch to Mainnet Real Trading"}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
                  isMainnet ? "translate-x-3 bg-amber-100" : "translate-x-0 bg-solana-green"
                )}
              />
            </button>
            <span className={cn(
              "text-[10px] font-mono font-bold transition-colors cursor-pointer select-none",
              isMainnet ? "text-amber-400 font-black" : "text-slate-500 hover:text-slate-400"
            )}
            onClick={() => !isMainnet && onToggleNetwork("mainnet")}
            >
              Real
            </span>
          </div>
        </div>

        {/* Center: Tabs (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-card/80 p-1 rounded-2xl border border-slate-800/80 text-xs font-semibold">
          <button
            onClick={() => onTabChange("feed")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl transition-all",
              activeTab === "feed"
                ? "bg-slate-800 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            🔥 Feed
          </button>
          <button
            onClick={() => onTabChange("portfolio")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5",
              activeTab === "portfolio"
                ? "bg-slate-800 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <span>💼 Portfolio</span>
            {portfolioItemsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-solana-purple text-[10px] font-mono font-bold text-white shadow-sm">
                {portfolioItemsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange("leaderboard")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl transition-all",
              activeTab === "leaderboard"
                ? "bg-slate-800 text-white shadow-sm font-bold"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            🏆 Leaderboard
          </button>
        </nav>

        {/* Right: Cash Balance + Google / Wallet Auth + Settings */}
        <div className="flex items-center gap-2">
          {/* Plain Cash Balance Display */}
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition-colors",
            isMainnet
              ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
              : "bg-surface-card border-slate-800 text-slate-200"
          )}>
            <Wallet className={cn("w-3.5 h-3.5", isMainnet ? "text-amber-400" : "text-solana-green")} />
            <span className={isMainnet ? "text-amber-400" : "text-solana-green"}>
              {formatCurrency(cashBalance)}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">{currencySymbol}</span>
            {!isMainnet && cashBalance < 25 && (
              <button
                onClick={onRequestDusdFaucet}
                className="ml-1 px-1.5 py-0.2 rounded bg-solana-green/20 hover:bg-solana-green/30 text-[9px] font-bold text-solana-green border border-solana-green/40 transition-colors"
                title="Claim $1,000 test dUSD"
              >
                +1K
              </button>
            )}
          </div>

          {/* Auth / Wallet Entry Point */}
          {!isGuest && activeProfile ? (
            /* Logged in User Profile Chip */
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-card hover:bg-surface-elevated border border-slate-800 text-xs text-white transition-all shadow-sm"
              title="Account & Wallet Settings"
            >
              <div className="w-5 h-5 rounded-full bg-solana-purple/30 border border-solana-purple/50 flex items-center justify-center font-bold text-[10px] text-solana-purple">
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[80px] sm:max-w-[110px] truncate font-semibold text-xs">
                {activeProfile.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : connected && publicKey ? (
            /* Connected External Wallet Chip */
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWalletModalVisible(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-card hover:bg-surface-elevated border border-slate-800 text-xs font-mono text-solana-purple transition-colors"
                title="Change External Wallet"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-solana-green" />
                <span>
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </span>
              </button>
              <button
                onClick={() => disconnect()}
                className="p-1.5 rounded-lg bg-surface-card hover:bg-loss/20 text-slate-400 hover:text-loss border border-slate-800 transition-colors"
                title="Disconnect Wallet"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Not Logged In: Prominent Google Sign-in + Secondary External Wallet Option */
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-md hover:shadow-lg transition-all shrink-0 active:scale-95"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span className="hidden sm:inline">Sign in with Google</span>
                <span className="sm:hidden">Sign in</span>
              </button>

              <button
                onClick={() => setWalletModalVisible(true)}
                className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Connect Phantom, Solflare, etc."
              >
                <Wallet className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Connect external wallet</span>
              </button>
            </div>
          )}

          {/* Swipe Amount Settings Pill */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 px-2 py-1.5 bg-surface-card hover:bg-surface-elevated border border-slate-800 rounded-xl text-xs font-mono font-medium text-slate-200 transition-colors"
              title="Set default swipe-buy amount"
            >
              <DollarSign className={cn("w-3.5 h-3.5", isMainnet ? "text-amber-400" : "text-solana-green")} />
              <span>{tradeAmount}</span>
              <Settings2 className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {showSettings && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-card border border-slate-700 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <div className="text-[11px] font-semibold text-slate-400 mb-2">
                  Swipe-Buy Amount
                </div>
                <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                  {amountPresets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        onChangeTradeAmount(amt);
                        setShowSettings(false);
                      }}
                      className={cn(
                        "py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition-all border",
                        tradeAmount === amt
                          ? isMainnet
                            ? "bg-amber-500/20 border-amber-500 text-amber-400"
                            : "bg-solana-green/20 border-solana-green text-solana-green"
                          : "bg-surface-elevated border-slate-700 text-slate-300 hover:border-slate-500"
                      )}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Field */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = parseFloat(customInput);
                    if (!isNaN(val) && val > 0) {
                      onChangeTradeAmount(Number(val.toFixed(2)));
                      setCustomInput("");
                      setShowSettings(false);
                    }
                  }}
                  className="pt-2 border-t border-slate-800"
                >
                  <label className="text-[10px] text-slate-400 font-mono block mb-1">
                    Custom Buy Amount:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="e.g. 75"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        className="w-full pl-6 pr-2 py-1.5 rounded-xl bg-background border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-solana-green"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!customInput || parseFloat(customInput) <= 0}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-colors disabled:opacity-40",
                        isMainnet
                          ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300"
                          : "bg-solana-green/20 hover:bg-solana-green/30 border border-solana-green/40 text-solana-green"
                      )}
                    >
                      Set
                    </button>
                  </div>
                </form>

                <div className="text-[10px] text-slate-500 mt-2">
                  {isMainnet ? "USDC swapped on Raydium/Jupiter." : "dUSD debited atomically on Devnet."}
                </div>
              </div>
            )}
          </div>

          {/* Minimal Guide Button */}
          <button
            onClick={onOpenGuide}
            className="p-1.5 rounded-xl bg-surface-card hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Open Demo Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
