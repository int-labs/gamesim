module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest", // let ts-jest handle TS files
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: ["<rootDir>/src/**/*.test.(ts|tsx)"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^axios$": "axios/dist/node/axios.cjs",
  },
  testPathIgnorePatterns: ["/node_modules/", "/tests/"], // ignore Playwright
  moduleNameMapper: {
    "^axios$": "axios/dist/node/axios.cjs"
  }
};
