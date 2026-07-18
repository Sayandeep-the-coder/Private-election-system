// @ts-nocheck
/**
 * Headless Election Contract Deployment Script
 * 
 * Usage:
 *   node --experimental-strip-types scripts/deploy-election.ts <SEED_HEX> [network]
 * 
 * network: 'preview' (default, sponsored) | 'preprod' | 'undeployed'
 * 
 * Example:
 *   node --experimental-strip-types scripts/deploy-election.ts abc123...def preview
 */

import './ws-global.ts';
import * as Rx from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWallet, createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { withWitnesses } from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { Contract, pureCircuits } from '../../contract/src/managed/election/contract/index.js';


// --- Hex helpers ---
function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Network configs ---
const NETWORKS = {
  undeployed: {
    networkId: 'undeployed' as const,
    node: 'http://localhost:9944',
    indexerHttp: 'http://localhost:8088/api/v3/graphql',
    indexerWs: 'ws://localhost:8088/api/v3/graphql/ws',
    proofServer: 'http://localhost:6300',
  },
  preview: {
    networkId: 'preview' as const,
    node: 'https://rpc.preview.midnight.network',
    indexerHttp: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    proofServer: 'https://proof.preview.midnight.network',
  },
  preprod: {
    networkId: 'preprod' as const,
    node: 'https://rpc.preprod.midnight.network',
    indexerHttp: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWs: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    proofServer: 'http://localhost:6300',
  },
};

// --- Parse CLI args ---
const SEED_HEX = process.argv[2] || '';
const NETWORK_NAME = (process.argv[3] || 'preview') as keyof typeof NETWORKS;

if (!SEED_HEX) {
  console.error('Usage: node --experimental-strip-types scripts/deploy-election.ts <SEED_HEX> [network]');
  console.error('  network: preview (default) | preprod | undeployed');
  process.exit(1);
}

if (!NETWORKS[NETWORK_NAME]) {
  console.error(`Unknown network: ${NETWORK_NAME}. Use: preview, preprod, undeployed`);
  process.exit(1);
}

const NET = NETWORKS[NETWORK_NAME];

// --- Election config ---
const QUESTION = 'Who should be the KGEC Dev Community lead?';
const OPTIONS = 'Alice, Bob, Charlie';

async function run() {
  console.log(`\n🗳️  Private Election System — Headless Deployment`);
  console.log(`   Network: ${NETWORK_NAME} (${NET.networkId})`);
  console.log(`   Node:    ${NET.node}`);
  console.log(`   Indexer: ${NET.indexerHttp}\n`);

  // 1. Set network ID globally
  setNetworkId(NET.networkId);

  // 2. Derive HD keys
  console.log('🔑 Deriving HD keys from seed...');
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
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], NET.networkId);

  // 3. Build Wallet Facade
  console.log('💼 Starting wallet facade...');
  const relayURL = new URL(NET.node.replace(/^https/, 'wss').replace(/^http(?!s)/, 'ws'));

  const wallet = await WalletFacade.init({
    configuration: {
      networkId: NET.networkId,
      indexerClientConnection: { indexerHttpUrl: NET.indexerHttp, indexerWsUrl: NET.indexerWs },
      provingServerUrl: new URL(NET.proofServer),
      relayURL,
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

  // 4. Wait for wallet sync
  console.log('⏳ Synchronizing wallet with the ledger (this may take a minute)...');
  const state = await wallet.waitForSyncedState();
  console.log('✅ Wallet synced.');

  // 5. Build providers for midnight-js-contracts
  console.log('🔧 Building contract providers...');

  // Resolve ZK asset paths relative to this script
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const zkAssetsDir = path.resolve(__dirname, '..', 'public', 'zk', 'election');

  // Private state provider (in-memory)
  const privateStates = new Map();
  const privateStateProvider = {
    async set(id: string, state: any) { privateStates.set(id, state); },
    async get(id: string) { return privateStates.get(id) ?? null; },
    async remove(id: string) { privateStates.delete(id); },
    async clear() { privateStates.clear(); },
    setContractAddress(_addr: string) {},
    async setSigningKey(addr: string, k: any) { privateStates.set(`sk:${addr}`, k); },
    async getSigningKey(addr: string) { return privateStates.get(`sk:${addr}`) ?? null; },
    async removeSigningKey(addr: string) { privateStates.delete(`sk:${addr}`); },
    async clearSigningKeys() {},
    async exportPrivateStates() { throw new Error('Not implemented'); },
    async importPrivateStates() { throw new Error('Not implemented'); },
    async exportSigningKeys() { throw new Error('Not implemented'); },
    async importSigningKeys() { throw new Error('Not implemented'); },
  };

  // Build wallet provider adapter
  const walletProvider = {
    getCoinPublicKey() {
      return (state as any).shielded?.coinPublicKey;
    },
    getEncryptionPublicKey() {
      return (state as any).shielded?.encryptionPublicKey;
    },
    async balanceTx(tx: any) {
      const recipe = await wallet.balanceUnprovenTransaction(
        tx,
        { shieldedSecretKeys, dustSecretKey },
        { ttl: new Date(Date.now() + 10 * 60 * 1000) }
      );
      return await wallet.finalizeRecipe(recipe);
    },
    async submitTx(tx: any) {
      return await wallet.submitTransaction(tx);
    },
  };

  // Build midnight provider (node connection)
  const midnightProvider = {
    ...walletProvider,
    submitTx: walletProvider.submitTx,
  };

  // ZK config provider (load from local files)
  const zkConfigProvider = {
    async getVerifierKey(circuitId: string) {
      const filePath = path.join(zkAssetsDir, 'keys', `${circuitId}.verifier`);
      return fs.readFileSync(filePath);
    },
    async getProverKey(circuitId: string) {
      const filePath = path.join(zkAssetsDir, 'keys', `${circuitId}.prover`);
      return fs.readFileSync(filePath);
    },
    async getZkir(circuitId: string) {
      const filePath = path.join(zkAssetsDir, 'zkir', `${circuitId}.zkir`);
      return fs.readFileSync(filePath);
    },
    async getContractInfo() {
      const filePath = path.join(zkAssetsDir, 'contract-info.json');
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    },
  };

  // Proof provider (uses the proof server)
  const proofProvider = {
    async prove(circuitId: string, inputs: any) {
      // Use the wallet facade's proving service
      return wallet.provingService.prove({ circuitId, inputs } as any);
    },
  };

  const providers = {
    publicDataProvider: indexerPublicDataProvider(NET.indexerHttp, NET.indexerWs),
    zkConfigProvider,
    proofProvider: createProofProvider(proofProvider as any),
    walletProvider,
    midnightProvider,
    privateStateProvider,
  };

  // 6. Generate admin secret and compute admin key hash
  const adminSecret = new Uint8Array(32);
  globalThis.crypto.getRandomValues(adminSecret);
  const adminSecretHex = toHex(adminSecret);
  console.log(`\n🔐 Admin Secret Key (SAVE THIS!): ${adminSecretHex}`);

  const adminKeyHash = pureCircuits.deriveAdminKey(adminSecret);
  console.log(`📋 Admin Key Hash: ${toHex(adminKeyHash)}`);

  // 7. Build compiled contract
  console.log('\n📜 Building compiled contract with witnesses...');
  const contractWitnesses = {
    voterSecret: (ctx: any) => [ctx.privateState, ctx.privateState.voterSecret ?? new Uint8Array(32)],
    merklePath: (ctx: any, leaf: Uint8Array) => {
      const p = ctx.ledger.allowlist.findPathForLeaf(leaf);
      if (!p) throw new Error('Voter not in allowlist');
      return [ctx.privateState, p];
    },
    adminSecret: (ctx: any) => [ctx.privateState, ctx.privateState.adminSecret ?? new Uint8Array(32)],
  };

  const baseContract = CompiledContract.make('election', Contract as any);
  const contractWithWitnesses = (withWitnesses as any)(baseContract, contractWitnesses);
  const compiledContract = (CompiledContract.withCompiledFileAssets as any)(contractWithWitnesses, zkAssetsDir) as any;

  // 8. Set initial private state
  await privateStateProvider.set('electionPrivateState', {
    adminSecret: adminSecret,
  });

  // 9. Deploy!
  console.log('\n🚀 Deploying election contract...');
  console.log(`   Question: "${QUESTION}"`);
  console.log(`   Options:  "${OPTIONS}"`);
  console.log('   This may take 2-5 minutes for ZK proof generation...\n');

  const deployed = await deployContract(providers as any, {
    compiledContract,
    privateStateId: 'electionPrivateState',
    initialPrivateState: { adminSecret: adminSecret },
    args: [QUESTION, OPTIONS, adminKeyHash],
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;

  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ ELECTION CONTRACT DEPLOYED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Contract Address: ${contractAddress}`);
  console.log(`  Network:          ${NETWORK_NAME}`);
  console.log(`  Admin Secret:     ${adminSecretHex}`);
  console.log(`  Question:         ${QUESTION}`);
  console.log(`  Options:          ${OPTIONS}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n💡 Save the Contract Address and Admin Secret Key!');
  console.log('   You will need them to register voters and close the election.\n');

  // Cleanup
  hdWallet.hdWallet.clear();
  await wallet.stop();
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Deployment failed:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
