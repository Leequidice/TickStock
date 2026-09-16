"use client";

import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { DUSD_MINT_ADDRESS, DEVNET_MOCK_STOCKS } from "./stocks";
import { getSplTokenBalance } from "./solana";

const STORAGE_KEY_INAPP_WALLET = "tickstock_inapp_wallet_v3";
const STORAGE_KEY_ONBOARDED = "tickstock_inapp_onboarded_v3";
const STORAGE_KEY_USER_PROFILE = "tickstock_user_profile_v2";

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  image?: string;
  provider: "guest" | "google" | "discord" | "demo";
  publicKey: string;
}

export interface InAppWalletData {
  publicKey: string;
  secretKeyBase64: string;
  isCustodial: true;
}

/**
 * Retrieves active user profile from local storage
 */
export function getActiveUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Sets active user profile
 */
export function setActiveUserProfile(profile: UserProfile | null): void {
  if (typeof window === "undefined") return;
  if (!profile) {
    localStorage.removeItem(STORAGE_KEY_USER_PROFILE);
  } else {
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(profile));
  }
}

/**
 * Fetches or creates a user's wallet via the encrypted server vault (/api/wallet/custodial).
 * All keys are real random Keypair.generate() stored encrypted at rest with AES-256-GCM.
 */
export async function fetchOrCreateServerCustodialWallet(params: {
  userId: string;
  name?: string;
  provider?: "guest" | "google" | "discord" | "demo";
  email?: string;
}): Promise<{ keypair: Keypair; isNew: boolean; profile: UserProfile }> {
  const res = await fetch("/api/wallet/custodial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: params.userId,
      name: params.name,
      provider: params.provider || "guest",
      email: params.email,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Failed to retrieve custodial wallet from server vault");
  }

  const data = await res.json();
  const secretKey = Buffer.from(data.secretKeyBase64, "base64");
  const keypair = Keypair.fromSecretKey(secretKey);

  const profile: UserProfile = {
    id: params.userId,
    name: params.name || "Explorer",
    provider: params.provider || "guest",
    email: params.email,
    publicKey: keypair.publicKey.toBase58(),
  };

  setActiveUserProfile(profile);

  // Cache in localStorage for fast synchronous render
  const walletData: InAppWalletData = {
    publicKey: keypair.publicKey.toBase58(),
    secretKeyBase64: data.secretKeyBase64,
    isCustodial: true,
  };
  localStorage.setItem(STORAGE_KEY_INAPP_WALLET, JSON.stringify(walletData));
  if (!data.isNew) {
    setClaimedInitialDusd(keypair.publicKey.toBase58());
  }

  return { keypair, isNew: data.isNew, profile };
}

/**
 * Synchronous bootstrap for immediate render on app load:
 * Loads cached session or generates an initial guest keypair while triggering background sync.
 */
export function getOrCreateInAppWallet(): { keypair: Keypair; isNew: boolean; profile: UserProfile } {
  if (typeof window === "undefined") {
    const fresh = Keypair.generate();
    return {
      keypair: fresh,
      isNew: true,
      profile: { id: "guest", name: "Guest Explorer", provider: "guest", publicKey: fresh.publicKey.toBase58() },
    };
  }

  const activeProfile = getActiveUserProfile();

  try {
    const raw = localStorage.getItem(STORAGE_KEY_INAPP_WALLET);
    if (raw) {
      const parsed: InAppWalletData = JSON.parse(raw);
      const secretKey = Buffer.from(parsed.secretKeyBase64, "base64");
      const keypair = Keypair.fromSecretKey(secretKey);
      const profile: UserProfile = activeProfile || {
        id: "guest_" + keypair.publicKey.toBase58().slice(0, 8),
        name: "Guest Explorer",
        provider: "guest",
        publicKey: keypair.publicKey.toBase58(),
      };
      return { keypair, isNew: false, profile };
    }
  } catch (e) {
    console.warn("Failed to load cached wallet:", e);
  }

  // Generate fresh random keypair for initial guest session
  const fresh = Keypair.generate();
  const secretKeyBase64 = Buffer.from(fresh.secretKey).toString("base64");
  const data: InAppWalletData = {
    publicKey: fresh.publicKey.toBase58(),
    secretKeyBase64,
    isCustodial: true,
  };
  localStorage.setItem(STORAGE_KEY_INAPP_WALLET, JSON.stringify(data));
  const guestProfile: UserProfile = {
    id: "guest_" + fresh.publicKey.toBase58().slice(0, 8),
    name: "Guest Explorer",
    provider: "guest",
    publicKey: fresh.publicKey.toBase58(),
  };
  setActiveUserProfile(guestProfile);

  return { keypair: fresh, isNew: true, profile: guestProfile };
}

/**
 * Checks if the wallet has claimed starting dUSD
 */
export function hasClaimedInitialDusd(walletPubkey?: string): boolean {
  if (typeof window === "undefined") return false;
  const key = walletPubkey ? `${STORAGE_KEY_ONBOARDED}_${walletPubkey}` : STORAGE_KEY_ONBOARDED;
  return localStorage.getItem(key) === "true";
}

export function setClaimedInitialDusd(walletPubkey?: string): void {
  if (typeof window === "undefined") return;
  const key = walletPubkey ? `${STORAGE_KEY_ONBOARDED}_${walletPubkey}` : STORAGE_KEY_ONBOARDED;
  localStorage.setItem(key, "true");
}

/**
 * Fetches all token holdings for the custodial wallet
 */
export async function fetchInAppHoldings(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<{ dusdBalance: number; stocks: { ticker: string; balance: number; mint: string }[] }> {
  const dusdBalance = await getSplTokenBalance(
    connection,
    walletPubkey,
    new PublicKey(DUSD_MINT_ADDRESS),
    6
  );

  const stockHoldings: { ticker: string; balance: number; mint: string }[] = [];
  for (const stock of DEVNET_MOCK_STOCKS) {
    const bal = await getSplTokenBalance(
      connection,
      walletPubkey,
      new PublicKey(stock.mintAddress),
      stock.decimals
    );
    if (bal > 0) {
      stockHoldings.push({ ticker: stock.ticker, balance: bal, mint: stock.mintAddress });
    }
  }

  return { dusdBalance, stocks: stockHoldings };
}
