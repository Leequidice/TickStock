const { DynamicBondingCurveClient } = require('@meteora-ag/dynamic-bonding-curve-sdk');
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = require('@solana/web3.js');
const BN = require('bn.js');

async function main() {
  const authoritySecret = Buffer.from('MMuosN0K7/bYxcqPtTSmMemL1NtTv2NYWlDnuGg5Z1R0pZi2RREKe+awkErdxvw4EsKTeQJXOK/+N9CqXBHKow==', 'base64');
  const payer = Keypair.fromSecretKey(authoritySecret);
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  const client = DynamicBondingCurveClient.create(conn, 'confirmed');

  const poolPubkey = new PublicKey('3oEBVanZw9AZ8LvhpN4w9EGP8DffqLJay5Qpnd5rr1k9');
  console.log('Testing Swap on Meteora DBC Pool:', poolPubkey.toBase58());

  // 1. Get initial pool state & curve progress
  const initialPool = await client.state.getPool(poolPubkey);
  const initialProgress = await client.state.getPoolQuoteTokenCurveProgress(poolPubkey);
  console.log('Initial Quote Reserve:', initialPool.poolState.quoteReserve.toString());
  console.log('Initial Base Reserve:', initialPool.poolState.baseReserve.toString());
  console.log('Initial Curve Progress (%):', (initialProgress * 100).toFixed(4) + '%');

  // 2. Compute quote for 0.05 SOL buy
  const buyAmountLamports = new BN(50000000); // 0.05 SOL
  const poolConfig = await client.state.getPoolConfig(initialPool.poolState.config);
  const slot = await conn.getSlot();

  const swapQuote = await client.pool.swapQuote({
    virtualPool: { ...initialPool, publicKey: poolPubkey },
    config: poolConfig,
    amountIn: buyAmountLamports,
    swapMode: 0, // ExactIn
    tradeDirection: 0, // QuoteToBase (Buy)
    slippageBps: 200, // 2%
    currentPoint: new BN(slot),
  });

  console.log('Expected Tokens Out:', swapQuote.outputAmount.toString());
  console.log('Minimum Tokens Out:', swapQuote.minimumAmountOut.toString());
  console.log('Fee (Lamports):', swapQuote.tradingFee.toString());

  // 3. Build & Send Swap Transaction
  const swapTx = await client.pool.swap({
    owner: payer.publicKey,
    payer: payer.publicKey,
    pool: poolPubkey,
    amountIn: buyAmountLamports,
    minimumAmountOut: swapQuote.minimumAmountOut,
    swapBaseForQuote: false, // Buy: Quote -> Base
    referralTokenAccount: null,
  });

  swapTx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  swapTx.feePayer = payer.publicKey;

  const sig = await sendAndConfirmTransaction(conn, swapTx, [payer], {
    commitment: 'confirmed'
  });

  console.log('SWAP EXECUTED SUCCESSFULLY ON-CHAIN!');
  console.log('Transaction Signature:', sig);
  console.log('Explorer URL:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // 4. Verify post-swap pool state
  const updatedPool = await client.state.getPool(poolPubkey);
  const updatedProgress = await client.state.getPoolQuoteTokenCurveProgress(poolPubkey);
  console.log('Updated Quote Reserve:', updatedPool.poolState.quoteReserve.toString());
  console.log('Updated Base Reserve:', updatedPool.poolState.baseReserve.toString());
  console.log('Updated Curve Progress (%):', (updatedProgress * 100).toFixed(4) + '%');
}

main().catch(err => {
  console.error('Swap test failed:', err);
});
