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

const db = require('../db');
const encryptionUtils = require('../utils/encryptionUtils');

class EncryptedDataService {
  constructor() {
    this.encryptionKey = encryptionUtils.getEncryptionKey();
    this.isEncryptionEnabled = encryptionUtils.isEnabled();
    
    if (this.isEncryptionEnabled) {
      console.log('🔐 [EncryptedDB] Шифрование базы данных активировано');
      console.log('📋 [EncryptedDB] Автоматическое определение зашифрованных колонок');
    } else {
      console.log('⚠️ [EncryptedDB] Шифрование базы данных отключено - ключ не найден');
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
            return `CASE WHEN ${col.column_name} IS NULL OR ${col.column_name} = '' THEN NULL ELSE decrypt_json(${col.column_name}, $1) END as "${originalName}"`;
          } else {
            return `CASE WHEN ${col.column_name} IS NULL OR ${col.column_name} = '' THEN NULL ELSE decrypt_text(${col.column_name}, $1) END as "${originalName}"`;
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
      
      // Если ошибка связана с расшифровкой, попробуем получить данные без расшифровки
      if (error.message && error.message.includes('invalid base64')) {
        console.log(`⚠️ Ошибка расшифровки в ${tableName}, пытаемся получить данные без расшифровки`);
        return await this.executeUnencryptedQuery(tableName, conditions, limit, orderBy);
      }
      
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
            console.log(`⚠️ Пропускаем пустое зашифрованное поле ${key}`);
            continue;
          }
          const currentParamIndex = paramIndex++;
          
          // Преобразуем значение в строку для шифрования
          let valueToEncrypt;
          if (typeof value === 'object') {
            // Если это объект/массив, преобразуем в JSON
            valueToEncrypt = JSON.stringify(value);
          } else {
            valueToEncrypt = value;
          }
          
          filteredData[key] = valueToEncrypt; // Добавляем в отфильтрованные данные
          console.log(`✅ Добавили зашифрованное поле ${key} = "${valueToEncrypt}" в filteredData`);
          if (encryptedColumn.data_type === 'jsonb') {
            encryptedData[`${key}_encrypted`] = `encrypt_json($${currentParamIndex}, ${hasEncryptedFields ? '$1::text' : 'NULL'})`;
          } else {
            encryptedData[`${key}_encrypted`] = `encrypt_text($${currentParamIndex}, ${hasEncryptedFields ? '$1::text' : 'NULL'})`;
          }
          console.log(`🔐 Будем шифровать ${key} -> ${key}_encrypted`);
        } else if (unencryptedColumn) {
          // Если есть незашифрованная колонка, сохраняем как есть
          // Проверяем, что значение не пустое перед сохранением (кроме role, sender_type и user_id)
          if ((value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) && 
              key !== 'role' && key !== 'sender_type' && key !== 'user_id') {
            // Пропускаем пустые значения, кроме role, sender_type и user_id
            // console.log(`⚠️ Пропускаем пустое незашифрованное поле ${key}`);
            continue;
          }
          filteredData[key] = value; // Добавляем в отфильтрованные данные
          unencryptedData[key] = `$${paramIndex++}`;
          console.log(`✅ Добавили незашифрованное поле ${key} в filteredData и unencryptedData`);
        } else {
          // Если колонка не найдена, пропускаем
          // console.warn(`⚠️ Колонка ${key} не найдена в таблице ${tableName}`);
        }
      }

      const allData = { ...unencryptedData, ...encryptedData };
      
      console.log(`🔍 allData:`, JSON.stringify(allData, null, 2));
      console.log(`🔍 filteredData:`, JSON.stringify(filteredData, null, 2));
      console.log(`🔍 unencryptedData:`, JSON.stringify(unencryptedData, null, 2));
      console.log(`🔍 encryptedData:`, JSON.stringify(encryptedData, null, 2));
      
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
          .map((key, index) => {
            // Для WHERE условий используем зашифрованные имена колонок
            const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
            if (encryptedColumn) {
              // Для зашифрованных колонок используем encrypt_text для сравнения
              return `${quoteReservedWord(`${key}_encrypted`)} = encrypt_text($${paramIndex + index}, ${hasEncryptedFields ? '$1' : 'NULL'})`;
            } else {
              // Для незашифрованных колонок используем обычное сравнение
              return `${quoteReservedWord(key)} = $${paramIndex + index}`;
            }
          })
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
        
        // Собираем параметры в правильном порядке по номерам из плейсхолдеров
        const paramMap = new Map(); // номер параметра -> значение
        
        if (hasEncryptedFields) {
          paramMap.set(1, this.encryptionKey); // $1 - ключ шифрования
        }
        
        // Проходим по колонкам в порядке allData и добавляем соответствующие значения
        for (const key of Object.keys(allData)) {
          const placeholder = allData[key].toString();
          console.log(`🔍 Обрабатываем ключ: ${key}, placeholder: ${placeholder}`);
          // Извлекаем все номера параметров из плейсхолдера (может быть $1 в encrypt_text)
          const paramMatches = placeholder.match(/\$(\d+)/g);
          console.log(`🔍 paramMatches для ${key}:`, paramMatches);
          if (paramMatches) {
            // Для зашифрованных колонок нас интересует второй параметр ($3, $4 и т.д.)
            // Для незашифрованных - первый параметр ($2, $3 и т.д.)
            if (encryptedData[key]) {
              // Это зашифрованная колонка - берем первый параметр (это значение для шифрования)
              const originalKey = key.replace('_encrypted', '');
              console.log(`🔍 Это зашифрованная колонка, originalKey: ${originalKey}, filteredData[originalKey]:`, filteredData[originalKey]);
              if (filteredData[originalKey] !== undefined && paramMatches.length > 0) {
                // Первый параметр это значение для шифрования
                const valueParam = paramMatches[0];
                const paramNum = parseInt(valueParam.substring(1));
                console.log(`🔍 Устанавливаем paramMap[${paramNum}] =`, filteredData[originalKey]);
                paramMap.set(paramNum, filteredData[originalKey]);
              }
            } else if (unencryptedData[key]) {
              // Это незашифрованная колонка - берем параметр из плейсхолдера
              const valueParam = paramMatches[0];
              const paramNum = parseInt(valueParam.substring(1));
              console.log(`🔍 Это незашифрованная колонка, устанавливаем paramMap[${paramNum}] =`, filteredData[key]);
              paramMap.set(paramNum, filteredData[key]);
            }
          }
        }
        
        console.log(`🔍 paramMap после цикла:`, Array.from(paramMap.entries()));
        
        // Создаем массив параметров в правильном порядке (от $1 до максимального номера)
        const maxParamNum = Math.max(...Array.from(paramMap.keys()));
        const params = [];
        for (let i = 1; i <= maxParamNum; i++) {
          if (!paramMap.has(i)) {
            throw new Error(`Отсутствует параметр $${i} для запроса`);
          }
          params.push(paramMap.get(i));
        }

        console.log(`🔍 Выполняем INSERT запрос:`, query);
        console.log(`🔍 Параметры:`, params);
        console.log(`🔍 Ключ шифрования:`, this.encryptionKey ? 'установлен' : 'не установлен');

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
      // Проверяем, включено ли шифрование
      if (!this.isEncryptionEnabled) {
        return await this.executeUnencryptedQuery(tableName, conditions);
      }

      // Получаем информацию о колонках
      const { rows: columns } = await db.getQuery()(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      // Функция для заключения зарезервированных слов в кавычки
      const quoteReservedWord = (word) => {
        const reservedWords = ['order', 'group', 'user', 'index', 'table', 'column', 'key', 'foreign', 'primary', 'unique', 'check', 'constraint', 'default', 'null', 'not', 'and', 'or', 'as', 'on', 'in', 'is', 'like', 'between', 'exists', 'all', 'any', 'some', 'distinct', 'case', 'when', 'then', 'else', 'end', 'limit', 'offset', 'having', 'union', 'intersect', 'except', 'with', 'recursive'];
        return reservedWords.includes(word.toLowerCase()) ? `"${word}"` : word;
      };

      let query = `DELETE FROM ${tableName}`;
      const params = [];
      let paramIndex = 1;

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map((key, index) => {
            const value = conditions[key];
            
            // Проверяем, есть ли зашифрованная версия колонки
            const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
            
            if (encryptedColumn) {
              // Для зашифрованных колонок используем прямое сравнение с зашифрованным значением
              // Ключ шифрования всегда первый параметр ($1), затем значения
              return `${key}_encrypted = encrypt_text($${index + 2}, $1)`;
            } else {
              // Для незашифрованных колонок используем обычное сравнение
              const columnName = quoteReservedWord(key);
              return `${columnName} = $${index + 1}`;
            }
          })
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        
        // Добавляем параметры
        const paramsToAdd = Object.values(conditions);
        params.push(...paramsToAdd);
      }

      // Определяем, нужно ли добавлять ключ шифрования
      // Проверяем, есть ли в WHERE условиях зашифрованные колонки
      const hasEncryptedFieldsInConditions = Object.keys(conditions).some(key => {
        return columns.find(col => col.column_name === `${key}_encrypted`);
      });
      
      if (hasEncryptedFieldsInConditions) {
        params.unshift(this.encryptionKey);
      }

      const result = await db.getQuery()(query, params);
      return result.rows;
    } catch (error) {
      console.error(`[EncryptedDataService] ❌ Ошибка удаления данных из ${tableName}:`, error);
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
    const excludedColumns = ['created_at', 'updated_at', 'id', 'metadata']; // Добавляем metadata в исключения
    return encryptableTypes.includes(column.data_type) && 
           !column.column_name.includes('_encrypted') &&
           !excludedColumns.includes(column.column_name);
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