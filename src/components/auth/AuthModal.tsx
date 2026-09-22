"use client";

import React, { useState, useEffect } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Keypair } from "@solana/web3.js";
import {
  X,
  ShieldCheck,
  LogOut,
  User,
  Loader2,
  Key,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  UserProfile,
  setActiveUserProfile,
  fetchOrCreateServerCustodialWallet,
} from "@/lib/custodial-wallet";
import {
  isClientWalletInitialized,
  createClientMainnetWallet,
  unlockClientMainnetWallet,
  lockClientSession,
} from "@/lib/client-vault";
import { PinModal } from "@/components/common/PinModal";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  network: "devnet" | "mainnet";
  activeProfile: UserProfile | null;
  onProfileChanged: (newProfile: UserProfile | null) => void;
  onMainnetClientWalletReady?: (keypair: Keypair, isNew: boolean) => void;
  onOpenBackupModal?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  network,
  activeProfile,
  onProfileChanged,
  onMainnetClientWalletReady,
  onOpenBackupModal,
}) => {
  const { data: session, status: sessionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // PIN flow state for Mainnet
  const [pendingMainnetAuth, setPendingMainnetAuth] = useState<{
    userId: string;
    name: string;
    provider: "google" | "guest";
    email: string;
    isCreation: boolean;
  } | null>(null);

  // Check URL error parameter (e.g. from Google OAuth callback)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        if (err === "OAuthCallback" || err === "Callback") {
          setErrorMessage("Google OAuth callback error. Please check your Google account permissions or try PIN sign in.");
        } else if (err === "OAuthSignin") {
          setErrorMessage("Could not initialize Google OAuth sign in.");
        } else {
          setErrorMessage(`Sign in notice: ${err}`);
        }
      }
    }
  }, [isOpen]);

  // Auto-sync session to profile if authenticated
  useEffect(() => {
    if (
      sessionStatus === "authenticated" &&
      session?.user?.email &&
      (!activeProfile || activeProfile.provider === "guest")
    ) {
      const email = session.user.email;
      const name = session.user.name || "Google User";
      const userId = "google_" + email.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const syncedProfile: UserProfile = {
        id: userId,
        name,
        email,
        image: session.user.image || undefined,
        provider: "google",
        publicKey: activeProfile?.publicKey || "11111111111111111111111111111111",
      };
      setActiveUserProfile(syncedProfile);
      onProfileChanged(syncedProfile);
    }
  }, [session, sessionStatus, activeProfile, onProfileChanged]);

  if (!isOpen) return null;

  const isMainnet = network === "mainnet";

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Trigger NextAuth Google OAuth flow
      await signIn("google");
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setErrorMessage(err.message || "Could not connect to Google OAuth.");
      setIsLoading(false);
    }
  };

  const handleQuickPinSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const email = session?.user?.email || "trader@tickstock.app";
      const name = session?.user?.name || "TickStock Trader";
      const userId = "user_" + email.toLowerCase().replace(/[^a-z0-9]/g, "_");

      if (isMainnet) {
        const isInit = await isClientWalletInitialized(userId);
        setPendingMainnetAuth({
          userId,
          name,
          provider: "google",
          email,
          isCreation: !isInit,
        });
        setIsLoading(false);
        return;
      }

      // Devnet Mode: Server vault lookup for demo
      const { profile } = await fetchOrCreateServerCustodialWallet({
        userId,
        name,
        provider: "google",
        email,
      });

      onProfileChanged(profile);
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error("PIN sign-in failed:", err);
      setErrorMessage(err.message || "Failed to initialize wallet.");
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (!pendingMainnetAuth) return;

    try {
      let keypair: Keypair;
      let isNew = false;

      if (pendingMainnetAuth.isCreation) {
        const res = await createClientMainnetWallet(pendingMainnetAuth.userId, pin);
        keypair = res.keypair;
        isNew = true;
      } else {
        keypair = await unlockClientMainnetWallet(pendingMainnetAuth.userId, pin);
      }

      const profile: UserProfile = {
        id: pendingMainnetAuth.userId,
        name: pendingMainnetAuth.name,
        provider: pendingMainnetAuth.provider,
        email: pendingMainnetAuth.email,
        publicKey: keypair.publicKey.toBase58(),
      };

      setActiveUserProfile(profile);
      onProfileChanged(profile);

      if (onMainnetClientWalletReady) {
        onMainnetClientWalletReady(keypair, isNew);
      }

      setPendingMainnetAuth(null);
      onClose();
    } catch (err: any) {
      throw err;
    }
  };

  const handleLogout = () => {
    lockClientSession();
    setActiveUserProfile(null);
    onProfileChanged(null);
    signOut({ redirect: false }).catch(() => {});
    onClose();
  };

  const isGuest = !activeProfile || activeProfile.provider === "guest";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-surface-card border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl bg-surface-elevated hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-solana-purple to-solana-green p-0.5 flex items-center justify-center shadow-lg shrink-0">
              <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center">
                <User className="w-5 h-5 text-solana-green" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isGuest ? "Sign In to TickStock" : "Your Account"}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {isMainnet ? "Mainnet Trading Account" : "Devnet Demo Account"}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 mb-4 rounded-xl bg-loss/10 border border-loss/30 text-loss text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Active Account Info if Logged In */}
          {!isGuest && activeProfile && (
            <div className="bg-surface-elevated border border-slate-700/60 rounded-2xl p-4 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-solana-purple/20 border border-solana-purple/40 flex items-center justify-center font-bold text-solana-purple text-xs">
                    {activeProfile.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{activeProfile.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{activeProfile.email || activeProfile.id}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-solana-green/20 text-solana-green border border-solana-green/40">
                  Active
                </span>
              </div>

              <div className="pt-2 border-t border-slate-700/50">
                <div className="text-[10px] text-slate-400 font-mono mb-1">
                  {isMainnet ? "Your Self-Custodial Address:" : "Devnet Solana Address:"}
                </div>
                <div className="text-[10px] font-mono text-slate-300 bg-background/80 p-2 rounded-xl border border-slate-800 break-all select-all">
                  {activeProfile.publicKey}
                </div>
              </div>

              {isMainnet && onOpenBackupModal && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenBackupModal();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Export / Backup Private Key</span>
                </button>
              )}

              <div className="text-[11px] text-slate-400 leading-relaxed flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-solana-green shrink-0" />
                <span>
                  {isMainnet
                    ? "Secured by your PIN in browser storage (Zero server key access)."
                    : "Encrypted server vault for Devnet demo testing."}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl bg-surface-card hover:bg-loss/20 border border-slate-700 hover:border-loss/40 text-slate-300 hover:text-loss text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          )}

          {/* Guest Sign-In Options */}
          {isGuest && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign in to start trading — your wallet is created automatically and only you can access it.
              </p>

              <div className="space-y-2.5">
                {/* Google Sign-in */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-md active:scale-98 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                {/* Instant PIN Wallet / Demo Sign-in */}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleQuickPinSignIn}
                  className="w-full py-2.5 px-4 rounded-2xl bg-surface-elevated hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5 text-solana-green" />
                  <span>{isMainnet ? "Create / Unlock with Spending PIN" : "Instant In-App Demo Wallet"}</span>
                </button>
              </div>

              {/* How does this work? */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(!showHowItWorks)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 mx-auto transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>How does this work?</span>
                  {showHowItWorks ? (
                    <ChevronUp className="w-3 h-3 ml-0.5" />
                  ) : (
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  )}
                </button>

                {showHowItWorks && (
                  <div className="mt-2 p-3 rounded-2xl bg-surface-elevated border border-slate-700/60 text-[11px] text-slate-300 leading-relaxed animate-in fade-in duration-150">
                    {isMainnet ? (
                      <div>
                        <div className="font-bold text-white mb-1">🔐 Self-Custodial Security</div>
                        Your Solana keypair is generated directly in your browser and encrypted with your personal PIN in browser storage (IndexedDB). Plaintext keys are never sent to or stored on any server.
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-white mb-1">⚡ Devnet Instant Trading</div>
                        Your account starts with $1,000 dUSD test balance and sponsored transaction fees, allowing instant 1-swipe micro-trading with zero setup.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PIN Modal for Mainnet Setup / Unlock */}
      <PinModal
        isOpen={!!pendingMainnetAuth}
        onClose={() => setPendingMainnetAuth(null)}
        isCreation={pendingMainnetAuth?.isCreation}
        onSubmit={handlePinSubmit}
      />
    </>
  );
};
