# ТЗ: entitlement обновлений ОС — license-токен на казне DLE (hub HB3)

**Статус:** к реализации  
**Продукт:** DLE (Digital Legal Entity)  
**Контур:** закрытая раздача update-pack (`/api/updates/*`)  
**Hub:** только инстанс **HB3** — https://hb3-accelerator.com  
**Стек:** Node.js (backend), Vue 3 (settings UI, yarn), PostgreSQL, ethers.js, Docker  
**Ограничения:** без самовольного деплоя на VDS / рестартов Docker без явной команды; yarn и Docker по правилам проекта.

---

## 1. Цель

Раздавать update-pack **только** смарт-контрактам DLE, у которых на **балансе казны (TreasuryModule)** есть **лицензионный токен** из списка токенов, заведённых на hub HB3 в настройках безопасности:

**https://hb3-accelerator.com/settings/security** → блок «Аутентификация» → таблица `auth_tokens`.

Пока проверка не готова, используется `stub_mode` в БД (`updates_hub_settings`). После внедрения entitlement stub на продакшен-hub **выключается**.

### 1.1. Жёсткие правила продукта

| Правило | Значение |
|--------|----------|
| Кто получает обновления | Только DLE с лицензией на казне |
| Где лежит лицензия | Баланс **TreasuryModule** этого DLE |
| Какие токены считаются лицензией | Только записи `auth_tokens` на **hub HB3** (не на клиентских инстансах) |
| Порог «есть лицензия» | `balanceOf(treasury) ≥ min_balance` из соответствующей строки `auth_tokens` |
| Где выполняется проверка | **Только на hub HB3** при выдаче download-token / отдаче pack |
| Клиентский инстанс | Не дублирует entitlement: запрашивает pack у hub по API |

Необновляемые и нелицензированные DLE (нет токена на казне / баланс ниже порога / нет TreasuryModule) — **отказ** (не stub).

---

## 2. Текущее состояние (as-is)

| Компонент | Сейчас |
|-----------|--------|
| `backend/services/updatesService.js` → `assertEntitled` | Заготовка: при `stub_mode=true` пропускает A+B; иначе **501** |
| `updates_hub_settings.stub_mode` | Источник правды в БД (UI: Settings → Updates). Дефолт `true` |
| Env `UPDATES_STUB_MODE` | Наследие в docker-compose; **бекенд не читает** — не использовать как источник истины |
| i18n hint | Текст ещё говорит «UPDATES_STUB_MODE» — привести к `stub_mode` (БД) |
| `auth_tokens` + RPC | Уже есть: Security settings, `tokenBalanceService`, `rpcProviderService` |
| TreasuryModule | Есть `balanceOf(token)` / учёт ERC20 на казне |
| Раздача | Download-token TTL, pack dir / Gitea, apply на клиенте — уже в контуре updates |

---

## 3. Целевая модель (to-be)

### 3.1. Слои entitlement

Единая проверка на hub перед `authorizeDownload` / выдачей pack:

```
Вход: dleContract (address), опционально userId / walletAddress (аудит)

1) Валидация адреса DLE (0x…40).
2) Резолв адреса TreasuryModule для этого DLE в сети(ях) license-токенов.
3) Загрузить список license-токенов = auth_tokens с БД hub HB3.
4) Для каждого токена (или до первого успеха — см. §3.3):
     RPC сети токена → ERC20.balanceOf(treasuryAddress)
     OK, если balance ≥ token.min_balance
5) Успех ≥ по одному подходящему токену → выдать download-token.
   Иначе → 403 (не 501), причина в аудит-лог (без утечки лишних деталей клиенту).
6) stub_mode=true → пропуск 2–5 (только для отладки; на prod hub — false).
```

**Слой A (обязательный):** license на казне = `balanceOf(TreasuryModule)`.  
**Слой B (упрощённо / не как отдельный gate):** «какие токены являются license» = только whitelist `auth_tokens` hub; отдельный gate «DLE в auth_tokens» **не** требуется — в `auth_tokens` лежат **адреса токенов-лицензий**, не адреса DLE.

### 3.2. Источник whitelist токенов

- Таблица: `auth_tokens` (шифрование полей как сейчас).
- UI управления: `/settings/security` на **hb3-accelerator.com**.
- Поля, используемые entitlement:

| Поле | Назначение |
|------|------------|
| `address` | ERC20 license-токена |
| `network` | Сеть (маппинг на `chain_id` через RPC providers) |
| `min_balance` | Минимальный баланс на казне для допуска |
| `name` | Для логов / админ-диагностики |

Клиентские инстансы DLE могут иметь свои `auth_tokens` для **логина в приложение** — они **не** участвуют в entitlement обновлений. Whitelist обновлений читается **только** из БД hub при обработке запроса на hub.

### 3.3. Логика «достаточно одного»

Если в `auth_tokens` несколько license-токенов (Standard / Premium / тестовые):

- DLE **entitled**, если **хотя бы по одному** токену:  
  `balanceOf(treasury, token.address) ≥ token.min_balance` в сети этого токена.
- Иначе — отказ.
- Рекомендация: short-circuit на первом успехе; остальные токены не дергать без нужды.

### 3.4. Резолв казны

1. По `dleContract` + `chainId` сети license-токена получить инстанс DLE (ethers + ABI).
2. `treasuryAddress = dle.getModuleAddress(keccak256("TREASURY"))` (как в существующих routes модулей).
3. Если treasury = `0x0` / модуль не подключён → **не entitled** (казна обязательна).
4. `IERC20(token).balanceOf(treasuryAddress)`.

Смотреть баланс на адресе **самого DLE** вместо TreasuryModule — **нельзя** (исключено решением по продукту).

### 3.5. Мультисеть и RPC

- Сеть берётся из `auth_tokens.network` → `chain_id` через `rpcProviderService` (как `tokenBalanceService`).
- Если у DLE нет деплоя / RPC в сети токена — этот токен не даёт entitlement; пробовать следующий.
- Таймаут RPC, ретраи (минимум 2 попытки), единый лог ошибок (`timeout`, `ECONNREFUSED`, и т.д.).
- Кэш результата entitlement на короткий TTL (рекомендуется 30–60 с) по ключу `(dleContract, network/token)` — снижение нагрузки на RPC при повторных скачиваниях; при `stub_mode` кэш не нужен.

### 3.6. Где выполняется (hub-only)

```
Клиентский инстанс                         Hub HB3
─────────────────                         ────────
Settings → Updates                        assertEntitled()
  dleContract ──authorize / apply──────►  auth_tokens + Treasury balanceOf
                                          download-token / pack / Gitea URL
```

- Endpoint’ы выдачи pack / authorize download на hub вызывают `assertEntitled`.
- Клиент передаёт `dleContract` своего установленного DLE.
- Сервисный `hub_service_token` **не** отменяет entitlement (если не оговорено иначе для внутренних CI — вынести в явный admin bypass отдельно; по умолчанию **нет bypass**).

---

## 4. API и коды ответа

| Ситуация | HTTP | Поведение |
|----------|------|-----------|
| stub_mode | — | Как сейчас, OK + warn в лог |
| Невалидный `dleContract` | 400 | Сейчас есть |
| Нет published release | 404 | Сейчас есть |
| Нет TreasuryModule / баланс &lt; min_balance / RPC fail без успеха | 403 | `Not entitled to updates` (общее сообщение) |
| Entitlement ещё stub/off и код не готов | не использовать 501 в проде | После внедрения — только 403/400/404 |
| Успех | 200 | Download-token / redirect / stream как сейчас |

Клиенту **не** отдавать: точные балансы, список всех auth_tokens, внутренние RPC URL. В **аудит-лог hub** — да: dle, treasury, token, network, balance, min_balance, result, request id.

---

## 5. Настройки и UI

### 5.1. Hub settings (Updates)

- Чекбокс **Stub mode** остаётся для отладки.
- На prod HB3 после приёмки: `stub_mode = false`.
- Подсказка i18n (ru/en): заменить устаревшее «UPDATES_STUB_MODE» на формулировку про **проверку license-токена на казне DLE** и whitelist из Security.

### 5.2. Security (auth_tokens)

- Без нового UI, если хватает текущих полей `address / network / min_balance`.
- В доке/подсказке Security (опционально): «эти токены также используются hub для допуска DLE к обновлениям ОС (баланс на казне)».
- Менять `min_balance` на HB3 = менять порог допуска к updates.

### 5.3. Клиент Updates UI

- При 403 — понятное сообщение: нет лицензии на казне / обратитесь к контрибьютору / проверьте модуль казны.
- Не показывать stub-hint, если `stubMode=false`.

---

## 6. Аудит и наблюдаемость

Обязательные события в логах hub (structured / warn+info):

- `updates.entitlement.ok` — dle, treasury, token, network, balance, min_balance  
- `updates.entitlement.deny` — причина: `no_treasury` | `below_min` | `rpc_error` | `no_auth_tokens` | `invalid_dle`  
- `updates.entitlement.stub` — при пропуске  

Хранение в БД (рекомендуется, фаза full): таблица вида `update_entitlement_audit` (dle_contract, result, reason, token_address, chain_id, checked_at) — без секретов.

---

## 7. Безопасность

- Entitlement только server-side на hub.
- Не доверять клиентскому «у меня есть лицензия».
- `hub_service_token` защищает машинный доступ к API, но **не** заменяет проверку казны (по умолчанию).
- Rate-limit authorize (защита от перебора RPC за чужой счёт) — желательно.
- Ошибка RPC ≠ silent allow: при невозможности проверить ни один токен → **deny**.

---

## 8. Этапы реализации

### Этап 1 — ядро entitlement (обязательный MVP+)

1. Сервис `updatesEntitlementService` (или расширение `updatesService.assertEntitled`):
   - загрузка `auth_tokens`;
   - резолв TreasuryModule;
   - `balanceOf` + сравнение с `min_balance`;
   - stub_mode short-circuit.
2. Подключить в `authorizeDownload` и любые пути выдачи pack на hub.
3. Коды 403 + логи.
4. Unit/integration tests с моками RPC и модулей.

### Этап 2 — устойчивость (full)

1. Ретраи RPC, таймауты, кэш TTL.
2. Аудит-таблица.
3. Rate-limit.
4. i18n (stub hint, 403 на клиенте).
5. Прогон на Sepolia против реального DLE + Treasury + license token из auth_tokens HB3.

### Этап 3 — выключение stub на prod hub

1. Чеклист: auth_tokens заполнены, RPC живы, тестовый entitled/deny DLE.
2. `stub_mode=false` на HB3 **только по явной команде**.
3. Документ отката: снова `stub_mode=true` при инциденте RPC/False deny.

Оценка трудозатрат (ориентир): этап 1 — 1–2 дня; этапы 2–3 — ещё 2–5 дней (итого ~3–7 р.д. full).

---

## 9. Критерии приёмки

- [ ] При `stub_mode=false` DLE **без** TreasuryModule не получает pack (403).
- [ ] При `stub_mode=false` DLE с казной, где `balanceOf(license) < min_balance` по всем `auth_tokens` — 403.
- [ ] При `stub_mode=false` DLE с казной, где хотя бы по одному auth_token баланс ≥ `min_balance` — скачивание OK.
- [ ] Изменение `min_balance` / состава `auth_tokens` на HB3 Security сразу влияет на допуск (с учётом TTL кэша, если включён).
- [ ] Клиентский инстанс **не** читает свои local `auth_tokens` для entitlement updates.
- [ ] Env `UPDATES_STUB_MODE` не требуется для работы; управление — БД `stub_mode`.
- [ ] Аудит-логи содержат deny/ok с причинами.
- [ ] На prod HB3 stub выключен только после чеклиста; откат задокументирован.
- [ ] Нет деплоя/рестарта VDS без явной команды в рамках этой задачи (локальная разработка / PR).

---

## 10. Вне скоупа

- Смена экономики лицензии / выпуск новых ERC20.
- Перенос whitelist токенов с Security в отдельную таблицу «update_license_tokens» (не нужно, пока хватает `auth_tokens`).
- Entitlement на клиентском инстансе без hub.
- Проверка баланса на адресе DLE вместо TreasuryModule.
- Ончейн-подписи / merkle proof от казны (достаточно RPC `balanceOf` на момент запроса).
- Изменение юридических текстов (service-terms) — при расхождении с формулировкой «токен на кошельке» зафиксировать, что **контур ОС-обновлений** привязан к **казне DLE**; правка legal — отдельная задача.

---

## 11. Связанные файлы (ориентир)

| Область | Путь |
|---------|------|
| Entitlement stub | `backend/services/updatesService.js` |
| Hub settings | `backend/services/updatesHubSettingsService.js` |
| Routes | `backend/routes/updates.js` |
| Auth tokens | `backend/services/authTokenService.js`, `backend/routes/settings.js` |
| Balance/RPC | `backend/services/tokenBalanceService.js`, `rpcProviderService` |
| Treasury | `backend/contracts/TreasuryModule.sol`, routes модулей DLE |
| UI Updates | `frontend/src/views/settings/UpdatesSettingsView.vue` |
| UI Security | `frontend/src/views/settings/SecuritySettingsView.vue` |
| i18n | `frontend/src/locales/settings.ru.json`, `settings.en.json` |
| Условия обновлений (legal) | `legal.ru/service-terms.md` § 4 |

---

## 12. Решения, зафиксированные в ТЗ

| Тема | Решение |
|------|---------|
| Объект допуска | Смарт-контракт DLE |
| Место license | Баланс **TreasuryModule** |
| Whitelist токенов | `auth_tokens` **только** на hub HB3 (`/settings/security`) |
| Порог | `min_balance` из `auth_tokens` |
| Где проверка | Только hub HB3 |
| Несколько токенов | Достаточно одного подходящего |
| Нет казны / RPC fail | Deny |
| Stub | БД `stub_mode`; prod выключить после приёмки |

---

**Последнее обновление:** 2026-08-02
