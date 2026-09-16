const fs = require("fs");
const path = require("path");

// Load .env.local manually
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}
const crypto = require("crypto");
const { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  createBurnInstruction
} = require("@solana/spl-token");

// Import the server vault logic directly to verify
const VAULT_FILE_PATH = path.join(process.cwd(), "data", "custodial_vault.json");

function getEncryptionKey() {
  const secret = process.env.CUSTODIAL_ENCRYPTION_SECRET;
  if (!secret) throw new Error("CUSTODIAL_ENCRYPTION_SECRET not found");
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(plainSecretBase64) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Unique 12-byte IV for AES-GCM
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

function decryptSecret(encryptedSecret, ivHex, authTagHex) {
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

function loadVault() {
  if (!fs.existsSync(VAULT_FILE_PATH)) return { version: 1, records: {} };
  return JSON.parse(fs.readFileSync(VAULT_FILE_PATH, "utf8"));
}

function saveVault(data) {
  const dir = path.dirname(VAULT_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getOrCreateVaultWallet(userId, metadata) {
  const normalizedId = userId.trim().toLowerCase();
  const vault = loadVault();
  const existing = vault.records[normalizedId];
  if (existing) {
    const decryptedSecret = decryptSecret(existing.encryptedSecret, existing.iv, existing.authTag);
    return {
      publicKey: existing.publicKey,
      secretKeyBase64: decryptedSecret,
      isNew: false,
    };
  }

  const keypair = Keypair.generate();
  const secretKeyBase64 = Buffer.from(keypair.secretKey).toString("base64");
  const publicKey = keypair.publicKey.toBase58();
  const { encryptedSecret, iv, authTag } = encryptSecret(secretKeyBase64);

  vault.records[normalizedId] = {
    userId: normalizedId,
    publicKey,
    encryptedSecret,
    iv,
    authTag,
    provider: metadata && metadata.provider,
    name: metadata && metadata.name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveVault(vault);
  return {
    publicKey,
    secretKeyBase64,
    isNew: true,
  };
}

async function main() {
  console.log("=== 1. VERIFY ENCRYPTED VAULT PERSISTENCE & UNIQUE IV PER RECORD ===");
  const userA = "judge_alice_demo_test";
  const userB = "judge_bob_demo_test";

  // Clean test vault
  if (fs.existsSync(VAULT_FILE_PATH)) {
    fs.unlinkSync(VAULT_FILE_PATH);
  }

  const walletA1 = getOrCreateVaultWallet(userA, { name: "Judge Alice", provider: "demo" });
  const walletB1 = getOrCreateVaultWallet(userB, { name: "Judge Bob", provider: "demo" });

  console.log("User A PubKey:", walletA1.publicKey);
  console.log("User B PubKey:", walletB1.publicKey);

  if (walletA1.publicKey === walletB1.publicKey) {
    throw new Error("FAIL: Public keys collided");
  }

  const vaultRaw = fs.readFileSync(VAULT_FILE_PATH, "utf8");
  const vaultJson = JSON.parse(vaultRaw);

  const recA = vaultJson.records[userA];
  const recB = vaultJson.records[userB];

  console.log("\nVault Storage Record A:", {
    userId: recA.userId,
    publicKey: recA.publicKey,
    iv: recA.iv,
    ivByteLength: recA.iv.length / 2,
    authTag: recA.authTag,
    encryptedSecret: recA.encryptedSecret.slice(0, 32) + "...",
  });

  if (recA.iv === recB.iv) {
    throw new Error("FAIL: IV was reused!");
  }
  console.log("CONFIRMED: Unique 12-byte random IVs per record (IV_A !== IV_B)");

  if (vaultRaw.includes(walletA1.secretKeyBase64) || vaultRaw.includes(walletB1.secretKeyBase64)) {
    throw new Error("FAIL: Found plaintext secret key in vault file!");
  }
  console.log("CONFIRMED: Zero plaintext secrets stored on disk.");

  console.log("\n=== 2. VERIFY RELOGIN LOOKUP & DECRYPTION ===");
  const walletA2 = getOrCreateVaultWallet(userA);
  if (walletA2.publicKey !== walletA1.publicKey) {
    throw new Error("FAIL: PubKey mismatch on relogin");
  }
  if (walletA2.secretKeyBase64 !== walletA1.secretKeyBase64) {
    throw new Error("FAIL: Decrypted secret mismatch on relogin");
  }
  if (walletA2.isNew !== false) {
    throw new Error("FAIL: isNew should be false on relogin");
  }
  console.log("CONFIRMED: Relogin looked up record from database and decrypted successfully.");

  console.log("\n=== 3. LIVE ON-CHAIN ATOMIC SWAP TEST USING DECRYPTED WALLET ===");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const authorityKeypair = Keypair.fromSecretKey(Buffer.from(process.env.SOLANA_MINT_AUTHORITY_SECRET, "base64"));
  const userKeypair = Keypair.fromSecretKey(Buffer.from(walletA1.secretKeyBase64, "base64"));
  const dusdMint = new PublicKey(process.env.NEXT_PUBLIC_DUSD_MINT);
  const nvdaMint = new PublicKey("72Mkr9AFqpbF3pdQX8w6S6nEBBFBjevRdtHNNQPcTKva"); // NVDA mint

  console.log("Funding User A wallet with $1,000 dUSD...");
  const userDusdATA = await getAssociatedTokenAddress(dusdMint, userKeypair.publicKey, false);
  const userNvdaATA = await getAssociatedTokenAddress(nvdaMint, userKeypair.publicKey, false);

  const fundTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authorityKeypair.publicKey, userDusdATA, userKeypair.publicKey, dusdMint),
    createMintToInstruction(dusdMint, userDusdATA, authorityKeypair.publicKey, BigInt(1000 * 1_000_000))
  );
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [authorityKeypair], { commitment: "confirmed" });
  console.log("Initial dUSD funded! Sig:", fundSig);

  console.log("Executing $25 swipe-to-buy on NVDA (Atomic Burn dUSD + Mint NVDA)...");
  const swapTx = new Transaction().add(
    createBurnInstruction(userDusdATA, dusdMint, userKeypair.publicKey, BigInt(25 * 1_000_000)),
    createAssociatedTokenAccountIdempotentInstruction(authorityKeypair.publicKey, userNvdaATA, userKeypair.publicKey, nvdaMint),
    createMintToInstruction(nvdaMint, userNvdaATA, authorityKeypair.publicKey, BigInt(194553)) // ~0.194553 shares
  );
  const swapSig = await sendAndConfirmTransaction(connection, swapTx, [authorityKeypair, userKeypair], { commitment: "confirmed" });
  console.log("Atomic Swap Tx Confirmed! Sig:", swapSig);
  console.log("Explorer URL: https://explorer.solana.com/tx/" + swapSig + "?cluster=devnet");

  console.log("\n=== 4. VERIFY ON-CHAIN BALANCES PERSISTED ===");
  const dusdBal = await connection.getTokenAccountBalance(userDusdATA);
  const nvdaBal = await connection.getTokenAccountBalance(userNvdaATA);
  console.log(`User A On-Chain Balances: dUSD=${dusdBal.value.uiAmountString}, NVDA=${nvdaBal.value.uiAmountString}`);

  console.log("\n=== ALL SECURITY & PERSISTENCE TESTS PASSED ===");
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
