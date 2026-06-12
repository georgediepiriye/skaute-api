/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],

  // --- COVERAGE CONFIGURATION ---
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "clover"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/__tests__/**",
    "!src/lib/constants.ts",
    "!src/config/**",
    "!src/scripts/**", // Exclude your selectDB or manual scripts
    "!src/types/**",
  ],
  // Optional: Uncomment to enforce 80% coverage on all PRs
  /*
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  */

  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        diagnostics: {
          ignoreCodes: [151001, 151002],
        },
      },
    ],
  },

  transformIgnorePatterns: ["node_modules/(?!(@faker-js/faker)/)"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  forceExit: true,
};
