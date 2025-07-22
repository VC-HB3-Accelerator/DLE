/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const dns = require('dns');
const { promisify } = require('util');
const resolveMx = promisify(dns.resolveMx);

async function checkMailServer(domain) {
  try {
    console.log(`Проверяем MX записи для домена ${domain}...`);
    const records = await resolveMx(domain);
    console.log('Найдены MX записи:', records);
    return records;
  } catch (error) {
    console.error('Ошибка при проверке MX записей:', error);
    return null;
  }
}

module.exports = { checkMailServer };
