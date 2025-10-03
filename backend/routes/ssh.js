const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const dns = require('dns');

const resolve4 = promisify(dns.resolve4);

const SSH_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.ssh');
const DEFAULT_KEY_PATH = path.join(SSH_DIR, 'id_rsa');
const DEFAULT_PUB_KEY_PATH = path.join(SSH_DIR, 'id_rsa.pub');

// Helper to read SSH key
const readSshKey = (keyPath) => {
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (error) {
    return null;
  }
};

// GET /api/ssh-key - Get existing SSH private key
router.get('/ssh-key', (req, res) => {
  const privateKey = readSshKey(DEFAULT_KEY_PATH);
  const publicKey = readSshKey(DEFAULT_PUB_KEY_PATH);
  
  if (privateKey) {
    res.json({ success: true, sshKey: privateKey, publicKey: publicKey, keyType: 'rsa' });
  } else {
    res.status(404).json({ success: false, message: 'SSH private key not found' });
  }
});

// GET /api/ssh-key/public - Get existing SSH public key
router.get('/ssh-key/public', (req, res) => {
  const publicKey = readSshKey(DEFAULT_PUB_KEY_PATH);
  
  if (publicKey) {
    res.json({ success: true, publicKey: publicKey, keyType: 'rsa' });
  } else {
    res.status(404).json({ success: false, message: 'SSH public key not found' });
  }
});

// GET /api/dns-check/:domain - Check DNS and get IP address
router.get('/dns-check/:domain', async (req, res) => {
  try {
    const domain = req.params.domain;
    
    if (!domain) {
      return res.status(400).json({ 
        success: false, 
        message: 'Domain parameter is required' 
      });
    }

    console.log(`Checking DNS for domain: ${domain}`);
    
    // Используем встроенный DNS resolver Node.js
    const addresses = await resolve4(domain);
    
    if (addresses && addresses.length > 0) {
      const ip = addresses[0];
      console.log(`DNS resolved: ${domain} → ${ip}`);
      
      res.json({
        success: true,
        domain: domain,
        ip: ip,
        message: `Домен ${domain} разрешен в IP: ${ip}`
      });
    } else {
      res.status(404).json({
        success: false,
        domain: domain,
        message: `DNS запись для домена ${domain} не найдена`
      });
    }
  } catch (error) {
    console.error(`DNS check error for ${req.params.domain}:`, error.message);
    
    res.status(500).json({
      success: false,
      domain: req.params.domain,
      message: `Ошибка проверки DNS: ${error.message}`
    });
  }
});

module.exports = router;
