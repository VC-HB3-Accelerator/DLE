/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Слот модуля в книге: канонический ID плюс ошибочные padded-ASCII,
 * которыми UI раньше вызывал createAddModuleProposal.
 */

const { ethers } = require('ethers');
const { MODULE_TYPE_TO_ID, candidateModuleIds } = require('../constants/moduleIds');

/**
 * @param {import('ethers').Contract} dle
 * @param {string} moduleType
 * @returns {Promise<{ moduleId: string, moduleAddress: string }>}
 */
async function resolveBookSlot(dle, moduleType) {
  const ids = candidateModuleIds(moduleType);
  for (const moduleId of ids) {
    try {
      const moduleAddress = await dle.getModuleAddress(moduleId);
      if (moduleAddress && moduleAddress !== ethers.ZeroAddress) {
        return { moduleId, moduleAddress };
      }
    } catch (_) {
      // следующий кандидат
    }
  }
  return {
    moduleId: MODULE_TYPE_TO_ID[moduleType],
    moduleAddress: ethers.ZeroAddress,
  };
}

/**
 * @param {import('ethers').Contract} dle
 * @returns {Promise<Record<string, { moduleId: string, moduleAddress: string, isActive: boolean }>>}
 */
async function resolveAllBookSlots(dle) {
  const out = {};
  for (const moduleType of Object.keys(MODULE_TYPE_TO_ID)) {
    const slot = await resolveBookSlot(dle, moduleType);
    let isActive = false;
    if (slot.moduleAddress && slot.moduleAddress !== ethers.ZeroAddress) {
      try {
        isActive = await dle.isModuleActive(slot.moduleId);
      } catch (_) {
        isActive = true;
      }
    }
    out[moduleType] = { ...slot, isActive };
  }
  return out;
}

module.exports = { resolveBookSlot, resolveAllBookSlots };
