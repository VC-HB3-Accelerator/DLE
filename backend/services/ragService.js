const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const db = require('../db');
const { ChatOllama } = require('@langchain/ollama');
const { OllamaEmbeddings } = require('@langchain/ollama');
const { getProviderSettings } = require('./aiProviderSettingsService');
const { OpenAIEmbeddings } = require('@langchain/openai');

console.log('[RAG] ragService.js loaded');

async function getTableData(tableId) {
  const columns = (await db.getQuery()('SELECT * FROM user_columns WHERE table_id = $1', [tableId])).rows;
  console.log('RAG getTableData: columns:', columns);
  const rows = (await db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1', [tableId])).rows;
  const cellValues = (await db.getQuery()('SELECT * FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId])).rows;

  const getColId = purpose => columns.find(col => col.options?.purpose === purpose)?.id;
  const questionColId = getColId('question');
  const answerColId = getColId('answer');
  const userTagsColId = getColId('userTags');
  const contextColId = getColId('context');
  const productColId = getColId('product');
  const priorityColId = getColId('priority');
  const dateColId = getColId('date');

  const data = rows.map(row => {
    const cells = cellValues.filter(cell => cell.row_id === row.id);
    return {
      id: row.id,
      question: cells.find(c => c.column_id === questionColId)?.value,
      answer: cells.find(c => c.column_id === answerColId)?.value,
      userTags: cells.find(c => c.column_id === userTagsColId)?.value,
      context: cells.find(c => c.column_id === contextColId)?.value,
      product: cells.find(c => c.column_id === productColId)?.value,
      priority: cells.find(c => c.column_id === priorityColId)?.value,
      date: cells.find(c => c.column_id === dateColId)?.value,
    };
  });
  const questions = data.map(row => row.question);
  console.log('RAG getTableData: questions:', questions);
  if (!questions.length) {
    console.warn('RAG getTableData: questions array is empty! Проверьте структуру колонок и наличие данных.');
  }
  return data;
}

async function getEmbeddingsProvider(providerName = 'ollama') {
  const settings = await getProviderSettings(providerName);
  if (!settings) throw new Error('Embeddings provider settings not found');
  switch (providerName) {
    case 'openai':
      return new OpenAIEmbeddings({
        apiKey: settings.api_key,
        baseURL: settings.base_url,
        model: settings.selected_model || undefined,
      });
    case 'ollama': {
      // Fallback: если не задан base_url, пробуем env, host.docker.internal, localhost
      let baseUrl = settings.base_url;
      if (!baseUrl) {
        baseUrl = process.env.OLLAMA_BASE_URL;
      }
      if (!baseUrl) {
        // Если в Docker — используем host.docker.internal
        baseUrl = 'http://host.docker.internal:11434';
      }
      // Если всё равно нет — последний fallback
      if (!baseUrl) {
        baseUrl = 'http://localhost:11434';
      }
      return new OllamaEmbeddings({
        model: settings.embedding_model || process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large',
        baseUrl,
      });
    }
    // case 'gemini':
    //   return new GeminiEmbeddings({ apiKey: settings.api_key });
    // Добавьте другие провайдеры по аналогии
    default:
      throw new Error('Unknown embeddings provider: ' + providerName);
  }
}

async function ragAnswer({ tableId, userQuestion, userTags = [], product = null, embeddingsProvider = 'ollama', threshold = 0.3 }) {
  console.log('[RAG] Используется провайдер эмбеддингов:', embeddingsProvider);
  const data = await getTableData(tableId);
  // Триммируем вопросы для чистоты сравнения
  const questions = data.map(row => row.question && typeof row.question === 'string' ? row.question.trim() : row.question);

  // Получаем embeddings-инстанс динамически
  const embeddingsInstance = await getEmbeddingsProvider(embeddingsProvider);

  // Получаем embedding для всех вопросов
  const embeddings = await embeddingsInstance.embedDocuments(questions);
  console.log('Questions embedding length:', embeddings[0]?.length, 'Total questions:', questions.length);

  // Получаем embedding для вопроса пользователя (trim)
  const userQuestionTrimmed = userQuestion && typeof userQuestion === 'string' ? userQuestion.trim() : userQuestion;
  const [userEmbedding] = await embeddingsInstance.embedDocuments([userQuestionTrimmed]);
  console.log('User embedding length:', userEmbedding?.length, 'User question:', userQuestionTrimmed);

  // Явно сравниваем embeddings (отладка)
  console.log('[RAG] Embedding сравнение:');
  embeddings.forEach((emb, idx) => {
    const dot = emb.reduce((sum, v, i) => sum + v * userEmbedding[i], 0);
    console.log(`  [${idx}] dot-product: ${dot} | question: "${questions[idx]}"`);
  });

  // Создаём массив метаданных для каждого вопроса
  const metadatas = data.map(row => ({
    id: row.id,
    answer: row.answer,
    userTags: row.userTags,
    context: row.context,
    product: row.product,
    priority: row.priority,
    date: row.date,
  }));

  // Создаём векторное хранилище
  const vectorStore = await HNSWLib.fromTexts(questions, metadatas, embeddingsInstance);

  // Ищем наиболее похожие вопросы (top-3)
  const results = await vectorStore.similaritySearchVectorWithScore(userEmbedding, 3);
  console.log('[RAG] Результаты поиска по векторам (score):', results.map(([doc, score]) => ({ ...doc.metadata, score })));

  // Фильтруем по тегам/продукту, если нужно
  let filtered = results.map(([doc, score]) => ({ ...doc.metadata, score }));
  if (userTags.length) {
    filtered = filtered.filter(row => row.userTags && userTags.some(tag => row.userTags.includes(tag)));
  }
  if (product) {
    filtered = filtered.filter(row => row.product === product);
  }
  console.log('[RAG] Отфильтрованные результаты:', filtered);

  // Берём лучший результат с учётом порога
  const best = filtered.find(row => row.score >= threshold);
  console.log(`[RAG] Выбранный ответ (порог ${threshold}):`, best);

  // Формируем ответ
  return {
    answer: best?.answer,
    context: best?.context,
    product: best?.product,
    priority: best?.priority,
    date: best?.date,
    score: best?.score,
  };
}

async function generateLLMResponse({ userQuestion, context, clarifyingAnswer, objectionAnswer, answer, systemPrompt, userTags, product, priority, date, rules, history, model, language }) {
  // Подставляем значения в шаблон промта
  let prompt = (systemPrompt || '')
    .replace('{context}', context || '')
    .replace('{clarifyingAnswer}', clarifyingAnswer || '')
    .replace('{objectionAnswer}', objectionAnswer || '')
    .replace('{answer}', answer || '')
    .replace('{question}', userQuestion || '')
    .replace('{userTags}', userTags || '')
    .replace('{product}', product || '')
    .replace('{priority}', priority || '')
    .replace('{date}', date || '')
    .replace('{rules}', rules || '')
    .replace('{history}', history || '')
    .replace('{model}', model || '')
    .replace('{language}', language || '');

  const chat = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5',
    system: prompt,
    temperature: 0.7,
    maxTokens: 1000,
    timeout: 30000,
  });

  const response = await chat.invoke(`Вопрос пользователя: ${userQuestion}`);
  return response.content;
}

module.exports = { ragAnswer, generateLLMResponse }; 