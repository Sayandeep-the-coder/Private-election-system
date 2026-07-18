import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      'isomorphic-ws': './lib/ws-polyfill.js'
    }
  },
  webpack: (config) => {
    config.resolve.alias['isomorphic-ws'] = path.resolve(__dirname, 'lib/ws-polyfill.js');
    return config;
  }
};

export default nextConfig;
