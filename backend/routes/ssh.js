const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

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

module.exports = router;
