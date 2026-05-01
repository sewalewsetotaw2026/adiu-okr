#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const rawArgs = process.argv.slice(2);
const jestBin = require.resolve("jest/bin/jest");

const jestArgs = ["--runInBand"];

if (rawArgs.length > 0) {
  const [firstArg, ...rest] = rawArgs;

  // npm run test -- okr
  // Treat the first positional argument as a test path pattern.
  if (!firstArg.startsWith("-")) {
    jestArgs.push("--testPathPatterns", firstArg, ...rest);
  } else {
    jestArgs.push(...rawArgs);
  }
}

const result = spawnSync(process.execPath, [jestBin, ...jestArgs], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
