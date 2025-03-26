const { pool } = require('../db');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const { processMessage } = require('./ai-assistant');
const { inspect } = require('util');
const logger = require('../utils/logger');
const verificationService = require('./verification-service');

// Конфигурация для отправки писем
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  secure: process.env.EMAIL_SMTP_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Конфигурация для получения писем
const imapConfig = {
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  host: process.env.EMAIL_IMAP_HOST,
  port: process.env.EMAIL_IMAP_PORT,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  keepalive: { 
    interval: 10000,       // Проверка соединения каждые 10 секунд
    idleInterval: 300000,  // Сброс соединения через 5 минут простоя
    forceNoop: true        // Принудительная отправка NOOP для поддержания соединения
  }
};

class EmailBotService {
  constructor(user, password) {
    this.user = user;
    this.password = password;
    this.transporter = transporter;
    this.imap = new Imap(imapConfig);
    this.initialize();
    this.listenForReplies();
  }

  initialize() {
    this.imap.once('error', (err) => {
      logger.error(`IMAP connection error: ${err.message}`);
      // Пробуем переподключиться через 1 минуту при ошибке
      setTimeout(() => {
        try {
          if (this.imap.state !== 'connected') {
            this.imap = new Imap(imapConfig);
            this.initialize();
          }
        } catch (e) {
          logger.error(`Error reconnecting IMAP: ${e.message}`);
        }
      }, 60000);
    });
  }

  async sendVerificationCode(toEmail, userId) {
    try {
      // Создаем код через сервис верификации
      const code = await verificationService.createVerificationCode(
        'email',
        toEmail.toLowerCase(),
        userId
      );
      
      // Отправляем письмо с кодом
      const mailOptions = {
        from: this.user,
        to: toEmail,
        subject: 'Код подтверждения для DApp for Business',
        text: `Ваш код подтверждения: ${code}\n\nДля завершения аутентификации, пожалуйста, введите этот код на сайте.\n\nКод действителен в течение 15 минут.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Код подтверждения для DApp for Business</h2>
            <p>Ваш код подтверждения:</p>
            <div style="font-size: 24px; font-weight: bold; padding: 15px; background-color: #f5f5f5; border-radius: 5px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>Для завершения аутентификации, пожалуйста, введите этот код в форме на сайте.</p>
            <p>Код действителен в течение 15 минут.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #777;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      
      return { success: true, code };
    } catch (error) {
      logger.error(`Error sending email: ${error}`);
      return { success: false, error: error.message };
    }
  }

  listenForReplies() {
    // Запускаем проверку почты каждые 60 секунд
    setInterval(() => {
      this.checkEmails();
    }, 60000);
  }

  checkEmails() {
    try {
      // Добавляем обработчики ошибок
      this.imap.once('error', (err) => {
        logger.error(`IMAP connection error during check: ${err.message}`);
        // Пытаемся закрыть соединение при ошибке
        try {
          this.imap.end();
        } catch (e) {
          // Игнорируем ошибки при закрытии
        }
      });

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            logger.error(`Error opening inbox: ${err}`);
            this.imap.end();
            return;
          }
          
          // Ищем непрочитанные письма
          this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              logger.error(`Error searching messages: ${err}`);
              this.imap.end();
              return;
            }
            
            if (!results || results.length === 0) {
              logger.info('No new messages found');
              this.imap.end();
              return;
            }
            
            // Защищаемся от пустых результатов
            try {
              const f = this.imap.fetch(results, { bodies: '' });
              
              f.on('message', (msg, seqno) => {
                msg.on('body', (stream, info) => {
                  simpleParser(stream, async (err, parsed) => {
                    if (err) {
                      logger.error(`Error parsing message: ${err}`);
                      return;
                    }
                    
                    // Обработка входящего письма для Ollama
                    try {
                      // Проверяем, что это действительно письмо (защита от ошибок)
                      if (parsed && parsed.text && parsed.from && parsed.from.value && 
                          parsed.from.value.length > 0 && parsed.from.value[0].address) {
                          
                        const fromEmail = parsed.from.value[0].address.toLowerCase();
                        const subject = parsed.subject || '';
                        const text = parsed.text || '';
                        
                        // Передаем письмо в Ollama для обработки
                        await this.processOllamaEmail(fromEmail, subject, text);
                      }
                    } catch (e) {
                      logger.error(`Error processing email for Ollama: ${e.message}`);
                    }
                  });
                });
              });
              
              f.once('error', (err) => {
                logger.error(`Fetch error: ${err}`);
              });
              
              f.once('end', () => {
                try {
                  this.imap.end();
                } catch (e) {
                  logger.error(`Error ending IMAP connection: ${e.message}`);
                }
              });
            } catch (e) {
              logger.error(`Error fetching messages: ${e.message}`);
              try {
                this.imap.end();
              } catch (e) {
                // Игнорируем ошибки при закрытии
              }
            }
          });
        });
      });
      
      this.imap.connect();
    } catch (error) {
      logger.error(`Global error checking emails: ${error.message}`);
      // Обеспечиваем корректное завершение IMAP сессии
      try {
        this.imap.end();
      } catch (e) {
        // Игнорируем ошибки при закрытии
      }
    }
  }

  // Метод для обработки письма с помощью Ollama
  async processOllamaEmail(fromEmail, subject, text) {
    try {
      // Проверяем, есть ли текст для обработки
      if (!text || text.trim() === '') {
        logger.info(`Empty message from ${fromEmail}, skipping Ollama processing`);
        return;
      }
      
      logger.info(`Processing message from ${fromEmail} for Ollama`);
      
      // Получаем ответ от Ollama
      const response = await processMessage(text);
      
      if (response) {
        // Отправляем ответ обратно пользователю
        await this.transporter.sendMail({
          from: this.user,
          to: fromEmail,
          subject: `Re: ${subject}`,
          text: response
        });
        
        logger.info(`Ollama response sent to ${fromEmail}`);
      }
    } catch (error) {
      logger.error(`Error in Ollama email processing: ${error}`);
      
      // Отправляем сообщение об ошибке пользователю
      try {
        await this.transporter.sendMail({
          from: this.user,
          to: fromEmail,
          subject: 'Error processing your request',
          text: 'Sorry, we encountered an error processing your message. Please try again later.'
        });
      } catch (e) {
        logger.error(`Error sending error notification: ${e}`);
      }
    }
  }

  // Метод для проверки кода без IMAP
  async verifyCode(email, code) {
    return await verificationService.verifyCode(code, 'email', email.toLowerCase());
  }

  // Оставляем существующий метод для отправки электронных писем
  async sendEmail(to, subject, text) {
    try {
      const mailOptions = {
        from: this.user,
        to,
        subject,
        text
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email: ${error}`);
      return false;
    }
  }
}

module.exports = {
  EmailBotService,
  transporter
};
