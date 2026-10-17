import { ethers, network } from "hardhat";

// Every script that can sign a transaction (deploy.ts, run-cycle.ts,
// deploy-and-demo.ts) calls this first. On arcTestnet it's a no-op. On
// arcMainnet it refuses to spend a single real USDC unless the human has
// explicitly set CONFIRM_MAINNET=yes in their own shell for this run — a
// typo'd --network flag or a copy-pasted command must not be able to move
// real money by accident.
export async function mainnetGuard(topUpAmountRaw?: bigint) {
  if (network.name !== "arcMainnet") return;

  if (process.env.CONFIRM_MAINNET !== "yes") {
    throw new Error(
      "Refusing to run against arcMainnet: this spends real USDC. " +
        "Re-run with CONFIRM_MAINNET=yes once you've checked the amount below and are ready.",
    );
  }

  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("=== MAINNET — this moves real USDC ===");
  console.log(`Signer: ${signer.address}`);
  console.log(`Signer balance: ${ethers.formatUnits(balance, 6)} USDC`);
  if (topUpAmountRaw !== undefined) {
    console.log(`This run will topUp: ${ethers.formatUnits(topUpAmountRaw, 6)} USDC`);
  }
  console.log("CONFIRM_MAINNET=yes is set — proceeding.\n");
}
