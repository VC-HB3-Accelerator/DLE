/**
 * Replace stuck mempool tx: same nonce, higher fees, 0-value self send.
 */
const { ethers } = require('ethers');

(async () => {
  const { getSecret } = require('../../services/secretStore');
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  const rpcService = require('../../services/rpcProviderService');
  const rpc =
    process.env.SEPOLIA_RPC_URL ||
    (await rpcService.getRpcUrlByChainId(11155111)) ||
    'https://ethereum-sepolia-rpc.publicnode.com';

  const provider = new ethers.JsonRpcProvider(rpc, 11155111);
  const wallet = new ethers.Wallet(pk, provider);

  const latest = await provider.getTransactionCount(wallet.address, 'latest');
  const pending = await provider.getTransactionCount(wallet.address, 'pending');
  console.log(
    JSON.stringify(
      {
        step: 'before',
        address: wallet.address,
        latest,
        pending,
        gap: pending - latest,
      },
      null,
      2
    )
  );

  if (pending <= latest) {
    console.log('NO_PENDING_GAP');
    process.exit(0);
  }

  const stuckNonce = latest; // first pending nonce
  const fee = await provider.getFeeData();
  const tip = fee.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
  const maxFee = fee.maxFeePerGas || ethers.parseUnits('30', 'gwei');
  // bump hard so mempool replaces
  const maxPriorityFeePerGas = tip * 3n;
  const maxFeePerGas = maxFee * 3n < maxPriorityFeePerGas
    ? maxPriorityFeePerGas + ethers.parseUnits('5', 'gwei')
    : maxFee * 3n;

  const tx = await wallet.sendTransaction({
    to: wallet.address,
    value: 0n,
    nonce: stuckNonce,
    gasLimit: 21000n,
    maxFeePerGas,
    maxPriorityFeePerGas,
    chainId: 11155111,
    type: 2,
  });
  console.log(JSON.stringify({ step: 'sent', hash: tx.hash, nonce: stuckNonce }, null, 2));
  const rc = await tx.wait(1);
  const latest2 = await provider.getTransactionCount(wallet.address, 'latest');
  const pending2 = await provider.getTransactionCount(wallet.address, 'pending');
  console.log(
    JSON.stringify(
      {
        step: 'after',
        status: rc?.status,
        blockNumber: rc?.blockNumber,
        latest: latest2,
        pending: pending2,
        gap: pending2 - latest2,
      },
      null,
      2
    )
  );
})().catch((e) => {
  console.error('ERR', e.shortMessage || e.message);
  process.exit(1);
});
