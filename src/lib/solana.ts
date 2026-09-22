import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";

export type SolanaCluster = "devnet" | "mainnet-beta";

export const DEVNET_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const MAINNET_RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL || "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

export const MAINNET_RPC_ENDPOINT = MAINNET_RPC_ENDPOINTS[0];

export function getSolanaConnection(network: "devnet" | "mainnet" = "devnet"): Connection {
  const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
  return new Connection(endpoint, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 35000,
  });
}

/**
 * Fetch native SOL balance with multi-RPC fallback
 */
export async function getSolBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  // Try provided connection first
  try {
    const lamports = await connection.getBalance(publicKey, "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    // Fallback attempt for Mainnet across all available endpoints
    for (const endpoint of MAINNET_RPC_ENDPOINTS) {
      try {
        const fallbackConn = new Connection(endpoint, "confirmed");
        const lamports = await fallbackConn.getBalance(publicKey, "confirmed");
        return lamports / LAMPORTS_PER_SOL;
      } catch {}
    }
    console.warn("Could not fetch SOL balance for", publicKey.toBase58(), error);
    return 0;
  }
}

/**
 * Fetch SPL token balance (supports both SPL Legacy and Token-2022) with fallback
 */
export async function getSplTokenBalance(
  connection: Connection,
  ownerPublicKey: PublicKey,
  mintPublicKey: PublicKey,
  decimals: number = 6,
  isToken2022: boolean = false
): Promise<number> {
  const tryFetch = async (conn: Connection) => {
    const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = await getAssociatedTokenAddress(
      mintPublicKey,
      ownerPublicKey,
      false,
      programId
    );

    const tokenAccount = await getAccount(conn, ata, "confirmed", programId);
    return Number(tokenAccount.amount) / Math.pow(10, decimals);
  };

  try {
    return await tryFetch(connection);
  } catch (error) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      return 0;
    }

    // Try fallback endpoints for Mainnet
    for (const endpoint of MAINNET_RPC_ENDPOINTS) {
      try {
        const fallbackConn = new Connection(endpoint, "confirmed");
        return await tryFetch(fallbackConn);
      } catch (err) {
        if (
          err instanceof TokenAccountNotFoundError ||
          err instanceof TokenInvalidAccountOwnerError
        ) {
          return 0;
        }
      }
    }
    return 0;
  }
}

/**
 * Returns Solana Explorer URL for transactions, tokens, or accounts
 */
export function getExplorerUrl(
  identifier: string,
  type: "tx" | "token" | "address" | "devnet" | "mainnet" = "tx",
  network: "devnet" | "mainnet" = "devnet"
): string {
  let targetNetwork = network;
  let targetType: "tx" | "token" | "address" = "tx";

  if (type === "devnet" || type === "mainnet") {
    targetNetwork = type;
    targetType = "tx";
  } else {
    targetType = type;
  }

  const base = `https://explorer.solana.com/${targetType === "tx" ? "tx" : "address"}/${identifier}`;
  return targetNetwork === "mainnet" ? base : `${base}?cluster=devnet`;
}
