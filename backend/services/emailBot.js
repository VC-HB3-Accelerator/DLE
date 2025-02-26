const nodemailer = require('nodemailer');
const { ChatOllama } = require('@langchain/ollama');
const { PGVectorStore } = require('@langchain/community/vectorstores/pgvector');
const { Pool } = require('pg');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { checkMailServer } = require('../utils/checkMail');
const { sleep, isValidEmail } = require('../utils/helpers');
require('dotenv').config();

class EmailBotService {
  constructor(vectorStore) {
    if (!vectorStore) {
      throw new Error('Vector store is required');
    }
    
    console.log('Инициализация Email бота...');
    console.log('Проверяем настройки почты:', {
      smtp: {
        host: process.env.EMAIL_SMTP_HOST,
        port: process.env.EMAIL_SMTP_PORT
      },
      imap: {
        host: process.env.EMAIL_IMAP_HOST,
        port: process.env.EMAIL_IMAP_PORT
      }
    });
    
    // Инициализация базы данных
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    this.vectorStore = vectorStore;
    
    // Инициализация LLM
    this.chat = new ChatOllama({
      model: 'mistral',
      baseUrl: 'http://localhost:11434'
    });

    // Настройка почтового клиента для отправки
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'HIGH:MEDIUM:!aNULL:!eNULL:!NULL:!DH:!EDH:!EXP:!LOW:!SSLv2:!MD5'
      },
      debug: true,
      logger: true
    });

    // Проверяем подключение к SMTP
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Ошибка подключения к SMTP:', {
          name: error.name,
          message: error.message,
          code: error.code,
          command: error.command,
          stack: error.stack
        });
        setTimeout(() => this.initSMTP(), 30000);
      }
    });

    // Настройка IMAP для получения писем
    const imapConfig = {
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_IMAP_HOST,
      port: process.env.EMAIL_IMAP_PORT,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      keepalive: true,
      authTimeout: 30000,
      connTimeout: 30000
    }
    this.imap = new Imap(imapConfig);

    // Добавляем обработчик для всех событий IMAP
    this.imap.on('*', function(event, data) {
      console.log('IMAP Event:', event, data);
    });

    // Проверяем MX записи
    const domain = process.env.EMAIL_USER ? process.env.EMAIL_USER.split('@')[1] : '';
    if (domain) {
      checkMailServer(domain).then(records => {
        if (!records) {
          console.error('Не удалось найти MX записи для домена');
        }
      });
    } else {
      console.error('EMAIL_USER не настроен в .env файле');
    }

    this.isRunning = false;
    this.initSMTP();
    this.initIMAP();
    console.log('Email bot service initialized');
  }

  async initSMTP() {
    try {
      console.log('Попытка подключения к SMTP...');
      await this.transporter.verify();
      console.log('SMTP сервер готов к отправке сообщений');
    } catch (error) {
      console.error('Ошибка подключения к SMTP:', {
        name: error.name,
        message: error.message,
        code: error.code,
        command: error.command,
        stack: error.stack
      });
    }
  }

  async initIMAP() {
    try {
      await this.initEmailListener();
      console.log('IMAP подключение установлено');
    } catch (error) {
      console.error('Ошибка инициализации IMAP:', error);
    }
  }

  async initEmailListener() {
    try {
      this.imap.on('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) throw err;
          
          // Слушаем новые письма
          this.imap.on('mail', () => {
            this.checkNewEmails();
          });
        });
      });

      this.imap.on('error', (err) => {
        console.log('IMAP ошибка:', err);
        if (err.source === 'timeout-auth') {
          setTimeout(() => {
            console.log('Попытка переподключения к IMAP...');
            this.imap.connect();
          }, 5000);
        }
      });

      this.imap.connect();
    } catch (error) {
      console.error('Ошибка при инициализации IMAP:', error);
    }
  }

  async processEmail(message) {
    try {
      // Очищаем и валидируем email адрес
      const cleanEmail = message.from.replace(/[<>]/g, '').trim();
      if (!isValidEmail(cleanEmail)) {
        console.log('Некорректный email адрес:', message.from);
        return;
      }
      
      // Проверяем, не является ли отправитель no-reply адресом
      if (cleanEmail.toLowerCase().includes('no-reply') || 
          cleanEmail.toLowerCase().includes('noreply')) {
        console.log('Пропускаем письмо от no-reply адреса:', cleanEmail);
        return;
      }

      // Проверяем валидность домена получателя
      const domain = cleanEmail.split('@')[1];
      try {
        console.log(`Проверяем MX записи для домена ${domain}...`);
        const records = await checkMailServer(domain);
        if (!records || records.length === 0) {
          console.log('Пропускаем письмо - домен не найден:', domain);
          return;
        }
        console.log('Найдены MX записи:', records);
      } catch (err) {
        console.error('Ошибка при проверке MX записей:', err);
        return;
      }

      // Получаем ответ от Ollama
      const result = await this.chat.invoke(message.text);
      
      // Отправляем ответ
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cleanEmail,
        subject: `Re: ${message.subject}`,
        text: result.content
      });

      console.log('Ответ отправлен:', {
        to: cleanEmail,
        subject: message.subject
      });
    } catch (error) {
      console.error('Ошибка при обработке email:', error);
    }
  }

  async checkNewEmails() {
    try {
      const messages = await new Promise((resolve, reject) => {
        this.imap.search(['UNSEEN'], (err, results) => {
          if (err) reject(err);
          
          if (!results || !results.length) {
            resolve([]);
            return;
          }

          const fetch = this.imap.fetch(results, {
            bodies: '',
            markSeen: true
          });

          const messages = [];

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                messages.push({
                  from: buffer.match(/From: (.*)/i)?.[1],
                  subject: buffer.match(/Subject: (.*)/i)?.[1],
                  text: buffer.split('\n\n').slice(1).join('\n\n')
                });
              });
            });
          });

          fetch.once('error', reject);
          fetch.once('end', () => resolve(messages));
        });
      });

      // Добавляем задержку между обработкой писем
      for (const message of messages) {
        await this.processEmail(message);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 секунда между письмами
      }
    } catch (error) {
      console.error('Ошибка при проверке новых писем:', error);
    }
  }

  async stop() {
    if (this.isRunning) {
      console.log('Останавливаем Email бота...');
      
      // Закрываем SMTP соединение
      if (this.transporter) {
        await this.transporter.close();
      }
      
      // Закрываем IMAP соединение
      if (this.imap) {
        this.imap.end();
      }
      
      this.isRunning = false;
      console.log('Email бот остановлен');
    }
  }
}

module.exports = EmailBotService; 