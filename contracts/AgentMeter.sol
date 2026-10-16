// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentMeter
/// @notice Pay-per-call metering for software-to-software payments, settled in
/// Arc's native USDC. A provider registers a price per call; a caller tops up a
/// prepaid credit channel against that provider; the provider reports usage and
/// pulls exactly what was earned. There is no approve/permit step: credit moves
/// as native value (USDC is Arc's gas token), and withdrawals are plain native
/// transfers.
contract AgentMeter {
    struct Provider {
        address addr;
        uint256 pricePerCall; // smallest native USDC unit, per call
    }

    struct Channel {
        uint256 credit; // remaining prepaid balance, smallest native USDC unit
        uint256 callsServed;
    }

    uint256 public providerCount;
    mapping(uint256 => Provider) public providers;
    // providerId => caller => channel
    mapping(uint256 => mapping(address => Channel)) public channels;
    // provider address => withdrawable balance earned across all of its providerIds
    mapping(address => uint256) public earnedBalance;

    event ProviderRegistered(uint256 indexed providerId, address indexed provider, uint256 pricePerCall);
    event ToppedUp(uint256 indexed providerId, address indexed caller, uint256 amount, uint256 newCredit);
    event UsageRecorded(
        uint256 indexed providerId,
        address indexed caller,
        uint256 calls,
        uint256 amount,
        uint256 remainingCredit,
        uint256 totalCallsServed
    );
    event Withdrawn(address indexed provider, uint256 amount);
    event UnusedWithdrawn(uint256 indexed providerId, address indexed caller, uint256 amount);

    error PriceMustBePositive();
    error UnknownProvider();
    error NothingSent();
    error OnlyProvider();
    error CallsMustBePositive();
    error InsufficientChannelCredit();
    error NothingToWithdraw();
    error TransferFailed();

    function registerProvider(uint256 pricePerCallUSDC) external returns (uint256 providerId) {
        if (pricePerCallUSDC == 0) revert PriceMustBePositive();
        providerId = providerCount++;
        providers[providerId] = Provider(msg.sender, pricePerCallUSDC);
        emit ProviderRegistered(providerId, msg.sender, pricePerCallUSDC);
    }

    /// @notice Deposit prepaid USDC credit against a specific provider. The caller
    /// sends native value; it is credited 1:1 to their channel with that provider.
    function topUp(uint256 providerId) external payable {
        if (providers[providerId].addr == address(0)) revert UnknownProvider();
        if (msg.value == 0) revert NothingSent();
        Channel storage c = channels[providerId][msg.sender];
        c.credit += msg.value;
        emit ToppedUp(providerId, msg.sender, msg.value, c.credit);
    }

    /// @notice Only the registered provider can report usage for its own channels.
    /// Reverts if the caller's channel does not have enough prepaid credit, which
    /// is the only enforcement against unpaid calls.
    function recordUsage(uint256 providerId, address caller, uint256 calls) external {
        Provider storage p = providers[providerId];
        if (p.addr != msg.sender) revert OnlyProvider();
        if (calls == 0) revert CallsMustBePositive();

        uint256 amount = calls * p.pricePerCall;
        Channel storage c = channels[providerId][caller];
        if (c.credit < amount) revert InsufficientChannelCredit();

        c.credit -= amount;
        c.callsServed += calls;
        earnedBalance[p.addr] += amount;

        emit UsageRecorded(providerId, caller, calls, amount, c.credit, c.callsServed);
    }

    /// @notice Provider pulls its accumulated earnings across all of its providerIds.
    function withdrawEarned() external {
        uint256 amount = earnedBalance[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        earnedBalance[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Caller reclaims whatever prepaid credit is left unused with a provider.
    function withdrawUnused(uint256 providerId) external {
        Channel storage c = channels[providerId][msg.sender];
        uint256 amount = c.credit;
        if (amount == 0) revert NothingToWithdraw();
        c.credit = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit UnusedWithdrawn(providerId, msg.sender, amount);
    }

    function channelCredit(uint256 providerId, address caller) external view returns (uint256) {
        return channels[providerId][caller].credit;
    }
}
