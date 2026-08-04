<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

# Структура стилей проекта

## Обзор

Проект использует структурированный подход к организации стилей CSS для улучшения поддерживаемости, предотвращения конфликтов и обеспечения согласованности пользовательского интерфейса.

## Файлы стилей

- **variables.css** — токены: A тема (`--theme-*` + алиасы `--color-*`), B каркас (`--bp-*`, spacing, heights), C статусы, D фичи
- **element-plus-bridge.css** — мост `--el-*` → тема; импорт в `main.js` **после** `element-plus/dist/index.css` (иначе EP сбрасывает primary на `#409eff`)
- **base.css** — сброс, типографика, безопасный viewport (`width: 100%`, без `100vw`)
- **layout.css** — legacy/fallback оболочки; живой shell — `BaseLayout` + Header/Sidebar
- **global.css** — примитивы UI: `.page-container`, `.btn*`, `.form-*`, `.card`/`.panel`, `.alert*`, `.table-scroll`, утилиты
- Контракт и обход страниц: `docs.ru/back-docs/TZ_UI_STYLE_FOUNDATION.md`
- FIXED ≠ единый визуал: `docs.ru/back-docs/NOTE_STYLE_FIXED_VS_VISUAL.ru.md`
- Унификация кнопок/форм/блоков: классы из `global.css` + токены; scoped — только layout, не свои `#007bff` / Bootstrap grey

В `@media` — только литералы из контракта (`768px`, `480px`, …), не `var(--bp-*)`.

## Приоритеты использования стилей

1. **Компонентные scoped стили** - для стилей, специфичных для компонента
2. **global.css** - для общих классов, используемых в нескольких компонентах
3. **variables.css** - для общих переменных CSS во всем проекте

## Рекомендации по использованию

### Для новых компонентов:

1. Используйте scoped стили внутри файла компонента:
   ```vue
   <style scoped>
   .component-name {
     /* стили компонента */
   }
   </style>
   ```

2. Используйте глобальные классы для общих элементов:
   ```html
   <button type="button" class="btn btn-primary">Сохранить</button>
   <button type="button" class="btn btn-outline">Отмена</button>
   <input class="form-control" />
   <div class="card">…</div>
   ```

3. Используйте CSS-переменные вместо жестко закодированных значений:
   ```css
   .element {
     color: var(--color-primary);
     padding: var(--spacing-md);
   }
   ```

### Для существующих компонентов:

1. При обновлении компонента постепенно переносите стили из home.css в scoped стили компонента
2. Не удаляйте стили из home.css до полного тестирования всех зависящихся компонентов
3. Удаляйте scoped-переопределения `.btn` / `.btn-primary` / `.form-control`, если они дублируют `global.css`

## Глобальные CSS-классы

### Контейнеры
- `.page-container` — основной контейнер страницы
- `.card` / `.panel` — блок информации (panel — с border, без тени)
- `.alert`, `.alert-info|success|warning|danger` — статусные блоки

### Кнопки
- `.btn` — база
- `.btn-primary` — основная (зелёная)
- `.btn-secondary` — дополнительная (синяя заливка)
- `.btn-accent` — акцент
- `.btn-danger` — опасное действие
- `.btn-outline` / `.btn-outline-primary` — контур (отмена / вторичное)
- `.btn-ghost` — светлая заливка (nav, dismiss)
- `.btn-sm` / `.btn-block` / `.btn-icon` / `.btn-row` — размер, ширина, иконка, ряд

### Формы
- `.form-control` — input, select, textarea
- `.form-group` / `.form-label` / `.form-hint` / `.form-error` / `.form-actions`

### Утилиты
- `.text-center` - Выравнивание текста по центру
- `.d-flex` - Включение flex-контейнера
- `.mt-*`, `.mb-*` - Отступы сверху/снизу

## Процесс миграции

Постепенно мы переходим от использования большого глобального файла home.css к модульным scoped стилям в компонентах и более структурированным общим стилям.

1. Новые компоненты должны использовать только scoped стили и global.css
2. При обновлении существующих компонентов переносите стили из home.css
3. После полного перехода home.css будет удален 

## Выполненная миграция (обновлено)

Миграция стилей завершена для следующих компонентов:

1. **ChatInterface.vue** - перенесены стили интерфейса чата, включая адаптивные стили для мобильных устройств
2. **Message.vue** - перенесены стили для сообщений с разными типами вложений

Файл **home.css** переименован в **home.css.bak** и больше не используется в проекте. Ссылка на него удалена из **HomeView.vue**.

Для запуска проекта с проверкой стилей можно использовать команду:
```
yarn dev:styles
``` 