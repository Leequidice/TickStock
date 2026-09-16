"use client";

import React from "react";
import {
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  Code2,
  ExternalLink,
  X,
  Wallet,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface DemoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoGuideModal: React.FC<DemoGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-solana-purple to-solana-green p-0.5 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-solana-green" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-1.5">
              Tick<span className="solana-gradient-text">Stock</span>
              <span className="text-xs text-slate-400 font-mono font-normal">
                • Architecture Guide
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Stocklana Hackathon MVP
            </p>
          </div>
        </div>

        {/* Core Architecture Pillars */}
        <div className="space-y-3 mb-4">
          <div className="bg-surface-elevated border border-solana-green/40 rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="text-xs font-bold text-solana-green flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-solana-green fill-solana-green" />
              <span>1. Zero-Friction 1-Swipe Trading (Primary Path)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Just open the app and start swiping! <strong>No wallet extension, no prior setup, and zero gas fees needed</strong>. Every new visitor gets an automatic in-app custodial wallet pre-funded with $1,000 dUSD starting cash. Our server sponsors 100% of Solana Devnet gas fees.
            </p>
          </div>

          <div className="bg-surface-elevated border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-solana-purple flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-solana-purple" />
              <span>2. Optional Social Login (Save & Sync Portfolio)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sign in with <strong>Google or Discord</strong> anytime to link your custodial wallet to your account. Your wallet is secured in our <strong>AES-256-GCM encrypted database vault</strong>, so your on-chain portfolio and cash balance persist across devices and re-logins.
            </p>
          </div>

          <div className="bg-surface-elevated border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="text-xs font-bold text-solana-blue flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-solana-blue" />
              <span>3. Advanced: Non-Custodial Phantom Migration & Delegation</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Power users can connect their own Phantom/Solflare wallet, batch-export their in-app token positions, or approve an optional 1-time scoped SPL delegation ($25–$100 dUSD) for gasless trading from their self-custodial wallet.
            </p>
          </div>
        </div>

        {/* Swipe Controls */}
        <div className="bg-background/80 border border-slate-800 p-3 rounded-2xl mb-4 text-xs font-mono space-y-1 text-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-solana-green font-bold">👉 Swipe Right:</span>
            <span>Atomic Swap $10–$100 dUSD for stock</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-loss font-bold">👈 Swipe Left:</span>
            <span>Skip to next stock</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-solana-blue font-bold">⌨️ Keyboard:</span>
            <span>Arrow Keys (Right = Buy, Left = Pass)</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-solana-green to-emerald-400 hover:opacity-95 text-slate-950 font-black text-sm transition-all active:scale-95 shadow-lg shadow-solana-green/20"
        >
          Got It — Let's Trade!
        </button>
      </div>
    </div>
  );
};
