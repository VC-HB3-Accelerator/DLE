/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Ключ деплоя модулей — только запись этой книги на ОС. Не из тела запроса и не из env.
 */

const dleAttachService = require('./dleAttachService');

function rejectClientPrivateKey(body) {
  if (body && (body.privateKey || body.PRIVATE_KEY)) {
    const err = new Error('Ключ не принимают в запросе. Он хранится в записи этой книги на ОС.');
    err.code = 'client_key_forbidden';
    err.status = 400;
    throw err;
  }
}

async function getBookPrivateKey(dleAddress) {
  if (!dleAddress) {
    const err = new Error('Адрес книги обязателен');
    err.status = 400;
    throw err;
  }
  const row = await dleAttachService.findDeployRowByDleAddress(dleAddress);
  const pk = row?.private_key || row?.privateKey;
  if (!pk) {
    const err = new Error('Нет ключа деплоя этой книги на ОС. Сохраните его в настройках книги.');
    err.code = 'no_book_key';
    err.status = 400;
    throw err;
  }
  return { pk, deploymentId: row.deployment_id, row };
}

async function resolveModuleDeploymentId(dleAddress) {
  const row = await dleAttachService.findDeployRowByDleAddress(dleAddress);
  if (row?.deployment_id) {
    return row.deployment_id;
  }
  const DeployParamsService = require('./deployParamsService');
  const svc = new DeployParamsService();
  const latestList = await svc.getLatestDeployParams(1);
  await svc.close();
  const latest = latestList && latestList[0];
  const latestAddr = dleAttachService.normalizeAddress(latest?.dle_address || latest?.dleAddress);
  const needle = dleAttachService.normalizeAddress(dleAddress);
  if (latest?.deployment_id && latestAddr && latestAddr === needle) {
    return latest.deployment_id;
  }
  const err = new Error('Нет записи этой книги на ОС');
  err.code = 'no_book_row';
  err.status = 400;
  throw err;
}

module.exports = {
  rejectClientPrivateKey,
  getBookPrivateKey,
  resolveModuleDeploymentId,
};
