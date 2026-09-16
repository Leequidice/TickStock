"use client";

import React, { useState } from "react";
import { ArrowDownLeft, Copy, Check, X, Coins, Zap, ShieldCheck } from "lucide-react";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  publicKey,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Add Money to TickStock Wallet</h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Solana Mainnet Address (Self-Custodial)
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Transfer USDC and a small amount of SOL to your TickStock wallet address below. You retain sole custody and access to all deposited funds.
        </p>

        <div className="bg-surface-elevated border border-slate-700/60 rounded-2xl p-4 mb-4 space-y-2">
          <label className="text-[11px] font-mono text-slate-400 block">
            Your Public Wallet Address:
          </label>
          <div className="flex items-center gap-2 bg-background p-2.5 rounded-xl border border-slate-800">
            <span className="text-[11px] font-mono text-slate-200 break-all select-all flex-1">
              {publicKey}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
              title="Copy Address"
            >
              {copied ? <Check className="w-4 h-4 text-solana-green" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-slate-300 mb-5">
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background border border-slate-800">
            <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-[11px]">1. Deposit USDC (For Trading)</div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Send Solana SPL USDC to buy fractional shares of stocks on Mainnet.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background border border-slate-800">
            <Zap className="w-4 h-4 text-solana-purple shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-[11px]">2. Small SOL (For Gas Fees)</div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Keep ~0.005–0.01 SOL to cover instant Solana network transaction fees.
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-surface-elevated hover:bg-slate-700 text-white font-bold text-xs transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
