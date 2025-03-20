const { pool } = require('../db');
const nodemailer = require('nodemailer');
const Imap = require('imap');
const simpleParser = require('mailparser').simpleParser;
const { processMessage } = require('./ai-assistant');
const { inspect } = require('util');
const logger = require('../utils/logger');
const { generateVerificationCode, addUserIdentity } = require('../utils/helpers');

// Хранилище кодов подтверждения
const verificationCodes = new Map(); // { email: { code, token, expires } }

// Конфигурация для отправки писем
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: process.env.EMAIL_SMTP_PORT,
  secure: process.env.EMAIL_SMTP_PORT === '465', // true для 465, false для других портов
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Отключение проверки сертификата
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
};

class EmailBotService {
  constructor(user, password) {
    this.user = user;
    this.password = password;
    this.transporter = null;
    this.imap = null;
    this.initialize();
    this.listenForReplies();
  }

  initialize() {
    // Настройка транспорта
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SMTP_HOST,
      port: process.env.EMAIL_SMTP_PORT,
      secure: true,
      auth: {
        user: this.user,
        pass: this.password
      }
    });

    // Настройка IMAP для чтения входящих писем
    this.imap = new Imap({
      user: this.user,
      password: this.password,
      host: process.env.EMAIL_IMAP_HOST,
      port: process.env.EMAIL_IMAP_PORT,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.once('error', (err) => {
      logger.error(`IMAP connection error: ${err.message}`);
    });
  }

  async sendVerificationCode(toEmail, token) {
    try {
      // Генерируем код подтверждения
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Сохраняем код в хранилище
      verificationCodes.set(toEmail.toLowerCase(), {
        code: verificationCode,
        token: token,
        expires: Date.now() + 15 * 60 * 1000 // 15 минут
      });
      
      // Отправляем письмо с кодом
      const mailOptions = {
        from: this.user,
        to: toEmail,
        subject: 'Код подтверждения для DApp for Business',
        text: `Ваш код подтверждения: ${verificationCode}\n\nДля завершения аутентификации, пожалуйста, ответьте на это письмо, указав только полученный код.\n\nКод действителен в течение 15 минут.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Код подтверждения для DApp for Business</h2>
            <p>Ваш код подтверждения:</p>
            <div style="font-size: 24px; font-weight: bold; padding: 15px; background-color: #f5f5f5; border-radius: 5px; text-align: center; margin: 20px 0;">
              ${verificationCode}
            </div>
            <p>Для завершения аутентификации, пожалуйста, ответьте на это письмо, указав только полученный код.</p>
            <p>Код действителен в течение 15 минут.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #777;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
          </div>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent: ${info.messageId}`);
      
      return { success: true, code: verificationCode }; // Код для отладки
    } catch (error) {
      logger.error(`Error sending email: ${error}`);
      return { success: false, error: error.message };
    }
  }

  listenForReplies() {
    // Запускаем проверку почты каждые 30 секунд
    setInterval(() => {
      this.checkEmails();
    }, 30000);
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
                    
                    // Обработка входящего письма
                    try {
                      await this.processEmail(parsed);
                    } catch (e) {
                      logger.error(`Error processing email: ${e.message}`);
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

  async processEmail(email) {
    try {
      const fromEmail = email.from.value[0].address.toLowerCase();
      const subject = email.subject;
      const text = email.text;

      // Ищем код в тексте письма
      const codeMatch = text.match(/\b\d{6}\b/);
      if (!codeMatch) return;
      
      const code = codeMatch[0];
      
      // Проверяем, есть ли код для этого email
      const verificationData = verificationCodes.get(fromEmail);
      
      if (verificationData && verificationData.code === code) {
        // Проверяем срок действия
        if (Date.now() > verificationData.expires) {
          // Код истек
          this.transporter.sendMail({
            from: this.user,
            to: fromEmail,
            subject: 'Срок действия кода истек',
            text: 'Срок действия кода подтверждения истек. Пожалуйста, запросите новый код.'
          });
          verificationCodes.delete(fromEmail);
          return;
        }
        
        // Код верный и актуальный
        const { pool } = require('../db');
        const token = verificationData.token;
        
        // Связываем email с пользователем
        const tokenResult = await pool.query(
          'SELECT user_id FROM email_auth_tokens WHERE token = $1',
          [token]
        );
        
        if (tokenResult.rows.length > 0) {
          const userId = tokenResult.rows[0].user_id;
          
          // Добавляем идентификатор email для пользователя
          await pool.query(
            'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
            'VALUES ($1, $2, $3, true, NOW()) ' +
            'ON CONFLICT (identity_type, identity_value) ' +
            'DO UPDATE SET user_id = $1, verified = true',
            [userId, 'email', fromEmail]
          );
          
          // Отмечаем токен как использованный
          await pool.query(
            'UPDATE email_auth_tokens SET used = true WHERE token = $1',
            [token]
          );
          
          // Отправляем подтверждение
          this.transporter.sendMail({
            from: this.user,
            to: fromEmail,
            subject: 'Аутентификация успешна',
            text: 'Ваш email успешно связан с аккаунтом DApp for Business.'
          });
          
          verificationCodes.delete(fromEmail);
        }
      }
    } catch (error) {
      logger.error(`Error processing email: ${error}`);
    }
  }

  // Оставляем существующие методы
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

  // Метод для проверки кода без IMAP
  verifyCode(email, code) {
    email = email.toLowerCase();
    const data = verificationCodes.get(email);
    
    if (!data) {
      return { success: false, error: 'Код не найден' };
    }
    
    if (Date.now() > data.expires) {
      verificationCodes.delete(email);
      return { success: false, error: 'Срок действия кода истек' };
    }
    
    if (data.code !== code) {
      return { success: false, error: 'Неверный код' };
    }
    
    return { 
      success: true, 
      token: data.token 
    };
  }
  
  // Метод для удаления кода после проверки
  removeCode(email) {
    verificationCodes.delete(email.toLowerCase());
  }
}

// Инициализация процесса аутентификации по email
async function initEmailAuth(email) {
  const code = generateVerificationCode();
  
  // Сохраняем код на 15 минут
  verificationCodes.set(code, {
    email,
    timestamp: Date.now(),
    verified: false
  });

  // Отправляем код на email
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Код подтверждения для HB3 Accelerator',
      text: `Ваш код подтверждения: ${code}\n\nВведите его на сайте для завершения аутентификации.`,
      html: `
        <h2>Код подтверждения для HB3 Accelerator</h2>
        <p>Ваш код подтверждения: <strong>${code}</strong></p>
        <p>Введите его на сайте для завершения аутентификации.</p>
      `
    });

    logger.info(`Verification code sent to email: ${email}`);
    return { success: true };
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

// Проверка кода подтверждения
async function verifyEmailCode(code, userId) {
  const verification = verificationCodes.get(code);

  if (!verification) {
    logger.warn(`Invalid verification code attempt: ${code}`);
    throw new Error('Неверный код');
  }

  if (Date.now() - verification.timestamp > 15 * 60 * 1000) {
    verificationCodes.delete(code);
    logger.warn(`Expired verification code: ${code}`);
    throw new Error('Код устарел');
  }

  try {
    // Сохраняем связь пользователя с email
    const success = await addUserIdentity(
      userId,
      'email',
      verification.email
    );

    if (success) {
      verificationCodes.delete(code);
      logger.info(`User ${userId} successfully linked email ${verification.email}`);
      return { success: true };
    } else {
      throw new Error('Этот email уже привязан к другому пользователю');
    }
  } catch (error) {
    logger.error('Error saving email identity:', error);
    throw error;
  }
}

// Экспортируем класс и хранилище кодов
module.exports = {
  EmailBotService,
  verificationCodes,
  initEmailAuth,
  verifyEmailCode
};
