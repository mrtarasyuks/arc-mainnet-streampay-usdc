import { deployAgentMeter } from "./lib/deployContract";

async function main() {
  await deployAgentMeter();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
