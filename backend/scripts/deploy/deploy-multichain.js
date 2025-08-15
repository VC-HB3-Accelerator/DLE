/* eslint-disable no-console */
const hre = require('hardhat');
const path = require('path');

// Подбираем безопасные gas/fee для разных сетей (включая L2)
async function getFeeOverrides(provider, { minPriorityGwei = 1n, minFeeGwei = 20n } = {}) {
  const fee = await provider.getFeeData();
  const overrides = {};
  const minPriority = (await (async () => hre.ethers.parseUnits(minPriorityGwei.toString(), 'gwei'))());
  const minFee = (await (async () => hre.ethers.parseUnits(minFeeGwei.toString(), 'gwei'))());
  if (fee.maxFeePerGas) {
    overrides.maxFeePerGas = fee.maxFeePerGas < minFee ? minFee : fee.maxFeePerGas;
    overrides.maxPriorityFeePerGas = (fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas > 0n)
      ? fee.maxPriorityFeePerGas
      : minPriority;
  } else if (fee.gasPrice) {
    overrides.gasPrice = fee.gasPrice < minFee ? minFee : fee.gasPrice;
  }
  return overrides;
}

async function deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetFactoryNonce, dleInit) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();

  // DEBUG: базовая информация по сети
  try {
    const calcInitHash = ethers.keccak256(dleInit);
    const saltLen = ethers.getBytes(salt).length;
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} rpc=${rpcUrl}`);
    console.log(`[MULTI_DBG] wallet=${wallet.address} targetFactoryNonce=${targetFactoryNonce}`);
    console.log(`[MULTI_DBG] saltLenBytes=${saltLen} salt=${salt}`);
    console.log(`[MULTI_DBG] initCodeHash(provided)=${initCodeHash}`);
    console.log(`[MULTI_DBG] initCodeHash(calculated)=${calcInitHash}`);
    console.log(`[MULTI_DBG] dleInit.lenBytes=${ethers.getBytes(dleInit).length} head16=${dleInit.slice(0, 34)}...`);
  } catch (e) {
    console.log('[MULTI_DBG] precheck error', e?.message || e);
  }

  // 1) Выравнивание nonce до targetFactoryNonce нулевыми транзакциями (если нужно)
  let current = await provider.getTransactionCount(wallet.address, 'pending');
  if (current > targetFactoryNonce) {
    throw new Error(`Current nonce ${current} > targetFactoryNonce ${targetFactoryNonce} on chainId=${Number(net.chainId)}`);
  }
  while (current < targetFactoryNonce) {
    const overrides = await getFeeOverrides(provider);
    let gasLimit = 50000; // некоторые L2 требуют >21000
    let sent = false;
    let lastErr = null;
    for (let attempt = 0; attempt < 2 && !sent; attempt++) {
      try {
        const txReq = {
          to: wallet.address,
          value: 0n,
          nonce: current,
          gasLimit,
          ...overrides
        };
        const txFill = await wallet.sendTransaction(txReq);
        await txFill.wait();
        sent = true;
      } catch (e) {
        lastErr = e;
        if (String(e?.message || '').toLowerCase().includes('intrinsic gas too low') && attempt === 0) {
          gasLimit = 100000; // поднимаем лимит и пробуем ещё раз
          continue;
        }
        throw e;
      }
    }
    if (!sent) throw lastErr || new Error('filler tx failed');
    current++;
  }

  // 2) Деплой FactoryDeployer на согласованном nonce
  const FactoryCF = await hre.ethers.getContractFactory('FactoryDeployer', wallet);
  const feeOverrides = await getFeeOverrides(provider);
  const factoryContract = await FactoryCF.deploy({ nonce: targetFactoryNonce, ...feeOverrides });
  await factoryContract.waitForDeployment();
  const factoryAddress = await factoryContract.getAddress();
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} FactoryDeployer.address=${factoryAddress}`);

  // 3) Деплой DLE через CREATE2
  const Factory = await hre.ethers.getContractAt('FactoryDeployer', factoryAddress, wallet);
  const n = await provider.getTransactionCount(wallet.address, 'pending');
  let tx;
  try {
    // Предварительная проверка конструктора вне CREATE2 (даст явную причину, если он ревертится)
    try {
      await wallet.estimateGas({ data: dleInit });
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} predeploy(estGas) ok for constructor`);
    } catch (e) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} predeploy(estGas) failed: ${e?.reason || e?.shortMessage || e?.message || e}`);
      if (e?.data) console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} predeploy revert data: ${e.data}`);
    }
    // Оцениваем газ и добавляем запас
    const est = await Factory.deploy.estimateGas(salt, dleInit, { nonce: n, ...feeOverrides }).catch(() => null);
    // Рассчитываем доступный gasLimit из баланса
    let gasLimit;
    try {
      const balance = await provider.getBalance(wallet.address, 'latest');
      const effPrice = feeOverrides.maxFeePerGas || feeOverrides.gasPrice || 0n;
      const reserve = hre.ethers.parseEther('0.005');
      const maxByBalance = effPrice > 0n && balance > reserve ? (balance - reserve) / effPrice : 3_000_000n;
      const fallbackGas = maxByBalance > 5_000_000n ? 5_000_000n : (maxByBalance < 2_500_000n ? 2_500_000n : maxByBalance);
      gasLimit = est ? (est + est / 5n) : fallbackGas;
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
    } catch (_) {
      const fallbackGas = 3_000_000n;
      gasLimit = est ? (est + est / 5n) : fallbackGas;
    }
    // DEBUG: ожидаемый адрес через computeAddress
    try {
      const predicted = await Factory.computeAddress(salt, initCodeHash);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} predictedAddress=${predicted}`);
      // Idempotency: если уже есть код по адресу, пропускаем деплой
      const code = await provider.getCode(predicted);
      if (code && code !== '0x') {
        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} code already exists at predictedAddress, skip deploy`);
        return { factory: factoryAddress, address: predicted, chainId: Number(net.chainId) };
      }
    } catch (e) {
      console.log('[MULTI_DBG] computeAddress(before) error', e?.message || e);
    }
    tx = await Factory.deploy(salt, dleInit, { nonce: n, gasLimit, ...feeOverrides });
  } catch (e) {
    const n2 = await provider.getTransactionCount(wallet.address, 'pending');
    const est2 = await Factory.deploy.estimateGas(salt, dleInit, { nonce: n2, ...feeOverrides }).catch(() => null);
    let gasLimit2;
    try {
      const balance2 = await provider.getBalance(wallet.address, 'latest');
      const effPrice2 = feeOverrides.maxFeePerGas || feeOverrides.gasPrice || 0n;
      const reserve2 = hre.ethers.parseEther('0.005');
      const maxByBalance2 = effPrice2 > 0n && balance2 > reserve2 ? (balance2 - reserve2) / effPrice2 : 3_000_000n;
      const fallbackGas2 = maxByBalance2 > 5_000_000n ? 5_000_000n : (maxByBalance2 < 2_500_000n ? 2_500_000n : maxByBalance2);
      gasLimit2 = est2 ? (est2 + est2 / 5n) : fallbackGas2;
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} RETRY estGas=${est2?.toString?.()||'null'} effGasPrice=${effPrice2?.toString?.()||'0'} maxByBalance=${maxByBalance2.toString()} chosenGasLimit=${gasLimit2.toString()}`);
    } catch (_) {
      gasLimit2 = est2 ? (est2 + est2 / 5n) : 3_000_000n;
    }
    console.log(`[MULTI_DBG] retry deploy with nonce=${n2} gasLimit=${gasLimit2?.toString?.() || 'auto'}`);
    console.log(`[MULTI_DBG] deploy error(first) ${e?.message || e}`);
    tx = await Factory.deploy(salt, dleInit, { nonce: n2, gasLimit: gasLimit2, ...feeOverrides });
  }
  const rc = await tx.wait();
  let addr = rc.logs?.[0]?.args?.addr;
  if (!addr) {
    try {
      addr = await Factory.computeAddress(salt, initCodeHash);
    } catch (e) {
      console.log('[MULTI_DBG] computeAddress(after) error', e?.message || e);
    }
  }
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} deployedAddress=${addr}`);
  return { factory: factoryAddress, address: addr, chainId: Number(net.chainId) };
}

async function main() {
  const { ethers } = hre;
  const pk = process.env.PRIVATE_KEY;
  const salt = process.env.CREATE2_SALT;
  const initCodeHash = process.env.INIT_CODE_HASH;
  const networks = (process.env.MULTICHAIN_RPC_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const factories = (process.env.MULTICHAIN_FACTORY_ADDRESSES || '').split(',').map(s => s.trim());

  if (!pk) throw new Error('Env: PRIVATE_KEY');
  if (!salt) throw new Error('Env: CREATE2_SALT');
  if (!initCodeHash) throw new Error('Env: INIT_CODE_HASH');
  if (networks.length === 0) throw new Error('Env: MULTICHAIN_RPC_URLS');

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
  // DEBUG: глобальные значения
  try {
    const calcInitHash = ethers.keccak256(dleInit);
    const saltLen = ethers.getBytes(salt).length;
    console.log(`[MULTI_DBG] GLOBAL saltLenBytes=${saltLen} salt=${salt}`);
    console.log(`[MULTI_DBG] GLOBAL initCodeHash(provided)=${initCodeHash}`);
    console.log(`[MULTI_DBG] GLOBAL initCodeHash(calculated)=${calcInitHash}`);
    console.log(`[MULTI_DBG] GLOBAL dleInit.lenBytes=${ethers.getBytes(dleInit).length} head16=${dleInit.slice(0, 34)}...`);
  } catch (e) {
    console.log('[MULTI_DBG] GLOBAL precheck error', e?.message || e);
  }

  // Подготовим провайдеры и вычислим общий nonce для фабрики
  const providers = networks.map(u => new hre.ethers.JsonRpcProvider(u));
  const wallets = providers.map(p => new hre.ethers.Wallet(pk, p));
  const nonces = [];
  for (let i = 0; i < providers.length; i++) {
    const n = await providers[i].getTransactionCount(wallets[i].address, 'pending');
    nonces.push(n);
  }
  const targetFactoryNonce = Math.max(...nonces);
  console.log(`[MULTI_DBG] nonces=${JSON.stringify(nonces)} targetFactoryNonce=${targetFactoryNonce}`);

  const results = [];
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    const r = await deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetFactoryNonce, dleInit);
    results.push({ rpcUrl, ...r });
  }
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify(results));
}

main().catch((e) => { console.error(e); process.exit(1); });


