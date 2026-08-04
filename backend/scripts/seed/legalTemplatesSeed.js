/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
 * Seed системных юридических шаблонов + published-документов раздела
 * «политика и согласия» в admin_pages_simple.
 *
 * - /content/templates ← is_system_template = true (draft)
 * - /content/published?section=политика%20и%20согласия ← копии public-доков
 *   (status=published, visibility=public, category=политика и согласия,
 *    show_in_blog=false, is_system_template=false)
 * - С ленты /blog эти доки и фильтр politika-i-soglasiya снимаются
 * - Идемпотентно: повторный запуск обновляет тело/summary, не плодит дубли
 * - Вызывается из scripts/run-migrations.js после SQL-миграций (установка ОС / update)
 */

const db = require('../../db');

/** Совпадает с frontend/src/constants/publishedDocs.js PRIVACY_SECTION_SLUG */
const PRIVACY_SECTION = 'политика и согласия';

async function getExistingColumns(tableName) {
  const res = await db.getQuery()(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  return res.rows.map((r) => r.column_name);
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
        show_in_blog BOOLEAN DEFAULT FALSE,
        slug TEXT,
        category TEXT,
        order_index INTEGER DEFAULT 0,
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
    show_in_blog: 'BOOLEAN DEFAULT FALSE',
    slug: 'TEXT',
    category: 'TEXT',
    order_index: 'INTEGER DEFAULT 0',
    created_at: 'TIMESTAMP DEFAULT NOW()',
    updated_at: 'TIMESTAMP DEFAULT NOW()',
  };

  const existing = await getExistingColumns(tableName);
  for (const [col, type] of Object.entries(needed)) {
    if (!existing.includes(col)) {
      await db.getQuery()(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${type}`);
    }
  }

  try {
    await db.getQuery()(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${tableName}_slug_unique ON ${tableName}(slug) WHERE slug IS NOT NULL`
    );
  } catch (e) {
    // индекс может уже быть
  }
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tpl(content) {
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

function generateSlug(text, maxLength = 100) {
  if (!text) return '';
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo',
    ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
    ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return String(text)
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[а-яё]/g, (ch) => map[ch] || ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, maxLength)
    .replace(/-+$/, '');
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
    is_system_template: true,
  };
}

async function upsertTemplate(tableName, template) {
  const exists = await db.getQuery()(
    `SELECT id FROM ${tableName} WHERE title = $1 AND is_system_template = TRUE LIMIT 1`,
    [template.title]
  );
  if (exists.rows.length > 0) {
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
      template.storage_type,
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
    template.storage_type,
  ]);
  return { updated: 0, inserted: 1 };
}

async function uniqueSlug(tableName, baseSlug, excludeId = null) {
  let slug = baseSlug || `doc-${Date.now()}`;
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const params = excludeId != null ? [candidate, excludeId] : [candidate];
    const sql = excludeId != null
      ? `SELECT id FROM ${tableName} WHERE slug = $1 AND id <> $2 LIMIT 1`
      : `SELECT id FROM ${tableName} WHERE slug = $1 LIMIT 1`;
    const hit = await db.getQuery()(sql, params);
    if (hit.rows.length === 0) return candidate;
    n += 1;
    if (n > 50) return `${slug}-${Date.now()}`;
  }
}

/**
 * Публичная копия шаблона для хаба /content/published (раздел политика и согласия).
 * Не трогает строку is_system_template — отдельная запись.
 */
async function upsertPublishedPrivacyDoc(tableName, template, orderIndex) {
  const category = PRIVACY_SECTION;
  const exists = await db.getQuery()(
    `SELECT id, slug FROM ${tableName}
     WHERE title = $1
       AND LOWER(TRIM(COALESCE(category, ''))) = LOWER(TRIM($2))
       AND COALESCE(is_system_template, FALSE) = FALSE
       AND visibility = 'public'
     LIMIT 1`,
    [template.title, category]
  );

  const baseSlug = generateSlug(template.title);
  if (exists.rows.length > 0) {
    const id = exists.rows[0].id;
    const slug = exists.rows[0].slug && String(exists.rows[0].slug).trim()
      ? exists.rows[0].slug
      : await uniqueSlug(tableName, baseSlug, id);
    await db.getQuery()(
      `UPDATE ${tableName}
       SET summary = $2, content = $3, seo = $4,
           status = 'published', visibility = 'public',
           required_permission = NULL, format = $5, mime_type = $6, storage_type = $7,
           is_system_template = FALSE, show_in_blog = FALSE,
           category = $8, slug = $9, order_index = $10,
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        template.summary,
        template.content,
        JSON.stringify(template.seo || {}),
        template.format,
        template.mime_type,
        template.storage_type,
        category,
        slug,
        orderIndex,
      ]
    );
    return { updated: 1, inserted: 0 };
  }

  const slug = await uniqueSlug(tableName, baseSlug);
  await db.getQuery()(
    `INSERT INTO ${tableName}
      (author_address, title, summary, content, seo, status, visibility, required_permission,
       format, mime_type, storage_type, is_system_template, show_in_blog, category, slug, order_index)
     VALUES (NULL, $1, $2, $3, $4, 'published', 'public', NULL,
             $5, $6, $7, FALSE, FALSE, $8, $9, $10)`,
    [
      template.title,
      template.summary,
      template.content,
      JSON.stringify(template.seo || {}),
      template.format,
      template.mime_type,
      template.storage_type,
      category,
      slug,
      orderIndex,
    ]
  );
  return { updated: 0, inserted: 1 };
}

function buildDocSets() {
  const publicDocs = [
    doc('Политика в отношении обработки персональных данных', 'Публичная политика обработки ПДн для пользователей.', 'public'),
    doc('Политика конфиденциальности', 'Публичная политика конфиденциальности сервиса.', 'public'),
    doc('Согласие на обработку персональных данных', 'Шаблон пользовательского согласия на обработку ПДн.', 'public'),
    doc('Согласие на использование файлов cookie', 'Шаблон согласия на использование cookie по категориям.', 'public'),
    doc('Согласие на трансграничную передачу ПДн', 'Шаблон согласия на трансграничную передачу ПДн.', 'public'),
    doc('Согласие на обработку биометрических ПДн', 'Шаблон согласия на обработку биометрических ПДн.', 'public'),
    doc('Права субъектов ПДн и отзыв согласия', 'Информация о правах субъектов ПДн и форма отзыва согласия.', 'public'),
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
    doc('Политика работы с cookie и сторонними сервисами', 'Регламент для cookie/аналитики/рекламы.', 'internal', internalPermView),
  ];

  return { publicDocs, internalDocs };
}

/**
 * Идемпотентный seed. Возвращает статистику.
 */
async function seedLegalTemplates() {
  const tableName = 'admin_pages_simple';
  await ensureTable(tableName);
  await ensureColumns(tableName);

  const { publicDocs, internalDocs } = buildDocSets();

  let inserted = 0;
  let updated = 0;
  for (const t of [...publicDocs, ...internalDocs]) {
    const res = await upsertTemplate(tableName, t);
    inserted += res.inserted;
    updated += res.updated;
  }

  let publishedInserted = 0;
  let publishedUpdated = 0;
  for (let i = 0; i < publicDocs.length; i += 1) {
    const res = await upsertPublishedPrivacyDoc(tableName, publicDocs[i], i);
    publishedInserted += res.inserted;
    publishedUpdated += res.updated;
  }

  let blogDetach = null;
  try {
    const blogFeedService = require('../../services/blogFeedService');
    blogDetach = await blogFeedService.detachPrivacyFromBlog();
  } catch (err) {
    console.warn('[seed:legal] detachPrivacyFromBlog:', err.message);
  }

  return {
    templatesInserted: inserted,
    templatesUpdated: updated,
    publishedInserted,
    publishedUpdated,
    privacySection: PRIVACY_SECTION,
    blogDetach,
  };
}

async function main() {
  const stats = await seedLegalTemplates();
  console.log(
    `[seed:legal] completed. templates +${stats.templatesInserted}/~${stats.templatesUpdated}; ` +
      `published(${stats.privacySection}) +${stats.publishedInserted}/~${stats.publishedUpdated}`
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed:legal] error:', err);
      process.exit(1);
    });
}

module.exports = {
  seedLegalTemplates,
  PRIVACY_SECTION,
};
