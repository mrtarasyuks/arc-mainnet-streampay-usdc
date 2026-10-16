import { ethers, network } from "hardhat";

// One real signing session against an already-deployed AgentMeter contract:
// registerProvider -> topUp -> recordUsage x2 -> withdrawEarned -> withdrawUnused.
// Also doubles as a live sanity check of the "native USDC = 6 decimals" assumption
// in docs/config.js: it prints the exact value sent and the caller's balance drop,
// so a human eyeballing the two numbers can tell immediately if they're off by 10^12.
//
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

  const pricePerCall = BigInt(process.env.PRICE_PER_CALL ?? "10000");
  const topUpAmount = BigInt(process.env.TOPUP_AMOUNT ?? "500000");
  const callsPerBatch = BigInt(process.env.CALLS_PER_BATCH ?? "5");

  const [providerSigner] = await ethers.getSigners();
  const callerSigner = process.env.PRIVATE_KEY_CALLER
    ? new ethers.Wallet(process.env.PRIVATE_KEY_CALLER, ethers.provider)
    : providerSigner;
  const selfDealing = callerSigner.address === providerSigner.address;

  console.log(`Network: ${network.name}`);
  console.log(`Provider: ${providerSigner.address}`);
  console.log(
    `Caller:   ${callerSigner.address}${selfDealing ? " (same address as provider — set PRIVATE_KEY_CALLER in .env for a second real address)" : ""}`,
  );

  const contract = await ethers.getContractAt("AgentMeter", address);
  const fmt = (raw: bigint) => `${ethers.formatUnits(raw, 6)} USDC (raw ${raw})`;
  const explorerBase = network.name === "arcMainnet" ? "https://explorer.arc.io/tx/" : "https://explorer.testnet.arc.io/tx/";
  const logTx = (label: string, hash: string) => console.log(`${label}: ${explorerBase}${hash}`);

  const callerBalanceBefore = await ethers.provider.getBalance(callerSigner.address);

  const regTx = await contract.connect(providerSigner).registerProvider(pricePerCall);
  await regTx.wait();
  logTx("registerProvider", regTx.hash);
  const providerId = (await contract.providerCount()) - 1n;
  console.log(`providerId: ${providerId}`);

  const topUpTx = await contract.connect(callerSigner).topUp(providerId, { value: topUpAmount });
  await topUpTx.wait();
  logTx("topUp", topUpTx.hash);

  const callerBalanceAfterTopUp = await ethers.provider.getBalance(callerSigner.address);
  const balanceDrop = callerBalanceBefore - callerBalanceAfterTopUp; // includes gas, so this is an order-of-magnitude check only
  console.log(`Sent as topUp value:                 ${fmt(topUpAmount)}`);
  console.log(`Caller balance dropped by (incl. gas): ${fmt(balanceDrop)}`);
  console.log(
    "If the balance drop is ~10^12x larger or smaller than the topUp value, native USDC is NOT 6-decimal and docs/config.js's usdcDecimals must change before trusting any amount shown in the UI.",
  );

  const creditAfterTopUp = await contract.channelCredit(providerId, callerSigner.address);
  console.log(`Channel credit after topUp: ${fmt(creditAfterTopUp)}`);

  for (let i = 0; i < 2; i++) {
    const usageTx = await contract.connect(providerSigner).recordUsage(providerId, callerSigner.address, callsPerBatch);
    await usageTx.wait();
    logTx(`recordUsage #${i + 1}`, usageTx.hash);
    const credit = await contract.channelCredit(providerId, callerSigner.address);
    console.log(`  channel credit now: ${fmt(credit)}`);
  }

  const earned = await contract.earnedBalance(providerSigner.address);
  console.log(`Provider earned balance before withdraw: ${fmt(earned)}`);

  const withdrawTx = await contract.connect(providerSigner).withdrawEarned();
  await withdrawTx.wait();
  logTx("withdrawEarned", withdrawTx.hash);

  const remainingCredit = await contract.channelCredit(providerId, callerSigner.address);
  if (remainingCredit > 0n) {
    const refundTx = await contract.connect(callerSigner).withdrawUnused(providerId);
    await refundTx.wait();
    logTx("withdrawUnused", refundTx.hash);
  } else {
    console.log("No remaining credit to refund (withdrawUnused skipped).");
  }

  console.log("\nFull cycle done. Copy the tx hashes above into explorer.{testnet.}arc.io, and into the submission / video script.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
