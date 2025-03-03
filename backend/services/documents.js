const fs = require('fs');
const path = require('path');
const { Document } = require('langchain/document');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

// Функция для загрузки документов из файлов
async function loadDocumentsFromFiles(directory) {
  const documents = [];
  
  try {
    const files = fs.readdirSync(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && (file.endsWith('.txt') || file.endsWith('.md'))) {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        documents.push(
          new Document({
            pageContent: content,
            metadata: {
              source: filePath,
              filename: file,
            },
          })
        );
      }
    }
    
    // Разделяем документы на чанки
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const splitDocs = await textSplitter.splitDocuments(documents);
    
    return splitDocs;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

module.exports = { loadDocumentsFromFiles }; 