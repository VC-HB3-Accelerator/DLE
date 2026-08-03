/**
 * Align deployer nonce across testnets with cheap self-transfers (value=0).
 * Target = max(latest nonce) among listed chains.
 */
const { ethers } = require('ethers');

const NETS = [
  { id: 11155111, name: 'eth-sepolia', rpc: 'https://ethereum-sepolia-rpc.publicnode.com' },
  { id: 421614, name: 'arb-sepolia', rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
  { id: 84532, name: 'base-sepolia', rpc: 'https://sepolia.base.org' },
];

async function getPk() {
  if (process.env.PRIVATE_KEY) {
    const pk = process.env.PRIVATE_KEY;
    return pk.startsWith('0x') ? pk : `0x${pk}`;
  }
  const { getSecret } = require('../../services/secretStore');
  const pk = await getSecret('PRIVATE_KEY');
  if (!pk) throw new Error('PRIVATE_KEY missing');
  return pk.startsWith('0x') ? pk : `0x${pk}`;
}

async function readNonces(wallet) {
  const rows = [];
  for (const n of NETS) {
    const p = new ethers.JsonRpcProvider(n.rpc, n.id);
    const latest = await p.getTransactionCount(wallet.address, 'latest');
    const pending = await p.getTransactionCount(wallet.address, 'pending');
    rows.push({ ...n, latest, pending, gap: pending - latest, provider: p });
  }
  return rows;
}

async function bumpFees(provider) {
  const fee = await provider.getFeeData();
  let tip = fee.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei');
  let maxFee = fee.maxFeePerGas || ethers.parseUnits('20', 'gwei');
  // modest bump for reliability, still cheap
  tip = tip < ethers.parseUnits('0.1', 'gwei') ? ethers.parseUnits('0.1', 'gwei') : tip;
  if (maxFee < tip * 2n) maxFee = tip * 2n;
  return {
    maxPriorityFeePerGas: tip,
    maxFeePerGas: maxFee,
  };
}

async function alignChain(wallet, row, target) {
  const need = target - row.latest;
  if (need <= 0) {
    console.log(JSON.stringify({ chain: row.name, status: 'already', latest: row.latest, target }));
    return { chain: row.name, sent: 0, latest: row.latest };
  }
  if (row.gap > 0) {
    throw new Error(`${row.name}: pending gap=${row.gap} — clear pending before align`);
  }

  console.log(JSON.stringify({ chain: row.name, status: 'aligning', from: row.latest, to: target, txs: need }));
  const connected = wallet.connect(row.provider);
  let nonce = row.latest;
  let sent = 0;
  const batchWaitEvery = 20;

  while (nonce < target) {
    const fees = await bumpFees(row.provider);
    const tx = await connected.sendTransaction({
      to: wallet.address,
      value: 0n,
      nonce,
      gasLimit: 21000n,
      chainId: row.id,
      type: 2,
      ...fees,
    });
    sent += 1;
    nonce += 1;

    // wait every tx on L2 is fine; batch wait for eth if many
    if (sent % batchWaitEvery === 0 || nonce >= target) {
      await tx.wait(1);
      const latestNow = await row.provider.getTransactionCount(wallet.address, 'latest');
      const pendingNow = await row.provider.getTransactionCount(wallet.address, 'pending');
      console.log(
        JSON.stringify({
          chain: row.name,
          progress: `${latestNow}/${target}`,
          pendingGap: pendingNow - latestNow,
          lastHash: tx.hash,
        })
      );
      if (pendingNow > latestNow) {
        // wait until gap clears
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const l = await row.provider.getTransactionCount(wallet.address, 'latest');
          const p = await row.provider.getTransactionCount(wallet.address, 'pending');
          if (p <= l) {
            nonce = l;
            break;
          }
          if (i === 59) throw new Error(`${row.name}: stuck pending during align`);
        }
      } else {
        nonce = latestNow;
      }
    }
  }

  const finalLatest = await row.provider.getTransactionCount(wallet.address, 'latest');
  console.log(JSON.stringify({ chain: row.name, status: 'done', latest: finalLatest, target, sent }));
  return { chain: row.name, sent, latest: finalLatest };
}

async function main() {
  const pk = await getPk();
  const wallet = new ethers.Wallet(pk);
  console.log(JSON.stringify({ step: 'start', wallet: wallet.address }));

  let rows = await readNonces(wallet);
  console.log(JSON.stringify({ step: 'before', rows: rows.map(({ name, id, latest, pending, gap }) => ({ name, id, latest, pending, gap })) }));

  const target = Math.max(...rows.map((r) => r.latest));
  // align lagging chains first (parallel)
  const lagging = rows.filter((r) => r.latest < target);
  const results = [];
  // sequential per chain to avoid RPC overload; chains sequential
  for (const row of lagging) {
    results.push(await alignChain(wallet, row, target));
  }

  rows = await readNonces(wallet);
  const after = rows.map(({ name, id, latest, pending, gap }) => ({ name, id, latest, pending, gap }));
  const aligned = after.every((r) => r.latest === target && r.gap === 0);
  console.log(JSON.stringify({ step: 'after', target, aligned, rows: after, results }, null, 2));
  if (!aligned) process.exit(2);
}

main().catch((e) => {
  console.error('ERR', e.shortMessage || e.message);
  process.exit(1);
});
