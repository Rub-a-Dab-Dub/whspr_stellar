module.exports = {
  preset: 'ts-jest',
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
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
