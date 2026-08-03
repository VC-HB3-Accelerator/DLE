/**
 * Деплой тестового контура HV T2 на Sepolia:
 * DLE A → Treasury + HV → регистрация модулей → DLE B (доля казне A) → link.
 *
 * Ключ: secrets.PRIVATE_KEY или process.env.PRIVATE_KEY
 * RPC: rpcProviderService chain 11155111 или SEPOLIA_RPC_URL
 */
const hre = require('hardhat');
const { ethers } = hre;
const { MODULE_IDS } = require('../../constants/moduleIds');

const SEPOLIA = 11155111n;

async function getPk() {
  if (process.env.PRIVATE_KEY) {
    return process.env.PRIVATE_KEY.startsWith('0x')
      ? process.env.PRIVATE_KEY
      : `0x${process.env.PRIVATE_KEY}`;
  }
  try {
    const { getSecret } = require('../../services/secretStore');
    const pk = await getSecret('PRIVATE_KEY');
    if (pk) return pk.startsWith('0x') ? pk : `0x${pk}`;
  } catch (_) {}
  throw new Error('PRIVATE_KEY not found in env or secrets');
}

async function getRpc() {
  if (process.env.SEPOLIA_RPC_URL) return process.env.SEPOLIA_RPC_URL;
  try {
    const rpc = require('../../services/rpcProviderService');
    const url = await rpc.getRpcUrlByChainId(Number(SEPOLIA));
    if (url) return url;
  } catch (_) {}
  return 'https://ethereum-sepolia-rpc.publicnode.com';
}

async function deployDLE(factory, name, symbol, partners, amounts, initializer, chainIds) {
  const config = {
    name,
    symbol,
    location: 'Sepolia HV Test',
    coordinates: '0,0',
    jurisdiction: 643,
    okvedCodes: ['62.01'],
    kpp: 770101001n,
    quorumPercentage: 51n,
    initialPartners: partners,
    initialAmounts: amounts,
    supportedChainIds: chainIds,
  };
  const c = await factory.deploy(config, initializer);
  await c.waitForDeployment();
  return c;
}

async function addModule(dle, moduleId, moduleAddress, chainId, signer) {
  const dleAs = dle.connect(signer);
  const tx = await dleAs.createAddModuleProposal(`add ${moduleId}`, 3600, moduleId, moduleAddress, chainId);
  await tx.wait();
  const proposalId = (await dle.getProposalsCount()) - 1n;
  await (await dleAs.vote(proposalId, true)).wait();
  await (await dleAs.executeProposal(proposalId)).wait();
  return proposalId;
}

async function main() {
  const pk = await getPk();
  const rpcUrl = await getRpc();
  const provider = new ethers.JsonRpcProvider(rpcUrl, Number(SEPOLIA));
  const wallet = new ethers.Wallet(pk, provider);

  const bal = await provider.getBalance(wallet.address);
  console.log(JSON.stringify({
    step: 'wallet',
    address: wallet.address,
    balanceEth: ethers.formatEther(bal),
    rpcHost: new URL(rpcUrl).host,
  }));
  if (bal < ethers.parseEther('0.05')) {
    throw new Error('Need ≥0.05 ETH on Sepolia for deploy');
  }

  const DLE = await ethers.getContractFactory('contracts/DLE.sol:DLE', wallet);
  const Treasury = await ethers.getContractFactory('TreasuryModule', wallet);
  const HV = await ethers.getContractFactory('HierarchicalVotingModule', wallet);

  console.log('Deploying DLE A...');
  const dleA = await deployDLE(
    DLE,
    'Parent A HV',
    'PAHV',
    [wallet.address],
    [ethers.parseEther('1000')],
    wallet.address,
    [SEPOLIA]
  );
  const dleAAddr = await dleA.getAddress();
  console.log('DLE A', dleAAddr);

  console.log('Deploying Treasury + HV...');
  const treasury = await Treasury.deploy(dleAAddr, SEPOLIA, wallet.address);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();

  const hv = await HV.deploy(dleAAddr);
  await hv.waitForDeployment();
  const hvAddr = await hv.getAddress();
  console.log('Treasury', treasuryAddr, 'HV', hvAddr);

  console.log('Registering modules on A...');
  await addModule(dleA, MODULE_IDS.TREASURY, treasuryAddr, SEPOLIA, wallet);
  await addModule(dleA, MODULE_IDS.HIERARCHICAL_VOTING, hvAddr, SEPOLIA, wallet);

  await (await hv.setTreasuryModule(treasuryAddr)).wait();
  await (await treasury.setHierarchicalVotingModule(hvAddr)).wait();

  console.log('Deploying DLE B (treasury share + deployer)...');
  const dleB = await deployDLE(
    DLE,
    'Child B HV',
    'CBHV',
    [treasuryAddr, wallet.address],
    [ethers.parseEther('900'), ethers.parseEther('100')],
    wallet.address,
    [SEPOLIA]
  );
  const dleBAddr = await dleB.getAddress();
  console.log('DLE B', dleBAddr);

  await (await treasury.ensureVotingPower(dleBAddr)).wait();
  await (await hv.addExternalDLE(dleBAddr, 'Child B HV', 'CBHV')).wait();

  // Reader optional
  let readerAddr = null;
  try {
    const Reader = await ethers.getContractFactory('DLEReader', wallet);
    const reader = await Reader.deploy(dleAAddr);
    await reader.waitForDeployment();
    readerAddr = await reader.getAddress();
    await addModule(dleA, MODULE_IDS.READER, readerAddr, SEPOLIA, wallet);
    console.log('Reader', readerAddr);
  } catch (e) {
    console.warn('Reader skip:', e.message);
  }

  const out = {
    network: 'sepolia',
    chainId: Number(SEPOLIA),
    deployer: wallet.address,
    dleA: dleAAddr,
    treasury: treasuryAddr,
    hierarchicalVoting: hvAddr,
    dleB: dleBAddr,
    reader: readerAddr,
    explorers: {
      dleA: `https://sepolia.etherscan.io/address/${dleAAddr}`,
      treasury: `https://sepolia.etherscan.io/address/${treasuryAddr}`,
      hv: `https://sepolia.etherscan.io/address/${hvAddr}`,
      dleB: `https://sepolia.etherscan.io/address/${dleBAddr}`,
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
