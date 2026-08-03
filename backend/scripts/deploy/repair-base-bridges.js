/**
 * Repair unwired ModuleBridges on Base Sepolia (84532) for already-deployed modules.
 */
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');
const { ethers } = require('ethers');
const { getSecret } = require('../../services/secretStore');

const CHAIN = 84532;
const RPC = 'https://sepolia.base.org';
const DLE = '0xB55060a59D7c1135984CAA273ED9bd453A651350';

const MODULES = {
  treasury: {
    address: '0x0e2aE4a0B93312942de00bd584B1208A1C7EA0c5',
    bridge: 'TreasuryBridge',
    setter: 'setFundsBridge',
    file: 'treasury',
  },
  timelock: {
    address: '0x0699eBbAF4536D41ED63906eEfE391Fae87793DB',
    bridge: 'TimelockBridge',
    setter: 'setModuleBridge',
    file: 'timelock',
  },
  reader: {
    address: '0xfbf66Bb0804E24822224e9F5D7967B94b06B8EBB',
    bridge: 'ReaderBridge',
    setter: 'setModuleBridge',
    file: 'reader',
  },
  hierarchicalVoting: {
    address: '0x0B8e6D177f1B2C8bc96d209aCD90CE7F16861928',
    bridge: 'HierarchicalVotingBridge',
    setter: 'setModuleBridge',
    file: 'hierarchicalVoting',
  },
};

async function waitCode(provider, address, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const code = await provider.getCode(address);
    if (code && code !== '0x' && code.length > 2) return code;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`no bytecode at ${address}`);
}

async function main() {
  let pk = await getSecret('PRIVATE_KEY');
  pk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const provider = new ethers.JsonRpcProvider(RPC, CHAIN);
  const wallet = new ethers.Wallet(pk, provider);

  const feeData = await provider.getFeeData();
  const fee = {};
  if (feeData.maxFeePerGas) {
    fee.maxFeePerGas = feeData.maxFeePerGas;
    fee.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || feeData.maxFeePerGas / 2n;
  } else if (feeData.gasPrice) {
    fee.gasPrice = feeData.gasPrice;
  }

  const results = {};
  for (const [type, cfg] of Object.entries(MODULES)) {
    const modAbi = [
      `function ${cfg.setter}(address)`,
      'function moduleBridge() view returns (address)',
      'function fundsBridge() view returns (address)',
    ];
    const mod = new ethers.Contract(cfg.address, modAbi, wallet);
    let current = ethers.ZeroAddress;
    try {
      current = type === 'treasury' ? await mod.fundsBridge() : await mod.moduleBridge();
    } catch (_) {}

    if (current && current !== ethers.ZeroAddress) {
      try {
        await waitCode(provider, current, 3);
        results[type] = { bridgeAddress: current, wired: true, reused: true };
        console.log(JSON.stringify({ type, reused: true, bridgeAddress: current }));
        continue;
      } catch (_) {
        /* redeploy */
      }
    }

    const Factory = await hre.ethers.getContractFactory(cfg.bridge, wallet);
    const bridge = await Factory.deploy(DLE, cfg.address, fee);
    await bridge.waitForDeployment();
    const bridgeAddress = await bridge.getAddress();
    await waitCode(provider, bridgeAddress);

    const tx = await mod[cfg.setter](bridgeAddress, fee);
    await tx.wait();
    results[type] = { bridgeAddress, wired: true, reused: false, tx: tx.hash };
    console.log(JSON.stringify({ type, bridgeAddress, wired: true, tx: tx.hash }));
  }

  const dir = path.join(__dirname, '../contracts-data/modules');
  for (const [type, cfg] of Object.entries(MODULES)) {
    const fp = path.join(dir, `${cfg.file}-${DLE.toLowerCase()}.json`);
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const net = j.networks.find((n) => Number(n.chainId) === CHAIN);
    if (net) {
      net.bridgeAddress = results[type].bridgeAddress;
      net.bridgeWired = true;
      net.bridgeError = null;
    }
    fs.writeFileSync(fp, JSON.stringify(j, null, 2));
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
