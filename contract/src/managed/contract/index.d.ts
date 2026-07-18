import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  voterSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  merklePath(context: __compactRuntime.WitnessContext<Ledger, PS>,
             leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                         path: { sibling: { field: bigint },
                                                 goes_left: boolean
                                               }[]
                                       }];
  adminSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choiceIdx_0: bigint,
           electionId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeElection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choiceIdx_0: bigint,
           electionId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeElection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveAdminKey(sk_0: Uint8Array): Uint8Array;
  calculateCommitment(sk_0: Uint8Array): Uint8Array;
  calculateNullifier(sk_0: Uint8Array, electionId_0: Uint8Array): Uint8Array;
  hashLeaf(leaf_0: Uint8Array): bigint;
  hashSiblings(left_0: bigint, right_0: bigint): bigint;
}

export type Circuits<PS> = {
  deriveAdminKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  calculateCommitment(context: __compactRuntime.CircuitContext<PS>,
                      sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  calculateNullifier(context: __compactRuntime.CircuitContext<PS>,
                     sk_0: Uint8Array,
                     electionId_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  hashLeaf(context: __compactRuntime.CircuitContext<PS>, leaf_0: Uint8Array): __compactRuntime.CircuitResults<PS, bigint>;
  hashSiblings(context: __compactRuntime.CircuitContext<PS>,
               left_0: bigint,
               right_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  castVote(context: __compactRuntime.CircuitContext<PS>,
           choiceIdx_0: bigint,
           electionId_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  closeElection(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly pollQuestion: string;
  readonly pollOptions: string;
  readonly allowlistRoot: bigint;
  readonly adminKeyHash: Uint8Array;
  readonly votingClosed: boolean;
  tallies: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): bigint;
    [Symbol.iterator](): Iterator<[bigint, bigint]>
  };
  nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               _question_0: string,
               _options_0: string,
               _adminKeyHash_0: Uint8Array,
               _allowlistRoot_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
