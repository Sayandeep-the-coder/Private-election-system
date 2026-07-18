// @ts-nocheck
/**
 * Convert your wallet's mnemonic (recovery phrase) to a seed hex string.
 * 
 * Usage:
 *   node --experimental-strip-types scripts/mnemonic-to-seed.ts "word1 word2 word3 ... word12"
 */

import * as bip39 from 'bip39';

const mnemonic = process.argv[2];

if (!mnemonic) {
  console.error('Usage: node --experimental-strip-types scripts/mnemonic-to-seed.ts "word1 word2 ... word12"');
  console.error('\nPaste your 12 or 24 word recovery phrase in quotes.');
  process.exit(1);
}

if (!bip39.validateMnemonic(mnemonic.trim())) {
  console.error('❌ Invalid mnemonic! Check your words and try again.');
  process.exit(1);
}

const seedHex = bip39.mnemonicToSeedSync(mnemonic.trim()).toString('hex');

console.log('\n✅ Your SEED_HEX:\n');
console.log(seedHex);
console.log('\n💡 Use this value as the first argument to deploy-election.ts:');
console.log(`   node --experimental-strip-types scripts/deploy-election.ts ${seedHex} preview\n`);
