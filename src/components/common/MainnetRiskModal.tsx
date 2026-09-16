"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, CheckCircle, X } from "lucide-react";

interface MainnetRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const MainnetRiskModal: React.FC<MainnetRiskModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-amber-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Switch to Solana Mainnet</h2>
            <p className="text-[11px] text-amber-400 font-mono font-semibold">
              Real Funds & Live On-Chain Trading
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-5">
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-3.5 space-y-2">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Critical Notice:</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-300">
              <li>You are switching to <strong>Solana Mainnet-Beta</strong>.</li>
              <li>Trades execute against real <strong>xStocks Token-2022</strong> pools via Jupiter/Raydium.</li>
              <li>You must use your own connected wallet with real <strong>USDC and SOL</strong> for network gas fees.</li>
              <li><strong>Zero gas sponsorship or free faucets exist on Mainnet</strong>. All transactions are final and irreversible.</li>
            </ul>
          </div>
          <p className="text-[11px] text-slate-400">
            TickStock never holds custody of your mainnet private keys. You will sign every swap explicitly through your wallet extension.
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-surface-elevated hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            Stay on Devnet
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-lg shadow-amber-500/20"
          >
            Confirm & Enable Mainnet
          </button>
        </div>
      </div>
    </div>
  );
};
