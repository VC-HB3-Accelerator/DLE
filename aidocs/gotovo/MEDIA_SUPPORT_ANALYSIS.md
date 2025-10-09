# Анализ поддержки медиа-контента в системе

## Реальные ограничения из кода

### 1. Frontend (ChatInterface.vue)
**Поддерживаемые форматы:**
```javascript
accept = '.txt,.pdf,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4,.avi,.docx,.xlsx,.pptx,.odt,.ods,.odp,.zip,.rar,.7z'
```

**Типы файлов:**
- **Текст:** .txt
- **PDF:** .pdf  
- **Изображения:** .jpg, .jpeg, .png, .gif
- **Аудио:** .mp3, .wav
- **Видео:** .mp4, .avi
- **Документы:** .docx, .xlsx, .pptx, .odt, .ods, .odp
- **Архивы:** .zip, .rar, .7z

### 2. Backend - Uploads (uploads.js)
**Ограничения для изображений:**
- **Размер:** 5MB максимум
- **Форматы:** только изображения (png, jpg, jpeg, gif, webp)
- **Проверка:** по расширению файла И MIME-типу

```javascript
limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
fileFilter: (req, file, cb) => {
  const ok = /(png|jpg|jpeg|gif|webp)$/i.test(file.originalname || '') && 
             /^image\//i.test(file.mimetype || '');
}
```

### 3. Backend - Email Bot (emailBot.js)
**Ограничения для вложений:**
- **Размер:** 10MB максимум
- **Форматы:** любые (без фильтрации)
- **Обработка:** автоматическое извлечение из email

```javascript
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
```

### 4. Backend - Telegram Bot (telegramBot.js)
**Поддержка медиа:**
- **Документы:** любые (через ctx.message.document)
- **Фото:** автоматически (ctx.message.photo)
- **Аудио:** любые (ctx.message.audio)
- **Видео:** любые (ctx.message.video)
- **Размер:** ограничения Telegram API (обычно до 50MB)

**Извлекаемые данные:**
```javascript
// Документы
fileId = ctx.message.document.file_id;
fileName = ctx.message.document.file_name;
mimeType = ctx.message.document.mime_type;
fileSize = ctx.message.document.file_size;

// Фото (берется самое большое)
const photo = ctx.message.photo[ctx.message.photo.length - 1];

// Аудио
fileName = ctx.message.audio.file_name || 'audio.ogg';
mimeType = ctx.message.audio.mime_type || 'audio/ogg';

// Видео  
fileName = ctx.message.video.file_name || 'video.mp4';
mimeType = ctx.message.video.mime_type || 'video/mp4';
```

## Итоговые рекомендации для UniversalMediaProcessor

### Поддерживаемые форматы (основано на реальном коде):
```javascript
supportedAudioFormats: ['.mp3', '.wav'],
supportedVideoFormats: ['.mp4', '.avi'], 
supportedImageFormats: ['.jpg', '.jpeg', '.png', '.gif'],
supportedDocumentFormats: ['.txt', '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp'],
supportedArchiveFormats: ['.zip', '.rar', '.7z']
```

### Ограничения размеров:
```javascript
maxFileSize: 10 * 1024 * 1024, // 10MB (как в emailBot)
maxImageSize: 5 * 1024 * 1024,  // 5MB (как в uploads.js)
```

### Особенности по каналам:

1. **Web (frontend):**
   - Множественный выбор файлов
   - Предпросмотр перед отправкой
   - Ограничения браузера (~2GB)

2. **Telegram:**
   - Автоматическое определение типа медиа
   - Поддержка всех типов файлов
   - Ограничения Telegram API (до 50MB)

3. **Email:**
   - Извлечение вложений из писем
   - Фильтрация по размеру (10MB)
   - Поддержка любых форматов

## Выводы

1. **Система уже поддерживает** большинство популярных форматов файлов
2. **Размеры файлов** ограничены разумными пределами (5-10MB)
3. **Каждый канал** имеет свои особенности обработки
4. **UniversalMediaProcessor** должен учитывать эти ограничения
5. **Telegram** имеет наибольшую гибкость, **Web** - наибольший контроль

## Следующие шаги

1. ✅ Создать UniversalMediaProcessor с реальными ограничениями
2. ⏳ Интегрировать с существующими ботами
3. ⏳ Добавить валидацию MIME-типов
4. ⏳ Реализовать обработку ошибок для больших файлов
5. ⏳ Добавить логирование обработки медиа
