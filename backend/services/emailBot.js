const nodemailer = require('nodemailer');
const { ChatOllama } = require('@langchain/ollama');
const { PGVectorStore } = require('@langchain/community/vectorstores/pgvector');
const { Pool } = require('pg');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { checkMailServer } = require('../utils/checkMail');
const { sleep, isValidEmail } = require('../utils/helpers');
const { linkIdentity, getUserIdByIdentity } = require('../utils/identity-linker');
require('dotenv').config();

class EmailBotService {
  constructor() {
    this.enabled = false;
    console.log('EmailBotService: Сервис отключен (заглушка)');
  }

  async start() {
    console.log('EmailBotService: Запуск сервиса отключен (заглушка)');
    return false;
  }

  async stop() {
    console.log('EmailBotService: Остановка сервиса отключена (заглушка)');
    return true;
  }

  isEnabled() {
    return this.enabled;
  }
}

// В обработчике команд добавьте код для связывания аккаунтов
async function processCommand(email, command, args) {
  if (command === 'link' && args.length > 0) {
    const ethAddress = args[0];
    
    // Проверяем формат Ethereum-адреса
    if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
      return 'Неверный формат Ethereum-адреса. Используйте формат 0x...';
    }
    
    try {
      // Получаем ID пользователя по Ethereum-адресу
      const userId = await getUserIdByIdentity('ethereum', ethAddress);
      
      if (!userId) {
        return 'Пользователь с таким Ethereum-адресом не найден. Сначала войдите через веб-интерфейс.';
      }
      
      // Связываем Email-аккаунт с пользователем
      const success = await linkIdentity(userId, 'email', email);
      
      if (success) {
        return `Ваш Email-аккаунт успешно связан с Ethereum-адресом ${ethAddress}`;
      } else {
        return 'Не удалось связать аккаунты. Возможно, этот Email-аккаунт уже связан с другим пользователем.';
      }
    } catch (error) {
      console.error('Ошибка при связывании аккаунтов:', error);
      return 'Произошла ошибка при связывании аккаунтов. Попробуйте позже.';
    }
  }
  
  // Обработка других команд...
}

module.exports = EmailBotService; 