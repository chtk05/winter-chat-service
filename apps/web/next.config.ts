import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `jose` (D-041's service-token minting) and `next-auth`/`@auth/core` (D-043) ship ESM
  // only. Naming them here is what lets `next/jest` include them in the SWC transform
  // instead of ignoring them as node_modules, which otherwise fails every test that
  // touches the token minting or the Auth.js config.
  transpilePackages: ["jose", "next-auth", "@auth/core"],
};

export default nextConfig;
