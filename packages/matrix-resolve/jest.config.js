export default {
  testTimeout: 10000,
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: ['./src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 50,
      lines: 90,
      statements: 90
    }
  },
  "transform": {
    "\\.[jt]sx?$": [
      "babel-jest",
      {
        "babelrc": false,
        "presets": ["@babel/preset-typescript"],
        "plugins": [
          "@babel/plugin-proposal-optional-chaining",
          "@babel/plugin-transform-modules-commonjs"
        ]
      }
    ]
  }
}
