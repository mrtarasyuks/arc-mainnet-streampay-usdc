// AgentMeter — chain + contract configuration for the static frontend.
//
// CONTRACT_ADDRESSES is empty until the contract is actually deployed (a
// human step done with a real signer, not by this build). Fill in the
// address(es) you get from `npx hardhat run scripts/deploy.ts --network <net>`.
window.AGENT_METER_CONFIG = {
  networks: {
    arcTestnet: {
      label: "Arc Testnet",
      chainIdHex: "0x4cf6d2", // 5042002
      chainId: 5042002,
      rpcUrl: "https://rpc.testnet.arc.io",
      explorerTxUrl: "https://explorer.testnet.arc.io/tx/",
      explorerAddressUrl: "https://explorer.testnet.arc.io/address/",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    },
    arcMainnet: {
      label: "Arc Mainnet",
      chainIdHex: "0x13b2", // 5042
      chainId: 5042,
      rpcUrl: "https://rpc.mainnet.arc.io",
      explorerTxUrl: "https://explorer.arc.io/tx/",
      explorerAddressUrl: "https://explorer.arc.io/address/",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    },
  },
  // Filled in after `npx hardhat run scripts/deploy.ts --network <net>`.
  contractAddresses: {
    arcTestnet: "",
    arcMainnet: "",
  },
  // USDC's native decimals on Arc are stated as 6 in docs.arc.io's contract
  // reference for the ERC-20 wrapper. VERIFY this matches the native value
  // (msg.value) convention on Arc before relying on it for real amounts —
  // if the chain instead uses 18-decimal native accounting, every amount
  // shown here would be off by 10^12 and must be rescaled.
  usdcDecimals: 6,
  abi: [
    { "inputs": [], "name": "CallsMustBePositive", "type": "error" },
    { "inputs": [], "name": "InsufficientChannelCredit", "type": "error" },
    { "inputs": [], "name": "NothingSent", "type": "error" },
    { "inputs": [], "name": "NothingToWithdraw", "type": "error" },
    { "inputs": [], "name": "OnlyProvider", "type": "error" },
    { "inputs": [], "name": "PriceMustBePositive", "type": "error" },
    { "inputs": [], "name": "TransferFailed", "type": "error" },
    { "inputs": [], "name": "UnknownProvider", "type": "error" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "provider", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }], "name": "ProviderRegistered", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "caller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "newCredit", "type": "uint256" }], "name": "ToppedUp", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "caller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "UnusedWithdrawn", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "caller", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "calls", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "remainingCredit", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "totalCallsServed", "type": "uint256" }], "name": "UsageRecorded", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "provider", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Withdrawn", "type": "event" },
    { "inputs": [{ "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "internalType": "address", "name": "caller", "type": "address" }], "name": "channelCredit", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "channels", "outputs": [{ "internalType": "uint256", "name": "credit", "type": "uint256" }, { "internalType": "uint256", "name": "callsServed", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "earnedBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "providerCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "providers", "outputs": [{ "internalType": "address", "name": "addr", "type": "address" }, { "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "providerId", "type": "uint256" }, { "internalType": "address", "name": "caller", "type": "address" }, { "internalType": "uint256", "name": "calls", "type": "uint256" }], "name": "recordUsage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "pricePerCallUSDC", "type": "uint256" }], "name": "registerProvider", "outputs": [{ "internalType": "uint256", "name": "providerId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "providerId", "type": "uint256" }], "name": "topUp", "outputs": [], "stateMutability": "payable", "type": "function" },
    { "inputs": [], "name": "withdrawEarned", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "providerId", "type": "uint256" }], "name": "withdrawUnused", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  ],
};
