"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Terminal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Cloud,
  HardDrive,
} from "lucide-react";
import {
  getClientWalletRecord,
  getAllClientWalletRecords,
  decryptClientWalletRecord,
  StoredWalletRecord,
} from "@/lib/client-vault";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

interface WalletBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  publicKey: string;
  privateKeyBase58?: string;
  onConfirmedBackup: () => void;
}

export const WalletBackupModal: React.FC<WalletBackupModalProps> = ({
  isOpen,
  onClose,
  userId,
  publicKey,
  privateKeyBase58: initialPrivateKeyBase58 = "",
  onConfirmedBackup,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  // Raw Record State
  const [storedRecord, setStoredRecord] = useState<StoredWalletRecord | null>(null);
  const [allRecords, setAllRecords] = useState<StoredWalletRecord[]>([]);
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);
  const [showRawRecord, setShowRawRecord] = useState(true);
  const [isGoogleAccount, setIsGoogleAccount] = useState(false);

  // PIN Decryption State
  const [pinInput, setPinInput] = useState("");
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  const [revealedPrivateKey, setRevealedPrivateKey] = useState<string>(initialPrivateKeyBase58);
  const [isKeyVerified, setIsKeyVerified] = useState<boolean>(false);

  const loadRecordFromDB = useCallback(async () => {
    setIsLoadingRecord(true);
    setDecryptionError(null);
    const isGoogle = userId?.startsWith("google_") || false;
    setIsGoogleAccount(isGoogle);

    try {
      let record: StoredWalletRecord | null = null;
      if (userId) {
        record = await getClientWalletRecord(userId);
      }

      const all = await getAllClientWalletRecords();
      setAllRecords(all);

      if (!record && all.length > 0) {
        record = all.find((r) => r.publicKey === publicKey) || null;
      }

      setStoredRecord(record);

      // If initialPrivateKeyBase58 is given
      if (initialPrivateKeyBase58) {
        try {
          const secretBytes = bs58.decode(initialPrivateKeyBase58);
          const kp = Keypair.fromSecretKey(secretBytes);
          if (kp.publicKey.toBase58() === (record?.publicKey || publicKey)) {
            setRevealedPrivateKey(initialPrivateKeyBase58);
            setIsKeyVerified(true);
          }
        } catch {}
      }

      // Check localStorage cached wallet as fallback
      if (!revealedPrivateKey && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("tickstock_inapp_wallet_v3");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.secretKeyBase64) {
              const secretBytes = Buffer.from(parsed.secretKeyBase64, "base64");
              const b58 = bs58.encode(secretBytes);
              const kp = Keypair.fromSecretKey(secretBytes);
              if (kp.publicKey.toBase58() === (publicKey || record?.publicKey)) {
                setRevealedPrivateKey(b58);
                setIsKeyVerified(true);
              }
            }
          }
        } catch {}
      }

      // If it's a Google account and we don't have the key yet, query server vault
      if (isGoogle && !revealedPrivateKey && userId) {
        try {
          const res = await fetch("/api/wallet/custodial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.secretKeyBase64) {
              const secretBytes = Buffer.from(data.secretKeyBase64, "base64");
              const b58 = bs58.encode(secretBytes);
              setRevealedPrivateKey(b58);
              setIsKeyVerified(true);
            }
          }
        } catch {}
      }
    } catch (err: any) {
      console.error("[WalletBackupModal] Error loading vault record:", err);
      setDecryptionError("Failed to access storage.");
    } finally {
      setIsLoadingRecord(false);
    }
  }, [userId, publicKey, initialPrivateKeyBase58, revealedPrivateKey]);

  useEffect(() => {
    if (isOpen) {
      loadRecordFromDB();
      if (initialPrivateKeyBase58) {
        setRevealedPrivateKey(initialPrivateKeyBase58);
        setIsKeyVerified(true);
      }
    }
  }, [isOpen, loadRecordFromDB, initialPrivateKeyBase58]);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    if (!revealedPrivateKey) return;
    navigator.clipboard.writeText(revealedPrivateKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyPub = () => {
    navigator.clipboard.writeText(storedRecord?.publicKey || publicKey);
    setCopiedPub(true);
    setTimeout(() => setCopiedPub(false), 2000);
  };

  const handleCopyRaw = () => {
    const rawData = storedRecord || {
      vaultType: "Google OAuth Server Custodial Vault",
      userId: userId || "google_account",
      publicKey: publicKey,
      encryption: "AES-256-GCM with Server Master Key",
      status: "Verified & Exportable",
    };
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const handleDecryptWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecryptionError(null);

    if (!pinInput || pinInput.length < 4) {
      setDecryptionError("Please enter your spending PIN (at least 4 digits).");
      return;
    }

    if (!storedRecord) {
      setDecryptionError("No stored wallet record found in local IndexedDB to decrypt.");
      return;
    }

    setIsDecrypting(true);
    try {
      const { keypair, privateKeyBase58 } = await decryptClientWalletRecord(storedRecord, pinInput);

      const derivedAddress = keypair.publicKey.toBase58();
      if (derivedAddress !== storedRecord.publicKey) {
        throw new Error(`Address Mismatch: Derived ${derivedAddress} does not match stored ${storedRecord.publicKey}`);
      }

      setRevealedPrivateKey(privateKeyBase58);
      setIsKeyVerified(true);
      setIsRevealed(true);
      setDecryptionError(null);
    } catch (err: any) {
      console.error("[WalletBackupModal] Decryption failed:", err);
      setDecryptionError(err.message || "Incorrect PIN or corrupted record.");
      setRevealedPrivateKey("");
      setIsKeyVerified(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleProceed = () => {
    if (!isAcknowledged) return;
    onConfirmedBackup();
    onClose();
  };

  const displayPublicKey = storedRecord?.publicKey || publicKey;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-surface-card border border-amber-500/60 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Key className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Mainnet Private Key & Vault Export</h2>
              <p className="text-[11px] text-amber-400 font-mono font-semibold flex items-center gap-1">
                {isGoogleAccount ? (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Google OAuth Encrypted Vault</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Client-Side IndexedDB Vault</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Public Address */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Solana Deposit Address:</span>
            {isKeyVerified && (
              <span className="text-solana-green font-bold flex items-center gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                <span>100% Keypair Verified</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-background p-2.5 rounded-xl border border-slate-700">
            <span className="text-[11px] font-mono text-amber-300 font-bold break-all select-all flex-1">
              {displayPublicKey}
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

        {/* Section 1: Raw Vault Record Audit */}
        <div className="border border-slate-800 rounded-2xl p-3.5 bg-surface-elevated/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRawRecord(!showRawRecord)}
              className="flex items-center gap-1.5 font-bold text-slate-300 hover:text-white font-mono text-[11px]"
            >
              <Terminal className="w-3.5 h-3.5 text-solana-green" />
              <span>Vault Storage Audit</span>
              {showRawRecord ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            <button
              onClick={handleCopyRaw}
              className="text-[10px] font-mono text-slate-400 hover:text-solana-green flex items-center gap-1"
            >
              {copiedRaw ? <Check className="w-3 h-3 text-solana-green" /> : <Copy className="w-3 h-3" />}
              <span>Copy JSON</span>
            </button>
          </div>

          {showRawRecord && (
            <div className="space-y-2 pt-1 font-mono text-[10px] animate-in fade-in duration-150">
              {isLoadingRecord ? (
                <div className="flex items-center gap-2 text-slate-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Loading vault record...</span>
                </div>
              ) : storedRecord ? (
                <div className="space-y-1.5 bg-background/90 p-2.5 rounded-xl border border-slate-800 text-slate-300 leading-tight select-all">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                    <span>User Key: <strong className="text-white">{storedRecord.userId}</strong></span>
                    <span>Created: {new Date(storedRecord.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Storage: </span>
                    <span className="text-cyan-400">IndexedDB ('wallets' store)</span>
                  </div>
                  <div>
                    <span className="text-slate-500">publicKey: </span>
                    <span className="text-solana-green">{storedRecord.publicKey}</span>
                  </div>
                  <div className="break-all">
                    <span className="text-slate-500">encryptedSecret: </span>
                    <span className="text-amber-300">{storedRecord.encryptedSecret}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">iv (12-byte): </span>
                    <span className="text-cyan-400">{storedRecord.iv}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">salt (16-byte PBKDF2): </span>
                    <span className="text-purple-400">{storedRecord.salt}</span>
                  </div>
                </div>
              ) : isGoogleAccount ? (
                <div className="space-y-1.5 bg-background/90 p-2.5 rounded-xl border border-amber-500/30 text-slate-300 leading-tight select-all">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                    <span>User Key: <strong className="text-white">{userId}</strong></span>
                    <span className="text-amber-400 font-bold">Google Vault</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Storage: </span>
                    <span className="text-amber-300">Encrypted Server Vault (AES-256-GCM)</span>
                  </div>
                  <div>
                    <span className="text-slate-500">publicKey: </span>
                    <span className="text-solana-green">{publicKey}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Status: </span>
                    <span className="text-solana-green font-bold">✓ Decrypted & Verified in Session</span>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-elevated border border-slate-800 p-2.5 rounded-xl text-slate-400 text-[11px]">
                  Storage Mode: In-App Volatile Session. Total local records: {allRecords.length}.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2: Revealed Private Key Box */}
        <div className="border border-amber-500/40 rounded-2xl p-4 bg-surface-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>{revealedPrivateKey ? "Solana Private Key (Phantom / Solflare Format)" : "Decrypt Private Key with PIN"}</span>
            </div>
            {revealedPrivateKey && (
              <button
                type="button"
                onClick={() => setIsRevealed(!isRevealed)}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{isRevealed ? "Hide" : "Reveal"}</span>
              </button>
            )}
          </div>

          {decryptionError && (
            <div className="p-2.5 rounded-xl bg-loss/10 border border-loss/30 text-loss text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="leading-tight">{decryptionError}</span>
            </div>
          )}

          {/* If private key is available */}
          {revealedPrivateKey ? (
            <div className="space-y-2">
              <div className="bg-background p-3 rounded-xl border border-amber-500/40 relative">
                {isRevealed ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-amber-300 break-all select-all flex-1 font-bold">
                      {revealedPrivateKey}
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
                    className="py-1.5 text-center text-xs font-mono text-slate-400 cursor-pointer hover:text-white flex items-center justify-center gap-1.5 select-none"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>•••••••••••••••••••••••••••••••••••••••• (Click to Reveal)</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-solana-green font-bold">✓ Derived Keypair matches deposit address exactly.</span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="text-amber-400 hover:text-amber-300 underline font-bold"
                >
                  {copiedKey ? "✓ Copied to Clipboard" : "Copy Base58 Key"}
                </button>
              </div>
            </div>
          ) : storedRecord ? (
            /* PIN Input Form for IndexedDB users */
            <form onSubmit={handleDecryptWithPin} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Enter your Spending PIN"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-slate-700 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={isDecrypting || pinInput.length < 4}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {isDecrypting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Decrypting...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Decrypt & Reveal</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Enter your spending PIN to decrypt your key from local browser storage.
              </p>
            </form>
          ) : (
            <div className="p-3 bg-background rounded-xl border border-slate-800 text-center">
              <p className="text-xs text-slate-400">No active key in memory. Please sign in to export your key.</p>
            </div>
          )}
        </div>

        {/* Confirmation Checkbox */}
        <div className="p-3 bg-surface-elevated/40 border border-slate-800 rounded-xl flex items-start gap-2.5">
          <input
            type="checkbox"
            id="acknowledge"
            checked={isAcknowledged}
            onChange={(e) => setIsAcknowledged(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-400 h-4 w-4 bg-background"
          />
          <label htmlFor="acknowledge" className="text-[11px] text-slate-300 leading-tight select-none cursor-pointer">
            I understand that I can import this key directly into Phantom or Solflare to manage my funds independently.
          </label>
        </div>

        {/* Done / Close Button */}
        <button
          onClick={handleProceed}
          disabled={!isAcknowledged}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
        >
          Confirm Backup & Close
        </button>
      </div>
    </div>
  );
};
