import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const NODE_ENV_TESTS = [
  "<rootDir>/src/app/gateway/__tests__/gateway-route\\.test\\.ts",
  "<rootDir>/src/lib/auth/__tests__/service-token\\.test\\.ts",
];

const shared = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/**/layout.tsx",
  ],
};

const jsdomProject = createJestConfig({
  ...shared,
  displayName: "jsdom",
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    ...NODE_ENV_TESTS,
  ],
});

const nodeProject = createJestConfig({
  ...shared,
  displayName: "node",
  testEnvironment: "node",
  testMatch: NODE_ENV_TESTS.map((pattern) => pattern.replace(/\\\./g, ".")),
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
});

const config = async () => ({
  projects: await Promise.all([jsdomProject(), nodeProject()]),
});

export default config;
