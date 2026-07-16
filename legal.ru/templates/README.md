[English](../legal.en/templates/README.md) | **Русский**

# Шаблоны договоров DLE (контрибьютор)

## Назначение

Готовые **модельные документы** для авторизованного контрибьютора при продаже лицензии DLE клиенту в **любой юрисдикции**. Заполните поля `[…]`; не ослабляйте EULA и service-terms.

| Слой | Документ |
|------|----------|
| Автор ↔ Контрибьютор | [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) |
| Контрибьютор ↔ Клиент | шаблоны ниже |
| Клиент ↔ Правообладатель (IP) | [LICENSE.ru](../../LICENSE.ru) + on-chain токен |
| Коммерческие условия продукта | [service-terms.md](../service-terms.md) |

```
Автор ── CONTRIBUTOR_LICENSE ──► Контрибьютор
                                      │
                                      ├── Договор + Спецификация + Акт (шаблоны)
                                      │         ├── Прил. EULA
                                      │         └── Прил. service-terms
                                      ▼
                                 Клиент + Sepolia-токен = акцепт EULA
```

---

## Документы контрибьютор ↔ клиент

| Файл | Назначение |
|------|------------|
| [contributor-client-agreement.md](contributor-client-agreement.md) | Модельный договор поставки лицензии |
| [contributor-client-specification.md](contributor-client-specification.md) | Спецификация / заявка / счёт |
| [contributor-client-acceptance-act.md](contributor-client-acceptance-act.md) | Акт приёмки и фиксации Tx |

Идентификаторы: **CCA / CCS / CAA-DLE-2026-07-16**.

---

## Что заполняется локально

- Реквизиты сторон, валюта, налоги, способ оплаты  
- Применимое право и суд / арбитраж (п. 10 договора)  
- Документы по ПДн / DPA  
- При необходимости: SLA, ИБ, госзакупки  

**Неизменно (если закон не улучшает клиента):** self-hosted; продавец ≠ правообладатель исходного кода; Sepolia для акцепта EULA; неотзыв / актив экземпляра по EULA § 6.4, § 14; возврат 70% — должник автор.

---

## Устаревшие файлы

Удалены (2026-07-16): `client-license-contract.md`, `contributor-author-contract.md`.  
Автор ↔ Контрибьютор → [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md).  
Контрибьютор ↔ Клиент → файлы `contributor-client-*` выше.

---

**© 2024-2026 Тарабанов Александр Викторович**  
**Обновление:** 2026-07-16
