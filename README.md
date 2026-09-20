# TickStock — Stock Discovery & Micro-Trading Feed on Solana

TickStock reimagines financial asset discovery for digital-native investors by combining intuitive swipe-based discovery with **sub-second, atomic on-chain micro-swaps on Solana**.

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
  - **Zero Auto-Funding**: Starts at $0 USDC / 0 SOL. Users deposit their own assets directly.
  - **Client-Side Jupiter Routing**: Micro-swaps are routed directly against live Raydium/Orca liquidity pools through Jupiter Swap API, signed locally in browser memory.
  - **Mandatory Backup Flow**: Users are prompted with a dedicated private key backup modal with a security acknowledgment checklist.

---

### 5. 🚀 Meteora Dynamic Bonding Curve (DBC) Fair Launch & Unique Listing Rules
TickStock features a decentralized equity fair-launch platform powered by **Meteora Dynamic Bonding Curves (`@meteora-ag/dynamic-bonding-curve-sdk`)**:

- **Swipeable Discover Feed**: Browse fair-launch assets with intuitive swipe gestures (swipe right to buy directly against the bonding curve, swipe left to skip).
- **Curated Curve Presets**:
  - *Steady Discovery*: Linear institutional-grade curve with deep depth and minimal slippage.
  - *Growth Trajectory*: Balanced parabolic discovery curve.
  - *Momentum Curve*: High-velocity exponential curve for rapid price discovery.
- **Automated DAMM v2 Migration**: When a pool reaches its funding threshold and conviction distribution criteria, liquidity is permanently migrated into a Meteora DAMM v2 decentralized liquidity pool.
- **Unique Ticker Listing Standard (Product Design)**:
  - Modeled intentionally after institutional stock exchange listing standards (e.g. NYSE/NASDAQ symbol uniqueness and conflict prevention).
  - Enforces two distinct validation checks on all deployments:
    1. **Duplicate Prevention**: Rejects any ticker already registered by a prior launch on TickStock (*"This ticker is already in use"*).
    2. **Public Equity Collision Protection**: Rejects tickers that match existing public corporations or major equities (*"This ticker matches an existing public company"*).

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

---

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Gestures & UI**: Framer Motion (physics-based drag gestures) + Recharts (dynamic area sparklines)
- **Solana Web3**: `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `bs58`
- **Fair Launch**: `@meteora-ag/dynamic-bonding-curve-sdk` (Meteora DBC)
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
   - Switch to **Fair Launch** tab to swipe on newly launched bonding curve assets.

3. **Deploy a New Asset**:
   - Navigate to **Fair Launch -> Deploy Listing**.
   - Input your unique ticker (e.g. `$ORBIT`) and project thesis.
   - Deploy your bonding curve to Solana Devnet or Mainnet.

4. **Real Trading Mode (Mainnet)**:
   - Toggle to **Mainnet (Real Trading)**.
   - Sign in with Google / PIN to generate your self-custodial browser wallet.
   - Back up your private key securely.
   - Deposit USDC / SOL to your deposit address.
   - Swipe right to execute live fractional xStock swaps on Solana Mainnet via Jupiter!

---

## License
MIT
