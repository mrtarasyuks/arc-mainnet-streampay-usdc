import { deployAgentMeter } from "./lib/deployContract";
import { runDemoCycle } from "./lib/runCycle";

// Collapses the two human steps (deploy, then run the cycle against the
// freshly-deployed address) into one command: `npm run demo:testnet` /
// `npm run demo:mainnet`. Same env vars as scripts/run-cycle.ts, minus
// CONTRACT_ADDRESS (the address just deployed is used directly).
async function main() {
  const { address } = await deployAgentMeter();
  console.log("\nRunning the demo cycle against the contract just deployed...\n");
  await runDemoCycle(address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
