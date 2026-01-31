module.exports = {
  preset: 'ts-jest',
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  collectCoverageFrom: [
    "**/*.(t|j)s"
  ],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  moduleFileExtensions: ['js', 'json', 'ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(bad-words|badwords-list)/)',
  ],
};
