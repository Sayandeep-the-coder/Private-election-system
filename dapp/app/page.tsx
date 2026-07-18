'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Shield, Users, CheckCircle, Vote, BarChart3, Database, Key, EyeOff, 
  RefreshCw, Copy, Check, Wallet, LogOut, LayoutDashboard, UserCheck, ArrowRight, Loader2, Sun, Moon
} from 'lucide-react';
import { pureCircuits } from '../lib/election';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import type { MidnightNetwork } from '../lib/midnight';

const toHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { 
    wallets, 
    selectedWalletIndex, 
    setSelectedWalletIndex, 
    network, 
    setNetwork, 
    session, 
    connecting, 
    walletError, 
    connect, 
    disconnect 
  } = useWallet();

  const [credentials, setCredentials] = React.useState<{ secret: string; commitment: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const [copiedCommitment, setCopiedCommitment] = React.useState(false);

  const generateKeys = () => {
    const secretBytes = crypto.getRandomValues(new Uint8Array(32));
    const commitmentBytes = pureCircuits.calculateCommitment(secretBytes);
    
    setCredentials({
      secret: toHex(secretBytes),
      commitment: toHex(commitmentBytes)
    });
    setCopiedSecret(false);
    setCopiedCommitment(false);
  };

  const copyToClipboard = (text: string, type: 'secret' | 'commitment') => {
    navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCommitment(true);
      setTimeout(() => setCopiedCommitment(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-body flex flex-col font-sans">
      {/* Top Nav (Light) */}
      <header className="border-b border-hairline bg-canvas h-16 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-extrabold text-lg text-ink tracking-tight font-sans">
                shadow<span className="font-light text-body">vote</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
              <Link href="/admin" className="hover:text-ink transition-colors">Admin Portal</Link>
              <Link href="/voter" className="hover:text-ink transition-colors">Voter Booth</Link>
              <Link href="/dashboard" className="hover:text-ink transition-colors">Audit & Tallies</Link>
              {session && <Link href="/user-dashboard" className="hover:text-ink transition-colors">My Dashboard</Link>}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="border border-hairline hover:bg-surface-strong p-2 rounded-full text-muted hover:text-ink transition-colors cursor-pointer"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {session ? (
              <div className="flex items-center gap-2 bg-surface-strong border border-hairline rounded-full pl-3 pr-1 py-1 text-xs">
                <span className="flex items-center gap-1.5 font-mono text-ink font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {session.unshieldedAddress.slice(0, 6)}...{session.unshieldedAddress.slice(-4)}
                </span>
                <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-mono font-bold capitalize">
                  {session.networkId}
                </span>
                <button
                  onClick={disconnect}
                  className="hover:bg-hairline p-1.5 rounded-full text-muted hover:text-rose-600 transition-colors cursor-pointer"
                  title="Disconnect Wallet"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={connecting || wallets.length === 0}
                className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-full transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section (Dark Editorial) */}
      <section className="bg-surface-dark text-on-dark py-24 flex flex-col justify-center relative overflow-hidden">
        {/* Subtle geometry grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#16181c_1px,transparent_1px),linear-gradient(to_bottom,#16181c_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />
        
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="bg-primary/25 border border-primary/30 text-primary px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider font-sans">
              Midnight Network Governance
            </span>
            <h1 className="text-5xl md:text-7xl font-normal tracking-tight leading-[1.05] text-white">
              Vote Freely.<br />Verify Publicly.<br />Reveal Nothing.
            </h1>
            <p className="text-base md:text-lg text-on-dark-soft max-w-xl font-normal leading-relaxed">
              ShadowVote is a privacy-preserving governance platform that enables organizations to conduct private, verifiable, and coercion-resistant voting using programmable zero-knowledge proofs.
            </p>
            
            {/* Wallet Panel */}
            <div className="pt-4 max-w-md">
              {session ? (
                <div className="flex items-center gap-4 bg-surface-dark-elevated border border-zinc-800 rounded-full p-2 pl-4">
                  <div className="flex-grow min-w-0">
                    <span className="text-[10px] text-zinc-500 block font-mono uppercase tracking-wider">Connected Session</span>
                    <span className="font-mono text-xs text-on-dark-soft block truncate">{session.unshieldedAddress}</span>
                  </div>
                  <Link
                    href="/user-dashboard"
                    className="bg-primary hover:bg-primary-active text-on-primary font-semibold text-xs px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    My Dashboard
                  </Link>
                </div>
              ) : (
                <div className="bg-surface-dark-elevated border border-zinc-800 rounded-[24px] p-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      Access Dashboard & Voter Booth
                    </h3>
                    <p className="text-xs text-on-dark-soft mt-1 leading-relaxed">
                      Connect your wallet (Lace or 1AM Wallet) to register, vote anonymously, and view transaction logs.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {wallets.length === 0 ? (
                      <div className="text-xs text-accent-yellow bg-amber-950/20 border border-amber-900/40 px-4 py-2.5 rounded-xl font-medium w-full text-center">
                        No wallet extensions detected.
                      </div>
                    ) : (
                      <>
                        <select
                          className="bg-surface-dark border border-zinc-800 rounded-full px-4 py-2.5 text-xs text-on-dark-soft focus:outline-none focus:ring-1 focus:ring-primary grow cursor-pointer"
                          value={selectedWalletIndex}
                          onChange={(e) => setSelectedWalletIndex(Number(e.target.value))}
                        >
                          {wallets.map((w, idx) => (
                            <option key={w.name} value={idx}>{w.name}</option>
                          ))}
                        </select>
                        <select
                          className="bg-surface-dark border border-zinc-800 rounded-full px-4 py-2.5 text-xs text-on-dark-soft focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          value={network}
                          onChange={(e) => setNetwork(e.target.value as MidnightNetwork)}
                        >
                          <option value="preview">Preview Testnet</option>
                          <option value="preprod">Preprod Testnet</option>
                          <option value="undeployed">Local Testnet</option>
                        </select>
                        <button
                          onClick={connect}
                          disabled={connecting}
                          className="bg-primary hover:bg-primary-active text-on-primary font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                          Connect
                        </button>
                      </>
                    )}
                  </div>
                  {walletError && (
                    <p className="text-xs text-rose-400 font-mono bg-rose-950/20 border border-rose-950/40 p-2.5 rounded-xl">{walletError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Floating mock-up card */}
          <div className="lg:col-span-5 hidden lg:block relative h-96">
            <div className="absolute right-0 top-0 w-80 bg-surface-dark-elevated border border-zinc-800 rounded-[24px] p-6 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Ballot Verification</span>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-900/30 text-[8px] px-1.5 py-0.5 rounded font-mono">ZK-PROOF VALID</span>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-zinc-800 rounded-full w-2/3" />
                <div className="h-3 bg-zinc-900 rounded-full w-full" />
                <div className="h-3 bg-zinc-900 rounded-full w-5/6" />
                <div className="h-6 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between px-3 text-[10px] font-mono text-primary mt-4">
                  <span>Nullifier Hash</span>
                  <span>f8c2e9d4...</span>
                </div>
              </div>
            </div>
            <div className="absolute left-0 bottom-4 w-72 bg-surface-dark-elevated border border-zinc-800 rounded-[24px] p-5 shadow-xl transform -rotate-6 hover:rotate-0 transition-transform duration-500">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white">Live Audit Standings</span>
              </div>
              <div className="space-y-2 text-[10px] font-mono text-on-dark-soft">
                <div className="flex justify-between">
                  <span>Alice (Option A)</span>
                  <span className="font-bold text-white">45% (89)</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[45%]" />
                </div>
                <div className="flex justify-between mt-2">
                  <span>Bob (Option B)</span>
                  <span className="font-bold text-white">55% (109)</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[55%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Grid (Bright Canvas) */}
      <section className="py-24 bg-canvas border-b border-hairline">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Gateways</h2>
            <h3 className="text-3xl font-normal text-ink">Access shadowvote applications</h3>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Admin Portal Card */}
            <div className="bg-canvas border border-hairline rounded-[24px] p-8 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-full bg-surface-strong flex items-center justify-center mb-6 text-primary group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-ink mb-3">Admin Portal</h4>
                <p className="text-sm text-body leading-relaxed mb-6">
                  Define the question and candidates, compile eligible voter commitments off-chain, and deploy a secure locked election on-chain.
                </p>
              </div>
              <Link href="/admin" className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1">
                Manage Election <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Voter Card */}
            <div className="bg-canvas border border-hairline rounded-[24px] p-8 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-full bg-surface-strong flex items-center justify-center mb-6 text-primary group-hover:scale-105 transition-transform">
                  <Vote className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-ink mb-3">Voter Booth</h4>
                <p className="text-sm text-body leading-relaxed mb-6">
                  Authenticate with your secret credential and cast an anonymous ballot using browser-generated zero-knowledge proofs.
                </p>
              </div>
              <Link href="/voter" className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1">
                Cast Ballot <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Audit Card */}
            <div className="bg-canvas border border-hairline rounded-[24px] p-8 hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-full bg-surface-strong flex items-center justify-center mb-6 text-primary group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-ink mb-3">Audit & Tallies</h4>
                <p className="text-sm text-body leading-relaxed mb-6">
                  Observe the public tally, view spent nullifiers, and verify the cryptographic integrity of the results.
                </p>
              </div>
              <Link href="/dashboard" className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1">
                View Results <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Credential Generator (Alternating Soft Band) */}
      <section className="py-24 bg-surface-soft border-b border-hairline">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-canvas border border-hairline rounded-[24px] p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center text-primary">
                <Key className="w-4 h-4" />
              </div>
              <h3 className="text-xl font-bold text-ink">Generate My Voter Credentials</h3>
            </div>
            
            <p className="text-sm text-body leading-relaxed mb-6">
              To vote privately, you need to generate a key pair. You keep your **Secret Key** completely private. You send only your **Public Commitment** to the election administrator to be added to the eligible voters list.
            </p>

            <button
              onClick={generateKeys}
              className="bg-primary hover:bg-primary-active text-on-primary font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Generate Credentials
            </button>

            {credentials && (
              <div className="mt-6 space-y-4 border-t border-hairline pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Your Private Secret Key (KEEP THIS SECRET!)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.secret}
                      className="flex-grow font-mono bg-surface-soft border border-hairline rounded-lg px-4 py-2.5 text-xs text-rose-600 select-all focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(credentials.secret, 'secret')}
                      className="bg-surface-strong border border-hairline hover:bg-hairline p-2.5 rounded-lg transition-colors cursor-pointer"
                      title="Copy Secret"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-emerald-650" /> : <Copy className="w-4 h-4 text-body" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Your Public Commitment (SHARE THIS WITH ADMIN)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={credentials.commitment}
                      className="flex-grow font-mono bg-surface-soft border border-hairline rounded-lg px-4 py-2.5 text-xs text-primary select-all focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(credentials.commitment, 'commitment')}
                      className="bg-surface-strong border border-hairline hover:bg-hairline p-2.5 rounded-lg transition-colors cursor-pointer"
                      title="Copy Commitment"
                    >
                      {copiedCommitment ? <Check className="w-4 h-4 text-emerald-650" /> : <Copy className="w-4 h-4 text-body" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Highlights (Bright Canvas) */}
      <section className="py-24 bg-canvas">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-normal text-center text-ink mb-16 tracking-tight">
            Confidential Governance Architecture
          </h2>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-[24px] bg-canvas border border-hairline">
              <CheckCircle className="w-5 h-5 text-primary mb-4" />
              <h4 className="font-bold text-ink text-sm mb-2">Off-Chain Root Registry</h4>
              <p className="text-xs text-body leading-relaxed">
                Eligible voter commitments are compiled into a Merkle root off-chain and locked into the contract, allowing gas-free scales for 500+ voters.
              </p>
            </div>
            
            <div className="p-6 rounded-[24px] bg-canvas border border-hairline">
              <EyeOff className="w-5 h-5 text-primary mb-4" />
              <h4 className="font-bold text-ink text-sm mb-2">Complete Anonymity</h4>
              <p className="text-xs text-body leading-relaxed">
                No one, including DAO admins, can see how individuals voted. Your wallet address and vote choices are completely decoupled.
              </p>
            </div>
            
            <div className="p-6 rounded-[24px] bg-canvas border border-hairline">
              <Key className="w-5 h-5 text-primary mb-4" />
              <h4 className="font-bold text-ink text-sm mb-2">One Person, One Vote</h4>
              <p className="text-xs text-body leading-relaxed">
                Unique, deterministic nullifiers prevent duplicate voting or Sybil attacks without linking your ballot back to your identity.
              </p>
            </div>
            
            <div className="p-6 rounded-[24px] bg-canvas border border-hairline">
              <Database className="w-5 h-5 text-primary mb-4" />
              <h4 className="font-bold text-ink text-sm mb-2">Public Audit Trail</h4>
              <p className="text-xs text-body leading-relaxed">
                Everyone can mathematically verify that all cast votes are legitimate and counted correctly, while individual choices stay private.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline py-12 bg-canvas">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} shadowvote. Built on Midnight Network. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
