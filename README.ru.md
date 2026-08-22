[English](README.md) | **Русский**

---

# Digital Legal Entity (DLE) — скачать шаблон ОС для создания цифрового профиля юридического лица

Собственная операционная система для программного управления бизнесом: внутри её программного контура создаётся профиль цифрового юридического лица, к которому подключаются модули бизнес-процессов.

**Начните обслуживать местных клиентов уже через 15 минут.**

## Автоматическая установка (рекомендуется)

Минимальные требования: 4 ядра CPU, 16 GB RAM, 100 GB SSD.  
Команда ставит ОС с **этого** репозитория и его релиза (clone + артефакты из того же хранилища). Скрипт скачивает артефакты релиза и разворачивает `docker-data`.

### Linux

**Шаг 1.** Откройте терминал.

**Шаг 2.** Скопируйте и вставьте команду в терминал — **установка шаблона DLE** (Docker поставит скрипт сам, если его нет):

```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh \
  | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE
```

### macOS

**Шаг 1.** Откройте Terminal.

**Шаг 2.** Скопируйте и вставьте команду в терминал — **установка Docker Desktop**:

```bash
brew install --cask docker
```

**Шаг 3.** Скопируйте и вставьте команду в терминал — **запуск Docker Desktop**:

```bash
open -a Docker
```

Дождитесь запуска Docker Desktop.

**Шаг 4.** Скопируйте и вставьте команду в терминал — **установка шаблона DLE**:

```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh \
  | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE
```

### Windows

**Шаг 1.** Откройте PowerShell от администратора.

**Шаг 2.** Скопируйте и вставьте команду в терминал — **установка WSL**:

```powershell
wsl --install
```

**Шаг 3.** **Перезагрузите Windows.**

**Шаг 4.** Скопируйте и вставьте команду в терминал — **установка Docker Desktop**:

```powershell
winget install -e --id Docker.DockerDesktop
```

**Шаг 5.** Скопируйте и вставьте команду в терминал — **установка шаблона DLE**:

```powershell
wsl bash -c "cd ~ && curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE"
```

Установка в домашний каталог WSL (`~/DLE`), не на диск `C:`.

## Что это

**DLE** — шаблон собственной операционной системы для программного управления бизнесом. Система развёртывается на инфраструктуре компании, в том числе локально в стране деятельности. Внутри ОС создаётся профиль цифрового юридического лица на основе смарт-контракта с токенами управления; к профилю подключаются модули бизнес-процессов. Бессрочная лицензия: установленный экземпляр — **ваш актив**, а не аренда чужого кабинета ([LICENSE.ru](LICENSE.ru)). Данные и операционная работа остаются у вас; в шаблоне — обезличивание, шифрование и хранение персональных данных под требования регулятора страны с возможностью локализации на своей площадке ([security.md](docs.ru/security.md#9-персональные-данные-и-юридические-документы)).

## Зачем

Обычный путь после регистрации бизнеса — пачка платных подписок на автоматизацию, учёт и платежи: зависимость от вендора, ручной перенос данных, растущие расходы и слабый контроль над активами.

Если нужен бизнес на **одной собственной ОС** — системе, которая становится **цифровым активом**, а не набором сервисов — скачайте шаблон и заключите договор с авторизованным контрибьютором: лицензия, обновления и поддержка (базово 5 лет).

Развёрнуто для собственника и директора: [ОС DLE — презентация](docs.ru/os-dle-presentation.md).

### Кейсы

Иллюстративные сценарии применения DLE. Упоминание известных компаний и брендов — **демонстрация модели**, а не описание реального сотрудничества, пилота или внедрения у указанных организаций.

- [Кейс: OpenAI на DLE](docs.ru/case-openai-on-dle.md)
- [Кейс: Coca-Cola на DLE](docs.ru/case-coca-cola-on-dle.md)
- [Кейс: BlackRock, Andreessen Horowitz и VC HB3](docs.ru/case-vc-fund-traditional-vs-dle.md)

## Как начать

1. **Установите шаблон** на своей инфраструктуре (команда выше). За ~15 минут поднимается рабочий контур ОС.

2. **Заключите договор** с авторизованным контрибьютором (шаблоны договора, спецификации и акта — в [Документах](#документы)). В договоре фиксируются цена, пакет (Standard / Premium) и адрес вашего кошелька.

3. **Получите лицензионный токен** на этот кошелёк (сеть Sepolia). Токен — это запись о вашей лицензии в блокчейне. Он нужен, чтобы:
   - зафиксировать лицензию и привязать её к вашему кошельку;
   - принять EULA в отношениях с правообладателем;
   - получить административные права в установленном шаблоне;
   - иметь право на обновления и поддержку (пока токен на вашем адресе; базово 5 лет);
   - участвовать в голосовании за развитие продукта (1 токен = 1 голос).

   Токен носит нефинансовый характер: не средство платежа и не ценная бумага.


## Документы

| Файл | Описание |
| --- | --- |
| [LICENSE.ru](LICENSE.ru) | Индексируемый корпус лицензионного соглашения: лицензия, интеллектуальная собственность, неотзыв и прекращение |
| [service-terms.md](legal.ru/service-terms.md) | Индексируемый корпус условий приобретения и обслуживания |
| [contributor-client-agreement.md](legal.ru/templates/contributor-client-agreement.md) | Partner-only корпус: незаполненный международный шаблон договора |
| [contributor-client-specification.md](legal.ru/templates/contributor-client-specification.md) | Partner-only корпус: незаполненный шаблон спецификации / счёта |
| [contributor-client-acceptance-act.md](legal.ru/templates/contributor-client-acceptance-act.md) | Partner-only корпус: незаполненный шаблон акта приёмки и фиксации токена |
| [GLOSSARY.md](data-room/Source_Documents/ru/GLOSSARY.md) | Единый русский корпус терминов: поисковые сокращения и полные формулировки для речи ИИ-ассистента |
| [DISCLAIMERS.md](data-room/Source_Documents/ru/DISCLAIMERS.md) | Единый русский корпус общих предупреждений для загрузки в индекс |
| [CONTACTS.md](data-room/Source_Documents/ru/CONTACTS.md) | Единый русский корпус контактных данных и ссылки на запись на встречу |
| [os-dle-presentation.md](docs.ru/os-dle-presentation.md) | ОС DLE — презентация для бизнеса (каркас) |
| [ai-assistant.md](docs.ru/ai-assistant.md) | Полный индексируемый корпус агентов: типы, знания, аудитории и модели |
| [blockchain-for-business.md](docs.ru/blockchain-for-business.md) | Полный индексируемый блокчейн-корпус: профиль, управление, модули и регуляторные цели |
| [security.md](docs.ru/security.md) | Полный индексируемый корпус безопасности и границ ответственности |
| [governance.md](data-room/Source_Documents/ru/governance.md) | Индексируемый инвесторский корпус целевой модели управления фондом |
| [FAQ](https://github.com/VC-HB3-Accelerator/Docs/blob/main/ru/FAQ.md) | Частые вопросы |

### Релизы и артефакты

Latest **v1.0.7** — полный шаблон с Docker-образами, томами и ключом шифрования; архив разделён на части (`dle-template.tar.gz.part-*`).

- [Релиз v1.0.7](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.7) (Latest)
- [Релиз v1.0.6](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.6) — предыдущая версия
- [Релиз v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) — предыдущая версия
- [Релиз v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — предыдущая версия
- [Релиз v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — предыдущая версия
- [Релиз v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — предыдущая версия

### Команда для запуска ОС

После установки из блока выше каталог ОС — **`DLE`** в домашней папке (`~/DLE`): туда `setup.sh` клонирует репозиторий. Сначала запустите Docker и дождитесь готовности, затем в терминале перейдите в эту папку и выполните запуск.

#### Linux

Скопируйте и вставьте в терминал:

```bash
sudo systemctl start docker
cd ~/DLE
docker-compose up -d
```

#### macOS

Скопируйте и вставьте в Terminal (дождитесь кита Docker Desktop, затем выполните `cd` и запуск, если Desktop ещё стартует):

```bash
open -a Docker
cd ~/DLE
docker-compose up -d
```

#### Windows

Установка шага 5 кладёт ОС в домашний каталог WSL: `~/DLE` (не на диск `C:`).

**1.** Запустите приложение Docker Desktop — скопируйте в PowerShell:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Дождитесь зелёной иконки в трее.

**2.** Запуск ОС — скопируйте в PowerShell:

```powershell
wsl bash -c "cd ~/DLE && docker-compose up -d"
```

### Доступ к приложению

#### Продакшн (production)
- **Frontend**: http://localhost:9000 (HTTP)

### Команда для остановки ОС

Из той же папки `~/DLE`:

#### Linux и macOS

```bash
cd ~/DLE
docker-compose down
```

#### Windows

```powershell
wsl bash -c "cd ~/DLE && docker-compose down"
```

### Контакты 
- **Email:** info@hb3-accelerator.com
- **Поддержка:** https://hb3-accelerator.com/
