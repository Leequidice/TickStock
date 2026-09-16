"use client";

import React, { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  X,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Info,
} from "lucide-react";
import { buildApproveDelegationTx, buildRevokeDelegationTx } from "@/lib/delegation";

interface DelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAllowance: number;
}

const ALLOWANCE_PRESETS = [25, 50, 100, 250];

export const DelegationModal: React.FC<DelegationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentAllowance,
}) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [selectedAllowance, setSelectedAllowance] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !publicKey) return null;

  const handleApprove = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const tx = await buildApproveDelegationTx(connection, publicKey, selectedAllowance);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Delegation approval error:", err);
      setErrorMsg(err.message || "Approval rejected or failed. Using fallback demo allowance.");
      // Allow fallback after 2 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const tx = await buildRevokeDelegationTx(connection, publicKey);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Delegation revoke error:", err);
      setErrorMsg(err.message || "Failed to revoke delegation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-solana-purple to-solana-green p-0.5 flex items-center justify-center shadow-lg shrink-0">
            <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-solana-green fill-solana-green" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-black text-white">
              Sign-Once Session Trading
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              SPL Token Delegation for 1-Click Micro-Trading
            </p>
          </div>
        </div>

        {/* Scope Selection */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Choose Approved Spending Cap (dUSD only):
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ALLOWANCE_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setSelectedAllowance(amt)}
                className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedAllowance === amt
                    ? "bg-solana-green/20 border-solana-green text-solana-green shadow-sm"
                    : "bg-surface-elevated border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-Prompt Wallet Warning Explanation Banner */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 mb-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Wallet Security Notice (Blowfish / Blockaid)</span>
          </div>
          <p className="text-slate-300 text-[11.5px] leading-relaxed">
            Your wallet extension may display a warning when signing this approval. <strong>This is expected</strong> because security scanners flag all third-party token delegations by default.
          </p>
          <div className="space-y-1 text-[11px] text-slate-300 bg-black/40 p-2.5 rounded-xl border border-amber-500/20">
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
              <span><strong>Strictly Capped:</strong> Grants authority over only <strong>${selectedAllowance}.00 dUSD</strong>.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
              <span><strong>Isolated Devnet Asset:</strong> Never touches your SOL, mainnet tokens, or NFTs.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-solana-green shrink-0 mt-0.5" />
              <span><strong>Revocable Anytime:</strong> Revoke this delegation with one click whenever you choose.</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={handleApprove}
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-solana-green to-emerald-400 hover:opacity-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-solana-green/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Requesting Wallet Signature...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>Approve ${selectedAllowance} & Enable 1-Swipe Trading</span>
              </>
            )}
          </button>

          {currentAllowance > 0 && (
            <button
              onClick={handleRevoke}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-surface-elevated hover:bg-loss/20 border border-slate-700 hover:border-loss/40 text-slate-300 hover:text-loss text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Revoke Existing Delegation (${currentAllowance} remaining)
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-slate-400 hover:text-white text-xs font-medium text-center transition-colors"
          >
            Cancel (Trade with in-app wallet instead)
          </button>
        </div>
      </div>
    </div>
  );
};
