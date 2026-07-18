import { describe, it, expect } from 'vitest';
import { pureCircuits } from './managed/election/contract/index.js';

// Helper to create a filled Uint8Array of a specific size
const makeBytes = (size: number, fill: number = 0): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.fill(fill);
  return bytes;
};

describe('Private Election Smart Contract - Pure Circuits Unit Tests', () => {
  
  describe('Key Derivation and Cryptography', () => {
    
    it('should derive admin key hash from admin secret', () => {
      const adminSecret = makeBytes(32, 1);
      const adminKeyHash = pureCircuits.deriveAdminKey(adminSecret);
      
      expect(adminKeyHash).toBeInstanceOf(Uint8Array);
      expect(adminKeyHash.length).toBe(32);
      
      // Verification that different secrets yield different key hashes
      const adminSecret2 = makeBytes(32, 2);
      const adminKeyHash2 = pureCircuits.deriveAdminKey(adminSecret2);
      expect(adminKeyHash).not.toEqual(adminKeyHash2);
    });

    it('should calculate voter commitment hash from voter secret key', () => {
      const voterSecret = makeBytes(32, 10);
      const commitment = pureCircuits.calculateCommitment(voterSecret);
      
      expect(commitment).toBeInstanceOf(Uint8Array);
      expect(commitment.length).toBe(32);
      
      const voterSecret2 = makeBytes(32, 11);
      const commitment2 = pureCircuits.calculateCommitment(voterSecret2);
      expect(commitment).not.toEqual(commitment2);
    });

    it('should calculate election nullifier correctly', () => {
      const voterSecret = makeBytes(32, 42);
      const electionId = makeBytes(32, 99);
      const nullifier = pureCircuits.calculateNullifier(voterSecret, electionId);
      
      expect(nullifier).toBeInstanceOf(Uint8Array);
      expect(nullifier.length).toBe(32);
      
      // Nullifier should be unique to the voter secret
      const voterSecret2 = makeBytes(32, 43);
      const nullifierDiffSecret = pureCircuits.calculateNullifier(voterSecret2, electionId);
      expect(nullifier).not.toEqual(nullifierDiffSecret);
      
      // Nullifier should be unique to the election ID
      const electionId2 = makeBytes(32, 100);
      const nullifierDiffElection = pureCircuits.calculateNullifier(voterSecret, electionId2);
      expect(nullifier).not.toEqual(nullifierDiffElection);
    });
  });

  describe('Merkle Tree Cryptographic Primitives', () => {
    
    it('should hash a leaf to a bigint Field', () => {
      const leaf = makeBytes(32, 5);
      const leafHash = pureCircuits.hashLeaf(leaf);
      
      expect(typeof leafHash).toBe('bigint');
      
      const leaf2 = makeBytes(32, 6);
      const leafHash2 = pureCircuits.hashLeaf(leaf2);
      expect(leafHash).not.toEqual(leafHash2);
    });

    it('should hash sibling nodes to a combined parent Field', () => {
      const left = 12345n;
      const right = 67890n;
      const parentHash = pureCircuits.hashSiblings(left, right);
      
      expect(typeof parentHash).toBe('bigint');
      
      const parentHashDiff = pureCircuits.hashSiblings(right, left);
      expect(parentHash).not.toEqual(parentHashDiff); // Order matters in Merkle hashing
    });

    it('should correctly calculate a depth-3 mock Merkle Tree root', () => {
      const depth = 3;
      const leavesCount = 1 << depth; // 8 leaves
      
      const leaves = Array.from({ length: leavesCount }, (_, i) => makeBytes(32, i));
      
      // Layer 0: Hash the leaves
      let currentLayer = leaves.map(leaf => pureCircuits.hashLeaf(leaf));
      
      // Layers 1 to depth: Hash siblings
      for (let d = 0; d < depth; d++) {
        const nextLayer: bigint[] = [];
        for (let i = 0; i < currentLayer.length; i += 2) {
          nextLayer.push(pureCircuits.hashSiblings(currentLayer[i], currentLayer[i + 1]));
        }
        currentLayer = nextLayer;
      }
      
      const root = currentLayer[0];
      expect(typeof root).toBe('bigint');
      
      // Modifying one leaf should change the root
      const modifiedLeaves = [...leaves];
      modifiedLeaves[4] = makeBytes(32, 99); // change leaf at index 4
      
      let currentLayerMod = modifiedLeaves.map(leaf => pureCircuits.hashLeaf(leaf));
      for (let d = 0; d < depth; d++) {
        const nextLayer: bigint[] = [];
        for (let i = 0; i < currentLayerMod.length; i += 2) {
          nextLayer.push(pureCircuits.hashSiblings(currentLayerMod[i], currentLayerMod[i + 1]));
        }
        currentLayerMod = nextLayer;
      }
      const rootMod = currentLayerMod[0];
      
      expect(root).not.toEqual(rootMod);
    });
  });
});
