const fs = require('fs');
const path = require('path');

function writeCloudflaredEnv({ tunnelToken, domain }) {
  console.log('[writeCloudflaredEnv] tunnelToken:', tunnelToken, 'domain:', domain);
  const envPath = '/cloudflared.env';
  let content = '';
  if (tunnelToken) content += `TUNNEL_TOKEN=${tunnelToken}\n`;
  if (domain) content += `DOMAIN=${domain}\n`;
  fs.writeFileSync(envPath, content, 'utf8');
}

module.exports = { writeCloudflaredEnv }; 