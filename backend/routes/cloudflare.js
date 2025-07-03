const express = require('express');
const router = express.Router();
let Cloudflare;
try {
  Cloudflare = require('cloudflare');
} catch (e) {
  console.warn('[Cloudflare] Cloudflare package not available:', e.message);
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
  try {
  const { rows } = await db.query('SELECT * FROM cloudflare_settings ORDER BY id DESC LIMIT 1');
  return rows[0] || {};
  } catch (e) {
    console.error('[Cloudflare] Error getting settings:', e);
    return {};
  }
}

async function upsertSettings(fields) {
  try {
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
  } catch (e) {
    console.error('[Cloudflare] Error upserting settings:', e);
    throw e;
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
    console.log('[Cloudflare /domain] Starting domain connection process');
    
    // 1. Сохраняем домен, если он пришёл с фронта
    const { domain: domainFromBody } = req.body;
    if (domainFromBody) {
      console.log('[Cloudflare /domain] Saving domain:', domainFromBody);
      await upsertSettings({ domain: domainFromBody });
    }
    
    // 2. Получаем актуальные настройки
    const settings = await getSettings();
    console.log('[Cloudflare /domain] Current settings:', { ...settings, api_token: settings.api_token ? '[HIDDEN]' : 'null' });
    
    const { api_token, domain, account_id, tunnel_id, tunnel_token } = settings;
    if (!api_token || !domain || !account_id) {
      console.error('[Cloudflare /domain] Missing required parameters:', { api_token: !!api_token, domain: !!domain, account_id: !!account_id });
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
              { hostname: domain, service: 'http://localhost:5173' },
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

    // 3.5. Автоматическое создание DNS записей для туннеля
    try {
      console.log('[Cloudflare /domain] Creating DNS records automatically...');
      
      // Получаем зону для домена
      const zonesResp = await axios.get('https://api.cloudflare.com/client/v4/zones', {
        headers: { Authorization: `Bearer ${api_token}` },
        params: { name: domain }
      });

      const zones = zonesResp.data.result;
      if (!zones || zones.length === 0) {
        steps.push({ step: 'create_dns', status: 'error', message: 'Домен не найден в Cloudflare аккаунте для создания DNS записей' });
        console.log('[Cloudflare /domain] Domain not found in Cloudflare account, skipping DNS creation');
      } else {
        const zoneId = zones[0].id;
        
        // Получаем существующие DNS записи
        const recordsResp = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          headers: { Authorization: `Bearer ${api_token}` }
        });
        
        const existingRecords = recordsResp.data.result || [];
        
        // Проверяем, есть ли уже запись для основного домена, указывающая на туннель
        const tunnelCnamePattern = new RegExp(`${tunnelId}\.cfargotunnel\.com`);
        const hasMainRecord = existingRecords.some(record => 
          record.name === domain && 
          (
            (record.type === 'CNAME' && tunnelCnamePattern.test(record.content)) ||
            (record.type === 'CNAME' && record.content.includes('cfargotunnel.com'))
          )
        );
        
        if (!hasMainRecord) {
          // Удаляем конфликтующие записи для основного домена (A, AAAA, CNAME)
          const conflictingRecords = existingRecords.filter(record => 
            record.name === domain && ['A', 'AAAA', 'CNAME'].includes(record.type)
          );
          
          for (const conflictRecord of conflictingRecords) {
            try {
              await axios.delete(
                `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${conflictRecord.id}`,
                { headers: { Authorization: `Bearer ${api_token}` } }
              );
              console.log('[Cloudflare /domain] Removed conflicting record:', conflictRecord.type, conflictRecord.name, conflictRecord.content);
            } catch (delErr) {
              console.warn('[Cloudflare /domain] Failed to delete conflicting record:', delErr.message);
            }
          }
          
          // Создаем CNAME запись для основного домена
          const cnameRecord = {
            type: 'CNAME',
            name: domain,
            content: `${tunnelId}.cfargotunnel.com`,
            ttl: 1,
            proxied: true
          };
          
          const createResp = await axios.post(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
            cnameRecord,
            { headers: { Authorization: `Bearer ${api_token}` } }
          );
          
          console.log('[Cloudflare /domain] Main CNAME record created:', createResp.data.result);
          steps.push({ step: 'create_dns', status: 'ok', message: `DNS запись создана: ${domain} -> ${tunnelId}.cfargotunnel.com (проксирована)` });
        } else {
          console.log('[Cloudflare /domain] Main record already exists and points to tunnel');
          steps.push({ step: 'create_dns', status: 'ok', message: 'DNS запись для основного домена уже существует и настроена правильно' });
        }
        
        // Создаем www поддомен только для корневых доменов (не для поддоменов)
        const domainParts = domain.split('.');
        const isRootDomain = domainParts.length === 2; // example.com, а не subdomain.example.com
        
        if (isRootDomain) {
          // Обновляем список записей после возможных изменений
          const updatedRecordsResp = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
            headers: { Authorization: `Bearer ${api_token}` }
          });
          const updatedRecords = updatedRecordsResp.data.result || [];
          
          // Проверяем, есть ли уже запись для www поддомена
          const hasWwwRecord = updatedRecords.some(record => 
            record.name === `www.${domain}` && 
            (
              (record.type === 'CNAME' && tunnelCnamePattern.test(record.content)) ||
              (record.type === 'CNAME' && record.content.includes('cfargotunnel.com'))
            )
          );
          
          if (!hasWwwRecord) {
            // Удаляем конфликтующие записи для www поддомена
            const conflictingWwwRecords = updatedRecords.filter(record => 
              record.name === `www.${domain}` && ['A', 'AAAA', 'CNAME'].includes(record.type)
            );
            
            for (const conflictRecord of conflictingWwwRecords) {
    try {
                await axios.delete(
                  `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${conflictRecord.id}`,
                  { headers: { Authorization: `Bearer ${api_token}` } }
                );
                console.log('[Cloudflare /domain] Removed conflicting www record:', conflictRecord.type, conflictRecord.name, conflictRecord.content);
              } catch (delErr) {
                console.warn('[Cloudflare /domain] Failed to delete conflicting www record:', delErr.message);
              }
            }
            
            // Создаем CNAME запись для www поддомена
            const wwwCnameRecord = {
              type: 'CNAME',
              name: `www.${domain}`,
              content: `${tunnelId}.cfargotunnel.com`,
              ttl: 1,
              proxied: true
            };
            
            const createWwwResp = await axios.post(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
              wwwCnameRecord,
              { headers: { Authorization: `Bearer ${api_token}` } }
            );
            
            console.log('[Cloudflare /domain] WWW CNAME record created:', createWwwResp.data.result);
            steps.push({ step: 'create_dns_www', status: 'ok', message: `DNS запись создана: www.${domain} -> ${tunnelId}.cfargotunnel.com (проксирована)` });
          } else {
            console.log('[Cloudflare /domain] WWW record already exists and points to tunnel');
            steps.push({ step: 'create_dns_www', status: 'ok', message: 'DNS запись для www поддомена уже существует и настроена правильно' });
          }
        } else {
          console.log('[Cloudflare /domain] Skipping www subdomain creation for non-root domain');
        }
      }
    } catch (e) {
      console.error('[Cloudflare /domain] Error creating DNS records:', e);
      steps.push({ step: 'create_dns', status: 'error', message: 'Ошибка создания DNS записей: ' + (e.response?.data?.errors?.[0]?.message || e.message) });
      // Не прерываем процесс, DNS можно настроить вручную
    }
    // 4. Перезапуск cloudflared через docker compose
    try {
      console.log('[Cloudflare /domain] Restarting cloudflared via docker compose...');
      const { exec } = require('child_process');
      
      await new Promise((resolve, reject) => {
        exec('cd /app && docker compose restart cloudflared', (err, stdout, stderr) => {
          if (err) {
            console.error('[Cloudflare /domain] Docker compose restart error:', stderr || err.message);
            reject(new Error(stderr || err.message));
          } else {
            console.log('[Cloudflare /domain] Docker compose restart success:', stdout);
            resolve(stdout);
          }
        });
      });
      
      steps.push({ step: 'restart_cloudflared', status: 'ok', message: 'cloudflared перезапущен.' });
    } catch (e) {
      console.error('[Cloudflare /domain] Error restarting cloudflared:', e.message);
      steps.push({ step: 'restart_cloudflared', status: 'error', message: 'Ошибка перезапуска cloudflared: ' + e.message });
      // Не возвращаем ошибку, так как туннель создан
      console.log('[Cloudflare /domain] Continuing despite restart error...');
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
  if (settings.api_token && settings.tunnel_id && settings.account_id) {
    try {
      console.log('[Cloudflare /status] Checking tunnel status...');
      const tunnelsResp = await axios.get(
        `https://api.cloudflare.com/client/v4/accounts/${settings.account_id}/cfd_tunnel`,
        { headers: { Authorization: `Bearer ${settings.api_token}` } }
      );
      const tunnels = tunnelsResp.data.result || [];
      console.log('[Cloudflare /status] Found tunnels:', tunnels.map(t => ({ id: t.id, name: t.name, status: t.status })));
      
      const foundTunnel = tunnels.find(t => t.id === settings.tunnel_id);
      if (foundTunnel) {
        tunnelStatus = foundTunnel.status || 'active';
        tunnelMsg = `Туннель найден: ${foundTunnel.name || foundTunnel.id}, статус: ${foundTunnel.status}`;
        console.log('[Cloudflare /status] Tunnel found:', foundTunnel);
      } else {
        tunnelStatus = 'not_found';
        tunnelMsg = 'Туннель не найден в Cloudflare аккаунте';
        console.log('[Cloudflare /status] Tunnel not found. Looking for tunnel_id:', settings.tunnel_id);
      }
    } catch (e) {
      console.error('[Cloudflare /status] Error checking tunnel:', e);
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

// --- DNS Управление ---

// Получить список DNS записей для домена
router.get('/dns-records', async (req, res) => {
  try {
    const settings = await getSettings();
    const { api_token, domain } = settings;
    
    if (!api_token || !domain) {
      return res.json({ 
        success: false, 
        message: 'API Token и домен должны быть настроены' 
      });
    }

    // Получаем зону для домена
    const zonesResp = await axios.get('https://api.cloudflare.com/client/v4/zones', {
      headers: { Authorization: `Bearer ${api_token}` },
      params: { name: domain }
    });

    const zones = zonesResp.data.result;
    if (!zones || zones.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Домен не найден в Cloudflare аккаунте' 
      });
    }

    const zoneId = zones[0].id;

    // Получаем DNS записи для зоны
    const recordsResp = await axios.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      headers: { Authorization: `Bearer ${api_token}` }
    });

    const records = recordsResp.data.result || [];
    
    res.json({ 
      success: true, 
      records: records.map(record => ({
        id: record.id,
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl,
        proxied: record.proxied,
        zone_id: record.zone_id,
        zone_name: record.zone_name,
        created_on: record.created_on,
        modified_on: record.modified_on
      })),
      zone_id: zoneId
    });
  } catch (e) {
    console.error('[Cloudflare /dns-records] Error:', e);
    res.json({ 
      success: false, 
      message: 'Ошибка получения DNS записей: ' + (e.response?.data?.errors?.[0]?.message || e.message)
    });
  }
});

// Создать/обновить DNS запись
router.post('/dns-records', async (req, res) => {
  try {
    const settings = await getSettings();
    const { api_token, domain } = settings;
    const { type, name, content, ttl = 1, proxied = false, recordId } = req.body;
    
    if (!api_token || !domain) {
      return res.json({ 
        success: false, 
        message: 'API Token и домен должны быть настроены' 
      });
    }

    if (!type || !name || !content) {
      return res.json({ 
        success: false, 
        message: 'Обязательные поля: type, name, content' 
      });
    }

    // Получаем зону для домена
    const zonesResp = await axios.get('https://api.cloudflare.com/client/v4/zones', {
      headers: { Authorization: `Bearer ${api_token}` },
      params: { name: domain }
    });

    const zones = zonesResp.data.result;
    if (!zones || zones.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Домен не найден в Cloudflare аккаунте' 
      });
    }

    const zoneId = zones[0].id;
    const recordData = { type, name, content, ttl };
    
    // Добавляем proxied только для типов записей, которые поддерживают прокси
    if (['A', 'AAAA', 'CNAME'].includes(type)) {
      recordData.proxied = proxied;
    }

    let result;
    if (recordId) {
      // Обновляем существующую запись
      const updateResp = await axios.put(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
        recordData,
        { headers: { Authorization: `Bearer ${api_token}` } }
      );
      result = updateResp.data.result;
    } else {
      // Создаем новую запись
      const createResp = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
        recordData,
        { headers: { Authorization: `Bearer ${api_token}` } }
      );
      result = createResp.data.result;
    }

    res.json({ 
      success: true, 
      message: recordId ? 'DNS запись обновлена' : 'DNS запись создана',
      record: {
        id: result.id,
        type: result.type,
        name: result.name,
        content: result.content,
        ttl: result.ttl,
        proxied: result.proxied,
        zone_id: result.zone_id
      }
    });
  } catch (e) {
    console.error('[Cloudflare /dns-records POST] Error:', e);
    res.json({ 
      success: false, 
      message: 'Ошибка создания/обновления DNS записи: ' + (e.response?.data?.errors?.[0]?.message || e.message)
    });
  }
});

// Удалить DNS запись
router.delete('/dns-records/:recordId', async (req, res) => {
  try {
    const settings = await getSettings();
    const { api_token, domain } = settings;
    const { recordId } = req.params;
    
    if (!api_token || !domain) {
      return res.json({ 
        success: false, 
        message: 'API Token и домен должны быть настроены' 
      });
    }

    // Получаем зону для домена
    const zonesResp = await axios.get('https://api.cloudflare.com/client/v4/zones', {
      headers: { Authorization: `Bearer ${api_token}` },
      params: { name: domain }
    });

    const zones = zonesResp.data.result;
    if (!zones || zones.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Домен не найден в Cloudflare аккаунте' 
      });
    }

    const zoneId = zones[0].id;

    // Удаляем DNS запись
    await axios.delete(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
      { headers: { Authorization: `Bearer ${api_token}` } }
    );

    res.json({ 
      success: true, 
      message: 'DNS запись удалена'
    });
  } catch (e) {
    console.error('[Cloudflare /dns-records DELETE] Error:', e);
    res.json({ 
      success: false, 
      message: 'Ошибка удаления DNS записи: ' + (e.response?.data?.errors?.[0]?.message || e.message)
    });
  }
});

module.exports = router; 