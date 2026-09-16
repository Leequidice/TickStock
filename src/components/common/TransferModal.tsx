"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  X,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  inAppSecretKeyBase64: string;
  totalPortfolioValue: number;
  dusdBalance: number;
  onTransferSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  inAppSecretKeyBase64,
  totalPortfolioValue,
  dusdBalance,
  onTransferSuccess,
}) => {
  const { connected, publicKey } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!connected || !publicKey) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/trade/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inAppSecretKeyBase64,
          destinationPublicKey: publicKey.toBase58(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTxSig(data.signature || "simulated_transfer_confirmed");
        onTransferSuccess();
      } else {
        setErrorMsg(data.error || "Failed to transfer holdings.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Transfer error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-solana-purple to-solana-green p-0.5 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
              <Wallet className="w-5 h-5 text-solana-green" />
            </div>
          </div>
          <div>
            <h2 className="text-base font-black text-white">
              Upgrade to Self-Custody
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Transfer In-App Holdings to Phantom
            </p>
          </div>
        </div>

        {txSig ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-solana-green/20 text-solana-green flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Transfer Completed!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                All stock tokens and remaining dUSD have been securely migrated to your connected wallet.
              </p>
            </div>
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-solana-blue hover:underline font-mono"
            >
              <span>View On Solana Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-surface-elevated hover:bg-slate-700 text-white font-bold text-xs mt-4 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Holdings summary to migrate */}
            <div className="bg-surface-elevated border border-slate-700/60 rounded-2xl p-4 mb-4 space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                Holdings to Migrate:
              </div>
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="text-slate-300">Stock Assets Value:</span>
                <span className="font-bold text-white">
                  {formatCurrency(totalPortfolioValue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-mono">
                <span className="text-slate-300">dUSD Cash Balance:</span>
                <span className="font-bold text-solana-green">
                  {formatCurrency(dusdBalance)}
                </span>
              </div>
            </div>

            {connected && publicKey ? (
              <div className="space-y-4">
                <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <span>Destination:</span>
                  <span className="text-solana-purple font-bold">
                    {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-6)}
                  </span>
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-loss/10 border border-loss/30 text-loss text-xs">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleTransfer}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-solana-green to-emerald-400 hover:opacity-95 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-solana-green/20 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Migrating On-Chain...</span>
                    </>
                  ) : (
                    <>
                      <span>Transfer All Assets to Phantom</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-300">
                  Connect your Phantom or Solflare wallet using the button in the top bar to proceed with migrating your assets.
                </p>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-surface-elevated text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Got It
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
