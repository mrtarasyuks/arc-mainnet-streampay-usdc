import { runDemoCycle } from "./lib/runCycle";

// Env vars:
//   CONTRACT_ADDRESS   (required) the deployed AgentMeter address
//   PRIVATE_KEY_CALLER (optional) a second funded key to act as the caller; if unset,
//                       the deployer account plays both provider and caller (self-dealing demo)
//   PRICE_PER_CALL     (optional) smallest USDC unit per call, default 10000 (0.01 USDC)
//   TOPUP_AMOUNT       (optional) smallest USDC unit to prepay, default 500000 (0.5 USDC)
//   CALLS_PER_BATCH    (optional) calls reported per recordUsage call, default 5
async function main() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("set CONTRACT_ADDRESS env var to the deployed AgentMeter address");
  await runDemoCycle(address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
