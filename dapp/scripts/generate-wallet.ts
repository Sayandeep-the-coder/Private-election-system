import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as bip39 from 'bip39';

async function generate() {
  setNetworkId('preview');
  
  // Generate random mnemonic
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const seedHex = seed.toString('hex');
  
  const hdWallet = HDWallet.fromSeed(seed);
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  
  const derivationResult = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
    
  if (derivationResult.type !== 'keysDerived') throw new Error('Failed to derive keys');
  
  const keys = derivationResult.keys;
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], 'preview');
  const address = PublicKey.fromKeyStore(unshieldedKeystore).address;
  
  console.log('==================================================');
  console.log('🔑 NEW WALLET GENERATED FOR PREVIEW');
  console.log('==================================================');
  console.log(`Mnemonic:      ${mnemonic}`);
  console.log(`Seed Hex:      ${seedHex}`);
  console.log(`Address:       ${address}`);
  console.log('==================================================');
  console.log('\nPlease fund this address at https://faucet.preview.midnight.network/');
  console.log('==================================================');
}

generate().catch(console.error);
