"use client";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export const DB_NAME = "TickStockClientVault_v2";
export const STORE_NAME = "wallets";
export const DB_VERSION = 1;
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
export function openDB(): Promise<IDBDatabase> {
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
export async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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
export async function encryptWithPin(
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
export async function decryptWithPin(
  encryptedBase64: string,
  ivBase64: string,
  saltBase64: string,
  pin: string
): Promise<string> {
  if (!encryptedBase64 || !ivBase64 || !saltBase64) {
    throw new Error("Missing cryptographic material in stored wallet record (encryptedSecret/iv/salt).");
  }

  const salt = new Uint8Array(Buffer.from(saltBase64, "base64"));
  const iv = new Uint8Array(Buffer.from(ivBase64, "base64"));
  const cipherBuffer = new Uint8Array(Buffer.from(encryptedBase64, "base64"));

  const key = await deriveKeyFromPin(pin, salt);

  try {
    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      key,
      cipherBuffer as unknown as BufferSource
    );
    return new TextDecoder().decode(plainBuffer);
  } catch (err: any) {
    throw new Error("Incorrect Security PIN. AES-GCM authentication tag mismatch.");
  }
}

/**
 * Directly fetches the raw StoredWalletRecord from IndexedDB by userId
 */
export async function getClientWalletRecord(userId: string): Promise<StoredWalletRecord | null> {
  const normalizedId = userId.trim().toLowerCase();
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(normalizedId);
      req.onsuccess = () => {
        const record = req.result as StoredWalletRecord | undefined;
        if (record) {
          console.log("[TickStock Vault] Raw IndexedDB Record Loaded:", {
            userId: record.userId,
            publicKey: record.publicKey,
            encryptedSecretLength: record.encryptedSecret?.length || 0,
            ivLength: record.iv?.length || 0,
            saltLength: record.salt?.length || 0,
            createdAt: new Date(record.createdAt).toISOString(),
          });
        }
        resolve(record || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("[TickStock Vault] Failed to read record from IndexedDB:", err);
    return null;
  }
}

/**
 * Fetches all StoredWalletRecords from IndexedDB
 */
export async function getAllClientWalletRecords(): Promise<StoredWalletRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as StoredWalletRecord[];
        console.log("[TickStock Vault] All Stored Wallet Records Count:", list.length);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[TickStock Vault] Failed to load all records:", err);
    return [];
  }
}

/**
 * Checks if a user already has an encrypted wallet record in IndexedDB
 */
export async function isClientWalletInitialized(userId: string): Promise<boolean> {
  const record = await getClientWalletRecord(userId);
  return !!record;
}

/**
 * Creates a brand-new random Keypair client-side in the browser.
 * Encrypted using the user-provided Spending PIN + a fresh 16-byte random salt.
 * Stored in IndexedDB.
 */
export async function createClientMainnetWallet(
  userId: string,
  pin: string
): Promise<{ keypair: Keypair; publicKey: string; record: StoredWalletRecord }> {
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
      console.log("[TickStock Vault] Created and Stored New Mainnet Wallet Record:", {
        userId: record.userId,
        publicKey: record.publicKey,
        encryptedSecretLength: record.encryptedSecret.length,
        iv: record.iv,
        salt: record.salt,
        createdAt: record.createdAt,
      });

      // Cache in volatile memory for 15-minute active session
      activeSession = {
        userId: normalizedId,
        keypair: freshKeypair,
        expiresAt: Date.now() + SESSION_TIMEOUT_MS,
      };
      resolve({ keypair: freshKeypair, publicKey: freshKeypair.publicKey.toBase58(), record });
    };

    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Decrypts a StoredWalletRecord with the given PIN, verifying derived public key matches record
 */
export async function decryptClientWalletRecord(
  record: StoredWalletRecord,
  pin: string
): Promise<{ keypair: Keypair; privateKeyBase58: string }> {
  if (!record) {
    throw new Error("Cannot decrypt: Wallet record is null or undefined.");
  }

  const secretKeyBase64 = await decryptWithPin(
    record.encryptedSecret,
    record.iv,
    record.salt,
    pin
  );

  const secretKey = Buffer.from(secretKeyBase64, "base64");
  const keypair = Keypair.fromSecretKey(secretKey);
  const derivedPub = keypair.publicKey.toBase58();

  if (derivedPub !== record.publicKey) {
    throw new Error(`Cryptographic integrity error: Derived public key (${derivedPub}) does not match stored address (${record.publicKey}).`);
  }

  const privateKeyBase58 = bs58.encode(keypair.secretKey);

  // Update session
  activeSession = {
    userId: record.userId,
    keypair,
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
  };

  return { keypair, privateKeyBase58 };
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
  const record = await getClientWalletRecord(normalizedId);
  if (!record) {
    throw new Error(`No wallet record found in IndexedDB for account '${userId}'.`);
  }

  const { keypair } = await decryptClientWalletRecord(record, pin);
  return keypair;
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
