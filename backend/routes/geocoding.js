    // backend/routes/geocoding.js
    const express = require('express');
    const router = express.Router();
    const axios = require('axios'); // Убедитесь, что axios установлен на бэкенде
    const logger = require('../utils/logger'); // Если используете логгер

    /**
     * @swagger
     * tags:
     *   name: Geocoding
     *   description: Прокси для сервисов геокодирования (например, Nominatim)
     */

    /**
     * @swagger
     * /api/geocoding/nominatim-search:
     *   get:
     *     summary: Проксирует запрос к Nominatim API (search)
     *     tags: [Geocoding]
     *     description: Перенаправляет GET запрос со всеми его query параметрами к https://nominatim.openstreetmap.org/search. Это необходимо для обхода CORS ограничений в браузере.
     *     parameters:
     *       - in: query
     *         name: q
     *         schema:
     *           type: string
     *         required: true
     *         description: Строка адреса для поиска.
     *       - in: query
     *         name: format
     *         schema:
     *           type: string
     *         required: true
     *         description: Формат ответа (например, jsonv2).
     *       - in: query
     *         name: addressdetails
     *         schema:
     *           type: integer
     *           enum: [0, 1]
     *         description: Включить детализированный адрес (0 или 1).
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *         description: Максимальное количество возвращаемых результатов.
     *       # Можно добавить сюда и другие параметры Nominatim API по мере необходимости
     *     responses:
     *       200:
     *         description: Успешный ответ от Nominatim.
     *         content:
     *           application/json:
     *             schema:
     *               type: object # Или array, в зависимости от ответа Nominatim
     *       500:
     *         description: Ошибка при запросе к Nominatim или внутренняя ошибка сервера.
     */
    router.get('/nominatim-search', async (req, res) => {
      try {
        // Формируем URL для Nominatim, используя все query параметры из исходного запроса
        const queryParams = new URLSearchParams(req.query);
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?${queryParams.toString()}`;

        if (logger && typeof logger.info === 'function') {
        logger.info(`[Geocoding] Proxying request to Nominatim: ${nominatimUrl}`);
        } else {
            console.log(`[Geocoding] Proxying request to Nominatim: ${nominatimUrl}`);
        }

        const nominatimResponse = await axios.get(nominatimUrl);
        
        res.json(nominatimResponse.data);

      } catch (error) {
        let errorMessage = error.message;
        let errorStatus = 500;
        let errorDetails = null;

        if (error.response) {
            // Ошибка пришла от Nominatim (или сети)
            errorMessage = error.response.data?.message || error.response.statusText || 'Error fetching data from Nominatim';
            errorStatus = error.response.status || 500;
            errorDetails = error.response.data;
        } else if (error.request) {
            // Запрос был сделан, но ответ не получен
            errorMessage = 'No response received from Nominatim';
        }
        // Иначе это ошибка настройки axios или другая внутренняя ошибка

        if (logger && typeof logger.error === 'function') {
            logger.error(`[Geocoding] Error proxying to Nominatim: ${errorMessage}`, { status: errorStatus, details: errorDetails, query: req.query });
        } else {
            console.error(`[Geocoding] Error proxying to Nominatim: ${errorMessage}`, { status: errorStatus, details: errorDetails, query: req.query });
        }

        res.status(errorStatus).json({ 
          message: 'Error processing geocoding request', 
          details: errorDetails || errorMessage
        });
      }
    });

    module.exports = router;