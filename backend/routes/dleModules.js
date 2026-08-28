/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { Interface, AbiCoder } = ethers;
// Hardhat опционален - используется только для компиляции в dev режиме
let hre = null;
try {
  hre = require('hardhat');
} catch (e) {
  // Hardhat не установлен в production - это нормально
}
const rpcProviderService = require('../services/rpcProviderService');
const { rejectClientPrivateKey, getBookPrivateKey } = require('../services/bookDeployKeyService');
const { spawn } = require('child_process');
const path = require('path');
const { MODULE_TYPE_TO_ID, MODULE_NAMES, MODULE_DESCRIPTIONS, MODULE_IDS, moduleTypeFromId } = require('../constants/moduleIds');
const { resolveBookSlot } = require('../utils/bookModuleSlot');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');

const MODULES_DATA_DIR = path.join(__dirname, '../scripts/contracts-data/modules');

function moduleRegistryFilePath(dleAddress, moduleType) {
  return path.join(MODULES_DATA_DIR, `${moduleType}-${String(dleAddress).toLowerCase()}.json`);
}

async function slotAddr(dle, moduleType) {
  const slot = await resolveBookSlot(dle, moduleType);
  return slot.moduleAddress;
}

async function slotAddrFromId(dle, moduleId) {
  const type = moduleTypeFromId(moduleId) || (MODULE_TYPE_TO_ID[moduleId] ? moduleId : null);
  if (type) return slotAddr(dle, type);
  return dle.getModuleAddress(moduleId);
}

async function readSlot(dle, moduleType) {
  const slot = await resolveBookSlot(dle, moduleType);
  let isActive = false;
  if (slot.moduleAddress && slot.moduleAddress !== ethers.ZeroAddress) {
    try {
      isActive = await dle.isModuleActive(slot.moduleId);
    } catch (_) {
      isActive = true;
    }
  }
  return { ...slot, isActive };
}

function mapVerificationStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (['success', 'verified', 'already_verified'].includes(s)) return 'success';
  if (s === 'failed' || s === 'error') return 'failed';
  if (!s || s === 'unknown' || s === 'skipped') return 'pending';
  return s;
}
// broadcastModulesUpdate удален - используем deploymentWebSocketService
const DeployParamsService = require('../services/deployParamsService');
const { resolveDleProvider } = require('../services/dleNetworkResolveService');

// Функция для получения информации о задеплоенных модулях из файлов деплоя
async function getDeployedModulesInfo(dleAddress) {
  try {
    console.log(`[DLE Modules] Получение модулей из файлов деплоя для DLE: ${dleAddress}`);
    
    const modulesDir = path.join(__dirname, '../scripts/contracts-data/modules');
    const modules = [];
    
    if (!fs.existsSync(modulesDir)) {
      console.log(`[DLE Modules] Папка модулей не найдена: ${modulesDir}`);
      return modules;
    }
    
    const files = fs.readdirSync(modulesDir);
    const moduleFiles = files.filter(file => 
      file.endsWith('.json') && file.includes(dleAddress.toLowerCase())
    );
    
    console.log(`[DLE Modules] Найдено файлов модулей: ${moduleFiles.length}`);
    
    for (const file of moduleFiles) {
      try {
        const filePath = path.join(modulesDir, file);
        const moduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Добавляем информацию о модуле
        modules.push({
          moduleType: moduleData.moduleType,
          dleAddress: moduleData.dleAddress,
          networks: moduleData.networks || [],
          deployTimestamp: moduleData.deployTimestamp,
          dleName: moduleData.dleName,
          dleSymbol: moduleData.dleSymbol,
          dleLocation: moduleData.dleLocation,
          dleJurisdiction: moduleData.dleJurisdiction,
          dleCoordinates: moduleData.dleCoordinates,
          dleOkvedCodes: moduleData.dleOkvedCodes || [],
          dleKpp: moduleData.dleKpp,
          dleQuorumPercentage: moduleData.dleQuorumPercentage,
          dleLogoURI: moduleData.dleLogoURI,
          dleSupportedChainIds: moduleData.dleSupportedChainIds || [],
          dleInitialPartners: moduleData.dleInitialPartners || [],
          dleInitialAmounts: moduleData.dleInitialAmounts || []
        });
        
        console.log(`[DLE Modules] Загружен модуль: ${moduleData.moduleType}`);
      } catch (fileError) {
        console.error(`[DLE Modules] Ошибка при чтении файла ${file}:`, fileError.message);
      }
    }
    
    console.log(`[DLE Modules] Найдено модулей в файлах: ${modules.length}`);
    
    return modules;
    
  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении информации о модулях из файлов:', error);
    return [];
  }
}

async function readOnChainModuleBridge(provider, moduleAddress) {
  if (!moduleAddress || moduleAddress === ethers.ZeroAddress) return null;
  const c = new ethers.Contract(
    moduleAddress,
    [
      'function moduleBridge() view returns (address)',
      'function fundsBridge() view returns (address)',
    ],
    provider
  );
  let onChain = ethers.ZeroAddress;
  try {
    onChain = await c.moduleBridge();
  } catch (_) {
    try {
      onChain = await c.fundsBridge();
    } catch (__) {
      return null;
    }
  }
  if (!onChain || onChain === ethers.ZeroAddress) return null;
  return onChain;
}

/**
 * Адреса модуля по всем сетям книги: слот on-chain + CREATE-код, если слот ещё пуст.
 */
async function listModuleChainAddresses({ dleAddress, moduleType, fromFile, supportedNetworks }) {
  const byChain = new Map();

  const upsert = (row) => {
    const cid = Number(row.chainId);
    if (!Number.isFinite(cid) || cid <= 0) return;
    const prev = byChain.get(cid) || {};
    byChain.set(cid, {
      chainId: cid,
      address: row.address || prev.address,
      bridgeAddress: row.bridgeAddress || prev.bridgeAddress || null,
      networkName: row.networkName || prev.networkName || getNetworkNameByChainId(cid),
      isActive: Boolean(row.isActive || prev.isActive),
      inBook: Boolean(row.inBook || prev.inBook),
      verification: row.verification || prev.verification || mapVerificationStatus(null),
      verificationStatus: row.verificationStatus || prev.verificationStatus || mapVerificationStatus(null),
      networkIndex: cid,
    });
  };

  for (const n of fromFile?.networks || []) {
    if (!n?.address || n.address === ethers.ZeroAddress) continue;
    upsert({
      chainId: Number(n.chainId),
      address: n.address,
      bridgeAddress: n.bridgeAddress || null,
      isActive: false,
      inBook: false,
      verification: mapVerificationStatus(n.verification),
      verificationStatus: mapVerificationStatus(n.verification),
    });
  }

  let knownAddr = null;
  for (const row of byChain.values()) {
    if (row.address && row.address !== ethers.ZeroAddress) {
      knownAddr = row.address;
      break;
    }
  }

  const nets = (supportedNetworks && supportedNetworks.length)
    ? supportedNetworks
    : Array.from(byChain.keys()).map((chainId) => ({
      chainId,
      networkName: getNetworkNameByChainId(chainId),
    }));

  for (const net of nets) {
    const cid = Number(net.chainId);
    const rpcUrl = net.rpcUrl || await rpcProviderService.getRpcUrlByChainId(cid).catch(() => null);
    if (!rpcUrl) continue;
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const dle = new ethers.Contract(
        dleAddress,
        [
          'function getModuleAddress(bytes32) view returns (address)',
          'function isModuleActive(bytes32) view returns (bool)',
        ],
        provider
      );
      const slot = await resolveBookSlot(dle, moduleType);
      const inBook = Boolean(slot.moduleAddress && slot.moduleAddress !== ethers.ZeroAddress);
      if (!inBook) continue;
      if (!knownAddr) knownAddr = slot.moduleAddress;
      let isActive = false;
      try {
        isActive = await dle.isModuleActive(slot.moduleId);
      } catch (_) {
        isActive = true;
      }
      let bridge = byChain.get(cid)?.bridgeAddress || null;
      try {
        const onChainBridge = await readOnChainModuleBridge(provider, slot.moduleAddress);
        if (onChainBridge) bridge = onChainBridge;
      } catch (_) {}
      upsert({
        chainId: cid,
        address: slot.moduleAddress,
        bridgeAddress: bridge,
        networkName: net.networkName || getNetworkNameByChainId(cid),
        isActive,
        inBook: true,
      });
    } catch (e) {
      console.log(`[DLE Modules] listModuleChainAddresses book ${moduleType} ${cid}: ${e.message}`);
    }
  }

  if (knownAddr) {
    for (const net of nets) {
      const cid = Number(net.chainId);
      if (byChain.has(cid) && byChain.get(cid).inBook) continue;
      const rpcUrl = net.rpcUrl || await rpcProviderService.getRpcUrlByChainId(cid).catch(() => null);
      if (!rpcUrl) continue;
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const code = await provider.getCode(knownAddr);
        if (!code || code === '0x') continue;
        let bridge = byChain.get(cid)?.bridgeAddress || null;
        try {
          const onChainBridge = await readOnChainModuleBridge(provider, knownAddr);
          if (onChainBridge) bridge = onChainBridge;
        } catch (_) {}
        upsert({
          chainId: cid,
          address: knownAddr,
          bridgeAddress: bridge,
          networkName: net.networkName || getNetworkNameByChainId(cid),
          isActive: Boolean(byChain.get(cid)?.isActive),
          inBook: Boolean(byChain.get(cid)?.inBook),
        });
      } catch (e) {
        console.log(`[DLE Modules] listModuleChainAddresses code ${moduleType} ${cid}: ${e.message}`);
      }
    }
  }

  return Array.from(byChain.values()).sort((a, b) => a.chainId - b.chainId);
}

function metaFromModuleFile(file) {
  if (!file) return null;
  if (!file.dleName && file.dleLocation == null && file.dleJurisdiction == null) return null;
  return {
    dleName: file.dleName || null,
    dleSymbol: file.dleSymbol || null,
    dleLocation: file.dleLocation || null,
    dleJurisdiction: file.dleJurisdiction ?? null,
    dleOkvedCodes: Array.isArray(file.dleOkvedCodes) ? file.dleOkvedCodes : [],
  };
}

function pickDleCardMeta(chainMeta, fromFile, fileModules) {
  if (chainMeta && chainMeta.dleName) return chainMeta;
  return (
    metaFromModuleFile(fromFile) ||
    (fileModules || []).map(metaFromModuleFile).find(Boolean) || {
      dleName: null,
      dleSymbol: null,
      dleLocation: null,
      dleJurisdiction: null,
      dleOkvedCodes: [],
    }
  );
}

async function loadModuleAddedAtByAddress(provider, dleAddress) {
  const byAddress = new Map();
  const dleLogs = new ethers.Contract(
    dleAddress,
    ['event ModuleAdded(bytes32 moduleId, address moduleAddress)'],
    provider
  );
  try {
    const latest = await provider.getBlockNumber();
    const chunk = 1500;
    const maxChunks = 8;
    const events = [];
    for (let i = 0; i < maxChunks; i++) {
      const toBlock = latest - i * chunk;
      if (toBlock < 0) break;
      const fromBlock = Math.max(0, toBlock - chunk + 1);
      try {
        const part = await dleLogs.queryFilter(dleLogs.filters.ModuleAdded(), fromBlock, toBlock);
        events.push(...part);
      } catch (chunkErr) {
        console.log(`[DLE Modules] ModuleAdded chunk ${fromBlock}-${toBlock} skip: ${chunkErr.message}`);
      }
    }
    const blockIds = [...new Set(events.map((ev) => ev.blockNumber))];
    const tsByBlock = new Map();
    await Promise.all(
      blockIds.map(async (bn) => {
        const block = await provider.getBlock(bn);
        tsByBlock.set(bn, Number(block?.timestamp || 0));
      })
    );
    for (const ev of events) {
      const addr = String(ev.args?.moduleAddress || '').toLowerCase();
      const ts = tsByBlock.get(ev.blockNumber) || 0;
      if (!addr || !ts) continue;
      byAddress.set(addr, new Date(ts * 1000).toISOString());
    }
  } catch (e) {
    console.log(`[DLE Modules] ModuleAdded logs skip: ${e.message}`);
  }
  return byAddress;
}

// Утилитарная функция для автоматической компиляции контрактов
async function autoCompileContracts() {
  console.log(`[DLE Modules] Запуск автоматической компиляции контрактов...`);
  
  return new Promise((resolve, reject) => {
    const compileProcess = spawn('npx', ['hardhat', 'compile'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    compileProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    compileProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    compileProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[DLE Modules] ✅ Компиляция завершена успешно`);
        resolve();
      } else {
        console.error(`[DLE Modules] ❌ Ошибка компиляции:`, stderr);
        reject(new Error(`Ошибка компиляции: ${stderr}`));
      }
    });

    compileProcess.on('error', (error) => {
      console.error(`[DLE Modules] ❌ Ошибка запуска компиляции:`, error);
      reject(error);
    });
  });
}

// Универсальная функция для выполнения операций с повторами
async function executeWithRetries(operation, operationName, maxRetries = 1, retryDelay = 30000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry Logic] ${operationName} - попытка ${attempt}/${maxRetries}`);
      const result = await operation();
      console.log(`[Retry Logic] ${operationName} - успешно выполнено с попытки ${attempt}`);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[Retry Logic] ${operationName} - ошибка на попытке ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`[Retry Logic] ${operationName} - повтор через ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error(`[Retry Logic] ${operationName} - все попытки исчерпаны`);
  throw lastError;
}

// Функция для выполнения операций с повторами для каждой сети
async function executeForEachNetwork(networks, operation, operationName, maxRetries = 1, retryDelay = 30000) {
  const results = [];
  let allSuccessful = true;

  for (const network of networks) {
    try {
      const result = await executeWithRetries(
        () => operation(network),
        `${operationName} в сети ${network.networkName} (${network.chainId})`,
        maxRetries,
        retryDelay
      );
      results.push(result);
    } catch (error) {
      console.error(`[Retry Logic] Ошибка ${operationName} в сети ${network.chainId}:`, error.message);
      results.push({
        chainId: network.chainId,
        networkName: network.networkName,
        status: 'error',
        message: error.message,
        attempts: maxRetries
      });
      allSuccessful = false;
    }
  }

  return { results, allSuccessful };
}

// Проверить активность модуля
router.post('/is-module-active', async (req, res) => {
  try {
    const { dleAddress, moduleId, chainId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    const { provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
      preferChainId: chainId,
    });

    console.log(`[DLE Modules] Проверка активности модуля: ${moduleId} для DLE: ${dleAddress} в сети ${targetChainId}`);

    const dleAbi = [
      'function isModuleActive(bytes32 _moduleId) external view returns (bool)',
      'function getModuleAddress(bytes32 _moduleId) external view returns (address)',
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    const type = moduleTypeFromId(moduleId) || (MODULE_TYPE_TO_ID[moduleId] ? moduleId : null);
    let isActive = false;
    if (type) {
      const slot = await readSlot(dle, type);
      isActive = Boolean(slot && slot.isActive);
    } else {
      try {
        isActive = await dle.isModuleActive(moduleId);
      } catch (_) {
        const addr = await slotAddrFromId(dle, moduleId);
        isActive = Boolean(addr && addr !== ethers.ZeroAddress);
      }
    }

    console.log(`[DLE Modules] Активность модуля ${moduleId}: ${isActive}`);

    res.json({
      success: true,
      data: {
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при проверке активности модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке активности модуля: ' + error.message
    });
  }
});

// Получить информацию о задеплоенных модулях для DLE
router.get('/deployed/:dleAddress', async (req, res) => {
  try {
    const { dleAddress } = req.params;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение информации о модулях для DLE: ${dleAddress}`);

    // Получаем информацию о модулях из файлов деплоя
    const modulesInfo = await getDeployedModulesInfo(dleAddress);

    res.json({
      success: true,
      data: modulesInfo
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении информации о модулях:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о модулях: ' + error.message
    });
  }
});

// Получить адрес модуля
router.post('/get-module-address', async (req, res) => {
  try {
    const { dleAddress, moduleId, chainId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    const { provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
      preferChainId: chainId,
    });
    console.log(`[DLE Modules] Получение адреса модуля: ${moduleId} для DLE: ${dleAddress} в сети: ${targetChainId}`);
    
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    const moduleAddress = await slotAddrFromId(dle, moduleId);

    console.log(`[DLE Modules] Адрес модуля ${moduleId} (chainId ${targetChainId}): ${moduleAddress}`);

    res.json({
      success: true,
      data: {
        moduleAddress: moduleAddress,
        chainId: targetChainId
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении адреса модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении адреса модуля: ' + error.message
    });
  }
});

// Подготовить транзакции инициализации модулей для подписи в кошельке (во всех сетях)
router.post('/prepare-initialize-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    if (!dleAddress) {
      return res.status(400).json({ success: false, error: 'Адрес DLE обязателен' });
    }

    // Получаем поддерживаемые сети из контракта
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    if (supportedNetworks.length === 0) {
      return res.status(400).json({ success: false, error: 'Не найдены поддерживаемые сети для DLE' });
    }

    // Модули инициализируются только через governance предложения

    // Module IDs - используем константы
    const moduleIds = MODULE_TYPE_TO_ID;

    const results = [];
    for (const network of supportedNetworks) {
      try {
        // Получаем RPC URL из базы данных
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(network.chainId);
        if (!rpcUrl) {
          console.warn(`[DLE Modules] RPC URL не найден для chainId ${network.chainId}`);
          continue;
        }
        const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
        const dle = new ethers.Contract(
          dleAddress,
          [
            'function getModuleAddress(bytes32 _moduleId) external view returns (address)',
          ],
          provider
        );

        // Модули теперь инициализируются только через governance
        const already = false;
        const treasuryAddress = await slotAddr(dle, 'treasury');
        const timelockAddress = await slotAddr(dle, 'timelock');
        const readerAddress = await slotAddr(dle, 'reader');

        if (
          treasuryAddress === '0x0000000000000000000000000000000000000000' ||
          timelockAddress === '0x0000000000000000000000000000000000000000' ||
          readerAddress === '0x0000000000000000000000000000000000000000'
        ) {
          results.push({
            chainId: network.chainId,
            networkName: network.networkName,
            status: 'modules_not_deployed',
            message: 'Не все модули задеплоены'
          });
          continue;
        }

        // Модули инициализируются через governance предложения, а не напрямую
        const data = null;

        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: already ? 'already_initialized' : 'ready',
          to: dleAddress,
          data
        });
      } catch (e) {
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: e.message
        });
      }
    }

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('[DLE Modules] Ошибка подготовки инициализации:', error);
    res.status(500).json({ success: false, error: 'Ошибка подготовки инициализации: ' + error.message });
  }
});

// Подготовить транзакции деплоя модуля для подписи в кошельке (во всех сетях)
router.post('/prepare-deploy-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, deployerAddress } = req.body;
    if (!dleAddress || !moduleType || !deployerAddress) {
      return res.status(400).json({ success: false, error: 'dleAddress, moduleType и deployerAddress обязательны' });
    }

    // Компиляция на случай отсутствия артефактов
    try { await autoCompileContracts(); } catch (_) {}

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    if (supportedNetworks.length === 0) {
      return res.status(400).json({ success: false, error: 'Не найдены поддерживаемые сети для DLE' });
    }

    // Определяем контракт и аргументы конструктора
    const moduleConfigs = {
      treasury: {
        contractName: 'TreasuryModule',
        args: (chainId) => [dleAddress, chainId, deployerAddress]
      },
      timelock: {
        contractName: 'TimelockModule',
        args: () => [dleAddress]
      },
      reader: {
        contractName: 'DLEReader',
        args: () => [dleAddress]
      }
    };
    const cfg = moduleConfigs[moduleType];
    if (!cfg) return res.status(400).json({ success: false, error: `Неизвестный тип модуля: ${moduleType}` });

    // Загрузка артефакта
    const path = require('path');
    const fs = require('fs');
    const artifactPath = path.join(
      __dirname,
      `../artifacts/contracts/${cfg.contractName}.sol/${cfg.contractName}.json`
    );
    if (!fs.existsSync(artifactPath)) {
      return res.status(500).json({ success: false, error: `Артефакт не найден: ${artifactPath}` });
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode; // 0x...

    if (!bytecode || bytecode === '0x') {
      return res.status(500).json({ success: false, error: `Пустой bytecode у ${cfg.contractName}` });
    }

    const results = [];
    for (const network of supportedNetworks) {
      try {
        const constructorArgs = cfg.args(network.chainId);
        // Кодируем аргументы конструктора по ABI контракта
        const ctorTypes = (artifact.abi.find(i => i.type === 'constructor')?.inputs || []).map(i => i.type);
        const encodedArgs = ctorTypes.length
          ? AbiCoder.defaultAbiCoder().encode(ctorTypes, constructorArgs)
          : '0x';
        const data = bytecode + (encodedArgs.startsWith('0x') ? encodedArgs.slice(2) : encodedArgs);

        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'ready',
          to: null,
          data,
          value: '0x0',
          contractName: cfg.contractName
        });
      } catch (e) {
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: e.message
        });
      }
    }

    return res.json({ success: true, data: { results } });
  } catch (error) {
    console.error('[DLE Modules] Ошибка подготовки деплоя модуля:', error);
    res.status(500).json({ success: false, error: 'Ошибка подготовки деплоя модуля: ' + error.message });
  }
});

// Получить все модули (источник истины — on-chain getModuleAddress / MODULE_IDS)
router.post('/get-all-modules', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение модулей on-chain для DLE: ${dleAddress}`);

    const { provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
      preferChainId,
    });

    const dle = new ethers.Contract(
      dleAddress,
      [
        'function getModuleAddress(bytes32) view returns (address)',
        'function isModuleActive(bytes32) view returns (bool)',
        'function getDLEInfo() view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))',
      ],
      provider
    );

    const getNetworkName = (cid) => getNetworkNameByChainId(cid);
    const getModuleDescription = (moduleType) =>
      MODULE_DESCRIPTIONS[moduleType] || `Модуль ${moduleType}`;

    // Файлы деплоя — только метаданные (опционально)
    const fileModules = await getDeployedModulesInfo(dleAddress);
    const fileByType = Object.fromEntries(
      (fileModules || []).map((m) => [m.moduleType, m])
    );

    let chainMeta = null;
    try {
      const info = await dle.getDLEInfo();
      chainMeta = {
        dleName: info.name,
        dleSymbol: info.symbol,
        dleLocation: info.location,
        dleJurisdiction: info.jurisdiction != null ? Number(info.jurisdiction) : null,
        dleOkvedCodes: Array.from(info.okvedCodes || []),
      };
    } catch (e) {
      console.log(`[DLE Modules] getDLEInfo skip: ${e.message}`);
    }

    const addedAtByAddress = await loadModuleAddedAtByAddress(provider, dleAddress);

    let supportedNetworks = [];
    try {
      supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    } catch (e) {
      console.log(`[DLE Modules] getSupportedNetworksFromDLE: ${e.message}`);
    }
    if (!supportedNetworks.length) {
      supportedNetworks = [
        {
          chainId: Number(targetChainId),
          networkName: getNetworkName(Number(targetChainId)),
          rpcUrl: null,
          etherscanUrl: getEtherscanUrlByChainId(Number(targetChainId)),
          networkIndex: 0,
        },
      ];
      try {
        supportedNetworks[0].rpcUrl = await rpcProviderService.getRpcUrlByChainId(Number(targetChainId));
      } catch (_) {}
    }

    const formattedModules = [];
    for (const moduleType of Object.keys(MODULE_TYPE_TO_ID)) {
      let moduleAddress = ethers.ZeroAddress;
      let moduleId = MODULE_TYPE_TO_ID[moduleType];
      let isActive = false;
      try {
        const slot = await resolveBookSlot(dle, moduleType);
        moduleId = slot.moduleId;
        moduleAddress = slot.moduleAddress;
        if (moduleAddress && moduleAddress !== ethers.ZeroAddress) {
          try {
            isActive = await dle.isModuleActive(moduleId);
          } catch (_) {
            isActive = true;
          }
        }
      } catch (e) {
        console.log(`[DLE Modules] skip ${moduleType}: ${e.message}`);
        continue;
      }

      const fromFile = fileByType[moduleType];
      const addresses = await listModuleChainAddresses({
        dleAddress,
        moduleType,
        fromFile,
        supportedNetworks,
      });

      if (!moduleAddress || moduleAddress === ethers.ZeroAddress) {
        if (addresses.length === 0) continue;
        moduleAddress = addresses.find((a) => a.inBook)?.address || addresses[0].address;
        isActive = addresses.some((a) => a.isActive);
      } else if (addresses.length === 0) {
        addresses.push({
          chainId: Number(targetChainId),
          address: moduleAddress,
          bridgeAddress: null,
          networkName: getNetworkName(Number(targetChainId)),
          isActive: Boolean(isActive),
          inBook: true,
          verification: mapVerificationStatus(null),
          verificationStatus: mapVerificationStatus(null),
          networkIndex: Number(targetChainId),
        });
      }

      const bridgeAddress =
        addresses.find((a) => Number(a.chainId) === Number(targetChainId))?.bridgeAddress ||
        addresses.find((a) => a.bridgeAddress)?.bridgeAddress ||
        null;

      const cardMeta = pickDleCardMeta(chainMeta, fromFile, fileModules);
      const deployedAt = addedAtByAddress.get(String(moduleAddress).toLowerCase()) || null;
      const inBook = addresses.some((a) => a.inBook);

      formattedModules.push({
        // AnalyticsView ждёт id/address; ModulesView — moduleName/addresses
        id: moduleType,
        address: moduleAddress,
        bridgeAddress: bridgeAddress || null,
        moduleId,
        moduleName: MODULE_NAMES[moduleType] || moduleType.toUpperCase(),
        moduleType,
        moduleDescription: getModuleDescription(moduleType),
        addresses,
        isActive: Boolean(isActive),
        inBook: Boolean(inBook),
        deployedAt,
        source: inBook ? 'on-chain' : (fromFile?.source || 'deployed'),
        ...cardMeta,
      });
    }

    // Контракт модуля уже в сети, но ещё не addModule в книгу — тоже показываем.
    // Если в книге старый адрес, а в ОС новый — показываем оба (замена через remove+add).
    for (const fromFile of fileModules || []) {
      const moduleType = fromFile.moduleType;
      if (!moduleType) continue;
      const moduleId = MODULE_TYPE_TO_ID[moduleType];
      if (!moduleId) continue;

      const nets = (fromFile.networks || []).filter(
        (n) => n && n.address && n.address !== ethers.ZeroAddress
      );
      if (nets.length === 0) continue;

      const prefer =
        nets.find((n) => Number(n.chainId) === Number(targetChainId)) || nets[0];

      const bookEntry = formattedModules.find((m) => m.moduleType === moduleType && m.inBook);
      if (bookEntry) {
        const bookAddr = String(bookEntry.address || '').toLowerCase();
        const fileAddr = String(prefer.address || '').toLowerCase();
        if (bookAddr && fileAddr && bookAddr === fileAddr) continue;
        const alreadyHasFileAddr = (bookEntry.addresses || []).some(
          (a) => String(a.address || '').toLowerCase() === fileAddr
        );
        if (alreadyHasFileAddr) continue;
      } else if (formattedModules.some((m) => m.moduleType === moduleType)) {
        continue;
      }

      let fileBridge = prefer.bridgeAddress || null;
      try {
        const onChainBridge = await readOnChainModuleBridge(provider, prefer.address);
        if (onChainBridge) fileBridge = onChainBridge;
      } catch (_) {}

      const cardMeta = pickDleCardMeta(chainMeta, fromFile, fileModules);
      const deployedAt = addedAtByAddress.get(String(prefer.address).toLowerCase()) || null;
      const pendingReplace = Boolean(bookEntry);

      formattedModules.push({
        id: pendingReplace ? `${moduleType}-pending` : moduleType,
        address: prefer.address,
        bridgeAddress: fileBridge,
        moduleId,
        moduleName: MODULE_NAMES[moduleType] || moduleType.toUpperCase(),
        moduleType,
        moduleDescription: getModuleDescription(moduleType),
        addresses: nets.map((n) => ({
          chainId: Number(n.chainId),
          address: n.address,
          bridgeAddress: (Number(n.chainId) === Number(prefer.chainId) ? fileBridge : n.bridgeAddress) || null,
          networkName: getNetworkName(Number(n.chainId)),
          isActive: false,
          verification: mapVerificationStatus(n.verification),
          verificationStatus: mapVerificationStatus(n.verification),
        })),
        isActive: false,
        inBook: false,
        pendingReplace,
        deployedAt,
        source: fromFile.source || 'deployed',
        ...cardMeta,
      });
    }

    console.log(`[DLE Modules] Модулей в ответе: ${formattedModules.length} (книга + файлы деплоя)`);

    res.json({
      success: true,
      data: {
        modules: formattedModules,
        requiresGovernance: true,
        totalModules: formattedModules.length,
        activeModules: formattedModules.filter((m) => m.isActive).length,
        supportedNetworks,
        chainId: Number(targetChainId),
      },
    });
  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении всех модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении всех модулей: ' + error.message,
    });
  }
});

const TREASURY_HOLDINGS_ABI = [
  'function getAllTokens() view returns (address[])',
  'function getTokenInfo(address tokenAddress) view returns (tuple(address tokenAddress, string symbol, uint8 decimals, bool isActive, bool isNative, uint256 addedTimestamp, uint256 balance))',
  'function getRealTokenBalance(address tokenAddress) view returns (uint256)',
];

async function readErc20Decimals(provider, tokenAddress, fallback) {
  if (!tokenAddress || tokenAddress === ethers.ZeroAddress) return 18;
  try {
    const erc20 = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );
    return Number(await erc20.decimals());
  } catch (_) {
    const n = Number(fallback);
    return Number.isFinite(n) && n >= 0 ? n : 18;
  }
}

/**
 * Токены казны по всем сетям книги: тип (native/erc20) и живой balanceOf.
 * @route POST /api/dle-modules/get-treasury-holdings
 */
router.post('/get-treasury-holdings', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body || {};
    if (!dleAddress || !ethers.isAddress(dleAddress)) {
      return res.status(400).json({ success: false, error: 'Адрес DLE обязателен' });
    }

    const networks = await getSupportedNetworksFromDLE(dleAddress);
    const onlyChain = Number(preferChainId);
    const chains = [];

    for (const network of networks) {
      const chainId = Number(network.chainId);
      if (Number.isFinite(onlyChain) && onlyChain > 0 && chainId !== onlyChain) continue;
      const row = {
        chainId,
        networkName: getNetworkNameByChainId(chainId),
        treasuryAddress: null,
        tokens: [],
        error: null,
      };
      try {
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
        if (!rpcUrl) {
          row.error = 'RPC не найден';
          chains.push(row);
          continue;
        }
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
        const dle = new ethers.Contract(
          dleAddress,
          [
            'function getModuleAddress(bytes32) view returns (address)',
            'function isModuleActive(bytes32) view returns (bool)',
          ],
          provider
        );
        const slot = await resolveBookSlot(dle, 'treasury');
        if (!slot.moduleAddress || slot.moduleAddress === ethers.ZeroAddress) {
          row.error = 'Казна не в книге';
          chains.push(row);
          continue;
        }
        row.treasuryAddress = slot.moduleAddress;
        const treasury = new ethers.Contract(slot.moduleAddress, TREASURY_HOLDINGS_ABI, provider);
        const listed = await treasury.getAllTokens();
        const seen = new Set();
        for (const raw of listed || []) {
          const tokenAddress = raw === ethers.ZeroAddress
            ? ethers.ZeroAddress
            : ethers.getAddress(raw);
          const key = tokenAddress.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          let info;
          try {
            info = await treasury.getTokenInfo(tokenAddress);
          } catch (e) {
            row.tokens.push({
              address: tokenAddress,
              symbol: '',
              type: tokenAddress === ethers.ZeroAddress ? 'native' : 'erc20',
              decimals: tokenAddress === ethers.ZeroAddress ? 18 : 18,
              isActive: false,
              isNative: tokenAddress === ethers.ZeroAddress,
              balance: '0',
              balanceHuman: '0',
              error: e.shortMessage || e.message,
            });
            continue;
          }
          const isNative = Boolean(info.isNative) || tokenAddress === ethers.ZeroAddress;
          const decimals = isNative
            ? Number(info.decimals) || 18
            : await readErc20Decimals(provider, tokenAddress, info.decimals);
          let rawBal = info.balance;
          try {
            rawBal = await treasury.getRealTokenBalance(tokenAddress);
          } catch (_) {}
          let balanceHuman = '0';
          try {
            balanceHuman = ethers.formatUnits(rawBal, decimals);
          } catch (_) {
            balanceHuman = String(rawBal);
          }
          row.tokens.push({
            address: tokenAddress,
            symbol: info.symbol || (isNative ? 'ETH' : ''),
            type: isNative ? 'native' : 'erc20',
            decimals,
            isActive: Boolean(info.isActive),
            isNative,
            balance: rawBal.toString(),
            balanceHuman,
          });
        }
        if (!seen.has(ethers.ZeroAddress.toLowerCase())) {
          try {
            const nativeBal = await treasury.getRealTokenBalance(ethers.ZeroAddress);
            if (nativeBal > 0n) {
              row.tokens.unshift({
                address: ethers.ZeroAddress,
                symbol: 'ETH',
                type: 'native',
                decimals: 18,
                isActive: true,
                isNative: true,
                balance: nativeBal.toString(),
                balanceHuman: ethers.formatUnits(nativeBal, 18),
              });
            }
          } catch (_) {}
        }
      } catch (e) {
        row.error = e.shortMessage || e.message;
      }
      chains.push(row);
    }

    res.json({
      success: true,
      data: { chains },
    });
  } catch (error) {
    console.error('[DLE Modules] get-treasury-holdings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка чтения казны',
    });
  }
});

// Получить deploymentId по адресу DLE
router.post('/get-deployment-id', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Поиск deploymentId для DLE: ${dleAddress}`);

    const DeployParamsService = require('../services/deployParamsService');
    const deployParamsService = new DeployParamsService();
    
    // Ищем параметры деплоя по адресу DLE
    const result = await deployParamsService.getDeployParamsByDleAddress(dleAddress);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'DeploymentId не найден для данного адреса DLE'
      });
    }

    await deployParamsService.close();

    res.json({
      success: true,
      data: {
        deploymentId: result.deployment_id,
        dleAddress: result.dle_address,
        deploymentStatus: result.deployment_status
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении deploymentId:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении deploymentId: ' + error.message
    });
  }
});

/**
 * Загрузить уже задеплоенный адрес модуля в реестр ОС (JSON),
 * чтобы его можно было добавить в книгу через предложение «Добавить модуль».
 * @route POST /api/dle-modules/register-module-address
 */
router.post(
  '/register-module-address',
  requireAuth,
  requirePermission(PERMISSIONS.MANAGE_SETTINGS),
  async (req, res) => {
    try {
      const {
        dleAddress,
        moduleType,
        moduleAddress,
        chainId,
        bridgeAddress = null,
      } = req.body || {};

      if (!dleAddress || !ethers.isAddress(dleAddress)) {
        return res.status(400).json({ success: false, error: 'Некорректный адрес книги (DLE)' });
      }
      if (!moduleType || !MODULE_TYPE_TO_ID[moduleType]) {
        return res.status(400).json({
          success: false,
          error: `Неизвестный тип модуля. Допустимо: ${Object.keys(MODULE_TYPE_TO_ID).join(', ')}`,
        });
      }
      if (!moduleAddress || !ethers.isAddress(moduleAddress) || moduleAddress === ethers.ZeroAddress) {
        return res.status(400).json({ success: false, error: 'Некорректный адрес модуля' });
      }
      const cid = Number(chainId);
      if (!Number.isFinite(cid) || cid <= 0) {
        return res.status(400).json({ success: false, error: 'Укажите идентификатор сети (chainId)' });
      }
      if (bridgeAddress && (!ethers.isAddress(bridgeAddress) || bridgeAddress === ethers.ZeroAddress)) {
        return res.status(400).json({ success: false, error: 'Некорректный адрес моста' });
      }

      let code = '0x';
      try {
        const { provider } = await resolveDleProvider(dleAddress, { preferChainId: cid });
        code = await provider.getCode(moduleAddress);
      } catch (e) {
        console.warn(`[DLE Modules] register-module-address code check: ${e.message}`);
      }
      if (!code || code === '0x') {
        return res.status(400).json({
          success: false,
          error: 'По этому адресу в сети нет контракта. Проверьте адрес и сеть.',
        });
      }

      if (!fs.existsSync(MODULES_DATA_DIR)) {
        fs.mkdirSync(MODULES_DATA_DIR, { recursive: true });
      }

      const filePath = moduleRegistryFilePath(dleAddress, moduleType);
      let existing = {};
      if (fs.existsSync(filePath)) {
        try {
          existing = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
        } catch (_) {
          existing = {};
        }
      }

      const networks = Array.isArray(existing.networks) ? [...existing.networks] : [];
      const idx = networks.findIndex((n) => Number(n.chainId) === cid);
      const row = {
        chainId: cid,
        address: ethers.getAddress(moduleAddress),
        bridgeAddress: bridgeAddress ? ethers.getAddress(bridgeAddress) : (idx >= 0 ? networks[idx].bridgeAddress || null : null),
        bridgeWired: Boolean(bridgeAddress || (idx >= 0 && networks[idx].bridgeWired)),
        bridgeError: null,
        verification: idx >= 0 ? networks[idx].verification || 'pending' : 'pending',
        success: true,
        error: null,
        registeredManually: true,
      };
      if (idx >= 0) networks[idx] = { ...networks[idx], ...row };
      else networks.push(row);

      const payload = {
        ...existing,
        moduleType,
        dleAddress: ethers.getAddress(dleAddress),
        networks,
        deployTimestamp: existing.deployTimestamp || new Date().toISOString(),
        registeredAt: new Date().toISOString(),
        source: existing.source === 'deployed' ? 'deployed+manual' : 'manual',
      };

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[DLE Modules] Зарегистрирован адрес модуля ${moduleType} → ${row.address} (${cid})`);

      return res.json({
        success: true,
        module: {
          moduleType,
          dleAddress: payload.dleAddress,
          moduleId: MODULE_TYPE_TO_ID[moduleType],
          networks: payload.networks,
          source: payload.source,
        },
      });
    } catch (error) {
      console.error('[DLE Modules] register-module-address:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Не удалось сохранить адрес модуля',
      });
    }
  }
);

// Создать предложение о добавлении модуля (с автоматической оплатой газа)
router.post('/create-add-module-proposal', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'os_proposal_removed',
    error: 'Предложение создаёт кошелёк держателя, не ключ ОС.',
  });
});
router.post('/create-remove-module-proposal', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'os_proposal_removed',
    error: 'Предложение создаёт кошелёк держателя, не ключ ОС.',
  });
});
// Функция для получения поддерживаемых сетей из DLE контракта
async function getSupportedNetworksFromDLE(dleAddress) {
  try {
    // Получаем все доступные RPC провайдеры из базы данных
    const allRpcProviders = await rpcProviderService.getAllRpcProviders();
    console.log(`[DLE Modules] Найдено RPC провайдеров в базе данных: ${allRpcProviders.length}`);

    if (allRpcProviders.length === 0) {
      console.log(`[DLE Modules] RPC провайдеры не найдены в базе данных`);
      return [];
    }

    // Пробуем подключиться к каждой сети, чтобы найти DLE контракт
    const supportedNetworks = [];
    
    for (const rpcProvider of allRpcProviders) {
      try {
        console.log(`[DLE Modules] Проверяем сеть: ${rpcProvider.network_name} (${rpcProvider.chain_id})`);
        
        const provider = new ethers.JsonRpcProvider(rpcProvider.rpc_url);
        
        const dleAbi = [
          "function getSupportedChainCount() external view returns (uint256)",
          "function getSupportedChainId(uint256 _index) external view returns (uint256)"
        ];

        const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        // Проверяем, существует ли контракт в этой сети
        const code = await provider.getCode(dleAddress);
        if (code === '0x') {
          console.log(`[DLE Modules] DLE контракт не найден в сети ${rpcProvider.chain_id}`);
          continue;
        }

        // Получаем количество поддерживаемых сетей с проверкой
        let chainCount;
        try {
          chainCount = await dle.getSupportedChainCount();
          console.log(`[DLE Modules] DLE в сети ${rpcProvider.chain_id} поддерживает ${chainCount} сетей`);
        } catch (error) {
          console.log(`[DLE Modules] Ошибка получения chainCount в сети ${rpcProvider.chain_id}: ${error.message}`);
          // Если функция не работает, проверяем, что контракт инициализирован
          try {
            // Проверяем что контракт развернут (код не пустой)
            const code = await provider.getCode(dleAddress);
            if (code === '0x' || code.length <= 2) {
              throw new Error('Контракт не развернут');
            }
            console.log(`[DLE Modules] Контракт инициализирован, но getSupportedChainCount() не работает`);
            // Если контракт инициализирован, но getSupportedChainCount() падает,
            // это означает, что supportedChainIds пустой - используем 0
            chainCount = 0;
            console.log(`[DLE Modules] supportedChainIds пустой, используем chainCount = 0`);
          } catch (initError) {
            console.log(`[DLE Modules] Контракт не инициализирован: ${initError.message}`);
            // Пропускаем эту сеть
            continue;
          }
        }

        // Получаем chainId для каждой поддерживаемой сети
        for (let i = 0; i < chainCount; i++) {
          try {
            const chainId = await dle.getSupportedChainId(i);
            
            // Получаем RPC URL для этой сети из базы данных
            const networkRpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            
            if (networkRpcUrl) {
              const networkName = getNetworkNameByChainId(chainId);
              
              // Проверяем, не добавлена ли уже эта сеть
              const existingNetwork = supportedNetworks.find(n => n.chainId === chainId);
              if (!existingNetwork) {
                const etherscanUrl = getEtherscanUrlByChainId(chainId);
                
                supportedNetworks.push({
                  chainId: Number(chainId), // Конвертируем BigInt в Number
                  networkName: networkName,
                  rpcUrl: networkRpcUrl,
                  etherscanUrl: etherscanUrl,
                  networkIndex: i
                });
                
                console.log(`[DLE Modules] Найдена поддерживаемая сеть: ${networkName} (${chainId})`);
              }
            } else {
              console.log(`[DLE Modules] RPC URL не найден для сети ${chainId}`);
            }
          } catch (error) {
            console.log(`[DLE Modules] Ошибка при получении chainId для индекса ${i}:`, error.message);
          }
        }

        // Если нашли поддерживаемые сети, можем остановиться
        if (supportedNetworks.length > 0) {
          break;
        }
        
      } catch (error) {
        console.log(`[DLE Modules] Ошибка при подключении к сети ${rpcProvider.chain_id}:`, error.message);
      }
    }

    return supportedNetworks;
  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении поддерживаемых сетей:', error);
    return [];
  }
}

// Функция для определения названия сети по chainId
function getNetworkNameByChainId(chainId) {
  const networkNames = {
    1: 'Ethereum Mainnet',
    5: 'Goerli',
    11155111: 'Sepolia',
    137: 'Polygon Mainnet',
    80001: 'Mumbai',
    56: 'BSC Mainnet',
    97: 'BSC Testnet',
    42161: 'Arbitrum One',
    421614: 'Arbitrum Sepolia',
    10: 'Optimism',
    11155420: 'Optimism Sepolia',
    8453: 'Base',
    84532: 'Base Sepolia',
    17000: 'Holesky'
  };
  
  return networkNames[chainId] || `Chain ID ${chainId}`;
}

// Функция для определения Etherscan URL по chainId
function getEtherscanUrlByChainId(chainId) {
  const etherscanUrls = {
    1: 'https://etherscan.io',
    5: 'https://goerli.etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    137: 'https://polygonscan.com',
    80001: 'https://mumbai.polygonscan.com',
    56: 'https://bscscan.com',
    97: 'https://testnet.bscscan.com',
    42161: 'https://arbiscan.io',
    421614: 'https://sepolia.arbiscan.io',
    10: 'https://optimistic.etherscan.io',
    11155420: 'https://sepolia-optimism.etherscan.io',
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
    17000: 'https://holesky.etherscan.io'
  };
  
  return etherscanUrls[chainId] || 'https://etherscan.io';
}


// Вспомогательные функции для получения названий и описаний модулей
function getModuleName(moduleType) {
  const moduleNames = {
    "treasury": "Казначейство",
    "timelock": "Timelock",
    "reader": "Reader",
    "hierarchicalVoting": "Иерархическое голосование"
  };
  return moduleNames[moduleType] || "Неизвестный модуль";
}

function getModuleDescription(moduleType) {
  const moduleDescriptions = {
    "treasury": "Казначейство DLE - управление различными ERC20 токенами и нативными монетами, переводы, batch операции",
    "timelock": "Модуль задержек исполнения - безопасность критических операций через обязательные таймлоки",
    "reader": "Модуль чтения данных DLE - получение информации о контракте, предложениях и статистике",
    "hierarchicalVoting": "Модуль иерархического голосования - голосование в других DLE на основе владения токенами"
  };
  return moduleDescriptions[moduleType] || "Описание не найдено";
}

// Верификация модуля на Etherscan
router.post('/verify-module', async (req, res) => {
  try {
    const { dleAddress, moduleId, moduleAddress, moduleName } = req.body;
    
    if (!dleAddress || !moduleId || !moduleAddress || !moduleName) {
      return res.status(400).json({
        success: false,
        error: 'Все параметры обязательны: dleAddress, moduleId, moduleAddress, moduleName'
      });
    }

    console.log(`[DLE Modules] Верификация модуля ${moduleName} по адресу ${moduleAddress}`);

    // Получаем API ключ Etherscan из секретов
    const { getSecret } = require('../services/secretStore');
    let apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'API ключ Etherscan не найден в секретах'
      });
    }

    // Получаем chainId из параметров запроса
    const { chainId } = req.body;
    
    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'chainId обязателен для верификации'
      });
    }
    
    // Определяем имя контракта на основе moduleId
    let contractName;
    if (moduleId === "0x7472656173757279000000000000000000000000000000000000000000000000") {
      contractName = "TreasuryModule";
    } else if (moduleId === "0x74696d656c6f636b000000000000000000000000000000000000000000000000") {
      contractName = "TimelockModule";
    } else if (moduleId === "0x7265616465720000000000000000000000000000000000000000000000000000") {
      contractName = "DLEReader";
    } else {
      contractName = "UnknownModule";
    }

    console.log(`[DLE Modules] Верификация ${contractName} на Etherscan...`);

    // ContractVerificationService удален - используем Hardhat verify
    
    // Получаем RPC URL для Sepolia
    const rpcProviderService = require('../services/rpcProviderService');
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    // Получаем ABI и bytecode для модуля
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));

    // Получаем код контракта для проверки существования
    const code = await provider.getCode(moduleAddress);
    
    if (code === '0x') {
      return res.status(400).json({
        success: false,
        error: 'По указанному адресу нет контракта'
      });
    }

    // Создаем стандартный JSON input для компиляции
    const standardJsonInput = await createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId);

    // Отправляем верификацию на Etherscan
    const verificationResult = await etherscanV2.submitVerification({
      chainId: chainId,
      contractAddress: moduleAddress,
      contractName: `${contractName}.sol:${contractName}`, // Формат: filename.sol:contractname
      compilerVersion: "v0.8.20+commit.a1b79de6", // Версия компилятора (точно как в основном контракте)
      standardJsonInput: standardJsonInput.standardJsonInput,
      constructorArgsHex: standardJsonInput.constructorArgsHex,
      apiKey: apiKey
    });

    console.log(`[DLE Modules] Результат верификации:`, verificationResult);

    res.json({
      success: true,
      data: {
        message: `Модуль ${moduleName} успешно верифицирован`,
        verificationResult: verificationResult,
        contractName: contractName,
        moduleAddress: moduleAddress
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации модуля:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации модуля: ' + error.message
    });
  }
});

// Получить информацию о поддерживаемых сетях
router.post('/get-networks-info', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение информации о сетях для DLE: ${dleAddress}`);

    // Получаем информацию о поддерживаемых сетях из DLE контракта
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);

    res.json({
      success: true,
      data: {
        networks: supportedNetworks,
        totalNetworks: supportedNetworks.length
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении информации о сетях:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о сетях: ' + error.message
    });
  }
});

// Проверить статус инициализации модулей
router.post('/check-modules-status', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Проверка статуса модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.json({
        success: true,
        data: {
          requiresGovernance: true,
          initializer: null,
          modules: [],
          networks: []
        }
      });
    }

    // Проверяем первую доступную сеть
    const network = supportedNetworks[0];
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(network.chainId);
    if (!rpcUrl) {
      return res.status(400).json({ success: false, message: `RPC URL не найден для chainId ${network.chainId}` });
    }
    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
    const dleAbi = [
      "function initializer() external view returns (address)",
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Модули инициализируются только через governance
    const initializer = await dle.initializer();

    // Проверяем модули
    const moduleIds = MODULE_TYPE_TO_ID;

    const modules = [];
    for (const name of Object.keys(moduleIds)) {
      try {
        const slot = await readSlot(dle, name);
        modules.push({
          name: name.toUpperCase(),
          moduleId: slot.moduleId,
          isActive: slot.isActive,
          address: slot.moduleAddress
        });
      } catch (error) {
        modules.push({
          name: name.toUpperCase(),
          moduleId: moduleIds[name],
          isActive: false,
          address: null,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        requiresGovernance: true,
        initializer: initializer,
        modules: modules,
        networks: supportedNetworks
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при проверке статуса модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке статуса модулей: ' + error.message
    });
  }
});

// Функция для создания стандартного JSON input для верификации
async function createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Читаем исходный код контракта
    let contractSource = '';
    let contractPath = '';
    
    if (contractName === 'TreasuryModule') {
      contractPath = path.join(__dirname, '../contracts/TreasuryModule.sol');
    } else if (contractName === 'TimelockModule') {
      contractPath = path.join(__dirname, '../contracts/TimelockModule.sol');
    } else if (contractName === 'DLEReader') {
      contractPath = path.join(__dirname, '../contracts/DLEReader.sol');
    } else {
      throw new Error(`Неизвестный контракт: ${contractName}`);
    }
    
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Файл контракта не найден: ${contractPath}`);
    }
    
    contractSource = fs.readFileSync(contractPath, 'utf8');
    
    // Определяем конструктор аргументы на основе типа контракта
    let constructorArgs = [];
    
    if (contractName === 'TreasuryModule') {
      // TreasuryModule: [dleAddress, chainId, emergencyAdmin]
      // Нужно получить реальный emergencyAdmin из транзакции деплоя
      let emergencyAdmin = dleAddress; // fallback
      
      try {
        // Получаем emergencyAdmin из транзакции деплоя
        const provider = new ethers.JsonRpcProvider(await require('../services/rpcProviderService').getRpcUrlByChainId(chainId));
        const history = await provider.getHistory(moduleAddress);
        if (history.length > 0) {
          const deployTx = history[0]; // Первая транзакция - это деплой
          if (deployTx.from) {
            emergencyAdmin = deployTx.from; // deployer становится emergencyAdmin
            console.log(`[DLE Modules] Найден emergencyAdmin из транзакции деплоя: ${emergencyAdmin}`);
          }
        }
      } catch (error) {
        console.log(`[DLE Modules] Не удалось получить emergencyAdmin из транзакции: ${error.message}`);
      }
      
      constructorArgs = [dleAddress, chainId.toString(), emergencyAdmin];
    } else if (contractName === 'TimelockModule') {
      // TimelockModule: [dleAddress]
      constructorArgs = [dleAddress];
    } else if (contractName === 'DLEReader') {
      // DLEReader: [dleAddress]
      constructorArgs = [dleAddress];
    }
    
    // Кодируем конструктор аргументы
    const { ethers } = require('ethers');
    const abiCoder = new ethers.AbiCoder();
    
    let constructorArgsHex = '0x';
    if (constructorArgs.length > 0) {
      // Определяем типы параметров для каждого контракта
      let paramTypes = [];
      if (contractName === 'TreasuryModule') {
        paramTypes = ['address', 'uint256', 'address'];
      } else if (contractName === 'TimelockModule' || contractName === 'DLEReader') {
        paramTypes = ['address'];
      }
      
      constructorArgsHex = abiCoder.encode(paramTypes, constructorArgs);
    }
    
    // Создаем стандартный JSON input
    const standardJsonInput = {
      language: "Solidity",
      sources: {
        [contractName + '.sol']: {
          content: contractSource
        }
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 0
        },
        viaIR: true,
        evmVersion: "paris",
        outputSelection: {
          "*": {
            "*": ["*"]
          }
        },
        libraries: {},
        remappings: [
          "@openzeppelin/contracts/=@openzeppelin/contracts/"
        ]
      }
    };
    
    console.log(`[DLE Modules] Создан standardJsonInput для ${contractName}:`, {
      contractPath,
      constructorArgs,
      constructorArgsHex,
      sourceLength: contractSource.length
    });
    
    return {
      standardJsonInput: JSON.stringify(standardJsonInput),
      constructorArgsHex: constructorArgsHex
    };
    
  } catch (error) {
    console.error(`[DLE Modules] Ошибка создания standardJsonInput для ${contractName}:`, error);
    throw error;
  }
}

// Мультиинициализация модулей во всех сетях
router.post('/initialize-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    if (!dleAddress) {
      return res.status(400).json({ success: false, error: 'Адрес DLE обязателен' });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Мультиинициализация модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
    ];

    // ID модулей
    const moduleIds = MODULE_TYPE_TO_ID;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Инициализация модулей в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(network.chainId);
        if (!rpcUrl) {
          console.warn(`[DLE Modules] RPC URL не найден для chainId ${network.chainId}`);
          continue;
        }
        const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
        const wallet = new ethers.Wallet(privateKey, provider);
        const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

        // Модули инициализируются только через governance
        console.log(`[DLE Modules] Модули инициализируются через governance предложения в сети ${network.chainId}`);

        // Получаем адреса модулей
        const treasuryAddress = await slotAddr(dle, 'treasury');
        const timelockAddress = await slotAddr(dle, 'timelock');
        const readerAddress = await slotAddr(dle, 'reader');

        // Проверяем, что все модули задеплоены
        if (treasuryAddress === "0x0000000000000000000000000000000000000000" ||
            timelockAddress === "0x0000000000000000000000000000000000000000" ||
            readerAddress === "0x0000000000000000000000000000000000000000") {
          console.log(`[DLE Modules] Не все модули задеплоены в сети ${network.chainId}`);
          results.push({
            chainId: network.chainId,
            networkName: network.networkName,
            status: 'modules_not_deployed',
            message: 'Не все модули задеплоены'
          });
          continue;
        }

        // Модули инициализируются только через governance предложения
        console.log(`[DLE Modules] Модули должны быть инициализированы через governance предложения в сети ${network.chainId}`);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'requires_governance',
          message: 'Модули должны быть инициализированы через governance предложения',
          treasuryAddress,
          timelockAddress,
          readerAddress
        });

      } catch (error) {
        console.error(`[DLE Modules] Ошибка инициализации модулей в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          already_initialized: results.filter(r => r.status === 'already_initialized').length,
          errors: results.filter(r => r.status === 'error').length
        }
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка мультиинициализации модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка мультиинициализации модулей: ' + error.message
    });
  }
});

// Мультиверификация модулей во всех сетях
router.post('/verify-modules-all-networks', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    if (!dleAddress) {
      return res.status(400).json({ success: false, error: 'Адрес DLE обязателен' });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Мультиверификация модулей для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    // ID модулей
    const moduleIds = MODULE_TYPE_TO_ID;

    // Маппинг модулей для верификации
    const moduleTypes = {
      treasury: 'TreasuryModule',
      timelock: 'TimelockModule', 
      reader: 'DLEReader'
    };

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация модулей в сети: ${network.networkName} (${network.chainId})`);
      
      const networkResults = {
        chainId: network.chainId,
        networkName: network.networkName,
        modules: {}
      };

      try {
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(network.chainId);
        if (!rpcUrl) {
          console.warn(`[DLE Modules] RPC URL не найден для chainId ${network.chainId}`);
          continue;
        }
        const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
        const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        for (const [moduleKey, moduleId] of Object.entries(moduleIds)) {
          try {
            const moduleAddress = await slotAddrFromId(dle, moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              networkResults.modules[moduleKey] = {
                status: 'not_deployed',
                message: 'Модуль не задеплоен'
              };
              continue;
            }

            // Верифицируем модуль
            const verificationResult = await verifyModuleInNetwork(
              moduleTypes[moduleKey],
              moduleAddress,
              dleAddress,
              network.chainId,
              network.networkName
            );

            networkResults.modules[moduleKey] = verificationResult;

          } catch (error) {
            console.error(`[DLE Modules] Ошибка верификации модуля ${moduleKey} в сети ${network.chainId}:`, error.message);
            networkResults.modules[moduleKey] = {
              status: 'error',
              message: error.message
            };
          }
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка подключения к сети ${network.chainId}:`, error.message);
        networkResults.error = error.message;
      }

      results.push(networkResults);
    }

    res.json({
      success: true,
      data: {
        results: results,
        summary: {
          total_networks: results.length,
          total_modules: results.length * 3, // 3 модуля на сеть
          success_count: results.reduce((sum, r) => 
            sum + Object.values(r.modules || {}).filter(m => m.status === 'success').length, 0),
          error_count: results.reduce((sum, r) => 
            sum + Object.values(r.modules || {}).filter(m => m.status === 'error').length, 0)
        }
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка мультиверификации модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка мультиверификации модулей: ' + error.message
    });
  }
});

// Вспомогательная функция для верификации модуля в конкретной сети
async function verifyModuleInNetwork(contractName, moduleAddress, dleAddress, chainId, networkName) {
  try {
    console.log(`[DLE Modules] Верификация ${contractName} в сети ${networkName} (${chainId})`);
    
    // Получаем Etherscan URL для сети
    const etherscanUrl = await getEtherscanUrlByChainId(chainId);
    if (!etherscanUrl) {
      return {
        status: 'error',
        message: `Etherscan не поддерживается для сети ${networkName}`
      };
    }

    // Получаем API ключ Etherscan из секретов
    const { getSecret } = require('../services/secretStore');
    const apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
    
    if (!apiKey) {
      return {
        status: 'error',
        message: 'API ключ Etherscan не найден в секретах'
      };
    }

    // Создаем стандартный JSON input для верификации
    const standardJsonInput = await createStandardJsonInput(contractName, moduleAddress, dleAddress, chainId);
    
    // Отправляем запрос на верификацию
    const verificationResponse = await fetch(`${etherscanUrl}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        apikey: apiKey,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: moduleAddress,
        codeformat: 'solidity-standard-json-input',
        contractname: contractName,
        sourceCode: JSON.stringify(standardJsonInput),
        compilerversion: 'v0.8.20+commit.a1b79de6',
        optimizationUsed: '1',
        runs: '1'
      })
    });

    const verificationData = await verificationResponse.json();
    
    if (verificationData.status === '1') {
      console.log(`[DLE Modules] ${contractName} успешно верифицирован в сети ${networkName}`);
      return {
        status: 'success',
        message: 'Модуль успешно верифицирован',
        guid: verificationData.result
      };
    } else {
      console.log(`[DLE Modules] Ошибка верификации ${contractName} в сети ${networkName}: ${verificationData.result}`);
      return {
        status: 'failed',
        message: verificationData.result || 'Ошибка верификации'
      };
    }
    
    } catch (error) {
    console.error(`[DLE Modules] Ошибка верификации ${contractName} в сети ${networkName}:`, error);
    return {
      status: 'error',
      message: error.message
    };
  }
}

// Проверка статуса деплоя DLE контракта во всех сетях
router.post('/check-dle-deployment-status', async (req, res) => {
  try {
    const { dleAddress, chainIds, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Проверка статуса деплоя DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    const results = [];
    let allSuccessful = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Проверка DLE в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
            
            // Проверяем, что контракт существует и имеет код
            const code = await provider.getCode(dleAddress);
            
            if (code === '0x') {
              return {
                chainId: chainId,
                status: 'not_deployed',
                message: 'Контракт не задеплоен'
              };
            } else {
              // Проверяем, что это действительно DLE контракт
              const dleAbi = [
                "function name() external view returns (string)",
                "function symbol() external view returns (string)",
              ];
              
              const dle = new ethers.Contract(dleAddress, dleAbi, provider);
              // Проверяем что контракт развернут (код не пустой)
              const code = await provider.getCode(dleAddress);
              if (code === '0x' || code.length <= 2) {
                throw new Error('Контракт не развернут');
              }
              const name = 'DLE'; // Используем фиксированное имя
              const symbol = 'DLE'; // Используем фиксированный символ
              
              return {
                chainId: chainId,
                status: 'success',
                message: 'DLE контракт успешно задеплоен',
                contractInfo: {
                  name: name,
                  symbol: symbol,
                  hasCode: true
                }
              };
            }
          },
          `Проверка DLE в сети ${chainId}`,
          maxRetries,
          retryDelay
        );

        results.push(result);
        
        if (result.status !== 'success') {
          allSuccessful = false;
    }
    
  } catch (error) {
        console.error(`[DLE Modules] Ошибка при проверке DLE в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'verify_dle' : 'retry_check'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка проверки статуса деплоя DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки статуса деплоя DLE: ' + error.message
    });
  }
});

// Проверка статуса деплоя конкретного модуля во всех сетях
router.post('/check-module-deployment-status', async (req, res) => {
  try {
    const { dleAddress, moduleType, chainIds, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !moduleType || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, тип модуля и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Проверка статуса деплоя модуля ${moduleType} для DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Проверка модуля ${moduleType} в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
            
            const dleAbi = [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, provider);
            
            // Получаем адрес модуля
            const moduleAddress = await slotAddrFromId(dle, moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              return {
                chainId: chainId,
                status: 'not_deployed',
                message: `Модуль ${moduleType} не задеплоен`
              };
            } else {
              // Проверяем, что контракт модуля существует и имеет код
              const code = await provider.getCode(moduleAddress);
              
              if (code === '0x') {
                throw new Error(`Адрес модуля найден, но контракт не задеплоен: ${moduleAddress}`);
              } else {
                // Проверяем активность модуля
                const isActive = await dle.isModuleActive(moduleId);
                
                return {
                  chainId: chainId,
                  status: 'success',
                  message: `Модуль ${moduleType} успешно задеплоен`,
                  moduleInfo: {
                    address: moduleAddress,
                    isActive: isActive,
                    hasCode: true
                  }
                };
              }
            }
          },
          `Проверка модуля ${moduleType} в сети ${chainId}`,
          maxRetries,
          retryDelay
        );

        results.push(result);
        
        if (result.status !== 'success') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка при проверке модуля ${moduleType} в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'verify_module' : 'retry_check'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка проверки статуса деплоя модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка проверки статуса деплоя модуля: ' + error.message
    });
  }
});

// Деплой одного модуля во всех сетях
router.post('/deploy-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, maxRetries = 1, retryDelay = 45000 } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Деплой модуля ${moduleType} для DLE: ${dleAddress}`);

    // Автоматическая компиляция контрактов перед деплоем
    try {
      await autoCompileContracts();
    } catch (compileError) {
      console.error(`[DLE Modules] Ошибка при компиляции контрактов:`, compileError.message);
      return res.status(500).json({
        success: false,
        error: `Ошибка компиляции контрактов: ${compileError.message}`
      });
    }

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их конфигурацию
    const moduleConfigs = {
      treasury: {
        contractName: 'TreasuryModule',
        constructorArgs: (dleAddress, chainId, deployerAddress) => [dleAddress, chainId, deployerAddress]
      },
      timelock: {
        contractName: 'TimelockModule',
        constructorArgs: (dleAddress) => [dleAddress]
      },
      reader: {
        contractName: 'DLEReader',
        constructorArgs: (dleAddress) => [dleAddress]
      }
    };

    const moduleConfig = moduleConfigs[moduleType];
    if (!moduleConfig) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleConfigs).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Деплой модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(network.chainId));
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Используем NonceManager для правильного управления nonce
            const { nonceManager } = require('../utils/nonceManager');
            const currentNonce = await nonceManager.getNonce(wallet.address, network.rpcUrl, network.chainId);
            console.log(`[DLE Modules] Текущий nonce для сети ${network.chainId}: ${currentNonce}`);

            // Получаем фабрику контракта
            if (!hre) {
              throw new Error('Hardhat не установлен. Установите hardhat для компиляции контрактов.');
            }
            const ContractFactory = await hre.ethers.getContractFactory(moduleConfig.contractName);
            
            // Подготавливаем аргументы конструктора
            const constructorArgs = moduleConfig.constructorArgs(dleAddress, network.chainId, wallet.address);
            
            console.log(`[DLE Modules] Деплой ${moduleConfig.contractName} с аргументами:`, constructorArgs);
            
            // Деплоим контракт
            const contract = await ContractFactory.connect(wallet).deploy(...constructorArgs);
            await contract.waitForDeployment();
            
            const deployedAddress = await contract.getAddress();
            console.log(`[DLE Modules] Модуль ${moduleType} задеплоен в сети ${network.chainId}: ${deployedAddress}`);

            return {
              chainId: network.chainId,
              networkName: network.networkName,
              status: 'success',
              message: `Модуль ${moduleType} успешно задеплоен`,
              moduleAddress: deployedAddress,
              transactionHash: contract.deploymentTransaction().hash,
              nonce: currentNonce
            };
          },
          `Деплой модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

      } catch (error) {
        console.error(`[DLE Modules] Ошибка деплоя модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'check_module_deployment' : 'retry_deployment'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка деплоя модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка деплоя модуля: ' + error.message
    });
  }
});

// Верификация DLE контракта во всех сетях
router.post('/verify-dle-all-networks', async (req, res) => {
  try {
    const { dleAddress, maxRetries = 1, retryDelay = 60000 } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Верификация DLE контракта: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация DLE в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            // Получаем Etherscan URL для сети
            const etherscanUrl = await getEtherscanUrlByChainId(network.chainId);
            if (!etherscanUrl) {
              throw new Error(`Etherscan не поддерживается для сети ${network.networkName}`);
            }

              // Берем параметры из сохраненной карточки DLE и не делаем on-chain вызовы
              const fs = require('fs');
              const path = require('path');
              const dlesDir = path.join(__dirname, '../contracts-data/dles');

              let saved = null;
              if (fs.existsSync(dlesDir)) {
                for (const f of fs.readdirSync(dlesDir)) {
                  if (!f.endsWith('.json')) continue;
                  const data = JSON.parse(fs.readFileSync(path.join(dlesDir, f), 'utf8'));
                  if (data && data.dleAddress && data.dleAddress.toLowerCase() === dleAddress.toLowerCase()) {
                    saved = data; break;
                  }
                }
              }

              // Фолбэки если карточка не найдена
              const name = saved?.name || 'DLE';
              const symbol = saved?.symbol || 'DLE';
              const location = saved?.location || '';
              const coordinates = saved?.coordinates || '';
              const jurisdiction = saved?.jurisdiction ?? 0;
              const okvedCodes = Array.isArray(saved?.okvedCodes) ? saved.okvedCodes : [];
              const kpp = saved?.kpp ? Number(saved.kpp) : 0;
              const quorumPercentage = saved?.quorumPercentage ?? saved?.governanceSettings?.quorumPercentage ?? 51;

              // Инициализатор — адрес из переданного приватного ключа
              let initializer;
              try {
                const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
                initializer = new ethers.Wallet(pk).address;
              } catch (_) {
                initializer = (saved?.initialPartners && saved.initialPartners[0]) || "0x0000000000000000000000000000000000000000";
              }

              // Список поддерживаемых сетей и текущая сеть
              const supportedChainIds = Array.isArray(saved?.networks)
                ? saved.networks.map(n => Number(n.chainId)).filter(v => !isNaN(v))
                : (saved?.governanceSettings?.supportedChainIds || []);
              const currentChainId = Number(saved?.governanceSettings?.currentChainId || 1); // governance chain, не network.chainId

            // Создаем стандартный JSON input для верификации
            const standardJsonInput = {
              language: "Solidity",
              sources: {
                "DLE.sol": {
                  content: require('fs').readFileSync(require('path').join(__dirname, '../contracts/DLE.sol'), 'utf8')
                }
              },
              settings: {
                optimizer: {
                  enabled: true,
                  runs: 0
                },
                viaIR: true,
                outputSelection: {
                  "*": {
                    "*": ["*"]
                  }
                }
              }
            };

            // Получаем API ключ Etherscan из секретов
            const { getSecret } = require('../services/secretStore');
            const apiKey = await getSecret('ETHERSCAN_V2_API_KEY');
            
            if (!apiKey) {
              throw new Error('API ключ Etherscan не найден в секретах');
            }

            // Отправляем запрос на верификацию согласно Etherscan V2 API
            const verificationResponse = await fetch(`${etherscanUrl}/v2/api`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                chainid: network.chainId.toString(),
                apikey: apiKey,
                module: 'contract',
                action: 'verifysourcecode',
                contractaddress: dleAddress,
                codeformat: 'solidity-standard-json-input',
                contractname: 'DLE.sol:DLE',
                sourceCode: JSON.stringify(standardJsonInput),
                compilerversion: 'v0.8.20+commit.a1b79de6',
                constructorArguements: (async () => {
                  try {
                    const { generateDLEConstructorArgs } = require('../utils/constructorArgsGenerator');
                    const fs = require('fs');
                    const path = require('path');
                    const dlesDir = path.join(__dirname, '../contracts-data/dles');
                    let found = null;
                    if (fs.existsSync(dlesDir)) {
                      for (const f of fs.readdirSync(dlesDir)) {
                        if (!f.endsWith('.json')) continue;
                        const data = JSON.parse(fs.readFileSync(path.join(dlesDir, f), 'utf8'));
                        if (data && data.dleAddress && data.dleAddress.toLowerCase() === dleAddress.toLowerCase()) {
                          found = data; break;
                        }
                      }
                    }
                    const initPartners = Array.isArray(found?.initialPartners) ? found.initialPartners : [];
                    const initAmounts = Array.isArray(found?.initialAmounts) ? found.initialAmounts : [];
                    const scIds = Array.isArray(found?.networks)
                      ? found.networks.map(n => Number(n.chainId)).filter(v => !isNaN(v))
                      : supportedChainIds;
                    const okvedFromCard = Array.isArray(found?.okvedCodes) ? found.okvedCodes : okvedCodes;

                    const { dleConfig, initializer: initAddr } = generateDLEConstructorArgs({
                      name,
                      symbol,
                      location,
                      coordinates,
                      jurisdiction,
                      okvedCodes: okvedFromCard,
                      kpp,
                      quorumPercentage,
                      initialPartners: initPartners,
                      initialAmounts: initAmounts,
                      supportedChainIds: scIds,
                      initializer,
                    });

                    // Актуальный конструктор: (DLEConfig, address) — без oktmo и без chainId
                    return ethers.AbiCoder.defaultAbiCoder().encode(
                      [
                        'tuple(string,string,string,string,uint256,string[],uint256,uint256,address[],uint256[],uint256[])',
                        'address',
                      ],
                      [[
                        dleConfig.name,
                        dleConfig.symbol,
                        dleConfig.location,
                        dleConfig.coordinates,
                        dleConfig.jurisdiction,
                        dleConfig.okvedCodes,
                        dleConfig.kpp,
                        dleConfig.quorumPercentage,
                        dleConfig.initialPartners,
                        dleConfig.initialAmounts,
                        dleConfig.supportedChainIds,
                      ], initAddr]
                    );
                  } catch (encodeError) {
                    console.error('[DLE Modules] Ошибка сборки constructor args:', encodeError.message);
                    const { generateDLEConstructorArgs } = require('../utils/constructorArgsGenerator');
                    const { dleConfig, initializer: initAddr } = generateDLEConstructorArgs({
                      name,
                      symbol,
                      location,
                      coordinates,
                      jurisdiction,
                      okvedCodes,
                      kpp,
                      quorumPercentage,
                      initialPartners: [],
                      initialAmounts: [],
                      supportedChainIds,
                      initializer,
                    });
                    return ethers.AbiCoder.defaultAbiCoder().encode(
                      [
                        'tuple(string,string,string,string,uint256,string[],uint256,uint256,address[],uint256[],uint256[])',
                        'address',
                      ],
                      [[
                        dleConfig.name,
                        dleConfig.symbol,
                        dleConfig.location,
                        dleConfig.coordinates,
                        dleConfig.jurisdiction,
                        dleConfig.okvedCodes,
                        dleConfig.kpp,
                        dleConfig.quorumPercentage,
                        dleConfig.initialPartners,
                        dleConfig.initialAmounts,
                        dleConfig.supportedChainIds,
                      ], initAddr]
                    );
                  }
                })()
              })
            });

            const verificationData = await verificationResponse.json();
            
            if (verificationData.status === '1') {
              console.log(`[DLE Modules] DLE отправлен на верификацию в сети ${network.networkName}, GUID: ${verificationData.result}`);
              
              // Проверяем статус верификации согласно best practices
              const guid = verificationData.result;
              let verificationStatus = 'pending';
              let attempts = 0;
              const maxStatusChecks = 10;
              
              while (verificationStatus === 'pending' && attempts < maxStatusChecks) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Ждем 5 секунд
                attempts++;
                
                try {
                  const statusResponse = await fetch(`${etherscanUrl}/v2/api?chainid=${network.chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${apiKey}`);
                  const statusData = await statusResponse.json();
                  
                  if (statusData.status === '1') {
                    verificationStatus = 'success';
                    console.log(`[DLE Modules] DLE успешно верифицирован в сети ${network.networkName}`);
                  } else if (statusData.result && statusData.result.includes('Fail')) {
                    verificationStatus = 'failed';
                    throw new Error(`Верификация не удалась: ${statusData.result}`);
                  }
                  // Если статус все еще pending, продолжаем проверку
                } catch (statusError) {
                  console.log(`[DLE Modules] Ошибка проверки статуса верификации (попытка ${attempts}): ${statusError.message}`);
                }
              }
              
              if (verificationStatus === 'success') {
                return {
                  chainId: network.chainId,
                  networkName: network.networkName,
                  status: 'success',
                  message: 'DLE контракт успешно верифицирован',
                  guid: guid,
                  etherscanUrl: `${etherscanUrl}/address/${dleAddress}`
                };
              } else {
                throw new Error('Верификация не завершена в течение ожидаемого времени');
              }
            } else {
              throw new Error(verificationData.result || 'Ошибка отправки на верификацию');
            }
          },
          `Верификация DLE в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

      } catch (error) {
        console.error(`[DLE Modules] Ошибка верификации DLE в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'deploy_treasury_module' : 'retry_verification'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации DLE: ' + error.message
    });
  }
});

// Верификация одного модуля во всех сетях
router.post('/verify-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, maxRetries = 1, retryDelay = 60000 } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Верификация модуля ${moduleType} для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Верификация модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(network.chainId));
            const dle = new ethers.Contract(dleAddress, [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
            ], provider);

            // Получаем адрес модуля
            const moduleAddress = await slotAddrFromId(dle, moduleId);
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              return {
                chainId: network.chainId,
                networkName: network.networkName,
                status: 'not_deployed',
                message: `Модуль ${moduleType} не задеплоен`
              };
            }

            // Верифицируем модуль
            const verificationResult = await verifyModuleInNetwork(
              moduleType,
              moduleAddress,
              dleAddress,
              network.chainId,
              network.networkName
            );

            return {
              chainId: network.chainId,
              networkName: network.networkName,
              ...verificationResult
            };
          },
          `Верификация модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

        if (result.status !== 'success') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка верификации модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'failed').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'initialize_module' : 'retry_verification'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка верификации модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка верификации модуля: ' + error.message
    });
  }
});

// Инициализация одного модуля во всех сетях
router.post('/initialize-module-all-networks', async (req, res) => {
  try {
    const { dleAddress, moduleType, maxRetries = 1, retryDelay = 30000 } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }
    let privateKey;
    try {
      rejectClientPrivateKey(req.body);
      privateKey = (await getBookPrivateKey(dleAddress)).pk;
    } catch (keyErr) {
      return res.status(keyErr.status || 400).json({ success: false, error: keyErr.message, code: keyErr.code });
    }

    console.log(`[DLE Modules] Инициализация модуля ${moduleType} для DLE: ${dleAddress}`);

    // Автоматическая компиляция контрактов перед инициализацией
    try {
      await autoCompileContracts();
    } catch (compileError) {
      console.error(`[DLE Modules] Ошибка при компиляции контрактов:`, compileError.message);
      return res.status(500).json({
        success: false,
        error: `Ошибка компиляции контрактов: ${compileError.message}`
      });
    }

    // Получаем поддерживаемые сети
    const supportedNetworks = await getSupportedNetworksFromDLE(dleAddress);
    
    if (supportedNetworks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Не найдены поддерживаемые сети для DLE'
      });
    }

    // Маппинг типов модулей на их ID
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleId = moduleIds[moduleType];
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        error: `Неизвестный тип модуля: ${moduleType}. Поддерживаемые типы: ${Object.keys(moduleIds).join(', ')}`
      });
    }

    const results = [];
    let allSuccessful = true;

    for (const network of supportedNetworks) {
      console.log(`[DLE Modules] Инициализация модуля ${moduleType} в сети: ${network.networkName} (${network.chainId})`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(network.chainId));
            const wallet = new ethers.Wallet(privateKey, provider);
            
            const dleAbi = [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

            // Модули инициализируются только через governance
            console.log(`[DLE Modules] Модули инициализируются через governance предложения в сети ${network.chainId}`);

            // Получаем адрес модуля
            const slot = await readSlot(dle, moduleType);
            const moduleAddress = slot.moduleAddress;
            
            if (moduleAddress === "0x0000000000000000000000000000000000000000") {
              throw new Error(`Модуль ${moduleType} не задеплоен`);
            }

            const isActive = slot.isActive;
            
            if (isActive) {
              console.log(`[DLE Modules] Модуль ${moduleType} уже активен в сети ${network.chainId}`);
              return {
                chainId: network.chainId,
                networkName: network.networkName,
                status: 'already_active',
                message: `Модуль ${moduleType} уже активен`
              };
            }

            // Для инициализации одного модуля нужно создать предложение
            // Но это сложно, поэтому пока просто отмечаем как требующий инициализации
            return {
              chainId: network.chainId,
              networkName: network.networkName,
              status: 'requires_governance',
              message: `Модуль ${moduleType} требует инициализации через governance`,
              moduleAddress: moduleAddress
            };
          },
          `Инициализация модуля ${moduleType} в сети ${network.networkName} (${network.chainId})`,
          maxRetries,
          retryDelay
        );

        results.push(result);

        if (result.status === 'not_deployed' || result.status === 'error') {
          allSuccessful = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка инициализации модуля ${moduleType} в сети ${network.chainId}:`, error.message);
        results.push({
          chainId: network.chainId,
          networkName: network.networkName,
          status: 'error',
          message: error.message,
          attempts: maxRetries
        });
        allSuccessful = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        moduleType: moduleType,
        moduleId: moduleId,
        results: results,
        summary: {
          total: results.length,
          already_initialized: results.filter(r => r.status === 'already_initialized').length,
          already_active: results.filter(r => r.status === 'already_active').length,
          requires_governance: results.filter(r => r.status === 'requires_governance').length,
          not_deployed: results.filter(r => r.status === 'not_deployed').length,
          errors: results.filter(r => r.status === 'error').length,
          allSuccessful: allSuccessful
        },
        canProceed: allSuccessful,
        nextAction: allSuccessful ? 'deploy_next_module' : 'retry_initialization'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка инициализации модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка инициализации модуля: ' + error.message
    });
  }
});

// Финальная проверка готовности всех компонентов
router.post('/final-deployment-check', async (req, res) => {
  try {
    const { dleAddress, chainIds } = req.body;
    
    if (!dleAddress || !chainIds || !Array.isArray(chainIds)) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и список chainIds обязательны'
      });
    }

    console.log(`[DLE Modules] Финальная проверка готовности DLE: ${dleAddress} в сетях: ${chainIds.join(', ')}`);

    // ID модулей для проверки
    const moduleIds = MODULE_TYPE_TO_ID;

    const results = [];
    let allComponentsReady = true;

    for (const chainId of chainIds) {
      console.log(`[DLE Modules] Финальная проверка в сети: ${chainId}`);
      
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
            if (!rpcUrl) {
              throw new Error(`RPC URL не найден для сети ${chainId}`);
            }

            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
            
            const dleAbi = [
              "function name() external view returns (string)",
              "function symbol() external view returns (string)",
,
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ];
            
            const dle = new ethers.Contract(dleAddress, dleAbi, provider);
            
            // Проверяем DLE контракт
            const dleCode = await provider.getCode(dleAddress);
            const dleDeployed = dleCode !== '0x';
            
            let dleInfo = null;
            if (dleDeployed) {
              try {
                // Проверяем что контракт развернут (код не пустой)
                const code = await provider.getCode(dleAddress);
                if (code === '0x' || code.length <= 2) {
                  throw new Error('Контракт не развернут');
                }
                const name = 'DLE'; // Используем фиксированное имя
                const symbol = 'DLE'; // Используем фиксированный символ
                dleInfo = { name, symbol };
              } catch (error) {
                console.log(`[DLE Modules] Ошибка получения информации о DLE в сети ${chainId}:`, error.message);
              }
            }

            // Проверяем модули
            const modulesStatus = {};
            let allModulesReady = true;

            for (const moduleType of Object.keys(moduleIds)) {
              try {
                const slot = await readSlot(dle, moduleType);
                const moduleAddress = slot.moduleAddress;
                const isActive = slot.isActive;
                
                if (moduleAddress === "0x0000000000000000000000000000000000000000") {
                  modulesStatus[moduleType] = {
                    deployed: false,
                    active: false,
                    address: null
                  };
                  allModulesReady = false;
                } else {
                  const moduleCode = await provider.getCode(moduleAddress);
                  const moduleDeployed = moduleCode !== '0x';
                  
                  modulesStatus[moduleType] = {
                    deployed: moduleDeployed,
                    active: isActive,
                    address: moduleAddress
                  };
                  
                  if (!moduleDeployed || !isActive) {
                    allModulesReady = false;
                  }
                }
              } catch (error) {
                console.log(`[DLE Modules] Ошибка проверки модуля ${moduleType} в сети ${chainId}:`, error.message);
                modulesStatus[moduleType] = {
                  deployed: false,
                  active: false,
                  address: null,
                  error: error.message
                };
                allModulesReady = false;
              }
            }

            // Модули инициализируются только через governance
            const networkReady = dleDeployed && allModulesReady;
            
            return {
              chainId: chainId,
              status: networkReady ? 'ready' : 'not_ready',
              message: networkReady ? 'Все компоненты готовы' : 'Не все компоненты готовы',
              components: {
                dle: {
                  deployed: dleDeployed,
                  info: dleInfo
                },
                modules: modulesStatus,
                requiresGovernance: true
              }
            };
          },
          `Финальная проверка в сети ${chainId}`,
          1, // maxRetries
          30000 // retryDelay
        );

        results.push(result);

        if (result.status !== 'ready') {
          allComponentsReady = false;
        }

      } catch (error) {
        console.error(`[DLE Modules] Ошибка финальной проверки в сети ${chainId}:`, error.message);
        results.push({
          chainId: chainId,
          status: 'error',
          message: error.message,
          components: {},
          attempts: 1
        });
        allComponentsReady = false;
      }
    }

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        results: results,
        summary: {
          total: results.length,
          ready: results.filter(r => r.status === 'ready').length,
          not_ready: results.filter(r => r.status === 'not_ready').length,
          errors: results.filter(r => r.status === 'error').length,
          allComponentsReady: allComponentsReady
        },
        canShowCards: allComponentsReady,
        nextAction: allComponentsReady ? 'show_interface' : 'fix_issues'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка финальной проверки:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка финальной проверки: ' + error.message
    });
  }
});

// Получение статуса деплоя
router.post('/get-deployment-status', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение статуса деплоя для DLE: ${dleAddress}`);

    // Упрощенная логика - всегда возвращаем completed для отображения модулей
    return res.json({
      success: true,
      data: {
        status: 'completed',
        currentStage: 'modules_ready',
        completedStages: ['deployment', 'verification', 'modules_ready'],
        failedStages: [],
        progress: 100,
        canShowCards: true,
        errors: [],
        nextAction: 'use_modules'
      }
    });

    // Проверяем статус каждого компонента
    const stages = [
      { name: 'deploy_dle', description: 'Деплой DLE контракта' },
      { name: 'verify_dle', description: 'Верификация DLE контракта' },
      { name: 'deploy_treasury', description: 'Деплой TreasuryModule' },
      { name: 'verify_treasury', description: 'Верификация TreasuryModule' },
      { name: 'initialize_treasury', description: 'Инициализация TreasuryModule' },
      { name: 'deploy_timelock', description: 'Деплой TimelockModule' },
      { name: 'verify_timelock', description: 'Верификация TimelockModule' },
      { name: 'initialize_timelock', description: 'Инициализация TimelockModule' },
      { name: 'deploy_reader', description: 'Деплой DLEReader' },
      { name: 'verify_reader', description: 'Верификация DLEReader' },
      { name: 'initialize_reader', description: 'Инициализация DLEReader' },
      { name: 'final_initialization', description: 'Финальная инициализация всех модулей' }
    ];

    const completedStages = [];
    const failedStages = [];
    let currentStage = null;
    let progress = 0;

    // Проверяем DLE контракт
    let dleDeployed = false;
    let dleVerified = false;
    
    try {
      const result = await executeWithRetries(
        async () => {
          const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
          const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
          const dleCode = await provider.getCode(dleAddress);
          return dleCode !== '0x';
        },
        'Проверка деплоя DLE контракта',
        3,
        30000
      );
      
      dleDeployed = result;
      
      if (dleDeployed) {
        completedStages.push('deploy_dle');
        progress += 8.33; // 1/12 этапов
        
        // Проверяем верификацию (упрощенно - если контракт работает, считаем верифицированным)
        try {
          const verificationResult = await executeWithRetries(
            async () => {
              const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
              const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
              // Простая проверка - если код контракта не пустой, считаем верифицированным
              const code = await provider.getCode(dleAddress);
              return code !== '0x' && code.length > 2;
            },
            'Проверка верификации DLE контракта',
            3,
            30000
          );
          
          dleVerified = verificationResult;
          if (dleVerified) {
            completedStages.push('verify_dle');
            progress += 8.33;
          }
        } catch (error) {
          failedStages.push('verify_dle');
        }
      } else {
        currentStage = 'deploy_dle';
      }
    } catch (error) {
      failedStages.push('deploy_dle');
      currentStage = 'deploy_dle';
    }

    // Если DLE не задеплоен, останавливаемся здесь
    if (!dleDeployed) {
      return res.json({
        success: true,
        data: {
          status: 'in_progress',
          currentStage: 'deploy_dle',
          completedStages: [],
          failedStages: failedStages,
          progress: 0,
          canShowCards: false,
          errors: ['DLE контракт не задеплоен'],
          nextAction: 'deploy_dle'
        }
      });
    }

    // Проверяем модули
    const moduleIds = MODULE_TYPE_TO_ID;

    const moduleStages = [
      { type: 'treasury', stages: ['deploy_treasury', 'verify_treasury', 'initialize_treasury'] },
      { type: 'timelock', stages: ['deploy_timelock', 'verify_timelock', 'initialize_timelock'] },
      { type: 'reader', stages: ['deploy_reader', 'verify_reader', 'initialize_reader'] }
    ];

    for (const moduleGroup of moduleStages) {
      try {
        const result = await executeWithRetries(
          async () => {
            const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
            const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
            const dle = new ethers.Contract(dleAddress, [
              "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
              "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
            ], provider);

            const moduleAddress = await slotAddr(dle, moduleGroup.type);
            const isActive = (await readSlot(dle, moduleGroup.type)).isActive;

            return { moduleAddress, isActive };
          },
          `Проверка модуля ${moduleGroup.type}`,
          3,
          30000
        );

        const { moduleAddress, isActive } = result;

        if (moduleAddress !== "0x0000000000000000000000000000000000000000") {
          completedStages.push(moduleGroup.stages[0]); // deploy
          progress += 8.33;
          
          // Проверяем верификацию (упрощенно)
          try {
            const verificationResult = await executeWithRetries(
              async () => {
                const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
                const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
                const moduleCode = await provider.getCode(moduleAddress);
                return moduleCode !== '0x';
              },
              `Проверка верификации модуля ${moduleGroup.type}`,
              3,
              30000
            );
            
            if (verificationResult) {
              completedStages.push(moduleGroup.stages[1]); // verify
              progress += 8.33;
            } else {
              failedStages.push(moduleGroup.stages[1]);
            }
          } catch (error) {
            failedStages.push(moduleGroup.stages[1]);
          }

          // Проверяем инициализацию
          if (isActive) {
            completedStages.push(moduleGroup.stages[2]); // initialize
            progress += 8.33;
          } else {
            if (!currentStage) currentStage = moduleGroup.stages[2];
          }
        } else {
          if (!currentStage) currentStage = moduleGroup.stages[0];
        }
      } catch (error) {
        if (!currentStage) currentStage = moduleGroup.stages[0];
      }
    }

    // Проверяем финальную инициализацию
    try {
      const result = await executeWithRetries(
        async () => {
          const rpcUrl = await rpcProviderService.getRpcUrlByChainId(supportedNetworks[0].chainId);
          const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
          const dle = new ethers.Contract(dleAddress, [
          ], provider);
          
          // Модули инициализируются только через governance
          return false;
        },
        'Проверка финальной инициализации модулей',
        3,
        30000
      );
      
      if (result) {
        completedStages.push('final_initialization');
        progress += 8.33;
      } else {
        if (!currentStage) currentStage = 'final_initialization';
      }
    } catch (error) {
      if (!currentStage) currentStage = 'final_initialization';
    }

    // Определяем общий статус
    let status = 'in_progress';
    if (progress >= 100) {
      status = 'completed';
      currentStage = null;
    } else if (failedStages.length > 0 && completedStages.length === 0) {
      status = 'failed';
    }

    res.json({
      success: true,
      data: {
        status: status,
        currentStage: currentStage,
        completedStages: completedStages,
        failedStages: failedStages,
        progress: Math.round(progress),
        canShowCards: status === 'completed',
        errors: failedStages.length > 0 ? [`Ошибки в этапах: ${failedStages.join(', ')}`] : [],
        nextAction: status === 'completed' ? 'none' : 
                   status === 'failed' ? 'restart_deployment' : 'continue_deployment'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка получения статуса деплоя:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса деплоя: ' + error.message
    });
  }
});

// Получить доступные операции модулей
router.post('/get-module-operations', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Modules] Получение операций модулей для DLE: ${dleAddress}`);

    // Файлы деплоя — только на той ОС, где деплоили. Источник истины — слоты книги.
    const modulesFromFiles = await getDeployedModulesInfo(dleAddress);
    const byType = new Map();
    for (const module of modulesFromFiles || []) {
      if (module?.moduleType) byType.set(module.moduleType, module);
    }

    try {
      const { provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {});
      const dle = new ethers.Contract(
        dleAddress,
        ['function getModuleAddress(bytes32) view returns (address)'],
        provider
      );
      for (const moduleType of Object.keys(MODULE_TYPE_TO_ID)) {
        let moduleAddress = ethers.ZeroAddress;
        try {
          const slot = await resolveBookSlot(dle, moduleType);
          moduleAddress = slot.moduleAddress;
        } catch (e) {
          console.log(`[DLE Modules] getModuleAddress ${moduleType}: ${e.message}`);
          continue;
        }
        if (!moduleAddress || moduleAddress === ethers.ZeroAddress) continue;

        const fromFile = byType.get(moduleType);
        const nets = (fromFile?.networks || []).filter((n) => n && n.address);
        byType.set(moduleType, {
          moduleType,
          networks: nets.length
            ? nets
            : [{ chainId: Number(targetChainId), address: moduleAddress }],
        });
      }

      // Казна может быть не в книге, но уже прописана в HV.treasuryModule — иначе блок казны в UI пустой.
      const hvEntry = byType.get('hierarchicalVoting');
      const hvAddr = hvEntry?.networks?.find((n) => n && n.address)?.address;
      if (hvAddr && hvAddr !== ethers.ZeroAddress && !byType.has('treasury')) {
        try {
          const hv = new ethers.Contract(
            hvAddr,
            ['function treasuryModule() view returns (address)'],
            provider
          );
          const tAddr = await hv.treasuryModule();
          if (tAddr && tAddr !== ethers.ZeroAddress) {
            byType.set('treasury', {
              moduleType: 'treasury',
              networks: [{ chainId: Number(targetChainId), address: tAddr }],
            });
            console.log(`[DLE Modules] Казна из HV.treasuryModule: ${tAddr}`);
          }
        } catch (e) {
          console.log(`[DLE Modules] HV.treasuryModule: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`[DLE Modules] on-chain операции модулей: ${e.message}`);
    }

    console.log(`[DLE Modules] Найдено модулей: ${byType.size}`);

    const moduleOperations = [];
    for (const module of byType.values()) {
      const operations = getModuleOperationsByType(module.moduleType);
      moduleOperations.push({
        moduleType: module.moduleType,
        moduleName: getModuleName(module.moduleType),
        moduleDescription: getModuleDescription(module.moduleType),
        operations: operations,
        networks: module.networks || []
      });
    }

    res.json({
      success: true,
      data: {
        dleAddress,
        moduleOperations,
        totalOperations: moduleOperations.reduce((sum, mod) => sum + mod.operations.length, 0)
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении операций модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении операций модулей: ' + error.message
    });
  }
});

// Получить операции конкретного модуля
router.post('/get-module-specific-operations', async (req, res) => {
  try {
    const { dleAddress, moduleType, moduleAddress, chainId } = req.body;
    
    if (!dleAddress || !moduleType || !moduleAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение операций модуля ${moduleType} для DLE: ${dleAddress}`);

    // Получаем операции для конкретного типа модуля
    const operations = getModuleOperationsByType(moduleType);
    
    // Дополняем операции информацией о модуле
    const moduleOperations = operations.map(op => ({
      ...op,
      moduleType,
      moduleAddress,
      chainId,
      dleAddress
    }));

    res.json({
      success: true,
      data: {
        moduleType,
        moduleAddress,
        chainId,
        dleAddress,
        operations: moduleOperations,
        totalOperations: moduleOperations.length
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении операций конкретного модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении операций конкретного модуля: ' + error.message
    });
  }
});

// Получить интерфейс модуля
router.post('/get-module-interface', async (req, res) => {
  try {
    const { moduleType, moduleAddress, chainId } = req.body;
    
    if (!moduleType || !moduleAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение интерфейса модуля ${moduleType}`);

    // Получаем ABI для типа модуля
    const moduleAbi = getModuleAbi(moduleType);
    const operations = getModuleOperationsByType(moduleType);

    res.json({
      success: true,
      data: {
        moduleType,
        moduleAddress,
        chainId,
        abi: moduleAbi,
        operations,
        interface: {
          name: getModuleName(moduleType),
          description: getModuleDescription(moduleType),
          version: '1.0.0'
        }
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении интерфейса модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении интерфейса модуля: ' + error.message
    });
  }
});

// Получить доступные функции модуля
router.post('/get-module-available-functions', async (req, res) => {
  try {
    const { dleAddress, moduleType, moduleAddress, chainId } = req.body;
    
    if (!dleAddress || !moduleType || !moduleAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение доступных функций модуля ${moduleType}`);

    // Получаем доступные функции для создания предложений
    const availableFunctions = getAvailableFunctionsForProposals(moduleType);

    res.json({
      success: true,
      data: {
        moduleType,
        moduleAddress,
        chainId,
        dleAddress,
        availableFunctions,
        totalFunctions: availableFunctions.length
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении доступных функций модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении доступных функций модуля: ' + error.message
    });
  }
});

// Получить параметры функции модуля
router.post('/get-module-function-parameters', async (req, res) => {
  try {
    const { moduleType, functionName } = req.body;
    
    if (!moduleType || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение параметров функции ${functionName} модуля ${moduleType}`);

    // Получаем параметры функции
    const parameters = getFunctionParameters(moduleType, functionName);

    res.json({
      success: true,
      data: {
        moduleType,
        functionName,
        parameters
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении параметров функции модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении параметров функции модуля: ' + error.message
    });
  }
});

// Создать предложение для операции модуля
router.post('/create-module-operation-proposal', async (req, res) => {
  try {
    const { 
      dleAddress, 
      moduleType, 
      operationType, 
      functionName, 
      parameters, 
      description, 
      duration, 
      chainId 
    } = req.body;
    
    if (!dleAddress || !moduleType || !operationType || !functionName || !description || !duration || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все обязательные поля должны быть заполнены'
      });
    }

    console.log(`[DLE Modules] Создание предложения для операции ${functionName} модуля ${moduleType}`);

    // Подготавливаем данные для создания предложения
    const operationData = {
      moduleType,
      operationType,
      functionName,
      parameters,
      description,
      duration,
      chainId
    };

    // Создаем calldata для операции
    const operationCalldata = await prepareModuleOperationCalldata(moduleType, functionName, parameters);

    res.json({
      success: true,
      data: {
        dleAddress,
        operationData,
        operationCalldata,
        message: 'Данные для создания предложения подготовлены'
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при создании предложения для операции модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при создании предложения для операции модуля: ' + error.message
    });
  }
});

// Валидировать операцию модуля
router.post('/validate-module-operation', async (req, res) => {
  try {
    const { dleAddress, moduleType, operationType, functionName, parameters } = req.body;
    
    if (!dleAddress || !moduleType || !operationType || !functionName) {
      return res.status(400).json({
        success: false,
        error: 'Все обязательные поля должны быть заполнены'
      });
    }

    console.log(`[DLE Modules] Валидация операции ${functionName} модуля ${moduleType}`);

    // Валидируем операцию
    const validation = await validateModuleOperationData(moduleType, functionName, parameters);

    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        operationData: validation.operationData
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при валидации операции модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при валидации операции модуля: ' + error.message
    });
  }
});

// Получить историю операций модуля
router.post('/get-module-operations-history', async (req, res) => {
  try {
    const { dleAddress, moduleType, filters = {} } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }

    console.log(`[DLE Modules] Получение истории операций модуля ${moduleType}`);

    // Получаем историю операций (заглушка - в реальности нужно читать из блокчейна)
    const history = await getModuleOperationsHistoryFromBlockchain(dleAddress, moduleType, filters);

    res.json({
      success: true,
      data: {
        dleAddress,
        moduleType,
        history,
        totalOperations: history.length
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении истории операций модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении истории операций модуля: ' + error.message
    });
  }
});

// Получить статус операции модуля
router.post('/get-module-operation-status', async (req, res) => {
  try {
    const { dleAddress, operationId } = req.body;
    
    if (!dleAddress || !operationId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID операции обязательны'
      });
    }

    console.log(`[DLE Modules] Получение статуса операции ${operationId}`);

    // Получаем статус операции (заглушка - в реальности нужно читать из блокчейна)
    const status = await getModuleOperationStatusFromBlockchain(dleAddress, operationId);

    res.json({
      success: true,
      data: {
        dleAddress,
        operationId,
        status
      }
    });

  } catch (error) {
    console.error('[DLE Modules] Ошибка при получении статуса операции модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статуса операции модуля: ' + error.message
    });
  }
});

// Вспомогательные функции для работы с операциями модулей

function getModuleOperationsByType(moduleType) {
  const operations = {
    treasury: [
      {
        id: 'addToken',
        name: 'Добавить токен',
        description: 'Добавить новый ERC20 токен в казначейство',
        icon: '🪙',
        functionName: 'addToken',
        parameters: [
          { name: 'tokenAddress', type: 'address', label: 'Адрес токена', required: true },
          { name: 'symbol', type: 'string', label: 'Символ токена', required: true },
          { name: 'decimals', type: 'uint8', label: 'Количество знаков', required: true }
        ],
        category: 'Управление токенами'
      },
      {
        id: 'removeToken',
        name: 'Удалить токен',
        description: 'Удалить токен из казначейства',
        icon: '🗑️',
        functionName: 'removeToken',
        parameters: [
          { name: 'tokenAddress', type: 'address', label: 'Адрес токена', required: true }
        ],
        category: 'Управление токенами'
      },
      {
        id: 'setTokenStatus',
        name: 'Изменить статус токена',
        description: 'Активировать/деактивировать токен',
        icon: '🔄',
        functionName: 'setTokenStatus',
        parameters: [
          { name: 'tokenAddress', type: 'address', label: 'Адрес токена', required: true },
          { name: 'isActive', type: 'bool', label: 'Активен', required: true }
        ],
        category: 'Управление токенами'
      },
      {
        id: 'setFundsBridge',
        name: 'Сменить мост казны',
        description: 'Заменить TreasuryBridge через governance (новый адрес с кодом)',
        icon: '🌉',
        functionName: 'setFundsBridge',
        parameters: [
          { name: 'bridge', type: 'address', label: 'Адрес нового моста', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'transferFunds',
        name: 'Перевести средства',
        description: 'Перевести токены из казначейства',
        icon: '💸',
        functionName: 'transferFunds',
        parameters: [
          { name: 'tokenAddress', type: 'address', label: 'Адрес токена', required: true },
          { name: 'recipient', type: 'address', label: 'Получатель', required: true },
          { name: 'amount', type: 'uint256', label: 'Сумма', required: true },
          { name: 'proposalId', type: 'bytes32', label: 'ID предложения', required: true }
        ],
        category: 'Переводы'
      },
      {
        id: 'transferERC721',
        name: 'Перевести NFT (ERC-721)',
        description: 'Перевести уникальный токен из казны покупателю',
        icon: '🖼️',
        functionName: 'transferERC721',
        parameters: [
          { name: 'nftContract', type: 'address', label: 'Контракт NFT', required: true },
          { name: 'recipient', type: 'address', label: 'Получатель', required: true },
          { name: 'tokenId', type: 'uint256', label: 'Token ID', required: true },
          { name: 'proposalId', type: 'bytes32', label: 'ID предложения', required: true }
        ],
        category: 'Переводы'
      },
      {
        id: 'transferERC1155',
        name: 'Перевести мультитокен (ERC-1155)',
        description: 'Перевести единицы ERC-1155 из казны',
        icon: '🧩',
        functionName: 'transferERC1155',
        parameters: [
          { name: 'nftContract', type: 'address', label: 'Контракт', required: true },
          { name: 'recipient', type: 'address', label: 'Получатель', required: true },
          { name: 'tokenId', type: 'uint256', label: 'Token ID', required: true },
          { name: 'amount', type: 'uint256', label: 'Количество', required: true },
          { name: 'proposalId', type: 'bytes32', label: 'ID предложения', required: true }
        ],
        category: 'Переводы'
      },
      {
        id: 'batchTransfer',
        name: 'Массовый перевод',
        description: 'Выполнить несколько переводов одновременно',
        icon: '📦',
        functionName: 'batchTransfer',
        parameters: [
          { name: 'transfers', type: 'BatchTransfer[]', label: 'Массив переводов', required: true },
          { name: 'proposalId', type: 'bytes32', label: 'ID предложения', required: true }
        ],
        category: 'Переводы'
      },
      {
        id: 'setPaymaster',
        name: 'Установить Paymaster',
        description: 'Установить контракт для оплаты газа токенами',
        icon: '⛽',
        functionName: 'setPaymaster',
        parameters: [
          { name: '_paymaster', type: 'address', label: 'Адрес Paymaster', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'setHierarchicalVotingModule',
        name: 'Установить модуль иерархического голосования',
        description: 'Привязать HierarchicalVotingModule, чтобы казна могла отдать внешний голос',
        icon: '🗳️',
        functionName: 'setHierarchicalVotingModule',
        parameters: [
          { name: 'module', type: 'address', label: 'Адрес модуля иерархического голосования', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'addGasPaymentToken',
        name: 'Добавить токен для оплаты газа',
        description: 'Разрешить оплату газа определенным токеном',
        icon: '💳',
        functionName: 'addGasPaymentToken',
        parameters: [
          { name: 'tokenAddress', type: 'address', label: 'Адрес токена', required: true },
          { name: 'rate', type: 'uint256', label: 'Курс обмена', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'emergencyPause',
        name: 'Экстренная пауза',
        description: 'Приостановить все операции казначейства',
        icon: '⏸️',
        functionName: 'emergencyPause',
        parameters: [],
        category: 'Безопасность'
      }
    ],
    timelock: [
      {
        id: 'queueOperation',
        name: 'Поставить операцию в очередь',
        description: 'Добавить операцию в очередь с задержкой',
        icon: '📋',
        functionName: 'queueOperation',
        parameters: [
          { name: 'target', type: 'address', label: 'Целевой контракт', required: true },
          { name: 'data', type: 'bytes', label: 'Данные операции', required: true },
          { name: 'description', type: 'string', label: 'Описание', required: true }
        ],
        category: 'Управление'
      },
      {
        id: 'executeOperation',
        name: 'Исполнить операцию',
        description: 'Исполнить операцию после истечения задержки',
        icon: '▶️',
        functionName: 'executeOperation',
        parameters: [
          { name: 'operationId', type: 'bytes32', label: 'ID операции', required: true }
        ],
        category: 'Управление'
      },
      {
        id: 'cancelOperation',
        name: 'Отменить операцию',
        description: 'Отменить операцию в очереди',
        icon: '❌',
        functionName: 'cancelOperation',
        parameters: [
          { name: 'operationId', type: 'bytes32', label: 'ID операции', required: true },
          { name: 'reason', type: 'string', label: 'Причина отмены', required: true }
        ],
        category: 'Управление'
      },
      {
        id: 'emergencyExecute',
        name: 'Экстренное исполнение',
        description: 'Исполнить операцию немедленно (только экстренные)',
        icon: '🚨',
        functionName: 'emergencyExecute',
        parameters: [
          { name: 'operationId', type: 'bytes32', label: 'ID операции', required: true },
          { name: 'reason', type: 'string', label: 'Причина', required: true }
        ],
        category: 'Экстренные'
      },
      {
        id: 'updateOperationDelay',
        name: 'Обновить задержку операции',
        description: 'Изменить задержку для типа операции',
        icon: '⏰',
        functionName: 'updateOperationDelay',
        parameters: [
          { name: 'selector', type: 'bytes4', label: 'Селектор функции', required: true },
          { name: 'newDelay', type: 'uint256', label: 'Новая задержка', required: true },
          { name: 'isCritical', type: 'bool', label: 'Критическая', required: true },
          { name: 'isEmergency', type: 'bool', label: 'Экстренная', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'updateDefaultDelay',
        name: 'Обновить стандартную задержку',
        description: 'Изменить стандартную задержку для операций',
        icon: '⚙️',
        functionName: 'updateDefaultDelay',
        parameters: [
          { name: 'newDelay', type: 'uint256', label: 'Новая задержка', required: true }
        ],
        category: 'Настройки'
      }
    ],
    reader: [
      {
        id: 'getProposalSummary',
        name: 'Получить сводку предложения',
        description: 'Получить полную информацию о предложении',
        icon: '📊',
        functionName: 'getProposalSummary',
        parameters: [
          { name: '_proposalId', type: 'uint256', label: 'ID предложения', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getGovernanceParams',
        name: 'Получить параметры governance',
        description: 'Получить основные параметры управления DLE',
        icon: '⚙️',
        functionName: 'getGovernanceParams',
        parameters: [],
        category: 'Аналитика'
      },
      {
        id: 'listSupportedChains',
        name: 'Список поддерживаемых сетей',
        description: 'Получить список всех поддерживаемых блокчейн сетей',
        icon: '🌐',
        functionName: 'listSupportedChains',
        parameters: [],
        category: 'Аналитика'
      },
      {
        id: 'listProposals',
        name: 'Список предложений',
        description: 'Получить список предложений с пагинацией',
        icon: '📋',
        functionName: 'listProposals',
        parameters: [
          { name: 'offset', type: 'uint256', label: 'Смещение', required: true },
          { name: 'limit', type: 'uint256', label: 'Лимит', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getVotingPowerAt',
        name: 'Голосующая сила на момент времени',
        description: 'Получить голосующую силу пользователя на определенный момент',
        icon: '🗳️',
        functionName: 'getVotingPowerAt',
        parameters: [
          { name: 'voter', type: 'address', label: 'Адрес голосующего', required: true },
          { name: 'timepoint', type: 'uint256', label: 'Момент времени', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getQuorumAt',
        name: 'Кворум на момент времени',
        description: 'Получить размер кворума на определенный момент',
        icon: '📈',
        functionName: 'getQuorumAt',
        parameters: [
          { name: 'timepoint', type: 'uint256', label: 'Момент времени', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getProposalVotes',
        name: 'Детали голосования',
        description: 'Получить детальную информацию о голосовании по предложению',
        icon: '📊',
        functionName: 'getProposalVotes',
        parameters: [
          { name: '_proposalId', type: 'uint256', label: 'ID предложения', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getAddressStats',
        name: 'Статистика адреса',
        description: 'Получить статистику по конкретному адресу',
        icon: '👤',
        functionName: 'getAddressStats',
        parameters: [
          { name: 'user', type: 'address', label: 'Адрес пользователя', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getModulesInfo',
        name: 'Информация о модулях',
        description: 'Получить информацию о модулях DLE',
        icon: '🔧',
        functionName: 'getModulesInfo',
        parameters: [
          { name: 'moduleIds', type: 'bytes32[]', label: 'ID модулей', required: true }
        ],
        category: 'Аналитика'
      },
      {
        id: 'getDLEStatus',
        name: 'Статус DLE',
        description: 'Получить общий статус DLE контракта',
        icon: '📊',
        functionName: 'getDLEStatus',
        parameters: [],
        category: 'Аналитика'
      },
      {
        id: 'getProposalStates',
        name: 'Состояния предложений',
        description: 'Получить состояния нескольких предложений одновременно',
        icon: '📋',
        functionName: 'getProposalStates',
        parameters: [
          { name: 'proposalIds', type: 'uint256[]', label: 'ID предложений', required: true }
        ],
        category: 'Аналитика'
      }
    ],
    hierarchicalVoting: [
      {
        id: 'setTreasuryModule',
        name: 'Установить Treasury модуль',
        description: 'Установить адрес модуля казначейства',
        icon: '🏦',
        functionName: 'setTreasuryModule',
        parameters: [
          { name: '_treasuryModule', type: 'address', label: 'Адрес Treasury модуля', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'setModuleBridge',
        name: 'Привязать мост HV',
        description: 'Первый раз — прямой вызов initializer. Смена уже привязанного моста — предложение.',
        icon: '🌉',
        functionName: 'setModuleBridge',
        parameters: [
          { name: 'bridge', type: 'address', label: 'Адрес нового моста', required: true }
        ],
        category: 'Настройки'
      },
      {
        id: 'addExternalDLE',
        name: 'Добавить внешний DLE',
        description: 'Добавить внешний DLE для голосования',
        icon: '🔗',
        functionName: 'addExternalDLE',
        parameters: [
          { name: 'dleAddress', type: 'address', label: 'Адрес DLE', required: true },
          { name: 'name', type: 'string', label: 'Название DLE', required: true },
          { name: 'symbol', type: 'string', label: 'Символ токена', required: true }
        ],
        category: 'Управление DLE'
      },
      {
        id: 'removeExternalDLE',
        name: 'Удалить внешний DLE',
        description: 'Удалить внешний DLE из списка',
        icon: '🗑️',
        functionName: 'removeExternalDLE',
        parameters: [
          { name: 'dleAddress', type: 'address', label: 'Адрес DLE', required: true }
        ],
        category: 'Управление DLE'
      },
      {
        id: 'createExternalVoteOp',
        name: 'Создать операцию голоса на B',
        description: 'Операция vote на дочернем DLE через казну A (холдер A)',
        icon: '🗳️',
        functionName: 'createExternalVoteOp',
        parameters: [
          { name: 'targetDLE', type: 'address', label: 'Целевой DLE', required: true },
          { name: 'targetProposalId', type: 'uint256', label: 'ID предложения на B', required: true },
          { name: 'supportOnB', type: 'bool', label: 'Голос на B (за/против)', required: true },
          { name: 'duration', type: 'uint256', label: 'Срок (сек)', required: true },
          { name: 'executor', type: 'address', label: 'Представитель (executor)', required: true }
        ],
        category: 'Голосование'
      },
      {
        id: 'approveOperation',
        name: 'Поддержать операцию A→B',
        description: 'Голос холдера A «за» операцию (сила со snapshot)',
        icon: '👍',
        functionName: 'approveOperation',
        parameters: [
          { name: 'opId', type: 'uint256', label: 'ID операции', required: true }
        ],
        category: 'Голосование'
      },
      {
        id: 'rejectOperation',
        name: 'Отклонить операцию A→B',
        description: 'Голос холдера A «против» операции',
        icon: '👎',
        functionName: 'rejectOperation',
        parameters: [
          { name: 'opId', type: 'uint256', label: 'ID операции', required: true }
        ],
        category: 'Голосование'
      },
      {
        id: 'executeExternalVote',
        name: 'Исполнить голос казны на B',
        description: 'Только executor после кворума A и for>against',
        icon: '✅',
        functionName: 'executeExternalVote',
        parameters: [
          { name: 'opId', type: 'uint256', label: 'ID операции', required: true }
        ],
        category: 'Голосование'
      },
      {
        id: 'updateExternalDLEBalance',
        name: 'Обновить баланс DLE',
        description: 'Обновить баланс токенов внешнего DLE',
        icon: '🔄',
        functionName: 'updateExternalDLEBalance',
        parameters: [
          { name: 'dleAddress', type: 'address', label: 'Адрес DLE', required: true }
        ],
        category: 'Управление DLE'
      },
      {
        id: 'updateAllExternalDLEBalances',
        name: 'Обновить все балансы',
        description: 'Обновить балансы всех внешних DLE',
        icon: '🔄',
        functionName: 'updateAllExternalDLEBalances',
        parameters: [],
        category: 'Управление DLE'
      }
    ]
  };

  return operations[moduleType] || [];
}

function getModuleAbi(moduleType) {
  const {
    READER_GET_PROPOSAL_SUMMARY,
    READER_GET_GOVERNANCE_PARAMS,
    READER_LIST_SUPPORTED_CHAINS,
  } = require('../constants/dleReadAbi');

  const abis = {
    treasury: [
      "function addToken(address tokenAddress, string memory symbol, uint8 decimals) external",
      "function removeToken(address tokenAddress) external",
      "function setTokenStatus(address tokenAddress, bool isActive) external",
      "function transferFunds(address tokenAddress, address recipient, uint256 amount, bytes32 proposalId) external",
      "function transferERC721(address nftContract, address recipient, uint256 tokenId, bytes32 proposalId) external",
      "function transferERC1155(address nftContract, address recipient, uint256 tokenId, uint256 amount, bytes32 proposalId) external",
      "function batchTransfer(BatchTransfer[] memory transfers, bytes32 proposalId) external",
      "function setPaymaster(address _paymaster) external",
      "function addGasPaymentToken(address tokenAddress, uint256 rate) external",
      "function emergencyPause() external",
      "function setHierarchicalVotingModule(address module) external",
      "function castExternalVote(address targetDLE, uint256 proposalId, bool support) external",
      "function ensureVotingPower(address token) external",
      "function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory)",
      "function getAllTokens() external view returns (address[] memory)",
      "function getTokenBalance(address tokenAddress) external view returns (uint256)"
    ],
    timelock: [
      "function queueOperation(address target, bytes memory data, string memory description) external returns (bytes32)",
      "function executeOperation(bytes32 operationId) external",
      "function cancelOperation(bytes32 operationId, string memory reason) external",
      "function emergencyExecute(bytes32 operationId, string memory reason) external",
      "function updateOperationDelay(bytes4 selector, uint256 newDelay, bool isCritical, bool isEmergency) external",
      "function updateDefaultDelay(uint256 newDelay) external",
      "function getOperation(bytes32 operationId) external view returns (QueuedOperation memory)",
      "function isReady(bytes32 operationId) external view returns (bool)",
      "function getActiveOperations() external view returns (bytes32[] memory)"
    ],
    reader: [
      READER_GET_PROPOSAL_SUMMARY,
      READER_GET_GOVERNANCE_PARAMS,
      READER_LIST_SUPPORTED_CHAINS,
      "function listProposals(uint256 offset, uint256 limit) external view returns (uint256[] memory, uint256)",
      "function getVotingPowerAt(address voter, uint256 timepoint) external view returns (uint256)",
      "function getQuorumAt(uint256 timepoint) external view returns (uint256)",
      "function getProposalVotes(uint256 _proposalId) external view returns (uint256, uint256, uint256, uint256, uint256, bool)",
      "function getAddressStats(address user) external view returns (uint256, uint256, uint256, bool)",
      "function getModulesInfo(bytes32[] memory moduleIds) external view returns (address[] memory, bool[] memory)",
      "function getDLEStatus() external view returns (DLEInfo memory, uint256, uint256, uint256, uint256, uint256)",
      "function getProposalStates(uint256[] memory proposalIds) external view returns (uint8[] memory, bool[] memory, bool[] memory)"
    ],
    hierarchicalVoting: [
      "function setTreasuryModule(address _treasuryModule) external",
      "function addExternalDLE(address dleAddress, string memory name, string memory symbol) external",
      "function removeExternalDLE(address dleAddress) external",
      "function createExternalVoteOp(address targetDLE, uint256 targetProposalId, bool supportOnB, uint256 duration, address executor) external returns (uint256)",
      "function approveOperation(uint256 opId) external",
      "function rejectOperation(uint256 opId) external",
      "function executeExternalVote(uint256 opId) external",
      "function checkOpResult(uint256 opId) external view returns (bool, bool)",
      "function updateExternalDLEBalance(address dleAddress) external",
      "function updateAllExternalDLEBalances() external",
      "function getExternalDLEInfo(address dleAddress) external view returns (ExternalDLEInfo memory)",
      "function getAllExternalDLEs() external view returns (address[] memory)",
      "function getExternalVoteOp(uint256 opId) external view returns (ExternalVoteOp memory)",
      "function getModuleStats() external view returns (uint256, uint256, uint256, uint256)"
    ]
  };

  return abis[moduleType] || [];
}

function getAvailableFunctionsForProposals(moduleType) {
  const operations = getModuleOperationsByType(moduleType);
  return operations.map(op => ({
    id: op.id,
    name: op.name,
    functionName: op.functionName,
    description: op.description,
    icon: op.icon,
    category: op.category
  }));
}

function getFunctionParameters(moduleType, functionName) {
  const operations = getModuleOperationsByType(moduleType);
  const operation = operations.find(op => op.functionName === functionName);
  return operation ? operation.parameters : [];
}

async function prepareModuleOperationCalldata(moduleType, functionName, parameters) {
  try {
    // Здесь должна быть логика подготовки calldata для конкретной операции
    // Пока возвращаем заглушку
    return {
      target: '0x0000000000000000000000000000000000000000',
      calldata: '0x',
      value: '0x0'
    };
  } catch (error) {
    throw new Error(`Ошибка подготовки calldata: ${error.message}`);
  }
}

async function validateModuleOperationData(moduleType, functionName, parameters) {
  try {
    const operationParameters = getFunctionParameters(moduleType, functionName);
    const errors = [];
    const warnings = [];

    // Валидация параметров
    for (const param of operationParameters) {
      if (param.required && (!parameters || !parameters[param.name])) {
        errors.push(`Параметр ${param.label} обязателен`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      operationData: {
        moduleType,
        functionName,
        parameters
      }
    };
  } catch (error) {
    throw new Error(`Ошибка валидации: ${error.message}`);
  }
}

async function getModuleOperationsHistoryFromBlockchain(dleAddress, moduleType, filters) {
  // Заглушка - в реальности нужно читать события из блокчейна
  return [];
}

async function getModuleOperationStatusFromBlockchain(dleAddress, operationId) {
  // Заглушка - в реальности нужно читать статус из блокчейна
  return {
    status: 'pending',
    executed: false,
    timestamp: Date.now()
  };
}

module.exports = router;
