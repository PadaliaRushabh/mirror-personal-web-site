module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/test"],
    transform: {
      "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js"],
    coverageDirectory: "coverage",
    testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"]
  };
  