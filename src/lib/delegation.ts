import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createApproveInstruction,
  createRevokeInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { DUSD_MINT_ADDRESS, SESSION_DELEGATE_PUBKEY } from "./stocks";

export interface DelegationStatus {
  hasDelegated: boolean;
  delegatedAmount: number;
  delegateAddress: string;
}

/**
 * Reads the on-chain delegated spending allowance for the user's dUSD token account
 */
export async function getDusdDelegationStatus(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<DelegationStatus> {
  try {
    const dusdMint = new PublicKey(DUSD_MINT_ADDRESS);
    const delegatePubkey = new PublicKey(SESSION_DELEGATE_PUBKEY);
    const userDusdATA = await getAssociatedTokenAddress(dusdMint, userPublicKey, false);

    const account = await getAccount(connection, userDusdATA, "confirmed");

    if (
      account.delegate &&
      account.delegate.equals(delegatePubkey) &&
      account.delegatedAmount > BigInt(0)
    ) {
      return {
        hasDelegated: true,
        delegatedAmount: Number(account.delegatedAmount) / 1_000_000,
        delegateAddress: delegatePubkey.toBase58(),
      };
    }
  } catch (error) {
    if (
      error instanceof TokenAccountNotFoundError ||
      error instanceof TokenInvalidAccountOwnerError
    ) {
      return { hasDelegated: false, delegatedAmount: 0, delegateAddress: SESSION_DELEGATE_PUBKEY };
    }
  }

  return { hasDelegated: false, delegatedAmount: 0, delegateAddress: SESSION_DELEGATE_PUBKEY };
}

/**
 * Builds the 1-time transaction for the user to approve dUSD session delegation
 */
export async function buildApproveDelegationTx(
  connection: Connection,
  userPublicKey: PublicKey,
  approvalAmountUsd: number = 500
): Promise<Transaction> {
  const dusdMint = new PublicKey(DUSD_MINT_ADDRESS);
  const delegatePubkey = new PublicKey(SESSION_DELEGATE_PUBKEY);
  const userDusdATA = await getAssociatedTokenAddress(dusdMint, userPublicKey, false);

  const amountLamports = BigInt(Math.round(approvalAmountUsd * 1_000_000));

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    recentBlockhash: latestBlockhash.blockhash,
    feePayer: userPublicKey,
  });

  // Ensure ATA exists then approve delegation
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      userPublicKey,
      userDusdATA,
      userPublicKey,
      dusdMint
    ),
    createApproveInstruction(
      userDusdATA,
      delegatePubkey,
      userPublicKey,
      amountLamports
    )
  );

  return tx;
}

/**
 * Builds a transaction to revoke the session delegation
 */
export async function buildRevokeDelegationTx(
  connection: Connection,
  userPublicKey: PublicKey
): Promise<Transaction> {
  const dusdMint = new PublicKey(DUSD_MINT_ADDRESS);
  const userDusdATA = await getAssociatedTokenAddress(dusdMint, userPublicKey, false);

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    recentBlockhash: latestBlockhash.blockhash,
    feePayer: userPublicKey,
  });

  tx.add(
    createRevokeInstruction(
      userDusdATA,
      userPublicKey
    )
  );

  return tx;
}
