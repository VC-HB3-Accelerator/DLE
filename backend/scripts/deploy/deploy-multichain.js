/* eslint-disable no-console */
const hre = require('hardhat');
const path = require('path');

async function deployInNetwork(rpcUrl, pk, salt, initCodeHash, factoryAddress, dleInit) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);

  // Ensure factory
  let faddr = factoryAddress;
  const code = faddr ? await provider.getCode(faddr) : '0x';
  if (!faddr || code === '0x') {
    const Factory = await hre.ethers.getContractFactory('FactoryDeployer', wallet);
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    faddr = await factory.getAddress();
  }
  const Factory = await hre.ethers.getContractAt('FactoryDeployer', faddr, wallet);
  const tx = await Factory.deploy(salt, dleInit);
  const rc = await tx.wait();
  const addr = rc.logs?.[0]?.args?.addr || (await Factory.computeAddress(salt, initCodeHash));
  return { factory: faddr, address: addr };
}

async function main() {
  const { ethers } = hre;
  const pk = process.env.PRIVATE_KEY;
  const salt = process.env.CREATE2_SALT;
  const initCodeHash = process.env.INIT_CODE_HASH;
  const networks = (process.env.MULTICHAIN_RPC_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const factories = (process.env.MULTICHAIN_FACTORY_ADDRESSES || '').split(',').map(s => s.trim());

  if (!pk || !salt || !initCodeHash || networks.length === 0) throw new Error('Env: PRIVATE_KEY, CREATE2_SALT, INIT_CODE_HASH, MULTICHAIN_RPC_URLS');

  // Prepare init code once
  const paramsPath = path.join(__dirname, './current-params.json');
  const params = require(paramsPath);
  const DLE = await hre.ethers.getContractFactory('DLE');
  const dleConfig = {
    name: params.name,
    symbol: params.symbol,
    location: params.location,
    coordinates: params.coordinates,
    jurisdiction: params.jurisdiction,
    oktmo: params.oktmo,
    okvedCodes: params.okvedCodes || [],
    kpp: params.kpp,
    quorumPercentage: params.quorumPercentage,
    initialPartners: params.initialPartners,
    initialAmounts: params.initialAmounts,
    supportedChainIds: params.supportedChainIds
  };
  const deployTx = await DLE.getDeployTransaction(dleConfig, params.currentChainId);
  const dleInit = deployTx.data;

  const results = [];
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    const factory = factories[i] || process.env.FACTORY_ADDRESS || null;
    const r = await deployInNetwork(rpcUrl, pk, salt, initCodeHash, factory, dleInit);
    results.push({ rpcUrl, ...r });
  }
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify(results));
}

main().catch((e) => { console.error(e); process.exit(1); });


