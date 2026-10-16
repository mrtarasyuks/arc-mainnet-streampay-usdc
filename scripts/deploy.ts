import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const AgentMeter = await ethers.getContractFactory("AgentMeter");
  const agentMeter = await AgentMeter.deploy();
  await agentMeter.waitForDeployment();

  const address = await agentMeter.getAddress();
  console.log(`AgentMeter deployed to: ${address}`);
  console.log(`Add this address to docs/config.js as CONTRACT_ADDRESSES.${network.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
