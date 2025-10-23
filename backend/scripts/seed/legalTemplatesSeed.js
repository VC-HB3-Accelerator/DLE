/**
 * Seed системных юридических шаблонов (РКН-2025) в admin_pages_simple
 * - Добавляет недостающие колонки (visibility, format и пр.)
 * - Создает шаблоны с is_system_template = true и author_address = NULL
 * - Повторный запуск — идемпотентен (по title + is_system_template)
 */

const db = require('../../db');

async function getExistingColumns(tableName) {
  const res = await db.getQuery()(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  return res.rows.map(r => r.column_name);
}

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

  const existing = await getExistingColumns(tableName);
  for (const [col, type] of Object.entries(needed)) {
    if (!existing.includes(col)) {
      await db.getQuery()(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`);
    }
  }
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tpl(content) {
  // Лаконичный, «человеческий» текст с минимальными inline‑плейсхолдерами
  return `
<h1>${htmlEscape(content.title)}</h1>
<p>
  Настоящий документ предназначен для использования в рамках деятельности
  {{company_name}} по адресу {{company_address}} и подлежит персонализации редактором.
</p>

<p>
  Ответственное лицо за вопросы персональных данных: {{responsible_person}}
  (<a href="mailto:{{privacy_email}}">{{privacy_email}}</a>, {{privacy_phone}}).
</p>

<p>
  Дата версии: {{date}} · Юрисдикция: {{jurisdiction}} · Язык: {{language}}
</p>

<p>
  Ниже приведён текст шаблона. Перед публикацией проверьте корректность реквизитов,
  правовых оснований и сроков хранения данных.
</p>

${content.body || ''}
`;
}

function doc(title, summary, visibility = 'public', requiredPermission = null) {
  return {
    title,
    summary,
    content: tpl({ title, visibility }),
    seo: { title, description: summary, keywords: 'ПДн, политика, согласие' },
    status: 'draft',
    visibility,
    required_permission: requiredPermission,
    format: 'html',
    mime_type: 'text/html',
    storage_type: 'embedded',
    is_system_template: true
  };
}

async function upsertTemplate(tableName, template) {
  const exists = await db.getQuery()(
    `SELECT id FROM ${tableName} WHERE title = $1 AND is_system_template = TRUE LIMIT 1`,
    [template.title]
  );
  if (exists.rows.length > 0) {
    // Обновляем основные поля, не трогая author_address
    const sql = `UPDATE ${tableName}
      SET summary = $2, content = $3, seo = $4, status = $5, visibility = $6,
          required_permission = $7, format = $8, mime_type = $9, storage_type = $10,
          updated_at = NOW()
      WHERE id = $1`;
    await db.getQuery()(sql, [
      exists.rows[0].id,
      template.summary,
      template.content,
      JSON.stringify(template.seo || {}),
      template.status,
      template.visibility,
      template.required_permission,
      template.format,
      template.mime_type,
      template.storage_type
    ]);
    return { updated: 1, inserted: 0 };
  }

  const sql = `INSERT INTO ${tableName}
    (author_address, title, summary, content, seo, status, visibility, required_permission, format, mime_type, storage_type, is_system_template)
    VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`;
  await db.getQuery()(sql, [
    template.title,
    template.summary,
    template.content,
    JSON.stringify(template.seo || {}),
    template.status,
    template.visibility,
    template.required_permission,
    template.format,
    template.mime_type,
    template.storage_type
  ]);
  return { updated: 0, inserted: 1 };
}

async function main() {
  const tableName = 'admin_pages_simple';
  await ensureTable(tableName);
  await ensureColumns(tableName);

  const publicDocs = [
    doc('Политика в отношении обработки персональных данных', 'Публичная политика обработки ПДн для пользователей.', 'public'),
    doc('Политика конфиденциальности', 'Публичная политика конфиденциальности сервиса.', 'public'),
    doc('Согласие на обработку персональных данных', 'Шаблон пользовательского согласия на обработку ПДн.', 'public'),
    doc('Согласие на использование файлов cookie', 'Шаблон согласия на использование cookie по категориям.', 'public'),
    doc('Согласие на трансграничную передачу ПДн', 'Шаблон согласия на трансграничную передачу ПДн.', 'public'),
    doc('Согласие на обработку биометрических ПДн', 'Шаблон согласия на обработку биометрических ПДн.', 'public'),
    doc('Права субъектов ПДн и отзыв согласия', 'Информация о правах субъектов ПДн и форма отзыва согласия.', 'public')
  ];

  const internalPermView = 'view_legal_docs';
  const internalDocs = [
    doc('Приказ о назначении ответственного за ПДн', 'Внутренний приказ о назначении ответственного.', 'internal', internalPermView),
    doc('Должностная инструкция ответственного за ПДн', 'Обязанности и полномочия ответственного.', 'internal', internalPermView),
    doc('Положение об обработке и защите ПДн', 'Локальный акт об обработке и защите ПДн.', 'internal', internalPermView),
    doc('Регламент обращений субъектов ПДн', 'Порядок рассмотрения обращений субъектов.', 'internal', internalPermView),
    doc('Регламент исполнения запросов субъектов', 'Доступ, исправление, удаление, ограничение.', 'internal', internalPermView),
    doc('Политика хранения и уничтожения ПДн', 'Сроки хранения и процедуры уничтожения ПДн.', 'internal', internalPermView),
    doc('Политика разграничения доступа к ПДн', 'Матрица ролей, уровни доступа.', 'internal', internalPermView),
    doc('Перечень допущенных лиц и НДА', 'Список сотрудников/подрядчиков и обязательства о НДА.', 'internal', internalPermView),
    doc('Шаблон DPA (поручение обработки ПДн)', 'Условия поручения обработки ПДн процессорам.', 'internal', internalPermView),
    doc('Реестр операций по обработке ПДн', 'Цели, категории, сроки хранения, основания.', 'internal', internalPermView),
    doc('Журналы учетов и инцидентов', 'Журналы доступа/операций и безопасности.', 'internal', internalPermView),
    doc('Перечень и описание ИСПДн', 'Состав ИСПДн, типы и классификация.', 'internal', internalPermView),
    doc('Модель угроз и меры защиты', 'Актуальная модель угроз и меры защиты.', 'internal', internalPermView),
    doc('План обеспечения безопасности ПДн', 'Мероприятия по обеспечению безопасности ПДн.', 'internal', internalPermView),
    doc('Регламент реагирования на инциденты', 'Порядок реагирования и план восстановления.', 'internal', internalPermView),
    doc('Программа обучения и журнал инструктажей', 'Программа обучения и учет инструктажей.', 'internal', internalPermView),
    doc('Уведомление РКН об обработке ПДн (шаблон)', 'Шаблон уведомления РКН об обработке ПДн.', 'internal', internalPermView),
    doc('Процедуры трансграничной передачи ПДн', 'Порядок и уведомления для трансграничной передачи.', 'internal', internalPermView),
    doc('Согласие ребенка/законного представителя', 'Шаблон согласия для несовершеннолетних.', 'internal', internalPermView),
    doc('Политика работы с cookie и сторонними сервисами', 'Регламент для cookie/аналитики/рекламы.', 'internal', internalPermView)
  ];

  let inserted = 0, updated = 0;
  for (const t of [...publicDocs, ...internalDocs]) {
    const res = await upsertTemplate(tableName, t);
    inserted += res.inserted;
    updated += res.updated;
  }

  console.log(`[seed:legal] completed. inserted=${inserted}, updated=${updated}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('[seed:legal] error:', err);
  process.exit(1);
});


