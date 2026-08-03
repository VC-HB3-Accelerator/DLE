const { ethers } = require('ethers');

(async () => {
  let pk;
  if (process.env.PRIVATE_KEY) {
    pk = process.env.PRIVATE_KEY;
  } else {
    const { getSecret } = require('../../services/secretStore');
    pk = await getSecret('PRIVATE_KEY');
  }
  if (!pk) throw new Error('PRIVATE_KEY missing');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  let rpc = process.env.SEPOLIA_RPC_URL;
  if (!rpc) {
    try {
      const rpcService = require('../../services/rpcProviderService');
      rpc = await rpcService.getRpcUrlByChainId(11155111);
    } catch (_) {}
  }
  rpc = rpc || 'https://ethereum-sepolia-rpc.publicnode.com';

  const provider = new ethers.JsonRpcProvider(rpc, 11155111);
  const wallet = new ethers.Wallet(pk, provider);
  const addr = wallet.address;
  const bal = await provider.getBalance(addr);
  const nonce = await provider.getTransactionCount(addr, 'latest');
  const pending = await provider.getTransactionCount(addr, 'pending');

  const summary = {
    address: addr,
    balanceEth: ethers.formatEther(bal),
    nonceLatest: nonce,
    noncePending: pending,
    stuckPendingGap: pending - nonce,
    rpcHost: (() => { try { return new URL(rpc).host; } catch { return rpc; } })(),
  };
  console.log('WALLET', JSON.stringify(summary, null, 2));

  const created = [];
  const from = Math.max(0, nonce - 30);
  for (let n = from; n < nonce; n++) {
    const predicted = ethers.getCreateAddress({ from: addr, nonce: n });
    const code = await provider.getCode(predicted);
    if (code && code !== '0x') {
      created.push({
        nonce: n,
        address: predicted,
        codeBytes: (code.length - 2) / 2,
      });
    }
  }
  console.log('RECENT_CREATES', JSON.stringify(created, null, 2));

  // Identify DLE-ish by trying name()/symbol() and treasury moduleBridge
  const dleAbi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function getModuleAddress(bytes32) view returns (address)',
    'function initializer() view returns (address)',
  ];
  const treasAbi = [
    'function moduleBridge() view returns (address)',
    'function fundsBridge() view returns (address)',
    'function dleContract() view returns (address)',
  ];
  const bridgeAbi = [
    'function dleContract() view returns (address)',
    'function treasury() view returns (address)',
  ];
  const MODULE_TREASURY = '0x7472656173757279000000000000000000000000000000000000000000000000';

  const identified = [];
  for (const c of created) {
    const item = { address: c.address, nonce: c.nonce, codeBytes: c.codeBytes };
    try {
      const d = new ethers.Contract(c.address, dleAbi, provider);
      item.name = await d.name();
      item.symbol = await d.symbol();
      item.kind = 'DLE_or_ERC20';
      try {
        const t = await d.getModuleAddress(MODULE_TREASURY);
        if (t && t !== ethers.ZeroAddress) item.onChainTreasury = t;
      } catch (_) {}
    } catch (_) {}
    try {
      const t = new ethers.Contract(c.address, treasAbi, provider);
      const dle = await t.dleContract();
      item.kind = item.kind || 'Treasury?';
      item.treasuryDle = dle;
      try { item.moduleBridge = await t.moduleBridge(); } catch (_) {}
    } catch (_) {}
    try {
      const b = new ethers.Contract(c.address, bridgeAbi, provider);
      const dle = await b.dleContract();
      const treas = await b.treasury();
      if (dle && treas) {
        item.kind = 'TreasuryBridge';
        item.bridgeDle = dle;
        item.bridgeTreasury = treas;
      }
    } catch (_) {}
    identified.push(item);
  }
  console.log('IDENTIFIED', JSON.stringify(identified, null, 2));
})().catch((e) => {
  console.error('ERR', e.stack || e.message);
  process.exit(1);
});
