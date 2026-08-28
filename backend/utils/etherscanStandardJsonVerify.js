/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Верификация Etherscan V2 standard-JSON из уже собранных Hardhat artifacts.
 * Не вызывать `npx hardhat verify`: дочерний compile (viaIR) даёт другой bytecode,
 * explorer отвечает "deployment bytecode does NOT match".
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const logger = require('./logger');

const ARTIFACTS_ROOT = path.join(__dirname, '..', 'artifacts');
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';

function parseFqn(fullyQualifiedName) {
  const idx = fullyQualifiedName.lastIndexOf(':');
  if (idx <= 0) {
    throw new Error(`Некорректный FQN контракта: ${fullyQualifiedName}`);
  }
  return {
    sourcePath: fullyQualifiedName.slice(0, idx),
    contractName: fullyQualifiedName.slice(idx + 1),
  };
}

function loadArtifactAndBuildInfo(fullyQualifiedName) {
  const { sourcePath, contractName } = parseFqn(fullyQualifiedName);
  const artifactDir = path.join(ARTIFACTS_ROOT, sourcePath);
  const artifactPath = path.join(artifactDir, `${contractName}.json`);
  const dbgPath = path.join(artifactDir, `${contractName}.dbg.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Артефакт не найден: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  let buildInfoPath;
  if (fs.existsSync(dbgPath)) {
    const dbg = JSON.parse(fs.readFileSync(dbgPath, 'utf8'));
    buildInfoPath = path.normalize(path.join(artifactDir, dbg.buildInfo));
  }
  if (!buildInfoPath || !fs.existsSync(buildInfoPath)) {
    throw new Error(`build-info не найден для ${fullyQualifiedName}`);
  }
  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  return { artifact, buildInfo };
}

function constructorArgsHexFromCreationData(creationTxData, artifactBytecode) {
  const data = String(creationTxData || '').toLowerCase().replace(/^0x/, '');
  const bytecode = String(artifactBytecode || '').toLowerCase().replace(/^0x/, '');
  if (!data || !bytecode) {
    throw new Error('Пустые creation data / bytecode');
  }
  if (!data.startsWith(bytecode)) {
    throw new Error(
      'CREATE-data не начинается с bytecode текущего artifact. Нельзя слать перекомпиляцию viaIR — соберите тот же artifact, что ушёл в CREATE.'
    );
  }
  return data.slice(bytecode.length);
}

async function etherscanGet(apiKey, chainId, query) {
  const url =
    `${ETHERSCAN_V2}?chainid=${Number(chainId)}&apikey=${encodeURIComponent(apiKey)}&${query}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  if (!text || text.trimStart().startsWith('<')) {
    throw new Error('Etherscan вернул HTML вместо JSON');
  }
  return JSON.parse(text);
}

async function isVerifiedOnExplorer(chainId, contractAddress, apiKey) {
  try {
    const json = await etherscanGet(
      apiKey,
      chainId,
      `module=contract&action=getsourcecode&address=${contractAddress}`
    );
    const source = json?.result?.[0]?.SourceCode;
    const abi = json?.result?.[0]?.ABI;
    return Boolean(source && source.length > 2 && abi && abi !== 'Contract source code not verified');
  } catch {
    return false;
  }
}

/**
 * verifysourcecode падает с "Unable to locate ContractCode", пока indexer
 * не подхватил CREATE. Ждём getcontractcreation / getsourcecode.
 */
async function waitUntilExplorerIndexed(apiKey, chainId, contractAddress, {
  timeoutMs = 180000,
  intervalMs = 8000,
} = {}) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const creation = await etherscanGet(
        apiKey,
        chainId,
        `module=contract&action=getcontractcreation&contractaddresses=${contractAddress}`
      );
      const txHash = creation?.result?.[0]?.txHash;
      if (txHash && String(txHash).startsWith('0x')) {
        logger.info(
          `[ETHERSCAN_VERIFY] explorer проиндексировал CREATE chainId=${chainId} tx=${txHash}`
        );
        return true;
      }
      last = String(creation?.result || creation?.message || 'no creation tx');
    } catch (e) {
      last = e.message || String(e);
    }
    try {
      const src = await etherscanGet(
        apiKey,
        chainId,
        `module=contract&action=getsourcecode&address=${contractAddress}`
      );
      const row = src?.result?.[0];
      if (row && (row.Address || row.address) && !/unable to locate contractcode/i.test(JSON.stringify(src))) {
        logger.info(`[ETHERSCAN_VERIFY] explorer видит контракт chainId=${chainId}`);
        return true;
      }
      last = String(src?.result || src?.message || last);
    } catch (e) {
      last = e.message || String(e);
    }
    logger.info(
      `[ETHERSCAN_VERIFY] ждём индексацию chainId=${chainId} ${Math.round((Date.now() - started) / 1000)}s: ${last}`
    );
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Explorer не проиндексировал контракт за ${timeoutMs}ms (${last})`);
}

async function fetchCreationTxData({ chainId, contractAddress, apiKey, rpcUrl }) {
  const json = await etherscanGet(
    apiKey,
    chainId,
    `module=contract&action=getcontractcreation&contractaddresses=${contractAddress}`
  );
  const txHash = json?.result?.[0]?.txHash;
  if (!txHash) {
    throw new Error(`getcontractcreation не вернул tx для ${contractAddress} chainId=${chainId}`);
  }
  if (!rpcUrl) {
    throw new Error('rpcUrl обязателен, чтобы прочитать CREATE tx');
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl, Number(chainId), { staticNetwork: true });
  const tx = await provider.getTransaction(txHash);
  if (!tx?.data) {
    throw new Error(`Нет data у CREATE tx ${txHash}`);
  }
  return tx.data;
}

async function pollVerification(apiKey, chainId, guid) {
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 8000));
    const st = await etherscanGet(
      apiKey,
      chainId,
      `module=contract&action=checkverifystatus&guid=${encodeURIComponent(guid)}`
    );
    const result = String(st.result || st.message || '');
    logger.info(`[ETHERSCAN_VERIFY] chainId=${chainId} poll=${i} ${result}`);
    if (/pass|already verified/i.test(result)) {
      return { success: true, message: result, guid };
    }
    if (/pending/i.test(result)) continue;
    if (st.status === '0' && /fail/i.test(result)) {
      return { success: false, error: result, guid };
    }
  }
  return { success: false, error: 'Timeout ожидания checkverifystatus', guid };
}

/**
 * @param {object} opts
 * @param {number} opts.chainId
 * @param {string} opts.contractAddress
 * @param {string} opts.fullyQualifiedName contracts/DLE.sol:DLE
 * @param {string} opts.apiKey
 * @param {string} [opts.creationTxData] raw tx.data CREATE
 * @param {string} [opts.constructorArgsHex] без 0x, если creationTxData нет
 * @param {string} [opts.rpcUrl] для getcontractcreation fallback
 */
async function verifyWithStandardJson({
  chainId,
  contractAddress,
  fullyQualifiedName,
  apiKey,
  creationTxData,
  constructorArgsHex,
  rpcUrl,
}) {
  if (!apiKey) {
    return { success: false, error: 'API ключ Etherscan не предоставлен' };
  }
  if (!contractAddress) {
    return { success: false, error: 'Нет адреса контракта' };
  }

  if (await isVerifiedOnExplorer(chainId, contractAddress, apiKey)) {
    logger.info(`[ETHERSCAN_VERIFY] уже верифицирован ${contractAddress} chainId=${chainId}`);
    return { success: true, message: 'Already verified' };
  }

  await waitUntilExplorerIndexed(apiKey, chainId, contractAddress);

  const { artifact, buildInfo } = loadArtifactAndBuildInfo(fullyQualifiedName);
  let argsHex = constructorArgsHex ? String(constructorArgsHex).replace(/^0x/i, '') : '';
  let data = creationTxData;
  if (!data && rpcUrl) {
    data = await fetchCreationTxData({ chainId, contractAddress, apiKey, rpcUrl });
  }
  if (data) {
    argsHex = constructorArgsHexFromCreationData(data, artifact.bytecode);
  }
  if (!argsHex) {
    return { success: false, error: 'Нет constructor args hex (нужен CREATE tx.data или явный hex)' };
  }

  const solc = String(buildInfo.solcLongVersion || '');
  const compilerversion = solc.startsWith('v') ? solc : `v${solc}`;

  const body = new URLSearchParams({
    chainid: String(Number(chainId)),
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    sourceCode: JSON.stringify(buildInfo.input),
    codeformat: 'solidity-standard-json-input',
    contractname: fullyQualifiedName,
    compilerversion,
    constructorArguements: argsHex,
    optimizationUsed: buildInfo.input?.settings?.optimizer?.enabled ? '1' : '0',
    runs: String(buildInfo.input?.settings?.optimizer?.runs ?? 0),
    evmversion: buildInfo.input?.settings?.evmVersion || 'paris',
    licenseType: '3',
  });

  const maxSubmit = 6;
  for (let attempt = 1; attempt <= maxSubmit; attempt++) {
    logger.info(
      `[ETHERSCAN_VERIFY] submit ${attempt}/${maxSubmit} chainId=${chainId} ${fullyQualifiedName} argsHexLen=${argsHex.length} solc=${compilerversion}`
    );
    const submitted = await fetch(`${ETHERSCAN_V2}?chainid=${Number(chainId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    }).then(async (res) => {
      const text = await res.text();
      if (!text || text.trimStart().startsWith('<')) {
        throw new Error('Etherscan POST вернул HTML');
      }
      return JSON.parse(text);
    });

    const submitResult = String(submitted.result || submitted.message || '');
    if (/already verified/i.test(submitResult)) {
      return { success: true, message: 'Already verified' };
    }
    if (submitted.status === '1') {
      return pollVerification(apiKey, chainId, submitted.result);
    }
    if (/unable to locate contractcode/i.test(submitResult) && attempt < maxSubmit) {
      logger.warn(`[ETHERSCAN_VERIFY] indexer ещё не готов (попытка ${attempt}): ${submitResult}`);
      await waitUntilExplorerIndexed(apiKey, chainId, contractAddress, {
        timeoutMs: 60000,
        intervalMs: 8000,
      }).catch(() => {});
      await new Promise((r) => setTimeout(r, 10000));
      continue;
    }
    return { success: false, error: submitResult || 'verifysourcecode NOTOK' };
  }
  return { success: false, error: 'verifysourcecode NOTOK after retries' };
}

module.exports = {
  verifyWithStandardJson,
  constructorArgsHexFromCreationData,
  loadArtifactAndBuildInfo,
  fetchCreationTxData,
  isVerifiedOnExplorer,
  waitUntilExplorerIndexed,
};
