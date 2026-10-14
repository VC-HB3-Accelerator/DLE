# Plan B — mass (канон)

Единственный контур поиска и attach для listing media:

| Скрипт | Назначение |
|--------|------------|
| `listing-photo-search-b-host.mjs` | Yandex → `/tmp/objfix-b/{id}/` |
| `attach-listing-objfix-b.js` | objfix → `listing_media` в БД |
| `normalize-listing-feed-image.js` | 4:3 JPEG для ленты |
| `clear-listing-page-ids.js` | очистка фото по `PAGE_IDS` |
| `list-under8-page-ids.js` | id с `< 8` фото |

Запуск:

- один батч: `PAGE_IDS=… ./backend/scripts/run-listing-b-pipeline.sh`
- parallel: `PAGE_IDS=… WORKERS=4 ./backend/scripts/run-listing-b-parallel.sh`
- весь каталог `<8`: `./backend/scripts/run-listing-b-mass-batches.sh`

Общие зависимости (не дублировать): `../listing-spawn-json.js`, `../listing-photo-safety-critic.js`.

Не использовать `/tmp/*.mjs` и старые `backend/scripts/listing-photo-search-b*.mjs` — удалены.
