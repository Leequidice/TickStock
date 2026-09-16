const { DynamicBondingCurveClient, deriveDbcPoolAddress } = require('@meteora-ag/dynamic-bonding-curve-sdk');
const { Connection, Keypair, PublicKey, sendAndConfirmTransaction } = require('@solana/web3.js');

async function main() {
  const authoritySecret = Buffer.from('MMuosN0K7/bYxcqPtTSmMemL1NtTv2NYWlDnuGg5Z1R0pZi2RREKe+awkErdxvw4EsKTeQJXOK/+N9CqXBHKow==', 'base64');
  const payer = Keypair.fromSecretKey(authoritySecret);
  const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
  const client = DynamicBondingCurveClient.create(conn, 'confirmed');

  console.log('Using payer:', payer.publicKey.toBase58());

  // Find a standard WSOL config with reasonable threshold (e.g. 5-85 SOL)
  const configs = await client.state.getPoolConfigs();
  console.log('Found configs:', configs.length);

  // Filter for WSOL quote configs with sensible migration threshold
  const BN = require('bn.js');
  const minThreshold = new BN('1000000000'); // 1 SOL
  const maxThreshold = new BN('100000000000'); // 100 SOL

  const wsolConfigs = configs.filter(c => 
    c.account.quoteMint && 
    c.account.quoteMint.toBase58() === 'So11111111111111111111111111111111111111112' &&
    c.account.migrationOption === 1 && // MET_DAMM_V2
    c.account.migrationQuoteThreshold &&
    c.account.migrationQuoteThreshold.gte(minThreshold) &&
    c.account.migrationQuoteThreshold.lte(maxThreshold)
  );

  console.log('WSOL Configs matching criteria:', wsolConfigs.length);
  const chosenConfig = wsolConfigs[0];
  console.log('Chosen Config:', chosenConfig.publicKey.toBase58());
  console.log('Migration Threshold (SOL):', chosenConfig.account.migrationQuoteThreshold.toNumber() / 1e9);

  const baseKeypair = Keypair.generate();
  console.log('New $AERO Base Mint Keypair:', baseKeypair.publicKey.toBase58());

  const createPoolTx = await client.creator.createPool({
    baseMint: baseKeypair.publicKey,
    name: 'AeroOrbit Propulsion Labs',
    symbol: 'AERO',
    uri: 'https://tickstock.app/metadata/aero.json',
    config: chosenConfig.publicKey,
    payer: payer.publicKey,
    poolCreator: payer.publicKey,
  });

  console.log('Transaction instructions:', createPoolTx.instructions.length);

  createPoolTx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  createPoolTx.feePayer = payer.publicKey;

  const sig = await sendAndConfirmTransaction(conn, createPoolTx, [payer, baseKeypair], {
    commitment: 'confirmed'
  });

  const poolAddress = deriveDbcPoolAddress(chosenConfig.account.quoteMint, baseKeypair.publicKey, chosenConfig.publicKey);

  console.log('SUCCESS! Meteora DBC Pool Created on Devnet:');
  console.log('Transaction Signature:', sig);
  console.log('Pool Address:', poolAddress.toBase58());
  console.log('Base Mint ($AERO):', baseKeypair.publicKey.toBase58());
  console.log('Explorer URL:', `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(err => {
  console.error('Setup failed:', err);
});
