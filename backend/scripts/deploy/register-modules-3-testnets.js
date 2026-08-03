/**
 * Register modules on MultiTest DLE across 3 testnets.
 * Order: treasury → reader → hierarchicalVoting → timelock (last).
 * Per chain: createAddModuleProposal → vote → executeProposal.
 */
const hre = require('hardhat');
const { ethers } = require('ethers');
const { getSecret } = require('../../services/secretStore');
const { MODULE_IDS } = require('../../constants/moduleIds');

const DLE = '0xB55060a59D7c1135984CAA273ED9bd453A651350';
const CHAINS = [
  { id: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', name: 'eth-sepolia' },
  { id: 421614, rpc: 'https://sepolia-rollup.arbitrum.io/rpc', name: 'arb-sepolia' },
  { id: 84532, rpc: 'https://sepolia.base.org', name: 'base-sepolia' },
];

const MODULES = [
  { key: 'treasury', id: MODULE_IDS.TREASURY, address: '0x0e2aE4a0B93312942de00bd584B1208A1C7EA0c5' },
  { key: 'reader', id: MODULE_IDS.READER, address: '0xfbf66Bb0804E24822224e9F5D7967B94b06B8EBB' },
  { key: 'hierarchicalVoting', id: MODULE_IDS.HIERARCHICAL_VOTING, address: '0x0B8e6D177f1B2C8bc96d209aCD90CE7F16861928' },
  { key: 'timelock', id: MODULE_IDS.TIMELOCK, address: '0x0699eBbAF4536D41ED63906eEfE391Fae87793DB' },
];

const DLE_ABI = [
  'function createAddModuleProposal(string,uint256,bytes32,address,uint256) returns (uint256)',
  'function vote(uint256,bool)',
  'function executeProposal(uint256)',
  'function getProposalsCount() view returns (uint256)',
  'function getModuleAddress(bytes32) view returns (address)',
  'function activeModules(bytes32) view returns (bool)',
  'function delegates(address) view returns (address)',
  'function delegate(address)',
  'function balanceOf(address) view returns (uint256)',
];

async function feeOverrides(provider) {
  const feeData = await provider.getFeeData();
  const fee = {};
  if (feeData.maxFeePerGas) {
    fee.maxFeePerGas = feeData.maxFeePerGas;
    fee.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 2n;
  } else if (feeData.gasPrice) {
    fee.gasPrice = feeData.gasPrice;
  }
  return fee;
}

function proposalIdFromReceipt(receipt, dleInterface) {
  for (const log of receipt.logs || []) {
    try {
      const parsed = dleInterface.parseLog(log);
      if (parsed && parsed.name === 'ProposalCreated') {
        return parsed.args.proposalId;
      }
    } catch (_) {}
  }
  return null;
}

async function waitProposalsCount(dle, minCount, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const n = await dle.getProposalsCount();
    if (n >= minCount) return n;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return dle.getProposalsCount();
}

async function registerOnChain(wallet, provider, chain) {
  const dle = new ethers.Contract(DLE, DLE_ABI, wallet);
  const fee = await feeOverrides(provider);
  const out = { chain: chain.name, chainId: chain.id, modules: {} };
  const iface = dle.interface;

  const bal = await dle.balanceOf(wallet.address);
  if (bal === 0n) throw new Error(`no DLE balance on ${chain.name}`);

  const delegates = await dle.delegates(wallet.address);
  if (String(delegates).toLowerCase() !== wallet.address.toLowerCase()) {
    console.log(JSON.stringify({ step: 'delegate', chain: chain.name }));
    await (await dle.delegate(wallet.address, fee)).wait();
  }

  for (const m of MODULES) {
    const already = await dle.getModuleAddress(m.id);
    if (already && already !== ethers.ZeroAddress) {
      out.modules[m.key] = { address: already, skipped: true };
      console.log(JSON.stringify({ chain: chain.name, module: m.key, skipped: true, address: already }));
      continue;
    }

    const preCount = await dle.getProposalsCount();
    console.log(JSON.stringify({ chain: chain.name, module: m.key, step: 'create', preCount: preCount.toString() }));
    let proposalId = null;
    let created = false;
    try {
      const txC = await dle.createAddModuleProposal(
        `add ${m.key}`,
        3600,
        m.id,
        m.address,
        chain.id,
        fee
      );
      const receipt = await txC.wait();
      proposalId = proposalIdFromReceipt(receipt, iface);
      created = true;
    } catch (e) {
      console.log(JSON.stringify({ chain: chain.name, module: m.key, createFailed: e.shortMessage || e.message }));
      throw e;
    }

    // Новый proposalId == preCount (после успешного create count станет preCount+1)
    await waitProposalsCount(dle, preCount + 1n);
    if (proposalId == null) proposalId = preCount;
    if (proposalId !== preCount) {
      console.log(
        JSON.stringify({
          chain: chain.name,
          module: m.key,
          warn: 'event proposalId mismatch, using preCount',
          fromEvent: proposalId.toString(),
          preCount: preCount.toString(),
        })
      );
      proposalId = preCount;
    }

    console.log(JSON.stringify({ chain: chain.name, module: m.key, step: 'vote', proposalId: proposalId.toString(), created }));
    try {
      await (await dle.vote(proposalId, true, fee)).wait();
    } catch (e) {
      const msg = e.shortMessage || e.message || '';
      if (!/AlreadyVoted|ErrAlreadyVoted|already voted/i.test(msg)) throw e;
      console.log(JSON.stringify({ chain: chain.name, module: m.key, vote: 'already' }));
    }

    console.log(JSON.stringify({ chain: chain.name, module: m.key, step: 'execute' }));
    try {
      await (await dle.executeProposal(proposalId, fee)).wait();
    } catch (e) {
      const msg = e.shortMessage || e.message || '';
      if (!/ErrProposalExecuted|ErrAlreadyExecutedInChain|already executed/i.test(msg)) throw e;
      console.log(JSON.stringify({ chain: chain.name, module: m.key, execute: 'already' }));
    }

    const onchain = await dle.getModuleAddress(m.id);
    out.modules[m.key] = {
      address: onchain,
      proposalId: proposalId.toString(),
      ok: String(onchain).toLowerCase() === m.address.toLowerCase(),
    };
    console.log(JSON.stringify({ chain: chain.name, module: m.key, registered: onchain }));
    if (!out.modules[m.key].ok) {
      throw new Error(`module ${m.key} not registered on ${chain.name}: got ${onchain}`);
    }
  }

  return out;
}

async function main() {
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  const only = (process.env.ONLY_CHAIN || '').trim();
  const list = only
    ? CHAINS.filter((c) => String(c.id) === only || c.name === only)
    : CHAINS;
  if (list.length === 0) throw new Error(`UNKNOWN ONLY_CHAIN=${only}`);

  const results = [];
  for (const chain of list) {
    const provider = new ethers.JsonRpcProvider(chain.rpc, chain.id);
    const wallet = new ethers.Wallet(pk, provider);
    results.push(await registerOnChain(wallet, provider, chain));
  }

  console.log(JSON.stringify({ ok: true, dle: DLE, results }, null, 2));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
