import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { withWitnesses } from '@midnight-ntwrk/compact-js/effect/CompiledContract';
import { Contract, pureCircuits, ledger as decodeLedger } from '../../contract/src/index';
import type { MidnightSession } from './midnight';

export { pureCircuits };

const PRIVATE_STATE_ID = 'electionPrivateState';

export interface ElectionPrivateState {
  voterSecret?: Uint8Array;
  adminSecret?: Uint8Array;
  merklePath?: any;
}

// Define the witness callbacks
const contractWitnesses = {
  voterSecret: (ctx: any): [any, Uint8Array] => {
    return [ctx.privateState, ctx.privateState.voterSecret ?? new Uint8Array(32)];
  },
  merklePath: (ctx: any, leaf: Uint8Array): [any, any] => {
    if (!ctx.privateState.merklePath) {
      throw new Error('Pre-computed Merkle path not found in private state.');
    }
    return [ctx.privateState, ctx.privateState.merklePath];
  },
  adminSecret: (ctx: any): [any, Uint8Array] => {
    return [ctx.privateState, ctx.privateState.adminSecret ?? new Uint8Array(32)];
  },
};

const baseContract = CompiledContract.make('election', Contract as any);
const contractWithWitnesses = (withWitnesses as any)(baseContract, contractWitnesses);
export const CompiledElectionContract = (CompiledContract.withCompiledFileAssets as any)(
  contractWithWitnesses,
  '/zk/election'
) as any;

export async function joinElection(session: MidnightSession, contractAddress: string) {
  return findDeployedContract(session.providers, {
    contractAddress,
    compiledContract: CompiledElectionContract,
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function deployElection(
  session: MidnightSession,
  question: string,
  options: string,
  adminSecretKey: Uint8Array,
  allowlistRoot: bigint
): Promise<string> {
  // 1. Calculate admin public key hash off-chain using the pure circuit
  const adminKeyHash = pureCircuits.deriveAdminKey(adminSecretKey);

  // 2. Configure initial private state
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {
    adminSecret: adminSecretKey,
  });

  // 3. Deploy contract
  const deployed = await deployContract(session.providers, {
    compiledContract: CompiledElectionContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: { adminSecret: adminSecretKey },
    args: [question, options, adminKeyHash, allowlistRoot],
  });

  return deployed.deployTxData.public.contractAddress;
}

export async function castVote(
  session: MidnightSession,
  contractAddress: string,
  voterSecretKey: Uint8Array,
  choiceIdx: number,
  electionId: Uint8Array,
  merklePath: any
) {
  // 1. Set the contract address scope first
  session.providers.privateStateProvider.setContractAddress(contractAddress);

  // 2. Store the voter secret key and pre-computed path in private state
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {
    voterSecret: voterSecretKey,
    merklePath,
  });

  // 3. Fetch contract instance
  const contract = await joinElection(session, contractAddress);

  // 4. Call the castVote circuit
  await contract.callTx.castVote(BigInt(choiceIdx), electionId);
}

export async function closeElection(
  session: MidnightSession,
  contractAddress: string,
  adminSecretKey: Uint8Array
) {
  // 1. Set the contract address scope first
  session.providers.privateStateProvider.setContractAddress(contractAddress);

  // 2. Store the admin secret key in private state
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, {
    adminSecret: adminSecretKey,
  });

  // 3. Fetch contract instance
  const contract = await joinElection(session, contractAddress);

  // 4. Call closeElection
  await contract.callTx.closeElection();
}

export async function queryElectionState(providers: any, contractAddress: string) {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    return null;
  }
  return decodeLedger(contractState.data);
}
