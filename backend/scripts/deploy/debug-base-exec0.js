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
  const tid = '0x7472656173757279000000000000000000000000000000000000000000000000';

  const before = {
    state: (await dle.getProposalState(0)).toString(),
    result: await dle.checkProposalResult(0),
    active: await dle.activeModules(tid),
    addr: await dle.getModuleAddress(tid),
  };
  console.log(JSON.stringify({ before }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

  const feeData = await provider.getFeeData();
  const fee = {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 2n,
    gasLimit: 1_500_000n,
  };

  try {
    const gas = await dle.executeProposal.estimateGas(0);
    console.log(JSON.stringify({ estGas: gas.toString() }));
  } catch (e) {
    console.log(
      JSON.stringify({
        estErr: e.shortMessage || e.message,
        data: e.data,
        parsed: e.data
          ? (() => {
              try {
                return dle.interface.parseError(e.data).name;
              } catch (_) {
                return null;
              }
            })()
          : null,
      })
    );
  }

  try {
    const tx = await dle.executeProposal(0, fee);
    const receipt = await tx.wait();
    console.log(JSON.stringify({ hash: tx.hash, status: receipt.status, gasUsed: receipt.gasUsed.toString() }));
  } catch (e) {
    console.log(
      JSON.stringify({
        sendErr: e.shortMessage || e.message,
        data: e.data,
        parsed: e.data
          ? (() => {
              try {
                return dle.interface.parseError(e.data).name;
              } catch (_) {
                return null;
              }
            })()
          : null,
      })
    );
  }

  const after = {
    state: (await dle.getProposalState(0)).toString(),
    active: await dle.activeModules(tid),
    addr: await dle.getModuleAddress(tid),
  };
  console.log(JSON.stringify({ after }, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
