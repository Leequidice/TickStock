"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const DB_NAME = "TickStockClientVault_v2";
const STORE_NAME = "wallets";
const DB_VERSION = 1;
const STORAGE_BACKUP_PREFIX = "tickstock_mainnet_backed_up_";
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes session cache

export interface StoredWalletRecord {
  userId: string;
  publicKey: string;
  encryptedSecret: string; // Base64 AES-256-GCM ciphertext
  iv: string;              // Base64 12-byte random IV
  salt: string;            // Base64 16-byte random cryptographic salt
  createdAt: number;
}

// Memory-only session cache (never written to disk or storage)
interface MemorySession {
  userId: string;
  keypair: Keypair;
  expiresAt: number;
}

let activeSession: MemorySession | null = null;

/**
 * Opens or initializes the client-side IndexedDB store
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from the user's PIN and a per-wallet 16-byte random salt.
 * Uses standard Web Crypto PBKDF2 with 100,000 iterations of SHA-256.
 */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pinMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(pin.trim()),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    pinMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts the secret key using Web Crypto AES-GCM with a fresh 12-byte random IV and the PIN-derived key
 */
async function encryptWithPin(
  plainSecretBase64: string,
  pin: string,
  salt: Uint8Array
): Promise<{ encryptedSecret: string; iv: string }> {
  const key = await deriveKeyFromPin(pin, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12-byte standard NIST GCM IV
  const encoded = new TextEncoder().encode(plainSecretBase64);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoded
  );

  return {
    encryptedSecret: Buffer.from(cipherBuffer).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

/**
 * Decrypts the secret key using Web Crypto AES-GCM with the PIN-derived key
 */
async function decryptWithPin(
  encryptedBase64: string,
  ivBase64: string,
  saltBase64: string,
  pin: string
): Promise<string> {
  const salt = new Uint8Array(Buffer.from(saltBase64, "base64"));
  const iv = new Uint8Array(Buffer.from(ivBase64, "base64"));
  const cipherBuffer = new Uint8Array(Buffer.from(encryptedBase64, "base64"));

  const key = await deriveKeyFromPin(pin, salt);

  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    cipherBuffer as unknown as BufferSource
  );

  return new TextDecoder().decode(plainBuffer);
}

/**
 * Checks if a user already has an encrypted wallet record in IndexedDB
 */
export async function isClientWalletInitialized(userId: string): Promise<boolean> {
  const normalizedId = userId.trim().toLowerCase();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(normalizedId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Creates a brand-new random Keypair client-side in the browser.
 * Encrypted using the user-provided Spending PIN + a fresh 16-byte random salt.
 * Stored in IndexedDB.
 */
export async function createClientMainnetWallet(
  userId: string,
  pin: string
): Promise<{ keypair: Keypair; publicKey: string }> {
  if (!pin || pin.length < 4) {
    throw new Error("A PIN or passphrase of at least 4 characters is required");
  }

  const normalizedId = userId.trim().toLowerCase();
  const db = await openDB();

  // 1. Generate fresh random Keypair client-side
  const freshKeypair = Keypair.generate();
  const secretKeyBase64 = Buffer.from(freshKeypair.secretKey).toString("base64");

  // 2. Generate unique 16-byte cryptographic random salt per wallet record
  const salt = window.crypto.getRandomValues(new Uint8Array(16));

  // 3. Encrypt secret key with PBKDF2(PIN, salt)
  const { encryptedSecret, iv } = await encryptWithPin(secretKeyBase64, pin, salt);

  const record: StoredWalletRecord = {
    userId: normalizedId,
    publicKey: freshKeypair.publicKey.toBase58(),
    encryptedSecret,
    iv,
    salt: Buffer.from(salt).toString("base64"),
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);

    tx.oncomplete = () => {
      // Cache in volatile memory for 15-minute active session
      activeSession = {
        userId: normalizedId,
        keypair: freshKeypair,
        expiresAt: Date.now() + SESSION_TIMEOUT_MS,
      };
      resolve({ keypair: freshKeypair, publicKey: freshKeypair.publicKey.toBase58() });
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Unlocks an existing wallet from IndexedDB using the user's Spending PIN.
 * Verifies PIN by attempting AES-GCM decryption; if incorrect, Web Crypto throws OperationError.
 */
export async function unlockClientMainnetWallet(
  userId: string,
  pin: string
): Promise<Keypair> {
  const normalizedId = userId.trim().toLowerCase();
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(normalizedId);

    req.onsuccess = async () => {
      const record: StoredWalletRecord | undefined = req.result;
      if (!record) {
        return reject(new Error("No wallet record found for this account."));
      }

      try {
        const secretKeyBase64 = await decryptWithPin(
          record.encryptedSecret,
          record.iv,
          record.salt,
          pin
        );
        const secretKey = Buffer.from(secretKeyBase64, "base64");
        const keypair = Keypair.fromSecretKey(secretKey);

        // Cache in volatile memory for 15 minutes
        activeSession = {
          userId: normalizedId,
          keypair,
          expiresAt: Date.now() + SESSION_TIMEOUT_MS,
        };

        resolve(keypair);
      } catch (err: any) {
        reject(new Error("Incorrect Security PIN. Please try again."));
      }
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves the active unlocked keypair from volatile memory if within 15-min timeout
 */
export function getUnlockedClientSession(userId: string): Keypair | null {
  if (!activeSession) return null;
  if (activeSession.userId !== userId.trim().toLowerCase()) return null;
  if (Date.now() > activeSession.expiresAt) {
    activeSession = null; // Session expired
    return null;
  }
  // Slide session expiration window on active use
  activeSession.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  return activeSession.keypair;
}

/**
 * Explicitly locks the session and clears private keys from volatile memory
 */
export function lockClientSession(): void {
  activeSession = null;
}

/**
 * Checks if the user has confirmed backing up their Mainnet private key
 */
export function hasBackedUpClientWallet(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`${STORAGE_BACKUP_PREFIX}${userId}`) === "true";
}

export function setBackedUpClientWallet(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_BACKUP_PREFIX}${userId}`, "true");
}
