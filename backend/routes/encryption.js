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

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Путь к папке с ключами шифрования
const KEYS_DIR = path.join(__dirname, '../../ssl/keys');
const ENCRYPTION_KEY_PATH = path.join(KEYS_DIR, 'full_db_encryption.key');

// Создаем папку keys если её нет
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
}

// Helper to read encryption key
const readEncryptionKey = (keyPath) => {
  try {
    return fs.readFileSync(keyPath, 'utf8');
  } catch (error) {
    return null;
  }
};

// Helper to write encryption key
const writeEncryptionKey = (keyPath, key) => {
  try {
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return true;
  } catch (error) {
    return false;
  }
};

// GET /api/encryption-key - Get existing encryption key
router.get('/encryption-key', (req, res) => {
  const encryptionKey = readEncryptionKey(ENCRYPTION_KEY_PATH);
  
  if (encryptionKey) {
    res.json({ success: true, encryptionKey: encryptionKey });
  } else {
    res.status(404).json({ success: false, message: 'Encryption key not found' });
  }
});

// POST /api/encryption-key/generate - Generate a new encryption key
router.post('/encryption-key/generate', (req, res) => {
  try {
    // Генерируем новый ключ шифрования (256 бит)
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    // Сохраняем ключ в файл
    if (writeEncryptionKey(ENCRYPTION_KEY_PATH, encryptionKey)) {
      res.json({ 
        success: true, 
        message: 'Encryption key generated successfully', 
        encryptionKey: encryptionKey 
      });
    } else {
      res.status(500).json({ success: false, message: 'Failed to save encryption key' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: `Failed to generate encryption key: ${error.message}` });
  }
});

module.exports = router;
