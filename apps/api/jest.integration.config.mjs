import nextJest from "next/jest.js";

/**
 * D-055: phase 3's non-browser half. Real HTTP against both running apps and the real
 * database — the seams a browser adds nothing to: the signed LINE webhook, and the
 * `apps/web` → `apps/api` token handshake.
 *
 * These are PHASE 3 tests (D-022), not `apps/api` tests. They live here only because this
 * app's `next/jest` already transforms TypeScript; a root-level project would need a new
 * transform dependency chosen with no decision behind it (recorded in D-055).
 *
 * `jest.config.mjs` — the hermetic unit suite — ignores this directory, and this config
 * runs ONLY it. `npm test` must keep passing with no database, no servers and no network.
 */
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/__integration__/**/*.test.ts"],
  // A real network to ap-southeast-1 and a real dev server compiling on first hit. The unit
  // suite's sub-second expectations do not apply.
  testTimeout: 60_000,
  // D-056: one live database. Parallel workers would race on seeded state and on each
  // other's cleanup.
  maxWorkers: 1,
};

export default createJestConfig(config);
