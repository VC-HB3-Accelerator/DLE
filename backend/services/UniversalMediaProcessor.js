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

const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Универсальный процессор медиа-контента для всех каналов связи
 * Обрабатывает текст, аудио, видео, файлы и их комбинации
 */
class UniversalMediaProcessor {
  constructor() {
    // Реальные поддерживаемые форматы из frontend/src/components/ChatInterface.vue
    this.supportedAudioFormats = ['.mp3', '.wav'];
    this.supportedVideoFormats = ['.mp4', '.avi'];
    this.supportedImageFormats = ['.jpg', '.jpeg', '.png', '.gif'];
    this.supportedDocumentFormats = ['.txt', '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp'];
    this.supportedArchiveFormats = ['.zip', '.rar', '.7z'];
    
    // Реальные ограничения размеров из кода:
    // - uploads.js: 5MB для изображений
    // - emailBot.js: 10MB для вложений
    // - frontend: без ограничений (но браузер обычно ограничивает)
    this.maxFileSize = 10 * 1024 * 1024; // 10MB (как в emailBot)
    this.maxImageSize = 5 * 1024 * 1024; // 5MB (как в uploads.js)
    
    this.uploadPath = path.join(__dirname, '../uploads');
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'audio'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'video'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'documents'), { recursive: true });
      await fs.mkdir(path.join(this.uploadPath, 'archives'), { recursive: true });
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка создания директорий:', error);
    }
  }

  /**
   * Определяет тип медиа по расширению файла и MIME-типу
   */
  getMediaType(filename, mimeType = null) {
    const ext = path.extname(filename).toLowerCase();
    
    // Сначала проверяем по расширению
    if (this.supportedAudioFormats.includes(ext)) return 'audio';
    if (this.supportedVideoFormats.includes(ext)) return 'video';
    if (this.supportedImageFormats.includes(ext)) return 'image';
    if (this.supportedDocumentFormats.includes(ext)) return 'document';
    if (this.supportedArchiveFormats.includes(ext)) return 'archive';
    
    // Если есть MIME-тип, проверяем по нему
    if (mimeType) {
      const mime = mimeType.toLowerCase();
      
      if (mime.startsWith('audio/')) return 'audio';
      if (mime.startsWith('video/')) return 'video';
      if (mime.startsWith('image/')) return 'image';
      if (mime.startsWith('application/')) {
        // Документы и архивы
        if (mime.includes('pdf') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation')) {
          return 'document';
        }
        if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) {
          return 'archive';
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * Генерирует уникальное имя файла
   */
  generateUniqueFilename(originalName, mediaType) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${mediaType}_${timestamp}_${random}${ext}`;
  }

  /**
   * Обрабатывает текстовое сообщение
   */
  async processText(text, metadata = {}) {
    return {
      type: 'text',
      content: text,
      processed: true,
      metadata: {
        language: metadata.language || 'ru',
        length: text.length,
        ...metadata
      }
    };
  }

  /**
   * Обрабатывает аудио файл
   */
  async processAudio(audioData, filename, metadata = {}) {
    try {
      const mediaType = 'audio';
      const uniqueFilename = this.generateUniqueFilename(filename, mediaType);
      const filePath = path.join(this.uploadPath, mediaType, uniqueFilename);
      
      // Сохраняем файл
      await fs.writeFile(filePath, audioData);
      
      // Получаем информацию о файле
      const stats = await fs.stat(filePath);
      
      return {
        type: 'audio',
        content: `[Аудио сообщение: ${filename}]`,
        processed: true,
        file: {
          originalName: filename,
          savedName: uniqueFilename,
          path: filePath,
          size: stats.size,
          url: `/uploads/audio/${uniqueFilename}`
        },
        metadata: {
          duration: metadata.duration || null,
          format: path.extname(filename).toLowerCase(),
          ...metadata
        }
      };
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка обработки аудио:', error);
      return {
        type: 'audio',
        content: `[Ошибка обработки аудио: ${filename}]`,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает видео файл
   */
  async processVideo(videoData, filename, metadata = {}) {
    try {
      const mediaType = 'video';
      const uniqueFilename = this.generateUniqueFilename(filename, mediaType);
      const filePath = path.join(this.uploadPath, mediaType, uniqueFilename);
      
      // Проверяем размер файла (видео до 10MB)
      if (videoData.length > this.maxFileSize) {
        throw new Error(`Видео файл слишком большой: ${(videoData.length / 1024 / 1024).toFixed(2)}MB. Максимум: ${this.maxFileSize / 1024 / 1024}MB`);
      }
      
      await fs.writeFile(filePath, videoData);
      const stats = await fs.stat(filePath);
      
      return {
        type: 'video',
        content: `[Видео сообщение: ${filename}]`,
        processed: true,
        file: {
          originalName: filename,
          savedName: uniqueFilename,
          path: filePath,
          size: stats.size,
          url: `/uploads/video/${uniqueFilename}`
        },
        metadata: {
          duration: metadata.duration || null,
          format: path.extname(filename).toLowerCase(),
          ...metadata
        }
      };
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка обработки видео:', error);
      return {
        type: 'video',
        content: `[Ошибка обработки видео: ${filename}]`,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает изображение
   */
  async processImage(imageData, filename, metadata = {}) {
    try {
      const mediaType = 'image';
      const uniqueFilename = this.generateUniqueFilename(filename, mediaType);
      const filePath = path.join(this.uploadPath, mediaType, uniqueFilename);
      
      // Проверяем размер изображения (до 5MB)
      if (imageData.length > this.maxImageSize) {
        throw new Error(`Изображение слишком большое: ${(imageData.length / 1024 / 1024).toFixed(2)}MB. Максимум: ${this.maxImageSize / 1024 / 1024}MB`);
      }
      
      await fs.writeFile(filePath, imageData);
      const stats = await fs.stat(filePath);
      
      return {
        type: 'image',
        content: `[Изображение: ${filename}]`,
        processed: true,
        file: {
          originalName: filename,
          savedName: uniqueFilename,
          path: filePath,
          size: stats.size,
          url: `/uploads/images/${uniqueFilename}`
        },
        metadata: {
          width: metadata.width || null,
          height: metadata.height || null,
          format: path.extname(filename).toLowerCase(),
          ...metadata
        }
      };
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка обработки изображения:', error);
      return {
        type: 'image',
        content: `[Ошибка обработки изображения: ${filename}]`,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает документ
   */
  async processDocument(docData, filename, metadata = {}) {
    try {
      const mediaType = 'document';
      const uniqueFilename = this.generateUniqueFilename(filename, mediaType);
      const filePath = path.join(this.uploadPath, mediaType, uniqueFilename);
      
      await fs.writeFile(filePath, docData);
      const stats = await fs.stat(filePath);
      
      return {
        type: 'document',
        content: `[Документ: ${filename}]`,
        processed: true,
        file: {
          originalName: filename,
          savedName: uniqueFilename,
          path: filePath,
          size: stats.size,
          url: `/uploads/documents/${uniqueFilename}`
        },
        metadata: {
          format: path.extname(filename).toLowerCase(),
          ...metadata
        }
      };
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка обработки документа:', error);
      return {
        type: 'document',
        content: `[Ошибка обработки документа: ${filename}]`,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает файл (автоопределение типа)
   */
  async processFile(fileData, filename, metadata = {}) {
    const mediaType = this.getMediaType(filename, metadata.mimeType);
    
    switch (mediaType) {
      case 'audio':
        return await this.processAudio(fileData, filename, metadata);
      case 'video':
        return await this.processVideo(fileData, filename, metadata);
      case 'image':
        return await this.processImage(fileData, filename, metadata);
      case 'document':
        return await this.processDocument(fileData, filename, metadata);
      case 'archive':
        return await this.processArchive(fileData, filename, metadata);
      default:
        return {
          type: 'file',
          content: `[Неизвестный файл: ${filename}]`,
          processed: false,
          error: 'Неподдерживаемый формат файла'
        };
    }
  }

  /**
   * Обрабатывает архив
   */
  async processArchive(archiveData, filename, metadata = {}) {
    try {
      const mediaType = 'archive';
      const uniqueFilename = this.generateUniqueFilename(filename, mediaType);
      const filePath = path.join(this.uploadPath, mediaType, uniqueFilename);
      
      // Проверяем размер архива (до 10MB)
      if (archiveData.length > this.maxFileSize) {
        throw new Error(`Архив слишком большой: ${(archiveData.length / 1024 / 1024).toFixed(2)}MB. Максимум: ${this.maxFileSize / 1024 / 1024}MB`);
      }
      
      await fs.writeFile(filePath, archiveData);
      const stats = await fs.stat(filePath);
      
      return {
        type: 'archive',
        content: `[Архив: ${filename}]`,
        processed: true,
        file: {
          originalName: filename,
          savedName: uniqueFilename,
          path: filePath,
          size: stats.size,
          url: `/uploads/archives/${uniqueFilename}`
        },
        metadata: {
          format: path.extname(filename).toLowerCase(),
          ...metadata
        }
      };
    } catch (error) {
      logger.error('[UniversalMediaProcessor] Ошибка обработки архива:', error);
      return {
        type: 'archive',
        content: `[Ошибка обработки архива: ${filename}]`,
        processed: false,
        error: error.message
      };
    }
  }

  /**
   * Обрабатывает комбинированный контент (текст + медиа)
   */
  async processCombinedContent(contentData) {
    const results = [];
    
    // Обрабатываем текст если есть
    if (contentData.text && contentData.text.trim()) {
      const textResult = await this.processText(contentData.text, contentData.textMetadata);
      results.push(textResult);
    }
    
    // Обрабатываем файлы если есть
    if (contentData.files && contentData.files.length > 0) {
      for (const file of contentData.files) {
        const fileResult = await this.processFile(file.data, file.filename, file.metadata);
        results.push(fileResult);
      }
    }
    
    // Обрабатываем аудио если есть
    if (contentData.audio) {
      const audioResult = await this.processAudio(
        contentData.audio.data, 
        contentData.audio.filename, 
        contentData.audio.metadata
      );
      results.push(audioResult);
    }
    
    // Обрабатываем видео если есть
    if (contentData.video) {
      const videoResult = await this.processVideo(
        contentData.video.data, 
        contentData.video.filename, 
        contentData.video.metadata
      );
      results.push(videoResult);
    }
    
    return {
      type: 'combined',
      parts: results,
      processed: results.every(r => r.processed),
      summary: this.generateContentSummary(results)
    };
  }

  /**
   * Генерирует краткое описание комбинированного контента
   */
  generateContentSummary(parts) {
    const summary = [];
    
    parts.forEach(part => {
      switch (part.type) {
        case 'text':
          summary.push(`Текст (${part.metadata.length} символов)`);
          break;
        case 'audio':
          summary.push(`Аудио: ${part.file.originalName}`);
          break;
        case 'video':
          summary.push(`Видео: ${part.file.originalName}`);
          break;
        case 'image':
          summary.push(`Изображение: ${part.file.originalName}`);
          break;
        case 'document':
          summary.push(`Документ: ${part.file.originalName}`);
          break;
        case 'archive':
          summary.push(`Архив: ${part.file.originalName}`);
          break;
      }
    });
    
    return summary.join(', ');
  }

  /**
   * Создает структуру для сохранения в БД
   */
  createDatabaseRecord(processedContent, identifier, channel) {
    const baseRecord = {
      identifier,
      channel,
      timestamp: new Date(),
      processed: processedContent.processed
    };

    if (processedContent.type === 'text') {
      return {
        ...baseRecord,
        content: processedContent.content,
        content_type: 'text',
        attachments: null,
        metadata: processedContent.metadata
      };
    }

    if (processedContent.type === 'combined') {
      // Для комбинированного контента сохраняем как JSON
      return {
        ...baseRecord,
        content: processedContent.summary,
        content_type: 'combined',
        attachments: JSON.stringify(processedContent.parts),
        metadata: {
          partsCount: processedContent.parts.length,
          hasText: processedContent.parts.some(p => p.type === 'text'),
          hasMedia: processedContent.parts.some(p => p.type !== 'text')
        }
      };
    }

    // Для отдельных медиа файлов
    return {
      ...baseRecord,
      content: processedContent.content,
      content_type: processedContent.type,
      attachments: JSON.stringify(processedContent.file),
      metadata: processedContent.metadata
    };
  }

  /**
   * Восстанавливает структуру из БД
   */
  restoreFromDatabase(dbRecord) {
    if (dbRecord.content_type === 'text') {
      return {
        type: 'text',
        content: dbRecord.content,
        metadata: dbRecord.metadata
      };
    }

    if (dbRecord.content_type === 'combined') {
      return {
        type: 'combined',
        parts: JSON.parse(dbRecord.attachments || '[]'),
        summary: dbRecord.content,
        metadata: dbRecord.metadata
      };
    }

    // Для медиа файлов
    return {
      type: dbRecord.content_type,
      content: dbRecord.content,
      file: JSON.parse(dbRecord.attachments || '{}'),
      metadata: dbRecord.metadata
    };
  }
}

module.exports = new UniversalMediaProcessor();
