'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { listWallets, connectMidnightWallet, type MidnightSession, type MidnightNetwork } from '../lib/midnight';

interface WalletContextType {
  wallets: any[];
  selectedWalletIndex: number;
  setSelectedWalletIndex: (index: number) => void;
  network: MidnightNetwork;
  setNetwork: (network: MidnightNetwork) => void;
  session: MidnightSession | null;
  connecting: boolean;
  walletError: string | null;
  connect: () => Promise<MidnightSession | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState<number>(0);
  const [network, setNetwork] = useState<MidnightNetwork>('preview');
  const [session, setSession] = useState<MidnightSession | null>(null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Initialize wallets list client-side
  useEffect(() => {
    setWallets(listWallets());

    // Restore state if was connected
    const wasConnected = localStorage.getItem('shadowvote_was_connected') === 'true';
    const savedNetwork = localStorage.getItem('shadowvote_network') as MidnightNetwork;
    const savedIndex = localStorage.getItem('shadowvote_wallet_index');

    if (savedNetwork) setNetwork(savedNetwork);
    if (savedIndex) setSelectedWalletIndex(Number(savedIndex));

    if (wasConnected) {
      // Small timeout to allow wallets to be detected on load
      const t = setTimeout(() => {
        const available = listWallets();
        setWallets(available);
        if (available.length > 0) {
          const indexToUse = savedIndex ? Number(savedIndex) : 0;
          const networkToUse = savedNetwork || 'preview';
          autoConnect(available[indexToUse], networkToUse);
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, []);

  const autoConnect = async (wallet: any, net: MidnightNetwork) => {
    setConnecting(true);
    setWalletError(null);
    try {
      const newSession = await connectMidnightWallet(wallet, net);
      setSession(newSession);
    } catch (err: any) {
      console.warn('Auto-connect failed:', err);
      localStorage.removeItem('shadowvote_was_connected');
    } finally {
      setConnecting(false);
    }
  };

  const changeNetwork = async (newNetwork: MidnightNetwork) => {
    setNetwork(newNetwork);
    localStorage.setItem('shadowvote_network', newNetwork);
    
    if (session || connecting) {
      setConnecting(true);
      setWalletError(null);
      try {
        const available = listWallets();
        const wallet = available[selectedWalletIndex];
        const newSession = await connectMidnightWallet(wallet, newNetwork);
        setSession(newSession);
        localStorage.setItem('shadowvote_was_connected', 'true');
      } catch (err: any) {
        setWalletError(err.message || 'Failed to switch network');
        setSession(null);
        localStorage.removeItem('shadowvote_was_connected');
      } finally {
        setConnecting(false);
      }
    }
  };

  const connect = async () => {
    const available = listWallets();
    setWallets(available);
    if (available.length === 0) {
      setWalletError('No Midnight wallet detected.');
      return null;
    }
    setConnecting(true);
    setWalletError(null);
    try {
      const wallet = available[selectedWalletIndex];
      const newSession = await connectMidnightWallet(wallet, network);
      setSession(newSession);
      localStorage.setItem('shadowvote_was_connected', 'true');
      localStorage.setItem('shadowvote_network', network);
      localStorage.setItem('shadowvote_wallet_index', selectedWalletIndex.toString());
      return newSession;
    } catch (err: any) {
      setWalletError(err.message || 'Failed to connect wallet');
      localStorage.removeItem('shadowvote_was_connected');
      return null;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setSession(null);
    localStorage.removeItem('shadowvote_was_connected');
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        selectedWalletIndex,
        setSelectedWalletIndex,
        network,
        setNetwork: changeNetwork,
        session,
        connecting,
        walletError,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
