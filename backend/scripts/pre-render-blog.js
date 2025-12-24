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

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { initDbPool, getQuery } = require('../db');

// Конфигурация
// В Docker используем имя контейнера, локально - localhost
const BASE_URL = process.env.PRERENDER_BASE_URL || 
                 process.env.FRONTEND_URL || 
                 (process.env.NODE_ENV === 'production' ? 'http://dapp-frontend:5173' : 'http://localhost:5173');
const OUTPUT_DIR = process.env.PRERENDER_OUTPUT_DIR || 
                   (process.env.NODE_ENV === 'production' 
                     ? '/app/frontend_dist/blog' 
                     : path.join(__dirname, '../../frontend/dist/blog'));
const TIMEOUT = 30000; // 30 секунд на загрузку страницы

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
    // Дополнительная задержка для полной загрузки контента
    // Используем setTimeout вместо устаревшего waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.warn(`[pre-render] Селектор ${selector} не найден, продолжаем...`);
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
    
    // Переходим на страницу
    console.log(`[pre-render] Загрузка: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT 
    });
    
    // Ждем загрузки контента
    if (options.waitForSelector) {
      await waitForContent(page, options.waitForSelector);
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
 * Получает список статей блога из БД
 */
async function getBlogArticles() {
  try {
    const query = getQuery();
    if (!query) {
      console.error('[pre-render] БД не инициализирована');
      return [];
    }
    
    const tableName = 'admin_pages_simple';
    
    const { rows } = await query(`
      SELECT id, slug, title 
      FROM ${tableName} 
      WHERE visibility = 'public' 
        AND status = 'published' 
        AND show_in_blog = TRUE
        AND slug IS NOT NULL
        AND slug != ''
      ORDER BY created_at DESC
    `);
    
    return rows || [];
  } catch (error) {
    console.error('[pre-render] Ошибка получения статей из БД:', error);
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
  
  // Инициализируем браузер
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
      ]
    });
  } catch (error) {
    console.error('[pre-render] Ошибка запуска браузера:', error.message);
    throw new Error(`Не удалось запустить браузер: ${error.message}`);
  }
  
  try {
    // Рендерим список статей
    if (renderList) {
      console.log('[pre-render] Рендеринг списка статей...');
      const listHtml = await renderPage(browser, `${BASE_URL}/blog`, {
        waitForSelector: '.blog-articles, .empty-state, .loading-state'
      });
      saveHtml(listHtml, path.join(OUTPUT_DIR, 'index.html'));
    }
    
    // Получаем список статей
    const articles = await getBlogArticles();
    console.log(`[pre-render] Найдено статей: ${articles.length}`);
    
    if (renderArticles && articles.length > 0) {
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
      
      for (const article of articlesToRender) {
        try {
          // Проверяем, что slug валидный
          if (!article.slug || typeof article.slug !== 'string' || article.slug.trim() === '') {
            console.warn(`[pre-render] Пропущена статья с невалидным slug: ${article.id}`);
            continue;
          }
          
          const sanitizedSlug = sanitizeSlug(article.slug);
          console.log(`[pre-render] Рендеринг статьи: ${sanitizedSlug} (${article.title})`);
          
          const articleHtml = await renderPage(browser, `${BASE_URL}/blog/${encodeURIComponent(article.slug)}`, {
            waitForSelector: '.docs-content, .article-view'
          });
          
          // Сохраняем в файл с именем slug (используем sanitized slug для безопасности)
          const filePath = path.join(OUTPUT_DIR, `${sanitizedSlug}.html`);
          saveHtml(articleHtml, filePath);
        } catch (error) {
          console.error(`[pre-render] Ошибка при рендеринге статьи ${article.slug}:`, error.message);
          // Продолжаем с другими статьями
        }
      }
    }
    
    console.log('[pre-render] Pre-rendering завершен успешно!');
  } catch (error) {
    console.error('[pre-render] Критическая ошибка:', error);
    throw error;
  } finally {
    // Закрываем браузер, если он был открыт
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[pre-render] Ошибка при закрытии браузера:', closeError.message);
      }
    }
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

