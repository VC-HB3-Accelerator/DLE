/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
              return `${key}_encrypted = encrypt_text($${paramIndex++}, ${hasEncryptedFields ? '($1)::text' : 'NULL'})`;
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
      let paramIndex = 1; // Начинаем с 1, encryptionKey будет последним (как в работающих примерах)
      
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
          // В INSERT запросах encryptionKey идет последним параметром (как в работающих примерах)
          // Используем плейсхолдер, который будет заменен на реальный номер после подсчета всех параметров
          if (encryptedColumn.data_type === 'jsonb') {
            encryptedData[`${key}_encrypted`] = `encrypt_json($${currentParamIndex}, ${hasEncryptedFields ? '$ENCRYPTION_KEY_PARAM' : 'NULL'})`;
          } else {
            encryptedData[`${key}_encrypted`] = `encrypt_text($${currentParamIndex}, ${hasEncryptedFields ? '$ENCRYPTION_KEY_PARAM' : 'NULL'})`;
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
        // UPDATE - используем тот же подход, что и в работающих примерах (auth.js, tables.js)
        // Как в auth.js: 'UPDATE nonces SET nonce_encrypted = encrypt_text($1, $2)'
        // Параметры: [nonce, encryptionKey] - encryptionKey идет последним
        const updateParams = [];
        let paramIndex = 1;
        let encryptionKeyParamIndex = null;
        
        // Сначала собираем все значения для SET и WHERE, чтобы узнать общее количество параметров
        const setParts = [];
        // Итерируемся по filteredData, чтобы использовать только реальные значения
        for (const key of Object.keys(filteredData)) {
          // Пропускаем ключи, которые используются только в WHERE
          if (whereConditions && whereConditions.hasOwnProperty(key)) {
            continue;
          }
          
          // Проверяем, зашифрованное ли это поле
          // encryptedData содержит ключи с _encrypted (например, domain_encrypted)
          // filteredData содержит оригинальные ключи (например, domain)
          const encryptedKey = `${key}_encrypted`;
          if (encryptedData[encryptedKey]) {
            // Зашифрованное поле - key уже оригинальный (без _encrypted)
            const dataParamIndex = paramIndex++;
            updateParams.push(filteredData[key]);
            setParts.push({ key: encryptedKey, dataParamIndex, encrypted: true });
          } else if (unencryptedData.hasOwnProperty(key)) {
            // Незашифрованное поле - проверяем, что оно есть в unencryptedData
            const dataParamIndex = paramIndex++;
            setParts.push({ key, dataParamIndex, encrypted: false });
            updateParams.push(filteredData[key]);
          }
        }
        
        // Проверяем, есть ли зашифрованные поля в SET или WHERE
        const hasEncryptedInSet = setParts.some(part => part.encrypted);
        
        // Формируем WHERE часть
        const whereParts = [];
        let hasEncryptedInWhere = false;
        for (const [key, value] of Object.entries(whereConditions)) {
          const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
          if (encryptedColumn) {
            // Для зашифрованных колонок используем encrypt_text для сравнения
            const dataParamIndex = paramIndex++;
            whereParts.push({ key, dataParamIndex, encrypted: true });
            updateParams.push(value);
            hasEncryptedInWhere = true;
          } else {
            // Для незашифрованных колонок используем обычное сравнение
            const dataParamIndex = paramIndex++;
            whereParts.push({ key, dataParamIndex, encrypted: false });
            updateParams.push(value);
          }
        }
        
        // Определяем номер параметра для encryptionKey (последний, после всех данных)
        // encryptionKey нужен, если есть зашифрованные поля в SET или WHERE
        // ВАЖНО: encryptionKey используется один раз для всех зашифрованных полей
        if (hasEncryptedInSet || hasEncryptedInWhere) {
          encryptionKeyParamIndex = paramIndex; // paramIndex уже увеличен после последнего параметра данных
        }
        
        // Формируем SET clause с правильными номерами параметров
        const setClause = setParts.map(part => {
          if (part.encrypted) {
            if (!encryptionKeyParamIndex) {
              throw new Error('encryptionKeyParamIndex должен быть определен для зашифрованных полей');
            }
            return `${quoteReservedWord(part.key)} = encrypt_text($${part.dataParamIndex}, $${encryptionKeyParamIndex})`;
          } else {
            return `${quoteReservedWord(part.key)} = $${part.dataParamIndex}`;
          }
        }).join(', ');
        
        // Формируем WHERE clause с правильными номерами параметров
        const whereClause = whereParts.map(part => {
          if (part.encrypted) {
            if (!encryptionKeyParamIndex) {
              throw new Error('encryptionKeyParamIndex должен быть определен для зашифрованных полей в WHERE');
            }
            // part.key уже без _encrypted, нужно добавить _encrypted для имени колонки
            return `${quoteReservedWord(`${part.key}_encrypted`)} = encrypt_text($${part.dataParamIndex}, $${encryptionKeyParamIndex})`;
          } else {
            return `${quoteReservedWord(part.key)} = $${part.dataParamIndex}`;
          }
        }).join(' AND ');
        
        const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`;
        
        // Собираем параметры: сначала все значения для SET и WHERE, затем encryptionKey (если есть)
        const allParams = encryptionKeyParamIndex 
          ? [...updateParams, this.encryptionKey]
          : updateParams;
        
        // Подсчитываем количество плейсхолдеров в запросе
        const placeholderCount = (query.match(/\$\d+/g) || []).length;
        const maxPlaceholder = Math.max(...(query.match(/\$\d+/g) || ['$0']).map(m => parseInt(m.replace('$', ''))));
        
        console.log(`🔍 UPDATE запрос: ${query}`);
        console.log(`🔍 setParts (${setParts.length}):`, JSON.stringify(setParts, null, 2));
        console.log(`🔍 whereParts (${whereParts.length}):`, JSON.stringify(whereParts, null, 2));
        console.log(`🔍 encryptionKeyParamIndex:`, encryptionKeyParamIndex);
        console.log(`🔍 updateParams.length:`, updateParams.length);
        console.log(`🔍 Параметры (${allParams.length}):`, allParams.map((p, i) => {
          const val = typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p;
          return `$${i+1}=${val}`;
        }));
        console.log(`🔍 Проверка: плейсхолдеров в запросе=${placeholderCount}, максимальный номер=${maxPlaceholder}, параметров=${allParams.length}`);
        
        if (maxPlaceholder !== allParams.length) {
          const errorMsg = `Несоответствие параметров: в запросе используется $${maxPlaceholder}, но передано ${allParams.length} параметров. setParts=${setParts.length}, whereParts=${whereParts.length}, hasEncryptionKey=${!!encryptionKeyParamIndex}`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        const { rows } = await db.getQuery()(query, allParams);
        return rows[0];
      } else {
        // INSERT - используем тот же подход, что и в работающих примерах (tables.js, users.js)
        // Как в tables.js: 'INSERT INTO user_cell_values VALUES ($1, $2, encrypt_text($3, $4))'
        // Параметры: [row_id, column_id, value, encryptionKey] - encryptionKey идет последним
        const insertParams = [];
        let insertParamIndex = 1;
        let encryptionKeyParamIndex = null;
        
        // Формируем VALUES часть с правильными плейсхолдерами
        const valuesParts = [];
        const columns = [];
        
        // Сначала обрабатываем все поля из filteredData
        // Проверяем, есть ли зашифрованные поля
        const hasEncryptedFieldsInInsert = Object.keys(encryptedData).length > 0;
        
        for (const key of Object.keys(filteredData)) {
          const encryptedKey = `${key}_encrypted`;
          if (encryptedData[encryptedKey]) {
            // Зашифрованное поле
            const dataParamIndex = insertParamIndex++;
            insertParams.push(filteredData[key]);
            columns.push(quoteReservedWord(encryptedKey));
            // Используем плейсхолдер, который заменим позже
            valuesParts.push(`encrypt_text($${dataParamIndex}, $ENCRYPTION_KEY)`);
          } else if (unencryptedData.hasOwnProperty(key)) {
            // Незашифрованное поле
            const dataParamIndex = insertParamIndex++;
            insertParams.push(filteredData[key]);
            columns.push(quoteReservedWord(key));
            valuesParts.push(`$${dataParamIndex}`);
          }
        }
        
        // Определяем номер параметра для encryptionKey (последний)
        if (hasEncryptedFieldsInInsert) {
          encryptionKeyParamIndex = insertParamIndex;
        }
        
        // Заменяем плейсхолдер ENCRYPTION_KEY на реальный номер
        const placeholdersFinal = valuesParts.map(ph => 
          ph.replace(/\$ENCRYPTION_KEY/g, encryptionKeyParamIndex ? `$${encryptionKeyParamIndex}` : 'NULL')
        ).join(', ');
        
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholdersFinal}) RETURNING *`;
        
        // Собираем параметры: сначала все значения из insertParams, затем encryptionKey (если есть)
        const allParams = encryptionKeyParamIndex 
          ? [...insertParams, this.encryptionKey]
          : insertParams;
        
        // Подсчитываем количество плейсхолдеров в запросе
        const placeholderCount = (query.match(/\$\d+/g) || []).length;
        const maxPlaceholder = Math.max(...(query.match(/\$\d+/g) || ['$0']).map(m => parseInt(m.replace('$', ''))));
        
        console.log(`🔍 INSERT запрос: ${query}`);
        console.log(`🔍 columns (${columns.length}):`, columns);
        console.log(`🔍 valuesParts (${valuesParts.length}):`, valuesParts);
        console.log(`🔍 insertParams.length:`, insertParams.length);
        console.log(`🔍 encryptionKeyParamIndex:`, encryptionKeyParamIndex);
        console.log(`🔍 Параметры (${allParams.length}):`, allParams.map((p, i) => {
          const val = typeof p === 'string' && p.length > 50 ? p.substring(0, 50) + '...' : p;
          return `$${i+1}=${val}`;
        }));
        console.log(`🔍 Проверка: плейсхолдеров в запросе=${placeholderCount}, максимальный номер=${maxPlaceholder}, параметров=${allParams.length}`);
        
        if (maxPlaceholder !== allParams.length) {
          const errorMsg = `Несоответствие параметров: в запросе используется $${maxPlaceholder}, но передано ${allParams.length} параметров. columns=${columns.length}, valuesParts=${valuesParts.length}, hasEncryptionKey=${!!encryptionKeyParamIndex}`;
          console.error(`❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }

        const { rows } = await db.getQuery()(query, allParams);
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
              return `${key}_encrypted = encrypt_text($${index + 2}, ($1)::text)`;
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
   * Автоматически преобразует результаты: колонки с _encrypted возвращаются без суффикса
   */
  async executeUnencryptedQuery(tableName, conditions = {}, limit = null, orderBy = null) {
    // Получаем информацию о колонках таблицы
    const { rows: columns } = await db.getQuery()(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);

    // Строим SELECT с алиасами для колонок с _encrypted
    const selectFields = columns.map(col => {
      if (col.column_name.endsWith('_encrypted')) {
        const originalName = col.column_name.replace('_encrypted', '');
        return `${col.column_name} as "${originalName}"`;
      }
      return col.column_name;
    }).join(', ');

    let query = `SELECT ${selectFields} FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      // Преобразуем ключи условий: если есть колонка с _encrypted, используем её
      const whereClause = Object.keys(conditions)
        .map(key => {
          const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
          const columnName = encryptedColumn ? `${key}_encrypted` : key;
          return `${columnName} = $${paramIndex++}`;
        })
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
   * Автоматически преобразует ключи: если есть колонка с суффиксом _encrypted, использует её
   */
  async executeUnencryptedSave(tableName, data, whereConditions = null) {
    // Получаем информацию о колонках таблицы
    const { rows: columns } = await db.getQuery()(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);

    // Преобразуем ключи данных: если есть колонка с _encrypted, используем её
    const transformedData = {};
    for (const [key, value] of Object.entries(data)) {
      // Пропускаем служебные поля
      if (key === 'created_at' || key === 'updated_at') {
        transformedData[key] = value;
        continue;
      }

      // Проверяем, есть ли колонка с суффиксом _encrypted
      const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
      if (encryptedColumn) {
        // Используем колонку с суффиксом _encrypted (но БЕЗ шифрования, так как это fallback)
        transformedData[`${key}_encrypted`] = value;
      } else {
        // Используем колонку как есть
        transformedData[key] = value;
      }
    }

    // Преобразуем ключи в whereConditions аналогично
    const transformedWhereConditions = whereConditions ? {} : null;
    if (whereConditions) {
      for (const [key, value] of Object.entries(whereConditions)) {
        const encryptedColumn = columns.find(col => col.column_name === `${key}_encrypted`);
        if (encryptedColumn) {
          transformedWhereConditions[`${key}_encrypted`] = value;
        } else {
          transformedWhereConditions[key] = value;
        }
      }
    }

    if (transformedWhereConditions) {
      // UPDATE
      const setClause = Object.keys(transformedData)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      const whereClause = Object.keys(transformedWhereConditions)
        .map((key, index) => `${key} = $${Object.keys(transformedData).length + index + 1}`)
        .join(' AND ');

      const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const params = [...Object.values(transformedData), ...Object.values(transformedWhereConditions)];

      const { rows } = await db.getQuery()(query, params);
      return rows[0];
    } else {
      // INSERT
      const columnsList = Object.keys(transformedData);
      const values = Object.values(transformedData);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

      const query = `INSERT INTO ${tableName} (${columnsList.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const { rows } = await db.getQuery()(query, values);
      return rows[0];
    }
  }
}

module.exports = new EncryptedDataService(); 