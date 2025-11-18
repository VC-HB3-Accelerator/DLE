/**
 * Скрипт для сохранения настроек VDS в базу данных
 */

const encryptedDb = require('./services/encryptedDatabaseService');

async function saveVdsSettings() {
  try {
    console.log('🔧 Сохранение настроек VDS...');
    
    // Данные для сохранения
    // ВАЖНО: передаем ключи БЕЗ суффикса _encrypted, сервис сам добавит его
    const settings = {
      domain: '185.221.214.140', // Можно использовать IP или домен
      email: 'info@hb3-accelerator.com',
      ubuntu_user: 'root',
      docker_user: 'root',
      ssh_host: '185.221.214.140',
      ssh_port: 22,
      ssh_user: 'root',
      ssh_password: '1414Bcar',
      updated_at: new Date()
    };
    
    // Проверяем существующие настройки
    const existing = await encryptedDb.getData('vds_settings', {}, 1);
    
    if (existing.length > 0) {
      console.log('📝 Обновление существующих настроек (id:', existing[0].id, ')');
      const result = await encryptedDb.saveData('vds_settings', settings, { id: existing[0].id });
      console.log('✅ Настройки обновлены:', result);
    } else {
      console.log('➕ Создание новых настроек');
      const result = await encryptedDb.saveData('vds_settings', {
        ...settings,
        created_at: new Date()
      });
      console.log('✅ Настройки созданы:', result);
    }
    
    console.log('✅ Настройки VDS успешно сохранены!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка сохранения настроек:', error);
    process.exit(1);
  }
}

saveVdsSettings();

