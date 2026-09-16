"use client";

import React, { useState } from "react";
import { Lock, Key, ShieldCheck, X, Loader2, AlertCircle } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCreation?: boolean;
  onSubmit: (pin: string) => Promise<void>;
  title?: string;
  subtitle?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  isCreation = false,
  onSubmit,
  title,
  subtitle,
}) => {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (pin.length < 4) {
      setError("Please enter a PIN with at least 4 digits/characters.");
      return;
    }

    if (isCreation && pin !== confirmPin) {
      setError("PINs do not match. Please re-enter.");
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(pin);
      setIsLoading(false);
      setPin("");
      setConfirmPin("");
    } catch (err: any) {
      setError(err.message || "Failed to process PIN");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-amber-500/50 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">
              {title || (isCreation ? "Set Wallet Spending PIN" : "Enter Spending PIN")}
            </h2>
            <p className="text-[11px] text-amber-400 font-mono">
              {subtitle || (isCreation ? "Protects your client-side key" : "Unlocks wallet for 15 minutes")}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-loss/10 border border-loss/30 text-loss text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">
              {isCreation ? "Choose a 6-digit PIN (or passphrase):" : "Spending PIN:"}
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              className="w-full px-4 py-3 rounded-2xl bg-background border border-slate-700 text-center text-lg text-white tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          {isCreation && (
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Confirm PIN:
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="••••••"
                className="w-full px-4 py-3 rounded-2xl bg-background border border-slate-700 text-center text-lg text-white tracking-widest placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
          )}

          <div className="p-3 rounded-xl bg-surface-elevated/70 border border-slate-800 text-[11px] text-slate-400 leading-tight space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-solana-green" />
              <span>Zero-Server Knowledge</span>
            </div>
            <p className="text-[10px]">
              Derives an AES-256-GCM key with PBKDF2 (100k iterations) inside your browser. Cached in memory for 15 minutes of uninterrupted swiping.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || pin.length < 4 || (isCreation && confirmPin.length < 4)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>{isCreation ? "Create PIN & Mainnet Wallet" : "Unlock Wallet"}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
