import { ethers } from "hardhat";

async function main() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address) throw new Error("set CONTRACT_ADDRESS env var");
  const [, provider, caller] = await ethers.getSigners();
  const contract = await ethers.getContractAt("AgentMeter", address);

  const regTx = await contract.connect(provider).registerProvider(10_000n);
  await regTx.wait();
  console.log("registered provider id 0");

  const topUpTx = await contract.connect(caller).topUp(0n, { value: 500_000n });
  await topUpTx.wait();
  console.log("topped up 0.5 USDC");

  const usageTx1 = await contract.connect(provider).recordUsage(0n, caller.address, 5n);
  await usageTx1.wait();
  console.log("recorded 5 calls");

  const usageTx2 = await contract.connect(provider).recordUsage(0n, caller.address, 5n);
  await usageTx2.wait();
  console.log("recorded 5 more calls");

  const withdrawTx = await contract.connect(provider).withdrawEarned();
  await withdrawTx.wait();
  console.log("provider withdrew earned balance");

  console.log("provider address:", provider.address);
  console.log("caller address:", caller.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
