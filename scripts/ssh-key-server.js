/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 3001;

const SSH_DIR = path.join(process.env.HOME, '.ssh');
const DEFAULT_KEY_PATH = path.join(SSH_DIR, 'id_rsa');
const DEFAULT_PUB_KEY_PATH = path.join(SSH_DIR, 'id_rsa.pub');

// Путь к папке с ключами шифрования
// В Docker контейнере: /app/ssl/keys
// Локально: ../ssl/keys от __dirname
const KEYS_DIR = fs.existsSync(path.join(__dirname, '../ssl/keys')) 
  ? path.join(__dirname, '../ssl/keys')
  : path.join(__dirname, 'ssl/keys');
const ENCRYPTION_KEY_PATH = path.join(KEYS_DIR, 'full_db_encryption.key');

// Helper to read SSH key
const readSshKey = (keyPath) => {
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (error) {
    return null;
  }
};

// Helper to read encryption key
const readEncryptionKey = (keyPath) => {
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (error) {
    return null;
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });
  
  if (pathname === '/ssh-key') {
    const privateKey = readSshKey(DEFAULT_KEY_PATH);
    const publicKey = readSshKey(DEFAULT_PUB_KEY_PATH);
    
    if (privateKey) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, sshKey: privateKey, publicKey: publicKey, keyType: 'rsa' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, message: 'SSH private key not found' }));
    }
  } else if (pathname === '/ssh-key/public') {
    const publicKey = readSshKey(DEFAULT_PUB_KEY_PATH);
    
    if (publicKey) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, publicKey: publicKey, keyType: 'rsa' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, message: 'SSH public key not found' }));
    }
  } else if (pathname === '/encryption-key') {
    const encryptionKey = readEncryptionKey(ENCRYPTION_KEY_PATH);
    
    if (encryptionKey) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, encryptionKey: encryptionKey }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, message: 'Encryption key not found' }));
    }
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  }
});

server.listen(port, () => {
  console.log(`SSH Key Server running on port ${port}`);
  console.log(`SSH keys directory: ${SSH_DIR}`);
  console.log(`Encryption key path: ${ENCRYPTION_KEY_PATH}`);
  console.log(`Encryption key exists: ${fs.existsSync(ENCRYPTION_KEY_PATH)}`);
});
