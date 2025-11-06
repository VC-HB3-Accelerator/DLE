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

const ollamaConfig = require('./ollamaConfig');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Сервис для интеллектуальной разбивки документов на смысловые части (Semantic Chunking)
 */
class SemanticChunkingService {
  constructor() {
    this.defaultMaxChunkSize = 1000; // Максимальный размер чанка в символах
    this.defaultOverlap = 200; // Перекрытие между чанками в символах
    this.minChunkSize = 100; // Минимальный размер чанка
  }

  /**
   * Разбить документ на смысловые чанки
   * @param {string} text - Текст документа
   * @param {Object} options - Опции разбивки
   * @param {number} options.maxChunkSize - Максимальный размер чанка
   * @param {number} options.overlap - Перекрытие между чанками
   * @param {boolean} options.useLLM - Использовать LLM для определения структуры
   * @returns {Promise<Array>} Массив чанков с метаданными
   */
  async chunkDocument(text, options = {}) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    const {
      maxChunkSize = this.defaultMaxChunkSize,
      overlap = this.defaultOverlap,
      useLLM = true
    } = options;

    logger.info(`[SemanticChunking] Разбивка документа: длина=${text.length}, maxChunkSize=${maxChunkSize}, useLLM=${useLLM}`);

    try {
      // Если документ небольшой, возвращаем как один чанк
      if (text.length <= maxChunkSize) {
        return [{
          text: text.trim(),
          index: 0,
          start: 0,
          end: text.length,
          metadata: {
            section: 'Документ',
            isComplete: true
          }
        }];
      }

      let chunks = [];

      if (useLLM) {
        // Используем LLM для определения структуры
        chunks = await this.chunkWithLLM(text, maxChunkSize, overlap);
      } else {
        // Простая разбивка по параграфам и предложениям
        chunks = await this.chunkByStructure(text, maxChunkSize, overlap);
      }

      logger.info(`[SemanticChunking] Получено чанков: ${chunks.length}`);
      return chunks;
    } catch (error) {
      logger.error(`[SemanticChunking] Ошибка разбивки документа:`, error);
      // Fallback на простую разбивку
      return this.chunkByStructure(text, maxChunkSize, overlap);
    }
  }

  /**
   * Разбивка с использованием LLM для определения структуры
   */
  async chunkWithLLM(text, maxChunkSize, overlap) {
    try {
      // Получаем конфигурацию Ollama
      const ollamaConfig_data = await ollamaConfig.getConfigAsync();
      const baseUrl = ollamaConfig_data.baseUrl || 'http://ollama:11434';
      const model = ollamaConfig_data.defaultModel || 'qwen2.5:7b';

      // Если текст очень большой, анализируем первые 10000 символов для определения структуры
      const analysisText = text.length > 10000 ? text.substring(0, 10000) : text;
      
      const prompt = `Проанализируй структуру следующего документа и определи логические разделы.

Документ:
${analysisText}${text.length > 10000 ? '\n\n[Документ продолжается...]' : ''}

Верни JSON с разделами в следующем формате:
{
  "sections": [
    {
      "title": "Название раздела (например, 'Общие условия', 'Стоимость')",
      "start": позиция_начала_раздела_в_тексте,
      "end": позиция_конца_раздела_в_тексте,
      "text": "полный_текст_раздела"
    }
  ]
}

Важно:
- Разделы должны быть логически завершенными (законченная мысль)
- Если раздел слишком большой (больше ${maxChunkSize} символов), раздели его на подразделы
- Не обрезай предложения посередине
- Если не можешь определить структуру, верни один раздел с title: "Документ"`;

      const response = await axios.post(`${baseUrl}/api/chat`, {
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        format: 'json',
        options: {
          temperature: 0.1, // Низкая температура для точности
          num_predict: 2000
        }
      }, {
        timeout: 30000
      });

      const content = response.data.message?.content || response.data.response || '';
      let structure;

      try {
        // Парсим JSON из ответа (может быть обернут в markdown)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structure = JSON.parse(jsonMatch[0]);
        } else {
          structure = JSON.parse(content);
        }
      } catch (parseError) {
        logger.warn(`[SemanticChunking] Ошибка парсинга JSON от LLM, используем простую разбивку:`, parseError);
        return this.chunkByStructure(text, maxChunkSize, overlap);
      }

      // Формируем чанки из разделов
      const chunks = [];
      
      if (structure.sections && Array.isArray(structure.sections)) {
        for (let i = 0; i < structure.sections.length; i++) {
          const section = structure.sections[i];
          const sectionText = section.text || text.substring(section.start || 0, section.end || text.length);

          // Если раздел большой, разбиваем его на подразделы
          if (sectionText.length > maxChunkSize) {
            const subChunks = this.splitLargeSection(sectionText, section.title || 'Раздел', maxChunkSize, overlap);
            chunks.push(...subChunks.map((chunk, idx) => ({
              ...chunk,
              index: chunks.length + idx,
              metadata: {
                ...chunk.metadata,
                parentSection: section.title
              }
            })));
          } else {
            chunks.push({
              text: sectionText.trim(),
              index: chunks.length,
              start: section.start || 0,
              end: section.end || sectionText.length,
              metadata: {
                section: section.title || `Раздел ${i + 1}`,
                isComplete: true
              }
            });
          }
        }
      }

      // Если LLM не определил структуру, используем простую разбивку
      if (chunks.length === 0) {
        return this.chunkByStructure(text, maxChunkSize, overlap);
      }

      return chunks;
    } catch (error) {
      logger.error(`[SemanticChunking] Ошибка LLM разбивки:`, error);
      // Fallback на простую разбивку
      return this.chunkByStructure(text, maxChunkSize, overlap);
    }
  }

  /**
   * Разбивка по структуре (параграфы, предложения)
   */
  async chunkByStructure(text, maxChunkSize, overlap) {
    const chunks = [];
    
    // Разбиваем на параграфы (двойной перенос строки)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentStart = 0;
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      // Если параграф сам по себе больше maxChunkSize, разбиваем его
      if (paragraph.length > maxChunkSize) {
        // Сохраняем текущий чанк, если есть
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex++,
            start: currentStart,
            end: currentStart + currentChunk.length,
            metadata: {
              section: `Параграф ${chunkIndex}`,
              isComplete: true
            }
          });
          currentChunk = '';
        }

        // Разбиваем большой параграф
        const subChunks = this.splitLargeSection(paragraph, `Параграф ${i + 1}`, maxChunkSize, overlap);
        chunks.push(...subChunks.map((chunk, idx) => ({
          ...chunk,
          index: chunkIndex++,
          metadata: {
            ...chunk.metadata,
            parentParagraph: i + 1
          }
        })));
        continue;
      }

      // Проверяем, поместится ли параграф в текущий чанк
      const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

      if (potentialChunk.length <= maxChunkSize) {
        // Добавляем параграф к текущему чанку
        if (currentChunk.length === 0) {
          currentStart = text.indexOf(paragraph);
        }
        currentChunk = potentialChunk;
      } else {
        // Сохраняем текущий чанк и начинаем новый
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex++,
            start: currentStart,
            end: currentStart + currentChunk.length,
            metadata: {
              section: `Параграф ${chunkIndex}`,
              isComplete: true
            }
          });
        }

        // Начинаем новый чанк с текущего параграфа
        currentChunk = paragraph;
        currentStart = text.indexOf(paragraph);
      }
    }

    // Сохраняем последний чанк
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        start: currentStart,
        end: currentStart + currentChunk.length,
        metadata: {
          section: `Параграф ${chunkIndex + 1}`,
          isComplete: true
        }
      });
    }

    // Добавляем перекрытие (overlap) между чанками
    if (overlap > 0 && chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        
        // Берем последние N символов предыдущего чанка
        const overlapText = prevChunk.text.slice(-overlap);
        if (overlapText.trim().length > 0) {
          // Добавляем в начало текущего чанка
          currentChunk.text = overlapText + '\n\n' + currentChunk.text;
          currentChunk.metadata.hasOverlap = true;
        }
      }
    }

    return chunks;
  }

  /**
   * Разбить большой раздел на подразделы
   */
  splitLargeSection(text, sectionTitle, maxChunkSize, overlap) {
    const chunks = [];
    
    // Разбиваем по предложениям
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
      } else {
        // Сохраняем текущий чанк
        if (currentChunk.length >= this.minChunkSize) {
          chunks.push({
            text: currentChunk.trim(),
            index: chunkIndex++,
            metadata: {
              section: `${sectionTitle} - Часть ${chunkIndex}`,
              isComplete: false
            }
          });
        }
        currentChunk = sentence;
      }
    }

    // Сохраняем последний чанк
    if (currentChunk.length >= this.minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        metadata: {
          section: `${sectionTitle} - Часть ${chunkIndex + 1}`,
          isComplete: false
        }
      });
    }

    return chunks;
  }
}

// Создаем singleton экземпляр
const semanticChunkingService = new SemanticChunkingService();

module.exports = semanticChunkingService;

