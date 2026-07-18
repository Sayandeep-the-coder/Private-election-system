'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, ArrowLeft, Loader2, Sparkles, Key, Vote, CheckCircle2, AlertTriangle, Eye, EyeOff, Clipboard, Check, Wallet, Sun, Moon
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { type MidnightNetwork } from '../../lib/midnight';
import { useTheme } from '../../context/ThemeContext';
import { castVote, queryElectionState } from '../../lib/election';
import { pureCircuits } from '../../../contract/src/index';
import { buildMerkleTree } from '../../lib/merkle';

const fromHex = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const pairs = clean.match(/.{1,2}/g);
  if (!pairs) return new Uint8Array(0);
  return new Uint8Array(pairs.map((byte: string) => parseInt(byte, 16)));
};

export default function VoterPage() {
  const { theme, toggleTheme } = useTheme();
  // Global Wallet State
  const {
    wallets,
    selectedWalletIndex,
    setSelectedWalletIndex,
    network,
    setNetwork,
    session,
    connecting,
    walletError,
    connect
  } = useWallet();

  // Election Connection State
  const [contractAddress, setContractAddress] = useState<string>('');
  const [loadingElection, setLoadingElection] = useState<boolean>(false);
  const [electionError, setElectionError] = useState<string | null>(null);
  const [electionState, setElectionState] = useState<any | null>(null);
  const [optionsList, setOptionsList] = useState<string[]>([]);

  // Voters Database Text State (Public list of commitments)
  const [commitmentsListText, setCommitmentsListText] = useState<string>('');
  const [showCommitmentsInput, setShowCommitmentsInput] = useState<boolean>(false);

  // Voter Auth & Vote State
  const [voterSecretHex, setVoterSecretHex] = useState<string>('');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [voterCommitmentHex, setVoterCommitmentHex] = useState<string>('');
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number | null>(null);
  const [voting, setVoting] = useState<boolean>(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState<boolean>(false);

  // Computed local Merkle path
  const [merklePath, setMerklePath] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Automatically load saved commitments database from localStorage when contract address changes
  useEffect(() => {
    if (contractAddress.trim()) {
      const saved = localStorage.getItem(`shadowvote_commitments_${contractAddress.trim()}`);
      if (saved) {
        setCommitmentsListText(saved);
        setShowCommitmentsInput(false);
      } else {
        setCommitmentsListText('');
        setShowCommitmentsInput(true);
      }
    }
  }, [contractAddress]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleConnect = async () => {
    await connect();
  };

  const handleFetchElection = async () => {
    if (!session || !contractAddress.trim()) return;
    setLoadingElection(true);
    setElectionError(null);
    setElectionState(null);
    setIsEligible(null);
    try {
      const state = await queryElectionState(session.providers, contractAddress.trim());
      if (!state) {
        setElectionError('Election not found at this address.');
        return;
      }
      setElectionState(state);
      setOptionsList(state.pollOptions.split(',').map((o: string) => o.trim()).filter((o: string) => o.length > 0));
    } catch (err: any) {
      setElectionError(err.message || 'Failed to retrieve election details');
    } finally {
      setLoadingElection(false);
    }
  };

  const handleCheckEligibility = async () => {
    if (!electionState || !voterSecretHex.trim()) return;
    setCheckingEligibility(true);
    setIsEligible(null);
    setMerklePath(null);
    try {
      const secretBytes = fromHex(voterSecretHex.trim());
      if (secretBytes.length !== 32) {
        throw new Error('Voter key must be exactly 32 bytes (64 hex characters)');
      }

      // Compute commitment off-chain using the pure circuit
      const commitment = pureCircuits.calculateCommitment(secretBytes);
      const computedCommitmentHex = Array.from(commitment).map(b => b.toString(16).padStart(2, '0')).join('');
      setVoterCommitmentHex(computedCommitmentHex);

      // Parse public commitments list
      let parsedCommitments: Uint8Array[] = [];
      if (!commitmentsListText.trim()) {
        throw new Error('Commitments list is empty. Please paste the voter commitments list from the Admin.');
      }

      try {
        const parsed = JSON.parse(commitmentsListText.trim());
        if (Array.isArray(parsed)) {
          parsedCommitments = parsed
            .map((item: any) => {
              const hex = typeof item === 'string' ? item : item.commitmentHex;
              return fromHex(hex);
            })
            .filter(bytes => bytes.length === 32);
        }
      } catch (jsonErr) {
        // Fallback: Comma or newline separated raw commitments
        const parts = commitmentsListText.trim().split(/[\s,]+/);
        parsedCommitments = parts
          .map(hex => fromHex(hex))
          .filter(bytes => bytes.length === 32);
      }

      if (parsedCommitments.length === 0) {
        throw new Error('No valid 32-byte hex commitments found in the input list.');
      }

      // Find the index of the voter's commitment in the public allowlist list
      const voterIndex = parsedCommitments.findIndex(c => {
        const hex = Array.from(c).map(b => b.toString(16).padStart(2, '0')).join('');
        return hex === computedCommitmentHex;
      });

      if (voterIndex === -1) {
        setIsEligible(false);
        return;
      }

      // Rebuild the Merkle tree off-chain to generate the path
      const tree = buildMerkleTree(parsedCommitments);
      
      // Verify that the tree root matches the contract's on-chain allowlist root!
      const onChainRoot = electionState.allowlistRoot;
      if (tree.root !== onChainRoot) {
        throw new Error(`The Merkle root of the commitments list (${tree.root}) does not match the on-chain election allowlist root (${onChainRoot}). Please verify you have the correct list of voters.`);
      }

      const path = tree.getPath(voterIndex);
      setMerklePath(path);
      setIsEligible(true);
    } catch (err: any) {
      alert(`Eligibility verification failed: ${err.message}`);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleVote = async () => {
    if (!session || !electionState || selectedChoiceIdx === null || !voterSecretHex.trim() || !merklePath) return;
    setVoting(true);
    setVoteError(null);
    setVoteSuccess(false);
    try {
      const secretBytes = fromHex(voterSecretHex.trim());
      const electionIdBytes = fromHex(contractAddress.trim());

      await castVote(
        session,
        contractAddress.trim(),
        secretBytes,
        selectedChoiceIdx,
        electionIdBytes,
        merklePath
      );

      // Save activity to localStorage
      if (typeof window !== 'undefined') {
        const activityStr = localStorage.getItem('shadowvote_activity') || '[]';
        try {
          const activity = JSON.parse(activityStr);
          activity.unshift({
            id: Date.now().toString(),
            type: 'vote',
            electionAddress: contractAddress.trim(),
            question: electionState.pollQuestion,
            details: optionsList[selectedChoiceIdx] || `Candidate #${selectedChoiceIdx + 1}`,
            timestamp: Date.now(),
            network: session.networkId,
            userAddress: session.unshieldedAddress
          });
          localStorage.setItem('shadowvote_activity', JSON.stringify(activity));
        } catch (e) {
          console.error('Failed to update activity log:', e);
        }
      }

      setVoteSuccess(true);
    } catch (err: any) {
      setVoteError(err.message || 'Transaction rejected or proving failed');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-body pb-20 relative font-sans">
      {/* Top Nav (Light) */}
      <header className="border-b border-hairline bg-canvas h-16 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-muted hover:text-ink transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-extrabold tracking-tight text-ink text-sm">shadowvote</span>
              <span className="text-hairline font-light">/</span>
              <span className="text-muted text-sm font-medium">Voter Booth</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="border border-hairline hover:bg-surface-strong p-2 rounded-full text-muted hover:text-ink transition-colors cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <div className="text-xs font-mono text-muted hidden sm:block">
              Off-Chain ZK Prover
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-10">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-normal text-ink tracking-tight mb-2">Voter Booth</h1>
          <p className="text-sm text-body leading-relaxed">
            Verify your registration and cast your anonymous ballot safely. Your vote is mathematically decoupled from your address on-chain.
          </p>
        </div>

        {/* Step 1: Wallet Connection */}
        <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
          <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">1</span>
            Connect Wallet
          </h2>

          {!session ? (
            <div>
              {wallets.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <div>
                    No Midnight wallet extensions detected. Please install 1AM Wallet or Lace, unlock it, and refresh.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    className="grow bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    onChange={(e) => setSelectedWalletIndex(Number(e.target.value))}
                    value={selectedWalletIndex}
                  >
                    {wallets.map((w, idx) => (
                      <option key={w.name} value={idx}>{w.name}</option>
                    ))}
                  </select>

                  <select
                    className="bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    onChange={(e) => setNetwork(e.target.value as MidnightNetwork)}
                    value={network}
                  >
                    <option value="preview">Preview Testnet</option>
                    <option value="preprod">Preprod Testnet</option>
                    <option value="undeployed">Local Testnet</option>
                  </select>

                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                    Connect
                  </button>
                </div>
              )}
              {walletError && (
                <p className="mt-3 text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl">{walletError}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-surface-soft border border-hairline rounded-xl">
              <div className="text-xs">
                <span className="text-muted block text-[10px] uppercase font-mono tracking-wider mb-0.5">Connected Address</span>
                <span className="font-mono text-ink font-semibold">{session.unshieldedAddress}</span>
              </div>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-[10px] uppercase font-mono font-bold">
                {session.networkId}
              </span>
            </div>
          )}
        </section>

        {/* Step 2: Access Election */}
        {session && (
          <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
            <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">2</span>
              Enter Election Contract Address
            </h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                placeholder="Election contract address (hex)"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                disabled={loadingElection || !!electionState}
                className="grow bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-surface-soft disabled:text-muted font-mono"
              />

              {!electionState ? (
                <button
                  onClick={handleFetchElection}
                  disabled={loadingElection || !contractAddress.trim()}
                  className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingElection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Join Election'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setElectionState(null);
                    setIsEligible(null);
                    setMerklePath(null);
                  }}
                  className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-5 py-2.5 rounded-full transition-colors cursor-pointer"
                >
                  Change Election
                </button>
              )}
            </div>

            {electionError && (
              <p className="mt-3 text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl">{electionError}</p>
            )}

            {electionState && (
              <div className="mt-6 border-t border-hairline pt-6 animate-in fade-in duration-300">
                <div className="p-5 bg-surface-soft border border-hairline rounded-xl space-y-3">
                  <div>
                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold font-mono">Question / Poll Topic</span>
                    <h3 className="text-lg font-bold text-ink mt-0.5">{electionState.pollQuestion}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-hairline">
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold font-mono block">Allowlist Merkle Root</span>
                      <span className="font-mono text-xs text-primary truncate block mt-0.5">{electionState.allowlistRoot.toString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold font-mono block">Status</span>
                      <span className={`text-xs font-bold block mt-0.5 ${electionState.votingClosed ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {electionState.votingClosed ? 'Closed' : 'Open for Voting'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 3: Verify Eligibility */}
        {electionState && !electionState.votingClosed && (
          <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
            <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">3</span>
              Authenticate & Verify Registration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted font-semibold uppercase tracking-wider mb-2 font-mono">Your Private Secret Key</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={voterSecretHex}
                    onChange={(e) => setVoterSecretHex(e.target.value)}
                    disabled={isEligible === true}
                    placeholder="Voter secret key (e.g. 9b4d8...)"
                    className="w-full bg-canvas border border-hairline rounded-xl pl-4 pr-10 py-3 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono disabled:bg-surface-soft disabled:text-muted"
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    type="button"
                    className="absolute right-3 top-3 text-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Commitments List Input */}
              {showCommitmentsInput && (
                <div className="animate-in fade-in duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs text-muted font-semibold uppercase tracking-wider font-mono">Eligible Voters commitments</label>
                    <button
                      onClick={() => setShowCommitmentsInput(false)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Hide Input
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={commitmentsListText}
                    onChange={(e) => setCommitmentsListText(e.target.value)}
                    placeholder='[{"name":"Voter A","commitmentHex":"a4f9b..."}, {"name":"Voter B","commitmentHex":"b9c2a..."}]'
                    className="w-full bg-canvas border border-hairline rounded-xl p-3 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                  />
                  <p className="text-[10px] text-muted leading-relaxed mt-1.5">
                    Required for the Voter Booth to compute your Merkle path locally in zero-knowledge. Ask the organizer for this list if it isn't automatically loaded.
                  </p>
                </div>
              )}

              {!showCommitmentsInput && (
                <div className="flex justify-between items-center text-xs bg-surface-soft border border-hairline rounded-xl px-4 py-3">
                  <span className="text-muted font-medium">Allowlist Database loaded automatically (localStorage)</span>
                  <button
                    onClick={() => setShowCommitmentsInput(true)}
                    className="text-primary hover:text-primary-active font-semibold cursor-pointer"
                  >
                    Edit List
                  </button>
                </div>
              )}

              {isEligible === null && (
                <button
                  onClick={handleCheckEligibility}
                  disabled={checkingEligibility || !voterSecretHex.trim()}
                  className="w-full bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {checkingEligibility ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify Eligibility'}
                </button>
              )}

              {isEligible === true && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex flex-col gap-2">
                  <div className="flex gap-2 items-center font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Eligible to vote
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono leading-relaxed mt-1 pt-2 border-t border-emerald-100 break-all">
                    <span className="font-bold block text-emerald-800 uppercase tracking-wider text-[9px] mb-0.5">Your Public Commitment Hash</span>
                    {voterCommitmentHex}
                  </div>
                </div>
              )}

              {isEligible === false && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <div>
                    <strong>Registration not found!</strong> Your secret key commitment is not in the allowlist. Make sure the admin has added your commitment to the allowlist.
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 4: Cast Shielded Ballot */}
        {isEligible === true && (
          <section className="p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500">
            <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">4</span>
              Cast Anonymous Ballot
            </h2>

            {!voteSuccess ? (
              <div className="space-y-6">
                <div>
                  <span className="block text-xs font-semibold text-muted uppercase tracking-wider mb-3">Candidates</span>
                  <div className="grid gap-2">
                    {optionsList.map((cand, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedChoiceIdx(idx)}
                        disabled={voting}
                        className={`w-full text-left p-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                          selectedChoiceIdx === idx
                            ? 'bg-primary/5 border-primary text-primary shadow-sm'
                            : 'bg-canvas border-hairline text-ink hover:border-zinc-300'
                        }`}
                      >
                        {cand}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleVote}
                  disabled={voting || selectedChoiceIdx === null}
                  className="w-full bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-sm font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {voting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Proving in Zero Knowledge (Generates local transaction proof)...
                    </>
                  ) : (
                    <>
                      <Vote className="w-4 h-4" />
                      Submit Shielded Ballot
                    </>
                  )}
                </button>

                {voteError && (
                  <p className="text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl leading-relaxed">{voteError}</p>
                )}
              </div>
            ) : (
              <div className="p-8 border border-emerald-200 bg-emerald-50 rounded-[24px] text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-pulse" />
                <div>
                  <h3 className="text-lg font-bold text-emerald-800">Ballot Cast Successfully!</h3>
                  <p className="text-xs text-emerald-700 leading-relaxed mt-2 max-w-md mx-auto">
                    Your zero-knowledge proof has been verified and recorded on the Midnight ledger. Your secret remains completely private and your choice is anonymously tabulated.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/user-dashboard"
                    className="inline-block bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-all cursor-pointer shadow-sm"
                  >
                    Go to My Dashboard
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
