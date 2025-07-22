# РУКОВОДСТВО ПО БЕЗОПАСНОЙ ПУБЛИКАЦИИ НА GITHUB
## Как правильно опубликовать проект DLE

### ✅ **ЧТО МОЖНО ПУБЛИКОВАТЬ:**

#### **Авторские права и лицензии:**
- `LICENSE.md` - Основная лицензия проекта
- `AUTHORS.md` - Информация об авторах
- `CONTRIBUTING.md` - Правила для контрибьюторов
- `COPYRIGHT_NOTICE.md` - Шаблоны копирайтов
- `TERMS_OF_SERVICE.md` - Условия использования

#### **Защита интеллектуальной собственности:**
- `ATTRIBUTION_REQUIREMENTS.md` - Требования к атрибуции
- `USAGE_NOTIFICATION.md` - Уведомления об использовании
- `COMMERCIAL_LICENSE_REQUEST.md` - Запрос коммерческой лицензии

#### **Общая документация:**
- `README.md` - Основная документация
- `GITHUB_PROTECTION_STRATEGY.md` - Стратегия защиты (без секретов)

### 🔒 **ЧТО НЕЛЬЗЯ ПУБЛИКОВАТЬ:**

#### **Патентные документы (папка `patents/`):**
- `PATENT_APPLICATION.md` - Заявка на патент
- `PATENT_DRAWINGS.md` - Чертежи для патента
- `PATENT_DRAWINGS_REAL.md` - Реальные чертежи
- `INNOVATION_PROCESS.md` - Инновационные процессы
- `TECHNICAL_SPECIFICATIONS.md` - Технические спецификации
- `REGISTRATION_PLAN.md` - План регистрации
- `JURISDICTION.md` - Юрисдикционные аспекты

### 📋 **ПЛАН ПУБЛИКАЦИИ:**

#### **Этап 1: Подготовка (СЕЙЧАС)**
```bash
# 1. Проверить .gitignore
cat .gitignore | grep -A 20 "ПАТЕНТНЫЕ ДОКУМЕНТЫ"

# 2. Убедиться, что патентные файлы не отслеживаются
git status

# 3. Проверить, что папка patents/ не попадет в репозиторий
git check-ignore legal/patents/
```

#### **Этап 2: Создание публичной версии**
```bash
# 1. Создать новую ветку для публикации
git checkout -b public-release

# 2. Удалить конфиденциальные файлы (если они попали в git)
git rm -r --cached legal/patents/ 2>/dev/null || true

# 3. Добавить только публичные файлы
git add legal/LICENSE.md
git add legal/AUTHORS.md
git add legal/CONTRIBUTING.md
git add legal/COPYRIGHT_NOTICE.md
git add legal/TERMS_OF_SERVICE.md
git add legal/ATTRIBUTION_REQUIREMENTS.md
git add legal/USAGE_NOTIFICATION.md
git add legal/COMMERCIAL_LICENSE_REQUEST.md
git add legal/README.md

# 4. Проверить, что патентные файлы не добавлены
git status
```

#### **Этап 3: Публикация**
```bash
# 1. Создать коммит
git commit -m "Add legal documentation and protection files"

# 2. Отправить в репозиторий
git push origin public-release

# 3. Создать Pull Request для main ветки
# 4. Проверить, что патентные файлы не попали в PR
```

### 🔍 **ПРОВЕРКА БЕЗОПАСНОСТИ:**

#### **Перед публикацией:**
```bash
# 1. Проверить .gitignore
grep -r "patents" .gitignore

# 2. Проверить, что файлы не отслеживаются
git ls-files | grep -E "(PATENT|INNOVATION|TECHNICAL)"

# 3. Проверить содержимое коммита
git diff --cached --name-only

# 4. Проверить, что патентные файлы не попадут
git check-ignore legal/patents/PATENT_APPLICATION.md
```

#### **После публикации:**
```bash
# 1. Проверить на GitHub, что патентные файлы не видны
# 2. Убедиться, что .gitignore работает
# 3. Проверить, что лицензии и авторские права видны
```

### 📁 **ИТОГОВАЯ СТРУКТУРА:**

```
legal/
├── patents/                    # 🔒 КОНФИДЕНЦИАЛЬНО
│   ├── PATENT_APPLICATION.md   # НЕ ПУБЛИКОВАТЬ
│   ├── INNOVATION_PROCESS.md   # НЕ ПУБЛИКОВАТЬ
│   └── ...                     # НЕ ПУБЛИКОВАТЬ
├── LICENSE.md                  # ✅ ПУБЛИКОВАТЬ
├── AUTHORS.md                  # ✅ ПУБЛИКОВАТЬ
├── CONTRIBUTING.md             # ✅ ПУБЛИКОВАТЬ
├── COPYRIGHT_NOTICE.md         # ✅ ПУБЛИКОВАТЬ
├── TERMS_OF_SERVICE.md         # ✅ ПУБЛИКОВАТЬ
├── ATTRIBUTION_REQUIREMENTS.md # ✅ ПУБЛИКОВАТЬ
├── USAGE_NOTIFICATION.md       # ✅ ПУБЛИКОВАТЬ
├── COMMERCIAL_LICENSE_REQUEST.md # ✅ ПУБЛИКОВАТЬ
└── README.md                   # ✅ ПУБЛИКОВАТЬ
```

### ⚠️ **ВАЖНЫЕ ПРЕДУПРЕЖДЕНИЯ:**

1. **НЕ публикуйте патентные документы** до подачи заявки на патент
2. **Проверяйте .gitignore** перед каждым коммитом
3. **Используйте приватные репозитории** для разработки
4. **Консультируйтесь с патентным поверенным** перед публикацией

### 🎯 **РЕКОМЕНДАЦИИ:**

#### **Для разработки:**
- Используйте приватный репозиторий
- Храните патентные документы в папке `legal/patents/`
- Регулярно обновляйте .gitignore

#### **Для публикации:**
- Создавайте отдельную ветку
- Проверяйте содержимое коммитов
- Публикуйте только разрешенные файлы

#### **Для защиты:**
- Подайте заявку на патент ДО публикации
- Используйте строгую лицензию
- Мониторьте использование кода

---

**Автор:** Тарабанов Александр Викторович  
**Дата:** 2024-2025  
**Контакты:** info@hb3-accelerator.com 