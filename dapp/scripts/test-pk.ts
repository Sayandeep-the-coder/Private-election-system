import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as bip39 from 'bip39';

async function test() {
  setNetworkId('preview');
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const hdWallet = HDWallet.fromSeed(seed);
  const derivationResult = (hdWallet as any).hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  const keys = derivationResult.keys;
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], 'preview');
  const pk = PublicKey.fromKeyStore(unshieldedKeystore);
  
  console.log('PUBLIC KEY TYPE:', typeof pk);
  console.log('PUBLIC KEY KEYS:', Object.keys(pk));
  console.log('PUBLIC KEY PROTOTYPE:', Object.getOwnPropertyNames(Object.getPrototypeOf(pk)));
  console.log('PUBLIC KEY STRING:', String(pk));
  console.log('PUBLIC KEY JSON:', JSON.stringify(pk));
}

test().catch(console.error);
