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

const vectorSearch = require('./vectorSearchClient');
const ragService = require('./ragService');
const aiConfigService = require('./aiConfigService');
const userContextService = require('./userContextService');
const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const logger = require('../utils/logger');

const DOCUMENT_SNIPPET_LENGTH = 350;

function resolveDocumentIdFromResult(result) {
  if (!result) {
    return null;
  }

  const metadata = result.metadata || {};
  const candidates = [metadata.doc_id, metadata.parent_doc_id];

  for (const value of candidates) {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  if (typeof result.row_id === 'string') {
    const match = result.row_id.match(/^(\d+)(?:_chunk_\d+)?$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  if (typeof result.row_id === 'number' && Number.isFinite(result.row_id)) {
    return result.row_id;
  }

  return null;
}

function extractPlainText(content, format = 'text') {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let plain = content;

  if (format === 'html' || /<[^>]+>/.test(content)) {
    plain = plain
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
  }

  plain = plain
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return plain;
}

function buildSnippet(text, maxLength = DOCUMENT_SNIPPET_LENGTH) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

/**
 * Сервис для параллельного поиска в таблицах и документах
 * с комбинацией нескольких методов анализа
 */
class MultiSourceSearchService {
  constructor() {
    this.searchMethods = {
      semantic: 'semantic',
      keyword: 'keyword',
      hybrid: 'hybrid'
    };
  }

  /**
   * Основной метод поиска в нескольких источниках параллельно
   * @param {Object} options - Опции поиска
   * @param {string} options.query - Поисковый запрос
   * @param {Array<number>} options.tableIds - ID таблиц для поиска
   * @param {boolean} options.searchInDocuments - Поиск в документах (legal_docs)
   * @param {string} options.searchMethod - Метод поиска: 'semantic', 'keyword', 'hybrid'
   * @param {number} options.userId - ID пользователя (для фильтрации по тегам)
   * @param {number} options.maxResultsPerSource - Максимум результатов из каждого источника
   * @param {number} options.totalMaxResults - Максимум результатов всего
   * @returns {Promise<Object>} Объединенные результаты поиска
   */
  async search({
    query,
    tableIds = [],
    searchInDocuments = true,
    searchMethod = 'hybrid',
    userId = null,
    maxResultsPerSource = 10,
    totalMaxResults = 20
  }) {
    logger.info(`[MultiSourceSearch] Поиск: query="${query}", tableIds=${tableIds.join(',')}, searchInDocuments=${searchInDocuments}, method=${searchMethod}`);

    try {
      // Загружаем настройки RAG
      const ragConfig = await aiConfigService.getRAGConfig();
      const finalMaxResults = maxResultsPerSource || ragConfig.maxResults || 10;

      // Параллельно запускаем поиск в разных источниках
      const searchPromises = [];

      // 1. Поиск в таблицах (user_tables)
      if (tableIds && tableIds.length > 0) {
        for (const tableId of tableIds) {
          searchPromises.push(
            this.searchInTable({
              tableId,
              query,
              searchMethod,
              userId,
              maxResults: finalMaxResults
            }).catch(err => {
              logger.error(`[MultiSourceSearch] Ошибка поиска в таблице ${tableId}:`, err.message);
              return { source: 'table', tableId, results: [], error: err.message };
            })
          );
        }
      }

      // 2. Поиск в документах (legal_docs)
      if (searchInDocuments) {
        searchPromises.push(
          this.searchInDocuments({
            query,
            searchMethod,
            maxResults: finalMaxResults
          }).catch(err => {
            logger.error(`[MultiSourceSearch] Ошибка поиска в документах:`, err.message);
            return { source: 'documents', results: [], error: err.message };
          })
        );
      }

      // Ждем результаты из всех источников
      logger.info(`[MultiSourceSearch] Ожидание результатов из ${searchPromises.length} источников...`);
      const promiseStartTime = Date.now();
      const searchResults = await Promise.all(searchPromises);
      const promiseDuration = Date.now() - promiseStartTime;
      logger.info(`[MultiSourceSearch] Получены результаты из всех источников за ${promiseDuration}ms, всего: ${searchResults.length}`);

      // Объединяем результаты
      logger.info(`[MultiSourceSearch] Объединение результатов...`);
      const mergedResults = this.mergeResults(searchResults, {
        totalMaxResults,
        searchMethod
      });

      logger.info(`[MultiSourceSearch] Найдено результатов: ${mergedResults.results.length} из ${searchResults.length} источников`);

      return mergedResults;
    } catch (error) {
      logger.error(`[MultiSourceSearch] Ошибка поиска:`, error);
      throw error;
    }
  }

  /**
   * Поиск в конкретной таблице
   * @param {Object} options - Опции поиска
   * @returns {Promise<Object>} Результаты поиска
   */
  async searchInTable({
    tableId,
    query,
    searchMethod,
    userId,
    maxResults
  }) {
    logger.info(`[MultiSourceSearch] Поиск в таблице ${tableId}, метод: ${searchMethod}`);
    const startTime = Date.now();

    let result;
    switch (searchMethod) {
      case this.searchMethods.semantic:
        result = await this.semanticSearchInTable(tableId, query, userId, maxResults);
        break;
      
      case this.searchMethods.keyword:
        result = await this.keywordSearchInTable(tableId, query, userId, maxResults);
        break;
      
      case this.searchMethods.hybrid:
      default:
        result = await this.hybridSearchInTable(tableId, query, userId, maxResults);
        break;
    }

    const duration = Date.now() - startTime;
    logger.info(`[MultiSourceSearch] Поиск в таблице ${tableId} завершен за ${duration}ms, найдено: ${result?.results?.length || 0} результатов`);
    return result;
  }

  /**
   * Семантический поиск в таблице (векторный)
   */
  async semanticSearchInTable(tableId, query, userId, maxResults) {
    try {
      // Используем векторный поиск напрямую для получения нескольких результатов
      const vectorResults = await vectorSearch.search(tableId, query, maxResults);
      
      // Получаем данные таблицы для формирования полных результатов
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      const db = require('../db');

      // Фильтруем по тегам пользователя, если указан
      let filteredRowIds = null;
      if (userId) {
        // Используем логику из ragService для фильтрации
        const userTagIds = await userContextService.getUserTags(userId);
        if (userTagIds && userTagIds.length > 0) {
          const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
          const tagsColumn = columns.find(col => 
            col.options?.purpose === 'userTags' && 
            (col.type === 'multiselect-relation' || col.type === 'relation')
          );

          if (tagsColumn) {
            const result = await db.getQuery()(`
              SELECT DISTINCT from_row_id
              FROM user_table_relations
              WHERE column_id = $1
                AND to_row_id = ANY($2)
            `, [tagsColumn.id, userTagIds]);
            filteredRowIds = result.rows.map(row => row.from_row_id);
          }
        }
      }

      // Формируем результаты
      const results = [];
      for (const vectorResult of vectorResults) {
        const rowId = parseInt(vectorResult.row_id);
        
        // Пропускаем, если фильтрация по тегам и строка не подходит
        if (filteredRowIds !== null && filteredRowIds.length > 0 && !filteredRowIds.includes(rowId)) {
          continue;
        }

        results.push({
          source: 'table',
          sourceId: tableId,
          rowId: rowId,
          text: vectorResult.metadata?.answer || vectorResult.metadata?.text || '',
          context: vectorResult.metadata?.context || '',
          score: vectorResult.score || 0,
          metadata: {
            answer: vectorResult.metadata?.answer,
            context: vectorResult.metadata?.context,
            product: vectorResult.metadata?.product,
            priority: vectorResult.metadata?.priority,
            date: vectorResult.metadata?.date,
            userTags: vectorResult.metadata?.userTags
          }
        });
      }

      return {
        source: 'table',
        tableId,
        method: 'semantic',
        results,
        count: results.length
      };
    } catch (error) {
      logger.error(`[MultiSourceSearch] Ошибка семантического поиска в таблице ${tableId}:`, error);
      return {
        source: 'table',
        tableId,
        method: 'semantic',
        results: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Поиск по ключевым словам в таблице
   */
  async keywordSearchInTable(tableId, query, userId, maxResults) {
    // Извлекаем ключевые слова из запроса
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      return {
        source: 'table',
        tableId,
        method: 'keyword',
        results: [],
        count: 0
      };
    }

    // Используем RAG сервис для получения данных таблицы
    const encryptedDb = require('./encryptedDatabaseService');
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const db = require('../db');

    // Получаем строки таблицы
    const rowsResult = await db.getQuery()(
      'SELECT id FROM user_rows WHERE table_id = $1',
      [tableId]
    );
    const rows = rowsResult.rows;

    // Фильтруем по тегам пользователя, если указан
    let filteredRowIds = rows.map(r => r.id);
    if (userId) {
      const userTagIds = await userContextService.getUserTags(userId);
      if (userTagIds && userTagIds.length > 0) {
        // Получаем строки с тегами пользователя через user_table_relations
        const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
        const tagsColumn = columns.find(col => 
          col.options?.purpose === 'userTags' && 
          (col.type === 'multiselect-relation' || col.type === 'relation')
        );

        if (tagsColumn) {
          const filteredRowsResult = await db.getQuery()(
            `SELECT DISTINCT from_row_id as id
             FROM user_table_relations
             WHERE column_id = $1
               AND to_row_id = ANY($2)`,
            [tagsColumn.id, userTagIds]
          );
          filteredRowIds = filteredRowsResult.rows.map(r => r.id);
        }
      }
    }

    // Получаем данные ячеек для каждой строки
    const results = [];
    for (const rowId of filteredRowIds) {
      const cellsResult = await db.getQuery()(
        `SELECT 
           uc.id as column_id,
           decrypt_text(uc.name_encrypted, $1) as column_name,
           decrypt_text(ucv.value_encrypted, $1) as value
         FROM user_cell_values ucv
         JOIN user_columns uc ON uc.id = ucv.column_id
         WHERE ucv.row_id = $2 AND uc.table_id = $3`,
        [encryptionKey, rowId, tableId]
      );
      const cells = cellsResult.rows;

      // Формируем текст строки из всех ячеек
      const rowText = cells
        .map(cell => `${cell.column_name}: ${cell.value}`)
        .join(' ');

      // Вычисляем совпадение по ключевым словам
      const matchScore = this.calculateKeywordMatch(rowText, keywords);
      
      if (matchScore > 0) {
        // Ищем столбец с ответом (purpose: 'answer')
        // Получаем столбцы для проверки purpose
        const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
        const answerColumn = columns.find(col => col.options?.purpose === 'answer');
        const answerColumnId = answerColumn ? answerColumn.id : null;
        
        const answerCell = answerColumnId 
          ? cells.find(c => c.column_id === answerColumnId)
          : cells.find(c => {
              // Fallback: ищем по названию
              return c.column_name && (
                c.column_name.toLowerCase().includes('ответ') ||
                c.column_name.toLowerCase().includes('answer')
              );
            });

        const questionColumn = columns.find(col => col.options?.purpose === 'question');
        const questionColumnId = questionColumn ? questionColumn.id : null;
        const questionCell = questionColumnId 
          ? cells.find(c => c.column_id === questionColumnId)
          : null;

        results.push({
          source: 'table',
          sourceId: tableId,
          rowId: rowId,
          text: answerCell ? answerCell.value : rowText,
          context: questionCell ? questionCell.value : rowText,
          score: matchScore,
          metadata: {
            method: 'keyword',
            keywords: keywords,
            rowData: cells.reduce((acc, cell) => {
              acc[cell.column_name] = cell.value;
              return acc;
            }, {})
          }
        });
      }
    }

    // Сортируем по релевантности и берем топ-N
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, maxResults);

    return {
      source: 'table',
      tableId,
      method: 'keyword',
      results: topResults,
      count: topResults.length
    };
  }

  /**
   * Гибридный поиск в таблице (семантический + ключевые слова)
   */
  async hybridSearchInTable(tableId, query, userId, maxResults) {
    // Параллельно выполняем оба типа поиска
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearchInTable(tableId, query, userId, maxResults * 2),
      this.keywordSearchInTable(tableId, query, userId, maxResults * 2)
    ]);

    // Объединяем результаты с весами
    const semanticWeight = 0.7;
    const keywordWeight = 0.3;

    const combined = this.combineSearchResults(
      semanticResults.results,
      keywordResults.results,
      semanticWeight,
      keywordWeight
    );

    // Сортируем и берем топ-N
    combined.sort((a, b) => b.combinedScore - a.combinedScore);
    const topResults = combined.slice(0, maxResults);

    return {
      source: 'table',
      tableId,
      method: 'hybrid',
      results: topResults.map(r => ({
        ...r,
        score: r.combinedScore
      })),
      count: topResults.length,
      semanticCount: semanticResults.count,
      keywordCount: keywordResults.count
    };
  }

  /**
   * Поиск в документах (legal_docs)
   */
  async searchInDocuments({
    query,
    searchMethod,
    maxResults
  }) {
    logger.info(`[MultiSourceSearch] Поиск в документах, метод: ${searchMethod}`);
    const startTime = Date.now();

    const tableId = 'legal_docs';

    try {
      // Векторный поиск в документах
      const vectorResults = await vectorSearch.search(tableId, query, maxResults * 2);

      const documentIds = new Set();
      for (const result of vectorResults) {
        const docId = resolveDocumentIdFromResult(result);
        if (docId !== null) {
          documentIds.add(docId);
        }
      }

      const documentSnippets = new Map();
      if (documentIds.size > 0) {
        const idsArray = Array.from(documentIds);
        try {
          const queryFn = db.getQuery();
          const { rows } = await queryFn(
            `SELECT id, content, format FROM admin_pages_simple WHERE id = ANY($1::int[])`,
            [idsArray]
          );

          for (const row of rows) {
            const snippet = buildSnippet(extractPlainText(row.content, row.format));
            documentSnippets.set(String(row.id), snippet);
          }
        } catch (dbError) {
          logger.warn(`[MultiSourceSearch] Не удалось загрузить содержимое документов: ${dbError.message}`);
        }
      }

      // Формируем результаты
      const results = vectorResults.map(result => {
        const metadata = result.metadata || {};
        const docId = resolveDocumentIdFromResult(result);
        const docKey = docId !== null ? String(docId) : null;

        const chunkText = buildSnippet(result.text || metadata.content || metadata.text || '');
        const fallbackText = docKey ? documentSnippets.get(docKey) : '';
        const finalText = chunkText || fallbackText || '';

        const contextValue = metadata.title || metadata.section || '';

        return {
          source: 'document',
          sourceId: tableId,
          rowId: result.row_id,
          text: finalText,
          context: contextValue,
          score: result.score || 0,
          metadata: {
            doc_id: metadata.doc_id || docId,
            title: metadata.title,
            url: metadata.url,
            format: metadata.format,
            visibility: metadata.visibility,
            section: metadata.section,
            chunk_index: metadata.chunk_index,
            snippetSource: chunkText ? 'chunk' : (fallbackText ? 'document' : 'unknown')
          }
        };
      });

      // Если гибридный поиск, добавляем поиск по ключевым словам
      if (searchMethod === this.searchMethods.hybrid) {
        const keywordResults = await this.keywordSearchInDocuments(query, maxResults);
        
        // Объединяем результаты
        const combined = this.combineSearchResults(
          results,
          keywordResults,
          0.7, // вес для семантического
          0.3  // вес для ключевых слов
        );

        combined.sort((a, b) => b.combinedScore - a.combinedScore);
        const topResults = combined.slice(0, maxResults);

        return {
          source: 'documents',
          method: 'hybrid',
          results: topResults.map(r => ({
            ...r,
            score: r.combinedScore
          })),
          count: topResults.length
        };
      }

      // Сортируем по релевантности
      results.sort((a, b) => b.score - a.score);
      const topResults = results.slice(0, maxResults);

      const duration = Date.now() - startTime;
      logger.info(`[MultiSourceSearch] Поиск в документах завершен за ${duration}ms, найдено: ${topResults.length} результатов`);

      return {
        source: 'documents',
        method: searchMethod,
        results: topResults,
        count: topResults.length
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[MultiSourceSearch] Ошибка поиска в документах за ${duration}ms:`, error);
      return {
        source: 'documents',
        method: searchMethod,
        results: [],
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Поиск по ключевым словам в документах
   */
  async keywordSearchInDocuments(query, maxResults) {
    // Для поиска по ключевым словам в документах нужно получить все документы
    // и фильтровать по ключевым словам. Это может быть медленно для больших объемов.
    // В будущем можно добавить индекс для ключевых слов.

    const keywords = this.extractKeywords(query);
    
    // Пока возвращаем пустой результат, т.к. для документов векторный поиск обычно достаточно
    // Для полноценной реализации нужно добавить индекс ключевых слов
    return [];
  }

  /**
   * Объединение результатов из разных источников
   */
  mergeResults(searchResults, options = {}) {
    const { totalMaxResults = 20, searchMethod = 'hybrid' } = options;

    const allResults = [];

    // Собираем все результаты из всех источников
    for (const searchResult of searchResults) {
      if (searchResult.results && searchResult.results.length > 0) {
        allResults.push(...searchResult.results.map(result => ({
          ...result,
          sourceType: searchResult.source,
          sourceId: searchResult.tableId || searchResult.sourceId
        })));
      }
    }

    // Удаляем дубликаты (по rowId и sourceType)
    const uniqueResults = this.removeDuplicates(allResults);

    // Сортируем по релевантности
    uniqueResults.sort((a, b) => {
      // Приоритет: таблицы > документы (можно настроить)
      const sourcePriority = {
        table: 1.0,
        document: 0.9
      };
      
      const priorityA = sourcePriority[a.sourceType] || 0.8;
      const priorityB = sourcePriority[b.sourceType] || 0.8;
      
      // Комбинируем релевантность и приоритет источника
      const scoreA = (a.score || 0) * priorityA;
      const scoreB = (b.score || 0) * priorityB;
      
      return scoreB - scoreA;
    });

    // Берем топ-N результатов
    const topResults = uniqueResults.slice(0, totalMaxResults);

    // Группируем по источникам для статистики
    const sourcesStats = {};
    for (const result of topResults) {
      const sourceKey = `${result.sourceType}_${result.sourceId || 'unknown'}`;
      if (!sourcesStats[sourceKey]) {
        sourcesStats[sourceKey] = {
          source: result.sourceType,
          sourceId: result.sourceId,
          count: 0
        };
      }
      sourcesStats[sourceKey].count++;
    }

    return {
      results: topResults,
      totalCount: topResults.length,
      sourcesCount: searchResults.length,
      sourcesStats: Object.values(sourcesStats),
      searchMethod
    };
  }

  /**
   * Объединение результатов семантического и ключевого поиска
   */
  combineSearchResults(semanticResults, keywordResults, semanticWeight, keywordWeight) {
    const combined = new Map();

    // Нормализуем скоры для семантического поиска
    const normalizedSemantic = this.normalizeScores(semanticResults);
    
    // Нормализуем скоры для поиска по ключевым словам
    const normalizedKeyword = this.normalizeScores(keywordResults);

    // Добавляем результаты семантического поиска
    normalizedSemantic.forEach(result => {
      const key = `${result.source}_${result.sourceId}_${result.rowId || 'unknown'}`;
      combined.set(key, {
        ...result,
        semanticScore: result.score,
        keywordScore: 0,
        combinedScore: result.score * semanticWeight
      });
    });

    // Добавляем результаты поиска по ключевым словам
    normalizedKeyword.forEach(result => {
      const key = `${result.source}_${result.sourceId}_${result.rowId || 'unknown'}`;
      const existing = combined.get(key);
      
      if (existing) {
        // Объединяем скоры
        existing.keywordScore = result.score;
        existing.combinedScore = (existing.semanticScore * semanticWeight) + (result.score * keywordWeight);
      } else {
        // Новый результат
        combined.set(key, {
          ...result,
          semanticScore: 0,
          keywordScore: result.score,
          combinedScore: result.score * keywordWeight
        });
      }
    });

    return Array.from(combined.values());
  }

  /**
   * Нормализация скоров (0-1)
   */
  normalizeScores(results) {
    if (results.length === 0) return [];

    const scores = results.map(r => Math.abs(r.score || 0));
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore || 1;

    return results.map(result => ({
      ...result,
      score: range > 0 ? (Math.abs(result.score || 0) - minScore) / range : 0.5
    }));
  }

  /**
   * Извлечение ключевых слов из запроса
   */
  extractKeywords(query) {
    if (!query || typeof query !== 'string') return [];

    // Удаляем стоп-слова
    const stopWords = new Set([
      'как', 'что', 'где', 'когда', 'почему', 'кто', 'куда', 'откуда',
      'для', 'при', 'над', 'под', 'перед', 'после', 'через',
      'и', 'или', 'но', 'а', 'да', 'нет', 'не',
      'в', 'на', 'с', 'со', 'из', 'к', 'от', 'до', 'по', 'о', 'об', 'обо',
      'это', 'этот', 'эта', 'эти', 'этот', 'тот', 'та', 'те', 'то',
      'быть', 'есть', 'был', 'была', 'было', 'были'
    ]);

    // Разбиваем на слова (сохраняем кириллицу и латиницу)
    const words = query
      .toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/g, ' ') // \u0400-\u04FF - диапазон кириллицы
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return words;
  }

  /**
   * Расчет совпадения по ключевым словам
   */
  calculateKeywordMatch(text, keywords) {
    if (!text || !keywords || keywords.length === 0) return 0;

    const textLower = text.toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    // Возвращаем процент совпадения
    return keywords.length > 0 ? matchCount / keywords.length : 0;
  }


  /**
   * Удаление дубликатов из результатов
   */
  removeDuplicates(results) {
    const seen = new Set();
    const unique = [];

    for (const result of results) {
      const key = `${result.sourceType}_${result.sourceId}_${result.rowId || 'unknown'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }
}

// Создаем singleton экземпляр
const multiSourceSearchService = new MultiSourceSearchService();

module.exports = multiSourceSearchService;

