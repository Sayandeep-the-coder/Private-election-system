/**
 * Centralized Midnight network endpoint configuration.
 * Reads from NEXT_PUBLIC_* environment variables with sensible fallbacks.
 */

export type MidnightNetwork = 'undeployed' | 'preview' | 'preprod';

export interface NetworkEndpoints {
  http: string;
  ws: string;
}

export const NETWORK_ENDPOINTS: Record<MidnightNetwork, NetworkEndpoints> = {
  preview: {
    http: process.env.NEXT_PUBLIC_INDEXER_PREVIEW_HTTP || 'https://indexer.preview.midnight.network/api/v4/graphql',
    ws:   process.env.NEXT_PUBLIC_INDEXER_PREVIEW_WS   || 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  },
  preprod: {
    http: process.env.NEXT_PUBLIC_INDEXER_PREPROD_HTTP || 'https://indexer.preprod.midnight.network/api/v4/graphql',
    ws:   process.env.NEXT_PUBLIC_INDEXER_PREPROD_WS   || 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  },
  undeployed: {
    http: process.env.NEXT_PUBLIC_INDEXER_LOCAL_HTTP || 'http://localhost:8088/api/v3/graphql',
    ws:   process.env.NEXT_PUBLIC_INDEXER_LOCAL_WS   || 'ws://localhost:8088/api/v3/graphql/ws',
  },
};

export const DEFAULT_NETWORK: MidnightNetwork =
  (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as MidnightNetwork) || 'preprod';

export const DEPLOYED_CONTRACT_ADDRESS: string =
  process.env.NEXT_PUBLIC_DEPLOYED_CONTRACT_ADDRESS || '';

export function getEndpoints(network: MidnightNetwork): NetworkEndpoints {
  return NETWORK_ENDPOINTS[network] || NETWORK_ENDPOINTS.preview;
}
