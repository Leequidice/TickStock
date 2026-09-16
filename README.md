# TickStock — Stock Discovery & Micro-Trading Feed on Solana

> **Stocklana Hackathon Project** (Solana • Tokenized Stocks Theme)

TickStock reimagines financial asset discovery for digital-native investors by combining intuitive swipe-based discovery with **sub-second, atomic on-chain micro-swaps on Solana Devnet**.

---

## Key Web3 Innovations

### 1. ⚡ Sign-Once Session Trading (SPL Token Delegation)
- Standard Web3 apps disrupt users with a wallet popup for every single action.
- TickStock solves this using standard **SPL Token Delegation (`createApproveInstruction`)**:
  - When an external wallet connects, the user approves a capped `$500 dUSD` spending allowance to our session keypair once.
  - Every subsequent swipe-to-buy executes seamlessly on-chain **with zero popups**.
  - The allowance is capped, transparently displayed in the UI, and revocable at any time.

### 2. 🔒 Atomic dUSD Swaps with Sponsored Gas
- Every trade is a genuine on-chain atomic transaction on Solana Devnet:
  1. Debits/burns `usdAmount` of `dUSD` from the user's token account.
  2. Creates the user's stock token ATA (idempotent) and mints fractional shares in the **exact same transaction**.
  3. Our server keypair acts as the **fee payer**, meaning the user never needs Devnet SOL — only their dUSD spending authorization is required.
  4. Both debit and credit execute atomically: if either fails, the transaction reverts completely.

### 3. 💼 In-App Demo Wallet + Self-Custody Upgrade Path
- **Zero-Friction Demo**: First-time visitors without a browser extension get an instant in-app session wallet automatically credited with `$1,000 dUSD` starting cash.
- **Migration Path**: Users can connect a Phantom or Solflare wallet anytime and click **"Migrate to Phantom"** to batch-transfer their tokenized stock positions and remaining dUSD to their self-custodial wallet with 1 click.

---

### 4. 🌐 Dual-Network Architecture (Devnet Demo vs. Mainnet Real Trading)
- **Devnet Mode (Demo / Testing)**:
  - Instant onboarding with `$1,000 dUSD` starting balance and sponsored gas.
  - Session wallet delegation for 0-popup swipe micro-trading.
- **Mainnet Mode (Real Trading via Jupiter & Token-2022 xStocks)**:
  - **100% Client-Side Self-Custodial**: Wallet keypairs are generated in-browser via Web Crypto and stored strictly in IndexedDB. Plaintext private keys are never transmitted to or accessible by any server.
  - **Zero Auto-Funding**: Starts at \$0 USDC / 0 SOL. Users deposit their own assets directly.
  - **Client-Side Jupiter Routing**: Micro-swaps are routed directly against live Raydium/Orca liquidity pools through Jupiter Swap API, signed locally in browser memory.
  - **Mandatory Backup Flow**: Users are prompted with a dedicated private key backup modal with a security acknowledgment checklist.

---

## 🔐 Mainnet Security & Key Derivation Architecture

### PIN & Cryptographic Vault Design
1. **PBKDF2 Key Derivation**:
   - The encryption key is derived dynamically using Web Crypto `PBKDF2` with **100,000 iterations** of `SHA-256`.
   - Each wallet record generates a unique **16-byte cryptographically secure random salt** (`window.crypto.getRandomValues`) stored alongside the ciphertext.
2. **AES-256-GCM Encryption**:
   - The private key is encrypted with standard `AES-256-GCM` using a fresh **12-byte random IV** per encryption.
   - Stored in browser `IndexedDB` (`TickStockClientVault_v2`).
3. **Volatile Memory Session Caching**:
   - To avoid entering a PIN on every swipe, unlocked keypairs reside in memory for a sliding **15-minute inactivity window** (`SESSION_TIMEOUT_MS = 15 * 60 * 1000`) and are wiped on logout, window close, or timeout.

### ⚠️ Security Considerations & Production Hardening
> **Hackathon Scope vs. Production Hardening**:
> - **6-Digit PIN Search Space**: A 6-digit PIN has $10^6$ combinations. Combined with 100,000 PBKDF2-SHA256 iterations, offline brute-forcing is slow but theoretically feasible for a dedicated attacker with direct filesystem/IndexedDB access.
> - **Lost PIN = Lost Funds**: Because the server has zero knowledge of the PIN or private key, lost PINs cannot be recovered through customer support. The exportable Base58 private key backup is the only fallback.
> - **Production Hardening Recommendations**:
>   1. **Passphrase Option**: Support alphanumeric passphrases (>12 characters) for increased entropy.
>   2. **Argon2id Memory-Hard KDF**: Upgrade from PBKDF2 to Argon2id via WebAssembly to resist GPU-accelerated brute-forcing.
>   3. **WebAuthn PRF / Passkeys**: Integrate WebAuthn PRF (Pseudo-Random Function) extension to bind key derivation to device biometric hardware (Touch ID, Face ID, YubiKey).

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Gestures & UI**: Framer Motion (physics-based drag gestures) + Recharts (dynamic area sparklines)
- **Solana Web3**: `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `bs58`
- **DEX & Swaps**: Jupiter v6 Swap API (`quote` + `swap`) for real Mainnet settlement.
- **Client Security**: Web Crypto API (`PBKDF2`, `AES-GCM`, `SHA-256`), IndexedDB.

---

## How to Demo

1. **Start the server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

2. **In-App Demo Mode (Devnet)**:
   - Toggle to **Devnet (Demo)**.
   - Start swiping right on stock cards immediately with pre-funded `$1,000 dUSD`.
   - Watch dUSD cash balance decrease and tokenized stock holdings increase atomically with sponsored gas.

3. **Real Trading Mode (Mainnet)**:
   - Toggle to **Mainnet (Real Trading)**.
   - Sign in with Google: Set a 6-digit Spending PIN to generate your self-custodial browser wallet.
   - Back up your private key securely.
   - Deposit USDC / SOL to your deposit address.
   - Swipe right to execute live fractional xStock swaps on Solana Mainnet via Jupiter!

---

## License
MIT
