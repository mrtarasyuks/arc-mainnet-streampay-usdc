(function () {
  "use strict";

  const cfg = window.AGENT_METER_CONFIG;
  const { ethers } = window;

  const qs = new URLSearchParams(window.location.search);
  const el = (id) => document.getElementById(id);

  const networkSelect = el("network-select");
  const connectBtn = el("connect-btn");
  const walletAddressEl = el("wallet-address");
  const contractStatusEl = el("contract-status");

  const priceInput = el("price-input");
  const registerBtn = el("register-btn");
  const myProviderIdInput = el("my-provider-id");
  const myProviderInfoEl = el("my-provider-info");
  const usageCallerInput = el("usage-caller");
  const usageCallsInput = el("usage-calls");
  const recordUsageBtn = el("record-usage-btn");
  const earnedBalanceEl = el("earned-balance");
  const withdrawEarnedBtn = el("withdraw-earned-btn");

  const topupProviderIdInput = el("topup-provider-id");
  const topupAmountInput = el("topup-amount");
  const topupBtn = el("topup-btn");
  const channelCreditEl = el("channel-credit");
  const withdrawUnusedBtn = el("withdraw-unused-btn");

  const activityLogEl = el("activity-log");

  let networkKey = qs.get("network") in cfg.networks ? qs.get("network") : "arcTestnet";
  let readProvider = null;
  let contractRead = null;
  let browserProvider = null;
  let signer = null;
  let contractWrite = null;
  let walletAddress = null;
  let pollHandle = null;
  let liveListenersAttached = false;

  const eventNames = ["ProviderRegistered", "ToppedUp", "UsageRecorded", "Withdrawn", "UnusedWithdrawn"];

  function fmt(amount) {
    try {
      return ethers.formatUnits(amount, cfg.usdcDecimals) + " USDC";
    } catch {
      return String(amount);
    }
  }

  function parseAmount(str) {
    return ethers.parseUnits(str || "0", cfg.usdcDecimals);
  }

  function net() {
    return cfg.networks[networkKey];
  }

  function contractAddress() {
    return cfg.contractAddresses[networkKey];
  }

  function explorerTxLink(hash) {
    return net().explorerTxUrl + hash;
  }

  function setStatus(message, kind) {
    contractStatusEl.textContent = message;
    contractStatusEl.className = "status" + (kind ? " " + kind : "");
  }

  function updateUrl() {
    const params = new URLSearchParams();
    params.set("network", networkKey);
    if (myProviderIdInput.value) params.set("provider", myProviderIdInput.value);
    if (usageCallerInput.value) params.set("caller", usageCallerInput.value);
    history.replaceState(null, "", "?" + params.toString());
  }

  function setupReadOnly() {
    const n = net();
    readProvider = new ethers.JsonRpcProvider(n.rpcUrl, n.chainId);
    const addr = contractAddress();
    contractRead = addr ? new ethers.Contract(addr, cfg.abi, readProvider) : null;

    if (!addr) {
      setStatus(
        `No contract deployed yet on ${n.label}. This is the frontend shell — once AgentMeter is deployed, fill its address into docs/config.js.`,
        "warn"
      );
    } else {
      setStatus(`Reading AgentMeter at ${addr} on ${n.label} via ${n.rpcUrl}.`, "ok");
    }

    activityLogEl.innerHTML = "";
    liveListenersAttached = false;
    refreshAll();
    loadPastEvents();
    attachLiveListeners();
  }

  async function attachLiveListeners() {
    if (!contractRead || liveListenersAttached) return;
    liveListenersAttached = true;
    for (const name of eventNames) {
      contractRead.on(name, (...args) => {
        const event = args[args.length - 1];
        renderLogEntry(name, event);
        refreshAll();
      });
    }
  }

  async function loadPastEvents() {
    if (!contractRead) {
      activityLogEl.innerHTML = '<li class="empty">No contract configured for this network yet.</li>';
      return;
    }
    try {
      const all = [];
      for (const name of eventNames) {
        const logs = await contractRead.queryFilter(contractRead.filters[name](), 0, "latest");
        all.push(...logs.map((log) => ({ name, log })));
      }
      all.sort((a, b) => a.log.blockNumber - b.log.blockNumber || a.log.index - b.log.index);
      activityLogEl.innerHTML = "";
      if (all.length === 0) {
        activityLogEl.innerHTML = '<li class="empty">No activity yet on this network. Register a provider to start.</li>';
      }
      for (const { name, log } of all) renderLogEntry(name, log);
    } catch (err) {
      activityLogEl.innerHTML = `<li class="empty">Could not load past events: ${err.message}</li>`;
    }
  }

  function describeEvent(name, args) {
    switch (name) {
      case "ProviderRegistered":
        return `Provider #${args.providerId} registered by ${short(args.provider)} at ${fmt(args.pricePerCall)}/call`;
      case "ToppedUp":
        return `${short(args.caller)} topped up ${fmt(args.amount)} on provider #${args.providerId} (new credit: ${fmt(args.newCredit)})`;
      case "UsageRecorded":
        return `Provider #${args.providerId} charged ${short(args.caller)} ${fmt(args.amount)} for ${args.calls} call(s) — ${args.totalCallsServed} served so far`;
      case "Withdrawn":
        return `${short(args.provider)} withdrew ${fmt(args.amount)} earned`;
      case "UnusedWithdrawn":
        return `${short(args.caller)} withdrew ${fmt(args.amount)} unused credit from provider #${args.providerId}`;
      default:
        return name;
    }
  }

  function short(addr) {
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  }

  function renderLogEntry(name, log) {
    const empty = activityLogEl.querySelector(".empty");
    if (empty) empty.remove();
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = describeEvent(name, log.args);
    const link = document.createElement("a");
    link.href = explorerTxLink(log.transactionHash);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = short(log.transactionHash);
    li.appendChild(text);
    li.appendChild(link);
    activityLogEl.appendChild(li);
  }

  async function refreshAll() {
    await Promise.all([refreshMyProvider(), refreshEarnedBalance(), refreshChannelCredit()]);
  }

  async function refreshMyProvider() {
    if (!contractRead || myProviderIdInput.value === "") {
      myProviderInfoEl.textContent = "";
      return;
    }
    try {
      const id = BigInt(myProviderIdInput.value);
      const info = await contractRead.providers(id);
      if (info.addr === ethers.ZeroAddress) {
        myProviderInfoEl.textContent = "not registered";
      } else {
        myProviderInfoEl.textContent = `${short(info.addr)} · ${fmt(info.pricePerCall)}/call`;
      }
    } catch {
      myProviderInfoEl.textContent = "";
    }
  }

  async function refreshEarnedBalance() {
    if (!contractRead || !walletAddress) {
      earnedBalanceEl.textContent = "—";
      return;
    }
    try {
      const amount = await contractRead.earnedBalance(walletAddress);
      earnedBalanceEl.textContent = fmt(amount);
    } catch {
      earnedBalanceEl.textContent = "—";
    }
  }

  async function refreshChannelCredit() {
    if (!contractRead || topupProviderIdInput.value === "" || !walletAddress) {
      channelCreditEl.textContent = "—";
      return;
    }
    try {
      const id = BigInt(topupProviderIdInput.value);
      const credit = await contractRead.channelCredit(id, walletAddress);
      channelCreditEl.textContent = fmt(credit);
    } catch {
      channelCreditEl.textContent = "—";
    }
  }

  function startPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(refreshAll, 4000);
  }

  async function ensureChain() {
    const n = net();
    if (!window.ethereum) throw new Error("No injected wallet found (install MetaMask or similar).");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: n.chainIdHex }] });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: n.chainIdHex,
              chainName: n.label,
              nativeCurrency: n.nativeCurrency,
              rpcUrls: [n.rpcUrl],
              blockExplorerUrls: [n.explorerAddressUrl.replace(/\/address\/$/, "")],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatus("No injected wallet found. Install MetaMask (or another EIP-1193 wallet) to sign transactions.", "error");
        return;
      }
      await ensureChain();
      browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      walletAddress = accounts[0];
      signer = await browserProvider.getSigner();
      const addr = contractAddress();
      contractWrite = addr ? new ethers.Contract(addr, cfg.abi, signer) : null;
      walletAddressEl.textContent = short(walletAddress);
      refreshAll();
    } catch (err) {
      setStatus("Wallet connection failed: " + err.message, "error");
    }
  }

  async function withTx(button, fn) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "confirm in wallet…";
    try {
      const tx = await fn();
      button.textContent = "mining…";
      await tx.wait();
      await refreshAll();
    } catch (err) {
      setStatus(err.shortMessage || err.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function requireWrite() {
    if (!contractWrite) {
      setStatus(
        contractAddress() ? "Connect your wallet first." : "No contract deployed on this network yet — nothing to call.",
        "warn"
      );
      return false;
    }
    return true;
  }

  registerBtn.addEventListener("click", () => {
    if (!requireWrite()) return;
    const price = parseAmount(priceInput.value);
    withTx(registerBtn, () => contractWrite.registerProvider(price));
  });

  recordUsageBtn.addEventListener("click", () => {
    if (!requireWrite()) return;
    const id = BigInt(myProviderIdInput.value || "0");
    const caller = usageCallerInput.value.trim();
    const calls = BigInt(usageCallsInput.value || "0");
    withTx(recordUsageBtn, () => contractWrite.recordUsage(id, caller, calls));
  });

  withdrawEarnedBtn.addEventListener("click", () => {
    if (!requireWrite()) return;
    withTx(withdrawEarnedBtn, () => contractWrite.withdrawEarned());
  });

  topupBtn.addEventListener("click", () => {
    if (!requireWrite()) return;
    const id = BigInt(topupProviderIdInput.value || "0");
    const amount = parseAmount(topupAmountInput.value);
    withTx(topupBtn, () => contractWrite.topUp(id, { value: amount }));
  });

  withdrawUnusedBtn.addEventListener("click", () => {
    if (!requireWrite()) return;
    const id = BigInt(topupProviderIdInput.value || "0");
    withTx(withdrawUnusedBtn, () => contractWrite.withdrawUnused(id));
  });

  connectBtn.addEventListener("click", connectWallet);

  networkSelect.addEventListener("change", () => {
    networkKey = networkSelect.value;
    updateUrl();
    setupReadOnly();
  });

  [myProviderIdInput, topupProviderIdInput, usageCallerInput].forEach((input) =>
    input.addEventListener("change", () => {
      updateUrl();
      refreshAll();
    })
  );

  function init() {
    networkSelect.value = networkKey;
    if (qs.get("provider")) myProviderIdInput.value = qs.get("provider");
    if (qs.get("caller")) usageCallerInput.value = qs.get("caller");
    if (qs.get("provider")) topupProviderIdInput.value = qs.get("provider");
    setupReadOnly();
    startPolling();
  }

  init();
})();
