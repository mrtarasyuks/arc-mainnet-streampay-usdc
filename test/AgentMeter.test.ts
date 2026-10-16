import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentMeter } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentMeter", function () {
  let agentMeter: AgentMeter;
  let provider: HardhatEthersSigner;
  let caller: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  beforeEach(async function () {
    [, provider, caller, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("AgentMeter");
    agentMeter = await factory.deploy();
    await agentMeter.waitForDeployment();
  });

  it("registers a provider and returns an incrementing id", async function () {
    const tx = await agentMeter.connect(provider).registerProvider(10_000n); // 0.01 USDC @ 6 decimals
    await expect(tx).to.emit(agentMeter, "ProviderRegistered").withArgs(0n, provider.address, 10_000n);

    const [addr, price] = await agentMeter.providers(0n);
    expect(addr).to.equal(provider.address);
    expect(price).to.equal(10_000n);
  });

  it("rejects a zero price", async function () {
    await expect(agentMeter.connect(provider).registerProvider(0n)).to.be.revertedWithCustomError(
      agentMeter,
      "PriceMustBePositive"
    );
  });

  it("tops up a channel and tracks credit per (provider, caller)", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);

    await expect(
      agentMeter.connect(caller).topUp(0n, { value: 500_000n })
    )
      .to.emit(agentMeter, "ToppedUp")
      .withArgs(0n, caller.address, 500_000n, 500_000n);

    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(500_000n);
    expect(await agentMeter.channelCredit(0n, other.address)).to.equal(0n);
  });

  it("rejects topUp for an unknown provider and a zero-value topUp", async function () {
    await expect(agentMeter.connect(caller).topUp(99n, { value: 1n })).to.be.revertedWithCustomError(
      agentMeter,
      "UnknownProvider"
    );

    await agentMeter.connect(provider).registerProvider(10_000n);
    await expect(agentMeter.connect(caller).topUp(0n, { value: 0n })).to.be.revertedWithCustomError(
      agentMeter,
      "NothingSent"
    );
  });

  it("records usage, moves credit to earned balance, and lets the provider withdraw it", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n); // 0.01 USDC/call
    await agentMeter.connect(caller).topUp(0n, { value: 500_000n }); // 0.5 USDC

    await expect(agentMeter.connect(provider).recordUsage(0n, caller.address, 5n))
      .to.emit(agentMeter, "UsageRecorded")
      .withArgs(0n, caller.address, 5n, 50_000n, 450_000n, 5n);

    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(450_000n);
    expect(await agentMeter.earnedBalance(provider.address)).to.equal(50_000n);

    const balanceBefore = await ethers.provider.getBalance(provider.address);
    const tx = await agentMeter.connect(provider).withdrawEarned();
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(provider.address);

    expect(balanceAfter).to.equal(balanceBefore + 50_000n - gasCost);
    expect(await agentMeter.earnedBalance(provider.address)).to.equal(0n);
  });

  it("only lets the registered provider record its own usage", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);
    await agentMeter.connect(caller).topUp(0n, { value: 500_000n });

    await expect(agentMeter.connect(other).recordUsage(0n, caller.address, 1n)).to.be.revertedWithCustomError(
      agentMeter,
      "OnlyProvider"
    );
  });

  it("reverts recordUsage with zero calls", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);
    await expect(agentMeter.connect(provider).recordUsage(0n, caller.address, 0n)).to.be.revertedWithCustomError(
      agentMeter,
      "CallsMustBePositive"
    );
  });

  it("reverts recordUsage when channel credit is insufficient (no partial charge)", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);
    await agentMeter.connect(caller).topUp(0n, { value: 25_000n }); // only 2.5 calls worth

    await expect(agentMeter.connect(provider).recordUsage(0n, caller.address, 3n)).to.be.revertedWithCustomError(
      agentMeter,
      "InsufficientChannelCredit"
    );

    // credit and earned balance are untouched after the revert
    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(25_000n);
    expect(await agentMeter.earnedBalance(provider.address)).to.equal(0n);
  });

  it("handles dust-sized prices and amounts (1 smallest unit) without rounding loss", async function () {
    await agentMeter.connect(provider).registerProvider(1n); // smallest possible price
    await agentMeter.connect(caller).topUp(0n, { value: 3n });

    await agentMeter.connect(provider).recordUsage(0n, caller.address, 3n);

    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(0n);
    expect(await agentMeter.earnedBalance(provider.address)).to.equal(3n);
  });

  it("lets the caller withdraw unused credit and zeroes the channel", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);
    await agentMeter.connect(caller).topUp(0n, { value: 500_000n });
    await agentMeter.connect(provider).recordUsage(0n, caller.address, 5n); // uses 50_000n

    await expect(agentMeter.connect(caller).withdrawUnused(0n))
      .to.emit(agentMeter, "UnusedWithdrawn")
      .withArgs(0n, caller.address, 450_000n);

    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(0n);
    await expect(agentMeter.connect(caller).withdrawUnused(0n)).to.be.revertedWithCustomError(
      agentMeter,
      "NothingToWithdraw"
    );
  });

  it("reverts withdrawEarned and withdrawUnused when there is nothing to withdraw", async function () {
    await expect(agentMeter.connect(provider).withdrawEarned()).to.be.revertedWithCustomError(
      agentMeter,
      "NothingToWithdraw"
    );
    await expect(agentMeter.connect(caller).withdrawUnused(0n)).to.be.revertedWithCustomError(
      agentMeter,
      "NothingToWithdraw"
    );
  });

  it("keeps separate channels per caller against the same provider", async function () {
    await agentMeter.connect(provider).registerProvider(10_000n);
    await agentMeter.connect(caller).topUp(0n, { value: 100_000n });
    await agentMeter.connect(other).topUp(0n, { value: 200_000n });

    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(100_000n);
    expect(await agentMeter.channelCredit(0n, other.address)).to.equal(200_000n);

    await agentMeter.connect(provider).recordUsage(0n, caller.address, 2n); // 20_000n
    expect(await agentMeter.channelCredit(0n, caller.address)).to.equal(80_000n);
    expect(await agentMeter.channelCredit(0n, other.address)).to.equal(200_000n);
  });
});
