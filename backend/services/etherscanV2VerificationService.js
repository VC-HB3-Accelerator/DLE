/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const axios = require('axios');
const logger = require('../utils/logger');

const ETHERSCAN_V2_ENDPOINT = 'https://api.etherscan.io/v2/api';

class EtherscanV2VerificationService {
  /**
   * Отправить исходники контракта на верификацию (V2)
   * Документация: https://docs.etherscan.io/etherscan-v2/contract-verification/multichain-verification
   * @param {Object} opts
   * @param {number} opts.chainId
   * @param {string} opts.contractAddress
   * @param {string} opts.contractName - формат "contracts/DLE.sol:DLE"
   * @param {string} opts.compilerVersion - например, "v0.8.24+commit.e11b9ed9"
   * @param {Object|string} opts.standardJsonInput - стандартный JSON input (рекомендуется)
   * @param {string} [opts.constructorArgsHex]
   * @param {string} [opts.apiKey]
   * @returns {Promise<string>} guid
   */
  async submitVerification({ chainId, contractAddress, contractName, compilerVersion, standardJsonInput, constructorArgsHex, apiKey }) {
    const key = apiKey || process.env.ETHERSCAN_API_KEY;
    if (!key) throw new Error('ETHERSCAN_API_KEY не задан');
    if (!chainId) throw new Error('chainId обязателен');
    if (!contractAddress) throw new Error('contractAddress обязателен');
    if (!contractName) throw new Error('contractName обязателен');
    if (!compilerVersion) throw new Error('compilerVersion обязателен');
    if (!standardJsonInput) throw new Error('standardJsonInput обязателен');

    const payload = new URLSearchParams();
    // Согласно V2, chainid должен передаваться в query, а не в теле формы
    payload.set('module', 'contract');
    payload.set('action', 'verifysourcecode');
    payload.set('apikey', key);
    payload.set('codeformat', 'solidity-standard-json-input');
    payload.set('sourceCode', typeof standardJsonInput === 'string' ? standardJsonInput : JSON.stringify(standardJsonInput));
    payload.set('contractaddress', contractAddress);
    payload.set('contractname', contractName);
    payload.set('compilerversion', compilerVersion);
    if (constructorArgsHex) {
      const no0x = constructorArgsHex.startsWith('0x') ? constructorArgsHex.slice(2) : constructorArgsHex;
      payload.set('constructorArguments', no0x);
    }

    const url = `${ETHERSCAN_V2_ENDPOINT}?chainid=${encodeURIComponent(String(chainId))}`;
    const { data } = await axios.post(url, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    logger.info('[EtherscanV2] verifysourcecode response', data);
    if (data && data.status === '1' && data.result) return data.result; // guid
    throw new Error(data?.result || data?.message || 'Etherscan V2 verifysourcecode error');
  }

  /**
   * Проверить статус верификации по guid
   * @param {number} chainId
   * @param {string} guid
   * @param {string} [apiKey]
   * @returns {Promise<{status:string,message:string,result:string}>}
   */
  async checkStatus(chainId, guid, apiKey) {
    const key = apiKey || process.env.ETHERSCAN_API_KEY;
    if (!key) throw new Error('ETHERSCAN_API_KEY не задан');
    const params = new URLSearchParams();
    params.set('chainid', String(chainId));
    params.set('module', 'contract');
    params.set('action', 'checkverifystatus');
    params.set('guid', guid);
    params.set('apikey', key);
    const { data } = await axios.get(`${ETHERSCAN_V2_ENDPOINT}?${params.toString()}`);
    logger.info('[EtherscanV2] checkverifystatus response', data);
    return data;
  }
}

module.exports = new EtherscanV2VerificationService();


