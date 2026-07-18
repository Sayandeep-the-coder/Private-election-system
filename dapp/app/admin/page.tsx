'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, ArrowLeft, Loader2, Sparkles, UserPlus, Key, Clipboard, Check, AlertTriangle, Download, Upload, Plus, Trash2, Calendar, Wallet, CheckCircle2, Lock, Sun, Moon
} from 'lucide-react';
import { useWallet } from '../../context/WalletContext';
import { type MidnightNetwork } from '../../lib/midnight';
import { useTheme } from '../../context/ThemeContext';
import { deployElection, closeElection } from '../../lib/election';
import { pureCircuits } from '../../../contract/src/index';
import { buildMerkleTree } from '../../lib/merkle';

const fromHex = (hex: string): Uint8Array => {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const pairs = clean.match(/.{1,2}/g);
  if (!pairs) return new Uint8Array(0);
  return new Uint8Array(pairs.map((byte: string) => parseInt(byte, 16)));
};

interface VoterDetails {
  name: string;
  secretHex: string; // Empty if pasted
  commitmentHex: string;
}

export default function AdminPage() {
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

  // Election Setup State
  const [question, setQuestion] = useState<string>('Who should be the KGEC Dev Community lead?');
  const [options, setOptions] = useState<string>('Alice, Bob, Charlie');
  const [adminSecretHex, setAdminSecretHex] = useState<string>('');
  const [deploying, setDeploying] = useState<boolean>(false);
  const [contractAddress, setContractAddress] = useState<string>('');
  const [deployError, setDeployError] = useState<string | null>(null);

  // Voters List State
  const [voters, setVoters] = useState<VoterDetails[]>([]);
  const [newVoterName, setNewVoterName] = useState<string>('');
  const [newVoterCommitment, setNewVoterCommitment] = useState<string>('');
  const [computedRootHex, setComputedRootHex] = useState<string>('0');

  // Bulk Import & Batch generator state
  const [voterInputMode, setVoterInputMode] = useState<'single' | 'bulk' | 'batch'>('single');
  const [bulkPasteText, setBulkPasteText] = useState<string>('');
  const [batchCount, setBatchCount] = useState<string>('100');

  // Close Election State
  const [closeContractAddress, setCloseContractAddress] = useState<string>('');
  const [closing, setClosing] = useState<boolean>(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeSuccess, setCloseSuccess] = useState<boolean>(false);

  // Clipboard Help
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Calculate off-chain Merkle root dynamically in frontend
  useEffect(() => {
    if (voters.length === 0) {
      setComputedRootHex('0');
      return;
    }
    try {
      const commitmentBytesArray = voters.map(v => fromHex(v.commitmentHex));
      const tree = buildMerkleTree(commitmentBytesArray);
      setComputedRootHex(tree.root.toString());
    } catch (e) {
      console.error('Failed to compute Merkle root:', e);
    }
  }, [voters]);

  useEffect(() => {
    // Load from localStorage if present
    if (typeof window !== 'undefined') {
      const savedContractAddress = localStorage.getItem('election_contract_address');
      const savedAdminSecret = localStorage.getItem('election_admin_secret');
      const savedVoters = localStorage.getItem('election_voters');
      const savedQuestion = localStorage.getItem('election_question');
      const savedOptions = localStorage.getItem('election_options');

      if (savedContractAddress) {
        setContractAddress(savedContractAddress);
        setCloseContractAddress(savedContractAddress);
      }
      if (savedAdminSecret) {
        setAdminSecretHex(savedAdminSecret);
      } else {
        // Auto-generate admin secret
        const randomBytes = new Uint8Array(32);
        window.crypto.getRandomValues(randomBytes);
        setAdminSecretHex(Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
      }
      if (savedVoters) {
        try {
          setVoters(JSON.parse(savedVoters));
        } catch (e) {
          console.error(e);
        }
      }
      if (savedQuestion) {
        setQuestion(savedQuestion);
      }
      if (savedOptions) {
        setOptions(savedOptions);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (contractAddress) {
        localStorage.setItem('election_contract_address', contractAddress);
      } else {
        localStorage.removeItem('election_contract_address');
      }
    }
  }, [contractAddress]);

  useEffect(() => {
    if (typeof window !== 'undefined' && adminSecretHex) {
      localStorage.setItem('election_admin_secret', adminSecretHex);
    }
  }, [adminSecretHex]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('election_voters', JSON.stringify(voters));
    }
  }, [voters]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('election_question', question);
    }
  }, [question]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('election_options', options);
    }
  }, [options]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleConnect = async () => {
    await connect();
  };

  const handleDeploy = async () => {
    if (!session) return;
    if (!question.trim() || !options.trim()) {
      setDeployError('Question and options are required');
      return;
    }
    if (voters.length === 0) {
      setDeployError('Please add at least one voter commitment to build the allowlist root');
      return;
    }
    setDeploying(true);
    setDeployError(null);
    try {
      // 1. Gather all commitments
      const commitmentBytesArray = voters.map(v => fromHex(v.commitmentHex));

      // 2. Build Merkle tree and extract root
      const tree = buildMerkleTree(commitmentBytesArray);
      const root = tree.root;

      // 3. Deploy contract initialized with the off-chain root
      const adminSecret = fromHex(adminSecretHex);
      const address = await deployElection(
        session,
        question.trim(),
        options.trim(),
        adminSecret,
        root
      );
      
      setContractAddress(address);
      setCloseContractAddress(address);

      // Save activity to localStorage
      if (typeof window !== 'undefined') {
        const activityStr = localStorage.getItem('shadowvote_activity') || '[]';
        try {
          const activity = JSON.parse(activityStr);
          activity.unshift({
            id: Date.now().toString(),
            type: 'deploy',
            electionAddress: address,
            question: question.trim(),
            details: `Options: ${options.trim()}`,
            timestamp: Date.now(),
            network: session.networkId,
            userAddress: session.unshieldedAddress
          });
          localStorage.setItem('shadowvote_activity', JSON.stringify(activity));
        } catch (e) {
          console.error('Failed to update activity log:', e);
        }
      }

      // 4. Save voter commitments database to localStorage for Voter Booth path calculations
      localStorage.setItem(`shadowvote_commitments_${address}`, JSON.stringify(voters.map(v => ({
        name: v.name,
        commitmentHex: v.commitmentHex
      }))));
    } catch (err: any) {
      setDeployError(err.message || 'Failed to deploy contract');
    } finally {
      setDeploying(false);
    }
  };

  const handleAddVoter = () => {
    if (!newVoterName.trim()) return;

    let secretHex = '';
    let commitmentHex = newVoterCommitment.trim();

    // If commitment input is empty, auto-generate a mock voter for easy developer testing
    if (!commitmentHex) {
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);
      secretHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const commitment = pureCircuits.calculateCommitment(randomBytes);
      commitmentHex = Array.from(commitment).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Basic validation
      const sanitized = commitmentHex.startsWith('0x') ? commitmentHex.slice(2) : commitmentHex;
      if (sanitized.length !== 64) {
        alert('Invalid commitment length. Must be a 32-byte hex string (64 characters).');
        return;
      }
    }

    setVoters([
      ...voters,
      {
        name: newVoterName.trim(),
        secretHex,
        commitmentHex
      },
    ]);
    setNewVoterName('');
    setNewVoterCommitment('');
  };

  const handleImportBulk = () => {
    if (!bulkPasteText.trim()) return;
    
    const lines = bulkPasteText.split('\n');
    const imported: VoterDetails[] = [];
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const cleanLine = line.trim();
      if (!cleanLine) continue;

      const parts = cleanLine.split(',');
      if (parts.length === 2) {
        const name = parts[0].trim();
        let commitment = parts[1].trim();
        if (commitment.startsWith('0x')) commitment = commitment.slice(2);
        
        if (commitment.length !== 64) {
          alert(`Line ${lineNum}: Invalid commitment length. Must be 64 characters.`);
          return;
        }

        imported.push({
          name,
          secretHex: '', 
          commitmentHex: commitment
        });
      } else if (parts.length === 1) {
        let commitment = parts[0].trim();
        if (commitment.startsWith('0x')) commitment = commitment.slice(2);
        
        if (commitment.length !== 64) {
          alert(`Line ${lineNum}: Invalid commitment length. Must be 64 characters.`);
          return;
        }

        imported.push({
          name: `Imported Voter #${voters.length + imported.length + 1}`,
          secretHex: '',
          commitmentHex: commitment
        });
      } else {
        alert(`Line ${lineNum}: Unrecognized format. Use "Name, Commitment" or just "Commitment".`);
        return;
      }
    }

    setVoters([...voters, ...imported]);
    setBulkPasteText('');
  };

  const handleGenerateBatch = () => {
    const count = parseInt(batchCount);
    if (isNaN(count) || count <= 0 || count > 1000) {
      alert('Please enter a valid count between 1 and 1000.');
      return;
    }

    const newMockVoters: VoterDetails[] = [];
    for (let i = 0; i < count; i++) {
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);
      const secretHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const commitment = pureCircuits.calculateCommitment(randomBytes);
      const commitmentHex = Array.from(commitment).map(b => b.toString(16).padStart(2, '0')).join('');
      
      newMockVoters.push({
        name: `Mock Voter #${voters.length + i + 1}`,
        secretHex,
        commitmentHex
      });
    }

    setVoters([...voters, ...newMockVoters]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const imported: VoterDetails[] = [];
      
      // Try JSON first
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'object' && item.commitmentHex) {
              imported.push({
                name: item.name || `Imported Voter #${voters.length + imported.length + 1}`,
                secretHex: item.secretHex || '',
                commitmentHex: item.commitmentHex.startsWith('0x') ? item.commitmentHex.slice(2) : item.commitmentHex
              });
            } else if (typeof item === 'string') {
              imported.push({
                name: `Imported Voter #${voters.length + imported.length + 1}`,
                secretHex: '',
                commitmentHex: item.startsWith('0x') ? item.slice(2) : item
              });
            }
          }
          setVoters([...voters, ...imported]);
          return;
        }
      } catch (err) {
        // Fallback to text lines
      }

      // Parse as CSV/Text line by line
      const lines = content.split('\n');
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;

        const parts = cleanLine.split(',');
        if (parts.length >= 2) {
          let commitment = parts[1].trim();
          if (commitment.startsWith('0x')) commitment = commitment.slice(2);
          imported.push({
            name: parts[0].trim(),
            secretHex: parts[2]?.trim() || '',
            commitmentHex: commitment
          });
        } else if (parts.length === 1) {
          let commitment = parts[0].trim();
          if (commitment.startsWith('0x')) commitment = commitment.slice(2);
          imported.push({
            name: `Imported Voter #${voters.length + imported.length + 1}`,
            secretHex: '',
            commitmentHex: commitment
          });
        }
      }

      setVoters([...voters, ...imported]);
    };
    reader.readAsText(file);
  };

  const handleExportCredentials = () => {
    if (voters.length === 0) return;
    const dataStr = JSON.stringify(voters, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadowvote_credentials_${contractAddress || 'draft'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCloseElection = async () => {
    if (!session || !closeContractAddress.trim()) return;
    setClosing(true);
    setCloseError(null);
    setCloseSuccess(false);
    try {
      const adminSecret = fromHex(adminSecretHex);
      await closeElection(session, closeContractAddress.trim(), adminSecret);
      
      // Save activity to localStorage
      if (typeof window !== 'undefined') {
        const activityStr = localStorage.getItem('shadowvote_activity') || '[]';
        try {
          const activity = JSON.parse(activityStr);
          activity.unshift({
            id: Date.now().toString(),
            type: 'close',
            electionAddress: closeContractAddress.trim(),
            question: 'Closed Election',
            details: `Admin closed contract: ${closeContractAddress.trim()}`,
            timestamp: Date.now(),
            network: session.networkId,
            userAddress: session.unshieldedAddress
          });
          localStorage.setItem('shadowvote_activity', JSON.stringify(activity));
        } catch (e) {
          console.error('Failed to update activity log:', e);
        }
      }

      setCloseSuccess(true);
    } catch (err: any) {
      setCloseError(err.message || 'Failed to close election');
    } finally {
      setClosing(false);
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
              <span className="text-muted text-sm font-medium">Admin Portal</span>
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
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear the current election setup and start a new one?")) {
                  localStorage.removeItem('election_contract_address');
                  localStorage.removeItem('election_admin_secret');
                  localStorage.removeItem('election_voters');
                  localStorage.removeItem('election_question');
                  localStorage.removeItem('election_options');
                  localStorage.removeItem('election_network');
                  setContractAddress('');
                  setCloseContractAddress('');
                  setVoters([]);
                  setQuestion('Who should be the KGEC Dev Community lead?');
                  setOptions('Alice, Bob, Charlie');
                  // Generate new random admin secret
                  const randomBytes = new Uint8Array(32);
                  window.crypto.getRandomValues(randomBytes);
                  setAdminSecretHex(Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
                }
              }}
              className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer"
            >
              Reset Setup
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-10">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-normal text-ink tracking-tight mb-2">Admin Portal</h1>
          <p className="text-sm text-body leading-relaxed">
            Configure candidates, register eligible voter commitments, build the Merkle root registry, and deploy the election contract.
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
                    No Midnight wallet browser extensions detected. Please install 1AM Wallet or Lace, unlock it, and refresh.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    className="flex-grow bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                    className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
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

        {session && (
          <>
            {/* Step 2: Election Specifications */}
            <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
              <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">2</span>
                Election Specifications
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Poll Question / DAO Proposal Topic</label>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Enter election question"
                    className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Candidates (Comma-separated list)</label>
                  <input
                    type="text"
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder="Alice, Bob, Charlie"
                    className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted mt-1 leading-relaxed">
                    Options are deployed on-chain exactly as entered, comma-split, and mapped to index IDs.
                  </p>
                </div>
              </div>
            </section>

            {/* Step 3: Voter Allowlist Registry */}
            <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5 border-b border-hairline pb-4">
                <h2 className="text-base font-bold text-ink flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">3</span>
                  Voter Allowlist Setup ({voters.length})
                </h2>
                
                <div className="flex gap-2 bg-surface-strong p-1 rounded-full w-fit">
                  <button
                    onClick={() => setVoterInputMode('single')}
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${voterInputMode === 'single' ? 'bg-canvas text-ink shadow-sm' : 'text-muted'}`}
                  >
                    Add Single
                  </button>
                  <button
                    onClick={() => setVoterInputMode('bulk')}
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${voterInputMode === 'bulk' ? 'bg-canvas text-ink shadow-sm' : 'text-muted'}`}
                  >
                    Bulk Paste
                  </button>
                  <button
                    onClick={() => setVoterInputMode('batch')}
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${voterInputMode === 'batch' ? 'bg-canvas text-ink shadow-sm' : 'text-muted'}`}
                  >
                    Mock Generator
                  </button>
                </div>
              </div>

              {/* Single add form */}
              {voterInputMode === 'single' && (
                <div className="bg-surface-soft p-5 border border-hairline rounded-2xl mb-6 space-y-4 animate-in fade-in duration-300">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Voter Name / Identifier</label>
                      <input
                        type="text"
                        placeholder="Voter A"
                        value={newVoterName}
                        onChange={(e) => setNewVoterName(e.target.value)}
                        className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Public Commitment Hash (Hex)</label>
                      <input
                        type="text"
                        placeholder="Paste 32-byte hex commitment, or leave empty for mock generation"
                        value={newVoterCommitment}
                        onChange={(e) => setNewVoterCommitment(e.target.value)}
                        className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddVoter}
                    disabled={!newVoterName}
                    className="bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Voter
                  </button>
                </div>
              )}

              {/* Bulk paste Form */}
              {voterInputMode === 'bulk' && (
                <div className="bg-surface-soft p-5 border border-hairline rounded-2xl mb-6 space-y-4 animate-in fade-in duration-300">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">CSV Paste format: "Name, CommitmentHex" or just "CommitmentHex" (one per line)</label>
                    <textarea
                      rows={5}
                      value={bulkPasteText}
                      onChange={(e) => setBulkPasteText(e.target.value)}
                      placeholder="Voter A, c5f8...&#10;Voter B, 9d2a...&#10;e2f89..."
                      className="w-full bg-canvas border border-hairline rounded-xl p-3 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleImportBulk}
                      disabled={!bulkPasteText.trim()}
                      className="bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-5 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Parse and Import List
                    </button>
                    
                    {/* File upload */}
                    <label className="bg-canvas border border-hairline hover:bg-surface-soft text-ink font-semibold text-xs px-5 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5 text-muted" /> Import Credentials File (.json / .csv)
                      <input
                        type="file"
                        accept=".json,.csv,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Batch generator */}
              {voterInputMode === 'batch' && (
                <div className="bg-surface-soft p-5 border border-hairline rounded-2xl mb-6 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-4">
                    <div className="grow">
                      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Mock Voters Count</label>
                      <input
                        type="number"
                        value={batchCount}
                        onChange={(e) => setBatchCount(e.target.value)}
                        className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      onClick={handleGenerateBatch}
                      className="bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer self-end flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Generate Mock Batch
                    </button>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">
                    Useful for developers to easily simulate scaling (e.g. 100+ voters) off-chain. Generates keypairs on-the-fly and saves them to credentials database.
                  </p>
                </div>
              )}

              {/* Voters List Grid */}
              {voters.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs border-b border-hairline pb-2 text-muted">
                    <span>Voter Name & details</span>
                    <span>Action</span>
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {voters.map((v, idx) => (
                      <div key={idx} className="p-3 bg-surface-soft border border-hairline rounded-xl flex items-center justify-between text-xs gap-4">
                        <div className="min-w-0 flex-grow">
                          <span className="font-bold text-ink block truncate">{v.name}</span>
                          <span className="font-mono text-[10px] text-muted block truncate mt-0.5">Commitment: {v.commitmentHex}</span>
                          {v.secretHex && (
                            <span className="font-mono text-[10px] text-rose-600 block truncate">Secret: {v.secretHex}</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const newV = [...voters];
                            newV.splice(idx, 1);
                            setVoters(newV);
                          }}
                          className="hover:bg-hairline p-1.5 rounded-full text-muted hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                          title="Remove Voter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="text-xs">
                      <span className="text-muted font-medium font-mono">Calculated Merkle Registry Root:</span>
                      <span className="font-mono font-bold text-primary block mt-0.5 text-xs truncate max-w-sm sm:max-w-md">{computedRootHex}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportCredentials}
                        className="bg-surface-strong hover:bg-hairline text-ink font-semibold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5 text-muted" /> Export Credentials JSON
                      </button>
                      <button
                        onClick={() => setVoters([])}
                        className="border border-hairline hover:bg-surface-soft text-rose-600 text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 border border-dashed border-hairline rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-muted mx-auto mb-2" />
                  <p className="text-xs text-muted font-mono">No voter commitments added to the registry yet.</p>
                </div>
              )}
            </section>

            {/* Step 4: Publish & Deploy */}
            <section className="mb-8 p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
              <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">4</span>
                Publish & Deploy Election
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Admin Private Secret Key (64 hex characters)</label>
                  <input
                    type="text"
                    value={adminSecretHex}
                    onChange={(e) => setAdminSecretHex(e.target.value)}
                    placeholder="Admin secret hex"
                    className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-rose-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                  />
                  <p className="text-[10px] text-muted mt-1 leading-relaxed">
                    Auto-generated random secret on load. Save this to close the election tally later.
                  </p>
                </div>

                {!contractAddress ? (
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || voters.length === 0}
                    className="w-full bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-sm font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {deploying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deploying Contract to Midnight Network (Generating genesis proofs)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Deploy Election Contract
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-6 border border-emerald-200 bg-emerald-50 rounded-2xl space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Election Contract Deployed successfully!
                    </div>
                    
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] text-emerald-800 uppercase font-mono tracking-wider font-semibold">Contract Address</span>
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            readOnly
                            value={contractAddress}
                            className="w-full bg-canvas border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-mono text-emerald-800"
                          />
                          <button
                            onClick={() => handleCopy(contractAddress, 'contract')}
                            className="bg-canvas border border-emerald-200 p-2 rounded-lg hover:bg-emerald-100/50"
                          >
                            {copiedText === 'contract' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5 text-emerald-700" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Link
                        href={`/dashboard?address=${contractAddress}&network=${network}`}
                        className="bg-primary hover:bg-primary-active text-on-primary font-semibold text-xs px-5 py-2.5 rounded-full transition-colors flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Go to Live Standings
                      </Link>
                      <button
                        onClick={handleExportCredentials}
                        className="bg-canvas border border-emerald-200 text-emerald-800 hover:bg-emerald-100/50 font-semibold text-xs px-4 py-2.5 rounded-full transition-colors"
                      >
                        Export Credentials JSON
                      </button>
                    </div>
                  </div>
                )}

                {deployError && (
                  <p className="text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl">{deployError}</p>
                )}
              </div>
            </section>

            {/* Step 5: Close Tally */}
            <section className="p-8 rounded-[24px] border border-hairline bg-canvas shadow-sm">
              <h2 className="text-base font-bold text-ink mb-5 flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-surface-strong border border-hairline text-ink font-bold text-xs flex items-center justify-center">5</span>
                Close Election Tally
              </h2>

              <div className="space-y-4">
                <p className="text-xs text-body leading-relaxed">
                  Only the election creator can close the tally. Closing updates the contract state and locks further ballot submissions.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Contract Address to Close</label>
                    <input
                      type="text"
                      placeholder="Election contract address (hex)"
                      value={closeContractAddress}
                      onChange={(e) => setCloseContractAddress(e.target.value)}
                      className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Creator Private Secret Key</label>
                    <input
                      type="password"
                      value={adminSecretHex}
                      onChange={(e) => setAdminSecretHex(e.target.value)}
                      placeholder="Creator secret hex"
                      className="w-full bg-canvas border border-hairline rounded-xl px-4 py-2.5 text-xs text-rose-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
                    />
                  </div>
                </div>

                {!closeSuccess ? (
                  <button
                    onClick={handleCloseElection}
                    disabled={closing || !closeContractAddress.trim() || !adminSecretHex}
                    className="w-full bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-sm font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {closing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Closing Tally on Midnight Network (Generating authorization proof)...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Close Election Tally
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-5 border border-emerald-200 bg-emerald-50 rounded-xl flex items-center gap-3 text-emerald-800 font-bold text-sm animate-in fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Election closed successfully! No further ballots can be cast.
                  </div>
                )}

                {closeError && (
                  <p className="text-xs text-rose-600 font-mono bg-rose-50 border border-rose-100 p-2.5 rounded-xl">{closeError}</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
