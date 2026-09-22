"use client";

import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { MAINNET_USDC_MINT, TokenizedStock } from "./stocks";
import { saveTradeTransaction, TradeTransaction } from "./trade-store";
import { getSolanaConnection, getSolBalance } from "./solana";

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapResult {
  success: boolean;
  signature?: string;
  shares?: number;
  usdAmount?: number;
  explorerUrl?: string;
  error?: string;
}

const JUPITER_API_BASE = "https://api.jup.ag/swap/v1";

/**
 * Parses raw Solana RPC simulation error logs into human-friendly explanations
 */
export function parseSolanaSimulationError(
  error: any,
  isSell: boolean = false,
  ticker?: string
): string {
  const msg = error?.message || "";
  const logs = Array.isArray(error?.logs) ? error.logs.join(" ") : "";
  const combined = (msg + " " + logs).toLowerCase();

  if (
    combined.includes("insufficient lamports") ||
    combined.includes("insufficient funds for fee") ||
    combined.includes("insufficient funds for rent") ||
    (combined.includes("0x1") && combined.includes("system"))
  ) {
    return "Insufficient SOL balance for Solana transaction fees (~0.003 SOL needed). Please add a small amount of SOL.";
  }

  if (
    combined.includes("custom: 0x1") ||
    combined.includes("custom program error: 0x1") ||
    combined.includes("insufficient funds")
  ) {
    return isSell
      ? `Insufficient ${ticker || "stock"} token balance for this sell order.`
      : "Insufficient USDC token balance for this trade. Please add USDC to your wallet.";
  }

  if (
    combined.includes("slippage") ||
    combined.includes("0x1771") ||
    combined.includes("6001") ||
    combined.includes("slippagetoleranceexceeded")
  ) {
    return "Price moved beyond slippage tolerance (0.5%). Please try again.";
  }

  if (
    combined.includes("blockhash not found") ||
    combined.includes("blockhash expired")
  ) {
    return "Transaction timed out on Solana network. Please try again.";
  }

  if (
    combined.includes("attempt to debit an account but found no record of a prior credit") ||
    combined.includes("account not found")
  ) {
    return isSell
      ? `No ${ticker || "stock"} token account found in wallet.`
      : "Your wallet has not been funded with USDC or SOL on Solana Mainnet yet. Please deposit funds.";
  }

  return msg || "Swap transaction failed on Solana Mainnet.";
}

/**
 * Fetches a market swap quote from Jupiter API
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50
): Promise<JupiterQuoteResponse> {
  const url = `${JUPITER_API_BASE}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`;
  
  const res = await fetch(url, {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Jupiter quote failed (${res.statusText})`);
  }

  return await res.json();
}

/**
 * Requests the serialized swap transaction from Jupiter API
 */
export async function getJupiterSwapTransaction(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string
): Promise<{ swapTransaction: string; lastValidBlockHeight: number }> {
  const res = await fetch(`${JUPITER_API_BASE}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Jupiter swap preparation failed (${res.statusText})`);
  }

  return await res.json();
}

/**
 * Executes a real Mainnet swap using an in-browser client Keypair (Self-Custodial Google Login).
 * The server NEVER touches the private key — signing occurs completely client-side in browser memory!
 */
export async function executeMainnetClientKeypairSwap(
  clientKeypair: Keypair,
  connection: Connection,
  stock: TokenizedStock,
  usdAmount: number
): Promise<JupiterSwapResult> {
  const mainnetConn = getSolanaConnection("mainnet");

  try {
    // 0. Pre-flight SOL balance check on Mainnet
    const solBal = await getSolBalance(mainnetConn, clientKeypair.publicKey);
    if (solBal < 0.001) {
      return {
        success: false,
        error: `Insufficient SOL for network fees and token account rent (${solBal.toFixed(4)} SOL available). Your wallet needs at least ~0.003 SOL (~$0.40) to execute swaps on Solana Mainnet.`,
      };
    }

    const inputAmountLamports = Math.round(usdAmount * 1_000_000); // 6 decimals for USDC

    // 1. Fetch live quote from Jupiter
    const quote = await getJupiterQuote(
      MAINNET_USDC_MINT,
      stock.mintAddress,
      inputAmountLamports,
      50 // 0.5% slippage
    );

    if (!quote || !quote.outAmount) {
      return {
        success: false,
        error: `No route or liquidity available on Raydium/Jupiter for ${stock.ticker}`,
      };
    }

    const calculatedShares = Number(BigInt(quote.outAmount)) / Math.pow(10, stock.decimals);

    // 2. Request swap transaction from Jupiter
    const { swapTransaction } = await getJupiterSwapTransaction(
      quote,
      clientKeypair.publicKey.toBase58()
    );

    // 3. Deserialize versioned transaction
    const swapTxBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTxBuffer);

    // 4. SIGN COMPLETELY IN-BROWSER with the browser-held Keypair
    transaction.sign([clientKeypair]);

    // 5. Broadcast directly to Solana Mainnet-Beta
    const rawTransaction = transaction.serialize();
    const signature = await mainnetConn.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // 6. Confirm on Mainnet
    const latestBlockHash = await mainnetConn.getLatestBlockhash("confirmed");
    await mainnetConn.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      },
      "confirmed"
    );

    // 7. Store transaction in isolated mainnet trade store
    const txRecord: TradeTransaction = {
      id: `mainnet_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "BUY",
      usdAmount,
      shares: calculatedShares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: signature,
      isSimulated: false,
    };
    saveTradeTransaction(txRecord, "mainnet");

    return {
      success: true,
      signature,
      shares: calculatedShares,
      usdAmount,
      explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    };
  } catch (error: any) {
    console.error("Mainnet In-Browser Jupiter Swap error:", error);
    const friendlyError = parseSolanaSimulationError(error, false, stock.ticker);
    return {
      success: false,
      error: friendlyError,
    };
  }
}

/**
 * Executes a real Mainnet swap via Jupiter for connected external wallets (Phantom/Solflare).
 */
export async function executeMainnetJupiterSwap(
  wallet: {
    publicKey: PublicKey;
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
    sendTransaction: (tx: VersionedTransaction, connection: Connection) => Promise<string>;
  },
  connection: Connection,
  stock: TokenizedStock,
  usdAmount: number
): Promise<JupiterSwapResult> {
  const mainnetConn = getSolanaConnection("mainnet");

  try {
    // 0. Pre-flight SOL balance check on Mainnet
    const solBal = await getSolBalance(mainnetConn, wallet.publicKey);
    if (solBal < 0.001) {
      return {
        success: false,
        error: `Insufficient SOL for network fees and token account rent (${solBal.toFixed(4)} SOL available). Your wallet needs at least ~0.003 SOL (~$0.40) to execute swaps on Solana Mainnet.`,
      };
    }

    const inputAmountLamports = Math.round(usdAmount * 1_000_000); // 6 decimals for USDC

    const quote = await getJupiterQuote(
      MAINNET_USDC_MINT,
      stock.mintAddress,
      inputAmountLamports,
      50
    );

    if (!quote || !quote.outAmount) {
      return {
        success: false,
        error: `No route or liquidity available on Raydium/Jupiter for ${stock.ticker}`,
      };
    }

    const calculatedShares = Number(BigInt(quote.outAmount)) / Math.pow(10, stock.decimals);

    const { swapTransaction } = await getJupiterSwapTransaction(
      quote,
      wallet.publicKey.toBase58()
    );

    const swapTxBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTxBuffer);

    const signature = await wallet.sendTransaction(transaction, mainnetConn);

    const latestBlockHash = await mainnetConn.getLatestBlockhash("confirmed");
    await mainnetConn.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      },
      "confirmed"
    );

    const txRecord: TradeTransaction = {
      id: `mainnet_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "BUY",
      usdAmount,
      shares: calculatedShares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: signature,
      isSimulated: false,
    };
    saveTradeTransaction(txRecord, "mainnet");

    return {
      success: true,
      signature,
      shares: calculatedShares,
      usdAmount,
      explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    };
  } catch (error: any) {
    console.error("Mainnet Jupiter Swap error:", error);
    const friendlyError = parseSolanaSimulationError(error, false, stock.ticker);
    return {
      success: false,
      error: friendlyError,
    };
  }
}

/**
 * Executes a real Mainnet SELL swap using client keypair (xStock -> USDC).
 */
export async function executeMainnetClientKeypairSell(
  clientKeypair: Keypair,
  connection: Connection,
  stock: TokenizedStock,
  shares: number
): Promise<JupiterSwapResult> {
  const mainnetConn = getSolanaConnection("mainnet");

  try {
    // 0. Query on-chain token balance to clamp lamports precisely
    const programId = stock.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = await getAssociatedTokenAddress(
      new PublicKey(stock.mintAddress),
      clientKeypair.publicKey,
      false,
      programId
    );

    let maxAvailableLamports = 0;
    try {
      const tokenAcc = await getAccount(mainnetConn, ata, "confirmed", programId);
      maxAvailableLamports = Number(tokenAcc.amount);
    } catch {}

    let inputAmountLamports = Math.round(shares * Math.pow(10, stock.decimals));
    if (maxAvailableLamports > 0 && inputAmountLamports > maxAvailableLamports) {
      inputAmountLamports = maxAvailableLamports;
    }

    if (inputAmountLamports <= 0) {
      return {
        success: false,
        error: `No on-chain balance found in your wallet for ${stock.ticker}.`,
      };
    }

    const quote = await getJupiterQuote(
      stock.mintAddress,
      MAINNET_USDC_MINT,
      inputAmountLamports,
      50
    );

    if (!quote || !quote.outAmount) {
      return {
        success: false,
        error: `No route or liquidity available on Jupiter to sell ${stock.ticker}`,
      };
    }

    const returnedUsdc = Number(BigInt(quote.outAmount)) / 1_000_000;

    const { swapTransaction } = await getJupiterSwapTransaction(
      quote,
      clientKeypair.publicKey.toBase58()
    );

    const swapTxBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTxBuffer);

    transaction.sign([clientKeypair]);

    const rawTransaction = transaction.serialize();
    const signature = await mainnetConn.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    const latestBlockHash = await mainnetConn.getLatestBlockhash("confirmed");
    await mainnetConn.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      },
      "confirmed"
    );

    const txRecord: TradeTransaction = {
      id: `mainnet_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "SELL",
      usdAmount: returnedUsdc,
      shares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: signature,
      isSimulated: false,
    };
    saveTradeTransaction(txRecord, "mainnet");

    return {
      success: true,
      signature,
      shares,
      usdAmount: returnedUsdc,
      explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    };
  } catch (error: any) {
    console.error("Mainnet In-Browser Jupiter Sell error:", error);
    const friendlyError = parseSolanaSimulationError(error, true, stock.ticker);
    return {
      success: false,
      error: friendlyError,
    };
  }
}

/**
 * Executes a real Mainnet SELL swap for connected external wallet (xStock -> USDC).
 */
export async function executeMainnetJupiterSell(
  wallet: {
    publicKey: PublicKey;
    signTransaction?: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
    sendTransaction: (tx: VersionedTransaction, connection: Connection) => Promise<string>;
  },
  connection: Connection,
  stock: TokenizedStock,
  shares: number
): Promise<JupiterSwapResult> {
  const mainnetConn = getSolanaConnection("mainnet");

  try {
    const programId = stock.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = await getAssociatedTokenAddress(
      new PublicKey(stock.mintAddress),
      wallet.publicKey,
      false,
      programId
    );

    let maxAvailableLamports = 0;
    try {
      const tokenAcc = await getAccount(mainnetConn, ata, "confirmed", programId);
      maxAvailableLamports = Number(tokenAcc.amount);
    } catch {}

    let inputAmountLamports = Math.round(shares * Math.pow(10, stock.decimals));
    if (maxAvailableLamports > 0 && inputAmountLamports > maxAvailableLamports) {
      inputAmountLamports = maxAvailableLamports;
    }

    if (inputAmountLamports <= 0) {
      return {
        success: false,
        error: `No on-chain balance found in your wallet for ${stock.ticker}.`,
      };
    }

    const quote = await getJupiterQuote(
      stock.mintAddress,
      MAINNET_USDC_MINT,
      inputAmountLamports,
      50
    );

    if (!quote || !quote.outAmount) {
      return {
        success: false,
        error: `No route or liquidity available on Jupiter to sell ${stock.ticker}`,
      };
    }

    const returnedUsdc = Number(BigInt(quote.outAmount)) / 1_000_000;

    const { swapTransaction } = await getJupiterSwapTransaction(
      quote,
      wallet.publicKey.toBase58()
    );

    const swapTxBuffer = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTxBuffer);

    const signature = await wallet.sendTransaction(transaction, mainnetConn);

    const latestBlockHash = await mainnetConn.getLatestBlockhash("confirmed");
    await mainnetConn.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature,
      },
      "confirmed"
    );

    const txRecord: TradeTransaction = {
      id: `mainnet_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      stockId: stock.id,
      ticker: stock.ticker,
      type: "SELL",
      usdAmount: returnedUsdc,
      shares,
      price: stock.basePrice,
      timestamp: Date.now(),
      txHash: signature,
      isSimulated: false,
    };
    saveTradeTransaction(txRecord, "mainnet");

    return {
      success: true,
      signature,
      shares,
      usdAmount: returnedUsdc,
      explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    };
  } catch (error: any) {
    console.error("Mainnet Jupiter Sell error:", error);
    const friendlyError = parseSolanaSimulationError(error, true, stock.ticker);
    return {
      success: false,
      error: friendlyError,
    };
  }
}
