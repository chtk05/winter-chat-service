import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `jose` (D-008's session signing) ships ESM only. Naming it here is what lets
  // `next/jest` include it in the SWC transform instead of ignoring it as a
  // node_module, which otherwise fails every test that touches the session service.
  transpilePackages: ["jose"],
};

export default nextConfig;
