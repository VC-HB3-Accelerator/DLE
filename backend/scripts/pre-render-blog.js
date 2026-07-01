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

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { initDbPool, getQuery } = require('../db');

// URL бэкенда для запроса статей (тот же контейнер)
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

// Конфигурация
// В Docker используем имя контейнера, локально - localhost
const BASE_URL = process.env.PRERENDER_BASE_URL || 
                 process.env.FRONTEND_URL || 
                 (process.env.NODE_ENV === 'production' ? 'http://dapp-frontend:5173' : 'http://localhost:5173');
const OUTPUT_DIR = process.env.PRERENDER_OUTPUT_DIR || 
                   (process.env.NODE_ENV === 'production' 
                     ? '/app/frontend_dist/blog' 
                     : path.join(__dirname, '../../frontend/dist/blog'));
const PUBLISHED_OUTPUT_DIR = process.env.PRERENDER_PUBLISHED_OUTPUT_DIR ||
                   (process.env.NODE_ENV === 'production'
                     ? '/app/frontend_dist/content/published'
                     : path.join(__dirname, '../../frontend/dist/content/published'));

// Путь к шаблону index.html фронтенда (для app-shell)
const FRONTEND_INDEX_HTML = process.env.PRERENDER_INDEX_TEMPLATE || 
                            (process.env.NODE_ENV === 'production'
                              ? '/app/frontend_dist/index.html'
                              : path.join(__dirname, '../../frontend/dist/index.html'));
const TIMEOUT = 30000; // 30 секунд на загрузку страницы

/**
 * Загружает app-shell (index.html) по URL, если локальный файл недоступен (например на VDS нет frontend/dist).
 */
function fetchAppShellFromUrl(urlString) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      reject(new Error('Неверный URL для app-shell: ' + urlString));
      return;
    }
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(Buffer.concat(chunks).toString('utf8'));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

/**
 * Возвращает HTML app-shell: сначала из файла, при неудаче — по URL (PRERENDER_BASE_URL).
 */
async function getAppShellTemplate() {
  try {
    const html = fs.readFileSync(FRONTEND_INDEX_HTML, 'utf8');
    if (html && html.includes('<div id="app')) {
      console.log('[pre-render] App-shell взят из файла:', FRONTEND_INDEX_HTML);
      return html;
    }
  } catch (e) {
    // файла нет (на VDS часто нет frontend/dist в backend)
  }
  const baseUrl = process.env.PRERENDER_BASE_URL || BASE_URL;
  if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
    const shellUrl = baseUrl.replace(/\/$/, '') + '/';
    try {
      const html = await fetchAppShellFromUrl(shellUrl);
      if (html && html.includes('<div id="app')) {
        console.log('[pre-render] App-shell загружен по URL:', shellUrl);
        return normalizeAppShell(html);
      }
    } catch (err) {
      console.warn('[pre-render] Не удалось загрузить app-shell по URL:', err.message);
    }
  }
  return null;
}

/**
 * Нормализует app-shell:
 * - очищает #app от уже отрендеренного контента (если он есть),
 * - чтобы при пререндере не утащить случайный error-state в итоговый HTML.
 */
function normalizeAppShell(html) {
  if (!html || typeof html !== 'string') return html;

  // Оставляем пустой корневой контейнер приложения перед </body>.
  const appWithBodyRegex = /<div id="app"[^>]*>[\s\S]*<\/div>\s*<\/body>/i;
  if (appWithBodyRegex.test(html)) {
    return html.replace(appWithBodyRegex, '<div id="app"></div>\n</body>');
  }

  return html;
}

/**
 * Вставляет SEO-теги и контент в app-shell
 */
function applySeoToAppShell(template, seo) {
  const {
    canonical,
    title,
    description = '',
    ogType = 'website',
    bodyHtml = '',
  } = seo;

  if (!template || typeof template !== 'string' || !template.includes('<div id="app')) {
    return null;
  }

  let html = normalizeAppShell(template);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

  if (html.match(/<meta\s+name=["']description["'][^>]*>/i)) {
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${safeDescription}">`
    );
  } else {
    html = html.replace(/<\/head>/i, `  <meta name="description" content="${safeDescription}">\n</head>`);
  }

  html = html
    .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:url["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:title["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:description["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+property=["']og:type["'][^>]*>\s*/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '');

  const ogBlock = `
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="${ogType}">
  <meta name="robots" content="index, follow">`;

  html = html.replace(/<\/head>/i, `${ogBlock}\n</head>`);

  const appWithBodyRegex = /<div id="app"[^>]*>[\s\S]*<\/div>\s*<\/body>/i;
  if (appWithBodyRegex.test(html)) {
    html = html.replace(appWithBodyRegex, `<div id="app">${bodyHtml}</div>\n</body>`);
  } else if (html.includes('<div id="app"></div>')) {
    html = html.replace('<div id="app"></div>', `<div id="app">${bodyHtml}</div>`);
  }

  return html;
}

/**
 * Создает директорию если её нет
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Ожидает загрузки контента на странице
 */
async function waitForContent(page, selector, timeout = TIMEOUT) {
  try {
    await page.waitForSelector(selector, { timeout });
    // Дополнительная задержка для полной загрузки контента и рендера (API + Vue)
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    console.warn(`[pre-render] Селектор ${selector} не найден, продолжаем...`);
    // Всё равно даём время на подгрузку (API может быть медленнее)
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

/**
 * Рендерит страницу и возвращает HTML
 */
async function renderPage(browser, url, options = {}) {
  if (!browser) {
    throw new Error('Браузер не инициализирован');
  }
  
  const page = await browser.newPage();
  
  try {
    // Устанавливаем viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Устанавливаем таймауты
    page.setDefaultNavigationTimeout(TIMEOUT);
    page.setDefaultTimeout(TIMEOUT);
    
    // Для статей: ждём ответ API /api/pages/blog/ перед снимком
    let waitApiPromise = null;
    if (options.waitForApiPattern) {
      waitApiPromise = page.waitForResponse(
        (response) => {
          const ok = response.url().includes(options.waitForApiPattern) && response.status() === 200;
          if (ok) console.log(`[pre-render] Получен ответ API: ${response.url().split('?')[0]}`);
          return ok;
        },
        { timeout: TIMEOUT }
      ).catch((err) => {
        console.warn('[pre-render] Ожидание API истекло или ошибка:', err.message);
        return null;
      });
    }
    
    // Переходим на страницу
    console.log(`[pre-render] Загрузка: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT 
    });
    
    // Дождаться ответа API (если задано), затем дать время на рендер Vue
    if (waitApiPromise) {
      await waitApiPromise;
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
    
    // Ждем появления контента по селектору (долгая пауза на случай медленного API)
    if (options.waitForSelector) {
      await waitForContent(page, options.waitForSelector, 45000);
    }
    
    // Получаем HTML
    const html = await page.content();
    
    if (!html || html.trim().length === 0) {
      throw new Error('Получен пустой HTML');
    }
    
    // Оптимизируем HTML: удаляем скрипты, которые не нужны для SEO
    const optimizedHtml = optimizeHtml(html, url);
    
    return optimizedHtml;
  } catch (error) {
    console.error(`[pre-render] Ошибка при рендеринге ${url}:`, error.message);
    throw error;
  } finally {
    try {
      await page.close();
    } catch (closeError) {
      console.warn(`[pre-render] Ошибка при закрытии страницы: ${closeError.message}`);
    }
  }
}

/**
 * Оптимизирует HTML для статического контента
 */
function optimizeHtml(html, url) {
  // Удаляем скрипты, которые выполняются только на клиенте
  // Но оставляем мета-теги и структуру
  let optimized = html;
  
  // Удаляем inline скрипты, которые не нужны для SEO
  optimized = optimized.replace(/<script[^>]*>(?!.*application\/ld\+json)[\s\S]*?<\/script>/gi, '');
  
  // Оставляем JSON-LD разметку
  optimized = optimized.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, 
    '<script type="application/ld+json">$1</script>');
  
  // Удаляем WebSocket подключения
  optimized = optimized.replace(/new WebSocket\([^)]+\)/gi, '');
  
  // Удаляем console.log для уменьшения размера
  optimized = optimized.replace(/console\.(log|warn|error)\([^)]*\)/gi, '');
  
  return optimized;
}

/**
 * Экранирует HTML для безопасной вставки в текст/атрибуты
 */
function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Собирает HTML страницы статьи с абсолютным canonical
 * @param {string} pathPrefix - /blog или /content/published
 */
function buildArticleHtml(article, baseUrl, appShellTemplate, pathPrefix = '/blog') {
  const slug = (article.slug || '').trim();
  const canonical = `${baseUrl}${pathPrefix}/${encodeURIComponent(slug)}`;
  const title = article.title || 'Статья';
  const description = article.summary || title;
  const content = article.content != null ? String(article.content) : '';

  const articleInnerHtml = `
  <article class="docs-content">
    <header class="page-header">
      <h1 class="page-title">${escapeHtml(title)}</h1>
      ${article.summary ? `<p class="page-summary">${escapeHtml(article.summary)}</p>` : ''}
    </header>
    <div class="page-content">${content}</div>
  </article>
  `;

  const fromShell = applySeoToAppShell(appShellTemplate, {
    canonical,
    title,
    description,
    ogType: 'article',
    bodyHtml: articleInnerHtml,
  });

  if (fromShell) return fromShell;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:url" content="${canonical}">
  <meta name="robots" content="index, follow">
</head>
<body>${articleInnerHtml}</body>
</html>`;
}

/**
 * HTML для списковых страниц (/blog, /content/published)
 */
function buildListPageHtml({ title, description, pathPrefix, items, baseUrl, appShellTemplate }) {
  const canonical = `${baseUrl}${pathPrefix}`;
  const listItems = (items || [])
    .filter((a) => a && a.slug)
    .map((a) => {
      const href = `${baseUrl}${pathPrefix}/${encodeURIComponent(String(a.slug).trim())}`;
      return `<li><a href="${href}">${escapeHtml(a.title || a.slug)}</a></li>`;
    })
    .join('\n');

  const bodyHtml = `
  <main class="seo-prerender-list docs-content">
    <header class="page-header">
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p class="page-summary">${escapeHtml(description)}</p>
    </header>
    <nav aria-label="Список страниц"><ul>${listItems}</ul></nav>
  </main>`;

  return applySeoToAppShell(appShellTemplate, {
    canonical,
    title,
    description,
    ogType: 'website',
    bodyHtml,
  });
}

function fetchJsonFromApi(apiPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, BACKEND_API_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            return reject(new Error(`API ${apiPath} вернул ${res.statusCode}`));
          }
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function fetchArticleFromApi(slug, pathPrefix) {
  const apiPath = pathPrefix === '/blog'
    ? `/api/pages/blog/${encodeURIComponent(slug)}`
    : `/api/pages/published/${encodeURIComponent(slug)}`;
  return fetchJsonFromApi(apiPath);
}

/**
 * Очищает slug для использования в имени файла
 */
function sanitizeSlug(slug) {
  if (!slug) return 'page';
  // Удаляем небезопасные символы для имени файла
  return slug.replace(/[^a-z0-9\-_]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Сохраняет HTML в файл (путь должен быть внутри baseDir)
 */
function saveHtml(html, filePath, baseDir) {
  try {
    ensureDir(path.dirname(filePath));

    const resolvedPath = path.resolve(filePath);
    const baseResolved = path.resolve(baseDir);

    if (!resolvedPath.startsWith(baseResolved)) {
      throw new Error(`Небезопасный путь: ${filePath}`);
    }

    fs.writeFileSync(resolvedPath, html, 'utf8');
    console.log(`[pre-render] Сохранено: ${resolvedPath}`);
  } catch (error) {
    console.error(`[pre-render] Ошибка сохранения файла ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Переименовывает старые .html в .bak перед регенерацией
 */
function archiveHtmlFilesInDir(dir) {
  ensureDir(dir);
  try {
    const entries = fs.readdirSync(dir);
    for (const name of entries) {
      if (name.endsWith('.html')) {
        const p = path.join(dir, name);
        fs.renameSync(p, `${p}.bak`);
        console.log(`[pre-render] Архив: ${p} -> ${p}.bak`);
      }
    }
  } catch (e) {
    console.warn(`[pre-render] Не удалось архивировать HTML в ${dir}:`, e.message);
  }
}

/**
 * Проверяет, что HTML подходит для публикации как SEO-страница статьи.
 * Отсекаем error-state, чтобы не сохранять "Документ не найден" как индексируемую страницу.
 */
function isRenderableArticleHtml(html, article = {}) {
  if (!html || typeof html !== 'string') return false;

  const lower = html.toLowerCase();
  const errorMarkers = [
    'документ не найден',
    'страница не найдена',
    'запрашиваемый документ не существует или не опубликован',
    'class="error-state"',
    "class='error-state'"
  ];

  if (errorMarkers.some((marker) => lower.includes(String(marker).toLowerCase()))) {
    return false;
  }

  // Минимальная структурная проверка контента статьи
  const hasArticleRoot = lower.includes('docs-content') || lower.includes('<article');
  if (!hasArticleRoot) return false;

  if (article && article.title) {
    const title = String(article.title).trim().toLowerCase();
    if (title.length > 0 && !lower.includes(title)) {
      return false;
    }
  }

  return true;
}

/**
 * Получает список статей блога через тот же API, что использует SPA.
 * Это гарантирует, что список для пререндеринга совпадает со списком на /blog.
 */
async function getBlogArticles() {
  try {
    const url = new URL('/api/pages/blog/all', BACKEND_API_URL);
    const mod = url.protocol === 'https:' ? https : http;

    console.log('[pre-render] Запрос списка статей через API:', url.toString());

    const articles = await new Promise((resolve, reject) => {
      const req = mod.request(url, { method: 'GET', timeout: 15000 }, (res) => {
        const chunks = [];

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode !== 200) {
              console.warn('[pre-render] API /api/pages/blog/all вернул статус', res.statusCode, 'тело:', body);
              return reject(new Error(`API /api/pages/blog/all вернул ${res.statusCode}`));
            }
            const data = JSON.parse(body);
            if (!Array.isArray(data)) {
              console.warn('[pre-render] API /api/pages/blog/all вернул не массив, формат:', typeof data);
              return resolve([]);
            }
            resolve(data);
          } catch (e) {
            console.error('[pre-render] Ошибка парсинга ответа /api/pages/blog/all:', e.message);
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout /api/pages/blog/all'));
      });

      req.end();
    });

    console.log(`[pre-render] Список статей из API: ${articles.length}`);

    // Фильтруем на всякий случай и оставляем только статьи с валидным slug
    return (articles || [])
      .filter((a) => a && typeof a.slug === 'string' && a.slug.trim() !== '')
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title || a.slug,
      }));
  } catch (error) {
    console.error('[pre-render] Ошибка получения статей через API /api/pages/blog/all:', error.message || error);
    return [];
  }
}

async function getPublishedPages() {
  try {
    const data = await fetchJsonFromApi('/api/pages/published/all');
    if (!Array.isArray(data)) return [];
    return data
      .filter((a) => a && typeof a.slug === 'string' && a.slug.trim() !== '')
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title || a.slug,
      }));
  } catch (error) {
    console.error('[pre-render] Ошибка /api/pages/published/all:', error.message || error);
    return [];
  }
}

async function renderArticlesToDir({
  articles,
  pathPrefix,
  outputDir,
  appShellTemplate,
  publicBaseUrl,
  specificSlug,
}) {
  let articlesToRender = articles;
  if (specificSlug) {
    articlesToRender = articles.filter((a) => a.slug && a.slug.trim() === specificSlug.trim());
    if (articlesToRender.length === 0) {
      console.warn(`[pre-render] Slug "${specificSlug}" не найден в ${pathPrefix}`);
    }
  }

  for (const article of articlesToRender) {
    try {
      if (!article.slug || typeof article.slug !== 'string' || article.slug.trim() === '') {
        continue;
      }
      const sanitizedSlug = sanitizeSlug(article.slug);
      console.log(`[pre-render] ${pathPrefix}/${sanitizedSlug}`);
      let articleHtml = null;
      try {
        const data = await fetchArticleFromApi(article.slug, pathPrefix);
        articleHtml = buildArticleHtml(data, publicBaseUrl, appShellTemplate, pathPrefix);
      } catch (apiErr) {
        console.warn(`[pre-render] API (${pathPrefix}): ${apiErr.message}`);
      }
      if (articleHtml && isRenderableArticleHtml(articleHtml, article)) {
        saveHtml(articleHtml, path.join(outputDir, `${sanitizedSlug}.html`), outputDir);
      } else {
        console.warn(`[pre-render] Пропуск ${sanitizedSlug}: невалидный HTML`);
      }
    } catch (error) {
      console.error(`[pre-render] Ошибка ${article.slug}:`, error.message);
    }
  }
}

/**
 * Pre-render SEO HTML (блог + published)
 */
async function preRenderBlog(options = {}) {
  const legacyList = options.renderList;
  const legacyArticles = options.renderArticles;

  const renderBlogList = options.renderBlogList ?? legacyList ?? true;
  const renderBlogArticles = options.renderBlogArticles ?? legacyArticles ?? true;
  const renderPublishedList = options.renderPublishedList ?? legacyList ?? true;
  const renderPublishedArticles = options.renderPublishedArticles ?? legacyArticles ?? true;
  const specificSlug = options.specificSlug || null;

  console.log('[pre-render] Старт SEO pre-render...');
  console.log(`[pre-render] Blog dir: ${OUTPUT_DIR}`);
  console.log(`[pre-render] Published dir: ${PUBLISHED_OUTPUT_DIR}`);

  ensureDir(OUTPUT_DIR);
  ensureDir(PUBLISHED_OUTPUT_DIR);

  if (!specificSlug) {
    archiveHtmlFilesInDir(OUTPUT_DIR);
    archiveHtmlFilesInDir(PUBLISHED_OUTPUT_DIR);
  }

  const publicBaseUrl = process.env.PUBLIC_SITE_URL ||
    (BASE_URL.startsWith('https') ? BASE_URL.replace(/\/$/, '') : 'https://hb3-accelerator.com');

  const appShellTemplate = await getAppShellTemplate();
  if (!appShellTemplate) {
    console.warn('[pre-render] App-shell не найден — пропуск генерации');
    return;
  }

  const blogArticles = await getBlogArticles();
  const publishedPages = await getPublishedPages();
  console.log(`[pre-render] Блог: ${blogArticles.length}, Published: ${publishedPages.length}`);

  if (renderBlogList) {
    const listHtml = buildListPageHtml({
      title: 'Блог',
      description: 'Публикации и статьи VC HB3 Accelerator',
      pathPrefix: '/blog',
      items: blogArticles,
      baseUrl: publicBaseUrl,
      appShellTemplate,
    });
    if (listHtml) {
      saveHtml(listHtml, path.join(OUTPUT_DIR, 'index.html'), OUTPUT_DIR);
    }
  }

  if (renderPublishedList) {
    const listHtml = buildListPageHtml({
      title: 'Публичные документы - HB3 Accelerator',
      description: 'Опубликованные документы и материалы платформы Digital Legal Entity.',
      pathPrefix: '/content/published',
      items: publishedPages,
      baseUrl: publicBaseUrl,
      appShellTemplate,
    });
    if (listHtml) {
      saveHtml(listHtml, path.join(PUBLISHED_OUTPUT_DIR, 'index.html'), PUBLISHED_OUTPUT_DIR);
    }
  }

  if (renderBlogArticles) {
    const blogSource = blogArticles.length > 0
      ? blogArticles
      : (specificSlug ? [{ slug: specificSlug, title: specificSlug }] : []);
    await renderArticlesToDir({
      articles: blogSource,
      pathPrefix: '/blog',
      outputDir: OUTPUT_DIR,
      appShellTemplate,
      publicBaseUrl,
      specificSlug,
    });
  }

  if (renderPublishedArticles) {
    const publishedSource = publishedPages.length > 0
      ? publishedPages
      : (specificSlug ? [{ slug: specificSlug, title: specificSlug }] : []);
    await renderArticlesToDir({
      articles: publishedSource,
      pathPrefix: '/content/published',
      outputDir: PUBLISHED_OUTPUT_DIR,
      appShellTemplate,
      publicBaseUrl,
      specificSlug,
    });
  }

  console.log('[pre-render] Завершено успешно');
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    try {
      // Инициализируем БД
      await initDbPool();
      
      // Парсим аргументы командной строки
      const args = process.argv.slice(2);
      const noList = args.includes('--no-list');
      const noArticles = args.includes('--no-articles');
      const options = {
        renderBlogList: !noList,
        renderBlogArticles: !noArticles,
        renderPublishedList: !noList,
        renderPublishedArticles: !noArticles,
        specificSlug: args.find((arg) => arg.startsWith('--slug='))?.split('=')[1] || null,
      };
      
      await preRenderBlog(options);
      process.exit(0);
    } catch (error) {
      console.error('[pre-render] Фатальная ошибка:', error);
      process.exit(1);
    }
  })();
}

module.exports = { preRenderBlog };

