// Runs the Ludo tests in the terminal:  node tests/run.mjs
import { runLudoTests } from './ludo-rules.test.js';

const results = runLudoTests();
const failed = results.filter(r => !r.pass);

for (const r of failed) console.log('FAIL:', r.name, r.extra);
console.log(`${results.length - failed.length} of ${results.length} tests passed`);
process.exit(failed.length ? 1 : 0);
