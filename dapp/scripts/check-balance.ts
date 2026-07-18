import './ws-global.ts';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, UnshieldedWallet, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import * as Rx from 'rxjs';

process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

const SEED_HEX = '32c454493d26d338fecd1c9b6eabfb1f7315a17610db3cdd97efd2f0f096121b4eb59df75b4341484afef612e10f9563c1a8661110fd8f099a426b0d221764e2';

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

async function check() {
  setNetworkId('preview');
  
  const hdWallet = HDWallet.fromSeed(fromHex(SEED_HEX));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  const keys = derivationResult.keys;
  
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], 'preview');

  console.log('Initializing WalletFacade via WalletFacade.init...');
  const wallet = await WalletFacade.init({
    configuration: {
      networkId: 'preview',
      indexerClientConnection: {
        indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
        indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws'
      },
      provingServerUrl: new URL('https://proof.preview.midnight.network'),
      relayURL: new URL('wss://rpc.preview.midnight.network'),
    } as any,
    shielded: (config) => ShieldedWallet(config as any).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) => UnshieldedWallet({
      ...config,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(null as any),
    } as any).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) => DustWallet({
      ...config,
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    } as any).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });

  console.log('Starting WalletFacade explicitly...');
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  console.log('Subscribing to wallet state...');
  
  let lastState: any = null;
  const sub = wallet.state().subscribe({
    next: (s: any) => {
      lastState = s;
      console.log(`[STATE] Synced: ${s.isSynced} | Shielded: ${s.shielded.isSynced} | Unshielded: ${s.unshielded.isSynced} | Dust: ${s.dust.isSynced}`);
      if (s.isSynced) {
        const bal = s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
        console.log(`  🎉 WALLET SYNCED!`);
        console.log(`  Unshielded Balance: ${bal} tNIGHT`);
        console.log(`  DUST Coins Count: ${s.dust.availableCoins.length}`);
      }
    },
    error: (err) => console.error('[ERROR]', err)
  });

  console.log('Keeping event loop active for 60 seconds...');
  const interval = setInterval(() => {
    if (lastState) {
      console.log(`[PING] Synced: ${lastState.isSynced} | Shielded connected: ${lastState.shielded.progress.isConnected} | Unshielded connected: ${lastState.unshielded.progress.isConnected}`);
    } else {
      console.log(`[PING] State not received yet.`);
    }
  }, 5000);

  setTimeout(async () => {
    console.log('Cleaning up and exiting...');
    clearInterval(interval);
    sub.unsubscribe();
    await wallet.stop();
    process.exit(0);
  }, 60000);
}

check().catch(console.error);
