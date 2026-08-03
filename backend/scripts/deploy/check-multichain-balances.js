const { ethers } = require('ethers');
const fs = require('fs');

(async () => {
  const { getSecret } = require('../../services/secretStore');
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const wallet = new ethers.Wallet(pk);

  const nets = [
    {
      id: 11155111,
      name: 'ethereum-sepolia',
      rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    },
    {
      id: 421614,
      name: 'arbitrum-sepolia',
      rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    },
    {
      id: 84532,
      name: 'base-sepolia',
      rpc: 'https://sepolia.base.org',
    },
    {
      id: 84532,
      name: 'base-sepolia-publicnode',
      rpc: 'https://base-sepolia-rpc.publicnode.com',
    },
  ];

  const out = { wallet: wallet.address, balances: [] };
  for (const n of nets) {
    try {
      const p = new ethers.JsonRpcProvider(n.rpc, n.id);
      const [bal, nonce, net] = await Promise.all([
        p.getBalance(wallet.address),
        p.getTransactionCount(wallet.address, 'latest'),
        p.getNetwork(),
      ]);
      out.balances.push({
        name: n.name,
        chainId: Number(net.chainId),
        rpc: n.rpc,
        eth: ethers.formatEther(bal),
        wei: bal.toString(),
        nonce,
        ok: true,
      });
    } catch (e) {
      out.balances.push({
        name: n.name,
        chainId: n.id,
        rpc: n.rpc,
        ok: false,
        error: e.shortMessage || e.message,
      });
    }
  }

  // DB RPCs
  try {
    const rpcService = require('../../services/rpcProviderService');
    out.dbRpcs = {};
    for (const id of [11155111, 421614, 84532]) {
      out.dbRpcs[id] = (await rpcService.getRpcUrlByChainId(id)) || null;
    }
  } catch (e) {
    out.dbRpcsError = e.message;
  }

  fs.writeFileSync('/tmp/multichain-bals.json', JSON.stringify(out, null, 2));
  console.log('WROTE /tmp/multichain-bals.json');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
