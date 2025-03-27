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
const { processMessage, getUserInfo, getConversationHistory } = require('./ai-assistant');
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
  processMessage,
  getUserInfo,
  getConversationHistory,

  telegramBot,
  aiAssistant
};
