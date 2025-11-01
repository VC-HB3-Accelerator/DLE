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

/**
 * Импорт правовых документов из папки legal в admin_pages_simple
 * Конвертирует markdown файлы в HTML и добавляет их как опубликованные страницы
 */

const db = require('../db');
const fs = require('fs');
const path = require('path');

// Маппинг файлов на документацию
const legalDocsMapping = {
  'CONSENT_PERSONAL_DATA_RU.md': {
    title: 'Согласие на обработку персональных данных',
    summary: 'Шаблон пользовательского согласия на обработку персональных данных'
  },
  'COOKIE_CONSENT_RU.md': {
    title: 'Согласие на использование файлов cookie',
    summary: 'Шаблон согласия на использование cookie по категориям'
  },
  'PDN_RIGHTS_AND_REVOCATION_RU.md': {
    title: 'Права субъектов персональных данных и отзыв согласия',
    summary: 'Информация о правах субъектов ПДн и форма отзыва согласия'
  },
  'PRIVACY_POLICY_RU.md': {
    title: 'Политика конфиденциальности',
    summary: 'Публичная политика конфиденциальности сервиса'
  },
  'SERVICE_ACT_TEMPLATE_RU.md': {
    title: 'Акт выполненных работ',
    summary: 'Шаблон акта выполненных работ для подтверждения оказанных услуг'
  },
  'SERVICE_AGREEMENT_RU.md': {
    title: 'Договор оказания услуг',
    summary: 'Минимальный договор оказания услуг / лицензионный договор'
  },
  'service-terms.md': {
    title: 'Условия приобретения и обслуживания Digital Legal Entity',
    summary: 'Условия приобретения, лицензирования и обслуживания DLE'
  }
};

async function ensureTable(tableName) {
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`,
    [tableName]
  );
  if (!existsRes.rows[0].exists) {
    await db.getQuery()(`
      CREATE TABLE ${tableName} (
        id SERIAL PRIMARY KEY,
        author_address TEXT NULL,
        title TEXT,
        summary TEXT,
        content TEXT,
        seo JSONB,
        status TEXT,
        visibility TEXT,
        required_permission TEXT,
        format TEXT,
        mime_type TEXT,
        storage_type TEXT,
        file_path TEXT,
        size_bytes BIGINT,
        checksum TEXT,
        is_system_template BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }
}

async function ensureColumns(tableName) {
  const needed = {
    author_address: 'TEXT',
    title: 'TEXT',
    summary: 'TEXT',
    content: 'TEXT',
    seo: 'JSONB',
    status: 'TEXT',
    visibility: 'TEXT',
    required_permission: 'TEXT',
    format: 'TEXT',
    mime_type: 'TEXT',
    storage_type: 'TEXT',
    file_path: 'TEXT',
    size_bytes: 'BIGINT',
    checksum: 'TEXT',
    is_system_template: 'BOOLEAN DEFAULT FALSE',
    created_at: 'TIMESTAMP DEFAULT NOW()',
    updated_at: 'TIMESTAMP DEFAULT NOW()'
  };

  const existingRes = await db.getQuery()(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  const existing = existingRes.rows.map(r => r.column_name);

  for (const [col, type] of Object.entries(needed)) {
    if (!existing.includes(col)) {
      await db.getQuery()(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`);
    }
  }
}

// Простая функция конвертации markdown в HTML
function markdownToHtml(markdown) {
  let html = markdown;
  
  // Заголовки
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Списки
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
  
  // Жирный текст
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Курсив
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Ссылки
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Изображения
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Горизонтальная линия
  html = html.replace(/^---$/gim, '<hr>');
  
  // Параграфы
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (p && !p.match(/^<[hul]/) && !p.match(/<\/[hul]/) && !p.match(/^<pre>/) && !p.match(/<\/pre>/) && !p.match(/^<blockquote>/) && !p.match(/<\/blockquote>/)) {
      return `<p>${p}</p>`;
    }
    return p;
  }).join('\n\n');
  
  return html;
}

async function importLegalDocument(filename, metadata) {
  // Пробуем разные пути в зависимости от окружения
  const possiblePaths = [
    path.join('/legal', filename),                         // Docker окружение
    path.join(__dirname, '..', '..', 'legal', filename),  // Локальное окружение
    path.join(process.cwd(), '..', 'legal', filename)     // Альтернативный путь
  ];
  
  let filePath = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      filePath = possiblePath;
      break;
    }
  }
  
  if (!filePath) {
    console.error(`Файл не найден: ${filename}`);
    console.error(`Проверенные пути: ${possiblePaths.join(', ')}`);
    return null;
  }

  console.log(`Чтение файла: ${filename}`);
  const markdownContent = fs.readFileSync(filePath, 'utf-8');
  
  // Конвертируем markdown в HTML
  const htmlContent = markdownToHtml(markdownContent);

  // Проверяем, существует ли уже документ с таким названием
  const existing = await db.getQuery()(
    `SELECT id FROM admin_pages_simple WHERE title = $1 LIMIT 1`,
    [metadata.title]
  );

  const pageData = {
    title: metadata.title,
    summary: metadata.summary,
    content: htmlContent,
    seo: {
      title: metadata.title,
      description: metadata.summary,
      keywords: 'ПДн, политика, согласие, правовые документы, DLE'
    },
    status: 'published',
    visibility: 'public',
    required_permission: null,
    format: 'html',
    mime_type: 'text/html',
    storage_type: 'embedded'
  };

  if (existing.rows.length > 0) {
    // Обновляем существующий документ
    const sql = `UPDATE admin_pages_simple
      SET summary = $2, content = $3, seo = $4, status = $5, visibility = $6,
          format = $7, mime_type = $8, storage_type = $9, updated_at = NOW()
      WHERE id = $1`;
    await db.getQuery()(sql, [
      existing.rows[0].id,
      pageData.summary,
      pageData.content,
      JSON.stringify(pageData.seo),
      pageData.status,
      pageData.visibility,
      pageData.format,
      pageData.mime_type,
      pageData.storage_type
    ]);
    console.log(`✓ Обновлен: ${metadata.title}`);
    return { updated: 1, inserted: 0 };
  } else {
    // Вставляем новый документ
    const sql = `INSERT INTO admin_pages_simple
      (author_address, title, summary, content, seo, status, visibility, required_permission, format, mime_type, storage_type)
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
    await db.getQuery()(sql, [
      pageData.title,
      pageData.summary,
      pageData.content,
      JSON.stringify(pageData.seo),
      pageData.status,
      pageData.visibility,
      pageData.required_permission,
      pageData.format,
      pageData.mime_type,
      pageData.storage_type
    ]);
    console.log(`✓ Создан: ${metadata.title}`);
    return { updated: 0, inserted: 1 };
  }
}

async function main() {
  try {
    console.log('Начало импорта правовых документов...');
    
    const tableName = 'admin_pages_simple';
    await ensureTable(tableName);
    await ensureColumns(tableName);

    let totalInserted = 0;
    let totalUpdated = 0;

    // Импортируем все документы из маппинга
    for (const [filename, metadata] of Object.entries(legalDocsMapping)) {
      const result = await importLegalDocument(filename, metadata);
      if (result) {
        totalInserted += result.inserted;
        totalUpdated += result.updated;
      }
    }

    console.log(`\n✓ Импорт завершен: создано=${totalInserted}, обновлено=${totalUpdated}`);
  } catch (error) {
    console.error('Ошибка импорта правовых документов:', error);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
