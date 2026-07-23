# ТЗ: ИИ-конференция — аудио-презентация агента по документам компании

**Статус:** к реализации  
**Продукт:** DLE (Digital Legal Entity)  
**Стек:** Vue 3 + Element Plus (frontend, yarn), Node.js (backend), PostgreSQL, Docker, Ollama/RAG (на VDS), OpenAI Realtime API (голос агента)  
**Язык UI:** i18n `ru.json` / `en.json`  
**Ограничения:** без самовольного деплоя на VDS, без смены моделей Ollama / рестарта Docker без явной команды пользователя.

---

## 1. Цель и эталонный сценарий

### 1.1. Цель

Редактор проводит конференцию с **уже созданным** пользователем-клиентом. На конференции:

- на экране — **видео** (участники / демонстрация экрана) и **чат**;
- по кнопке **«ИИ-агент»** агент на **языке клиента** проводит **аудио-презентацию** и отвечает на вопросы, опираясь на **документы/RAG в БД**;
- если агент «галлюцинирует», редактор голосом (PTT) или через чат даёт рекомендации/правила; агент использует их **до конца этой конференции**.

### 1.2. Эталонный пользовательский поток (обязательный)

```
1. Клиент передаёт редактору email.
2. Редактор: «Создать аккаунт» → в системе появляется пользователь
   (уникальный id, профиль, приватная беседа editor ↔ user).
3. Редактор на странице этого пользователя создаёт / настраивает конференцию
   (язык клиента, RAG/скрипт презентации, уведомление на email/TG).
4. На email клиента уходит magic link входа.
5. Клиент открывает magic link → аутентифицируется → попадает в свой аккаунт
   (чат с editor) → вкладка/экран «Конференция» → «Старт».
6. В комнате: редактор + клиент; UI: видео + чат.
7. Редактор нажимает «ИИ-агент» → агент ведёт аудио-презентацию на языке клиента.
8. Клиент задаёт вопросы (голос/чат) → ответы из RAG (доки компании).
9. При галлюцинациях редактор: Mute AI (опционально) + coach (голос PTT или чат)
   → правила копятся в session_coach_rules до status=ended.
```

**Жёстко:**

- Конференция **только** с зарегистрированными пользователями (не `guest_*`).
- Meeting-token / анонимная `/call/:token` — **не используем**.
- Вход участника — **magic link** на существующий `user_id`.

---

## 2. Роли и слои

| Роль | Кто | Действия |
|------|-----|----------|
| **host** | Editor | Создаёт аккаунт, конференцию, жмёт «ИИ-агент», Mute, coach, шарит экран/камеру |
| **participant** | Зарегистрированный клиент | Magic link → Старт; видит видео/чат; говорит с агентом; пишет в чат |
| **AI agent** | Не пользователь CRM | Аудио-презентация + Q&A по RAG; слушает coach |

| Слой | Технология | Назначение |
|------|------------|------------|
| Видео / экран | SFU (LiveKit — фаза B) | Редактор ↔ клиент |
| Чат | WS / datachannel | Переписка + текстовый coach + (позже перевод) |
| Голос агента | OpenAI Realtime (у браузера **клиента**) | Презентация и ответы |
| Знания | RAG на VDS (`multiSourceSearchService` / `ragService`) | Tool `search_company_docs` |
| Coach | Backend relay → Realtime `host_instruction` | Правила до конца сессии |
| Magic link | Backend one-time login | Вход в аккаунт клиента |

**Ресурсы VDS:** голос и TTS **не** на Ollama. Ollama — эмбеддинги/RAG как сейчас. OpenAI Realtime — облако.

---

## 3. Режимы ИИ-агента

### 3.1. Presentation

- Запуск: кнопка host **«ИИ-агент»** (`mode=presentation`).
- Источник структуры: RAG-таблица(ы) «Скрипт презентации» / поле `presentation_outline` + выбранные `rag_table_ids`.
- Язык речи: `guest_language`.
- Клиент может перебить вопросом → краткий ответ из RAG → продолжение презентации.

### 3.2. Q&A

- Ответы **только** с опорой на RAG (`search_rag_first=true`, `generate_if_no_rag=false`).
- Нет данных → не выдумывать; предложить уточнить у менеджера / «нет в базе».

### 3.3. Coach (накопительный до конца конференции)

```
session_coach_rules[]  — массив инструкций host
```

- Канал: **текстовый coach-чат** (обязателен в срезе A) и/или **PTT «Сказать агенту»** → STT → тот же текст.
- Клиент **не слышит и не видит** coach.
- При новой инструкции: interrupt текущей речи агента → учесть правило → продолжить для клиента на `guest_language`.
- Правила живут до `ended` этой `conference_session`.

### 3.4. Mute / Unmute AI

Кнопки host: остановить речь агента (`response.cancel` + mute playback) и возобновить.

---

## 4. Архитектурные решения (зафиксировано)

| Тема | Решение |
|------|---------|
| Владелец Realtime | Браузер **participant (клиент)** |
| Coach в Realtime | Не второй mic в OpenAI. Text / PTT→STT→text → backend → `host_instruction` |
| Ключ OpenAI | `ai_providers_settings` (не дублировать без нужды) |
| Permission MVP | `EDIT_CONTACTS` |
| Старт | **«Старт сейчас»** + опциональные дата/время и уведомление |
| История | Несколько сессий на пару editor–user; UI — последняя draft/scheduled + список |
| Multi (2–3) | После стабильного 1:1 (срез C) |
| Медиасервер | LiveKit, только после явного ОК на инфраструктуру VDS |
| PTT UX | Hold по умолчанию |
| Diarization по тембру | Не использовать |

```
Клиент (браузер)
  mic ──────────────────────────► OpenAI Realtime ──► голос агента
  ◄── video/screen ── SFU ◄──── Editor
  ◄── chat ────────────────────► Editor (+ coach side-channel только Editor↔Agent)

Editor
  «ИИ-агент» / Mute / Coach text|PTT ──► Backend ──► управление сессией Realtime
  Backend tool search_company_docs ◄── Realtime function call ──► RAG на VDS
```

---

## 5. Срезы поставки

### Срез A — «Презентация голосом» (первый рабочий продукт)

**В объёме:**

1. Кнопка «Конференция» на `/contacts/:id` (только registered user).
2. Страница настроек: вкладки **Конференция** / **ИИ-агент**.
3. CRUD сессии + настройки агента (промпт, RAG, языки, голос).
4. Magic link на email (и задел TG) → автологин → чат user↔editor → Старт.
5. Live UI: **чат + транскрипт + кнопка «ИИ-агент» + Mute + текстовый coach**.
6. OpenAI Realtime: презентация + Q&A + tool RAG.
7. `session_coach_rules` до конца конференции.
8. Видео можно **заглушкой** («видео в срезе B»), либо простой placeholder.

**Вне среза A:** LiveKit, PTT-голос coach (можно сразу после A), перевод чата, multi-участники, деплой без команды.

### Срез B — Видео / screen share

- SFU (LiveKit), камера/экран editor, клиент видит; аудио агента параллельно.
- Mic editor в эфир комнаты ≠ Realtime (Realtime mic editor только через PTT→STT coach).

### Срез C — Расширения

- Multi до 3 registered users.
- Перевод чата.
- PTT coach polish, аналитика сессий.

---

## 6. Фаза / срез A — детальная спецификация

### 6.1. Предпосылка: аккаунт клиента

- Редактор создаёт пользователя по email («Создать аккаунт» — существующий или дорабатываемый UX на `/contacts/new` / профиль).
- После создания: есть `users.id`, профиль, приватная беседа с editor.
- Без этого конференция недоступна.

### 6.2. Точка входа editor

- `/contacts/:id` → кнопка **«Конференция»** (скрыть/disable для `guest_*`).
- URL: `/contacts/:id/conference` и `/contacts/:id/conference/agent`.
- Live (после Старт): `/contacts/:id/conference/live` (host).
- Участник: deep-link после magic → user-facing чат с этим editor + экран конференции / Старт  
  (конкретный route user-side зафиксировать при реализации по существующим `personal-messages` / чату user↔admin; не CRM `/contacts/:id`).

Паттерн layout: как `BroadcastLayout` + `BroadcastNav`.

Файлы (ориентир):

| Файл | Назначение |
|------|------------|
| `ConferenceSectionLayout.vue` | Layout 1:1 внутри ContactDetailsLayout + nav |
| `ConferenceNav.vue` | Вкладки: Конференция / ИИ-агент |
| `ConferenceSettingsView.vue` | Форма сессии |
| `ConferenceAgentView.vue` | Настройки агента (паттерн `BroadcastAgentView.vue`) |
| `ConferenceLiveView.vue` | Live: чат, транскрипт, ИИ-агент, Mute, coach (срез A) |

### 6.3. Вкладка «Конференция»

| Поле | Тип | Обяз. | Описание |
|------|-----|-------|----------|
| `title` | string ≤200 | нет | Название |
| `scheduled_at` | datetime | нет | План; пусто = только «Старт сейчас» |
| `notify_email` | bool | нет | Magic link на email |
| `notify_telegram` | bool | нет | Magic link / уведомление в TG |
| `guest_language` | select | да | Язык презентации и ответов клиенту |
| `host_language` | select | да | Язык coach |
| `agent_voice` | select | нет | Голос Realtime |
| `presentation_outline` | text | нет | Краткий план; иначе из RAG |
| `notes` | text ≤2000 | нет | Заметки host (не клиенту) |
| `status` | read-only | — | `draft` \| `scheduled` \| `live` \| `ended` \| `cancelled` |

Действия: Сохранить; Сохранить и запланировать (+ очередь уведомлений); **Старт сейчас**.

Алерты: нет email/TG при включённых флагах.

### 6.4. Вкладка «ИИ-агент»

Глобальные настройки конференции-агента (singleton), паттерн broadcast-агента:

| Поле | Описание |
|------|----------|
| `enabled` | Вкл/выкл |
| `provider` | `openai` (Realtime) |
| `model` | Realtime-compatible модель |
| `system_prompt` | Роль: презентатор + Q&A только по базе; шифровать |
| `temperature`, `max_tokens`, `timeout_ms` | С лимитами; учесть отличия Realtime API |
| `rag_table_ids` | Мультиселект RAG-источников |
| `search_rag_first` | default true |
| `generate_if_no_rag` | default **false** |

На форме: статус ключа OpenAI из `ai_providers_settings` + ссылка в Settings AI.

### 6.5. Magic link

- Генерация при schedule/notify или при «Старт» + notify.
- Привязка: `user_id` участника + опционально `conference_id`.
- TTL (рекомендуется 24–72 ч), **one-time**, хранить hash.
- GET/открытие ссылки → создать session DLE за этого user → redirect в чат с editor + conference UI.
- Не путать с ephemeral OpenAI Realtime token.

### 6.6. Backend API (срез A)

Префикс: `/api/conference`.

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/contact/:contactId` | Список/текущая draft\|scheduled |
| `PUT` | `/contact/:contactId` | Создать/обновить |
| `POST` | `/:id/start` | status=live, сигналы участникам |
| `POST` | `/:id/end` | status=ended |
| `GET` | `/:id` | Детали сессии |
| `GET/PUT` | `/ai-agent/settings` | Настройки агента |
| `GET` | `/ai-agent/models` | Realtime-модели |
| `POST` | `/:id/magic-link` | Создать и (опц.) отправить |
| `GET` | `/auth/magic/:token` | Потратить magic link (или через `/api/auth/...`) |
| `POST` | `/:id/realtime/session` | Ephemeral Realtime client secret для participant |
| `POST` | `/:id/agent/start` | Запуск presentation |
| `POST` | `/:id/agent/mute` | Mute / unmute |
| `POST` | `/:id/coach` | Добавить rule (text); interrupt |
| `POST` | `/:id/tools/search_docs` | RAG tool для Realtime |

Auth: существующая session middleware.  
Host endpoints — editor + participant членство.  
Realtime session — только participant/host этой конференции.

Сервисы: `conferenceService.js`, `conferenceAiAgentService.js`, `conferenceMagicLinkService.js`, `conferenceRealtimeService.js`.

### 6.7. Миграции БД

После актуального номера миграций (сейчас после `111_...`):

**`conference_sessions`**

```text
id, contact_user_id, created_by,
title, notes_encrypted,
scheduled_at, notify_telegram, notify_email,
guest_language, host_language, agent_voice,
presentation_outline,
status, room_id,
started_at, ended_at,
created_at, updated_at
```

**`conference_participants`**

```text
conference_id, user_id, role ['host'|'participant'],
notified_via ['email'|'telegram'|'none'], joined_at
UNIQUE(conference_id, user_id)
```

**`conference_ai_agent_settings`** — singleton `id=1` (как broadcast agent) + rag flags/ids, prompt encrypted, timeout_ms.

**`conference_magic_links`**

```text
id, token_hash, user_id, conference_id NULL,
expires_at, used_at, created_at
```

**`conference_coach_rules`**

```text
id, conference_id, body_encrypted, created_by, created_at
```

**`conference_transcript_items`** (желательно в A)

```text
id, conference_id, role ['participant'|'agent'|'host_coach'],
text_encrypted, created_at
```

Индексы: `(contact_user_id, status)`, `(scheduled_at)`, magic `token_hash`.

`contact_user_id` — только registered user; проверка в сервисе (не опираться только на FK, если в CRM бывают нестандартные id).

### 6.8. i18n и стили

- Ключи `contacts.conference.*` в `ru.json` / `en.json`.
- Scoped styles, CSS-переменные проекта.
- yarn.

### 6.9. Критерии приёмки среза A

- [x] Аккаунт по email → конференция только для registered; `guest_*` отсечены.
- [x] Кнопка «Конференция» → две вкладки настроек → сохранение в БД.
- [x] Magic link логинит клиента в свой аккаунт и ведёт к Старт.
- [x] Старт сейчас → live UI (чат + транскрипт + ИИ-агент).
- [x] «ИИ-агент» запускает аудио-презентацию на `guest_language` (OpenAI Realtime WebRTC + ephemeral).
- [x] Вопросы клиента → ответы с RAG tool `search_company_docs`; без RAG не выдумывает (флаг `generate_if_no_rag`).
- [x] Текстовый coach меняет поведение до конца сессии; клиент coach не видит.
- [x] Mute / Unmute AI работает.
- [x] Ключи/промпт не светятся в логах клиента; magic one-time (hash в БД).
- [x] Нет деплоя на VDS без команды.

### 6.10. Критерии приёмки среза B (локально)

- [x] Self-hosted LiveKit в Docker (`dapp-livekit`, `--dev`) + JWT `/livekit/token`.
- [x] UI камера / экран / mic комнаты; автоподключение при входе в live.
- [x] Mic LiveKit ≠ OpenAI Realtime (Realtime mic только через PTT→STT coach).
- [x] Без LiveKit Cloud / без деплоя на VDS без команды.

**Вне локального B:** прод-ключи, WSS/nginx, TURN, выкат на VDS.

**Срез C / multi:** 1:1 — `/contacts/:id/conference`. Multi (2–3) — отдельный хаб `/conferences` (не страница одного контакта; без группового personal-messages).

### 6.11. Критерии приёмки среза C (локально)

- [x] Multi до 3 registered в `conference_participants` + поиск/добавление в UI настроек.
- [x] Отдельный хаб `/conferences` для 2–3 участников; bulk с contacts-list.
- [x] Magic link на каждого участника; multi → сразу live; 1:1 primary → чат editor.
- [x] Перевод чата через OpenAI (`ai_providers_settings`), sync `host_language` ↔ `guest_language`; оригинал + перевод в UI.
- [x] Realtime owner = primary contact (остальные — видео/чат).
- [x] PTT hold → STT → сразу coach.
- [x] Analytics snapshot при end (`analytics_json`).
- [x] Без деплоя на VDS / без группового personal-messages.

---

## 7. Срезы B и C (кратко)

### B — Видео

- LiveKit (или выбранный SFU) в Docker — **локально сделано**; на VDS — **только с разрешения**.
- Параллельно: audio агента + audio/video комнаты.
- TURN при необходимости (прод / NAT).

### C — Multi / перевод

- До 3 participants (registered) — **локально сделано**.
- Перевод чата OpenAI; синхрон с `guest_language` / `host_language`.
- PTT coach polish, аналитика сессий.

---

## 8. Безопасность

- Magic link: TTL, one-time, hash, только существующий participant.
- Не отдавать system_prompt и API keys клиенту.
- Ephemeral Realtime — short-lived, на conference_id.
- Coach и notes — не в UI participant.
- Шифрование чувствительных полей как в остальном DLE.

---

## 9. Что переиспользовать

| Компонент | Путь |
|-----------|------|
| Broadcast layout/nav/agent UI | `BroadcastLayout.vue`, `BroadcastNav.vue`, `BroadcastAgentView.vue` |
| Broadcast agent service/migrations | `broadcastAiAgentService.js`, `109_…`, `111_…` |
| Контакт | `ContactDetailsLayout.vue`, создание `/contacts/new` |
| RAG | `multiSourceSearchService.js`, `ragService.js` |
| Ключи AI | `aiProviderSettingsService.js` |
| Email/TG отправка | `emailBot.js`, `telegramBot` / broadcast send patterns |
| Auth session | `auth-service.js`, `useAuth.js` |

---

## 10. Не делать без явной команды

- Деплой / rsync / restart Docker на VDS.
- Pull/delete моделей Ollama.
- Ставить LiveKit в прод без разрешения.
- Рефакторинг всего CRM «заодно».
- Анонимные комнаты / meeting-token вместо magic link.
- Локальный Whisper+TTS+LLM для live-презентации на том же VDS как основной путь.

---

## 11. Порядок работ исполнителю

1. Прочитать это ТЗ и файлы §9.  
2. Миграции §6.7.  
3. API настроек сессии + агента.  
4. Frontend: кнопка, layout, вкладки, i18n.  
5. Magic link + deep-link в user chat.  
6. Live UI + Realtime presentation/Q&A + RAG tool + coach text + Mute.  
7. Чеклист §6.9; отчёт: что сделано / что ушло в B–C.

---

## 12. Definition of Done

**Срез A:** редактор создаёт пользователя по email, настраивает конференцию, клиент входит по magic link, нажимает Старт, редактор запускает ИИ-агента — агент проводит аудио-презентацию и отвечает по RAG; coach-правила редактора действуют до конца конференции; видео может быть stub до среза B.

---

## 13. Глоссарий

| Термин | Значение |
|--------|----------|
| participant | Зарегистрированный клиент в комнате (не CRM `guest_*`) |
| magic link | One-time login URL на существующий `user_id` |
| meeting token | Анонимный вход в комнату — **не используем** |
| coach | Инструкция host агенту, скрытая от клиента |
| Realtime ephemeral | API-токен OpenAI для голосовой сессии |
