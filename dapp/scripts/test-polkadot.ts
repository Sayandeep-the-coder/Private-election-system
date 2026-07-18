import './ws-global.ts';
import { ApiPromise, WsProvider } from '@polkadot/api';

async function test() {
  console.log('Initializing Polkadot WsProvider...');
  const provider = new WsProvider('wss://rpc.preview.midnight.network');
  
  console.log('Connecting to RPC node...');
  const api = await ApiPromise.create({ provider });
  
  console.log('✅ Connected successfully!');
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);
  
  console.log(`Chain:    ${chain}`);
  console.log(`Node:     ${nodeName}`);
  console.log(`Version:  ${nodeVersion}`);
  
  await api.disconnect();
  process.exit(0);
}

test().catch((err) => {
  console.error('❌ Connection failed:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('❌ Timeout after 15 seconds.');
  process.exit(1);
}, 15000);
