module.exports = {
  preset: 'ts-jest',
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: [
    "quest/Test",
    "Implement Admin Audit Log entity and service",
    "View, approve, and reject user withdrawal requests",
    "AdminGuard and Role-based Access Control decorators",
    "Security alerts and anomaly detection",
  ],
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: [
    "admin/**/*.ts",
    "!admin/**/*.spec.ts",
    "!admin/**/index.ts",
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(bad-words|badwords-list)/)',
  ],
};
