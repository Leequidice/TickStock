"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Download,
} from "lucide-react";

interface WalletBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey: string;
  privateKeyBase58: string;
  onConfirmedBackup: () => void;
}

export const WalletBackupModal: React.FC<WalletBackupModalProps> = ({
  isOpen,
  onClose,
  publicKey,
  privateKeyBase58,
  onConfirmedBackup,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPub, setCopiedPub] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(privateKeyBase58);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyPub = () => {
    navigator.clipboard.writeText(publicKey);
    setCopiedPub(true);
    setTimeout(() => setCopiedPub(false), 2000);
  };

  const handleProceed = () => {
    if (!isAcknowledged) return;
    onConfirmedBackup();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-amber-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Key className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Back Up Your Mainnet Wallet</h2>
            <p className="text-[11px] text-amber-400 font-mono font-semibold">
              Self-Custodial • 100% Client-Side Storage
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 mb-4 space-y-2 text-xs text-slate-200 leading-relaxed">
          <div className="font-bold text-amber-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Important Security Notice:</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Your private key was generated <strong>in your browser</strong> and is stored encrypted in local <strong>IndexedDB</strong>. TickStock servers <strong>never</strong> have access to your private key.
          </p>
          <p className="text-[11px] text-amber-200 font-semibold">
            ⚠️ If you clear your browser cache or change devices without saving this backup, your funds cannot be recovered by anyone.
          </p>
        </div>

        {/* Public Address */}
        <div className="mb-4">
          <label className="text-[11px] font-mono text-slate-400 block mb-1">
            Your Solana Deposit Address:
          </label>
          <div className="flex items-center gap-2 bg-background p-2.5 rounded-xl border border-slate-700">
            <span className="text-[11px] font-mono text-slate-300 break-all select-all flex-1">
              {publicKey}
            </span>
            <button
              onClick={handleCopyPub}
              className="p-1.5 rounded-lg bg-surface-elevated hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
              title="Copy Address"
            >
              {copiedPub ? <Check className="w-3.5 h-3.5 text-solana-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Private Key Reveal Box */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-mono text-slate-400">
              Private Key (Base58 Secret):
            </label>
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className="text-[11px] font-semibold text-solana-blue hover:text-blue-300 flex items-center gap-1"
            >
              {isRevealed ? (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Hide</span>
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Reveal Secret</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-background p-3 rounded-xl border border-slate-700 relative group">
            {isRevealed ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-amber-300 break-all select-all flex-1">
                  {privateKeyBase58}
                </span>
                <button
                  onClick={handleCopyKey}
                  className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors shrink-0"
                  title="Copy Private Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-solana-green" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsRevealed(true)}
                className="py-2 text-center text-xs font-mono text-slate-500 cursor-pointer hover:text-slate-300 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>•••••••••••••••••••••••••••••••••••••••••••••••• (Click to Reveal)</span>
              </div>
            )}
          </div>
        </div>

        {/* Mandatory Acknowledgment Checkbox */}
        <div className="mb-5 bg-surface-elevated/70 p-3 rounded-xl border border-slate-700/60">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAcknowledged}
              onChange={(e) => setIsAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-700 text-solana-green focus:ring-0 focus:outline-none accent-solana-green"
            />
            <span className="text-[11px] text-slate-300 leading-tight">
              I have saved my private key in a secure location and understand that TickStock does not store it and cannot restore my funds if lost.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <button
          onClick={handleProceed}
          disabled={!isAcknowledged}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirm Backup & Continue to Mainnet
        </button>
      </div>
    </div>
  );
};
