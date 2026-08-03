/**
 * Мульти-деплой DLE + все модули + bridges на:
 * Ethereum Sepolia (11155111), Arbitrum Sepolia (421614), Base Sepolia (84532).
 *
 * Перед запуском: align-nonces-multichain.js (nonce одинаковый).
 * Ключ: secrets.PRIVATE_KEY
 */
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const CHAINS = [11155111, 421614, 84532];
const RPC = {
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  421614: 'https://sepolia-rollup.arbitrum.io/rpc',
  84532: 'https://sepolia.base.org',
};
const MODULES = ['treasury', 'timelock', 'reader', 'hierarchicalVoting'];

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      out += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      out += s;
      process.stderr.write(s);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(' ')} exit ${code}`));
    });
  });
}

async function assertNoncesAligned(wallet) {
  const nonces = [];
  for (const id of CHAINS) {
    const p = new ethers.JsonRpcProvider(RPC[id], id);
    const latest = await p.getTransactionCount(wallet.address, 'latest');
    const pending = await p.getTransactionCount(wallet.address, 'pending');
    nonces.push({ id, latest, pending, gap: pending - latest });
  }
  const target = nonces[0].latest;
  const ok = nonces.every((n) => n.latest === target && n.gap === 0);
  console.log(JSON.stringify({ step: 'nonce-check', ok, nonces }));
  if (!ok) {
    throw new Error('Nonces not aligned — run align-nonces-multichain.js first');
  }
  return target;
}

async function main() {
  const { getSecret } = require('../../services/secretStore');
  const DeployParamsService = require('../../services/deployParamsService');
  const rpcService = require('../../services/rpcProviderService');

  // ensure RPCs
  await rpcService.upsertRpcProvider({
    networkId: 'ethereum-sepolia',
    rpcUrl: RPC[11155111],
    chainId: 11155111,
  });
  await rpcService.upsertRpcProvider({
    networkId: 'arbitrum-sepolia',
    rpcUrl: RPC[421614],
    chainId: 421614,
  });
  await rpcService.upsertRpcProvider({
    networkId: 'base-sepolia',
    rpcUrl: RPC[84532],
    chainId: 84532,
  });

  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const wallet = new ethers.Wallet(pk);
  await assertNoncesAligned(wallet);

  const deploymentId = `multi-testnets-${Date.now()}`;
  const salt = ethers.id(deploymentId);
  const svc = new DeployParamsService();

  await svc.saveDeployParams(
    deploymentId,
    {
      name: 'MultiTest DLE',
      symbol: 'MTDLE',
      location: 'Testnets',
      coordinates: '0,0',
      jurisdiction: 643,
      okved_codes: ['62.01'],
      kpp: 770101001,
      quorum_percentage: 51,
      initial_partners: [wallet.address],
      initial_amounts: ['1000'],
      supported_chain_ids: CHAINS,
      current_chain_id: 11155111,
      logo_uri: '',
      private_key: pk,
      auto_verify_after_deploy: false,
      create2_salt: salt,
      rpc_urls: CHAINS.map((id) => RPC[id]),
      initializer: wallet.address,
      dle_address: null,
      modules_to_deploy: MODULES,
    },
    'pending'
  );

  const hhEnv = {
    DEPLOYMENT_ID: deploymentId,
    SUPPORTED_CHAIN_IDS: JSON.stringify(CHAINS),
    RPC_URLS: JSON.stringify(RPC),
  };

  console.log(JSON.stringify({ step: 'compile' }));
  await run('npx', ['hardhat', 'compile'], hhEnv);

  console.log(JSON.stringify({ step: 'deploy-multichain', deploymentId }));
  const multiOut = await run('npx', ['hardhat', 'run', 'scripts/deploy/deploy-multichain.js'], hhEnv);

  // refresh params for dle address
  let params = await svc.getDeployParams(deploymentId);
  let dleAddress = params?.dle_address || params?.dleAddress;
  if (!dleAddress) {
    const m = multiOut.match(/MULTICHAIN_DEPLOY_RESULT\s+(\[.*?\])/s);
    if (m) {
      try {
        const arr = JSON.parse(m[1]);
        dleAddress = arr.find((x) => x.success && x.address)?.address;
      } catch (_) {}
    }
    if (!dleAddress) {
      const addrs = multiOut.match(/0x[a-fA-F0-9]{40}/g) || [];
      dleAddress = addrs[0];
    }
    if (dleAddress) {
      await svc.updateDeploymentStatus(deploymentId, 'pending', {
        networks: CHAINS.map((chainId) => ({ address: dleAddress, chainId })),
        data: { networks: CHAINS.map((chainId) => ({ address: dleAddress, chainId })) },
      });
    }
  }
  params = await svc.getDeployParams(deploymentId);
  dleAddress = params?.dle_address || params?.dleAddress || dleAddress;
  if (!dleAddress) {
    throw new Error('DLE address missing after multichain deploy — check deploy_params');
  }

  console.log(JSON.stringify({ step: 'deploy-modules', dleAddress }));
  await run('npx', ['hardhat', 'run', 'scripts/deploy/deploy-modules.js'], {
    ...hhEnv,
    MODULE_TYPE: '', // all from DB modules_to_deploy
  });

  // re-save status with networks shape
  await svc.updateDeploymentStatus(deploymentId, 'completed', {
    networks: CHAINS.map((chainId) => ({ address: dleAddress, chainId })),
    data: { networks: CHAINS.map((chainId) => ({ address: dleAddress, chainId })) },
    modules: MODULES,
  });
  await svc.close();

  console.log(JSON.stringify({ ok: true, deploymentId, dleAddress, chains: CHAINS }));
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
