import './ws-global.ts';
import { createClient } from 'graphql-ws';
import { WebSocket } from 'ws';

console.log('Creating GraphQL WS client...');
const client = createClient({
  url: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  webSocketImpl: WebSocket,
});

console.log('Subscribing to new blocks...');
const unsubscribe = client.subscribe(
  {
    query: `
      subscription {
        blocks {
          height
          hash
        }
      }
    `,
  },
  {
    next(data) {
      console.log('🎉 New block received!', data.data?.blocks?.height);
      unsubscribe();
      process.exit(0);
    },
    error(err) {
      console.error('❌ Subscription error:', err);
      process.exit(1);
    },
    complete() {
      console.log('Subscription completed');
      process.exit(0);
    },
  }
);

setTimeout(() => {
  console.log('❌ Timeout after 15 seconds.');
  unsubscribe();
  process.exit(1);
}, 15000);
