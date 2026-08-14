import nextJest from "next/jest.js";

// D-004: Jest via Next.js's official setup path, so the SWC transform handles
// TypeScript rather than a hand-rolled babel config. Mirrors apps/web's config.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  // D-022: a backend task may not render a component, so there is no DOM here
  // and no React Testing Library setup file.
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};

export default createJestConfig(config);
