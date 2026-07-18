import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { createProofProvider } from '@midnight-ntwrk/midnight-js-types';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Transaction, LedgerParameters, ZswapChainState } from '@midnight-ntwrk/ledger-v8';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';

import { NETWORK_ENDPOINTS, type MidnightNetwork } from './network-config';
export type { MidnightNetwork } from './network-config';

const FALLBACK_ENDPOINTS = {
  preview: {
    indexerHttp: NETWORK_ENDPOINTS.preview.http,
    indexerWs: NETWORK_ENDPOINTS.preview.ws,
  },
  preprod: {
    indexerHttp: NETWORK_ENDPOINTS.preprod.http,
    indexerWs: NETWORK_ENDPOINTS.preprod.ws,
  },
  undeployed: {
    indexerHttp: NETWORK_ENDPOINTS.undeployed.http,
    indexerWs: NETWORK_ENDPOINTS.undeployed.ws,
  },
};

export interface MidnightSession {
  connectedApi: ConnectedAPI;
  unshieldedAddress: string;
  networkId: MidnightNetwork;
  providers: any;
}

export const listWallets = (): InitialAPI[] => {
  if (typeof window === 'undefined' || !window.midnight) {
    return [];
  }
  return Object.values(window.midnight);
};

function createInMemoryPrivateStateProvider() {
  let scope = '';
  const stateStore = new Map<string, any>();
  const signingKeyStore = new Map<string, any>();
  const key = (id: string) => `${scope}:${id}`;

  return {
    setContractAddress(address: string) {
      scope = address;
    },
    async set(id: string, state: any) {
      stateStore.set(key(id), state);
    },
    async get(id: string) {
      return stateStore.get(key(id)) ?? null;
    },
    async remove(id: string) {
      stateStore.delete(key(id));
    },
    async clear() {
      stateStore.clear();
    },
    async setSigningKey(addr: string, k: any) {
      signingKeyStore.set(addr, k);
    },
    async getSigningKey(addr: string) {
      return signingKeyStore.get(addr) ?? null;
    },
    async removeSigningKey(addr: string) {
      signingKeyStore.delete(addr);
    },
    async clearSigningKeys() {
      signingKeyStore.clear();
    },
    async exportPrivateStates(): Promise<any> {
      throw new Error('Not implemented');
    },
    async importPrivateStates() {
      throw new Error('Not implemented');
    },
    async exportSigningKeys(): Promise<any> {
      throw new Error('Not implemented');
    },
    async importSigningKeys() {
      throw new Error('Not implemented');
    },
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

async function buildWalletAndMidnightProvider(connectedApi: ConnectedAPI) {
  const shieldedAddresses = await connectedApi.getShieldedAddresses();

  return {
    getCoinPublicKey() {
      return shieldedAddresses.shieldedCoinPublicKey;
    },
    getEncryptionPublicKey() {
      return shieldedAddresses.shieldedEncryptionPublicKey;
    },
    async balanceTx(tx: any, ttl?: Date) {
      const txHex = toHex(tx.serialize());
      const result = await connectedApi.balanceUnsealedTransaction(txHex, { payFees: true });
      const balancedTxBytes = fromHex(result.tx);
      return Transaction.deserialize('signature', 'proof', 'binding', balancedTxBytes);
    },
    async submitTx(tx: any) {
      const txHex = toHex(tx.serialize());
      await connectedApi.submitTransaction(txHex);
      return tx.identifiers()[0];
    },
  };
}

async function gqlQuery(url: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Indexer HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((e: any) => e.message).join('; '));
  return payload.data;
}

export function createPatchedPublicDataProvider(
  queryUrl: string,
  subscriptionUrl: string,
): PublicDataProvider {
  const base = indexerPublicDataProvider(queryUrl, subscriptionUrl);

  return {
    ...base,

    async queryContractState(contractAddress: string, config?: any) {
      console.log('queryContractState config:', JSON.stringify(config));
      if (config) return base.queryContractState(contractAddress, config);

      const data = await gqlQuery(queryUrl, `
        query LATEST_STATE($address: HexEncoded!) {
          contractAction(address: $address) { state }
        }
      `, { address: contractAddress });

      return data?.contractAction
        ? ContractState.deserialize(fromHex(data.contractAction.state))
        : null;
    },

    async queryZSwapAndContractState(contractAddress: string, config?: any) {
      console.log('queryZSwapAndContractState config:', JSON.stringify(config));
      if (config) return base.queryZSwapAndContractState(contractAddress, config);

      const data = await gqlQuery(queryUrl, `
        query LATEST_BOTH($address: HexEncoded!) {
          contractAction(address: $address) {
            state
            zswapState
            transaction { block { ledgerParameters } }
          }
        }
      `, { address: contractAddress });

      const action = data?.contractAction;
      if (!action) return null;

      const zswapState = action.zswapState
        ? ZswapChainState.deserialize(fromHex(action.zswapState))
        : new ZswapChainState();

      return [
        zswapState,
        ContractState.deserialize(fromHex(action.state)),
        action.transaction?.block?.ledgerParameters
          ? LedgerParameters.deserialize(fromHex(action.transaction.block.ledgerParameters))
          : LedgerParameters.initialParameters(),
      ] as [ZswapChainState, ContractState, LedgerParameters];
    },

    async queryUnshieldedBalances(contractAddress: string, config?: any) {
      if (config) return base.queryUnshieldedBalances(contractAddress, config);

      const data = await gqlQuery(queryUrl, `
        query LATEST_BALANCES($address: HexEncoded!) {
          contractAction(address: $address) {
            ... on ContractDeploy { unshieldedBalances { tokenType amount } }
            ... on ContractCall   { unshieldedBalances { tokenType amount } }
            ... on ContractUpdate { unshieldedBalances { tokenType amount } }
          }
        }
      `, { address: contractAddress });

      const action = data?.contractAction;
      if (!action) return null;
      const raw: Array<{ tokenType: string; amount: string }> =
        action.unshieldedBalances ?? [];
      return raw.map(e => ({ tokenType: e.tokenType, balance: BigInt(e.amount) }));
    },
  };
}

export async function connectMidnightWallet(
  wallet: InitialAPI,
  network: MidnightNetwork
): Promise<MidnightSession> {
  // 1. Initialize network ID
  setNetworkId(network);

  // 2. Connect to wallet
  const connectedApi = await wallet.connect(network);

  // 3. Retrieve unshielded address
  const { unshieldedAddress } = await connectedApi.getUnshieldedAddress();

  // 4. Retrieve configuration and resolve endpoints
  let indexerHttp = FALLBACK_ENDPOINTS[network].indexerHttp;
  let indexerWs = FALLBACK_ENDPOINTS[network].indexerWs;

  try {
    const config = await connectedApi.getConfiguration();
    if (config.indexerUri) indexerHttp = config.indexerUri;
    if (config.indexerWsUri) indexerWs = config.indexerWsUri;
  } catch (err) {
    console.warn('Failed to retrieve wallet endpoints configuration, using defaults', err);
  }

  // 5. Build ZK Config Provider pointing to public directory
  const absoluteZkConfigUrl = new URL('/zk/election', window.location.origin).toString();
  const zkConfigProvider = new FetchZkConfigProvider(absoluteZkConfigUrl, window.fetch.bind(window));

  // 6. Build Proving Provider from wallet
  const provingProvider = await connectedApi.getProvingProvider(zkConfigProvider);

  // 7. Assemble MidnightProviders object
  const walletAndMidnightProvider = await buildWalletAndMidnightProvider(connectedApi);

  const providers = {
    publicDataProvider: createPatchedPublicDataProvider(indexerHttp, indexerWs),
    zkConfigProvider,
    proofProvider: createProofProvider(provingProvider),
    walletProvider: walletAndMidnightProvider,
    midnightProvider: walletAndMidnightProvider,
    privateStateProvider: createInMemoryPrivateStateProvider(),
  };

  return {
    connectedApi,
    unshieldedAddress,
    networkId: network,
    providers,
  };
}
