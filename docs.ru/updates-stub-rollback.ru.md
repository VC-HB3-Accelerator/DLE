# Откат stub_mode updates (hub HB3)

**Когда:** ложные deny из‑за RPC / auth_tokens / казны после выключения stub.  
**Где:** Settings → Updates на **раздающем** HB3 (`hub_url=self`), либо SQL ниже.  
**Без деплоя/рестарта**, если меняете только флаг в БД.

## Включить stub (инцидент)

UI: чекбокс **Stub mode** → сохранить.

SQL:

```sql
UPDATE updates_hub_settings SET stub_mode = true, updated_at = NOW() WHERE id = 1;
```

После сохранения кэш entitlement сбрасывается при `saveSettings`; при прямом SQL — подождать TTL (~45 с) или рестарт backend **только по явной команде**.

## Выключить stub (после чеклиста)

Только по явной команде оператора.

1. `auth_tokens` на HB3 заполнены (license ERC-20 + `min_balance` + сеть).  
2. RPC для этих сетей живы.  
3. Тестовый DLE с токеном на Treasury → authorize OK.  
4. DLE без казны / ниже порога → 403.  

UI: снять Stub mode → сохранить, либо:

```sql
UPDATE updates_hub_settings SET stub_mode = false, updated_at = NOW() WHERE id = 1;
```

## Аудит

Отказы/успехи: таблица `update_entitlement_audit` (миграция `128_update_entitlement_audit.sql`) и логи `updates.entitlement.*`.
