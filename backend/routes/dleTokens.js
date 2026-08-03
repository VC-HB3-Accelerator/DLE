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
const { resolveDleProvider } = require('../services/dleNetworkResolveService');
const {
  fetchGovernanceParams,
  ReaderNotFoundError,
} = require('../services/dleReaderResolveService');

const TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function initializer() external view returns (address)',
];

/**
 * Кандидаты в holders: mint Transfer(from=0) + initializer, затем balanceOf > 0.
 */
async function collectHoldersFromMints(dleAddress, provider) {
  const dle = new ethers.Contract(dleAddress, TRANSFER_ABI, provider);
  const totalSupplyBn = await dle.totalSupply();
  const totalSupplyNum = Number(totalSupplyBn);
  const candidates = new Set();

  try {
    const init = await dle.initializer();
    if (init && init !== ethers.ZeroAddress) candidates.add(ethers.getAddress(init));
  } catch (_) {
    /* optional */
  }

  const currentBlock = await provider.getBlockNumber();
  const searchRange = 50_000;
  const chunkSize = 1_500;
  const fromBlock = Math.max(0, currentBlock - searchRange);
  const mintFilter = dle.filters.Transfer(ethers.ZeroAddress);

  for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock);
    try {
      const mints = await dle.queryFilter(mintFilter, start, end);
      for (const ev of mints) {
        const to = ev.args?.to;
        if (to && to !== ethers.ZeroAddress) candidates.add(ethers.getAddress(to));
      }
    } catch (e) {
      console.log(
        `[DLE Tokens] mint Transfer ${start}-${end} skip:`,
        e.shortMessage || e.message
      );
    }
  }

  const holders = [];
  for (const address of candidates) {
    try {
      const balance = await dle.balanceOf(address);
      if (balance > 0n) {
        const balNum = Number(balance);
        holders.push({
          address,
          balance: ethers.formatUnits(balance, 18),
          percentage: totalSupplyNum > 0 ? (balNum / totalSupplyNum) * 100 : 0,
        });
      }
    } catch (e) {
      console.log(`[DLE Tokens] balanceOf ${address}:`, e.message);
    }
  }

  holders.sort((a, b) => Number(b.balance) - Number(a.balance));
  return { holders, totalSupply: ethers.formatUnits(totalSupplyBn, 18) };
}

// Получить баланс токенов
router.post('/get-token-balance', async (req, res) => {
  try {
    const { dleAddress, account, chainId: preferChainId } = req.body;

    if (!dleAddress || !account) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и адрес аккаунта обязательны',
      });
    }

    const { provider } = await resolveDleProvider(dleAddress, { preferChainId });
    const dle = new ethers.Contract(
      dleAddress,
      ['function balanceOf(address account) external view returns (uint256)'],
      provider
    );
    const balance = await dle.balanceOf(account);

    res.json({
      success: true,
      data: {
        account,
        balance: ethers.formatUnits(balance, 18),
      },
    });
  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении баланса токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении баланса токенов: ' + error.message,
    });
  }
});

// Получить общее предложение токенов (через DLEReader.getGovernanceParams)
router.post('/get-total-supply', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;

    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен',
      });
    }

    console.log(`[DLE Tokens] Получение totalSupply (Reader) для DLE: ${dleAddress}`);

    const { provider, chainId } = await resolveDleProvider(dleAddress, { preferChainId });
    const params = await fetchGovernanceParams({
      dleAddress,
      provider,
      chainId,
    });

    res.json({
      success: true,
      data: {
        totalSupply: ethers.formatUnits(params.totalSupply, 18),
        readerAddress: params.readerAddress,
        chainId: params.chainId,
      },
    });
  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении общего предложения токенов:', error);
    const status = error instanceof ReaderNotFoundError ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Ошибка при получении общего предложения токенов: ' + error.message,
      code: error.code || undefined,
    });
  }
});

// Получить держателей токенов (mint Transfer + balanceOf)
router.post('/get-token-holders', async (req, res) => {
  try {
    const { dleAddress, offset = 0, limit = 10, chainId: preferChainId } = req.body;

    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен',
      });
    }

    console.log(`[DLE Tokens] Получение держателей токенов для DLE: ${dleAddress}`);

    const { provider } = await resolveDleProvider(dleAddress, { preferChainId });
    const { holders } = await collectHoldersFromMints(dleAddress, provider);

    const start = Number(offset) || 0;
    const lim = Number(limit) || 10;
    const paginatedHolders = holders.slice(start, start + lim);

    console.log(`[DLE Tokens] Найдено держателей токенов: ${holders.length}`);

    res.json({
      success: true,
      data: {
        holders: paginatedHolders,
        total: holders.length,
        offset: start,
        limit: lim,
      },
    });
  } catch (error) {
    console.error('[DLE Tokens] Ошибка при получении держателей токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении держателей токенов: ' + error.message,
    });
  }
});

module.exports = router;
