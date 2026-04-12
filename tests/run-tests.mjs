import { auditCoreTest } from "./audit-core.test.mjs";
import { governanceBootstrapTest } from "./governance-bootstrap.test.mjs";
import { pathUtilsTest } from "./path-utils.test.mjs";
import { serverTest, sourceEvidenceCoverageTaskSyncTest } from "./server.test.mjs";

const tests = [
  ["auditCoreTest", auditCoreTest],
  ["governanceBootstrapTest", governanceBootstrapTest],
  ["pathUtilsTest", pathUtilsTest],
  ["sourceEvidenceCoverageTaskSyncTest", sourceEvidenceCoverageTaskSyncTest],
  ["serverTest", serverTest]
];

let failures = 0;

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`PASS all ${tests.length} tests`);
}
