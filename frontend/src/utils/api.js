/**
 * Безопасный fetch с проверкой JSON-ответа
 * @param {string} url - URL для запроса
 * @param {object} options - Опции для fetch
 * @returns {Promise<any>} - Распарсенный JSON или ошибка
 */
export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Проверяем статус ответа
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Проверяем Content-Type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Если это HTML, значит, запрос ушёл не на API
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Сервер вернул HTML вместо JSON. Проверьте путь к API.');
      }
      throw new Error(`Неожиданный Content-Type: ${contentType}`);
    }
    
    // Парсим JSON
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Обёртка для GET-запросов
 * @param {string} url - URL для запроса
 * @returns {Promise<any>} - Распарсенный JSON
 */
export async function apiGet(url) {
  return safeFetch(url);
}

/**
 * Обёртка для POST-запросов
 * @param {string} url - URL для запроса
 * @param {object} data - Данные для отправки
 * @returns {Promise<any>} - Распарсенный JSON
 */
export async function apiPost(url, data) {
  return safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Обёртка для PUT-запросов
 * @param {string} url - URL для запроса
 * @param {object} data - Данные для отправки
 * @returns {Promise<any>} - Распарсенный JSON
 */
export async function apiPut(url, data) {
  return safeFetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

/**
 * Обёртка для DELETE-запросов
 * @param {string} url - URL для запроса
 * @returns {Promise<any>} - Распарсенный JSON
 */
export async function apiDelete(url) {
  return safeFetch(url, {
    method: 'DELETE',
  });
} 