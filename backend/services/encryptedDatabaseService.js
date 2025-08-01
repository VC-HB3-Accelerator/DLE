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

const db = require('../db');
const fs = require('fs');
const path = require('path');

class EncryptedDataService {
  constructor() {
    this.encryptionKey = this.loadEncryptionKey();
    this.isEncryptionEnabled = !!this.encryptionKey;
    
    if (this.isEncryptionEnabled) {
      // console.log('🔐 Шифрование базы данных активировано');
      // console.log('📋 Автоматическое определение зашифрованных колонок');
    } else {
      // console.log('⚠️ Шифрование базы данных отключено - ключ не найден');
    }
  }

  loadEncryptionKey() {
    try {
      const keyPath = path.join(__dirname, '../../ssl/keys/full_db_encryption.key');
      // console.log(`[EncryptedDB] Trying key path: ${keyPath}`);
      if (fs.existsSync(keyPath)) {
        const key = fs.readFileSync(keyPath, 'utf8').trim();
        // console.log(`[EncryptedDB] Key loaded from: ${keyPath}, length: ${key.length}`);
        return key;
      }
      // Попробуем альтернативный путь относительно корня приложения
      const altKeyPath = '/app/ssl/keys/full_db_encryption.key';
      // console.log(`[EncryptedDB] Trying alternative key path: ${altKeyPath}`);
      if (fs.existsSync(altKeyPath)) {
        const key = fs.readFileSync(altKeyPath, 'utf8').trim();
        // console.log(`[EncryptedDB] Key loaded from: ${altKeyPath}, length: ${key.length}`);
        return key;
      }
      // console.log(`[EncryptedDB] No key file found, using default key`);
      return 'default-key';
    } catch (error) {
      // console.error('❌ Ошибка загрузки ключа шифрования:', error);
      return 'default-key';
    }
  }

  /**
   * Получить данные из таблицы с автоматической расшифровкой
   */
  async getData(tableName, conditions = {}, limit = null, orderBy = null) {
    try {
      // Проверяем, включено ли шифрование
      if (!this.isEncryptionEnabled) {
        return await this.executeUnencryptedQuery(tableName, conditions, limit, orderBy);
      }

      // Получаем информацию о колонках
      const { rows: columns } = await db.getQuery()(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      // Строим SELECT с расшифровкой
      const selectFields = columns.map(col => {
        if (col.column_name.endsWith('_encrypted')) {
          const originalName = col.column_name.replace('_encrypted', '');
          // console.log(`🔓 Расшифровываем поле ${col.column_name} -> ${originalName}`);
          if (col.data_type === 'jsonb') {
            return `decrypt_json(${col.column_name}, $1) as "${originalName}"`;
          } else {
            return `decrypt_text(${col.column_name}, $1) as "${originalName}"`;
          }
        } else if (!col.column_name.includes('_encrypted')) {
          // Проверяем, есть ли зашифрованная версия этой колонки
          const hasEncryptedVersion = columns.some(encCol => 
            encCol.column_name === `${col.column_name}_encrypted`
          );
          
          // Если есть зашифрованная версия, пропускаем незашифрованную
          if (hasEncryptedVersion) {
            // console.log(`⚠️ Пропускаем незашифрованное поле ${col.column_name} (есть зашифрованная версия)`);
            return null;
          }
          
          // Заключаем зарезервированные слова в кавычки
          const reservedWords = ['order', 'group', 'user', 'index', 'table', 'column', 'key', 'foreign', 'primary', 'unique', 'check', 'constraint', 'default', 'null', 'not', 'and', 'or', 'as', 'on', 'in', 'is', 'like', 'between', 'exists', 'all', 'any', 'some', 'distinct', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'having', 'union', 'intersect', 'except', 'with', 'recursive'];
          if (reservedWords.includes(col.column_name.toLowerCase())) {
            return `"${col.column_name}"`;
          }
          return col.column_name;
        }
        return null;
      }).filter(Boolean).join(', ');

      let query = `SELECT ${selectFields} FROM ${tableName}`;
      
      // Проверяем, есть ли зашифрованные поля в таблице
      const hasEncryptedFields = columns.some(col => col.column_name.endsWith('_encrypted'));
      const params = hasEncryptedFields ? [this.encryptionKey] : [];
      let paramIndex = hasEncryptedFields ? 2 : 1;
      
      // Список зарезервированных слов для WHERE-условий
      const reservedWords = ['order', 'group', 'user', 'index', 'table', 'column', 'key', 'foreign', 'primary', 'unique', 'check', 'constraint', 'default', 'null', 'not', 'and', 'or', 'as', 'on', 'in', 'is', 'like', 'between', 'exists', 'all', 'any', 'some', 'distinct', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'having', 'union', 'intersect', 'except', 'with', 'recursive'];

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => {
            const value = conditions[key];
            
            // Проверяем, есть ли зашифрованная версия колонки
            const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
            
            // Обрабатываем оператор $in
            if (value && typeof value === 'object' && value.$in && Array.isArray(value.$in)) {
              const placeholders = value.$in.map(() => `$${paramIndex++}`).join(', ');
              const columnName = encryptedColumn ? key : 
                (reservedWords.includes(key.toLowerCase()) ? `"${key}"` : key);
              return `${columnName} IN (${placeholders})`;
            }
            
            // Обрабатываем оператор $ne
            if (value && typeof value === 'object' && value.$ne !== undefined) {
              const columnName = encryptedColumn ? key : 
                (reservedWords.includes(key.toLowerCase()) ? `"${key}"` : key);
              return `${columnName} != $${paramIndex++}`;
            }
            
            if (encryptedColumn) {
              // Для зашифрованных колонок используем прямое сравнение с зашифрованным значением
              return `${key}_encrypted = encrypt_text($${paramIndex++}, ${hasEncryptedFields ? '$1' : 'NULL'})`;
            } else {
              // Для незашифрованных колонок используем обычное сравнение
              // Заключаем зарезервированные слова в кавычки
              const columnName = reservedWords.includes(key.toLowerCase()) ? `"${key}"` : key;
              return `${columnName} = $${paramIndex++}`;
            }
          })
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        
        // Добавляем параметры для $in операторов
        const paramsToAdd = Object.values(conditions).map(value => {
          if (value && typeof value === 'object' && value.$in && Array.isArray(value.$in)) {
            return value.$in;
          }
          if (value && typeof value === 'object' && value.$ne !== undefined) {
            return value.$ne;
          }
          return value;
        }).flat();
        
        params.push(...paramsToAdd);
      }

      if (orderBy) {
        query += ` ORDER BY ${orderBy}`;
      }

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      // console.log(`🔍 [getData] Выполняем запрос:`, query);
      // console.log(`🔍 [getData] Параметры:`, params);
      
      const { rows } = await db.getQuery()(query, params);
      
              // console.log(`📊 Результат запроса из ${tableName}:`, rows);
      
      return rows;
    } catch (error) {
      // console.error(`❌ Ошибка получения данных из ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Сохранить данные в таблицу с автоматическим шифрованием
   */
  async saveData(tableName, data, whereConditions = null) {
    try {
      // Проверяем, включено ли шифрование
      if (!this.isEncryptionEnabled) {
        return await this.executeUnencryptedSave(tableName, data, whereConditions);
      }
      
      // Для таблицы users используем обычные запросы, так как она содержит смешанные колонки
      if (tableName === 'users') {
        return await this.executeUnencryptedSave(tableName, data, whereConditions);
      }

      // Получаем информацию о колонках
      const { rows: columns } = await db.getQuery()(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      // Подготавливаем данные для шифрования
      const encryptedData = {};
      const unencryptedData = {};
      const filteredData = {}; // Отфильтрованные данные для параметров

      // Проверяем, есть ли зашифрованные поля в таблице
      const hasEncryptedFields = columns.some(col => col.column_name.endsWith('_encrypted'));
      let paramIndex = hasEncryptedFields ? 2 : 1; // Начинаем с 2, если есть зашифрованные поля, иначе с 1
      
      for (const [key, value] of Object.entries(data)) {
        // Проверяем, есть ли зашифрованная версия колонки
        const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
        const unencryptedColumn = columns.find(col => col.column_name === key);
        
        // console.log(`🔍 Обрабатываем поле ${key} = "${value}" (тип: ${typeof value})`);
        
        if (encryptedColumn) {
          // Если есть зашифрованная колонка, шифруем данные
          // Проверяем, что значение не пустое перед шифрованием
          if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
            // Пропускаем пустые значения
            // console.log(`⚠️ Пропускаем пустое зашифрованное поле ${key}`);
            continue;
          }
          const currentParamIndex = paramIndex++;
          filteredData[key] = value; // Добавляем в отфильтрованные данные
          // console.log(`✅ Добавили зашифрованное поле ${key} в filteredData`);
          if (encryptedColumn.data_type === 'jsonb') {
            encryptedData[`${key}_encrypted`] = `encrypt_json($${currentParamIndex}, ${hasEncryptedFields ? '$1::text' : 'NULL'})`;
          } else {
            encryptedData[`${key}_encrypted`] = `encrypt_text($${currentParamIndex}, ${hasEncryptedFields ? '$1::text' : 'NULL'})`;
          }
        } else if (unencryptedColumn) {
          // Если есть незашифрованная колонка, сохраняем как есть
          // Проверяем, что значение не пустое перед сохранением (кроме role и sender_type)
          if ((value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) && 
              key !== 'role' && key !== 'sender_type') {
            // Пропускаем пустые значения, кроме role и sender_type
            // console.log(`⚠️ Пропускаем пустое незашифрованное поле ${key}`);
            continue;
          }
          filteredData[key] = value; // Добавляем в отфильтрованные данные
          unencryptedData[key] = `$${paramIndex++}`;
          // console.log(`✅ Добавили незашифрованное поле ${key} в filteredData и unencryptedData`);
        } else {
          // Если колонка не найдена, пропускаем
          // console.warn(`⚠️ Колонка ${key} не найдена в таблице ${tableName}`);
        }
      }

      const allData = { ...unencryptedData, ...encryptedData };
      
      // Проверяем, есть ли данные для сохранения
      if (Object.keys(allData).length === 0) {
        // console.warn(`⚠️ Нет данных для сохранения в таблице ${tableName} - все значения пустые`);
        // console.warn(`⚠️ Исходные данные:`, data);
        // console.warn(`⚠️ Отфильтрованные данные:`, filteredData);
        return null;
      }
      
      // Функция для заключения зарезервированных слов в кавычки
      const quoteReservedWord = (word) => {
        const reservedWords = ['order', 'group', 'user', 'index', 'table', 'column', 'key', 'foreign', 'primary', 'unique', 'check', 'constraint', 'default', 'null', 'not', 'and', 'or', 'as', 'on', 'in', 'is', 'like', 'between', 'exists', 'all', 'any', 'some', 'distinct', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'having', 'union', 'intersect', 'except', 'with', 'recursive'];
        return reservedWords.includes(word.toLowerCase()) ? `"${word}"` : word;
      };
      
      if (whereConditions) {
        // UPDATE
        const setClause = Object.keys(allData)
          .map((key, index) => `${quoteReservedWord(key)} = ${allData[key]}`)
          .join(', ');
        const whereClause = Object.keys(whereConditions)
          .map((key, index) => `${quoteReservedWord(key)} = $${paramIndex + index}`)
          .join(' AND ');

        const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`;
        const allParams = hasEncryptedFields ? [this.encryptionKey, ...Object.values(filteredData), ...Object.values(whereConditions)] : [...Object.values(filteredData), ...Object.values(whereConditions)];

        const { rows } = await db.getQuery()(query, allParams);
        return rows[0];
      } else {
        // INSERT
        const columns = Object.keys(allData).map(key => quoteReservedWord(key));
        const placeholders = Object.keys(allData).map(key => allData[key]).join(', ');

        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const params = hasEncryptedFields ? [this.encryptionKey, ...Object.values(filteredData)] : [...Object.values(filteredData)];

        const { rows } = await db.getQuery()(query, params);
        return rows[0];
      }
    } catch (error) {
      // console.error(`❌ Ошибка сохранения данных в ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Удалить данные из таблицы
   */
  async deleteData(tableName, conditions) {
    try {
      // Функция для заключения зарезервированных слов в кавычки
      const quoteReservedWord = (word) => {
        const reservedWords = ['order', 'group', 'user', 'index', 'table', 'column', 'key', 'foreign', 'primary', 'unique', 'check', 'constraint', 'default', 'null', 'not', 'and', 'or', 'as', 'on', 'in', 'is', 'like', 'between', 'exists', 'all', 'any', 'some', 'distinct', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'having', 'union', 'intersect', 'except', 'with', 'recursive'];
        return reservedWords.includes(word.toLowerCase()) ? `"${word}"` : word;
      };

      // Проверяем, включено ли шифрование
      if (!this.isEncryptionEnabled) {
        let query = `DELETE FROM ${tableName}`;
        const params = [];
        let paramIndex = 1;

        if (Object.keys(conditions).length > 0) {
          const whereClause = Object.keys(conditions)
            .map(key => `${quoteReservedWord(key)} = $${paramIndex++}`)
            .join(' AND ');
          query += ` WHERE ${whereClause}`;
          params.push(...Object.values(conditions));
        }

        const { rows } = await db.getQuery()(query, params);
        return rows;
      }

      // Для зашифрованных таблиц - пока используем обычный DELETE
      // TODO: Добавить логику для зашифрованных условий WHERE
      let query = `DELETE FROM ${tableName}`;
      const params = [];
      let paramIndex = 1;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${quoteReservedWord(key)} = $${paramIndex++}`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }

      const result = await db.getQuery()(query, params);
      return result.rows;
    } catch (error) {
      // console.error(`❌ Ошибка удаления данных из ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Получить статус шифрования
   */
  getEncryptionStatus() {
      return {
      enabled: this.isEncryptionEnabled,
      keyExists: !!this.encryptionKey,
      keyPath: path.join(__dirname, '../../ssl/keys/full_db_encryption.key')
    };
  }

  /**
   * Проверить, нужно ли шифровать колонку
   */
  shouldEncryptColumn(column) {
    const encryptableTypes = ['text', 'varchar', 'character varying', 'json', 'jsonb'];
    return encryptableTypes.includes(column.data_type) && 
           !column.column_name.includes('_encrypted') &&
           !['created_at', 'updated_at', 'id'].includes(column.column_name);
  }

  /**
   * Выполнить незашифрованный запрос (fallback)
   */
  async executeUnencryptedQuery(tableName, conditions = {}, limit = null, orderBy = null) {
    let query = `SELECT * FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = $${paramIndex++}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    const { rows } = await db.getQuery()(query, params);
    return rows;
  }

  /**
   * Выполнить незашифрованное сохранение (fallback)
   */
  async executeUnencryptedSave(tableName, data, whereConditions = null) {
    if (whereConditions) {
      // UPDATE
      const setClause = Object.keys(data)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const whereClause = Object.keys(whereConditions)
        .map((key, index) => `${key} = $${Object.keys(data).length + index + 1}`)
        .join(' AND ');

      const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const params = [...Object.values(data), ...Object.values(whereConditions)];

      const { rows } = await db.getQuery()(query, params);
      return rows[0];
    } else {
      // INSERT
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const { rows } = await db.getQuery()(query, values);
      return rows[0];
    }
  }
}

module.exports = new EncryptedDataService(); 