/**
 * Ончейн smoke для эталонного MultiTest (3 testnets).
 * Parent A HV ops-retired — см. data-room/stage-a/AUDIT-CODE-FULL.ru.md
 * Snapshot: contracts-data/archive/
 *
 * Без отправки tx: code/modules/bridges/transfer createProposal.staticCall
 */
const { ethers } = require('ethers');
const { MODULE_IDS } = require('../../constants/moduleIds');

const RPC = {
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  421614: 'https://sepolia-rollup.arbitrum.io/rpc',
  84532: 'https://sepolia.base.org',
};

/** @deprecated Soft-retired 2026-08-03 — leave for archive reference only */
const RETIRED_PARENT_A = {
  id: 'parent-a-hv',
  dle: '0x7C6D6652cc637d044Ce7D3B0441C70359A57eE99',
  child: '0xf430BE9B8a4a41439e9E6d946d73F4CeEcA201ca',
};

const CONTOURS = [
  {
    id: 'multitest',
    dle: '0xB55060a59D7c1135984CAA273ED9bd453A651350',
    chains: [11155111, 421614, 84532],
    expectModules: ['treasury', 'reader', 'hierarchicalVoting', 'timelock'],
    expectTimelock: true,
    child: '0xafaD65EdbFeCAe4f6c0D159f667BF5d7e65a2d2b',
  },
];

const MODULE_MAP = {
  treasury: MODULE_IDS.TREASURY,
  reader: MODULE_IDS.READER,
  hierarchicalVoting: MODULE_IDS.HIERARCHICAL_VOTING,
  timelock: MODULE_IDS.TIMELOCK,
};

const DLE_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function initializer() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function supportedChains(uint256) view returns (bool)',
  'function getModuleAddress(bytes32) view returns (address)',
  'function activeModules(bytes32) view returns (bool)',
  'function createProposal(string,uint256,bytes,uint256[],uint256) returns (uint256)',
  'function minVotingDuration() view returns (uint256)',
];

const MODULE_ABI = [
  'function moduleBridge() view returns (address)',
  'function fundsBridge() view returns (address)',
  'function dleContract() view returns (address)',
  'function treasuryModule() view returns (address)',
  'function hierarchicalVotingModule() view returns (address)',
];

function ok(cond, msg) {
  return { ok: Boolean(cond), msg };
}

async function hasCode(provider, address) {
  if (!address || address === ethers.ZeroAddress) return false;
  const code = await provider.getCode(address);
  return Boolean(code && code !== '0x' && code.length > 2);
}

async function readBridge(modContract, type) {
  try {
    if (type === 'treasury') return await modContract.fundsBridge();
  } catch (_) {}
  try {
    return await modContract.moduleBridge();
  } catch (_) {
    return ethers.ZeroAddress;
  }
}

async function smokeChain(contour, chainId) {
  const provider = new ethers.JsonRpcProvider(RPC[chainId], chainId);
  const dle = new ethers.Contract(contour.dle, DLE_ABI, provider);
  const checks = [];
  const detail = { chainId, modules: {} };

  checks.push(ok(await hasCode(provider, contour.dle), 'dle has code'));
  try {
    detail.name = await dle.name();
    detail.symbol = await dle.symbol();
    checks.push(ok(true, `name=${detail.name}`));
  } catch (e) {
    checks.push(ok(false, `name failed: ${e.shortMessage || e.message}`));
  }

  checks.push(ok(await dle.supportedChains(chainId), `supportedChains(${chainId})`));

  const init = await dle.initializer();
  detail.initializer = init;
  const bal = await dle.balanceOf(init);
  detail.initializerBalance = bal.toString();
  checks.push(ok(bal > 0n, 'initializer has tokens'));

  for (const [type, id] of Object.entries(MODULE_MAP)) {
    const expected = contour.expectModules.includes(type);
    const addr = await dle.getModuleAddress(id);
    const active = await dle.activeModules(id).catch(() => false);
    const code = await hasCode(provider, addr);
    const row = { address: addr, active, code };

    if (!expected) {
      if (addr !== ethers.ZeroAddress) {
        row.note = 'present but not required';
      }
      detail.modules[type] = row;
      continue;
    }

    checks.push(ok(addr !== ethers.ZeroAddress && active && code, `module ${type} registered+code`));

    if (addr !== ethers.ZeroAddress && code) {
      const mod = new ethers.Contract(addr, MODULE_ABI, provider);
      try {
        const dleRef = await mod.dleContract();
        checks.push(
          ok(String(dleRef).toLowerCase() === contour.dle.toLowerCase(), `${type}.dleContract match`)
        );
      } catch (_) {}

      const bridge = await readBridge(mod, type);
      row.bridge = bridge;
      const bridgeCode = await hasCode(provider, bridge);
      row.bridgeCode = bridgeCode;
      if (type === 'treasury' || contour.id === 'multitest') {
        checks.push(ok(bridgeCode, `${type} bridge has code`));
      } else if (bridge !== ethers.ZeroAddress) {
        checks.push(ok(bridgeCode, `${type} bridge optional but present`));
      }

      if (type === 'hierarchicalVoting') {
        try {
          const tre = await mod.treasuryModule();
          row.treasuryModule = tre;
          const treAddr = detail.modules.treasury?.address || ethers.ZeroAddress;
          checks.push(
            ok(
              String(tre).toLowerCase() === String(treAddr).toLowerCase(),
              'HV.treasuryModule matches treasury'
            )
          );
        } catch (_) {}
      }
      if (type === 'treasury') {
        try {
          const hv = await mod.hierarchicalVotingModule();
          row.hierarchicalVotingModule = hv;
          if (contour.expectModules.includes('hierarchicalVoting')) {
            checks.push(ok(hv !== ethers.ZeroAddress, 'treasury.HV set'));
          }
        } catch (_) {}
      }
    }
    detail.modules[type] = row;
  }

  if (contour.child) {
    const childCode = await hasCode(provider, contour.child);
    detail.child = { address: contour.child, code: childCode };
    checks.push(ok(childCode, 'child DLE has code'));
  }

  try {
    const minDur = await dle.minVotingDuration();
    const duration = minDur > 0n ? minDur : 3600n;
    const iface = new ethers.Interface(['function _transferTokens(address,address,uint256)']);
    const recipient = '0xceee9b5880361ce31C61dDED68724761A19b25fC';
    const op = iface.encodeFunctionData('_transferTokens', [init, recipient, ethers.parseEther('10')]);
    await dle.createProposal.staticCall('smoke transfer', duration, op, [chainId], 0, {
      from: init,
    });
    checks.push(ok(true, 'createProposal(_transferTokens) staticCall ok'));
  } catch (e) {
    checks.push(ok(false, `transfer createProposal static: ${e.shortMessage || e.message}`));
  }

  const failed = checks.filter((c) => !c.ok);
  return {
    contour: contour.id,
    chainId,
    pass: failed.length === 0,
    failed: failed.map((f) => f.msg),
    checks: checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.msg}`),
    detail,
  };
}

async function main() {
  const results = [];
  for (const contour of CONTOURS) {
    for (const chainId of contour.chains) {
      try {
        results.push(await smokeChain(contour, chainId));
      } catch (e) {
        results.push({
          contour: contour.id,
          chainId,
          pass: false,
          failed: [e.message],
          checks: [],
          detail: {},
        });
      }
    }
  }

  const summary = {
    ok: results.every((r) => r.pass),
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    retiredSkipped: [RETIRED_PARENT_A.id],
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exit(1);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
