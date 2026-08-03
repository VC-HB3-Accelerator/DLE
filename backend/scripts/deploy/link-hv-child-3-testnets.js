/**
 * MultiTest parent HV link:
 * 1) Wire Treasury ↔ HV (initializer)
 * 2) Align nonces
 * 3) Deploy Child DLE B on 3 chains with same CREATE nonce → same address
 * 4) ensureVotingPower + addExternalDLE
 * 5) Persist JSON + deploy_params for FE
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ethers } = require('ethers');
const { getSecret } = require('../../services/secretStore');

const PARENT = '0xB55060a59D7c1135984CAA273ED9bd453A651350';
const TREASURY = '0x0e2aE4a0B93312942de00bd584B1208A1C7EA0c5';
const HV = '0x0B8e6D177f1B2C8bc96d209aCD90CE7F16861928';
const READER = '0xfbf66Bb0804E24822224e9F5D7967B94b06B8EBB';
const TIMELOCK = '0x0699eBbAF4536D41ED63906eEfE391Fae87793DB';
const BRIDGES = {
  // eth/arb share CREATE bridges; base has its own
  11155111: {
    treasury: '0x213d596e36094DD6409E8913E2612fe1F5202FBa',
    hv: '0x8C5664Fa4C2C18ed74fEbC11DCA242077e523CF3',
  },
  421614: {
    treasury: '0x213d596e36094DD6409E8913E2612fe1F5202FBa',
    hv: '0x8C5664Fa4C2C18ed74fEbC11DCA242077e523CF3',
  },
  84532: {
    treasury: '0x8AAc3DbFdC0c24d9e4D3bFb878f53aad140C4503',
    hv: '0xB4b4A481377198d9713248aF3EFa9C13F93b8456',
  },
};

const CHAINS = [
  { id: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', name: 'eth-sepolia' },
  { id: 421614, rpc: 'https://sepolia-rollup.arbitrum.io/rpc', name: 'arb-sepolia' },
  { id: 84532, rpc: 'https://sepolia.base.org', name: 'base-sepolia' },
];

function runNode(scriptRel) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, scriptRel)], {
      cwd: path.join(__dirname, '../..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${scriptRel} exit ${code}`))));
  });
}

async function feeOf(provider) {
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

async function wireChain(wallet, chain) {
  const fee = await feeOf(wallet.provider);
  const hv = new ethers.Contract(
    HV,
    [
      'function treasuryModule() view returns (address)',
      'function setTreasuryModule(address)',
      'function addExternalDLE(address,string,string)',
      'function externalDLEs(address) view returns (address dleAddress,string name,string symbol,uint256 tokenBalance,bool isActive,uint256 addedAt)',
    ],
    wallet
  );
  const treasury = new ethers.Contract(
    TREASURY,
    [
      'function hierarchicalVotingModule() view returns (address)',
      'function setHierarchicalVotingModule(address)',
      'function ensureVotingPower(address)',
    ],
    wallet
  );

  const curT = await hv.treasuryModule();
  if (String(curT).toLowerCase() !== TREASURY.toLowerCase()) {
    await (await hv.setTreasuryModule(TREASURY, fee)).wait();
    console.log(JSON.stringify({ chain: chain.name, setTreasuryModule: TREASURY }));
  } else {
    console.log(JSON.stringify({ chain: chain.name, setTreasuryModule: 'already' }));
  }

  const curH = await treasury.hierarchicalVotingModule();
  if (String(curH).toLowerCase() !== HV.toLowerCase()) {
    await (await treasury.setHierarchicalVotingModule(HV, fee)).wait();
    console.log(JSON.stringify({ chain: chain.name, setHierarchicalVotingModule: HV }));
  } else {
    console.log(JSON.stringify({ chain: chain.name, setHierarchicalVotingModule: 'already' }));
  }
}

async function deployChildOnChain(factory, wallet, chain, config) {
  const fee = await feeOf(wallet.provider);
  const c = await factory.connect(wallet).deploy(config, wallet.address, fee);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(JSON.stringify({ chain: chain.name, child: addr }));
  return addr;
}

async function linkChild(wallet, chain, childAddr) {
  const fee = await feeOf(wallet.provider);
  const hv = new ethers.Contract(
    HV,
    [
      'function addExternalDLE(address,string,string)',
      'function externalDLEs(address) view returns (address dleAddress,string name,string symbol,uint256 tokenBalance,bool isActive,uint256 addedAt)',
    ],
    wallet
  );
  const treasury = new ethers.Contract(
    TREASURY,
    ['function ensureVotingPower(address)'],
    wallet
  );

  await (await treasury.ensureVotingPower(childAddr, fee)).wait();
  console.log(JSON.stringify({ chain: chain.name, ensureVotingPower: childAddr }));

  let active = false;
  try {
    const info = await hv.externalDLEs(childAddr);
    active = info.isActive === true || info[4] === true;
  } catch (_) {}
  if (!active) {
    await (await hv.addExternalDLE(childAddr, 'Child B Multi', 'CBM', fee)).wait();
    console.log(JSON.stringify({ chain: chain.name, addExternalDLE: childAddr }));
  } else {
    console.log(JSON.stringify({ chain: chain.name, addExternalDLE: 'already' }));
  }
}

async function persist(wallet, childAddr) {
  const DeployParamsService = require('../../services/deployParamsService');
  const deploymentId = 'multi-testnets-1785782649431';
  const out = {
    network: 'multi-testnets',
    chainIds: CHAINS.map((c) => c.id),
    deployer: wallet.address,
    dleA: PARENT,
    treasury: TREASURY,
    hierarchicalVoting: HV,
    reader: READER,
    timelock: TIMELOCK,
    bridges: BRIDGES,
    dleB: childAddr,
    savedAt: new Date().toISOString(),
  };

  const rootData = path.join(__dirname, '../contracts-data');
  fs.mkdirSync(rootData, { recursive: true });
  const snapPath = path.join(rootData, 'hv-multitest-deploy.json');
  fs.writeFileSync(snapPath, JSON.stringify(out, null, 2) + '\n');

  const svc = new DeployParamsService();
  await svc.updateDeploymentStatus(deploymentId, 'completed', {
    networks: CHAINS.map((c) => ({ address: PARENT, chainId: c.id })),
    data: {
      networks: CHAINS.map((c) => ({ address: PARENT, chainId: c.id })),
      hv: out,
    },
    modules: ['treasury', 'timelock', 'reader', 'hierarchicalVoting'],
    dleB: childAddr,
  });
  await svc.close();
  console.log(JSON.stringify({ ok: true, deploymentId, snapPath, dleA: PARENT, dleB: childAddr }));
}

async function main() {
  const hre = require('hardhat');
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  // 1) wire in parallel across chains
  console.log(JSON.stringify({ step: 'wire' }));
  await Promise.all(
    CHAINS.map(async (chain) => {
      const provider = new ethers.JsonRpcProvider(chain.rpc, chain.id);
      const wallet = new ethers.Wallet(pk, provider);
      await wireChain(wallet, chain);
    })
  );

  // 2) align nonces before child CREATE
  console.log(JSON.stringify({ step: 'align-before-child' }));
  await runNode('align-nonces-multichain.js');

  // 3) parallel child deploy
  console.log(JSON.stringify({ step: 'deploy-child' }));
  const DLE = await hre.ethers.getContractFactory('contracts/DLE.sol:DLE');
  const config = {
    name: 'Child B Multi',
    symbol: 'CBM',
    location: 'Testnets',
    coordinates: '0,0',
    jurisdiction: 643,
    okvedCodes: ['62.01'],
    kpp: 770101001n,
    quorumPercentage: 51n,
    initialPartners: [TREASURY, new ethers.Wallet(pk).address],
    initialAmounts: [ethers.parseEther('900'), ethers.parseEther('100')],
    supportedChainIds: CHAINS.map((c) => BigInt(c.id)),
  };

  const childAddrs = await Promise.all(
    CHAINS.map(async (chain) => {
      const provider = new ethers.JsonRpcProvider(chain.rpc, chain.id);
      const wallet = new ethers.Wallet(pk, provider);
      return deployChildOnChain(DLE, wallet, chain, config);
    })
  );

  const uniq = [...new Set(childAddrs.map((a) => a.toLowerCase()))];
  if (uniq.length !== 1) {
    throw new Error(`Child address mismatch across chains: ${childAddrs.join(',')}`);
  }
  const childAddr = childAddrs[0];

  // 4) link
  console.log(JSON.stringify({ step: 'link', childAddr }));
  await Promise.all(
    CHAINS.map(async (chain) => {
      const provider = new ethers.JsonRpcProvider(chain.rpc, chain.id);
      const wallet = new ethers.Wallet(pk, provider);
      await linkChild(wallet, chain, childAddr);
    })
  );

  // 5) persist FE
  console.log(JSON.stringify({ step: 'persist' }));
  await persist(new ethers.Wallet(pk), childAddr);

  // 6) final align
  console.log(JSON.stringify({ step: 'align-final' }));
  await runNode('align-nonces-multichain.js');
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
