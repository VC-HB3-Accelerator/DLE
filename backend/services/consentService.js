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
const logger = require('../utils/logger');

// Маппинг названий документов на типы согласий
const DOCUMENT_CONSENT_MAP = {
  'Политика конфиденциальности': 'privacy_policy',
  'Права субъектов персональных данных и отзыв согласия': 'personal_data',
  'Согласие на использование файлов cookie': 'cookies',
  'Согласие на обработку персональных данных': 'personal_data_processing'
};

/**
 * Проверить согласия пользователя или гостя
 * @param {Object} params - Параметры проверки
 * @param {number|null} params.userId - ID пользователя (если авторизован)
 * @param {string|null} params.walletAddress - Адрес кошелька или guest_ID
 * @returns {Promise<Object>} - Результат проверки с информацией о недостающих согласиях
 */
async function checkConsents({ userId = null, walletAddress = null }) {
  try {
    const requiredConsentTypes = Object.values(DOCUMENT_CONSENT_MAP);
    
    // Строим запрос в зависимости от наличия userId
    let consentCheckQuery;
    let queryParams;
    
    if (userId) {
      // Для авторизованного пользователя
      consentCheckQuery = `
        SELECT consent_type, COUNT(*) as count
        FROM consent_logs
        WHERE status = 'granted'
          AND (user_id = $1 OR wallet_address = $2)
          AND consent_type = ANY($3)
        GROUP BY consent_type
      `;
      queryParams = [userId, walletAddress, requiredConsentTypes];
    } else if (walletAddress) {
      // Для гостя
      consentCheckQuery = `
        SELECT consent_type, COUNT(*) as count
        FROM consent_logs
        WHERE wallet_address = $1
          AND status = 'granted'
          AND consent_type = ANY($2)
        GROUP BY consent_type
      `;
      queryParams = [walletAddress, requiredConsentTypes];
    } else {
      // Если нет ни userId, ни walletAddress - все согласия отсутствуют
      return {
        needsConsent: true,
        missingConsents: requiredConsentTypes,
        grantedConsents: []
      };
    }
    
    const consentResult = await db.getQuery()(consentCheckQuery, queryParams);
    const grantedConsentTypes = consentResult.rows.map(r => r.consent_type);
    const missingConsents = requiredConsentTypes.filter(type => !grantedConsentTypes.includes(type));
    const needsConsent = missingConsents.length > 0;
    
    return {
      needsConsent,
      missingConsents,
      grantedConsents: grantedConsentTypes
    };
  } catch (error) {
    logger.error('[ConsentService] Ошибка проверки согласий:', error);
    // В случае ошибки считаем, что согласия нужны для безопасности
    return {
      needsConsent: true,
      missingConsents: Object.values(DOCUMENT_CONSENT_MAP),
      grantedConsents: []
    };
  }
}

/**
 * Получить список документов для подписания
 * @param {Array<string>} missingConsents - Типы недостающих согласий
 * @returns {Promise<Array>} - Массив документов с информацией
 */
async function getConsentDocuments(missingConsents = []) {
  try {
    // Определяем, какие документы нужно подписать (по недостающим типам согласий)
    const documentsToShow = Object.entries(DOCUMENT_CONSENT_MAP)
      .filter(([title, consentType]) => missingConsents.includes(consentType))
      .map(([title]) => title);
    
    if (documentsToShow.length === 0) {
      return [];
    }
    
    // Получаем список документов для подписания
    const { rows: documents } = await db.getQuery()(`
      SELECT id, title, summary
      FROM admin_pages_simple
      WHERE status = 'published' 
        AND visibility = 'public'
        AND title = ANY($1)
      ORDER BY created_at DESC
    `, [documentsToShow]);
    
    return documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      consentType: DOCUMENT_CONSENT_MAP[doc.title],
      url: `/content/published/${doc.id}`
    }));
  } catch (error) {
    logger.error('[ConsentService] Ошибка получения документов:', error);
    return [];
  }
}

/**
 * Сформировать системное сообщение о необходимости согласия
 * @param {Object} params - Параметры
 * @param {string} params.channel - Канал (web/telegram/email)
 * @param {Array} params.missingConsents - Типы недостающих согласий
 * @param {Array} params.consentDocuments - Документы для подписания
 * @param {string} params.baseUrl - Базовый URL сайта (для формирования ссылок)
 * @returns {Object} - Системное сообщение, отформатированное для канала
 */
function formatConsentMessage({ channel = 'web', missingConsents = [], consentDocuments = [], baseUrl = 'http://localhost:9000' }) {
  const baseMessage = 'Для полноценного использования сервиса необходимо предоставить согласие на обработку персональных данных.';
  const autoConsentMessage = '\n\n⚠️ Внимание: При ответе на это сообщение вы автоматически подтверждаете ознакомление с документами и даете согласие на обработку персональных данных.';
  
  switch (channel) {
    case 'web':
      // Для веб-чата возвращаем структурированные данные
      return {
        content: baseMessage + autoConsentMessage,
        consentRequired: true,
        missingConsents,
        consentDocuments,
        autoConsentOnReply: true, // Флаг для автоматического подписания при ответе
        format: 'structured'
      };
    
    case 'telegram':
      // Для Telegram форматируем как текст с ссылками
      let telegramMessage = `${baseMessage}\n\nДля продолжения работы ознакомьтесь со следующими документами:\n\n`;
      
      consentDocuments.forEach((doc, index) => {
        telegramMessage += `${index + 1}. ${doc.title}\n`;
        if (doc.summary) {
          telegramMessage += `   ${doc.summary}\n`;
        }
        telegramMessage += `   ${baseUrl}${doc.url}\n\n`;
      });
      
      telegramMessage += `⚠️ Внимание: При ответе на это сообщение вы автоматически подтверждаете ознакомление с документами и даете согласие на обработку персональных данных.`;
      
      return {
        content: telegramMessage,
        consentRequired: true,
        missingConsents,
        consentDocuments,
        autoConsentOnReply: true,
        format: 'text'
      };
    
    case 'email':
      // Для email форматируем как HTML
      let emailHtml = `<p>${baseMessage}</p>`;
      emailHtml += '<p>Для продолжения работы ознакомьтесь со следующими документами:</p>';
      emailHtml += '<ul>';
      
      consentDocuments.forEach((doc) => {
        emailHtml += `<li><strong>${doc.title}</strong><br>`;
        if (doc.summary) {
          emailHtml += `${doc.summary}<br>`;
        }
        emailHtml += `<a href="${baseUrl}${doc.url}">Открыть документ</a></li>`;
      });
      
      emailHtml += '</ul>';
      emailHtml += `<p><strong>⚠️ Внимание:</strong> При ответе на это письмо вы автоматически подтверждаете ознакомление с документами и даете согласие на обработку персональных данных.</p>`;
      emailHtml += `<p><a href="${baseUrl}/consent">Также вы можете подписать документы на сайте</a></p>`;
      
      const textContent = baseMessage + '\n\n' + 
        consentDocuments.map(doc => `${doc.title}: ${baseUrl}${doc.url}`).join('\n') +
        '\n\n⚠️ Внимание: При ответе на это письмо вы автоматически подтверждаете ознакомление с документами и даете согласие на обработку персональных данных.';
      
      return {
        content: emailHtml,
        textContent: textContent,
        consentRequired: true,
        missingConsents,
        consentDocuments,
        autoConsentOnReply: true,
        format: 'html'
      };
    
    default:
      return {
        content: baseMessage + autoConsentMessage,
        consentRequired: true,
        missingConsents,
        consentDocuments,
        autoConsentOnReply: true,
        format: 'text'
      };
  }
}

/**
 * Получить полную информацию о согласиях и сформировать системное сообщение
 * @param {Object} params - Параметры
 * @param {number|null} params.userId - ID пользователя
 * @param {string|null} params.walletAddress - Адрес кошелька или guest_ID
 * @param {string} params.channel - Канал (web/telegram/email)
 * @param {string} params.baseUrl - Базовый URL сайта
 * @returns {Promise<Object|null>} - Системное сообщение или null, если согласия есть
 */
async function getConsentSystemMessage({ userId = null, walletAddress = null, channel = 'web', baseUrl = 'http://localhost:9000' }) {
  try {
    // Проверяем согласия
    const consentCheck = await checkConsents({ userId, walletAddress });
    
    if (!consentCheck.needsConsent) {
      return null; // Все согласия есть
    }
    
    // Получаем документы для подписания
    const consentDocuments = await getConsentDocuments(consentCheck.missingConsents);
    
    // Формируем системное сообщение для канала
    return formatConsentMessage({
      channel,
      missingConsents: consentCheck.missingConsents,
      consentDocuments,
      baseUrl
    });
  } catch (error) {
    logger.error('[ConsentService] Ошибка формирования системного сообщения:', error);
    return null;
  }
}

module.exports = {
  checkConsents,
  getConsentDocuments,
  formatConsentMessage,
  getConsentSystemMessage,
  DOCUMENT_CONSENT_MAP
};

