const { pool } = require('../db');
const nodemailer = require('nodemailer');
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

class EmailBotService {
  constructor(user, password) {
    this.user = user;
    this.password = password;
    this.transporter = transporter;
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
