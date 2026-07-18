'use client';

import React from 'react';
import { WalletProvider } from '../context/WalletContext';
import { ThemeProvider } from '../context/ThemeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        {children}
      </WalletProvider>
    </ThemeProvider>
  );
}
