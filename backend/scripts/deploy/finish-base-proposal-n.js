/**
 * Finish open Base proposal (vote+execute) then continue ONLY_CHAIN register.
 */
const { ethers } = require('ethers');
const fs = require('fs');
const { getSecret } = require('../../services/secretStore');

async function main() {
  const art = JSON.parse(fs.readFileSync('/app/artifacts/contracts/DLE.sol/DLE.json', 'utf8'));
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org', 84532);
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const w = new ethers.Wallet(pk, provider);
  const dle = new ethers.Contract('0xB55060a59D7c1135984CAA273ED9bd453A651350', art.abi, w);
  const feeData = await provider.getFeeData();
  const fee = {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 2n,
    gasLimit: 1_500_000n,
  };

  const pid = Number(process.env.PROPOSAL_ID || '1');
  console.log(JSON.stringify({ pid, state: (await dle.getProposalState(pid)).toString() }));
  try {
    await (await dle.vote(pid, true, fee)).wait();
    console.log(JSON.stringify({ voted: pid }));
  } catch (e) {
    console.log(JSON.stringify({ voteErr: e.shortMessage || e.message }));
  }
  try {
    await (await dle.executeProposal(pid, fee)).wait();
    console.log(JSON.stringify({ executed: pid }));
  } catch (e) {
    console.log(JSON.stringify({ execErr: e.shortMessage || e.message, data: e.data }));
  }
  const reader = await dle.getModuleAddress(
    '0x7265616465720000000000000000000000000000000000000000000000000000'
  );
  console.log(JSON.stringify({ reader }));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
