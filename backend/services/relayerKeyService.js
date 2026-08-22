/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Служебный ключ отправителя голоса на ОС снят (окно кражи комиссии).
 * Голос шлёт кошелёк держателя. Казна не возвращает газ без отдельного предложения.
 */

function getRelayerPrivateKey() {
  return null;
}

function getRelayerAddress() {
  return null;
}

async function getRelayerStatus() {
  return { configured: false, funded: false, address: null };
}

module.exports = {
  getRelayerPrivateKey,
  getRelayerAddress,
  getRelayerStatus,
};
