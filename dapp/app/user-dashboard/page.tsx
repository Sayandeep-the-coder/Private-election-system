'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, ArrowLeft, Wallet, LogOut, Vote, Users, Lock, Unlock, Calendar, 
  Hash, Copy, Check, CheckCircle2, AlertTriangle, Loader2, Activity, ExternalLink, Trash2, Sun, Moon
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';

import { queryElectionState } from '../../lib/election';
import { createPatchedPublicDataProvider } from '../../lib/midnight';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { useTheme } from '../../context/ThemeContext';
import { NETWORK_ENDPOINTS, type MidnightNetwork } from '../../lib/network-config';

interface ActivityItem {
  id: string;
  type: 'vote' | 'deploy' | 'close';
  electionAddress: string;
  question: string;
  details?: string;
  timestamp: number;
  network: string;
  userAddress: string;
}

interface ElectionStatus {
  address: string;
  votingClosed: boolean;
  loading: boolean;
}

export default function UserDashboard() {
  const { theme, toggleTheme } = useTheme();
  const { session, network, setNetwork, connect, disconnect, wallets, connecting } = useWallet();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [electionStatuses, setElectionStatuses] = useState<Record<string, ElectionStatus>>({});

  useEffect(() => {
    loadActivity();
  }, [session]);

  const loadActivity = () => {
    if (typeof window === 'undefined') return;
    const activityStr = localStorage.getItem('shadowvote_activity') || '[]';
    try {
      const parsed: ActivityItem[] = JSON.parse(activityStr);
      // Filter activities to only match the current connected wallet address if connected
      const filtered = session 
        ? parsed.filter(item => item.userAddress === session.unshieldedAddress)
        : [];
      setActivities(filtered);
      
      // Load live status for unique elections
      fetchElectionStatuses(filtered);
    } catch (e) {
      console.error('Failed to parse activity logs:', e);
    }
  };

  const fetchElectionStatuses = async (items: ActivityItem[]) => {
    // Get unique election addresses and their networks
    const uniqueElections = Array.from(new Set(items.map(item => item.electionAddress))).map(addr => {
      const match = items.find(item => item.electionAddress === addr);
      return {
        address: addr,
        network: match?.network || 'preview'
      };
    });

    // Initialize loading state
    const initialStatuses: Record<string, ElectionStatus> = {};
    uniqueElections.forEach(el => {
      initialStatuses[el.address] = {
        address: el.address,
        votingClosed: false,
        loading: true
      };
    });
    setElectionStatuses(initialStatuses);



    // Query each election state in parallel
    await Promise.all(uniqueElections.map(async (el) => {
      try {
        setNetworkId(el.network as any);
        const endpoints = NETWORK_ENDPOINTS[el.network as MidnightNetwork] || NETWORK_ENDPOINTS.preview;
        const providers = {
          publicDataProvider: createPatchedPublicDataProvider(endpoints.http, endpoints.ws)
        };

        const state = await queryElectionState(providers, el.address);
        setElectionStatuses(prev => ({
          ...prev,
          [el.address]: {
            address: el.address,
            votingClosed: state ? state.votingClosed : false,
            loading: false
          }
        }));
      } catch (err) {
        console.error(`Failed to fetch status for election ${el.address}:`, err);
        setElectionStatuses(prev => ({
          ...prev,
          [el.address]: {
            address: el.address,
            votingClosed: false,
            loading: false
          }
        }));
      }
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearHistory = () => {
    if (!window.confirm('Are you sure you want to clear your local activity history? This cannot be undone.')) {
      return;
    }
    if (typeof window !== 'undefined' && session) {
      const activityStr = localStorage.getItem('shadowvote_activity') || '[]';
      try {
        const parsed: ActivityItem[] = JSON.parse(activityStr);
        // Remove activities matching the current user
        const remaining = parsed.filter(item => item.userAddress !== session.unshieldedAddress);
        localStorage.setItem('shadowvote_activity', JSON.stringify(remaining));
        setActivities([]);
        setElectionStatuses({});
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Compile unique election list from activity feed
  const uniqueParticipatedElections = React.useMemo(() => {
    const list: Array<{ address: string; question: string; network: string; type: string }> = [];
    const seen = new Set<string>();

    activities.forEach(item => {
      if (!seen.has(item.electionAddress)) {
        seen.add(item.electionAddress);
        list.push({
          address: item.electionAddress,
          question: item.type === 'close' ? 'Closed Election' : item.question,
          network: item.network,
          type: item.type
        });
      }
    });

    return list;
  }, [activities]);

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
              <span className="text-muted text-sm font-medium">User Dashboard</span>
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
            <div className="flex items-center gap-2 text-xs text-muted font-mono hidden sm:flex">
              <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
              Voter Registry Logs
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-10">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-normal text-ink tracking-tight mb-2">User Dashboard</h1>
          <p className="text-sm text-body leading-relaxed">
            Review your voting activity logs and track the statuses of elections you have participated in.
          </p>
        </div>

        {!session ? (
          /* Disconnected State */
          <div className="max-w-md mx-auto text-center py-16 px-6 border border-hairline bg-canvas rounded-[24px] shadow-sm">
            <Wallet className="w-16 h-16 text-muted mx-auto mb-4" />
            <h2 className="text-xl font-bold text-ink mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-body mb-6 leading-relaxed">
              You must connect your Midnight wallet to inspect your dashboard, review past votes, and track election deployments.
            </p>
            <button
              onClick={connect}
              className="w-full bg-primary hover:bg-primary-active text-on-primary font-semibold text-sm py-2.5 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
          </div>
        ) : (
          /* Connected State Layout */
          <div className="grid lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Wallet details */}
            <div className="space-y-6 lg:col-span-1">
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Connected Wallet
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-muted font-mono uppercase tracking-wider mb-1">
                      Unshielded Address
                    </label>
                    <div className="flex items-center justify-between gap-2 bg-surface-soft border border-hairline p-2.5 rounded-xl">
                      <span className="font-mono text-xs text-ink truncate select-all">
                        {session.unshieldedAddress}
                      </span>
                      <button
                        onClick={() => handleCopy(session.unshieldedAddress, 'address')}
                        className="hover:bg-hairline p-1.5 rounded transition-colors text-muted hover:text-ink cursor-pointer shrink-0"
                      >
                        {copiedId === 'address' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-muted font-mono uppercase tracking-wider mb-1">
                        Active Network
                      </label>
                      <select
                        value={network}
                        onChange={(e) => setNetwork(e.target.value as MidnightNetwork)}
                        className="w-full bg-surface-soft border border-hairline p-2 rounded-xl text-xs font-semibold text-ink focus:outline-none focus:ring-1 focus:ring-primary font-mono capitalize cursor-pointer"
                      >
                        <option value="preview">Preview</option>
                        <option value="preprod">Preprod</option>
                        <option value="undeployed">Local</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted font-mono uppercase tracking-wider mb-1">
                        Connection Status
                      </label>
                      {connecting ? (
                        <div className="bg-surface-soft border border-hairline p-2 rounded-xl text-xs font-semibold text-primary flex items-center gap-1.5 font-mono animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Reconnecting
                        </div>
                      ) : (
                        <div className="bg-surface-soft border border-hairline p-2 rounded-xl text-xs font-semibold text-emerald-600 flex items-center gap-1.5 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Online
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-hairline flex gap-2">
                    <button
                      onClick={clearHistory}
                      disabled={activities.length === 0}
                      className="grow border border-hairline hover:bg-surface-soft disabled:opacity-50 text-xs text-muted hover:text-rose-600 px-3 py-2 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear History
                    </button>
                    <button
                      onClick={disconnect}
                      className="border border-hairline hover:bg-surface-soft text-xs text-muted hover:text-ink px-3 py-2 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick statistics */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Voter Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface-soft border border-hairline rounded-[16px] text-center">
                    <div className="text-3xl font-normal text-primary font-mono">{activities.filter(a => a.type === 'vote').length}</div>
                    <div className="text-[10px] text-muted uppercase tracking-widest font-mono mt-1">Votes Cast</div>
                  </div>
                  <div className="p-4 bg-surface-soft border border-hairline rounded-[16px] text-center">
                    <div className="text-3xl font-normal text-primary font-mono">{activities.filter(a => a.type === 'deploy').length}</div>
                    <div className="text-[10px] text-muted uppercase tracking-widest font-mono mt-1">Deployed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Activity History & Participated Elections */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Participated Elections Overview */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2">
                  <Vote className="w-5 h-5 text-primary" />
                  My Elections List
                </h3>
                
                {uniqueParticipatedElections.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-hairline rounded-xl">
                    <AlertTriangle className="w-10 h-10 text-muted mx-auto mb-2" />
                    <p className="text-xs text-muted font-mono">No election history records.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {uniqueParticipatedElections.map((el) => {
                      const status = electionStatuses[el.address];
                      const isClosed = status ? status.votingClosed : false;
                      const loadingStatus = status ? status.loading : true;

                      return (
                        <div key={el.address} className="p-5 bg-canvas border border-hairline rounded-[24px] flex flex-col justify-between hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider font-bold">
                                {el.network}
                              </span>
                              
                              {loadingStatus ? (
                                <span className="flex items-center gap-1 text-[10px] text-muted font-mono">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Querying...
                                </span>
                              ) : isClosed ? (
                                <span className="flex items-center gap-1 bg-surface-strong border border-hairline text-muted px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono">
                                  <Lock className="w-2.5 h-2.5" /> Closed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono">
                                  <Unlock className="w-2.5 h-2.5" /> Active
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-ink text-sm line-clamp-2 leading-snug mb-3">
                              {el.question}
                            </h4>
                          </div>

                          <div className="space-y-3 pt-3 border-t border-hairline mt-2">
                            <div className="flex items-center justify-between text-[10px] text-muted font-mono">
                              <span className="truncate max-w-[150px]">Addr: {el.address}</span>
                              <button 
                                onClick={() => handleCopy(el.address, el.address)}
                                className="hover:text-ink"
                              >
                                {copiedId === el.address ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>

                            <Link
                              href={`/dashboard?address=${el.address}&network=${el.network}`}
                              className="w-full bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Inspect Live Tally
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chronological Activity Feed */}
              <div className="p-6 rounded-[24px] border border-hairline bg-canvas shadow-sm">
                <h3 className="text-base font-bold text-ink mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Chronological Activity
                </h3>

                {activities.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-hairline rounded-xl">
                    <Calendar className="w-12 h-12 text-muted mx-auto mb-3" />
                    <p className="text-sm text-muted font-mono mb-1">No transaction activity logged.</p>
                    <p className="text-xs text-body max-w-xs mx-auto leading-relaxed">
                      Your on-chain deployments, votes, and status modifications will appear here when performed.
                    </p>
                  </div>
                ) : (
                  <div className="relative border-l border-hairline ml-4 pl-6 space-y-6 py-2">
                    {activities.map((item) => {
                      const isVote = item.type === 'vote';
                      const isDeploy = item.type === 'deploy';
                      const isClose = item.type === 'close';

                      return (
                        <div key={item.id} className="relative">
                          {/* Event Icon/Marker */}
                          <div className={`absolute -left-[37px] top-0.5 p-1.5 rounded-full border bg-canvas ${
                            isVote 
                              ? 'border-primary text-primary shadow-sm' 
                              : isDeploy 
                              ? 'border-indigo-650 text-indigo-650'
                              : 'border-rose-600 text-rose-600'
                          }`}>
                            {isVote && <Vote className="w-3.5 h-3.5" />}
                            {isDeploy && <Users className="w-3.5 h-3.5" />}
                            {isClose && <Lock className="w-3.5 h-3.5" />}
                          </div>

                          {/* Event body */}
                          <div className="bg-canvas border border-hairline rounded-[24px] p-5 space-y-2 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-hairline pb-2 mb-2">
                              <h4 className="font-bold text-ink text-sm leading-snug">
                                {isVote && 'Voted in Poll'}
                                {isDeploy && 'Deployed New Election'}
                                {isClose && 'Closed Election Tally'}
                              </h4>
                              <span className="text-[10px] text-muted font-mono">
                                {new Date(item.timestamp).toLocaleString()}
                              </span>
                            </div>

                            <p className="text-xs text-ink font-semibold">
                              {item.question}
                            </p>

                            {item.details && (
                              <p className="text-xs text-body bg-surface-soft border border-hairline p-2.5 rounded-xl font-mono">
                                {isVote ? `Ballot Cast Choice: ${item.details}` : item.details}
                              </p>
                            )}

                            <div className="flex items-center justify-between gap-4 pt-2 text-[10px] font-mono text-muted">
                              <span className="truncate max-w-[200px] sm:max-w-sm">
                                Contract: {item.electionAddress}
                              </span>
                              <span className="uppercase tracking-widest text-[9px] font-bold">
                                {item.network}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
