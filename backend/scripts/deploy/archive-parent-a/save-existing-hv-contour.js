/**
 * DEPRECATED 2026-08-03 — Parent A HV soft-retired.
 * Do not re-publish into active deploy_params. Snapshot archived under
 * `scripts/contracts-data/archive/`. Override: ALLOW_DEPRECATED_PARENT_A_DEPLOY=1
 */
const fs = require('fs');
const path = require('path');

const PARENT = {
  network: 'sepolia',
  chainId: 11155111,
  dleA: '0x7C6D6652cc637d044Ce7D3B0441C70359A57eE99',
  treasury: '0x32a00A3e2Fca29E1d758F04752c85e322653d9A3',
  treasuryBridge: '0xc0a96f339Aa85AAc8e4A1e577c2ea4b4222409Db',
  hierarchicalVoting: '0xf35a6ee853F54E06Bcf31B9D564Dbf2637185e64',
  reader: '0xcF551bcB93E496a45B0F9EEa774ab3E200be3265',
  dleB: '0xf430BE9B8a4a41439e9E6d946d73F4CeEcA201ca',
};

async function main() {
  if (process.env.ALLOW_DEPRECATED_PARENT_A_DEPLOY !== '1') {
    throw new Error(
      'save-existing-hv-contour.js is DEPRECATED (Parent A soft-retired). '
      + 'Set ALLOW_DEPRECATED_PARENT_A_DEPLOY=1 to override.'
    );
  }

  const { getSecret } = require('../../services/secretStore');
  const DeployParamsService = require('../../services/deployParamsService');
  const rpcService = require('../../services/rpcProviderService');

  let pk = await getSecret('PRIVATE_KEY');
  if (!pk) throw new Error('PRIVATE_KEY missing in secrets');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  const { ethers } = require('ethers');
  const wallet = new ethers.Wallet(pk);
  const rpcUrl = (await rpcService.getRpcUrlByChainId(11155111)) ||
    'https://ethereum-sepolia-rpc.publicnode.com';

  const out = {
    ...PARENT,
    deployer: wallet.address,
    explorers: {
      dleA: `https://sepolia.etherscan.io/address/${PARENT.dleA}`,
      treasury: `https://sepolia.etherscan.io/address/${PARENT.treasury}`,
      treasuryBridge: `https://sepolia.etherscan.io/address/${PARENT.treasuryBridge}`,
      hv: `https://sepolia.etherscan.io/address/${PARENT.hierarchicalVoting}`,
      reader: `https://sepolia.etherscan.io/address/${PARENT.reader}`,
      dleB: `https://sepolia.etherscan.io/address/${PARENT.dleB}`,
    },
    savedAt: new Date().toISOString(),
  };

  const modulesDir = path.join(__dirname, '../contracts-data/archive/modules');
  const rootData = path.join(__dirname, '../contracts-data/archive');
  fs.mkdirSync(modulesDir, { recursive: true });
  fs.mkdirSync(rootData, { recursive: true });

  const snapPath = path.join(rootData, 'hv-sepolia-deploy.json');
  fs.writeFileSync(snapPath, JSON.stringify(out, null, 2) + '\n');

  const dleA = PARENT.dleA.toLowerCase();
  const ts = new Date().toISOString();
  const moduleSpecs = [
    {
      moduleType: 'treasury',
      address: PARENT.treasury,
      bridgeAddress: PARENT.treasuryBridge,
      bridgeWired: true,
    },
    { moduleType: 'hierarchicalVoting', address: PARENT.hierarchicalVoting },
    { moduleType: 'reader', address: PARENT.reader },
  ];

  for (const m of moduleSpecs) {
    const info = {
      moduleType: m.moduleType,
      dleAddress: PARENT.dleA,
      deployTimestamp: ts,
      dleName: 'Parent A HV',
      dleSymbol: 'PAHV',
      dleSupportedChainIds: [11155111],
      networks: [
        {
          chainId: 11155111,
          rpcUrl,
          address: m.address,
          bridgeAddress: m.bridgeAddress || null,
          bridgeWired: Boolean(m.bridgeWired),
          success: true,
          verification: 'skipped',
        },
      ],
    };
    const fp = path.join(modulesDir, `${m.moduleType}-${dleA}.json`);
    fs.writeFileSync(fp, JSON.stringify(info, null, 2) + '\n');
  }

  const deploymentId = `local-sepolia-hv-${Date.now()}`;
  const svc = new DeployParamsService();
  await svc.saveDeployParams(
    deploymentId,
    {
      name: 'Parent A HV',
      symbol: 'PAHV',
      location: 'Sepolia HV Test',
      coordinates: '0,0',
      jurisdiction: 643,
      okved_codes: ['62.01'],
      kpp: 770101001,
      quorum_percentage: 51,
      initial_partners: [wallet.address],
      initial_amounts: ['1000'],
      supported_chain_ids: [11155111],
      current_chain_id: 11155111,
      logo_uri: '',
      private_key: pk,
      auto_verify_after_deploy: false,
      create2_salt: ethers.id(`hv-save-${deploymentId}`),
      rpc_urls: [rpcUrl],
      initializer: wallet.address,
      dle_address: PARENT.dleA,
      modules_to_deploy: ['treasury', 'hierarchicalVoting', 'reader'],
    },
    'completed'
  );

  await svc.updateDeploymentStatus(deploymentId, 'completed', {
    source: 'save-existing-hv-contour',
    networks: [{ address: PARENT.dleA, chainId: 11155111 }],
    data: { networks: [{ address: PARENT.dleA, chainId: 11155111 }] },
    ...out,
  });
  await svc.close();

  console.log(
    JSON.stringify(
      {
        ok: true,
        deploymentId,
        snapPath,
        dleA: PARENT.dleA,
        treasuryBridge: PARENT.treasuryBridge,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
