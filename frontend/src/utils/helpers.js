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

/**
 * Генерирует уникальный ID
 * @returns {string} - Уникальный ID
 */
export const generateUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Сокращает адрес кошелька
 * @param {string} address - Адрес кошелька
 * @returns {string} - Сокращенный адрес
 */
export const truncateAddress = (address) => {
  if (!address) return '';
  // Добавим проверку на длину, чтобы не было ошибок
  if (address.length <= 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/**
 * Форматирует время в человекочитаемый вид
 * @param {string | number | Date} timestamp - Метка времени
 * @returns {string} - Форматированное время
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp for formatTime:', timestamp);
      return '';
    }
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting time:', error, timestamp);
    return '';
  }
}; 