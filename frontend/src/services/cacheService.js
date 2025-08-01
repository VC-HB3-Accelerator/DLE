/**
 * Глобальный сервис кэширования для оптимизации запросов
 */

class CacheService {
  constructor() {
    this.tableCache = new Map();
    this.relationsCache = new Map();
    this.tableCacheTimeout = 30000; // 30 секунд для таблиц
    this.relationsCacheTimeout = 10000; // 10 секунд для relations
  }

  // Кэширование данных таблиц
  getTableData(tableId, columnId = 'default') {
    const cacheKey = `${tableId}_${columnId}`;
    const cached = this.tableCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.tableCacheTimeout) {
      // console.log(`[CacheService] ✅ КЭШ ПОПАДАНИЕ для таблицы ${tableId} (${cacheKey})`);
      return cached.data;
    }
    
    if (cached) {
      // console.log(`[CacheService] ⏰ Кэш истек для таблицы ${tableId} (${cacheKey})`);
    } else {
      // console.log(`[CacheService] ❌ Кэш отсутствует для таблицы ${tableId} (${cacheKey})`);
    }
    
    return null;
  }

  setTableData(tableId, columnId, data) {
    const cacheKey = `${tableId}_${columnId}`;
    this.tableCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    // console.log(`[CacheService] Сохранены данные таблицы ${tableId} в кэш`);
  }

  // Кэширование relations
  getRelationsData(rowId, columnId) {
    const cacheKey = `${rowId}_${columnId}`;
    const cached = this.relationsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.relationsCacheTimeout) {
      // console.log(`[CacheService] Используем кэшированные relations для строки ${rowId}`);
      return cached.data;
    }
    
    return null;
  }

  setRelationsData(rowId, columnId, data) {
    const cacheKey = `${rowId}_${columnId}`;
    this.relationsCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    // console.log(`[CacheService] Сохранены relations строки ${rowId} в кэш`);
  }

  // Очистка кэша
  clearTableCache(tableId = null) {
    if (tableId) {
      // Очищаем кэш для конкретной таблицы
      for (const [key] of this.tableCache) {
        if (key.startsWith(`${tableId}_`)) {
          this.tableCache.delete(key);
        }
      }
      // console.log(`[CacheService] Очищен кэш таблицы ${tableId}`);
    } else {
      // Очищаем весь кэш таблиц
      this.tableCache.clear();
      // console.log('[CacheService] Очищен весь кэш таблиц');
    }
  }

  clearRelationsCache(rowId = null) {
    if (rowId) {
      // Очищаем кэш для конкретной строки
      for (const [key] of this.relationsCache) {
        if (key.startsWith(`${rowId}_`)) {
          this.relationsCache.delete(key);
        }
      }
      // console.log(`[CacheService] Очищен кэш relations строки ${rowId}`);
    } else {
      // Очищаем весь кэш relations
      this.relationsCache.clear();
      // console.log('[CacheService] Очищен весь кэш relations');
    }
  }

  // Полная очистка всех кэшей
  clearAll() {
    this.tableCache.clear();
    this.relationsCache.clear();
    // console.log('[CacheService] Очищены все кэши');
  }

  // Получение статистики кэша
  getStats() {
    return {
      tableCacheSize: this.tableCache.size,
      relationsCacheSize: this.relationsCache.size,
      tableCacheKeys: Array.from(this.tableCache.keys()),
      relationsCacheKeys: Array.from(this.relationsCache.keys())
    };
  }
}

// Создаем единственный экземпляр
const cacheService = new CacheService();

export default cacheService; 