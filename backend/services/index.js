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

const { initTelegramBot } = require('./telegram-service');
const emailBot = require('./emailBot');
const telegramBot = require('./telegramBot');
const aiAssistant = require('./ai-assistant');
const {
  initializeVectorStore,
  getVectorStore,
  similaritySearch,
  addDocument,
} = require('./vectorStore');
// ... другие импорты

module.exports = {
  // Telegram
  initTelegramBot,

  // Email
  emailBot,
  sendEmail: emailBot.sendEmail,
  checkEmails: emailBot.checkEmails,

  // Vector Store
  initializeVectorStore,
  getVectorStore,
  similaritySearch,
  addDocument,

  // AI Assistant
  processMessage: aiAssistant.processMessage,
  getUserInfo: aiAssistant.getUserInfo,
  getConversationHistory: aiAssistant.getConversationHistory,

  telegramBot,
  aiAssistant,

  interfaceService: require('./interfaceService'),
};
