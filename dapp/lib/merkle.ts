import { pureCircuits } from './election';

export interface MerklePathNode {
  sibling: { field: bigint };
  goes_left: boolean;
}

export interface MerkleTreePath {
  leaf: Uint8Array;
  path: MerklePathNode[];
}

export function buildMerkleTree(commitments: Uint8Array[], depth: number = 10) {
  const leafCount = 1 << depth; // 2^10 = 1024
  const leaves = [...commitments];
  
  // Pad the rest of the leaves with empty leaves (32-byte arrays of zeroes)
  while (leaves.length < leafCount) {
    leaves.push(new Uint8Array(32));
  }

  // Layer 0: Hash the leaves
  const layers: bigint[][] = [];
  let currentLayer = leaves.map(leaf => pureCircuits.hashLeaf(leaf));
  layers.push(currentLayer);

  // Layers 1 to depth: Hash siblings
  for (let d = 0; d < depth; d++) {
    const nextLayer: bigint[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1];
      nextLayer.push(pureCircuits.hashSiblings(left, right));
    }
    currentLayer = nextLayer;
    layers.push(currentLayer);
  }

  const root = layers[depth][0];

  // Helper to generate path for a leaf index
  const getPath = (index: number): MerkleTreePath => {
    const leaf = leaves[index];
    const path: MerklePathNode[] = [];
    let idx = index;
    
    for (let d = 0; d < depth; d++) {
      const layer = layers[d];
      const isEven = idx % 2 === 0;
      const siblingIdx = isEven ? idx + 1 : idx - 1;
      const siblingVal = layer[siblingIdx];
      
      path.push({
        sibling: { field: siblingVal },
        goes_left: isEven // In the circuit, goes_left = true means the recursive digest (we) is on the left
      });
      
      idx = Math.floor(idx / 2);
    }

    return {
      leaf,
      path
    };
  };

  return {
    root,
    getPath,
    leaves
  };
}
