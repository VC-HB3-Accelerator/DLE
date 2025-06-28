const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const composePath = '/docker-compose.yml';

function addCloudflaredToCompose(tunnelToken) {
  console.log('[cloudflaredCompose] process.cwd():', process.cwd());
  console.log('[cloudflaredCompose] __dirname:', __dirname);
  console.log('[cloudflaredCompose] Ожидаемый путь к compose:', composePath);
  if (!fs.existsSync(composePath)) {
    console.error('[cloudflaredCompose] Файл не найден:', composePath);
    throw new Error('docker-compose.yml не найден по пути: ' + composePath);
  }
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(composePath, 'utf8'));
  } catch (e) {
    console.error('[cloudflaredCompose] Ошибка чтения compose:', e);
    throw e;
  }
  doc.services = doc.services || {};
  doc.services.cloudflared = {
    image: 'cloudflare/cloudflared:latest',
    command: 'tunnel --no-autoupdate run',
    environment: [`TUNNEL_TOKEN=${tunnelToken}`],
    restart: 'unless-stopped'
  };
  try {
    fs.writeFileSync(composePath, yaml.dump(doc), 'utf8');
    console.log('[cloudflaredCompose] cloudflared добавлен в compose:', composePath);
  } catch (e) {
    console.error('[cloudflaredCompose] Ошибка записи compose:', e);
    throw e;
  }
}

module.exports = { addCloudflaredToCompose }; 