/**
 * Одноразовая делегация голосов DLE (ERC20Votes) на Sepolia или другой сети.
 * Usage: HOLDER_PRIVATE_KEY=0x... node scripts/delegate-dle-self.js --dle 0x... --chain 11155111
 */
const { ethers } = require('ethers');

const DLE_ABI = [
  'function delegate(address delegatee)',
  'function delegates(address account) view returns (address)',
  'function balanceOf(address account) view returns (uint256)',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { dle: null, chain: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dle') out.dle = args[++i];
    else if (args[i] === '--chain') out.chain = Number(args[++i]);
    else if (args[i] === '--rpc') out.rpc = args[++i];
  }
  if (!out.dle) throw new Error('--dle required');
  return out;
}

async function main() {
  const pk = process.env.HOLDER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!pk) throw new Error('HOLDER_PRIVATE_KEY or PRIVATE_KEY required');

  const { dle, chain, rpc } = parseArgs();
  const provider = new ethers.JsonRpcProvider(rpc, chain);
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`, provider);
  const contract = new ethers.Contract(dle, DLE_ABI, wallet);

  const balance = await contract.balanceOf(wallet.address);
  const current = await contract.delegates(wallet.address);
  console.log(JSON.stringify({
    holder: wallet.address,
    balance: ethers.formatEther(balance),
    delegate: current,
  }));

  if (ethers.getAddress(current) === ethers.getAddress(wallet.address)) {
    console.log('already delegated');
    return;
  }
  if (balance === 0n) {
    throw new Error('holder has zero DLE balance');
  }

  const tx = await contract.delegate(wallet.address);
  console.log('tx', tx.hash);
  await tx.wait();
  console.log('done', await contract.delegates(wallet.address));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
