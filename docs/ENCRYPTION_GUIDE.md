<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# 🔐 Полное шифрование всех таблиц в DLE

## 📋 Обзор

Этот подход шифрует **ВСЕ текстовые данные** во **ВСЕХ таблицах** базы данных.

## 🎯 Что шифруется

### **✅ ВСЕ текстовые колонки во ВСЕХ таблицах:**
- `text` - текстовые поля
- `varchar` - строки переменной длины
- `character varying` - строки переменной длины
- `json` - JSON данные
- `jsonb` - бинарные JSON данные

### **❌ НЕ шифруются:**
- `id` - идентификаторы
- `created_at`, `updated_at` - временные метки
- `integer`, `numeric`, `boolean` - числовые и логические типы
- Колонки, уже содержащие `_encrypted` в названии

## 🚀 Пошаговая инструкция

### **Шаг 1: Запуск полного шифрования**
```bash
chmod +x encrypt-all-tables.sh
./encrypt-all-tables.sh
```

### **Шаг 2: Проверка шифрования**
```bash
./decrypt-all-tables.sh
```

### **Шаг 3: Обновление кода приложения**

#### **A. Использование универсального сервиса**
```javascript
const encryptedDataService = require('./services/encryptedDataService');

// Получение данных с автоматической расшифровкой
const users = await encryptedDataService.getData('users', { role: 'admin' });

// Сохранение данных с автоматическим шифрованием
const newUser = await encryptedDataService.saveData('users', {
  name: 'Иван Иванов',
  email: 'ivan@example.com',
  preferences: { theme: 'dark' }
});

// Обновление данных
const updatedUser = await encryptedDataService.saveData('users', 
  { name: 'Иван Петров' }, 
  { id: 1 }
);

// Удаление данных
await encryptedDataService.deleteData('users', { id: 1 });
```

#### **B. Проверка статуса шифрования**
```javascript
const status = await encryptedDataService.getEncryptionStatus();
console.log('Статус шифрования:', status);
// {
//   hasEncryptionKey: true,
//   encryptedTables: [
//     { table_name: 'users', encrypted_columns: '3' },
//     { table_name: 'messages', encrypted_columns: '2' }
//   ],
//   totalEncryptedColumns: 15
// }
```

### **Шаг 4: Обновление существующих роутов**

#### **Пример обновления роута пользователей:**
```javascript
// Было:
router.get('/users', async (req, res) => {
  const { rows } = await db.getQuery()('SELECT * FROM users');
  res.json(rows);
});

// Стало:
router.get('/users', async (req, res) => {
  try {
    const users = await encryptedDataService.getData('users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### **Пример обновления роута сообщений:**
```javascript
// Было:
router.post('/messages', async (req, res) => {
  const { content, user_id } = req.body;
  const { rows } = await db.getQuery()(
    'INSERT INTO messages (content, user_id) VALUES ($1, $2) RETURNING *',
    [content, user_id]
  );
  res.json(rows[0]);
});

// Стало:
router.post('/messages', async (req, res) => {
  try {
    const { content, user_id } = req.body;
    const message = await encryptedDataService.saveData('messages', {
      content,
      user_id
    });
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **Шаг 5: Тестирование**
```bash
# Проверить работу зашифрованных данных
curl -X GET http://localhost:8000/api/users
curl -X POST http://localhost:8000/api/messages -H "Content-Type: application/json" -d '{"content":"Тестовое сообщение","user_id":1}'

# Проверить расшифровку
./decrypt-all-tables.sh
```

### **Шаг 6: Удаление незашифрованных колонок**
```bash
# ВНИМАНИЕ: Это необратимая операция!
./remove-unencrypted-columns.sh
```

## 🔑 Управление ключами

### **Ключ шифрования**
- **Файл**: `./ssl/keys/full_db_encryption.key`
- **Размер**: 32 байта (base64)
- **Алгоритм**: AES-256-CBC

### **Безопасность ключа**
```bash
# Права доступа
chmod 600 ./ssl/keys/full_db_encryption.key

# Резервная копия
cp ./ssl/keys/full_db_encryption.key ./ssl/keys/full_db_encryption.key.backup

# Проверка целостности
sha256sum ./ssl/keys/full_db_encryption.key
```

## 🛡️ Дополнительные меры безопасности

### **1. Шифрование томов Docker**
```yaml
# docker-compose.yml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /path/to/encrypted/storage
```

### **2. SSL/TLS для PostgreSQL**
```yaml
# docker-compose.yml
services:
  postgres:
    command: >
      postgres
      -c ssl=on
      -c ssl_cert_file=/etc/ssl/certs/server.crt
      -c ssl_key_file=/etc/ssl/certs/server.key
```

### **3. Шифрование переменных окружения**
```bash
# Для оставшихся переменных окружения
./encrypt-env.sh
```

## 🔍 Мониторинг и аудит

### **Логирование доступа к зашифрованным данным**
```javascript
// В сервисе добавить логирование
console.log(`🔐 Доступ к зашифрованным данным: ${tableName} в ${new Date().toISOString()}`);
```

### **Проверка целостности**
```bash
# Скрипт для проверки целостности зашифрованных данных
./verify-encryption.sh
```

## ⚠️ Важные замечания

### **1. Производительность**
- Шифрование/расшифровка добавляет задержку
- Используйте кэширование для часто используемых данных
- Рассмотрите индексы для зашифрованных колонок

### **2. Резервное копирование**
- **Обязательно** делайте бэкап ключа шифрования
- **Обязательно** делайте бэкап базы данных
- Храните ключ отдельно от данных

### **3. Восстановление**
```bash
# Восстановление из бэкапа
docker exec dapp-postgres psql -U dapp_user -d dapp_db < backup.sql

# Восстановление ключа
cp ./ssl/keys/full_db_encryption.key.backup ./ssl/keys/full_db_encryption.key
```

### **4. Совместимость**
- Приложение работает с зашифрованными и незашифрованными данными
- Fallback на незашифрованные данные при отсутствии ключа
- Постепенная миграция существующих данных

## 🎯 Результат

После применения полного шифрования:
- ✅ ВСЕ текстовые данные зашифрованы в БД
- ✅ Ключ шифрования хранится отдельно
- ✅ Приложение работает с зашифрованными данными
- ✅ Fallback на незашифрованные данные при отсутствии ключа
- ✅ Универсальный сервис для работы с данными
- ✅ Возможность ротации ключей

**Максимальная безопасность данных достигнута!** 🔒 