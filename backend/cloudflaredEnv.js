const fs = require('fs');
const path = require('path');

function writeCloudflaredEnv({ tunnelToken, domain }) {
  console.log('[writeCloudflaredEnv] tunnelToken:', tunnelToken, 'domain:', domain);
  const envPath = path.join(__dirname, '../cloudflared.env');
  let content = '';
  if (tunnelToken) content += `TUNNEL_TOKEN=${tunnelToken}\n`;
  if (domain) content += `DOMAIN=${domain}\n`;
  console.log('[writeCloudflaredEnv] Writing to:', envPath, 'content:', content);
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('[writeCloudflaredEnv] File written successfully');
}

module.exports = { writeCloudflaredEnv }; 