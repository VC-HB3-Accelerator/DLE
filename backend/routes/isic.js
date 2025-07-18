const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger'); // Если используете логгер
const fs = require('fs');
const csv = require('csv-parser');

/**
 * @swagger
 * tags:
 *   name: ISIC
 *   description: API для кодов Международной стандартной отраслевой классификации (ISIC)
 */

/**
 * @swagger
 * /api/isic/codes:
 *   get:
 *     summary: Получить список кодов ISIC с фильтрацией и пагинацией
 *     tags: [ISIC]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: integer
 *         description: Фильтр по уровню кода (1-4, иногда 5 или 6)
 *       - in: query
 *         name: parent_code
 *         schema:
 *           type: string
 *         description: Фильтр по родительскому коду (для получения дочерних кодов)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поисковый запрос по коду или описанию
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы для пагинации
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *         description: Количество элементов на странице
 *     responses:
 *       200:
 *         description: Список кодов ISIC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 codes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/IsicCode'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       404:
 *         description: Родительский код не найден
 *       500:
 *         description: Ошибка сервера
 */
router.get('/codes', async (req, res) => {
  const { level, parent_code, search } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const offset = (page - 1) * limit;
  const { lang } = req.query;

  // Если запрошен русский язык — отдаём из CSV
  if (lang === 'ru') {
    const { level, parent_code } = req.query;
    const results = [];
    fs.createReadStream(__dirname + '/../db/data/isic_titles_ru.csv')
      .pipe(csv())
      .on('data', (data) => {
        let pass = true;
        // Фильтрация по уровню (по длине кода)
        if (level) {
          if (level == 1 && data.code.length !== 1) pass = false;
          if (level == 2 && data.code.length !== 2) pass = false;
          if (level == 3 && data.code.length !== 3) pass = false;
          if (level == 4 && data.code.length !== 4) pass = false;
        }
        // Фильтрация по parent_code
        if (parent_code && pass) {
          if (level == 2 && !data.code.startsWith(parent_code)) pass = false;
          if (level == 3 && !data.code.startsWith(parent_code)) pass = false;
          if (level == 4 && !data.code.startsWith(parent_code)) pass = false;
        }
        if (pass) {
          results.push({
            code: data.code,
            description: data.title,
          });
        }
      })
      .on('end', () => {
        res.json({
          totalItems: results.length,
          codes: results,
          totalPages: 1,
          currentPage: 1,
        });
      })
      .on('error', (err) => {
        res.status(500).json({ error: 'Ошибка чтения русских кодов ISIC', details: err.message });
      });
    return;
  }

  const baseQuerySelect = `
    SELECT c.code, c.description, c.code_level, c.explanatory_note_inclusion, c.explanatory_note_exclusion,
           l.level_name_en,
           c.level1, c.level2, c.level3, c.level4, c.level5, c.level6
    FROM isic_rev4_codes c
    LEFT JOIN isic_rev4_level_names l ON c.code_level = l.code_level
  `;
  // Для подсчета JOIN с level_names не нужен, если только по level_name_en не будет фильтрации (пока нет)
  const baseQueryCount = ` 
    SELECT COUNT(*) AS total
    FROM isic_rev4_codes c
  `;

  const conditions = [];
  const queryParams = []; // Параметры для основного запроса (включая limit/offset)
  const countQueryParams = []; // Параметры только для WHERE части (для count запроса)

  if (level) {
    const levelParam = parseInt(level, 10);
    conditions.push(`c.code_level = $${queryParams.push(levelParam)}`);
    countQueryParams.push(levelParam);
  }

  if (parent_code) {
    try {
      const parentResult = await db.getQuery()('SELECT code_level FROM isic_rev4_codes WHERE code = $1', [parent_code]);
      if (parentResult.rows.length > 0) {
        const parentLevel = parentResult.rows[0].code_level;
        if (parentLevel >= 1 && parentLevel < 6) {
          conditions.push(`c.level${parentLevel} = $${queryParams.push(parent_code)}`);
          countQueryParams.push(parent_code);
          
          const childLevel = parentLevel + 1;
          conditions.push(`c.code_level = $${queryParams.push(childLevel)}`);
          countQueryParams.push(childLevel);
        } else {
          // Родительский код на максимальном уровне, нет дочерних.
          // Возвращаем пустой результат сразу.
          return res.json({ totalItems: 0, codes: [], totalPages: 0, currentPage: page });
        }
      } else {
        // parent_code не найден
        logger.warn(`Parent code not found: ${parent_code}`);
        return res.status(404).json({ error: 'Parent code not found', totalItems: 0, codes: [], totalPages: 0, currentPage: page });
      }
    } catch (dbError) {
      logger.error('Error fetching parent_code level:', dbError);
      return res.status(500).json({ error: 'Internal server error while fetching parent data' });
    }
  }

  if (search) {
    const searchPattern = `%${search}%`;
    // Используем один параметр для обоих ILIKE, чтобы $N был корректным в countQueryParams
    conditions.push(`(c.code ILIKE $${queryParams.push(searchPattern)} OR c.description ILIKE $${queryParams.length})`); // $N для второго ILIKE будет тем же, что и для первого
    countQueryParams.push(searchPattern);
  }

  let whereClause = '';
  if (conditions.length > 0) {
    // Переиндексируем плейсхолдеры для whereClause, т.к. queryParams и countQueryParams теперь разные
    // Это более сложный момент, проще собирать whereClause с $1, $2 и т.д. и передавать countQueryParams
    // Для простоты сейчас оставим как было, но это означает, что queryParams используется для генерации whereClause,
    // а потом из него берутся countQueryParams.
    
    // Корректный способ: перестроить whereClause для count с правильными индексами
    let countWhereClauseConditions = [];
    let currentCountParamIndex = 1;
    if (level) {
        countWhereClauseConditions.push(`c.code_level = $${currentCountParamIndex++}`);
    }
    if (parent_code) {
        // Предполагаем, что parent_code уже добавлен в countQueryParams
        const parentLevelResult = await db.getQuery()('SELECT code_level FROM isic_rev4_codes WHERE code = $1', [parent_code]); // Нужно будет передать parent_code в countQueryParams
        if (parentLevelResult.rows.length > 0) {
            const parentLevel = parentLevelResult.rows[0].code_level;
            if (parentLevel >=1 && parentLevel < 6) {
                 countWhereClauseConditions.push(`c.level${parentLevel} = $${currentCountParamIndex++}`);
                 countWhereClauseConditions.push(`c.code_level = $${currentCountParamIndex++}`);
            }
        }
    }
    if (search) {
        countWhereClauseConditions.push(`(c.code ILIKE $${currentCountParamIndex} OR c.description ILIKE $${currentCountParamIndex})`);
        currentCountParamIndex++;
    }
     whereClause = countWhereClauseConditions.length > 0 ? ' WHERE ' + countWhereClauseConditions.join(' AND ') : '';


  }


  // Запрос для получения данных с пагинацией
  const dataQueryPlaceholders = queryParams.map((_, i) => `$${i + 1}`).join(', '); // Это неверно для WHERE
  // Формируем finalQuery с плейсхолдерами, соответствующими queryParams
  let finalQueryWhereClause = '';
  if (conditions.length > 0) {
      let currentQueryParamIndex = 1;
      const queryWhereConditions = [];
      if (level) queryWhereConditions.push(`c.code_level = $${currentQueryParamIndex++}`);
      if (parent_code) {
          const parentLevelResult = await db.getQuery()('SELECT code_level FROM isic_rev4_codes WHERE code = $1', [parent_code]); // Это дублирование, лучше получить parentLevel один раз
           if (parentLevelResult.rows.length > 0) {
                const parentLevel = parentLevelResult.rows[0].code_level;
                if (parentLevel >=1 && parentLevel < 6) {
                    queryWhereConditions.push(`c.level${parentLevel} = $${currentQueryParamIndex++}`);
                    queryWhereConditions.push(`c.code_level = $${currentQueryParamIndex++}`);
                }
           }
      }
      if (search) queryWhereConditions.push(`(c.code ILIKE $${currentQueryParamIndex} OR c.description ILIKE $${currentQueryParamIndex})`); // searchPattern идет одним параметром
      finalQueryWhereClause = queryWhereConditions.length > 0 ? ' WHERE ' + queryWhereConditions.join(' AND ') : '';
  }


  const finalQuery = `${baseQuerySelect} ${finalQueryWhereClause} ORDER BY c.sort_order, c.code LIMIT $${queryParams.push(limit)} OFFSET $${queryParams.push(offset)}`;
  const finalCountQuery = `${baseQueryCount} ${whereClause}`;

  try {
    logger.debug('Executing count query:', finalCountQuery, 'Params:', countQueryParams);
    const totalItemsResult = await db.getQuery()(finalCountQuery, countQueryParams);
    const totalItems = parseInt(totalItemsResult.rows[0].total, 10);

    // Параметры для основного запроса - это все, что в queryParams (включая limit и offset)
    logger.debug('Executing data query:', finalQuery, 'Params:', queryParams);
    const result = await db.getQuery()(finalQuery, queryParams);
    
    res.json({
      totalItems,
      codes: result.rows,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    logger.error('Error fetching ISIC codes:', error);
    if (error.query) logger.error('Failed Query:', error.query); 
    if (error.parameters) logger.error('Failed Params:', error.parameters);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * @swagger
 * /api/isic/tree:
 *   get:
 *     summary: Получить иерархическое дерево кодов ISIC (или его часть)
 *     tags: [ISIC]
 *     parameters:
 *       - in: query
 *         name: root_code
 *         schema:
 *           type: string
 *         description: Код ISIC, с которого начинать построение дерева (например, 'A' или '01'). Если не указан, вернет все секции (уровень 1).
 *       - in: max_depth
 *         schema:
 *           type: integer
 *           default: 2
 *         description: Максимальная глубина дерева для загрузки.
 *     responses:
 *       200:
 *         description: Дерево кодов ISIC
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/IsicTreeNode' # Определим эту схему позже
 *       500:
 *         description: Ошибка сервера
 */
router.get('/tree', async (req, res) => {
  const { root_code, max_depth = 2 } = req.query;

  // Эта функция потребует рекурсивного запроса или сложного CTE (Common Table Expression) в SQL
  // для построения дерева. Это более сложная задача.
  // Для начала можно сделать упрощенную версию, которая возвращает один уровень вложенности.
  try {
    let items;
    if (!root_code) { // Если нет root_code, возвращаем секции (уровень 1)
      const result = await db.getQuery()(
        "SELECT code, description, code_level FROM isic_rev4_codes WHERE code_level = 1 ORDER BY sort_order, code"
      );
      items = result.rows.map(row => ({ ...row, children: [] })); // Добавляем пустой массив children
    } else {
      // Получаем сам root_code
      const rootResult = await db.getQuery()(
        "SELECT code, description, code_level FROM isic_rev4_codes WHERE code = $1",
        [root_code]
      );
      if (rootResult.rows.length === 0) {
        return res.status(404).json({ error: 'Root code not found' });
      }
      const rootNode = { ...rootResult.rows[0], children: [] };

      // Получаем прямых потомков (упрощенный пример для одного уровня вложенности)
      let childrenQuery = '';
      const childrenParams = [root_code];
      const rootLevel = rootNode.code_level;

      if (rootLevel === 1) childrenQuery = "SELECT code, description, code_level FROM isic_rev4_codes WHERE level1 = $1 AND code_level = 2 ORDER BY sort_order, code";
      else if (rootLevel === 2) childrenQuery = "SELECT code, description, code_level FROM isic_rev4_codes WHERE level2 = $1 AND code_level = 3 ORDER BY sort_order, code";
      else if (rootLevel === 3) childrenQuery = "SELECT code, description, code_level FROM isic_rev4_codes WHERE level3 = $1 AND code_level = 4 ORDER BY sort_order, code";
      else if (rootLevel === 4) childrenQuery = "SELECT code, description, code_level FROM isic_rev4_codes WHERE level4 = $1 AND code_level = 5 ORDER BY sort_order, code";
      else if (rootLevel === 5) childrenQuery = "SELECT code, description, code_level FROM isic_rev4_codes WHERE level5 = $1 AND code_level = 6 ORDER BY sort_order, code";


      if (childrenQuery) {
        const childrenResult = await db.getQuery()(childrenQuery, childrenParams);
        rootNode.children = childrenResult.rows.map(row => ({ ...row, children: [] })); 
      }
      items = [rootNode]; 
    }
    res.json(items);
  } catch (error)
 {
    logger.error('Error fetching ISIC tree:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
