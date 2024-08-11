module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/tests/cdk-test"],
    transform: {
      "^.+\\.tsx?$": "ts-jest"
    },
    moduleFileExtensions: ["ts", "tsx", "js"],
    coverageDirectory: "coverage",
    testMatch: [    "**/?(*.)+(spec|test).[jt]s?(x)"  ]
  };
  