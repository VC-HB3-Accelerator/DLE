# Обход VPN (v2rayA) для своих серверов — Linux

Аналог пакета `happ-vpn-transfer` с ALBACKUP (Windows / Happ TUN).

## Проблема

При transparent proxy v2rayA:

- трафик Docker (`172.17.0.0/16`, `172.18.0.0/16`) ломается (DNS/TCP из bridge);
- иногда рвутся большие ответы с собственных VDS.

Обычные `ip route` к сайтам часто уже идут через Wi‑Fi; transparent перехватывает **после** маршрутизации через iptables. Поэтому нужны:

1. прямые `/32` маршруты (как на Windows);
2. исключения Docker-сетей и IP в настройках v2rayA (обязательно).

## Файлы

| Файл | Назначение |
|------|------------|
| `add-direct-routes.sh` | добавить/обновить прямые маршруты (нужен `sudo`) |
| `remove-direct-routes.sh` | удалить эти маршруты |
| `README.ru.md` | эта инструкция |

## IP в обходе

| IP | Назначение |
|----|------------|
| `178.212.14.211` | b2-b4.com |
| `185.221.214.77` | hb3-accelerator.com |
| `185.26.121.127` | ssh / сервер |
| `185.26.122.131` | hostland.ru |
| `185.26.122.10` | hostland panel |

## Быстрый старт

```bash
cd ~/b2-b4.com
sudo ./scripts/vpn/add-direct-routes.sh
```

Снять:

```bash
sudo ./scripts/vpn/remove-direct-routes.sh
```

После смены Wi‑Fi/роутера — снова `add-direct-routes.sh`.

## v2rayA (обязательно для Docker)

UI: http://localhost:2017 → **Настройки**

1. Transparent proxy: добавить в **direct / не проксировать**:
   - `178.212.14.211`, `185.221.214.77`, `185.26.121.127`, `185.26.122.131`, `185.26.122.10`
   - `172.16.0.0/12` (или явно `172.17.0.0/16` и `172.18.0.0/16`)
2. Сохранить и при необходимости переподключить прокси.
3. Проверка:

```bash
docker run --rm --dns 8.8.8.8 alpine:3.20 \
  sh -c 'wget -qO- --timeout=8 https://registry.npmjs.org/ | head -c 40; echo'
```

Ожидается JSON `{}` или начало ответа, не `bad address` / timeout.

Дополнительно (если после VPN снова пропал форвардинг):

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -P FORWARD ACCEPT
```

## Сборка образов при сломанном bridge

Пока transparent режет Docker, сборка через host-network:

```bash
cd ~/b2-b4.com
DOCKER_CLI_HINTS=false docker compose --progress=quiet build --print \
  > /tmp/b2-b4-bake.json 2>/tmp/b2-b4-bake.err
python3 - <<'PY'
import json
from pathlib import Path
p = Path('/tmp/b2-b4-bake.json')
d = json.loads(p.read_text())
for t in d['target'].values():
    t['network'] = 'host'
p.write_text(json.dumps(d, indent=2))
PY
docker buildx bake --allow=network.host -f /tmp/b2-b4-bake.json
```

## Windows

Для ноутбука с Happ: `ALBACKUP/happ-vpn-transfer/` (`add-direct-routes.ps1`).
