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

const encryptedDb = require('./encryptedDatabaseService');

class DbSettingsService {
  async getSettings() {
    const rows = await encryptedDb.getData('db_settings', { id: 1 }, 1);
    return rows[0];
  }

  async upsertSettings({ db_host, db_port, db_name, db_user, db_password }) {
    const data = {
      id: 1,
      db_host,
      db_port,
      db_name,
      db_user,
      db_password,
      updated_at: new Date()
    };

    // Пытаемся обновить существующую запись
    const existing = await this.getSettings();
    if (existing) {
      return await encryptedDb.saveData('db_settings', data, { id: 1 });
    } else {
      return await encryptedDb.saveData('db_settings', data);
    }
  }

  /**
   * Получить статус шифрования
   */
  getEncryptionStatus() {
    return encryptedDb.getEncryptionStatus();
  }
}

module.exports = new DbSettingsService(); 