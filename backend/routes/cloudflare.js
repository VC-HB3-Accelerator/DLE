const express = require('express');
const router = express.Router();
let Cloudflare;
try {
  Cloudflare = require('cloudflare');
} catch (e) {
  Cloudflare = null;
}
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const dockerComposePath = path.join(__dirname, '../../docker-compose.cloudflared.yml');
const { addCloudflaredToCompose } = require('../utils/cloudflaredCompose');
const { writeCloudflaredEnv } = require('../cloudflaredEnv');
const axios = require('axios');
const credentialsDir = '/home/alex/DApp-for-Business/.cloudflared';
const tunnelName = 'hb3-accelerator'; // или из настроек

// --- Вспомогательные функции ---
async function getSettings() {
  const { rows } = await db.query('SELECT * FROM cloudflare_settings ORDER BY id DESC LIMIT 1');
  return rows[0] || {};
}
async function upsertSettings(fields) {
  const current = await getSettings();
  if (current.id) {
    const updates = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(fields)) {
      updates.push(`${k} = $${idx}`);
      values.push(v);
      idx++;
    }
    values.push(current.id);
    await db.query(`UPDATE cloudflare_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, values);
  } else {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    await db.query(`INSERT INTO cloudflare_settings (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')})` , values);
  }
}
function generateDockerCompose(tunnelToken) {
  return `version: '3.8'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${tunnelToken}
    restart: unless-stopped
`;
}
function runDockerCompose() {
  return new Promise((resolve, reject) => {
    exec(`docker-compose -f ${dockerComposePath} up -d cloudflared`, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout);
    });
  });
}
function checkCloudflaredStatus() {
  return new Promise((resolve) => {
    exec('docker ps --filter "name=cloudflared" --format "{{.Status}}"', (err, stdout) => {
      if (err) return resolve('not_installed');
      if (stdout.trim()) return resolve('running');
      resolve('not_running');
    });
  });
}

// --- API ---
// Получить все настройки
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (e) {
    res.json({ success: false, message: 'Ошибка получения настроек: ' + e.message });
  }
});
// Сохранить API Token
router.post('/token', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'Token required' });
  try {
    await upsertSettings({ api_token: token });
    res.json({ success: true, message: 'API Token сохранён!' });
  } catch (e) {
    res.json({ success: false, message: 'Ошибка сохранения токена: ' + e.message });
  }
});
// Получить список аккаунтов пользователя по API Token
router.post('/accounts', async (req, res) => {
  const { api_token } = req.body;
  if (!api_token) return res.status(400).json({ success: false, message: 'Token required' });
  try {
    const resp = await axios.get('https://api.cloudflare.com/client/v4/accounts', {
      headers: { Authorization: `Bearer ${api_token}` }
    });
    res.json({ success: true, accounts: resp.data.result });
  } catch (e) {
    res.json({ success: false, message: 'Ошибка Cloudflare API: ' + e.message });
  }
});
// Сохранить выбранный account_id
router.post('/account-id', async (req, res) => {
  const { account_id } = req.body;
  if (!account_id) return res.status(400).json({ success: false, message: 'Account ID required' });
  try {
    await upsertSettings({ account_id });
    res.json({ success: true, message: 'Account ID сохранён!' });
  } catch (e) {
    res.json({ success: false, message: 'Ошибка сохранения Account ID: ' + e.message });
  }
});
// Новый /domain: полный цикл автоматизации через Cloudflare API
router.post('/domain', async (req, res) => {
  const steps = [];
  try {
    // 1. Сохраняем домен, если он пришёл с фронта
    const { domain: domainFromBody } = req.body;
    if (domainFromBody) {
      await upsertSettings({ domain: domainFromBody });
    }
    // 2. Получаем актуальные настройки
    const settings = await getSettings();
    const { api_token, domain, account_id, tunnel_id, tunnel_token } = settings;
    if (!api_token || !domain || !account_id) {
      return res.json({ success: false, error: 'Не все параметры Cloudflare заданы (api_token, domain, account_id)' });
    }
    let tunnelId = tunnel_id;
    let tunnelToken = tunnel_token;
    // 1. Создание туннеля через Cloudflare API (только если нет tunnel_id)
    if (!tunnelId || !tunnelToken) {
      try {
        const tunnelName = `dapp-tunnel-${domain}`;
        const tunnelResp = await axios.post(
          `https://api.cloudflare.com/client/v4/accounts/${account_id}/cfd_tunnel`,
          { name: tunnelName },
          { headers: { Authorization: `Bearer ${api_token}` } }
        );
        tunnelId = tunnelResp.data.result.id;
        tunnelToken = tunnelResp.data.result.token;
        console.log('[Cloudflare] Получен tunnelId:', tunnelId, 'tunnelToken:', tunnelToken);
        // Сохраняем tunnel_id и tunnel_token в базу
        await upsertSettings({ tunnel_id: tunnelId, tunnel_token: tunnelToken, api_token, account_id, domain });
        steps.push({ step: 'create_tunnel', status: 'ok', message: 'Туннель создан через Cloudflare API и все параметры сохранены.' });
      } catch (e) {
        steps.push({ step: 'create_tunnel', status: 'error', message: 'Ошибка создания туннеля: ' + e.message });
        return res.json({ success: false, steps, error: e.message });
      }
    } else {
      steps.push({ step: 'use_existing_tunnel', status: 'ok', message: 'Используется существующий туннель.' });
    }
    // 2. Сохранение tunnel_token в cloudflared.env
    try {
      writeCloudflaredEnv({ tunnelToken, domain });
      steps.push({ step: 'save_token', status: 'ok', message: 'TUNNEL_TOKEN сохранён в cloudflared.env.' });
    } catch (e) {
      steps.push({ step: 'save_token', status: 'error', message: 'Ошибка сохранения tunnel_token: ' + e.message });
      return res.json({ success: false, steps, error: e.message });
    }
    // 3. Создание маршрута (ingress) через Cloudflare API
    try {
      await axios.put(
        `https://api.cloudflare.com/client/v4/accounts/${account_id}/cfd_tunnel/${tunnelId}/configurations`,
        {
          config: {
            ingress: [
              { hostname: domain, service: 'http://dapp-frontend:5173' },
              { service: 'http_status:404' }
            ]
          }
        },
        { headers: { Authorization: `Bearer ${api_token}` } }
      );
      steps.push({ step: 'create_route', status: 'ok', message: 'Маршрут для домена создан.' });
    } catch (e) {
      let errorMsg = e.message;
      if (e.response && e.response.data) {
        errorMsg += ' | ' + JSON.stringify(e.response.data);
      }
      steps.push({ step: 'create_route', status: 'error', message: 'Ошибка создания маршрута: ' + errorMsg });
      return res.json({ success: false, steps, error: errorMsg });
    }
    // 4. Перезапуск cloudflared через cloudflared-agent
    try {
      await axios.post('http://cloudflared-agent:9000/cloudflared/restart');
      steps.push({ step: 'restart_cloudflared', status: 'ok', message: 'cloudflared перезапущен.' });
    } catch (e) {
      steps.push({ step: 'restart_cloudflared', status: 'error', message: 'Ошибка перезапуска cloudflared: ' + e.message });
      return res.json({ success: false, steps, error: e.message });
    }
    // 5. Возврат app_url
    res.json({
      success: true,
      app_url: `https://${domain}`,
      message: 'Туннель и маршрут успешно созданы. Ваше приложение доступно по ссылке.',
      steps
    });
  } catch (e) {
    steps.push({ step: 'fatal', status: 'error', message: e.message });
    res.json({ success: false, steps, error: e.message });
  }
});
// Проверить домен через Cloudflare API (опционально)
router.post('/check-domain', async (req, res) => {
  if (!Cloudflare) return res.json({ success: false, message: 'Cloudflare не доступен на сервере' });
  const { api_token, domain } = req.body;
  if (!api_token || !domain) return res.status(400).json({ success: false, message: 'Token и domain обязательны' });
  try {
    const cf = new Cloudflare({ apiToken: api_token });
    const zones = await cf.zones.browse();
    const found = zones.result.find(z => z.name === domain);
    if (!found) return res.status(400).json({ success: false, message: 'Домен не найден в Cloudflare аккаунте' });
    res.json({ success: true, message: 'Домен найден в Cloudflare аккаунте' });
  } catch (e) {
    res.json({ success: false, message: 'Ошибка Cloudflare API: ' + e.message });
  }
});
// Установить Cloudflared в Docker (добавить в compose и запустить)
router.post('/install', async (req, res) => {
  console.log('[CloudflareInstall] Запрос на установку cloudflared');
  const settings = await getSettings();
  console.log('[CloudflareInstall] Текущие настройки:', settings);
  if (!settings.tunnel_token) {
    console.warn('[CloudflareInstall] Нет tunnel_token, установка невозможна');
    return res.status(400).json({ success: false, message: 'Сначала сохраните Tunnel Token' });
  }
  try {
    console.log('[CloudflareInstall] Запись cloudflared.env...');
    writeCloudflaredEnv({ tunnelToken: settings.tunnel_token, domain: settings.domain });
    console.log('[CloudflareInstall] Перезапуск cloudflared через docker compose...');
    exec('docker-compose up -d cloudflared', (err, stdout, stderr) => {
      if (err) {
        console.error('[CloudflareInstall] Ошибка docker compose:', stderr || err.message);
        return res.json({ success: false, message: 'Ошибка docker compose: ' + (stderr || err.message) });
      }
      console.log('[CloudflareInstall] Cloudflared перезапущен:', stdout);
      res.json({ success: true, message: 'Cloudflared переменные обновлены и контейнер перезапущен!' });
    });
  } catch (e) {
    console.error('[CloudflareInstall] Ошибка:', e);
    res.json({ success: false, message: 'Ошибка: ' + (e.message || e) });
  }
});
// Получить статус Cloudflared, домена и туннеля
router.get('/status', async (req, res) => {
  const status = await checkCloudflaredStatus();
  const settings = await getSettings();
  let domainStatus = 'not_configured';
  let domainMsg = 'Cloudflare не настроен';
  let tunnelStatus = 'not_configured';
  let tunnelMsg = 'Cloudflare не настроен';
  if (!Cloudflare) {
    return res.json({
      success: true,
      status,
      domainStatus: 'not_available',
      domainMsg: 'Пакет cloudflare не установлен',
      tunnelStatus: 'not_available',
      tunnelMsg: 'Пакет cloudflare не установлен',
      message: 'Cloudflare не доступен на сервере'
    });
  }
  if (settings.api_token && settings.domain) {
    try {
      const cf = new Cloudflare({ apiToken: settings.api_token });
      const zonesResp = await cf.zones.list();
      const zones = zonesResp.result;
      const found = zones.find(z => z.name === settings.domain);
      if (found) {
        domainStatus = 'ok';
        domainMsg = 'Домен найден в Cloudflare аккаунте';
      } else {
        domainStatus = 'not_found';
        domainMsg = 'Домен не найден в Cloudflare аккаунте';
      }
    } catch (e) {
      domainStatus = 'error';
      domainMsg = 'Ошибка Cloudflare API: ' + e.message;
    }
  }
  if (settings.api_token && settings.tunnel_token && Cloudflare) {
    try {
      const cf = new Cloudflare({ apiToken: settings.api_token });
      const zonesResp = await cf.zones.list();
      const zones = zonesResp.result;
      const zone = zones.find(z => settings.domain.endsWith(z.name));
      if (!zone) throw new Error('Зона для домена не найдена в Cloudflare');
      const accountId = zone.account.id;
      const tunnelsResp = await axios.get(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`,
        { headers: { Authorization: `Bearer ${settings.api_token}` } }
      );
      const tunnels = tunnelsResp.data.result;
      const foundTunnel = tunnels.find(t => settings.tunnel_token.includes(t.id));
      if (foundTunnel) {
        tunnelStatus = foundTunnel.status || 'active';
        tunnelMsg = `Туннель найден: ${foundTunnel.name || foundTunnel.id}, статус: ${foundTunnel.status}`;
      } else {
        tunnelStatus = 'not_found';
        tunnelMsg = 'Туннель не найден в Cloudflare аккаунте';
      }
    } catch (e) {
      tunnelStatus = 'error';
      tunnelMsg = 'Ошибка Cloudflare API (туннель): ' + e.message;
    }
  }
  res.json({
    success: true,
    status,
    domainStatus,
    domainMsg,
    tunnelStatus,
    tunnelMsg,
    message: `Cloudflared статус: ${status}, домен: ${domainStatus}, туннель: ${tunnelStatus}`
  });
});

module.exports = router; 