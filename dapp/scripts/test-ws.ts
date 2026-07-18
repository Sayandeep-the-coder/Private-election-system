import { WebSocket } from 'ws';

const url = 'wss://rpc.preview.midnight.network';
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('✅ Connection opened successfully!');
  ws.close();
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('❌ Connection error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Connection timeout after 10 seconds.');
  process.exit(1);
}, 10000);
