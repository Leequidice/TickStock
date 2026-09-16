import {
  Connection,
  clusterApiUrl,
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

export const MAINNET_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com";

export function getSolanaConnection(network: "devnet" | "mainnet" = "devnet"): Connection {
  const endpoint = network === "mainnet" ? MAINNET_RPC_ENDPOINT : DEVNET_RPC_ENDPOINT;
  return new Connection(endpoint, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 30000,
  });
}

/**
 * Fetch native SOL balance
 */
export async function getSolBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const lamports = await connection.getBalance(publicKey, "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error fetching SOL balance:", error);
    return 0;
  }
}

/**
 * Fetch SPL token balance (supports both SPL Legacy and Token-2022)
 */
export async function getSplTokenBalance(
  connection: Connection,
  ownerPublicKey: PublicKey,
  mintPublicKey: PublicKey,
  decimals: number = 6,
  isToken2022: boolean = false
): Promise<number> {
  try {
    const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = await getAssociatedTokenAddress(
      mintPublicKey,
      ownerPublicKey,
      false,
      programId
    );

    const tokenAccount = await getAccount(connection, ata, "confirmed", programId);
    return Number(tokenAccount.amount) / Math.pow(10, decimals);
  } catch (error) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      return 0;
    }
    // Also try fallback to TOKEN_2022 if standard lookup fails
    if (!isToken2022) {
      try {
        const ata22 = await getAssociatedTokenAddress(
          mintPublicKey,
          ownerPublicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );
        const tokenAccount22 = await getAccount(
          connection,
          ata22,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        );
        return Number(tokenAccount22.amount) / Math.pow(10, decimals);
      } catch {
        return 0;
      }
    }
    return 0;
  }
}

/**
 * Solana Explorer link generator
 */
export function getExplorerUrl(
  identifier: string,
  type: "tx" | "address" | "token" = "tx",
  network: "devnet" | "mainnet" = "devnet"
): string {
  const clusterParam = network === "mainnet" ? "" : "?cluster=devnet";
  if (type === "token" || type === "address") {
    return `https://explorer.solana.com/address/${identifier}${clusterParam}`;
  }
  return `https://explorer.solana.com/tx/${identifier}${clusterParam}`;
}
