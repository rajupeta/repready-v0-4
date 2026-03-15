/** @type {import('jest').Config} */

// Ensure React uses development builds (which expose React.act for testing)
process.env.NODE_ENV = 'test';

const sharedConfig = {
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

const config = {
  projects: [
    {
      ...sharedConfig,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["**/__tests__/**/*.test.ts"],
    },
    {
      ...sharedConfig,
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: ["**/__tests__/**/*.test.tsx"],
    },
  ],
};

module.exports = config;
