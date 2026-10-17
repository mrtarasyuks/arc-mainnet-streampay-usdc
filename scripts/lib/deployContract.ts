import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { AgentMeter } from "../../typechain-types";
import { mainnetGuard } from "./mainnetGuard";

// network.name as passed to `--network` must match a key in docs/config.js's
// `networks` object (arcTestnet / arcMainnet) for the auto-write below to work.
export async function deployAgentMeter(): Promise<{ contract: AgentMeter; address: string }> {
  await mainnetGuard();
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const AgentMeter = await ethers.getContractFactory("AgentMeter");
  const agentMeter = await AgentMeter.deploy();
  await agentMeter.waitForDeployment();

  const address = await agentMeter.getAddress();
  console.log(`AgentMeter deployed to: ${address}`);

  const configPath = path.join(__dirname, "..", "..", "docs", "config.js");
  const original = fs.readFileSync(configPath, "utf8");
  const marker = `${network.name}: ""`;
  if (!original.includes(marker)) {
    console.warn(
      `Could not find contractAddresses.${network.name} (already filled in, or network.name has no matching key in docs/config.js). Edit docs/config.js by hand.`,
    );
  } else {
    const updated = original.replace(marker, `${network.name}: "${address}"`);
    fs.writeFileSync(configPath, updated);
    console.log(`Wrote the address into docs/config.js under contractAddresses.${network.name}`);
  }

  return { contract: agentMeter, address };
}
