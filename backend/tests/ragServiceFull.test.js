// Временно устанавливаем URL для локального тестирования
process.env.VECTOR_SEARCH_URL = 'http://localhost:8001';

const ragService = require('../services/ragService');
const db = require('../db');

const TEST_TABLE_ID = 999999; // Используем числовой ID

describe('ragService full integration (DB + vector-search)', () => {
  before(async () => {
    console.log('Создаем тестовую таблицу и данные...');
    
    // Создаем тестовую таблицу
    await db.getQuery()(`
      INSERT INTO user_tables (id, name, description) 
      VALUES ($1, 'Test RAG Table', 'Test table for RAG integration')
      ON CONFLICT (id) DO NOTHING
    `, [TEST_TABLE_ID]);

    // Создаем колонки
    const columns = [
      { id: 'col_question', name: 'Question', type: 'text', purpose: 'question' },
      { id: 'col_answer', name: 'Answer', type: 'text', purpose: 'answer' },
      { id: 'col_tags', name: 'Tags', type: 'text', purpose: 'userTags' },
      { id: 'col_product', name: 'Product', type: 'text', purpose: 'product' }
    ];

    for (const col of columns) {
      await db.getQuery()(`
        INSERT INTO user_columns (id, table_id, name, type, options) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [col.id, TEST_TABLE_ID, col.name, col.type, JSON.stringify({ purpose: col.purpose })]);
    }

    // Создаем строки
    const rows = [
      { id: 'row_1', question: 'Что такое RAG?', answer: 'Retrieval Augmented Generation', tags: 'ai,ml', product: 'A' },
      { id: 'row_2', question: 'Что такое FAISS?', answer: 'Facebook AI Similarity Search', tags: 'ai,search', product: 'B' },
      { id: 'row_3', question: 'Что такое Ollama?', answer: 'Локальный inference LLM', tags: 'llm', product: 'A' }
    ];

    for (const row of rows) {
      // Создаем строку
      await db.getQuery()(`
        INSERT INTO user_rows (id, table_id, name) 
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [row.id, TEST_TABLE_ID, row.question]);

      // Создаем значения ячеек
      await db.getQuery()(`
        INSERT INTO user_cell_values (row_id, column_id, value) 
        VALUES ($1, $2, $3), ($1, $4, $5), ($1, $6, $7), ($1, $8, $9)
        ON CONFLICT (row_id, column_id) DO UPDATE SET value = EXCLUDED.value
      `, [
        row.id, 'col_question', row.question,
        row.id, 'col_answer', row.answer,
        row.id, 'col_tags', row.tags,
        row.id, 'col_product', row.product
      ]);
    }

    console.log('Тестовые данные созданы');
  });

  after(async () => {
    console.log('Очищаем тестовые данные...');
    
    // Удаляем значения ячеек
    await db.getQuery()(`
      DELETE FROM user_cell_values 
      WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)
    `, [TEST_TABLE_ID]);

    // Удаляем строки
    await db.getQuery()(`
      DELETE FROM user_rows WHERE table_id = $1
    `, [TEST_TABLE_ID]);

    // Удаляем колонки
    await db.getQuery()(`
      DELETE FROM user_columns WHERE table_id = $1
    `, [TEST_TABLE_ID]);

    // Удаляем таблицу
    await db.getQuery()(`
      DELETE FROM user_tables WHERE id = $1
    `, [TEST_TABLE_ID]);

    console.log('Тестовые данные очищены');
  });

  it('Полная интеграция: поиск без фильтрации', async () => {
    const result = await ragService.ragAnswer({ 
      tableId: TEST_TABLE_ID, 
      userQuestion: 'Что такое RAG?' 
    });
    
    console.log('Результат RAG:', result);
    if (!result) throw new Error('Нет результата');
    if (result.answer !== 'Retrieval Augmented Generation') {
      throw new Error(`Ответ не совпадает: ${result.answer}`);
    }
  });

  it('Полная интеграция: фильтрация по тегу', async () => {
    const result = await ragService.ragAnswer({ 
      tableId: TEST_TABLE_ID, 
      userQuestion: 'Что такое FAISS?',
      userTags: ['search']
    });
    
    console.log('Результат с фильтром по тегу:', result);
    if (!result) throw new Error('Нет результата');
    if (result.answer !== 'Facebook AI Similarity Search') {
      throw new Error(`Ответ не совпадает: ${result.answer}`);
    }
  });

  it('Полная интеграция: фильтрация по продукту', async () => {
    const result = await ragService.ragAnswer({ 
      tableId: TEST_TABLE_ID, 
      userQuestion: 'Что такое Ollama?',
      product: 'A'
    });
    
    console.log('Результат с фильтром по продукту:', result);
    if (!result) throw new Error('Нет результата');
    if (result.answer !== 'Локальный inference LLM') {
      throw new Error(`Ответ не совпадает: ${result.answer}`);
    }
  });

  it('Полная интеграция: комбинированная фильтрация', async () => {
    const result = await ragService.ragAnswer({ 
      tableId: TEST_TABLE_ID, 
      userQuestion: 'Что такое RAG?',
      userTags: ['ai'],
      product: 'A'
    });
    
    console.log('Результат с комбинированной фильтрацией:', result);
    if (!result) throw new Error('Нет результата');
    if (result.answer !== 'Retrieval Augmented Generation') {
      throw new Error(`Ответ не совпадает: ${result.answer}`);
    }
  });

  it('Полная интеграция: проверка порога score', async () => {
    const result = await ragService.ragAnswer({ 
      tableId: TEST_TABLE_ID, 
      userQuestion: 'Что такое Ollama?',
      threshold: 0.95
    });
    
    console.log('Результат с высоким порогом:', result);
    // С высоким порогом может не быть результата, это нормально
    if (result && result.score < 0.95) {
      throw new Error(`Score слишком низкий: ${result.score}`);
    }
  });
}); 