import type { NextConfig } from "next";
import { i18n } from './next-i18next.config';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n: {
    ...i18n,
    localeDetection: false,
  },
  // Proxy Firebase auth handler through this domain so there is no
  // cross-origin iframe needed. This fixes Firebase signInWithRedirect on
  // browsers / extensions (Safari, AdGuard) that block third-party iframes.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://internshala-be05a.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
