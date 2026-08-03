const { ethers } = require('ethers');
const { getSecret } = require('../../services/secretStore');

async function main() {
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org', 84532);
  const wallet = new ethers.Wallet(pk, provider);
  const dle = new ethers.Contract(
    '0xB55060a59D7c1135984CAA273ED9bd453A651350',
    [
      'function vote(uint256,bool)',
      'function executeProposal(uint256)',
      'function getProposalsCount() view returns (uint256)',
      'function getModuleAddress(bytes32) view returns (address)',
    ],
    wallet
  );
  const feeData = await provider.getFeeData();
  const fee = {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 2n,
  };
  console.log(JSON.stringify({ count: (await dle.getProposalsCount()).toString() }));
  try {
    await (await dle.vote(0, true, fee)).wait();
    console.log(JSON.stringify({ voted: 0 }));
  } catch (e) {
    console.log(JSON.stringify({ voteErr: e.shortMessage || e.message }));
  }
  try {
    await (await dle.executeProposal(0, fee)).wait();
    console.log(JSON.stringify({ executed: 0 }));
  } catch (e) {
    console.log(JSON.stringify({ execErr: e.shortMessage || e.message }));
  }
  const treasury = await dle.getModuleAddress(
    '0x7472656173757279000000000000000000000000000000000000000000000000'
  );
  console.log(JSON.stringify({ treasury }));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
