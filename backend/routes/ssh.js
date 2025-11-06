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
const { promisify } = require('util');
const { domainToASCII } = require('url');
const dns = require('dns');
const resolve4 = promisify(dns.resolve4);

// Удалено: эндпоинты выдачи приватного/публичного SSH-ключа

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

    const normalizedDomain = domain.trim().toLowerCase();
    const asciiDomain = domainToASCII(normalizedDomain);

    if (!asciiDomain) {
      return res.status(400).json({
        success: false,
        domain,
        message: `Некорректное доменное имя: ${domain}`
      });
    }

    console.log(`Checking DNS for domain: ${domain} (ASCII: ${asciiDomain})`);
    
    // Используем встроенный DNS resolver Node.js
    const addresses = await resolve4(asciiDomain);
    
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
