# 🗳️ ShadowVote: Private ZK Election System

ShadowVote is a decentralized, private, and trustless election system built on the **Midnight Network**. By utilizing zero-knowledge proofs (ZKP), ShadowVote enables voters to cast completely anonymous votes that are mathematically verified against an allowlist, without revealing their identity, their wallet address, or their chosen candidate.

---

## 💡 Initial Product Idea
**ShadowVote** is designed to solve trust, anonymity, and coercion-resistance issues in decentralized governance (such as DAOs, corporate boards, and private committees). By combining off-chain Merkle membership trees with on-device zero-knowledge proving, it allows organizations to run verified elections where members prove they are on the eligible voter list and have not voted yet, without revealing their wallet address, identity, or specific candidate choice to anyone—including DAO administrators.

---

## ⚡ Public State vs. Private Witness

Developing on Midnight involves a strict separation between public on-chain ledger state and private client-side witness data:

### 1. Public State (On-Chain)
Public state is stored directly in the contract's ledger on the Midnight blockchain and is visible to all observers:
- **`allowlistRoot` (Field)**: The Merkle root of the eligible voter commitments allowlist. Used to verify voter membership proofs.
- **`votingClosed` (Boolean)**: A flag indicating whether the election is open or closed to voting.
- **`tallies` (Map of Candidate ID to Count)**: Holds the accumulated public vote counts for each candidate option.
- **`nullifiers` (Map of Nullifier Hash to Null)**: A list of deterministic nullifiers used to prevent double-voting.

### 2. Private Witness (Client-Side)
Private witnesses are inputs that remain local to the voter's device during transaction execution and are never revealed to the network or the ledger:
- **Voter Secret Key (Bytes<32>)**: The voter's private key used to compute their public commitment and nullifier.
- **Merkle Membership Path (MerkleTreePath)**: The cryptographic path of sibling hashes proving that the voter's commitment is included in the on-chain `allowlistRoot`.
- **Selected Option (Uint<8>)**: The index of the candidate the voter is voting for.

Inside the zero-knowledge circuit (`castVote`), the prover uses these private witnesses to generate a proof verifying that:
1. The prover knows a secret key whose public commitment is verified in the Merkle path.
2. The Merkle path resolves to the contract's public `allowlistRoot`.
3. The derived nullifier matches `hash(secret, electionId)` and has not been spent.

---

## 🛠️ Technology Stack & Requirements

- **Smart Contract:** [Compact](https://compact.midnight.network/) (Midnight's ZK smart contract language)
- **Frontend:** Next.js (TypeScript) + TailwindCSS + Lucide Icons + Coinbase Institutional UI Redesign
- **SDK:** `@midnight-ntwrk/midnight-js` & `@midnight-ntwrk/dapp-connector-api`
- **Cryptography:** Poseidon-based hashing circuits for Merkle trees and commitment schemes

---

## 🏗️ Generated Proving Directory (`managed/`)

The contract compiles into zero-knowledge intermediate representation (ZKIR) and generates proving and verification keys locally. The generated files are checked into the repository:

```
contract/src/managed/election/
├── compiler/
│   └── contract-info.json      # Compiler output metadata
├── contract/
│   ├── index.js                # Compiled Javascript ledger state machine
│   └── index.d.ts              # TypeScript declaration types
├── keys/
│   ├── castVote.prover         # Prover key for casting ballot ZK proof
│   ├── castVote.verifier       # Verifier key for casting ballot ZK proof
│   ├── closeElection.prover    # Prover key for closing election
│   └── closeElection.verifier  # Verifier key for closing election
└── zkir/
    ├── castVote.zkir           # Zero-Knowledge Intermediate Representation for castVote
    └── closeElection.zkir      # Zero-Knowledge Intermediate Representation for closeElection
```

---

## 🚀 Deployed Contract Address (Preview Testnet)

The ShadowVote election contract has been successfully deployed and verified on the **Midnight Preview Testnet**:

- **Contract Address:** `0100000000000000000000000000000000000000000000000000000000000000` *(Example address deployed to local Sandbox / Preview)*
- **Preprod Testnet Deployment:** `01a4e8d3df24cf23fbc06813ca01f4c7bb920e54d3e8ad6f59b6bf73082fa2c9`

---

## 🛠️ How to Compile & Run Locally

### Prerequisites
- **Node.js:** v18+
- **Docker:** for running the local Midnight sandbox environment
- **Compact Compiler:** installed and available in your environment path

### 1. Build and Compile the Compact Contract
To compile the ZK circuit and generate contract bindings:
```bash
cd contract
compact compile src/election.compact
```

#### Successful Compile Output:
```bash
$ compact compile src/election.compact
Compiling src/election.compact...
Circuits compiled successfully:
  - castVote
  - closeElection
Prover & verifier keys generated in contract/src/managed/election/keys/
ZKIR files written in contract/src/managed/election/zkir/
TypeScript bindings written in contract/src/managed/election/contract/
```

### 2. Run the Test Suite
To verify smart contract logic and witnesses:
```bash
cd contract
npm run test
```

#### Successful Test Execution:
```
 RUN  v4.1.10 C:/Desktop/Private election system/contract

 ✓ src/election.test.ts (6 tests) 25ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  11:52:10
   Duration  704ms
```

### 3. Run the Next.js Web App
Install all dependencies and run the Next.js development server:
```bash
# From the root workspace directory
npm install
npm run dev -w dapp
```
Open `http://localhost:3000` to access the dApp.

---

## 📋 Submission Checklist (Proof of Accomplishment)

- [x] **Toolchain & Compiler Verification**: Verified using `compact compile`.
- [x] **Passing Test Suite**: Executed using `vitest` under the `contract/` workspace.
- [x] **Generated `managed/` Directory**: Circuits, proving keys, and verification keys checked in.
- [x] **Deployed Contract Address**: Visible contract address deployed to Preprod Testnet.
- [x] **Product Idea**: Outlined in the README.
- [x] **State Separation**: Detailed explanations for Public State vs. Private Witness provided.
- [x] **Meaningful Commits**: Staged and committed in 5 distinct milestones.
