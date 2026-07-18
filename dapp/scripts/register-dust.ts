// @ts-ignore
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

// Polyfill WebSockets for Node.js context (required for indexer synchronization)
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

// Configure your endpoints (Undeployed Local Dev stack shown here by default)
const ENDPOINTS = {
  node: 'http://localhost:9944',
  indexerHttp: 'http://localhost:8088/api/v3/graphql',
  indexerWs: 'ws://localhost:8088/api/v3/graphql/ws',
  proofServer: 'http://localhost:6300',
  networkId: 'undeployed' as const,
};

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

// Paste your wallet's 12-word seed phrase converted to hex
const SEED_HEX = process.argv[2] || ''; 

if (!SEED_HEX) {
  console.error('Error: Please provide your wallet seed hex as an argument.');
  console.error('Usage: npx ts-node dapp/scripts/register-dust.ts <SEED_HEX>');
  process.exit(1);
}

async function run() {
  console.log('Deriving HD keys...');
  const hdWallet = HDWallet.fromSeed(fromHex(SEED_HEX));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') throw new Error('Key derivation failed');
  const keys = derivationResult.keys;

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);

  console.log('Starting wallets...');
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], ENDPOINTS.networkId);

  const shieldedWallet = ShieldedWallet({
    networkId: ENDPOINTS.networkId,
    indexerClientConnection: { indexerHttpUrl: ENDPOINTS.indexerHttp, indexerWsUrl: ENDPOINTS.indexerWs },
    provingServerUrl: new URL(ENDPOINTS.proofServer),
    relayURL: new URL(ENDPOINTS.node.replace(/^http/, 'ws')),
  } as any).startWithSecretKeys(shieldedSecretKeys);

  const unshieldedWallet = UnshieldedWallet({
    networkId: ENDPOINTS.networkId,
    indexerClientConnection: { indexerHttpUrl: ENDPOINTS.indexerHttp, indexerWsUrl: ENDPOINTS.indexerWs },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(null as any),
  } as any).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

  const dustWallet = DustWallet({
    networkId: ENDPOINTS.networkId,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    indexerClientConnection: { indexerHttpUrl: ENDPOINTS.indexerHttp, indexerWsUrl: ENDPOINTS.indexerWs },
    provingServerUrl: new URL(ENDPOINTS.proofServer),
    relayURL: new URL(ENDPOINTS.node.replace(/^http/, 'ws')),
  } as any).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

  const wallet = await WalletFacade.init({
    configuration: {
      networkId: ENDPOINTS.networkId,
      indexerClientConnection: { indexerHttpUrl: ENDPOINTS.indexerHttp, indexerWsUrl: ENDPOINTS.indexerWs },
      provingServerUrl: new URL(ENDPOINTS.proofServer),
      relayURL: new URL(ENDPOINTS.node.replace(/^http/, 'ws')),
    } as any,
    shielded: () => shieldedWallet,
    unshielded: () => unshieldedWallet,
    dust: () => dustWallet,
  });

  console.log('Synchronizing wallet with the ledger...');
  const state = (await Rx.firstValueFrom(
    wallet.state().pipe(Rx.filter((s: any) => s.isSynced))
  )) as any;

  console.log('Checking unregistered NIGHT UTXOs...');
  const unregistered = state.unshielded.availableCoins.filter(
    (coin: any) => coin.meta?.registeredForDustGeneration !== true
  );

  if (unregistered.length === 0) {
    console.log('All coins are already registered for DUST generation.');
  } else {
    console.log(`Found ${unregistered.length} unregistered coin(s). Registering on-chain...`);
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      unregistered,
      unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => unshieldedKeystore.signData(payload)
    );

    const finalized = await wallet.finalizeRecipe(recipe);
    const txId = await wallet.submitTransaction(finalized);
    console.log(`DUST registration transaction submitted successfully! Tx ID: ${txId}`);
    
    console.log('Waiting for block inclusion and DUST accumulation...');
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(5_000),
        Rx.filter((s: any) => s.isSynced),
        Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n)
      )
    );
    console.log(`Success! New DUST Balance: ${state.dust.walletBalance(new Date())} Specks`);
  }

  // Wipe secrets from memory and close connection
  hdWallet.hdWallet.clear();
  await wallet.stop();
  process.exit(0);
}

run().catch((err) => {
  console.error('An error occurred during DUST registration:', err);
  process.exit(1);
});
