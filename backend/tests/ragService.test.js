// Принудительно устанавливаем URL для Docker-сети
process.env.VECTOR_SEARCH_URL = 'http://vector-search:8001';

const vectorSearch = require('../services/vectorSearchClient');

const TEST_TABLE_ID = 'test_table_rag';

const rows = [
  { row_id: '1', text: 'Что такое RAG?', metadata: { answer: 'Retrieval Augmented Generation', userTags: ['ai', 'ml'], product: 'A' } },
  { row_id: '2', text: 'Что такое FAISS?', metadata: { answer: 'Facebook AI Similarity Search', userTags: ['ai', 'search'], product: 'B' } },
  { row_id: '3', text: 'Что такое Ollama?', metadata: { answer: 'Локальный inference LLM', userTags: ['llm'], product: 'A' } },
];

describe('vectorSearchClient integration (vector-search)', () => {
  before(async () => {
    console.log('Загружаем тестовые данные...');
    console.log('VECTOR_SEARCH_URL:', process.env.VECTOR_SEARCH_URL);
    await vectorSearch.rebuild(TEST_TABLE_ID, rows);
    console.log('Тестовые данные загружены');
  });

  after(async () => {
    console.log('Очищаем тестовые данные...');
    await vectorSearch.remove(TEST_TABLE_ID, rows.map(r => r.row_id));
    console.log('Тестовые данные очищены');
  });

  it('Поиск без фильтрации', async () => {
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Что такое RAG?', 1);
    console.log('Результаты поиска:', results);
    if (!results || results.length === 0) throw new Error('Нет результатов поиска');
    if (results[0].metadata.answer !== 'Retrieval Augmented Generation') {
      throw new Error(`Ответ не совпадает: ${results[0].metadata.answer}`);
    }
  });

  it('Поиск с фильтрацией по тегу (должен найти FAISS)', async () => {
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Что такое FAISS?', 3);
    console.log('Результаты поиска FAISS:', results);
    if (!results || results.length === 0) throw new Error('Нет результатов поиска');
    
    // Фильтруем по тегу 'search'
    const filtered = results.filter(r => r.metadata.userTags && r.metadata.userTags.includes('search'));
    if (filtered.length === 0) throw new Error('Нет результатов с тегом search');
    if (filtered[0].metadata.answer !== 'Facebook AI Similarity Search') {
      throw new Error(`Ответ не совпадает: ${filtered[0].metadata.answer}`);
    }
  });

  it('Поиск с фильтрацией по продукту (должен найти Ollama)', async () => {
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Что такое Ollama?', 3);
    console.log('Результаты поиска Ollama:', results);
    if (!results || results.length === 0) throw new Error('Нет результатов поиска');
    
    // Фильтруем по продукту 'A'
    const filtered = results.filter(r => r.metadata.product === 'A');
    if (filtered.length === 0) throw new Error('Нет результатов с продуктом A');
    if (filtered[0].metadata.answer !== 'Локальный inference LLM') {
      throw new Error(`Ответ не совпадает: ${filtered[0].metadata.answer}`);
    }
  });

  it('Комбинированная фильтрация (тег+продукт)', async () => {
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Что такое RAG?', 3);
    console.log('Результаты поиска RAG:', results);
    if (!results || results.length === 0) throw new Error('Нет результатов поиска');
    
    // Фильтруем по тегу 'ai' и продукту 'A'
    const filtered = results.filter(r => 
      r.metadata.userTags && r.metadata.userTags.includes('ai') && 
      r.metadata.product === 'A'
    );
    if (filtered.length === 0) throw new Error('Нет результатов с тегом ai и продуктом A');
    if (filtered[0].metadata.answer !== 'Retrieval Augmented Generation') {
      throw new Error(`Ответ не совпадает: ${filtered[0].metadata.answer}`);
    }
  });

  it('Проверка порога score', async () => {
    const results = await vectorSearch.search(TEST_TABLE_ID, 'Что такое Ollama?', 3);
    console.log('Результаты поиска с порогом:', results);
    if (!results || results.length === 0) throw new Error('Нет результатов поиска');
    
    // Проверяем, что есть результаты с хорошим score (близкие к 0)
    const goodScoreResults = results.filter(r => Math.abs(r.score) < 10);
    if (goodScoreResults.length === 0) throw new Error('Нет результатов с хорошим score');
    console.log('Результаты с хорошим score:', goodScoreResults.length);
  });
}); 