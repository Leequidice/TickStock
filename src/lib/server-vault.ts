import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Keypair } from "@solana/web3.js";

export interface EncryptedWalletRecord {
  userId: string;
  publicKey: string;
  encryptedSecret: string; // Hex ciphertext
  iv: string;              // Hex 12-byte unique IV per record (AES-GCM standard)
  authTag: string;         // Hex 16-byte GCM authentication tag
  provider?: string;
  email?: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
}

interface VaultData {
  version: number;
  records: Record<string, EncryptedWalletRecord>;
}

let inMemoryVault: VaultData | null = null;

function getVaultFilePath(): string {
  const localDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, ".writable_check");
    fs.writeFileSync(testFile, "ok", "utf8");
    fs.unlinkSync(testFile);
    return path.join(localDir, "custodial_vault.json");
  } catch {
    const tmpDir = process.env.TMPDIR || os.tmpdir() || "/tmp";
    return path.join(tmpDir, "tickstock_custodial_vault.json");
  }
}

/**
 * Retrieves the 32-byte AES-256 encryption key from environment with safe fallback
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.CUSTODIAL_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    "tickstock_custodial_vault_encryption_key_2026_solana";

  // Key can be 64-char hex string (32 bytes) or raw string
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  
  // Use standard SHA-256 from Node crypto to normalize to 32 bytes
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a secret key using standard AES-256-GCM with a fresh 12-byte random IV
 */
export function encryptSecret(plainSecretBase64: string): {
  encryptedSecret: string;
  iv: string;
  authTag: string;
} {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(plainSecretBase64, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedSecret: encryptedBuffer.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypts a secret key using standard AES-256-GCM and verifies the auth tag
 */
export function decryptSecret(
  encryptedSecret: string,
  ivHex: string,
  authTagHex: string
): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedBuffer = Buffer.from(encryptedSecret, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Loads the persisted vault from disk or in-memory fallback
 */
function loadVault(): VaultData {
  if (inMemoryVault) return inMemoryVault;
  try {
    const filePath = getVaultFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      inMemoryVault = JSON.parse(raw);
      return inMemoryVault!;
    }
  } catch (err) {
    console.error("Error loading custodial vault:", err);
  }
  inMemoryVault = { version: 1, records: {} };
  return inMemoryVault;
}

/**
 * Persists the vault data to disk and in-memory cache
 */
function saveVault(data: VaultData): void {
  inMemoryVault = data;
  try {
    const filePath = getVaultFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("Notice: Persisted custodial vault to memory cache:", err);
  }
}

/**
 * Looks up and decrypts an existing user wallet, or generates a new random Keypair,
 * encrypts it at rest, and saves it to the persistent vault.
 */
export function getOrCreateVaultWallet(
  userId: string,
  metadata?: { provider?: string; email?: string; name?: string }
): { publicKey: string; secretKeyBase64: string; isNew: boolean } {
  const normalizedId = userId.trim().toLowerCase();
  const vault = loadVault();

  const existing = vault.records[normalizedId];
  if (existing) {
    try {
      const decryptedSecret = decryptSecret(
        existing.encryptedSecret,
        existing.iv,
        existing.authTag
      );
      return {
        publicKey: existing.publicKey,
        secretKeyBase64: decryptedSecret,
        isNew: false,
      };
    } catch (e) {
      console.warn("Could not decrypt existing wallet, generating fresh record:", e);
    }
  }

  // Generate a true random Keypair
  const keypair = Keypair.generate();
  const secretKeyBase64 = Buffer.from(keypair.secretKey).toString("base64");
  const publicKey = keypair.publicKey.toBase58();

  // Encrypt with fresh random 12-byte IV
  const { encryptedSecret, iv, authTag } = encryptSecret(secretKeyBase64);

  const newRecord: EncryptedWalletRecord = {
    userId: normalizedId,
    publicKey,
    encryptedSecret,
    iv,
    authTag,
    provider: metadata?.provider,
    email: metadata?.email,
    name: metadata?.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  vault.records[normalizedId] = newRecord;
  saveVault(vault);

  return {
    publicKey,
    secretKeyBase64,
    isNew: true,
  };
}

/**
 * Retrieves a user's wallet if it exists
 */
export function getExistingVaultWallet(
  userId: string
): { publicKey: string; secretKeyBase64: string } | null {
  const normalizedId = userId.trim().toLowerCase();
  const vault = loadVault();
  const existing = vault.records[normalizedId];
  if (!existing) return null;

  try {
    const decryptedSecret = decryptSecret(
      existing.encryptedSecret,
      existing.iv,
      existing.authTag
    );

    return {
      publicKey: existing.publicKey,
      secretKeyBase64: decryptedSecret,
    };
  } catch (err) {
    console.error("Error retrieving existing vault wallet:", err);
    return null;
  }
}
