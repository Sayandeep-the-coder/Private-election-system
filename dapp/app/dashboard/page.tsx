'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Shield, ArrowLeft, Loader2, BarChart3, CheckCircle2, ShieldCheck, Database, RefreshCw, Lock, AlertCircle, Unlock, Search, Sun, Moon
} from 'lucide-react';
import { createPatchedPublicDataProvider } from '../../lib/midnight';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { queryElectionState } from '../../lib/election';
import { useTheme } from '../../context/ThemeContext';
import { NETWORK_ENDPOINTS, type MidnightNetwork } from '../../lib/network-config';

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme();
  const [contractAddress, setContractAddress] = useState<string>('');
  const [network, setNetwork] = useState<string>('preview');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live Ledger State
  const [ledgerState, setLedgerState] = useState<any | null>(null);
  const [optionsList, setOptionsList] = useState<string[]>([]);
  const [tallies, setTallies] = useState<number[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [nullifiersList, setNullifiersList] = useState<string[]>([]);

  // Polling Config
  const [isLive, setIsLive] = useState<boolean>(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);



  const fetchLedger = async (addr: string, netToUse?: string) => {
    // 1. Resolve network and indexer endpoints
    const activeNet = (netToUse || network) as MidnightNetwork;
    setNetworkId(activeNet as any);
    const endpoints = NETWORK_ENDPOINTS[activeNet] || NETWORK_ENDPOINTS.preview;
    const providers = {
      publicDataProvider: createPatchedPublicDataProvider(endpoints.http, endpoints.ws)
    };

    try {
      const state = await queryElectionState(providers, addr);
      if (!state) {
        throw new Error('Election contract not found. Verify address and network.');
      }
      setLedgerState(state);

      // Parse Candidates
      const parsedOptions = state.pollOptions.split(',').map((o: string) => o.trim()).filter((o: string) => o.length > 0);
      setOptionsList(parsedOptions);

      // Parse Tallies
      let sum = 0;
      const parsedTallies = parsedOptions.map((_, idx) => {
        const optionKey = BigInt(idx);
        const count = state.tallies.member(optionKey)
          ? Number(state.tallies.lookup(optionKey))
          : 0;
        sum += count;
        return count;
      });
      setTallies(parsedTallies);
      setTotalVotes(sum);

      // Parse Nullifiers
      const nullifiers: string[] = [];
      for (const nul of state.nullifiers) {
        nullifiers.push(Buffer.from(nul).toString('hex'));
      }
      setNullifiersList(nullifiers);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch ledger state');
      setIsLive(false);
    }
  };

  const handleConnect = async () => {
    if (!contractAddress.trim()) return;
    setConnecting(true);
    setError(null);
    await fetchLedger(contractAddress.trim());
    setConnecting(false);
    setIsLive(true);
  };

  // Read URL query parameters on mount to auto-inspect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const addr = params.get('address');
      const net = params.get('network');
      
      if (addr) {
        setContractAddress(addr);
        if (net) {
          setNetwork(net);
        }
        
        const autoInspect = async () => {
          setConnecting(true);
          setError(null);
          await fetchLedger(addr, net || network);
          setConnecting(false);
          setIsLive(true);
        };
        autoInspect();
      }
    }
  }, []);

  useEffect(() => {
    if (isLive && contractAddress.trim()) {
      pollIntervalRef.current = setInterval(() => {
        fetchLedger(contractAddress.trim());
      }, 5000); // Poll every 5s
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isLive, contractAddress]);

  // Audit calculations
  const totalNullifiers = nullifiersList.length;
  const isAuditVerified = totalVotes === totalNullifiers && (totalVotes > 0 || totalNullifiers === 0);

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
              <span className="text-muted text-sm font-medium">Dashboard & Audit</span>
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
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-650 font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Standings Polling
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-10">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-normal text-ink tracking-tight mb-2">Audit Dashboard</h1>
          <p className="text-sm text-body leading-relaxed">
            Inspect the live cryptographic standing of any ShadowVote contract on-chain.
          </p>
        </div>

        {/* Step 1: Connect to contract */}
        <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
          <h2 className="text-base font-bold text-ink mb-4 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">1</span>
            Query Election Address
          </h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="grow relative">
              <input
                type="text"
                placeholder="Election contract address (hex)"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-xl pl-4 pr-10 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <select
              value={network}
              onChange={(e) => {
                setNetwork(e.target.value);
                setIsLive(false);
                setLedgerState(null);
              }}
              className="bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="preview">Preview Testnet</option>
              <option value="preprod">Preprod Testnet</option>
              <option value="undeployed">Local Testnet</option>
            </select>
            <button
              onClick={handleConnect}
              disabled={connecting || !contractAddress}
              className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Inspect Ledger
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl">{error}</p>
          )}
        </section>

        {ledgerState && (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Live Tally View */}
            <div className="md:col-span-2 space-y-6">
              {/* Question card */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] text-muted uppercase tracking-widest font-mono font-bold">Question / Proposal</span>
                  {ledgerState.votingClosed ? (
                    <span className="flex items-center gap-1 bg-surface-strong border border-hairline text-muted px-3 py-1 rounded-full text-[9px] font-bold uppercase font-mono">
                      <Lock className="w-2.5 h-2.5" /> Closed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase font-mono">
                      <Unlock className="w-2.5 h-2.5" /> Active
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-ink leading-snug">{ledgerState.pollQuestion}</h3>
              </div>

              {/* Progress Counters */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Live Standings
                  </h4>
                  <span className="text-xs text-ink font-mono font-bold">Total Ballots: {totalVotes}</span>
                </div>

                <div className="space-y-6">
                  {optionsList.map((option, idx) => {
                    const count = tallies[idx] || 0;
                    const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-ink">{option}</span>
                          <span className="font-mono text-xs text-muted">
                            {count} {count === 1 ? 'vote' : 'votes'} ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-surface-strong rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cryptographic Audit panel */}
            <div className="space-y-6">
              {/* Audit status badge */}
              <div className={`p-6 rounded-[24px] border flex flex-col items-center text-center gap-4 ${
                isAuditVerified 
                  ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' 
                  : 'border-hairline bg-canvas shadow-sm'
              }`}>
                <ShieldCheck className={`w-12 h-12 ${isAuditVerified ? 'text-emerald-600' : 'text-muted'}`} />
                <div>
                  <h3 className="text-base font-bold text-ink">Cryptographic Audit</h3>
                  {isAuditVerified ? (
                    <span className="text-[10px] text-emerald-650 font-bold block mt-1 font-mono tracking-wider">VERIFIED INTEGRITY</span>
                  ) : (
                    <span className="text-[10px] text-muted block mt-1 font-mono">No ballots cast yet</span>
                  )}
                </div>
                <p className="text-xs text-body leading-relaxed">
                  Every vote matches a corresponding nullifier. Double voting is mathematically blocked.
                </p>
              </div>

              {/* spent nullifiers set */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm flex flex-col h-72">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2 shrink-0">
                  <Database className="w-3.5 h-3.5 text-primary" /> Nullifiers Set ({totalNullifiers})
                </h4>

                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                  {nullifiersList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted font-mono">
                      No nullifiers recorded.
                    </div>
                  ) : (
                    nullifiersList.map((nul, idx) => (
                      <div key={idx} className="p-2 bg-surface-soft border border-hairline rounded text-[10px] font-mono text-ink truncate select-all">
                        {nul}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
