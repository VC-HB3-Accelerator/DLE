/**
 * Тестовые статьи ленты для проверки динамических каталожных фильтров.
 * Не трогает раздел «политика и согласия» (show_in_blog остаётся false).
 */
const db = require('../db');
const catalogFilters = require('../services/catalogFiltersService');
const { detachPrivacyFromBlog } = require('../services/blogFeedService');

const SECTION_DEFS = [
  { slug: 'auto', label_ru: 'Авто', label_en: 'Cars', filter_keys: ['Тип', 'Состояние', 'Страна', 'Регион', 'Город'] },
  { slug: 'special', label_ru: 'Спецтехника', label_en: 'Special equipment', filter_keys: ['Тип', 'Состояние', 'Страна', 'Регион'] },
  { slug: 'equipment', label_ru: 'Оборудование', label_en: 'Equipment', filter_keys: ['Состояние', 'Страна'] },
  { slug: 'realty', label_ru: 'Недвижимость', label_en: 'Real estate', filter_keys: ['Состояние', 'Страна', 'Регион', 'Город'] },
];

const TESTS = [
  {
    slug: 'test-catalog-auto-sedan-new-msk',
    title: '[TEST] Авто · Седан · Новое · Москва',
    summary: 'Тестовая статья для фильтра Авто → Седан → Новое → Россия → Москва',
    section: 'auto',
    attrs: [
      { key: 'Тип', value: 'Седан' },
      { key: 'Состояние', value: 'Новое' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Москва' },
      { key: 'Город', value: 'Москва' },
    ],
  },
  {
    slug: 'test-catalog-auto-suv-used-spb',
    title: '[TEST] Авто · Внедорожник · С наработкой · СПб',
    summary: 'Тестовая статья для фильтра Авто → Внедорожник → С наработкой',
    section: 'auto',
    attrs: [
      { key: 'Тип', value: 'Внедорожник' },
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Санкт-Петербург' },
      { key: 'Город', value: 'Санкт-Петербург' },
    ],
  },
  {
    slug: 'test-catalog-auto-hatch-new',
    title: '[TEST] Авто · Хэтчбэк · Новое',
    summary: 'Тестовая статья без города — только группа/тип/состояние',
    section: 'auto',
    attrs: [
      { key: 'Тип', value: 'Хэтчбэк' },
      { key: 'Состояние', value: 'Новое' },
      { key: 'Страна', value: 'Россия' },
    ],
  },
  {
    slug: 'test-catalog-special-bulldozer-new',
    title: '[TEST] Спецтехника · Бульдозеры легкие · Новое',
    summary: 'Тестовая статья спецтехники',
    section: 'special',
    attrs: [
      { key: 'Тип', value: 'Бульдозеры легкие' },
      { key: 'Состояние', value: 'Новое' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Свердловская область' },
    ],
  },
  {
    slug: 'test-catalog-special-crane-used',
    title: '[TEST] Спецтехника · Автокраны · С наработкой',
    summary: 'Тестовая статья спецтехники с наработкой',
    section: 'special',
    attrs: [
      { key: 'Тип', value: 'Автокраны' },
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
    ],
  },
  {
    slug: 'test-catalog-equipment-new',
    title: '[TEST] Оборудование · Новое',
    summary: 'Тестовая статья раздела Оборудование',
    section: 'equipment',
    attrs: [
      { key: 'Состояние', value: 'Новое' },
      { key: 'Страна', value: 'Россия' },
    ],
  },
  {
    slug: 'test-catalog-realty-used',
    title: '[TEST] Недвижимость · С наработкой',
    summary: 'Тестовая статья раздела Недвижимость',
    section: 'realty',
    attrs: [
      { key: 'Состояние', value: 'С наработкой' },
      { key: 'Страна', value: 'Россия' },
      { key: 'Регион', value: 'Московская область' },
      { key: 'Город', value: 'Видное' },
    ],
  },
];

async function ensureSections() {
  const map = {};
  for (const def of SECTION_DEFS) {
    let section = await catalogFilters.getSectionByIdOrSlug(def.slug);
    if (!section) {
      section = await catalogFilters.createSection(def);
    } else {
      section = await catalogFilters.updateSection(section.id, {
        label_ru: def.label_ru,
        label_en: def.label_en,
        filter_keys: def.filter_keys,
        active: true,
      });
    }
    map[def.slug] = section;
  }
  return map;
}

async function upsertTestPage(item, sectionId) {
  const content = `<p>${item.summary}</p><p>Служебная тестовая запись каталожных фильтров. Можно удалить.</p>`;
  const existing = await db.getQuery()(
    `SELECT id FROM admin_pages_simple WHERE slug = $1 LIMIT 1`,
    [item.slug]
  );
  let pageId = existing.rows[0]?.id;
  if (pageId) {
    await db.getQuery()(
      `UPDATE admin_pages_simple SET
         title = $2, summary = $3, content = $4,
         status = 'published', visibility = 'public',
         show_in_blog = TRUE, is_system_template = FALSE,
         category = $5, format = 'html', mime_type = 'text/html',
         storage_type = 'embedded', updated_at = NOW()
       WHERE id = $1`,
      [pageId, item.title, item.summary, content, 'catalog-test']
    );
  } else {
    const { rows } = await db.getQuery()(
      `INSERT INTO admin_pages_simple (
         title, summary, content, status, visibility, show_in_blog,
         is_system_template, category, slug, format, mime_type, storage_type, seo
       ) VALUES (
         $1,$2,$3,'published','public',TRUE,
         FALSE,'catalog-test',$4,'html','text/html','embedded',$5::jsonb
       ) RETURNING id`,
      [
        item.title,
        item.summary,
        content,
        item.slug,
        JSON.stringify({ title: item.title, description: item.summary }),
      ]
    );
    pageId = rows[0].id;
  }

  await catalogFilters.applyEntityCatalogPayload('page', pageId, {
    catalog_section_id: sectionId,
    catalog_attrs: item.attrs,
  });
  return pageId;
}

async function main() {
  const sections = await ensureSections();
  const ids = [];
  for (const item of TESTS) {
    const section = sections[item.section];
    if (!section) throw new Error(`Section missing: ${item.section}`);
    const id = await upsertTestPage(item, section.id);
    ids.push({ id, slug: item.slug, section: item.section, attrs: item.attrs });
    console.log('upserted', item.slug, id, item.section, item.attrs);
  }

  const detach = await detachPrivacyFromBlog();
  console.log('privacy detach', detach);

  const { rows: privacy } = await db.getQuery()(
    `SELECT count(*)::int AS cnt FROM admin_pages_simple
     WHERE LOWER(TRIM(COALESCE(category,''))) = LOWER(TRIM($1))
       AND show_in_blog = TRUE`,
    ['политика и согласия']
  );
  console.log('privacy still in blog (must be 0):', privacy[0].cnt);

  const { rows: blog } = await db.getQuery()(
    `SELECT count(*)::int AS cnt FROM admin_pages_simple WHERE show_in_blog = TRUE AND slug LIKE 'test-catalog-%'`
  );
  console.log('test blog articles:', blog[0].cnt);
  console.log(JSON.stringify({ ids }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
