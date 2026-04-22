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
 * Загружает статью по slug через API бэкенда (без браузера).
 * Используется для SSG: один источник данных, стабильный результат в Docker.
 */
function fetchArticleFromApi(slug) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/pages/blog/${encodeURIComponent(slug)}`, BACKEND_API_URL);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`API вернул ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8');
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

/**
 * Собирает HTML страницы статьи, встраивая контент в app-shell Vite (index.html),
 * чтобы и SEO, и пользователь видели нормальную оформленную страницу.
 * @param {object} article - данные статьи
 * @param {string} baseUrl - базовый URL сайта
 * @param {string|null} appShellTemplate - HTML index.html (из файла или по URL)
 */
function buildArticleHtml(article, baseUrl, appShellTemplate) {
  const canonical = `${baseUrl}/blog/${encodeURIComponent(article.slug || '')}`;
  const title = article.title ? escapeHtml(article.title) : 'Статья';
  const description = article.summary ? escapeHtml(article.summary) : title;
  const content = article.content != null ? String(article.content) : '';

  // HTML фрагмент статьи, который будет вставлен внутрь #app
  const articleInnerHtml = `
  <article class="docs-content">
    <header class="page-header">
      <h1 class="page-title">${title}</h1>
      ${article.summary ? `<p class="page-summary">${escapeHtml(article.summary)}</p>` : ''}
    </header>
    <div class="page-content">${content}</div>
  </article>
  `;

  const template = appShellTemplate;

  if (template && typeof template === 'string' && template.includes('<div id="app')) {
    let html = normalizeAppShell(template);

    // Обновляем title
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

    // Обновляем/добавляем description
    if (html.match(/<meta\s+name=["']description["'][^>]*>/i)) {
      html = html.replace(
        /<meta\s+name=["']description["'][^>]*>/i,
        `<meta name="description" content="${description}">`
      );
    } else {
      html = html.replace(
        /<\/head>/i,
        `  <meta name="description" content="${description}">\n</head>`
      );
    }

    // Удаляем старые SEO-теги app-shell (чтобы не плодить дубли canonical/og/robots)
    html = html
      .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
      .replace(/<meta\s+property=["']og:url["'][^>]*>\s*/gi, '')
      .replace(/<meta\s+property=["']og:title["'][^>]*>\s*/gi, '')
      .replace(/<meta\s+property=["']og:description["'][^>]*>\s*/gi, '')
      .replace(/<meta\s+property=["']og:type["'][^>]*>\s*/gi, '')
      .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '');

    // Канонический URL и OG‑мета
    const ogBlock = `
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="article">
  <meta name="robots" content="index, follow">`;

    if (html.includes('</head>')) {
      html = html.replace(/<\/head>/i, `${ogBlock}\n</head>`);
    }

    // Вставляем контент внутрь #app, сохраняя весь app-shell (CSS + JS)
    const appWithBodyRegex = /<div id="app"[^>]*>[\s\S]*<\/div>\s*<\/body>/i;
    if (appWithBodyRegex.test(html)) {
      html = html.replace(appWithBodyRegex, `<div id="app">${articleInnerHtml}</div>\n</body>`);
    } else if (html.includes('<div id="app"></div>')) {
      html = html.replace('<div id="app"></div>', `<div id="app">${articleInnerHtml}</div>`);
    }

    return html;
  }

  // Fallback: минимальный HTML (на случай, если index.html не найден)
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="article">
  <meta name="robots" content="index, follow">
</head>
<body>
  ${articleInnerHtml}
</body>
</html>`;
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
 * Сохраняет HTML в файл
 */
function saveHtml(html, filePath) {
  try {
    ensureDir(path.dirname(filePath));
    
    // Проверяем, что путь безопасен (защита от path traversal)
    const resolvedPath = path.resolve(filePath);
    const outputDirResolved = path.resolve(OUTPUT_DIR);
    
    if (!resolvedPath.startsWith(outputDirResolved)) {
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

/**
 * Основная функция pre-rendering
 */
async function preRenderBlog(options = {}) {
  const { 
    renderList = true, 
    renderArticles = true,
    specificSlug = null 
  } = options;
  
  console.log('[pre-render] Начало pre-rendering блога...');
  console.log(`[pre-render] Base URL: ${BASE_URL}`);
  console.log(`[pre-render] Output dir: ${OUTPUT_DIR}`);
  
  // Создаем директорию для вывода
  ensureDir(OUTPUT_DIR);
  // Удаляем старый blog/index.html, чтобы /blog всегда отдавал корневой SPA (не «Нет статей в блоге»)
  const blogIndexPath = path.join(OUTPUT_DIR, 'index.html');
  try {
    if (fs.existsSync(blogIndexPath)) {
      fs.unlinkSync(blogIndexPath);
      console.log('[pre-render] Удалён старый blog/index.html — /blog будет отдавать SPA');
    }
  } catch (e) {
    console.warn('[pre-render] Не удалось удалить blog/index.html:', e.message);
  }
  // Старые .html статей переименовываем в .bak перед повторной генерацией
  try {
    const entries = fs.readdirSync(OUTPUT_DIR);
    for (const name of entries) {
      if (name.endsWith('.html')) {
        const p = path.join(OUTPUT_DIR, name);
        fs.renameSync(p, p + '.bak');
        console.log(`[pre-render] Переименован: ${name} -> ${name}.bak`);
      }
    }
  } catch (e) {
    console.warn('[pre-render] Не удалось переименовать старые файлы:', e.message);
  }
  
  try {
    // Список статей больше не пререндерим в index.html,
    // чтобы /blog всегда работал как чистый SPA и не ломался при F5.
    // Получаем список статей для индивидуального пререндеринга
    const articles = await getBlogArticles();
    console.log(`[pre-render] Найдено статей: ${articles.length}`);
    
    if (renderArticles && articles.length > 0) {
      // Загружаем app-shell один раз: из файла или по URL (на VDS файла нет — качаем с сайта)
      let appShellTemplate = await getAppShellTemplate();

      // Рендерим статьи
      let articlesToRender;
      if (specificSlug) {
        // Фильтруем по slug (точное совпадение)
        articlesToRender = articles.filter(a => a.slug && a.slug.trim() === specificSlug.trim());
        if (articlesToRender.length === 0) {
          console.warn(`[pre-render] Статья со slug "${specificSlug}" не найдена`);
        }
      } else {
        articlesToRender = articles;
      }
      
      const publicBaseUrl = process.env.PUBLIC_SITE_URL || (BASE_URL.startsWith('https') ? BASE_URL : 'https://hb3-accelerator.com');
      for (const article of articlesToRender) {
        try {
          if (!article.slug || typeof article.slug !== 'string' || article.slug.trim() === '') {
            console.warn(`[pre-render] Пропущена статья с невалидным slug: ${article.id}`);
            continue;
          }
          const sanitizedSlug = sanitizeSlug(article.slug);
          console.log(`[pre-render] Рендеринг статьи: ${sanitizedSlug} (${article.title})`);
          let articleHtml = null;
          try {
            const data = await fetchArticleFromApi(article.slug);
            articleHtml = buildArticleHtml(data, publicBaseUrl, appShellTemplate);
            console.log(`[pre-render] Статья получена через API (SSG)`);
          } catch (apiErr) {
            console.warn(`[pre-render] API недоступен (${apiErr.message}), пропускаем статью без browser fallback`);
          }
          if (articleHtml && isRenderableArticleHtml(articleHtml, article)) {
            const filePath = path.join(OUTPUT_DIR, `${sanitizedSlug}.html`);
            saveHtml(articleHtml, filePath);
          } else {
            console.warn(
              `[pre-render] Пропущено сохранение ${sanitizedSlug}: получен невалидный HTML (error-state или пустой контент)`
            );
          }
        } catch (error) {
          console.error(`[pre-render] Ошибка при рендеринге статьи ${article.slug}:`, error.message);
        }
      }
    }
    
    console.log('[pre-render] Pre-rendering завершен успешно!');
  } catch (error) {
    console.error('[pre-render] Критическая ошибка:', error);
    throw error;
  }
}

// Если скрипт запущен напрямую
if (require.main === module) {
  (async () => {
    try {
      // Инициализируем БД
      await initDbPool();
      
      // Парсим аргументы командной строки
      const args = process.argv.slice(2);
      const options = {
        renderList: !args.includes('--no-list'),
        renderArticles: !args.includes('--no-articles'),
        specificSlug: args.find(arg => arg.startsWith('--slug='))?.split('=')[1] || null
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

