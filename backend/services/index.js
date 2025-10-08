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

const botManager = require('./botManager');
const botsSettings = require('./botsSettings');
const aiAssistant = require('./ai-assistant');
const {
  initializeVectorStore,
  getVectorStore,
  similaritySearch,
  addDocument,
} = require('./vectorStore');

module.exports = {
  // Bot Manager (новая архитектура)
  botManager,
  botsSettings,

  // Vector Store
  initializeVectorStore,
  getVectorStore,
  similaritySearch,
  addDocument,

  // AI Assistant
  aiAssistant,
  processMessage: aiAssistant.processMessage,
  getUserInfo: aiAssistant.getUserInfo,
  getConversationHistory: aiAssistant.getConversationHistory,

  interfaceService: require('./interfaceService'),
};
