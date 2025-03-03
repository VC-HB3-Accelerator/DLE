const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { OllamaEmbeddings } = require("@langchain/ollama");
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const fs = require('fs');
const path = require('path');

// Путь к директории с документами
const DOCS_DIR = path.join(__dirname, '../data/documents');
// Путь к директории для хранения векторного индекса
const VECTOR_STORE_DIR = path.join(__dirname, '../data/vector_store');

// Создаем директории, если они не существуют
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  console.log(`Создана директория для документов: ${DOCS_DIR}`);
}

if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
  console.log(`Создана директория для векторного хранилища: ${VECTOR_STORE_DIR}`);
}

// Глобальная переменная для хранения экземпляра векторного хранилища
let vectorStore = null;

// Функция для инициализации векторного хранилища
async function initializeVectorStore() {
  try {
    console.log('Инициализация векторного хранилища...');
    
    // Проверяем, существует ли директория с документами
    if (!fs.existsSync(DOCS_DIR)) {
      console.warn(`Директория с документами не найдена: ${DOCS_DIR}`);
      return null;
    }
    
    // Проверяем, есть ли документы в директории
    const files = fs.readdirSync(DOCS_DIR);
    if (files.length === 0) {
      console.warn(`В директории с документами нет файлов: ${DOCS_DIR}`);
      return null;
    }
    
    console.log(`Найдено ${files.length} файлов в директории с документами`);
    
    // Загружаем документы из директории
    const loader = new DirectoryLoader(
      DOCS_DIR,
      {
        ".txt": (path) => new TextLoader(path),
        ".md": (path) => new TextLoader(path),
      }
    );
    
    console.log('Загрузка документов...');
    const docs = await loader.load();
    console.log(`Загружено ${docs.length} документов`);
    
    if (docs.length === 0) {
      console.warn('Не удалось загрузить документы');
      return null;
    }
    
    // Разбиваем документы на чанки
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    console.log('Разбиение документов на чанки...');
    const splitDocs = await textSplitter.splitDocuments(docs);
    console.log(`Документы разбиты на ${splitDocs.length} чанков`);
    
    // Создаем эмбеддинги с помощью Ollama
    console.log('Создание эмбеддингов...');
    const embeddings = new OllamaEmbeddings({
      model: "mistral",
      baseUrl: "http://localhost:11434",
    });
    
    // Проверяем, существует ли уже векторное хранилище
    if (fs.existsSync(path.join(VECTOR_STORE_DIR, 'hnswlib.index'))) {
      console.log('Загрузка существующего векторного хранилища...');
      try {
        vectorStore = await HNSWLib.load(
          VECTOR_STORE_DIR,
          embeddings
        );
        console.log('Векторное хранилище успешно загружено');
        return vectorStore;
      } catch (error) {
        console.error('Ошибка при загрузке векторного хранилища:', error);
        console.log('Создание нового векторного хранилища...');
      }
    }
    
    // Создаем новое векторное хранилище
    console.log('Создание нового векторного хранилища...');
    vectorStore = await HNSWLib.fromDocuments(
      splitDocs,
      embeddings
    );
    
    // Сохраняем векторное хранилище
    console.log('Сохранение векторного хранилища...');
    await vectorStore.save(VECTOR_STORE_DIR);
    console.log('Векторное хранилище успешно сохранено');
    
    return vectorStore;
  } catch (error) {
    console.error('Ошибка при инициализации векторного хранилища:', error);
    console.log('Приложение продолжит работу без векторного хранилища');
    // Возвращаем заглушку вместо реального хранилища
    return {
      addDocuments: async () => console.log('Векторное хранилище недоступно: addDocuments'),
      similaritySearch: async () => {
        console.log('Векторное хранилище недоступно: similaritySearch');
        return [];
      }
    };
  }
}

// Функция для получения экземпляра векторного хранилища
async function getVectorStore() {
  if (!vectorStore) {
    vectorStore = await initializeVectorStore();
  }
  return vectorStore;
}

module.exports = { initializeVectorStore, getVectorStore }; 