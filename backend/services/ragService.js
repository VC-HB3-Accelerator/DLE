const { OpenAIEmbeddings } = require('@langchain/openai');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const db = require('../db');
const { ChatOllama } = require('@langchain/ollama');

async function getTableData(tableId) {
  const columns = (await db.getQuery()('SELECT * FROM user_columns WHERE table_id = $1', [tableId])).rows;
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

  return rows.map(row => {
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
}

async function ragAnswer({ tableId, userQuestion, userTags = [], product = null }) {
  const data = await getTableData(tableId);
  const questions = data.map(row => row.question);

  // Получаем embedding для всех вопросов
  const embeddings = await new OpenAIEmbeddings().embedDocuments(questions);

  // Создаём векторное хранилище
  const vectorStore = await HNSWLib.fromTexts(questions, data, new OpenAIEmbeddings());

  // Получаем embedding для вопроса пользователя
  const [userEmbedding] = await new OpenAIEmbeddings().embedDocuments([userQuestion]);

  // Ищем наиболее похожие вопросы (top-3)
  const results = await vectorStore.similaritySearchVectorWithScore(userEmbedding, 3);

  // Фильтруем по тегам/продукту, если нужно
  let filtered = results.map(([row, score]) => ({ ...row, score }));
  if (userTags.length) {
    filtered = filtered.filter(row => row.userTags && userTags.some(tag => row.userTags.includes(tag)));
  }
  if (product) {
    filtered = filtered.filter(row => row.product === product);
  }

  // Берём лучший результат
  const best = filtered[0];

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