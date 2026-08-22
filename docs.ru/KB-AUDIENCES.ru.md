# База знаний агента — три аудитории

ИИ-агент **классифицирует**, с кем говорит, и берёт корпус только своей аудитории.

| Корпус | Папка | Кто слушает | Оси внутри |
|--------|-------|-------------|------------|
| Клиент продукта | [`kb-wave1/`](../data-room/Source_Documents/ru/kb-wave1/README.ru.md) | `public-client` | UI закрыт; смысл+RAG — ТЗ [`00-MASTER-TZ-WAVE1B-CANON-RAG.ru.md`](../data-room/Source_Documents/ru/kb-wave1/00-MASTER-TZ-WAVE1B-CANON-RAG.ru.md) |
| Партнёр — компания-поставщик или компания-подрядчик | [`kb-partner/`](../data-room/Source_Documents/ru/kb-partner/README.ru.md) | `partner` | **`interested/` · `member/` · `faq/`** |
| Инвестор | [`kb-investor/`](../data-room/Source_Documents/ru/kb-investor/README.ru.md) | `investor-a` | **`interested/` · `member/` · `faq/`** |

## Правило классификации

1. Сначала аудитория (`public-client` / `partner` / `investor-a`).  
2. Для partner/investor — этап: **интересуется** или **уже часть**.  
3. Не смешивать корпуса (цифры раунда ≠ ответы клиенту).  
4. Термины и полные формулировки речи — [`data-room/Source_Documents/ru/GLOSSARY.md`](../data-room/Source_Documents/ru/GLOSSARY.md). Служебные сокращения используются только для поиска и не произносятся клиенту.
5. Общие предупреждения — только [`data-room/Source_Documents/ru/DISCLAIMERS.md`](../data-room/Source_Documents/ru/DISCLAIMERS.md); не копировать их в FAQ и корпуса аудиторий.
6. Контакты и ссылка на запись на встречу — только [`data-room/Source_Documents/ru/CONTACTS.md`](../data-room/Source_Documents/ru/CONTACTS.md).
7. Полные условия приобретения и лицензионное соглашение доступны клиенту и партнёру: [`legal.ru/service-terms.md`](../legal.ru/service-terms.md) и [`LICENSE.ru`](../LICENSE.ru). Международные формы из [`legal.ru/templates/`](../legal.ru/templates/) — только корпус партнёра: это незаполненные шаблоны, а не подписанные договоры или готовые реквизиты.
8. Полные технические корпуса для клиента и партнёра: [`docs.ru/security.md`](security.md), [`docs.ru/ai-assistant.md`](ai-assistant.md) и [`docs.ru/blockchain-for-business.md`](blockchain-for-business.md). Короткие выжимки не создаются: код, конфигурация, бизнес-модель и регуляторная цель разделяются внутри этих файлов.
9. Кейсы Coca-Cola и OpenAI доступны клиенту и партнёру только как иллюстративные модели, не как подтверждение сотрудничества, внедрения или экономии. Сравнение фондов доступно `investor-a` и `investor-b`.
10. [`data-room/Source_Documents/ru/governance.md`](../data-room/Source_Documents/ru/governance.md) доступен только `investor-b`: это модель будущего фонда, а не подтверждение регистрации или приёма капитала.
11. [`data-room/Source_Documents/ru/market-analysis.md`](../data-room/Source_Documents/ru/market-analysis.md) доступен `investor-a`, `investor-b` и `internal`: это единый корпус четырёх рынков и подробной лестницы рынка бизнеса. Сценарии и допущения нельзя выдавать за подтверждённые продажи.
12. [`data-room/Source_Documents/ru/roadmap.md`](../data-room/Source_Documents/ru/roadmap.md) доступен `investor-a`, `investor-b` и `internal`: это единая целевая дорожная карта пятилетнего цикла. Годовые показатели и последовательность ворот являются моделью, а не фактом уже достигнутого масштаба.
13. [`data-room/Source_Documents/ru/sandbox-description.md`](../data-room/Source_Documents/ru/sandbox-description.md) доступен `regulator-pilot`, `partner` и `internal`: это единый корпус регуляторной песочницы. Текущий демонстрационный контур отделён от будущего пилота и промышленного режима.
14. [`data-room/Source_Documents/ru/for-regulators.md`](../data-room/Source_Documents/ru/for-regulators.md) доступен `regulator-pilot`, `partner` и `internal`: это единый корпус легального пути и предложения уполномоченному органу. Ask стадии A в этот файл не входит. Песочница и разметка — отдельные корпуса.
15. [`data-room/Source_Documents/ru/accelerator-program.md`](../data-room/Source_Documents/ru/accelerator-program.md) доступен `public-client`, `partner` и `internal`: это единый корпус программы сопровождения. Пятилетняя поддержка продукта отделена от индивидуальных платных доработок, песочницы, инвестиций и управления фондом.
16. [`data-room/Source_Documents/ru/business-model.md`](../data-room/Source_Documents/ru/business-model.md) доступен всем аудиториям: это бизнес-модель компании — программный комплекс, источники поступлений, денежные потоки, правило 15/15/70, расчётная казна и экономика портфеля. Условия входа инвестора и сценарии его результата в этот корпус не входят.
17. [`data-room/Source_Documents/ru/team.md`](../data-room/Source_Documents/ru/team.md) доступен всем аудиториям: это единственный корпус программируемого управления компанией держателями токенов, состава исполнителей и разделения интеллектуальных прав. Ядро принадлежит фонду после передачи прав; права на обновления принадлежат контрибьютору до преимущественного выкупа фондом.
18. [`data-room/Source_Documents/ru/for-investors.md`](../data-room/Source_Documents/ru/for-investors.md) доступен `investor-a`, `investor-b` и `internal`: это корпус **последующего** входа партнёра фонда — параметры чека, токены управления, права, портфель, сценарии, ворота и проверка проекта. Ask стадии A в этот файл не входит.
19. [`data-room/Source_Documents/ru/stage-a.md`](../data-room/Source_Documents/ru/stage-a.md) доступен `investor-a` и `internal`: это единый корпус раннего входа держателя токенов управления операционной системы фонда. Цифры ask, траншей, пакета **8 500** и порядка стран берутся только отсюда. `DEAL-TERMS` в индекс не входит.
20. [`data-room/Source_Documents/ru/evm-markup.md`](../data-room/Source_Documents/ru/evm-markup.md) доступен `investor-a`, `investor-b`, `regulator-pilot` и `internal`: это единый корпус разметки EVM и аналогов по тем же слоям. Ask стадии A в этот файл не входит.
21. [`data-room/Source_Documents/ru/company-presentation.md`](../data-room/Source_Documents/ru/company-presentation.md) доступен `public-client`, `partner`, `investor-a` и `internal`: это единый корпус о компании. Ask стадии A в этот файл не входит.
22. [`data-room/Source_Documents/ru/os-dle-presentation.md`](../data-room/Source_Documents/ru/os-dle-presentation.md) доступен `public-client`, `partner` и `investor-a`: это единый корпус продукта ОС DLE. Ask стадии A в этот файл не входит.
23. [`data-room/Source_Documents/ru/for-partners.md`](../data-room/Source_Documents/ru/for-partners.md) доступен `partner` и `internal`: это единый корпус партнёра. Условия для IT (узел, отдельные задания, вклад в репозиторий) разведены внутри файла. Ask стадии A не входит. Полный модельный договор и правила вклада остаются в `legal.ru/CONTRIBUTOR_LICENSE.md` и `legal.ru/CONTRIBUTING.md`.
24. [`data-room/Source_Documents/ru/FAQ.md`](../data-room/Source_Documents/ru/FAQ.md) — SoT коротких вопросов. Не страница `/content/internal`. В таблицу FAQ (по **имени**, не по id) строки попадают через [`data-room/rag-test/B1-FAQ-SEED.ru.md`](../data-room/rag-test/B1-FAQ-SEED.ru.md) при `./sync-ai-to-vds.sh --yes`. ЦА задаётся секцией (`public-client` / `investor-a`), не всем подряд. Язык ответа консультанта: последнее сообщение пользователя (ru/en); канон и цифры дословно из источников.

## Оси partner / investor

| Ось | Смысл |
|-----|--------|
| **interested** | Ещё изучает сотрудничество / раунд / продукт |
| **member** | Уже внутри: внедрение, процессы, контур сделки |
| **faq** | Внутренний FAQ корпуса (якоря для агента) |

Клиентский Wave 1: экраны (`settings` / `usage`). Wave 1b: канон блока + FAQ «зачем» + таблица RAG. Page в вектор не класть. Три корпуса KB живут в `data-room/Source_Documents/ru/kb-wave1/`, `kb-partner/`, `kb-investor/`.

## Правило пробела в документации (все аудитории)

Нет факта в SoT → не выдумывать → в **живом чате** уточняющий вопрос и три варианта (A/B/C).  
**Запрещено** вписывать этот квиз в канон / FAQ RAG (ТЗ 1b §2.1).  
Канон пробела в диалоге: `data-room/Source_Documents/ru/kb-wave1/00-MASTER-TZ-WAVE1-KB.ru.md` §0.1.
