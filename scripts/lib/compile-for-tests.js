// Compiles the pure music/audio TS modules to .test-build so node test
// scripts exercise the real source instead of a duplicated copy.
const { spawnSync } = require("child_process");
const path = require("path");

function compileForTests() {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const tscPath = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(process.execPath, [tscPath, "-p", "tsconfig.test.json"], {
    cwd: projectRoot,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`TypeScript compilation for tests failed (exit ${result.status})`);
  }
  return path.join(projectRoot, ".test-build");
}

module.exports = { compileForTests };
