[English](../legal.en/THIRD_PARTY_NOTICES.md) | **Русский**

# Уведомления о сторонних компонентах (Third-Party Notices)

**Проект:** Digital Legal Entity (DLE)  
**Copyright (c) 2024-2026 Тарабанов Александр Викторович**  
**Лицензия проекта:** Proprietary — см. [LICENSE](../LICENSE)

Документ составлен автоматически на основе установленных npm-зависимостей (`license-checker --production`).  
Дата генерации: 2026-07-08

## Обязательства

При распространении ПО DLE необходимо:

1. Сохранять данный файл вместе с дистрибутивом.
2. Не удалять copyright-уведомления из исходного кода сторонних библиотек.
3. Соблюдать условия лицензий перечисленных ниже пакетов.
4. Для Apache-2.0 — включать соответствующие NOTICE-файлы (если поставляются пакетом).
5. Для LGPL-3.0 (**web3-utils**) — см. раздел [«Соответствие LGPL-3.0»](#соответствие-lgpl-30).

## Соответствие LGPL-3.0

В production-дереве зависимостей backend присутствует **web3-utils** (LGPL-3.0),
подключаемый транзитивно через **solidity-coverage** (инструментарий Hardhat).
DLE **не импортирует** `web3-utils` напрямую; для работы с Ethereum используются
**ethers** и **viem** (MIT).

**web3-utils в данном дистрибутиве**

| Поле | Значение |
|------|----------|
| Пакет | web3-utils@1.10.4 |
| Лицензия | GNU Lesser General Public License v3.0 (LGPL-3.0) |
| Upstream | https://github.com/ethereum/web3.js/tree/1.x/packages/web3-utils |
| В DLE | Немодифицированный npm-пакет в `backend/node_modules/web3-utils/` |

**Обязательства DLE при распространении backend** (LGPL-3.0, разделы 4–6):

1. Включать данный файл Third-Party Notices в состав дистрибутива.
2. Сохранять все copyright- и license-уведомления в исходных файлах `web3-utils`.
3. Предоставлять полный текст лицензии LGPL-3.0 (см. ссылки ниже).
4. Если **web3-utils** распространяется вместе с backend, получатель должен иметь
   возможность заменить или перелинковать библиотеку (стандартная структура
   Node.js `node_modules` этому соответствует).
5. При **модификации** **web3-utils** — опубликовать соответствующий исходный код
   изменённой версии под LGPL-3.0. **DLE поставляет немодифицированный upstream-пакет.**

**Чего LGPL-3.0 не требует**

- Раскрывать проприетарный код приложения DLE, который лишь использует
  `web3-utils` как отдельную npm-зависимость без модификации.
- Перелицензировать DLE под LGPL при соблюдении обязательств выше.

**Полный текст лицензии**

- GNU LGPL v3.0: https://www.gnu.org/licenses/lgpl-3.0.html
- Копия в дистрибутиве: `backend/node_modules/web3-utils/LICENSE` (при включении
  зависимостей backend)

## Python: vector-search

| Пакет | Лицензия | Примечание |
|-------|----------|------------|
| fastapi | MIT | https://github.com/fastapi/fastapi |
| uvicorn | BSD-3-Clause | https://github.com/encode/uvicorn |
| faiss-cpu | MIT | https://github.com/facebookresearch/faiss |
| requests | Apache-2.0 | https://github.com/psf/requests |
| pydantic | MIT | https://github.com/pydantic/pydantic |

## Python: runtime (backend Docker)

Системные пакеты устанавливаются через apt в Docker-образе backend (python3, curl и др.) — лицензии соответствуют дистрибутиву Debian.

---

## Backend (Node.js, production)

Всего пакетов: **909**

| Лицензия | Количество |
|----------|------------|
| MIT | 746 |
| ISC | 57 |
| BSD-3-Clause | 34 |
| Apache-2.0 | 29 |
| BSD-2-Clause | 12 |
| MPL-2.0 | 6 |
| BlueOak-1.0.0 | 4 |
| BSD | 3 |
| (MIT OR CC0-1.0) | 3 |
| 0BSD | 2 |
| (MIT OR EUPL-1.1+) | 1 |
| BSD-3-Clause OR MIT | 1 |
| Python-2.0 | 1 |
| WTFPL | 1 |
| PSF | 1 |
| Apache-2.0 OR MIT | 1 |
| (AFL-2.1 OR BSD-3-Clause) | 1 |
| MIT-0 | 1 |
| (MIT AND BSD-3-Clause) | 1 |
| WTFPL OR MIT | 1 |
| Unlicense | 1 |
| MIT* | 1 |
| LGPL-3.0 | 1 |

### Требуют внимания

| Пакет | Лицензия | Примечание |
|-------|----------|------------|
| @ethereumjs/rlp@4.0.1 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| @ethereumjs/rlp@5.0.2 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| @ethereumjs/util@8.1.0 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| @ethereumjs/util@9.1.0 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| @zone-eu/mailsplit@5.4.8 | (MIT OR EUPL-1.1+) | Dual MIT/EUPL; при модификации — условия EUPL |
| chai-as-promised@7.1.2 | WTFPL | Соблюдать условия лицензии |
| ethereumjs-util@7.1.5 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| rlp@2.2.7 | MPL-2.0 | File-level copyleft при изменении файлов библиотеки |
| string-format@2.0.0 | WTFPL OR MIT | Соблюдать условия лицензии |
| web3-utils@1.10.4 | LGPL-3.0 | LGPL-3.0: см. раздел «Соответствие LGPL-3.0» ниже |

<details>
<summary>Полный список пакетов</summary>

| Пакет | Лицензия | Репозиторий |
|-------|----------|-------------|
| @adraffy/ens-normalize@1.10.1 | MIT | [link](https://github.com/adraffy/ens-normalize.js) |
| @adraffy/ens-normalize@1.11.1 | MIT | [link](https://github.com/adraffy/ens-normalize.js) |
| @anthropic-ai/sdk@0.51.0 | MIT | [link](https://github.com/anthropics/anthropic-sdk-typescript) |
| @cfworker/json-schema@4.1.1 | MIT | [link](https://github.com/cfworker/cfworker) |
| @colors/colors@1.5.0 | MIT | [link](https://github.com/DABH/colors.js) |
| @colors/colors@1.6.0 | MIT | [link](https://github.com/DABH/colors.js) |
| @cspotcode/source-map-support@0.8.1 | MIT | [link](https://github.com/cspotcode/node-source-map-support) |
| @cypress/request-promise@5.0.0 | ISC | [link](https://github.com/cypress-io/request-promise) |
| @cypress/request@3.0.9 | Apache-2.0 | [link](https://github.com/cypress-io/request) |
| @dabh/diagnostics@2.0.8 | MIT | [link](https://github.com/DABH/diagnostics) |
| @ethereumjs/rlp@4.0.1 | MPL-2.0 | [link](https://github.com/ethereumjs/ethereumjs-monorepo) |
| @ethereumjs/rlp@5.0.2 | MPL-2.0 | [link](https://github.com/ethereumjs/ethereumjs-monorepo) |
| @ethereumjs/util@8.1.0 | MPL-2.0 | [link](https://github.com/ethereumjs/ethereumjs-monorepo) |
| @ethereumjs/util@9.1.0 | MPL-2.0 | [link](https://github.com/ethereumjs/ethereumjs-monorepo) |
| @ethersproject/abi@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/abstract-provider@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/abstract-signer@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/address@5.6.1 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/address@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/base64@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/bignumber@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/bytes@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/constants@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/hash@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/keccak256@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/logger@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/networks@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/properties@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/rlp@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/signing-key@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/strings@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/transactions@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/units@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @ethersproject/web@5.8.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| @google/genai@1.34.0 | Apache-2.0 | [link](https://github.com/googleapis/js-genai) |
| @graphql-typed-document-node/core@3.2.0 | MIT | [link](https://github.com/dotansimha/graphql-typed-document-node) |
| @grpc/grpc-js@1.14.4 | Apache-2.0 | [link](https://github.com/grpc/grpc-node/tree/master/packages/grpc-js) |
| @grpc/proto-loader@0.8.0 | Apache-2.0 | [link](https://github.com/grpc/grpc-node) |
| @isaacs/cliui@8.0.2 | ISC | [link](https://github.com/yargs/cliui) |
| @jridgewell/resolve-uri@3.1.2 | MIT | [link](https://github.com/jridgewell/resolve-uri) |
| @jridgewell/sourcemap-codec@1.5.5 | MIT | [link](https://github.com/jridgewell/sourcemaps) |
| @jridgewell/trace-mapping@0.3.9 | MIT | [link](https://github.com/jridgewell/trace-mapping) |
| @js-sdsl/ordered-map@4.4.2 | MIT | [link](https://github.com/js-sdsl/js-sdsl) |
| @langchain/community@0.3.59 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @langchain/core@0.3.80 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @langchain/ollama@0.2.4 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @langchain/openai@0.6.17 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @langchain/textsplitters@0.1.0 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @langchain/weaviate@0.2.3 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| @noble/ciphers@1.3.0 | MIT | [link](https://github.com/paulmillr/noble-ciphers) |
| @noble/curves@1.2.0 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/curves@1.4.2 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/curves@1.8.2 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/curves@1.9.1 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/curves@1.9.7 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/hashes@1.2.0 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/hashes@1.3.2 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/hashes@1.4.0 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/hashes@1.7.2 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/hashes@1.8.0 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/secp256k1@1.7.1 | MIT | [link](https://github.com/paulmillr/noble-secp256k1) |
| @noble/secp256k1@1.7.2 | MIT | [link](https://github.com/paulmillr/noble-secp256k1) |
| @nodelib/fs.scandir@2.1.5 | MIT | [link](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir) |
| @nodelib/fs.stat@2.0.5 | MIT | [link](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat) |
| @nodelib/fs.walk@1.2.8 | MIT | [link](https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk) |
| @nomicfoundation/edr-darwin-arm64@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-darwin-x64@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-linux-arm64-gnu@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-linux-arm64-musl@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-linux-x64-gnu@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-linux-x64-musl@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr-win32-x64-msvc@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/edr@0.12.0-next.17 | MIT | [link](https://github.com/NomicFoundation/edr) |
| @nomicfoundation/hardhat-chai-matchers@2.1.0 | MIT | [link](https://github.com/nomicfoundation/hardhat) |
| @nomicfoundation/hardhat-ethers@3.1.3 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/hardhat-ignition-ethers@0.15.17 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/hardhat-ignition@0.15.16 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/hardhat-network-helpers@1.1.2 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/hardhat-toolbox@5.0.0 | MIT | [link](https://github.com/nomicfoundation/hardhat) |
| @nomicfoundation/hardhat-verify@2.1.3 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/ignition-core@0.15.15 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/ignition-ui@0.15.13 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| @nomicfoundation/solidity-analyzer-darwin-arm64@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-darwin-x64@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-linux-arm64-gnu@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-linux-arm64-musl@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-linux-x64-gnu@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-linux-x64-musl@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer-win32-x64-msvc@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @nomicfoundation/solidity-analyzer@0.1.2 | MIT | [link](https://github.com/NomicFoundation/solidity-analyzer) |
| @openzeppelin/contracts@5.4.0 | MIT | [link](https://github.com/OpenZeppelin/openzeppelin-contracts) |
| @pkgjs/parseargs@0.11.0 | MIT | [link](https://github.com/pkgjs/parseargs) |
| @protobufjs/aspromise@1.1.2 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/base64@1.1.2 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/codegen@2.0.5 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/eventemitter@1.1.1 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/fetch@1.1.1 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/float@1.0.2 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/path@1.1.2 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/pool@1.1.0 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @protobufjs/utf8@1.1.1 | BSD-3-Clause | [link](https://github.com/dcodeIO/protobuf.js) |
| @scure/base@1.1.9 | MIT | [link](https://github.com/paulmillr/scure-base) |
| @scure/base@1.2.6 | MIT | [link](https://github.com/paulmillr/scure-base) |
| @scure/bip32@1.1.5 | MIT | [link](https://github.com/paulmillr/scure-bip32) |
| @scure/bip32@1.4.0 | MIT | [link](https://github.com/paulmillr/scure-bip32) |
| @scure/bip32@1.7.0 | MIT | [link](https://github.com/paulmillr/scure-bip32) |
| @scure/bip39@1.1.1 | MIT | [link](https://github.com/paulmillr/scure-bip39) |
| @scure/bip39@1.3.0 | MIT | [link](https://github.com/paulmillr/scure-bip39) |
| @scure/bip39@1.6.0 | MIT | [link](https://github.com/paulmillr/scure-bip39) |
| @selderee/plugin-htmlparser2@0.11.0 | MIT | [link](https://github.com/mxxii/selderee) |
| @sentry/core@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/hub@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/minimal@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/node@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/tracing@5.30.0 | MIT | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/types@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @sentry/utils@5.30.0 | BSD-3-Clause | [link](https://github.com/getsentry/sentry-javascript) |
| @so-ric/colorspace@1.1.6 | MIT | [link](https://github.com/so-ric/colorspace) |
| @solidity-parser/parser@0.20.2 | MIT | [link](https://github.com/solidity-parser/parser) |
| @spruceid/siwe-parser@2.1.2 | Apache-2.0 | [link](https://github.com/spruceid/siwe) |
| @stablelib/binary@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/int@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/random@1.0.2 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/wipe@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @telegraf/types@7.1.0 | MIT | [link](https://github.com/telegraf/types) |
| @tsconfig/node10@1.0.12 | MIT | [link](https://github.com/tsconfig/bases) |
| @tsconfig/node12@1.0.11 | MIT | [link](https://github.com/tsconfig/bases) |
| @tsconfig/node14@1.0.3 | MIT | [link](https://github.com/tsconfig/bases) |
| @tsconfig/node16@1.0.4 | MIT | [link](https://github.com/tsconfig/bases) |
| @typechain/ethers-v6@0.5.1 | MIT | [link](https://github.com/ethereum-ts/Typechain) |
| @typechain/hardhat@9.1.0 | MIT | [link](https://github.com/ethereum-ts/Typechain) |
| @types/bn.js@5.2.0 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/chai-as-promised@7.1.8 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/chai@4.3.20 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/chai@5.2.3 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/deep-eql@4.0.2 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/glob@7.2.0 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/luxon@3.7.1 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/minimatch@6.0.0 | MIT | — |
| @types/mocha@10.0.10 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node-fetch@2.6.13 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node@18.19.130 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node@22.7.5 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node@24.10.4 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node@25.0.3 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/pbkdf2@3.1.2 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/prettier@2.7.3 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/retry@0.12.0 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/secp256k1@4.0.7 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/triple-beam@1.3.5 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @zone-eu/mailsplit@5.4.8 | (MIT OR EUPL-1.1+) | [link](https://github.com/zone-eu/mailsplit) |
| abbrev@1.0.9 | ISC | [link](https://github.com/isaacs/abbrev-js) |
| abbrev@1.1.1 | ISC | [link](https://github.com/isaacs/abbrev-js) |
| abitype@1.2.3 | MIT | [link](https://github.com/wevm/abitype) |
| abort-controller-x@0.4.3 | MIT | [link](https://github.com/deeplay-io/abort-controller-x) |
| abort-controller-x@0.5.0 | MIT | [link](https://github.com/deeplay-io/abort-controller-x) |
| abort-controller@3.0.0 | MIT | [link](https://github.com/mysticatea/abort-controller) |
| accepts@1.3.8 | MIT | [link](https://github.com/jshttp/accepts) |
| acorn-walk@8.3.4 | MIT | [link](https://github.com/acornjs/acorn) |
| acorn@8.15.0 | MIT | [link](https://github.com/acornjs/acorn) |
| adm-zip@0.4.16 | MIT | [link](https://github.com/cthackers/adm-zip) |
| aes-js@4.0.0-beta.5 | MIT | [link](https://github.com/ricmoo/aes-js) |
| agent-base@6.0.2 | MIT | [link](https://github.com/TooTallNate/node-agent-base) |
| agent-base@7.1.4 | MIT | [link](https://github.com/TooTallNate/proxy-agents) |
| agentkeepalive@4.6.0 | MIT | [link](https://github.com/node-modules/agentkeepalive) |
| aggregate-error@3.1.0 | MIT | [link](https://github.com/sindresorhus/aggregate-error) |
| ajv@6.14.0 | MIT | [link](https://github.com/ajv-validator/ajv) |
| amdefine@1.0.1 | BSD-3-Clause OR MIT | [link](https://github.com/jrburke/amdefine) |
| ansi-align@3.0.1 | ISC | [link](https://github.com/nexdrew/ansi-align) |
| ansi-colors@4.1.3 | MIT | [link](https://github.com/doowb/ansi-colors) |
| ansi-escapes@4.3.2 | MIT | [link](https://github.com/sindresorhus/ansi-escapes) |
| ansi-regex@5.0.1 | MIT | [link](https://github.com/chalk/ansi-regex) |
| ansi-regex@6.2.2 | MIT | [link](https://github.com/chalk/ansi-regex) |
| ansi-styles@3.2.1 | MIT | [link](https://github.com/chalk/ansi-styles) |
| ansi-styles@4.3.0 | MIT | [link](https://github.com/chalk/ansi-styles) |
| ansi-styles@5.2.0 | MIT | [link](https://github.com/chalk/ansi-styles) |
| ansi-styles@6.2.3 | MIT | [link](https://github.com/chalk/ansi-styles) |
| anymatch@3.1.3 | ISC | [link](https://github.com/micromatch/anymatch) |
| apg-js@4.4.0 | BSD-2-Clause | [link](https://github.com/ldthomas/apg-js) |
| append-field@1.0.0 | MIT | [link](https://github.com/LinusU/node-append-field) |
| archiver-utils@5.0.2 | MIT | [link](https://github.com/archiverjs/archiver-utils) |
| archiver@7.0.1 | MIT | [link](https://github.com/archiverjs/node-archiver) |
| arg@4.1.3 | MIT | [link](https://github.com/zeit/arg) |
| argparse@2.0.1 | Python-2.0 | [link](https://github.com/nodeca/argparse) |
| array-back@3.1.0 | MIT | [link](https://github.com/75lb/array-back) |
| array-back@4.0.2 | MIT | [link](https://github.com/75lb/array-back) |
| array-buffer-byte-length@1.0.2 | MIT | [link](https://github.com/inspect-js/array-buffer-byte-length) |
| array-flatten@1.1.1 | MIT | [link](https://github.com/blakeembrey/array-flatten) |
| array-union@2.1.0 | MIT | [link](https://github.com/sindresorhus/array-union) |
| array.prototype.findindex@2.2.4 | MIT | [link](https://github.com/paulmillr/Array.prototype.findIndex) |
| arraybuffer.prototype.slice@1.0.4 | MIT | [link](https://github.com/es-shims/ArrayBuffer.prototype.slice) |
| asn1.js@5.4.1 | MIT | [link](https://github.com/indutny/asn1.js) |
| asn1@0.2.6 | MIT | [link](https://github.com/joyent/node-asn1) |
| assert-plus@1.0.0 | MIT | [link](https://github.com/mcavage/node-assert-plus) |
| assertion-error@1.1.0 | MIT | [link](https://github.com/chaijs/assertion-error) |
| assertion-error@2.0.1 | MIT | [link](https://github.com/chaijs/assertion-error) |
| astral-regex@2.0.0 | MIT | [link](https://github.com/kevva/astral-regex) |
| async-function@1.0.0 | MIT | [link](https://github.com/ljharb/async-function) |
| async@1.5.2 | MIT | [link](https://github.com/caolan/async) |
| async@3.2.6 | MIT | [link](https://github.com/caolan/async) |
| asynckit@0.4.0 | MIT | [link](https://github.com/alexindigo/asynckit) |
| at-least-node@1.0.0 | ISC | [link](https://github.com/RyanZim/at-least-node) |
| available-typed-arrays@1.0.7 | MIT | [link](https://github.com/inspect-js/available-typed-arrays) |
| aws-sign2@0.7.0 | Apache-2.0 | [link](https://github.com/mikeal/aws-sign) |
| aws4@1.13.2 | MIT | [link](https://github.com/mhart/aws4) |
| axios@1.18.1 | MIT | [link](https://github.com/axios/axios) |
| b4a@1.7.3 | Apache-2.0 | [link](https://github.com/holepunchto/b4a) |
| bagpipe@0.3.5 | MIT | [link](https://github.com/JacksonTian/bagpipe) |
| balanced-match@1.0.2 | MIT | [link](https://github.com/juliangruber/balanced-match) |
| bare-events@2.8.2 | Apache-2.0 | [link](https://github.com/holepunchto/bare-events) |
| base-x@3.0.11 | MIT | [link](https://github.com/cryptocoinjs/base-x) |
| base64-js@1.5.1 | MIT | [link](https://github.com/beatgammit/base64-js) |
| bcrypt-pbkdf@1.0.2 | BSD-3-Clause | [link](https://github.com/joyent/node-bcrypt-pbkdf) |
| better-queue-memory@1.0.4 | MIT | [link](https://github.com/diamondio/better-queue-memory) |
| better-queue@3.8.12 | MIT | [link](https://github.com/diamondio/better-queue) |
| bignumber.js@9.3.1 | MIT | [link](https://github.com/MikeMcl/bignumber.js) |
| binary-extensions@2.3.0 | MIT | [link](https://github.com/sindresorhus/binary-extensions) |
| bl@1.2.3 | MIT | [link](https://github.com/rvagg/bl) |
| blakejs@1.2.1 | MIT | [link](https://github.com/dcposch/blakejs) |
| bluebird@3.7.2 | MIT | [link](https://github.com/petkaantonov/bluebird) |
| bn.js@4.12.3 | MIT | [link](https://github.com/indutny/bn.js) |
| body-parser@1.20.4 | MIT | [link](https://github.com/expressjs/body-parser) |
| boxen@5.1.2 | MIT | [link](https://github.com/sindresorhus/boxen) |
| brace-expansion@2.1.1 | MIT | [link](https://github.com/juliangruber/brace-expansion) |
| braces@3.0.3 | MIT | [link](https://github.com/micromatch/braces) |
| brorand@1.1.0 | MIT | [link](https://github.com/indutny/brorand) |
| brotli-wasm@2.0.1 | Apache-2.0 | [link](https://github.com/httptoolkit/brotli-wasm) |
| browser-stdout@1.3.1 | ISC | [link](https://github.com/kumavis/browser-stdout) |
| browserify-aes@1.2.0 | MIT | [link](https://github.com/crypto-browserify/browserify-aes) |
| bs58@4.0.1 | MIT | [link](https://github.com/cryptocoinjs/bs58) |
| bs58check@2.1.2 | MIT | [link](https://github.com/bitcoinjs/bs58check) |
| buffer-alloc-unsafe@1.1.0 | MIT | [link](https://github.com/LinusU/buffer-alloc-unsafe) |
| buffer-alloc@1.2.0 | MIT | [link](https://github.com/LinusU/buffer-alloc) |
| buffer-crc32@1.0.0 | MIT | [link](https://github.com/brianloveswords/buffer-crc32) |
| buffer-equal-constant-time@1.0.1 | BSD-3-Clause | [link](https://github.com/goinstant/buffer-equal-constant-time) |
| buffer-fill@1.0.0 | MIT | [link](https://github.com/LinusU/buffer-fill) |
| buffer-from@1.1.2 | MIT | [link](https://github.com/LinusU/buffer-from) |
| buffer-xor@1.0.3 | MIT | [link](https://github.com/crypto-browserify/buffer-xor) |
| buffer@6.0.3 | MIT | [link](https://github.com/feross/buffer) |
| busboy@1.6.0 | MIT | [link](https://github.com/mscdex/busboy) |
| bytes@3.1.2 | MIT | [link](https://github.com/visionmedia/bytes.js) |
| call-bind-apply-helpers@1.0.2 | MIT | [link](https://github.com/ljharb/call-bind-apply-helpers) |
| call-bind@1.0.8 | MIT | [link](https://github.com/ljharb/call-bind) |
| call-bound@1.0.4 | MIT | [link](https://github.com/ljharb/call-bound) |
| camelcase@6.3.0 | MIT | [link](https://github.com/sindresorhus/camelcase) |
| caseless@0.12.0 | Apache-2.0 | [link](https://github.com/mikeal/caseless) |
| cbor@8.1.0 | MIT | [link](https://github.com/hildjj/node-cbor) |
| cbor@9.0.2 | MIT | [link](https://github.com/hildjj/node-cbor) |
| chai-as-promised@7.1.2 | WTFPL | [link](https://github.com/domenic/chai-as-promised) |
| chai@4.5.0 | MIT | [link](https://github.com/chaijs/chai) |
| chalk@2.4.2 | MIT | [link](https://github.com/chalk/chalk) |
| chalk@4.1.2 | MIT | [link](https://github.com/chalk/chalk) |
| charenc@0.0.2 | BSD-3-Clause | [link](https://github.com/pvorb/node-charenc) |
| check-error@1.0.3 | MIT | [link](https://github.com/chaijs/check-error) |
| chokidar@3.6.0 | MIT | [link](https://github.com/paulmillr/chokidar) |
| chokidar@4.0.3 | MIT | [link](https://github.com/paulmillr/chokidar) |
| ci-info@2.0.0 | MIT | [link](https://github.com/watson/ci-info) |
| cipher-base@1.0.7 | MIT | [link](https://github.com/crypto-browserify/cipher-base) |
| clean-stack@2.2.0 | MIT | [link](https://github.com/sindresorhus/clean-stack) |
| cli-boxes@2.2.1 | MIT | [link](https://github.com/sindresorhus/cli-boxes) |
| cli-table3@0.6.5 | MIT | [link](https://github.com/cli-table/cli-table3) |
| cliui@7.0.4 | ISC | [link](https://github.com/yargs/cliui) |
| cliui@8.0.1 | ISC | [link](https://github.com/yargs/cliui) |
| color-convert@1.9.3 | MIT | [link](https://github.com/Qix-/color-convert) |
| color-convert@2.0.1 | MIT | [link](https://github.com/Qix-/color-convert) |
| color-convert@3.1.3 | MIT | [link](https://github.com/Qix-/color-convert) |
| color-name@1.1.3 | MIT | [link](https://github.com/dfcreative/color-name) |
| color-name@1.1.4 | MIT | [link](https://github.com/colorjs/color-name) |
| color-name@2.1.0 | MIT | [link](https://github.com/colorjs/color-name) |
| color-string@2.1.4 | MIT | [link](https://github.com/Qix-/color-string) |
| color@5.0.3 | MIT | [link](https://github.com/Qix-/color) |
| combined-stream@1.0.8 | MIT | [link](https://github.com/felixge/node-combined-stream) |
| command-exists@1.2.9 | MIT | [link](https://github.com/mathisonian/command-exists) |
| command-line-args@5.2.1 | MIT | [link](https://github.com/75lb/command-line-args) |
| command-line-usage@6.1.3 | MIT | [link](https://github.com/75lb/command-line-usage) |
| commander@8.3.0 | MIT | [link](https://github.com/tj/commander.js) |
| compress-commons@6.0.2 | MIT | [link](https://github.com/archiverjs/node-compress-commons) |
| concat-stream@2.0.0 | MIT | [link](https://github.com/maxogden/concat-stream) |
| connect-pg-simple@10.0.0 | MIT | [link](https://github.com/voxpelli/node-connect-pg-simple) |
| content-disposition@0.5.4 | MIT | [link](https://github.com/jshttp/content-disposition) |
| content-type@1.0.5 | MIT | [link](https://github.com/jshttp/content-type) |
| cookie-signature@1.0.6 | MIT | [link](https://github.com/visionmedia/node-cookie-signature) |
| cookie-signature@1.0.7 | MIT | [link](https://github.com/visionmedia/node-cookie-signature) |
| cookie@1.1.1 | MIT | [link](https://github.com/jshttp/cookie) |
| core-util-is@1.0.2 | MIT | [link](https://github.com/isaacs/core-util-is) |
| core-util-is@1.0.3 | MIT | [link](https://github.com/isaacs/core-util-is) |
| cors@2.8.5 | MIT | [link](https://github.com/expressjs/cors) |
| crc-32@1.2.2 | Apache-2.0 | [link](https://github.com/SheetJS/js-crc32) |
| crc32-stream@6.0.0 | MIT | [link](https://github.com/archiverjs/node-crc32-stream) |
| create-hash@1.2.0 | MIT | [link](https://github.com/crypto-browserify/createHash) |
| create-hmac@1.1.7 | MIT | [link](https://github.com/crypto-browserify/createHmac) |
| create-require@1.1.1 | MIT | [link](https://github.com/nuxt-contrib/create-require) |
| cron@4.4.0 | MIT | [link](https://github.com/kelektiv/node-cron) |
| cross-fetch@3.2.0 | MIT | [link](https://github.com/lquixada/cross-fetch) |
| cross-spawn@7.0.6 | MIT | [link](https://github.com/moxystudio/node-cross-spawn) |
| crypt@0.0.2 | BSD-3-Clause | [link](https://github.com/pvorb/node-crypt) |
| csrf@3.1.0 | MIT | [link](https://github.com/pillarjs/csrf) |
| csurf@1.11.0 | MIT | [link](https://github.com/expressjs/csurf) |
| csv-parser@3.2.0 | MIT | [link](https://github.com/mafintosh/csv-parser) |
| dashdash@1.14.1 | MIT | [link](https://github.com/trentm/node-dashdash) |
| data-uri-to-buffer@4.0.1 | MIT | [link](https://github.com/TooTallNate/node-data-uri-to-buffer) |
| data-view-buffer@1.0.2 | MIT | [link](https://github.com/inspect-js/data-view-buffer) |
| data-view-byte-length@1.0.2 | MIT | [link](https://github.com/inspect-js/data-view-byte-length) |
| data-view-byte-offset@1.0.1 | MIT | [link](https://github.com/inspect-js/data-view-byte-offset) |
| death@1.1.0 | MIT | [link](https://github.com/jprichardson/node-death) |
| debug@2.6.9 | MIT | [link](https://github.com/visionmedia/debug) |
| debug@3.2.7 | MIT | [link](https://github.com/visionmedia/debug) |
| debug@4.4.3 | MIT | [link](https://github.com/debug-js/debug) |
| decamelize@1.2.0 | MIT | [link](https://github.com/sindresorhus/decamelize) |
| decamelize@4.0.0 | MIT | [link](https://github.com/sindresorhus/decamelize) |
| deep-eql@4.1.4 | MIT | [link](https://github.com/chaijs/deep-eql) |
| deep-extend@0.6.0 | MIT | [link](https://github.com/unclechu/node-deep-extend) |
| deep-is@0.1.4 | MIT | [link](https://github.com/thlorenz/deep-is) |
| deepmerge@4.3.1 | MIT | [link](https://github.com/TehShrike/deepmerge) |
| define-data-property@1.1.4 | MIT | [link](https://github.com/ljharb/define-data-property) |
| define-properties@1.2.1 | MIT | [link](https://github.com/ljharb/define-properties) |
| delayed-stream@1.0.0 | MIT | [link](https://github.com/felixge/node-delayed-stream) |
| depd@1.1.2 | MIT | [link](https://github.com/dougwilson/nodejs-depd) |
| depd@2.0.0 | MIT | [link](https://github.com/dougwilson/nodejs-depd) |
| destroy@1.2.0 | MIT | [link](https://github.com/stream-utils/destroy) |
| diff@5.2.2 | BSD-3-Clause | [link](https://github.com/kpdecker/jsdiff) |
| difflib@0.2.4 | PSF | [link](https://github.com/qiao/difflib.js) |
| dir-glob@3.0.1 | MIT | [link](https://github.com/kevva/dir-glob) |
| dom-serializer@2.0.0 | MIT | [link](https://github.com/cheeriojs/dom-serializer) |
| domelementtype@2.3.0 | BSD-2-Clause | [link](https://github.com/fb55/domelementtype) |
| domhandler@5.0.3 | BSD-2-Clause | [link](https://github.com/fb55/domhandler) |
| domutils@3.2.2 | BSD-2-Clause | [link](https://github.com/fb55/domutils) |
| dotenv@16.6.1 | BSD-2-Clause | [link](https://github.com/motdotla/dotenv) |
| dunder-proto@1.0.1 | MIT | [link](https://github.com/es-shims/dunder-proto) |
| eastasianwidth@0.2.0 | MIT | [link](https://github.com/komagata/eastasianwidth) |
| ecc-jsbn@0.1.2 | MIT | [link](https://github.com/quartzjer/ecc-jsbn) |
| ecdsa-sig-formatter@1.0.11 | Apache-2.0 | [link](https://github.com/Brightspace/node-ecdsa-sig-formatter) |
| ee-first@1.1.1 | MIT | [link](https://github.com/jonathanong/ee-first) |
| elliptic@6.6.1 | MIT | [link](https://github.com/indutny/elliptic) |
| emoji-regex@8.0.0 | MIT | [link](https://github.com/mathiasbynens/emoji-regex) |
| emoji-regex@9.2.2 | MIT | [link](https://github.com/mathiasbynens/emoji-regex) |
| enabled@2.0.0 | MIT | [link](https://github.com/3rd-Eden/enabled) |
| encodeurl@2.0.0 | MIT | [link](https://github.com/pillarjs/encodeurl) |
| encoding-japanese@2.2.0 | MIT | [link](https://github.com/polygonplanet/encoding.js) |
| end-of-stream@1.4.5 | MIT | [link](https://github.com/mafintosh/end-of-stream) |
| enquirer@2.4.1 | MIT | [link](https://github.com/enquirer/enquirer) |
| entities@4.5.0 | BSD-2-Clause | [link](https://github.com/fb55/entities) |
| env-paths@2.2.1 | MIT | [link](https://github.com/sindresorhus/env-paths) |
| es-abstract@1.24.1 | MIT | [link](https://github.com/ljharb/es-abstract) |
| es-define-property@1.0.1 | MIT | [link](https://github.com/ljharb/es-define-property) |
| es-errors@1.3.0 | MIT | [link](https://github.com/ljharb/es-errors) |
| es-object-atoms@1.1.1 | MIT | [link](https://github.com/ljharb/es-object-atoms) |
| es-set-tostringtag@2.1.0 | MIT | [link](https://github.com/es-shims/es-set-tostringtag) |
| es-shim-unscopables@1.1.0 | MIT | [link](https://github.com/ljharb/es-shim-unscopables) |
| es-to-primitive@1.3.0 | MIT | [link](https://github.com/ljharb/es-to-primitive) |
| escalade@3.2.0 | MIT | [link](https://github.com/lukeed/escalade) |
| escape-html@1.0.3 | MIT | [link](https://github.com/component/escape-html) |
| escape-string-regexp@1.0.5 | MIT | [link](https://github.com/sindresorhus/escape-string-regexp) |
| escape-string-regexp@4.0.0 | MIT | [link](https://github.com/sindresorhus/escape-string-regexp) |
| escodegen@1.8.1 | BSD-2-Clause | [link](https://github.com/estools/escodegen) |
| esprima@2.7.3 | BSD-2-Clause | [link](https://github.com/jquery/esprima) |
| estraverse@1.9.3 | BSD | [link](https://github.com/estools/estraverse) |
| esutils@2.0.3 | BSD-2-Clause | [link](https://github.com/estools/esutils) |
| etag@1.8.1 | MIT | [link](https://github.com/jshttp/etag) |
| ethereum-bloom-filters@1.2.0 | MIT | [link](https://github.com/joshstevens19/ethereum-bloom-filters) |
| ethereum-cryptography@0.1.3 | MIT | [link](https://github.com/ethereum/js-ethereum-cryptography) |
| ethereum-cryptography@1.2.0 | MIT | [link](https://github.com/ethereum/js-ethereum-cryptography) |
| ethereum-cryptography@2.2.1 | MIT | [link](https://github.com/ethereum/js-ethereum-cryptography) |
| ethereumjs-util@7.1.5 | MPL-2.0 | [link](https://github.com/ethereumjs/ethereumjs-monorepo) |
| ethers@6.16.0 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| ethjs-unit@0.1.6 | MIT | [link](https://github.com/ethjs/ethjs-unit) |
| event-target-shim@5.0.1 | MIT | [link](https://github.com/mysticatea/event-target-shim) |
| eventemitter3@3.1.2 | MIT | [link](https://github.com/primus/eventemitter3) |
| eventemitter3@4.0.7 | MIT | [link](https://github.com/primus/eventemitter3) |
| eventemitter3@5.0.1 | MIT | [link](https://github.com/primus/eventemitter3) |
| events-universal@1.0.1 | Apache-2.0 | [link](https://github.com/holepunchto/events-universal) |
| events@3.3.0 | MIT | [link](https://github.com/Gozala/events) |
| evp_bytestokey@1.0.3 | MIT | [link](https://github.com/crypto-browserify/EVP_BytesToKey) |
| express-rate-limit@7.5.1 | MIT | [link](https://github.com/express-rate-limit/express-rate-limit) |
| express-session@1.18.2 | MIT | [link](https://github.com/expressjs/session) |
| express@4.22.1 | MIT | [link](https://github.com/expressjs/express) |
| extend@3.0.2 | MIT | [link](https://github.com/justmoon/node-extend) |
| extsprintf@1.3.0 | MIT | [link](https://github.com/davepacheco/node-extsprintf) |
| extsprintf@1.4.1 | MIT | [link](https://github.com/davepacheco/node-extsprintf) |
| fast-deep-equal@3.1.3 | MIT | [link](https://github.com/epoberezkin/fast-deep-equal) |
| fast-fifo@1.3.2 | MIT | [link](https://github.com/mafintosh/fast-fifo) |
| fast-glob@3.3.3 | MIT | [link](https://github.com/mrmlnc/fast-glob) |
| fast-json-stable-stringify@2.1.0 | MIT | [link](https://github.com/epoberezkin/fast-json-stable-stringify) |
| fast-levenshtein@2.0.6 | MIT | [link](https://github.com/hiddentao/fast-levenshtein) |
| fastq@1.20.1 | ISC | [link](https://github.com/mcollina/fastq) |
| fdir@6.5.0 | MIT | [link](https://github.com/thecodrr/fdir) |
| fecha@4.2.3 | MIT | [link](git+https://taylorhakes@github.com/taylorhakes/fecha) |
| fetch-blob@3.2.0 | MIT | [link](https://github.com/node-fetch/fetch-blob) |
| file-type@3.9.0 | MIT | [link](https://github.com/sindresorhus/file-type) |
| fill-range@7.1.1 | MIT | [link](https://github.com/jonschlinkert/fill-range) |
| finalhandler@1.3.2 | MIT | [link](https://github.com/pillarjs/finalhandler) |
| find-replace@3.0.0 | MIT | [link](https://github.com/75lb/find-replace) |
| find-up@5.0.0 | MIT | [link](https://github.com/sindresorhus/find-up) |
| flat@5.0.2 | BSD-3-Clause | [link](https://github.com/hughsk/flat) |
| fn.name@1.1.0 | MIT | [link](https://github.com/3rd-Eden/fn.name) |
| follow-redirects@1.16.0 | MIT | [link](https://github.com/follow-redirects/follow-redirects) |
| for-each@0.3.5 | MIT | [link](https://github.com/Raynos/for-each) |
| foreground-child@3.3.1 | ISC | [link](https://github.com/tapjs/foreground-child) |
| forever-agent@0.6.1 | Apache-2.0 | [link](https://github.com/mikeal/forever-agent) |
| form-data-encoder@1.7.2 | MIT | [link](https://github.com/octet-stream/form-data-encoder) |
| form-data@4.0.6 | MIT | [link](https://github.com/form-data/form-data) |
| formdata-node@4.4.1 | MIT | [link](https://github.com/octet-stream/form-data) |
| formdata-polyfill@4.0.10 | MIT | [link](git+https://jimmywarting@github.com/jimmywarting/FormData) |
| forwarded@0.2.0 | MIT | [link](https://github.com/jshttp/forwarded) |
| fp-ts@1.19.3 | MIT | [link](https://github.com/gcanti/fp-ts) |
| fp-ts@1.19.5 | MIT | [link](https://github.com/gcanti/fp-ts) |
| fresh@0.5.2 | MIT | [link](https://github.com/jshttp/fresh) |
| fs-extra@10.1.0 | MIT | [link](https://github.com/jprichardson/node-fs-extra) |
| fs-extra@7.0.1 | MIT | [link](https://github.com/jprichardson/node-fs-extra) |
| fs-extra@8.1.0 | MIT | [link](https://github.com/jprichardson/node-fs-extra) |
| fs-extra@9.1.0 | MIT | [link](https://github.com/jprichardson/node-fs-extra) |
| fs.realpath@1.0.0 | ISC | [link](https://github.com/isaacs/fs.realpath) |
| function-bind@1.1.2 | MIT | [link](https://github.com/Raynos/function-bind) |
| function.prototype.name@1.1.8 | MIT | [link](https://github.com/es-shims/Function.prototype.name) |
| functions-have-names@1.2.3 | MIT | [link](https://github.com/inspect-js/functions-have-names) |
| gaxios@7.1.3 | Apache-2.0 | [link](https://github.com/googleapis/google-cloud-node-core) |
| gcp-metadata@8.1.2 | Apache-2.0 | [link](https://github.com/googleapis/google-cloud-node-core) |
| generator-function@2.0.1 | MIT | [link](https://github.com/TimothyGu/generator-function) |
| get-caller-file@2.0.5 | ISC | [link](https://github.com/stefanpenner/get-caller-file) |
| get-func-name@2.0.2 | MIT | [link](https://github.com/chaijs/get-func-name) |
| get-intrinsic@1.3.0 | MIT | [link](https://github.com/ljharb/get-intrinsic) |
| get-proto@1.0.1 | MIT | [link](https://github.com/ljharb/get-proto) |
| get-symbol-description@1.1.0 | MIT | [link](https://github.com/inspect-js/get-symbol-description) |
| getpass@0.1.7 | MIT | [link](https://github.com/arekinath/node-getpass) |
| ghost-testrpc@0.0.2 | ISC | [link](https://github.com/sc-forks/ghost-testrpc) |
| glob-parent@5.1.2 | ISC | [link](https://github.com/gulpjs/glob-parent) |
| glob@10.5.0 | ISC | [link](https://github.com/isaacs/node-glob) |
| glob@5.0.15 | ISC | [link](https://github.com/isaacs/node-glob) |
| glob@7.1.7 | ISC | [link](https://github.com/isaacs/node-glob) |
| glob@7.2.3 | ISC | [link](https://github.com/isaacs/node-glob) |
| glob@8.1.0 | ISC | [link](https://github.com/isaacs/node-glob) |
| global-modules@2.0.0 | MIT | [link](https://github.com/jonschlinkert/global-modules) |
| global-prefix@3.0.0 | MIT | [link](https://github.com/jonschlinkert/global-prefix) |
| globalthis@1.0.4 | MIT | [link](https://github.com/ljharb/System.global) |
| globby@10.0.2 | MIT | [link](https://github.com/sindresorhus/globby) |
| google-auth-library@10.5.0 | Apache-2.0 | [link](https://github.com/googleapis/google-auth-library-nodejs) |
| google-logging-utils@1.1.3 | Apache-2.0 | [link](https://github.com/googleapis/google-cloud-node-core) |
| gopd@1.2.0 | MIT | [link](https://github.com/ljharb/gopd) |
| graceful-fs@4.2.11 | ISC | [link](https://github.com/isaacs/node-graceful-fs) |
| graphql-request@6.1.0 | MIT | [link](https://github.com/jasonkuhrt/graphql-request) |
| graphql@16.12.0 | MIT | [link](https://github.com/graphql/graphql-js) |
| gtoken@8.0.0 | MIT | [link](https://github.com/google/node-gtoken) |
| handlebars@4.7.9 | MIT | [link](https://github.com/handlebars-lang/handlebars.js) |
| hardhat-contract-sizer@2.10.1 | MIT | [link](https://github.com/ItsNickBarry/hardhat-contract-sizer) |
| hardhat-gas-reporter@2.3.0 | MIT | [link](https://github.com/cgewecke/hardhat-gas-reporter) |
| hardhat@2.28.0 | MIT | [link](https://github.com/NomicFoundation/hardhat) |
| has-bigints@1.1.0 | MIT | [link](https://github.com/ljharb/has-bigints) |
| has-flag@1.0.0 | MIT | [link](https://github.com/sindresorhus/has-flag) |
| has-flag@3.0.0 | MIT | [link](https://github.com/sindresorhus/has-flag) |
| has-flag@4.0.0 | MIT | [link](https://github.com/sindresorhus/has-flag) |
| has-property-descriptors@1.0.2 | MIT | [link](https://github.com/inspect-js/has-property-descriptors) |
| has-proto@1.2.0 | MIT | [link](https://github.com/inspect-js/has-proto) |
| has-symbols@1.1.0 | MIT | [link](https://github.com/inspect-js/has-symbols) |
| has-tostringtag@1.0.2 | MIT | [link](https://github.com/inspect-js/has-tostringtag) |
| hash-base@3.1.2 | MIT | [link](https://github.com/crypto-browserify/hash-base) |
| hash.js@1.1.7 | MIT | [link](https://github.com/indutny/hash.js) |
| hasown@2.0.2 | MIT | [link](https://github.com/inspect-js/hasOwn) |
| hasown@2.0.4 | MIT | [link](https://github.com/inspect-js/hasOwn) |
| he@1.2.0 | MIT | [link](https://github.com/mathiasbynens/he) |
| heap@0.2.7 | MIT | [link](https://github.com/qiao/heap.js) |
| helmet@8.1.0 | MIT | [link](https://github.com/helmetjs/helmet) |
| hmac-drbg@1.0.1 | MIT | [link](https://github.com/indutny/hmac-drbg) |
| html-to-text@9.0.5 | MIT | [link](https://github.com/html-to-text/node-html-to-text) |
| htmlparser2@8.0.2 | MIT | [link](https://github.com/fb55/htmlparser2) |
| http-errors@1.7.3 | MIT | [link](https://github.com/jshttp/http-errors) |
| http-errors@2.0.1 | MIT | [link](https://github.com/jshttp/http-errors) |
| http-signature@1.4.0 | MIT | [link](https://github.com/TritonDataCenter/node-http-signature) |
| https-proxy-agent@5.0.1 | MIT | [link](https://github.com/TooTallNate/node-https-proxy-agent) |
| https-proxy-agent@7.0.6 | MIT | [link](https://github.com/TooTallNate/proxy-agents) |
| humanize-ms@1.2.1 | MIT | [link](https://github.com/node-modules/humanize-ms) |
| iconv-lite@0.4.24 | MIT | [link](https://github.com/ashtuchkin/iconv-lite) |
| iconv-lite@0.6.3 | MIT | [link](https://github.com/ashtuchkin/iconv-lite) |
| iconv-lite@0.7.0 | MIT | [link](https://github.com/pillarjs/iconv-lite) |
| ieee754@1.2.1 | BSD-3-Clause | [link](https://github.com/feross/ieee754) |
| ignore@5.3.2 | MIT | [link](https://github.com/kaelzhang/node-ignore) |
| imap@0.8.19 | MIT | [link](https://github.com/mscdex/node-imap) |
| immer@10.0.2 | MIT | [link](https://github.com/immerjs/immer) |
| immutable@4.3.9 | MIT | [link](https://github.com/immutable-js/immutable-js) |
| imurmurhash@0.1.4 | MIT | [link](https://github.com/jensyt/imurmurhash-js) |
| indent-string@4.0.0 | MIT | [link](https://github.com/sindresorhus/indent-string) |
| inflight@1.0.6 | ISC | [link](https://github.com/npm/inflight) |
| inherits@2.0.4 | ISC | [link](https://github.com/isaacs/inherits) |
| ini@1.3.8 | ISC | [link](https://github.com/isaacs/ini) |
| interface-store@6.0.3 | Apache-2.0 OR MIT | [link](https://github.com/ipfs/js-stores) |
| internal-slot@1.1.0 | MIT | [link](https://github.com/ljharb/internal-slot) |
| interpret@1.4.0 | MIT | [link](https://github.com/gulpjs/interpret) |
| io-ts@1.10.4 | MIT | [link](https://github.com/gcanti/io-ts) |
| ipaddr.js@1.9.1 | MIT | [link](https://github.com/whitequark/ipaddr.js) |
| is-array-buffer@3.0.5 | MIT | [link](https://github.com/inspect-js/is-array-buffer) |
| is-async-function@2.1.1 | MIT | [link](https://github.com/inspect-js/is-async-function) |
| is-bigint@1.1.0 | MIT | [link](https://github.com/inspect-js/is-bigint) |
| is-binary-path@2.1.0 | MIT | [link](https://github.com/sindresorhus/is-binary-path) |
| is-boolean-object@1.2.2 | MIT | [link](https://github.com/inspect-js/is-boolean-object) |
| is-callable@1.2.7 | MIT | [link](https://github.com/inspect-js/is-callable) |
| is-core-module@2.16.1 | MIT | [link](https://github.com/inspect-js/is-core-module) |
| is-data-view@1.0.2 | MIT | [link](https://github.com/inspect-js/is-data-view) |
| is-date-object@1.1.0 | MIT | [link](https://github.com/inspect-js/is-date-object) |
| is-extglob@2.1.1 | MIT | [link](https://github.com/jonschlinkert/is-extglob) |
| is-finalizationregistry@1.1.1 | MIT | [link](https://github.com/inspect-js/is-finalizationregistry) |
| is-fullwidth-code-point@3.0.0 | MIT | [link](https://github.com/sindresorhus/is-fullwidth-code-point) |
| is-generator-function@1.1.2 | MIT | [link](https://github.com/inspect-js/is-generator-function) |
| is-glob@4.0.3 | MIT | [link](https://github.com/micromatch/is-glob) |
| is-hex-prefixed@1.0.0 | MIT | [link](https://github.com/SilentCicero/is-hex-prefixed) |
| is-map@2.0.3 | MIT | [link](https://github.com/inspect-js/is-map) |
| is-negative-zero@2.0.3 | MIT | [link](https://github.com/inspect-js/is-negative-zero) |
| is-number-object@1.1.1 | MIT | [link](https://github.com/inspect-js/is-number-object) |
| is-number@7.0.0 | MIT | [link](https://github.com/jonschlinkert/is-number) |
| is-plain-obj@2.1.0 | MIT | [link](https://github.com/sindresorhus/is-plain-obj) |
| is-regex@1.2.1 | MIT | [link](https://github.com/inspect-js/is-regex) |
| is-set@2.0.3 | MIT | [link](https://github.com/inspect-js/is-set) |
| is-shared-array-buffer@1.0.4 | MIT | [link](https://github.com/inspect-js/is-shared-array-buffer) |
| is-stream@2.0.1 | MIT | [link](https://github.com/sindresorhus/is-stream) |
| is-string@1.1.1 | MIT | [link](https://github.com/inspect-js/is-string) |
| is-symbol@1.1.1 | MIT | [link](https://github.com/inspect-js/is-symbol) |
| is-typed-array@1.1.15 | MIT | [link](https://github.com/inspect-js/is-typed-array) |
| is-typedarray@1.0.0 | MIT | [link](https://github.com/hughsk/is-typedarray) |
| is-unicode-supported@0.1.0 | MIT | [link](https://github.com/sindresorhus/is-unicode-supported) |
| is-weakmap@2.0.2 | MIT | [link](https://github.com/inspect-js/is-weakmap) |
| is-weakref@1.1.1 | MIT | [link](https://github.com/inspect-js/is-weakref) |
| is-weakset@2.0.4 | MIT | [link](https://github.com/inspect-js/is-weakset) |
| isarray@0.0.1 | MIT | [link](https://github.com/juliangruber/isarray) |
| isarray@1.0.0 | MIT | [link](https://github.com/juliangruber/isarray) |
| isarray@2.0.5 | MIT | [link](https://github.com/juliangruber/isarray) |
| isexe@2.0.0 | ISC | [link](https://github.com/isaacs/isexe) |
| isows@1.0.7 | MIT | [link](https://github.com/wevm/isows) |
| isstream@0.1.2 | MIT | [link](https://github.com/rvagg/isstream) |
| jackspeak@3.4.3 | BlueOak-1.0.0 | [link](https://github.com/isaacs/jackspeak) |
| js-sha3@0.8.0 | MIT | [link](https://github.com/emn178/js-sha3) |
| js-tiktoken@1.0.21 | MIT | [link](https://github.com/dqbd/tiktoken) |
| js-yaml@4.3.0 | MIT | [link](https://github.com/nodeca/js-yaml) |
| jsbn@0.1.1 | MIT | [link](https://github.com/andyperlitch/jsbn) |
| json-bigint@1.0.0 | MIT | [link](https://github.com/sidorares/json-bigint) |
| json-schema-traverse@0.4.1 | MIT | [link](https://github.com/epoberezkin/json-schema-traverse) |
| json-schema@0.4.0 | (AFL-2.1 OR BSD-3-Clause) | [link](https://github.com/kriszyp/json-schema) |
| json-stream-stringify@3.1.6 | MIT | [link](https://github.com/Faleij/json-stream-stringify) |
| json-stringify-safe@5.0.1 | ISC | [link](https://github.com/isaacs/json-stringify-safe) |
| json5@2.2.3 | MIT | [link](https://github.com/json5/json5) |
| jsonfile@4.0.0 | MIT | [link](https://github.com/jprichardson/node-jsonfile) |
| jsonfile@6.2.0 | MIT | [link](https://github.com/jprichardson/node-jsonfile) |
| jsonpointer@5.0.1 | MIT | [link](https://github.com/janl/node-jsonpointer) |
| jsonschema@1.5.0 | MIT | [link](https://github.com/tdegrunt/jsonschema) |
| jsprim@2.0.2 | MIT | [link](https://github.com/joyent/node-jsprim) |
| jwa@2.0.1 | MIT | [link](https://github.com/brianloveswords/node-jwa) |
| jws@4.0.1 | MIT | [link](https://github.com/brianloveswords/node-jws) |
| keccak@3.0.4 | MIT | [link](https://github.com/cryptocoinjs/keccak) |
| kind-of@6.0.3 | MIT | [link](https://github.com/jonschlinkert/kind-of) |
| kleur@3.0.3 | MIT | [link](https://github.com/lukeed/kleur) |
| kruptein@2.2.3 | MIT | [link](https://github.com/jas-/kruptein) |
| kuler@2.0.0 | MIT | [link](https://github.com/3rd-Eden/kuler) |
| langchain@0.3.37 | MIT | [link](https://github.com/langchain-ai/langchainjs) |
| langsmith@0.6.3 | MIT | [link](https://github.com/langchain-ai/langsmith-sdk) |
| lazystream@1.0.1 | MIT | [link](https://github.com/jpommerening/node-lazystream) |
| leac@0.6.0 | MIT | [link](https://github.com/mxxii/leac) |
| levn@0.3.0 | MIT | [link](https://github.com/gkz/levn) |
| libbase64@1.3.0 | MIT | [link](https://github.com/nodemailer/libbase64) |
| libmime@5.3.7 | MIT | [link](https://github.com/nodemailer/libmime) |
| libqp@2.1.1 | MIT | [link](https://github.com/nodemailer/libqp) |
| linkify-it@5.0.1 | MIT | [link](https://github.com/markdown-it/linkify-it) |
| locate-path@6.0.0 | MIT | [link](https://github.com/sindresorhus/locate-path) |
| lodash.camelcase@4.3.0 | MIT | [link](https://github.com/lodash/lodash) |
| lodash.clonedeep@4.5.0 | MIT | [link](https://github.com/lodash/lodash) |
| lodash.isequal@4.5.0 | MIT | [link](https://github.com/lodash/lodash) |
| lodash.truncate@4.4.2 | MIT | [link](https://github.com/lodash/lodash) |
| lodash@4.18.1 | MIT | [link](https://github.com/lodash/lodash) |
| log-symbols@4.1.0 | MIT | [link](https://github.com/sindresorhus/log-symbols) |
| logform@2.7.0 | MIT | [link](https://github.com/winstonjs/logform) |
| long@5.3.2 | Apache-2.0 | [link](https://github.com/dcodeIO/long.js) |
| loupe@2.3.7 | MIT | [link](https://github.com/chaijs/loupe) |
| lru_map@0.3.3 | MIT | [link](https://github.com/rsms/js-lru) |
| lru-cache@10.4.3 | ISC | [link](https://github.com/isaacs/node-lru-cache) |
| luxon@3.7.2 | MIT | [link](https://github.com/moment/luxon) |
| mailparser@3.9.1 | MIT | [link](https://github.com/nodemailer/mailparser) |
| make-error@1.3.6 | ISC | [link](https://github.com/JsCommunity/make-error) |
| markdown-table@2.0.0 | MIT | [link](https://github.com/wooorm/markdown-table) |
| math-expression-evaluator@2.0.7 | MIT | [link](https://github.com/redhivesoftware/math-expression-evaluator) |
| math-intrinsics@1.1.0 | MIT | [link](https://github.com/es-shims/math-intrinsics) |
| md5.js@1.3.5 | MIT | [link](https://github.com/crypto-browserify/md5.js) |
| media-typer@0.3.0 | MIT | [link](https://github.com/jshttp/media-typer) |
| memorystream@0.3.1 | MIT | [link](https://github.com/JSBizon/node-memorystream) |
| merge-descriptors@1.0.3 | MIT | [link](https://github.com/sindresorhus/merge-descriptors) |
| merge2@1.4.1 | MIT | [link](https://github.com/teambition/merge2) |
| methods@1.1.2 | MIT | [link](https://github.com/jshttp/methods) |
| micro-eth-signer@0.14.0 | MIT | [link](https://github.com/paulmillr/micro-eth-signer) |
| micro-ftch@0.3.1 | MIT | — |
| micro-packed@0.7.3 | MIT | [link](https://github.com/paulmillr/micro-packed) |
| micromatch@4.0.8 | MIT | [link](https://github.com/micromatch/micromatch) |
| mime-db@1.52.0 | MIT | [link](https://github.com/jshttp/mime-db) |
| mime-types@2.1.35 | MIT | [link](https://github.com/jshttp/mime-types) |
| mime@1.6.0 | MIT | [link](https://github.com/broofa/node-mime) |
| minimalistic-assert@1.0.1 | ISC | [link](https://github.com/calvinmetcalf/minimalistic-assert) |
| minimalistic-crypto-utils@1.0.1 | MIT | [link](https://github.com/indutny/minimalistic-crypto-utils) |
| minimatch@10.2.4 | BlueOak-1.0.0 | [link](https://github.com/isaacs/minimatch) |
| minimist@1.2.8 | MIT | [link](https://github.com/minimistjs/minimist) |
| minipass@7.1.2 | ISC | [link](https://github.com/isaacs/minipass) |
| mkdirp@0.5.6 | MIT | [link](https://github.com/substack/node-mkdirp) |
| mkdirp@1.0.4 | MIT | [link](https://github.com/isaacs/node-mkdirp) |
| mnemonist@0.38.5 | MIT | [link](https://github.com/yomguithereal/mnemonist) |
| mocha@10.8.2 | MIT | [link](https://github.com/mochajs/mocha) |
| mri@1.2.0 | MIT | [link](https://github.com/lukeed/mri) |
| ms@2.0.0 | MIT | [link](https://github.com/zeit/ms) |
| ms@2.1.3 | MIT | [link](https://github.com/vercel/ms) |
| multer@2.2.0 | MIT | [link](https://github.com/expressjs/multer) |
| mustache@4.2.0 | MIT | [link](https://github.com/janl/mustache.js) |
| ndjson@2.0.0 | BSD-3-Clause | [link](https://github.com/ndjson/ndjson.js) |
| negotiator@0.6.3 | MIT | [link](https://github.com/jshttp/negotiator) |
| neo-async@2.6.2 | MIT | [link](https://github.com/suguru03/neo-async) |
| nice-grpc-client-middleware-retry@3.1.13 | MIT | [link](https://github.com/deeplay-io/nice-grpc) |
| nice-grpc-common@2.0.2 | MIT | [link](https://github.com/deeplay-io/nice-grpc) |
| nice-grpc@2.1.14 | MIT | [link](https://github.com/deeplay-io/nice-grpc) |
| node-addon-api@2.0.2 | MIT | [link](https://github.com/nodejs/node-addon-api) |
| node-addon-api@5.1.0 | MIT | [link](https://github.com/nodejs/node-addon-api) |
| node-cron@3.0.3 | ISC | [link](https://github.com/merencia/node-cron) |
| node-domexception@1.0.0 | MIT | [link](https://github.com/jimmywarting/node-domexception) |
| node-emoji@1.11.0 | MIT | [link](https://github.com/omnidan/node-emoji) |
| node-eta@0.9.0 | MIT | [link](https://github.com/titarenko/eta) |
| node-fetch@2.7.0 | MIT | [link](https://github.com/bitinn/node-fetch) |
| node-fetch@3.3.2 | MIT | [link](https://github.com/node-fetch/node-fetch) |
| node-gyp-build@4.8.4 | MIT | [link](https://github.com/prebuild/node-gyp-build) |
| node-telegram-bot-api@0.66.0 | MIT | [link](https://github.com/yagop/node-telegram-bot-api) |
| nodemailer@9.0.3 | MIT-0 | [link](https://github.com/nodemailer/nodemailer) |
| nofilter@3.1.0 | MIT | [link](https://github.com/hildjj/nofilter) |
| nopt@3.0.6 | ISC | [link](https://github.com/npm/nopt) |
| normalize-path@3.0.0 | MIT | [link](https://github.com/jonschlinkert/normalize-path) |
| number-to-bn@1.7.0 | MIT | [link](https://github.com/SilentCicero/number-to-bn) |
| object-assign@4.1.1 | MIT | [link](https://github.com/sindresorhus/object-assign) |
| object-inspect@1.13.4 | MIT | [link](https://github.com/inspect-js/object-inspect) |
| object-keys@1.1.1 | MIT | [link](https://github.com/ljharb/object-keys) |
| object.assign@4.1.7 | MIT | [link](https://github.com/ljharb/object.assign) |
| obliterator@2.0.5 | MIT | [link](https://github.com/yomguithereal/obliterator) |
| ollama@0.5.18 | MIT | [link](https://github.com/ollama/ollama-js) |
| on-finished@2.4.1 | MIT | [link](https://github.com/jshttp/on-finished) |
| on-headers@1.1.0 | MIT | [link](https://github.com/jshttp/on-headers) |
| once@1.4.0 | ISC | [link](https://github.com/isaacs/once) |
| one-time@1.0.0 | MIT | [link](https://github.com/3rd-Eden/one-time) |
| openai@4.104.0 | Apache-2.0 | [link](https://github.com/openai/openai-node) |
| openai@5.12.2 | Apache-2.0 | [link](https://github.com/openai/openai-node) |
| openapi-types@12.1.3 | MIT | [link](https://github.com/kogosoftwarellc/open-api/tree/master/packages/openapi-types) |
| optionator@0.8.3 | MIT | [link](https://github.com/gkz/optionator) |
| ordinal@1.0.3 | MIT | [link](https://github.com/dcousens/ordinal) |
| own-keys@1.0.1 | MIT | [link](https://github.com/ljharb/own-keys) |
| ox@0.11.1 | MIT | [link](https://github.com/wevm/ox) |
| p-finally@1.0.0 | MIT | [link](https://github.com/sindresorhus/p-finally) |
| p-limit@3.1.0 | MIT | [link](https://github.com/sindresorhus/p-limit) |
| p-locate@5.0.0 | MIT | [link](https://github.com/sindresorhus/p-locate) |
| p-map@4.0.0 | MIT | [link](https://github.com/sindresorhus/p-map) |
| p-queue@6.6.2 | MIT | [link](https://github.com/sindresorhus/p-queue) |
| p-retry@4.6.2 | MIT | [link](https://github.com/sindresorhus/p-retry) |
| p-timeout@3.2.0 | MIT | [link](https://github.com/sindresorhus/p-timeout) |
| p-timeout@4.1.0 | MIT | [link](https://github.com/sindresorhus/p-timeout) |
| package-json-from-dist@1.0.1 | BlueOak-1.0.0 | [link](https://github.com/isaacs/package-json-from-dist) |
| parseley@0.12.1 | MIT | [link](https://github.com/mxxii/parseley) |
| parseurl@1.3.3 | MIT | [link](https://github.com/pillarjs/parseurl) |
| path-exists@4.0.0 | MIT | [link](https://github.com/sindresorhus/path-exists) |
| path-is-absolute@1.0.1 | MIT | [link](https://github.com/sindresorhus/path-is-absolute) |
| path-key@3.1.1 | MIT | [link](https://github.com/sindresorhus/path-key) |
| path-parse@1.0.7 | MIT | [link](https://github.com/jbgutierrez/path-parse) |
| path-scurry@1.11.1 | BlueOak-1.0.0 | [link](https://github.com/isaacs/path-scurry) |
| path-to-regexp@0.1.13 | MIT | [link](https://github.com/pillarjs/path-to-regexp) |
| path-type@4.0.0 | MIT | [link](https://github.com/sindresorhus/path-type) |
| pathval@1.1.1 | MIT | [link](https://github.com/chaijs/pathval) |
| pbkdf2@3.1.5 | MIT | [link](https://github.com/browserify/pbkdf2) |
| peberminta@0.9.0 | MIT | [link](https://github.com/mxxii/peberminta) |
| performance-now@2.1.0 | MIT | [link](https://github.com/braveg1rl/performance-now) |
| pg-cloudflare@1.2.7 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-connection-string@2.9.1 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-int8@1.0.1 | ISC | [link](https://github.com/charmander/pg-int8) |
| pg-large-object@2.0.0 | MIT | [link](https://github.com/Joris-van-der-Wel/node-pg-large-object) |
| pg-pool@3.10.1 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-protocol@1.10.3 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-types@2.2.0 | MIT | [link](https://github.com/brianc/node-pg-types) |
| pg@8.16.3 | MIT | [link](https://github.com/brianc/node-postgres) |
| pgpass@1.0.5 | MIT | [link](https://github.com/hoegaarden/pgpass) |
| picocolors@1.1.1 | ISC | [link](https://github.com/alexeyraspopov/picocolors) |
| picomatch@4.0.4 | MIT | [link](https://github.com/micromatch/picomatch) |
| pify@4.0.1 | MIT | [link](https://github.com/sindresorhus/pify) |
| possible-typed-array-names@1.1.0 | MIT | [link](https://github.com/ljharb/possible-typed-array-names) |
| postgres-array@2.0.0 | MIT | [link](https://github.com/bendrucker/postgres-array) |
| postgres-bytea@1.0.1 | MIT | [link](https://github.com/bendrucker/postgres-bytea) |
| postgres-date@1.0.7 | MIT | [link](https://github.com/bendrucker/postgres-date) |
| postgres-interval@1.2.0 | MIT | [link](https://github.com/bendrucker/postgres-interval) |
| prelude-ls@1.1.2 | MIT | [link](https://github.com/gkz/prelude-ls) |
| prettier@2.8.8 | MIT | [link](https://github.com/prettier/prettier) |
| process-nextick-args@2.0.1 | MIT | [link](https://github.com/calvinmetcalf/process-nextick-args) |
| process@0.11.10 | MIT | [link](https://github.com/shtylman/node-process) |
| prompts@2.4.2 | MIT | [link](https://github.com/terkelg/prompts) |
| protobufjs@7.6.4 | BSD-3-Clause | [link](https://github.com/protobufjs/protobuf.js) |
| proxy-addr@2.0.7 | MIT | [link](https://github.com/jshttp/proxy-addr) |
| proxy-from-env@2.1.0 | MIT | [link](https://github.com/Rob--W/proxy-from-env) |
| psl@1.15.0 | MIT | [link](https://github.com/lupomontero/psl) |
| pump@2.0.1 | MIT | [link](https://github.com/mafintosh/pump) |
| punycode.js@2.3.1 | MIT | [link](https://github.com/mathiasbynens/punycode.js) |
| punycode@2.3.1 | MIT | [link](https://github.com/mathiasbynens/punycode.js) |
| qs@6.15.3 | BSD-3-Clause | [link](https://github.com/ljharb/qs) |
| querystringify@2.2.0 | MIT | [link](https://github.com/unshiftio/querystringify) |
| queue-microtask@1.2.3 | MIT | [link](https://github.com/feross/queue-microtask) |
| random-bytes@1.0.0 | MIT | [link](https://github.com/crypto-utils/random-bytes) |
| randombytes@2.1.0 | MIT | [link](https://github.com/crypto-browserify/randombytes) |
| range-parser@1.2.1 | MIT | [link](https://github.com/jshttp/range-parser) |
| raw-body@2.5.3 | MIT | [link](https://github.com/stream-utils/raw-body) |
| readable-stream@1.1.14 | MIT | [link](https://github.com/isaacs/readable-stream) |
| readable-stream@2.3.8 | MIT | [link](https://github.com/nodejs/readable-stream) |
| readable-stream@3.6.2 | MIT | [link](https://github.com/nodejs/readable-stream) |
| readable-stream@4.7.0 | MIT | [link](https://github.com/nodejs/readable-stream) |
| readdir-glob@1.1.3 | Apache-2.0 | [link](https://github.com/Yqnn/node-readdir-glob) |
| readdirp@3.6.0 | MIT | [link](https://github.com/paulmillr/readdirp) |
| readdirp@4.1.2 | MIT | [link](https://github.com/paulmillr/readdirp) |
| rechoir@0.6.2 | MIT | [link](https://github.com/tkellen/node-rechoir) |
| recursive-readdir@2.2.3 | MIT | [link](https://github.com/jergason/recursive-readdir) |
| reduce-flatten@2.0.0 | MIT | [link](https://github.com/75lb/reduce-flatten) |
| reflect.getprototypeof@1.0.10 | MIT | [link](https://github.com/es-shims/Reflect.getPrototypeOf) |
| regexp.prototype.flags@1.5.4 | MIT | [link](https://github.com/es-shims/RegExp.prototype.flags) |
| repeat-string@1.6.1 | MIT | [link](https://github.com/jonschlinkert/repeat-string) |
| request-promise-core@1.1.3 | ISC | [link](https://github.com/request/promise-core) |
| require-directory@2.1.1 | MIT | [link](https://github.com/troygoode/node-require-directory) |
| requires-port@1.0.0 | MIT | [link](https://github.com/unshiftio/requires-port) |
| resolve@1.1.7 | MIT | [link](https://github.com/substack/node-resolve) |
| resolve@1.17.0 | MIT | [link](https://github.com/browserify/resolve) |
| resolve@1.22.11 | MIT | [link](https://github.com/browserify/resolve) |
| retry@0.12.0 | MIT | [link](https://github.com/tim-kos/node-retry) |
| retry@0.13.1 | MIT | [link](https://github.com/tim-kos/node-retry) |
| reusify@1.1.0 | MIT | [link](https://github.com/mcollina/reusify) |
| rimraf@5.0.10 | ISC | [link](https://github.com/isaacs/rimraf) |
| ripemd160@2.0.3 | MIT | [link](https://github.com/crypto-browserify/ripemd160) |
| rlp@2.2.7 | MPL-2.0 | [link](https://github.com/ethereumjs/rlp) |
| rndm@1.2.0 | MIT | [link](https://github.com/crypto-utils/rndm) |
| run-parallel@1.2.0 | MIT | [link](https://github.com/feross/run-parallel) |
| safe-array-concat@1.1.3 | MIT | [link](https://github.com/ljharb/safe-array-concat) |
| safe-buffer@5.1.2 | MIT | [link](https://github.com/feross/safe-buffer) |
| safe-buffer@5.2.1 | MIT | [link](https://github.com/feross/safe-buffer) |
| safe-compare@1.1.4 | MIT | [link](https://github.com/Bruce17/safe-compare) |
| safe-push-apply@1.0.0 | MIT | [link](https://github.com/ljharb/safe-push-apply) |
| safe-regex-test@1.1.0 | MIT | [link](https://github.com/ljharb/safe-regex-test) |
| safe-stable-stringify@2.5.0 | MIT | [link](https://github.com/BridgeAR/safe-stable-stringify) |
| safer-buffer@2.1.2 | MIT | [link](https://github.com/ChALkeR/safer-buffer) |
| sandwich-stream@2.0.2 | Apache-2.0 | [link](https://github.com/connrs/node-sandwich-stream) |
| sc-istanbul@0.4.6 | BSD-3-Clause | [link](https://github.com/gotwarlost/istanbul) |
| scrypt-js@3.0.1 | MIT | [link](https://github.com/ricmoo/scrypt-js) |
| secp256k1@4.0.4 | MIT | [link](https://github.com/cryptocoinjs/secp256k1-node) |
| selderee@0.11.0 | MIT | [link](https://github.com/mxxii/selderee) |
| semver@7.7.3 | ISC | [link](https://github.com/npm/node-semver) |
| send@0.19.2 | MIT | [link](https://github.com/pillarjs/send) |
| serialize-javascript@7.0.7 | BSD-3-Clause | [link](https://github.com/yahoo/serialize-javascript) |
| serve-static@1.16.3 | MIT | [link](https://github.com/expressjs/serve-static) |
| session-file-store@1.5.0 | Apache-2.0 | [link](https://github.com/valery-barysok/session-file-store) |
| set-function-length@1.2.2 | MIT | [link](https://github.com/ljharb/set-function-length) |
| set-function-name@2.0.2 | MIT | [link](https://github.com/ljharb/set-function-name) |
| set-proto@1.0.0 | MIT | [link](https://github.com/ljharb/set-proto) |
| setimmediate@1.0.5 | MIT | [link](https://github.com/YuzuJS/setImmediate) |
| setprototypeof@1.1.1 | ISC | [link](https://github.com/wesleytodd/setprototypeof) |
| setprototypeof@1.2.0 | ISC | [link](https://github.com/wesleytodd/setprototypeof) |
| sha.js@2.4.12 | (MIT AND BSD-3-Clause) | [link](https://github.com/crypto-browserify/sha.js) |
| sha1@1.1.1 | BSD-3-Clause | [link](https://github.com/pvorb/node-sha1) |
| shebang-command@2.0.0 | MIT | [link](https://github.com/kevva/shebang-command) |
| shebang-regex@3.0.0 | MIT | [link](https://github.com/sindresorhus/shebang-regex) |
| shelljs@0.8.5 | BSD-3-Clause | [link](https://github.com/shelljs/shelljs) |
| side-channel-list@1.0.0 | MIT | [link](https://github.com/ljharb/side-channel-list) |
| side-channel-list@1.0.1 | MIT | [link](https://github.com/ljharb/side-channel-list) |
| side-channel-map@1.0.1 | MIT | [link](https://github.com/ljharb/side-channel-map) |
| side-channel-weakmap@1.0.2 | MIT | [link](https://github.com/ljharb/side-channel-weakmap) |
| side-channel@1.1.0 | MIT | [link](https://github.com/ljharb/side-channel) |
| side-channel@1.1.1 | MIT | [link](https://github.com/ljharb/side-channel) |
| signal-exit@3.0.7 | ISC | [link](https://github.com/tapjs/signal-exit) |
| signal-exit@4.1.0 | ISC | [link](https://github.com/tapjs/signal-exit) |
| sisteransi@1.0.5 | MIT | [link](https://github.com/terkelg/sisteransi) |
| siwe@2.3.2 | Apache-2.0 | [link](https://github.com/spruceid/siwe) |
| slash@3.0.0 | MIT | [link](https://github.com/sindresorhus/slash) |
| slice-ansi@4.0.0 | MIT | [link](https://github.com/chalk/slice-ansi) |
| solc@0.8.26 | MIT | [link](https://github.com/ethereum/solc-js) |
| solidity-coverage@0.8.17 | ISC | [link](https://github.com/sc-forks/solidity-coverage) |
| source-map-support@0.5.21 | MIT | [link](https://github.com/evanw/node-source-map-support) |
| source-map@0.2.0 | BSD | [link](https://github.com/mozilla/source-map) |
| source-map@0.6.1 | BSD-3-Clause | [link](https://github.com/mozilla/source-map) |
| split2@3.2.2 | ISC | [link](https://github.com/mcollina/split2) |
| split2@4.2.0 | ISC | [link](https://github.com/mcollina/split2) |
| sshpk@1.18.0 | MIT | [link](https://github.com/joyent/node-sshpk) |
| stack-trace@0.0.10 | MIT | [link](https://github.com/felixge/node-stack-trace) |
| stacktrace-parser@0.1.11 | MIT | [link](https://github.com/errwischt/stacktrace-parser) |
| statuses@1.5.0 | MIT | [link](https://github.com/jshttp/statuses) |
| statuses@2.0.2 | MIT | [link](https://github.com/jshttp/statuses) |
| stealthy-require@1.1.1 | ISC | [link](https://github.com/analog-nico/stealthy-require) |
| stop-iteration-iterator@1.1.0 | MIT | [link](https://github.com/ljharb/stop-iteration-iterator) |
| streamsearch@1.1.0 | MIT | [link](https://github.com/mscdex/streamsearch) |
| streamx@2.23.0 | MIT | [link](https://github.com/mafintosh/streamx) |
| string_decoder@0.10.31 | MIT | [link](https://github.com/rvagg/string_decoder) |
| string_decoder@1.1.1 | MIT | [link](https://github.com/nodejs/string_decoder) |
| string_decoder@1.3.0 | MIT | [link](https://github.com/nodejs/string_decoder) |
| string-format@2.0.0 | WTFPL OR MIT | [link](https://github.com/davidchambers/string-format) |
| string-width@4.2.3 | MIT | [link](https://github.com/sindresorhus/string-width) |
| string-width@5.1.2 | MIT | [link](https://github.com/sindresorhus/string-width) |
| string.prototype.trim@1.2.10 | MIT | [link](https://github.com/es-shims/String.prototype.trim) |
| string.prototype.trimend@1.0.9 | MIT | [link](https://github.com/es-shims/String.prototype.trimEnd) |
| string.prototype.trimstart@1.0.8 | MIT | [link](https://github.com/es-shims/String.prototype.trimStart) |
| strip-ansi@6.0.1 | MIT | [link](https://github.com/chalk/strip-ansi) |
| strip-ansi@7.1.2 | MIT | [link](https://github.com/chalk/strip-ansi) |
| strip-hex-prefix@1.0.0 | MIT | [link](https://github.com/SilentCicero/strip-hex-prefix) |
| strip-json-comments@3.1.1 | MIT | [link](https://github.com/sindresorhus/strip-json-comments) |
| supports-color@3.2.3 | MIT | [link](https://github.com/chalk/supports-color) |
| supports-color@5.5.0 | MIT | [link](https://github.com/chalk/supports-color) |
| supports-color@7.2.0 | MIT | [link](https://github.com/chalk/supports-color) |
| supports-color@8.1.1 | MIT | [link](https://github.com/chalk/supports-color) |
| supports-preserve-symlinks-flag@1.0.0 | MIT | [link](https://github.com/inspect-js/node-supports-preserve-symlinks-flag) |
| table-layout@1.0.2 | MIT | [link](https://github.com/75lb/table-layout) |
| table@6.9.0 | BSD-3-Clause | [link](https://github.com/gajus/table) |
| tar-stream@3.1.7 | MIT | [link](https://github.com/mafintosh/tar-stream) |
| telegraf@4.16.3 | MIT | [link](https://github.com/telegraf/telegraf) |
| text-decoder@1.2.3 | Apache-2.0 | [link](https://github.com/holepunchto/text-decoder) |
| text-hex@1.0.0 | MIT | [link](https://github.com/3rd-Eden/text-hex) |
| through2@4.0.2 | MIT | [link](https://github.com/rvagg/through2) |
| tinyglobby@0.2.15 | MIT | [link](https://github.com/SuperchupuDev/tinyglobby) |
| tlds@1.261.0 | MIT | [link](https://github.com/stephenmathieson/node-tlds) |
| tldts-core@6.1.86 | MIT | [link](https://github.com/remusao/tldts) |
| tldts@6.1.86 | MIT | [link](https://github.com/remusao/tldts) |
| tmp@0.2.7 | MIT | [link](https://github.com/raszi/node-tmp) |
| to-buffer@1.2.2 | MIT | [link](https://github.com/browserify/to-buffer) |
| to-regex-range@5.0.1 | MIT | [link](https://github.com/micromatch/to-regex-range) |
| toidentifier@1.0.0 | MIT | [link](https://github.com/component/toidentifier) |
| toidentifier@1.0.1 | MIT | [link](https://github.com/component/toidentifier) |
| tough-cookie@4.1.4 | BSD-3-Clause | [link](https://github.com/salesforce/tough-cookie) |
| tough-cookie@5.1.2 | BSD-3-Clause | [link](https://github.com/salesforce/tough-cookie) |
| tr46@0.0.3 | MIT | [link](https://github.com/Sebmaster/tr46.js) |
| triple-beam@1.4.1 | MIT | [link](https://github.com/winstonjs/triple-beam) |
| ts-command-line-args@2.5.1 | ISC | [link](https://github.com/Roaders/ts-command-line-args) |
| ts-error@1.0.6 | MIT | [link](https://github.com/gfmio/ts-error) |
| ts-essentials@7.0.3 | MIT | [link](https://github.com/krzkaczor/ts-essentials) |
| ts-node@10.9.2 | MIT | [link](https://github.com/TypeStrong/ts-node) |
| tslib@1.14.1 | 0BSD | [link](https://github.com/Microsoft/tslib) |
| tslib@2.7.0 | 0BSD | [link](https://github.com/Microsoft/tslib) |
| tsort@0.0.1 | MIT | [link](https://github.com/eknkc/tsort) |
| tsscmp@1.0.6 | MIT | [link](https://github.com/suryagh/tsscmp) |
| tunnel-agent@0.6.0 | Apache-2.0 | [link](https://github.com/mikeal/tunnel-agent) |
| tweetnacl@0.14.5 | Unlicense | [link](https://github.com/dchest/tweetnacl-js) |
| type-check@0.3.2 | MIT | [link](https://github.com/gkz/type-check) |
| type-detect@4.1.0 | MIT | [link](https://github.com/chaijs/type-detect) |
| type-fest@0.20.2 | (MIT OR CC0-1.0) | [link](https://github.com/sindresorhus/type-fest) |
| type-fest@0.21.3 | (MIT OR CC0-1.0) | [link](https://github.com/sindresorhus/type-fest) |
| type-fest@0.7.1 | (MIT OR CC0-1.0) | [link](https://github.com/sindresorhus/type-fest) |
| type-is@1.6.18 | MIT | [link](https://github.com/jshttp/type-is) |
| typechain@8.3.2 | MIT | [link](https://github.com/ethereum-ts/Typechain) |
| typed-array-buffer@1.0.3 | MIT | [link](https://github.com/inspect-js/typed-array-buffer) |
| typed-array-byte-length@1.0.3 | MIT | [link](https://github.com/inspect-js/typed-array-byte-length) |
| typed-array-byte-offset@1.0.4 | MIT | [link](https://github.com/inspect-js/typed-array-byte-offset) |
| typed-array-length@1.0.7 | MIT | [link](https://github.com/inspect-js/typed-array-length) |
| typedarray-to-buffer@3.1.5 | MIT | [link](https://github.com/feross/typedarray-to-buffer) |
| typedarray@0.0.6 | MIT | [link](https://github.com/substack/typedarray) |
| typescript@5.9.3 | Apache-2.0 | [link](https://github.com/microsoft/TypeScript) |
| typical@4.0.0 | MIT | [link](https://github.com/75lb/typical) |
| typical@5.2.0 | MIT | [link](https://github.com/75lb/typical) |
| uc.micro@2.1.0 | MIT | [link](https://github.com/markdown-it/uc.micro) |
| uglify-js@3.19.3 | BSD-2-Clause | [link](https://github.com/mishoo/UglifyJS) |
| uid-safe@2.1.5 | MIT | [link](https://github.com/crypto-utils/uid-safe) |
| unbox-primitive@1.1.0 | MIT | [link](https://github.com/ljharb/unbox-primitive) |
| undici-types@5.26.5 | MIT | [link](https://github.com/nodejs/undici) |
| undici-types@6.19.8 | MIT | [link](https://github.com/nodejs/undici) |
| undici-types@7.16.0 | MIT | [link](https://github.com/nodejs/undici) |
| undici@6.27.0 | MIT | [link](https://github.com/nodejs/undici) |
| universalify@0.1.2 | MIT | [link](https://github.com/RyanZim/universalify) |
| universalify@0.2.0 | MIT | [link](https://github.com/RyanZim/universalify) |
| universalify@2.0.1 | MIT | [link](https://github.com/RyanZim/universalify) |
| unpipe@1.0.0 | MIT | [link](https://github.com/stream-utils/unpipe) |
| uri-js@4.4.1 | BSD-2-Clause | [link](https://github.com/garycourt/uri-js) |
| url-parse@1.5.10 | MIT | [link](https://github.com/unshiftio/url-parse) |
| utf7@1.0.2 | BSD | — |
| utf8@3.0.0 | MIT | [link](https://github.com/mathiasbynens/utf8.js) |
| util-deprecate@1.0.2 | MIT | [link](https://github.com/TooTallNate/util-deprecate) |
| utils-merge@1.0.1 | MIT | [link](https://github.com/jaredhanson/utils-merge) |
| uuid@11.1.1 | MIT | [link](https://github.com/uuidjs/uuid) |
| v8-compile-cache-lib@3.0.1 | MIT | [link](https://github.com/cspotcode/v8-compile-cache-lib) |
| valid-url@1.0.9 | MIT* | [link](https://github.com/ogt/valid-url) |
| vary@1.1.2 | MIT | [link](https://github.com/jshttp/vary) |
| verror@1.10.0 | MIT | [link](https://github.com/davepacheco/node-verror) |
| viem@2.43.3 | MIT | [link](https://github.com/wevm/viem) |
| weaviate-client@3.10.0 | BSD-3-Clause | [link](https://github.com/weaviate/typescript-client) |
| web-streams-polyfill@3.3.3 | MIT | [link](https://github.com/MattiasBuelens/web-streams-polyfill) |
| web-streams-polyfill@4.0.0-beta.3 | MIT | [link](https://github.com/MattiasBuelens/web-streams-polyfill) |
| web3-utils@1.10.4 | LGPL-3.0 | [link](https://github.com/ethereum/web3.js/tree/1.x/packages/web3-utils) |
| webidl-conversions@3.0.1 | BSD-2-Clause | [link](https://github.com/jsdom/webidl-conversions) |
| whatwg-fetch@3.6.20 | MIT | [link](https://github.com/github/fetch) |
| whatwg-url@5.0.0 | MIT | [link](https://github.com/jsdom/whatwg-url) |
| which-boxed-primitive@1.1.1 | MIT | [link](https://github.com/inspect-js/which-boxed-primitive) |
| which-builtin-type@1.2.1 | MIT | [link](https://github.com/inspect-js/which-builtin-type) |
| which-collection@1.0.2 | MIT | [link](https://github.com/inspect-js/which-collection) |
| which-typed-array@1.1.19 | MIT | [link](https://github.com/inspect-js/which-typed-array) |
| which@1.3.1 | ISC | [link](https://github.com/isaacs/node-which) |
| which@2.0.2 | ISC | [link](https://github.com/isaacs/node-which) |
| widest-line@3.1.0 | MIT | [link](https://github.com/sindresorhus/widest-line) |
| winston-transport@4.9.0 | MIT | [link](https://github.com/winstonjs/winston-transport) |
| winston@3.19.0 | MIT | [link](https://github.com/winstonjs/winston) |
| word-wrap@1.2.5 | MIT | [link](https://github.com/jonschlinkert/word-wrap) |
| wordwrap@1.0.0 | MIT | [link](https://github.com/substack/node-wordwrap) |
| wordwrapjs@4.0.1 | MIT | [link](https://github.com/75lb/wordwrapjs) |
| workerpool@6.5.1 | Apache-2.0 | [link](https://github.com/josdejong/workerpool) |
| wrap-ansi@7.0.0 | MIT | [link](https://github.com/chalk/wrap-ansi) |
| wrap-ansi@8.1.0 | MIT | [link](https://github.com/chalk/wrap-ansi) |
| wrappy@1.0.2 | ISC | [link](https://github.com/npm/wrappy) |
| write-file-atomic@3.0.3 | ISC | [link](https://github.com/npm/write-file-atomic) |
| ws@8.21.0 | MIT | [link](https://github.com/websockets/ws) |
| xtend@4.0.2 | MIT | [link](https://github.com/Raynos/xtend) |
| y18n@5.0.8 | ISC | [link](https://github.com/yargs/y18n) |
| yaml@2.9.0 | ISC | [link](https://github.com/eemeli/yaml) |
| yargs-parser@20.2.9 | ISC | [link](https://github.com/yargs/yargs-parser) |
| yargs-parser@21.1.1 | ISC | [link](https://github.com/yargs/yargs-parser) |
| yargs-unparser@2.0.0 | MIT | [link](https://github.com/yargs/yargs-unparser) |
| yargs@16.2.0 | MIT | [link](https://github.com/yargs/yargs) |
| yargs@17.7.2 | MIT | [link](https://github.com/yargs/yargs) |
| yn@3.1.1 | MIT | [link](https://github.com/sindresorhus/yn) |
| yocto-queue@0.1.0 | MIT | [link](https://github.com/sindresorhus/yocto-queue) |
| zip-stream@6.0.1 | MIT | [link](https://github.com/archiverjs/node-zip-stream) |
| zod-to-json-schema@3.25.1 | ISC | [link](https://github.com/StefanTerdell/zod-to-json-schema) |
| zod@3.25.76 | MIT | [link](https://github.com/colinhacks/zod) |

</details>

---
## Frontend (Node.js, production)

Всего пакетов: **180**

| Лицензия | Количество |
|----------|------------|
| MIT | 146 |
| BSD-2-Clause | 9 |
| BSD-3-Clause | 7 |
| ISC | 6 |
| BSD* | 5 |
| Apache-2.0 | 4 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| 0BSD | 1 |
| MIT* | 1 |

### Требуют внимания

| Пакет | Лицензия | Примечание |
|-------|----------|------------|
| dompurify@3.4.11 | (MPL-2.0 OR Apache-2.0) | File-level copyleft при изменении файлов библиотеки |

<details>
<summary>Полный список пакетов</summary>

| Пакет | Лицензия | Репозиторий |
|-------|----------|-------------|
| @adraffy/ens-normalize@1.10.1 | MIT | [link](https://github.com/adraffy/ens-normalize.js) |
| @babel/helper-string-parser@7.27.1 | MIT | [link](https://github.com/babel/babel) |
| @babel/helper-validator-identifier@7.28.5 | MIT | [link](https://github.com/babel/babel) |
| @babel/parser@7.28.5 | MIT | [link](https://github.com/babel/babel) |
| @babel/types@7.28.5 | MIT | [link](https://github.com/babel/babel) |
| @ctrl/tinycolor@3.6.1 | MIT | [link](https://github.com/scttcper/tinycolor) |
| @element-plus/icons-vue@2.3.2 | MIT | [link](https://github.com/element-plus/element-plus-icons) |
| @floating-ui/core@1.7.3 | MIT | [link](https://github.com/floating-ui/floating-ui) |
| @floating-ui/dom@1.7.4 | MIT | [link](https://github.com/floating-ui/floating-ui) |
| @floating-ui/utils@0.2.10 | MIT | [link](https://github.com/floating-ui/floating-ui) |
| @intlify/core-base@11.2.7 | MIT | [link](https://github.com/intlify/vue-i18n) |
| @intlify/message-compiler@11.2.7 | MIT | [link](https://github.com/intlify/vue-i18n) |
| @intlify/shared@11.2.7 | MIT | [link](https://github.com/intlify/vue-i18n) |
| @jridgewell/sourcemap-codec@1.5.5 | MIT | [link](https://github.com/jridgewell/sourcemaps) |
| @kurkle/color@0.3.4 | MIT | [link](https://github.com/kurkle/color) |
| @noble/curves@1.2.0 | MIT | [link](https://github.com/paulmillr/noble-curves) |
| @noble/hashes@1.3.2 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @noble/hashes@1.8.0 | MIT | [link](https://github.com/paulmillr/noble-hashes) |
| @spruceid/siwe-parser@2.1.2 | Apache-2.0 | [link](https://github.com/spruceid/siwe) |
| @stablelib/binary@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/int@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/random@1.0.2 | MIT | [link](https://github.com/StableLib/stablelib) |
| @stablelib/wipe@1.0.1 | MIT | [link](https://github.com/StableLib/stablelib) |
| @sxzz/popperjs-es@2.11.7 | MIT | [link](https://github.com/popperjs/popper-core) |
| @types/lodash-es@4.17.12 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/lodash@4.17.21 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/node@22.7.5 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/trusted-types@2.0.7 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @types/web-bluetooth@0.0.20 | MIT | [link](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| @vue/compiler-core@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/compiler-dom@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/compiler-sfc@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/compiler-ssr@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/devtools-api@6.6.4 | MIT | [link](https://github.com/vuejs/vue-devtools) |
| @vue/reactivity@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/runtime-core@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/runtime-dom@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/server-renderer@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vue/shared@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| @vueuse/core@10.11.1 | MIT | [link](https://github.com/vueuse/vueuse) |
| @vueuse/metadata@10.11.1 | MIT | [link](https://github.com/vueuse/vueuse) |
| @vueuse/shared@10.11.1 | MIT | [link](https://github.com/vueuse/vueuse) |
| aes-js@4.0.0-beta.5 | MIT | [link](https://github.com/ricmoo/aes-js) |
| agent-base@6.0.2 | MIT | [link](https://github.com/TooTallNate/node-agent-base) |
| apg-js@4.4.0 | BSD-2-Clause | [link](https://github.com/ldthomas/apg-js) |
| async-validator@4.2.5 | MIT | [link](https://github.com/yiminghe/async-validator) |
| asynckit@0.4.0 | MIT | [link](https://github.com/alexindigo/asynckit) |
| axios@1.18.1 | MIT | [link](https://github.com/axios/axios) |
| base64-js@1.5.1 | MIT | [link](https://github.com/beatgammit/base64-js) |
| boolbase@1.0.0 | ISC | [link](https://github.com/fb55/boolbase) |
| buffer@6.0.3 | MIT | [link](https://github.com/feross/buffer) |
| call-bind-apply-helpers@1.0.2 | MIT | [link](https://github.com/ljharb/call-bind-apply-helpers) |
| call-bind@1.0.8 | MIT | [link](https://github.com/ljharb/call-bind) |
| call-bound@1.0.4 | MIT | [link](https://github.com/ljharb/call-bound) |
| chart.js@4.5.1 | MIT | [link](https://github.com/chartjs/Chart.js) |
| cheerio@0.19.0 | MIT | [link](https://github.com/cheeriojs/cheerio) |
| clone@2.1.2 | MIT | [link](https://github.com/pvorb/node-clone) |
| combined-stream@1.0.8 | MIT | [link](https://github.com/felixge/node-combined-stream) |
| connect-pg-simple@10.0.0 | MIT | [link](https://github.com/voxpelli/node-connect-pg-simple) |
| core-util-is@1.0.3 | MIT | [link](https://github.com/isaacs/core-util-is) |
| css-select@1.0.0 | BSD* | [link](https://github.com/fb55/css-select) |
| css-what@6.2.2 | BSD-2-Clause | [link](https://github.com/fb55/css-what) |
| csstype@3.2.3 | MIT | [link](https://github.com/frenic/csstype) |
| dayjs@1.11.19 | MIT | [link](https://github.com/iamkun/dayjs) |
| debug@4.4.3 | MIT | [link](https://github.com/debug-js/debug) |
| deep-equal@1.1.2 | MIT | [link](https://github.com/inspect-js/node-deep-equal) |
| define-data-property@1.1.4 | MIT | [link](https://github.com/ljharb/define-data-property) |
| define-properties@1.2.1 | MIT | [link](https://github.com/ljharb/define-properties) |
| delayed-stream@1.0.0 | MIT | [link](https://github.com/felixge/node-delayed-stream) |
| dom-serializer@0.1.1 | MIT | [link](https://github.com/cheeriojs/dom-renderer) |
| dom-serializer@0.2.2 | MIT | [link](https://github.com/cheeriojs/dom-renderer) |
| domelementtype@1.3.1 | BSD-2-Clause | [link](https://github.com/fb55/domelementtype) |
| domelementtype@2.3.0 | BSD-2-Clause | [link](https://github.com/fb55/domelementtype) |
| domhandler@2.3.0 | BSD* | [link](https://github.com/fb55/DomHandler) |
| dompurify@3.4.11 | (MPL-2.0 OR Apache-2.0) | [link](https://github.com/cure53/DOMPurify) |
| domutils@1.4.3 | BSD* | [link](https://github.com/FB55/domutils) |
| domutils@1.5.1 | BSD* | [link](https://github.com/FB55/domutils) |
| dunder-proto@1.0.1 | MIT | [link](https://github.com/es-shims/dunder-proto) |
| element-plus@2.13.0 | MIT | [link](https://github.com/element-plus/element-plus) |
| entities@1.0.0 | BSD* | [link](https://github.com/fb55/node-entities) |
| entities@1.1.2 | BSD-2-Clause | [link](https://github.com/fb55/entities) |
| entities@2.2.0 | BSD-2-Clause | [link](https://github.com/fb55/entities) |
| entities@7.0.0 | BSD-2-Clause | [link](https://github.com/fb55/entities) |
| es-define-property@1.0.1 | MIT | [link](https://github.com/ljharb/es-define-property) |
| es-errors@1.3.0 | MIT | [link](https://github.com/ljharb/es-errors) |
| es-object-atoms@1.1.1 | MIT | [link](https://github.com/ljharb/es-object-atoms) |
| es-set-tostringtag@2.1.0 | MIT | [link](https://github.com/es-shims/es-set-tostringtag) |
| escape-html@1.0.3 | MIT | [link](https://github.com/component/escape-html) |
| estree-walker@2.0.2 | MIT | [link](https://github.com/Rich-Harris/estree-walker) |
| ethers@6.13.5 | MIT | [link](https://github.com/ethers-io/ethers.js) |
| eventemitter3@2.0.3 | MIT | [link](https://github.com/primus/eventemitter3) |
| eventemitter3@5.0.1 | MIT | [link](https://github.com/primus/eventemitter3) |
| extend@3.0.2 | MIT | [link](https://github.com/justmoon/node-extend) |
| fast-diff@1.1.2 | Apache-2.0 | [link](https://github.com/jhchen/fast-diff) |
| fast-diff@1.3.0 | Apache-2.0 | [link](https://github.com/jhchen/fast-diff) |
| follow-redirects@1.16.0 | MIT | [link](https://github.com/follow-redirects/follow-redirects) |
| form-data@4.0.6 | MIT | [link](https://github.com/form-data/form-data) |
| function-bind@1.1.2 | MIT | [link](https://github.com/Raynos/function-bind) |
| functions-have-names@1.2.3 | MIT | [link](https://github.com/inspect-js/functions-have-names) |
| get-intrinsic@1.3.0 | MIT | [link](https://github.com/ljharb/get-intrinsic) |
| get-proto@1.0.1 | MIT | [link](https://github.com/ljharb/get-proto) |
| gopd@1.2.0 | MIT | [link](https://github.com/ljharb/gopd) |
| has-property-descriptors@1.0.2 | MIT | [link](https://github.com/inspect-js/has-property-descriptors) |
| has-symbols@1.1.0 | MIT | [link](https://github.com/inspect-js/has-symbols) |
| has-tostringtag@1.0.2 | MIT | [link](https://github.com/inspect-js/has-tostringtag) |
| hasown@2.0.2 | MIT | [link](https://github.com/inspect-js/hasOwn) |
| hasown@2.0.4 | MIT | [link](https://github.com/inspect-js/hasOwn) |
| htmlparser2@3.8.3 | MIT | [link](https://github.com/fb55/htmlparser2) |
| https-proxy-agent@5.0.1 | MIT | [link](https://github.com/TooTallNate/node-https-proxy-agent) |
| ieee754@1.2.1 | BSD-3-Clause | [link](https://github.com/feross/ieee754) |
| inherits@2.0.4 | ISC | [link](https://github.com/isaacs/inherits) |
| is-arguments@1.2.0 | MIT | [link](https://github.com/inspect-js/is-arguments) |
| is-date-object@1.1.0 | MIT | [link](https://github.com/inspect-js/is-date-object) |
| is-regex@1.2.1 | MIT | [link](https://github.com/inspect-js/is-regex) |
| isarray@0.0.1 | MIT | [link](https://github.com/juliangruber/isarray) |
| lodash-es@4.18.1 | MIT | [link](https://github.com/lodash/lodash) |
| lodash-unified@1.0.3 | MIT | — |
| lodash.clonedeep@4.5.0 | MIT | [link](https://github.com/lodash/lodash) |
| lodash.defaultsdeep@4.6.1 | MIT | [link](https://github.com/lodash/lodash) |
| lodash.isequal@4.5.0 | MIT | [link](https://github.com/lodash/lodash) |
| lodash@4.18.1 | MIT | [link](https://github.com/lodash/lodash) |
| magic-string@0.30.21 | MIT | [link](https://github.com/Rich-Harris/magic-string) |
| marked@15.0.12 | MIT | [link](https://github.com/markedjs/marked) |
| math-intrinsics@1.1.0 | MIT | [link](https://github.com/es-shims/math-intrinsics) |
| memoize-one@6.0.0 | MIT | [link](https://github.com/alexreardon/memoize-one) |
| mime-db@1.52.0 | MIT | [link](https://github.com/jshttp/mime-db) |
| mime-types@2.1.35 | MIT | [link](https://github.com/jshttp/mime-types) |
| ms@2.1.3 | MIT | [link](https://github.com/vercel/ms) |
| nanoid@3.3.15 | MIT | [link](https://github.com/ai/nanoid) |
| normalize-wheel-es@1.2.0 | BSD-3-Clause | [link](https://github.com/sxzz/normalize-wheel-es) |
| nth-check@2.1.1 | BSD-2-Clause | [link](https://github.com/fb55/nth-check) |
| object-is@1.1.6 | MIT | [link](https://github.com/es-shims/object-is) |
| object-keys@1.1.1 | MIT | [link](https://github.com/ljharb/object-keys) |
| papaparse@5.5.3 | MIT | [link](https://github.com/mholt/PapaParse) |
| parchment@1.1.4 | BSD-3-Clause | [link](https://github.com/quilljs/parchment) |
| parchment@3.0.0 | BSD-3-Clause | [link](https://github.com/quilljs/parchment) |
| pg-cloudflare@1.2.7 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-connection-string@2.9.1 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-int8@1.0.1 | ISC | [link](https://github.com/charmander/pg-int8) |
| pg-pool@3.10.1 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-protocol@1.10.3 | MIT | [link](https://github.com/brianc/node-postgres) |
| pg-types@2.2.0 | MIT | [link](https://github.com/brianc/node-pg-types) |
| pg@8.16.3 | MIT | [link](https://github.com/brianc/node-postgres) |
| pgpass@1.0.5 | MIT | [link](https://github.com/hoegaarden/pgpass) |
| picocolors@1.1.1 | ISC | [link](https://github.com/alexeyraspopov/picocolors) |
| postcss@8.5.16 | MIT | [link](https://github.com/postcss/postcss) |
| postgres-array@2.0.0 | MIT | [link](https://github.com/bendrucker/postgres-array) |
| postgres-bytea@1.0.1 | MIT | [link](https://github.com/bendrucker/postgres-bytea) |
| postgres-date@1.0.7 | MIT | [link](https://github.com/bendrucker/postgres-date) |
| postgres-interval@1.2.0 | MIT | [link](https://github.com/bendrucker/postgres-interval) |
| proxy-from-env@2.1.0 | MIT | [link](https://github.com/Rob--W/proxy-from-env) |
| punycode@2.3.1 | MIT | [link](https://github.com/mathiasbynens/punycode.js) |
| quill-delta@3.6.3 | MIT | [link](https://github.com/quilljs/delta) |
| quill-delta@5.1.0 | MIT | [link](https://github.com/quilljs/delta) |
| quill-image-resize-module@3.0.0 | MIT | [link](https://github.com/kensnyder/quill-image-resize-module) |
| quill-render@1.0.5 | MIT | [link](https://github.com/casetext/quill-render) |
| quill@1.3.7 | BSD-3-Clause | [link](https://github.com/quilljs/quill) |
| quill@2.0.3 | BSD-3-Clause | [link](https://github.com/slab/quill) |
| raw-loader@0.5.1 | MIT | [link](https://github.com/webpack/raw-loader) |
| readable-stream@1.1.13 | MIT | [link](https://github.com/isaacs/readable-stream) |
| regexp.prototype.flags@1.5.4 | MIT | [link](https://github.com/es-shims/RegExp.prototype.flags) |
| set-function-length@1.2.2 | MIT | [link](https://github.com/ljharb/set-function-length) |
| set-function-name@2.0.2 | MIT | [link](https://github.com/ljharb/set-function-name) |
| siwe@2.3.2 | Apache-2.0 | [link](https://github.com/spruceid/siwe) |
| sortablejs@1.15.6 | MIT | [link](https://github.com/SortableJS/Sortable) |
| source-map-js@1.2.1 | BSD-3-Clause | [link](https://github.com/7rulnik/source-map-js) |
| split2@4.2.0 | ISC | [link](https://github.com/mcollina/split2) |
| string_decoder@0.10.31 | MIT | [link](https://github.com/rvagg/string_decoder) |
| tslib@2.7.0 | 0BSD | [link](https://github.com/Microsoft/tslib) |
| undici-types@6.19.8 | MIT | [link](https://github.com/nodejs/undici) |
| uri-js@4.4.1 | BSD-2-Clause | [link](https://github.com/garycourt/uri-js) |
| valid-url@1.0.9 | MIT* | [link](https://github.com/ogt/valid-url) |
| vue-demi@0.14.10 | MIT | [link](https://github.com/antfu/vue-demi) |
| vue-i18n@11.2.7 | MIT | [link](https://github.com/intlify/vue-i18n) |
| vue-quill@1.5.1 | ISC | [link](https://github.com/CroudSupport/vue-quill) |
| vue-router@4.6.4 | MIT | [link](https://github.com/vuejs/router) |
| vue@3.5.26 | MIT | [link](https://github.com/vuejs/core) |
| vuex@4.1.0 | MIT | [link](https://github.com/vuejs/vuex) |
| ws@8.21.0 | MIT | [link](https://github.com/websockets/ws) |
| xtend@4.0.2 | MIT | [link](https://github.com/Raynos/xtend) |

</details>

---

## Тексты распространённых лицензий

Полные тексты MIT, Apache-2.0, BSD и ISC доступны в каталогах `node_modules/<package>/` каждого компонента
и на https://opensource.org/licenses

### MIT (кратко)

Разрешается использование, копирование, модификация, слияние, публикация, распространение, сублицензирование
и продажа копий при условии включения copyright-уведомления и текста лицензии во все копии или существенные части ПО.

### Apache-2.0 (кратко)

Разрешается использование при условии сохранения copyright, текста лицензии и файлов NOTICE;
предоставляется патентная лицензия; изменения должны быть помечены.

### LGPL-3.0 (кратко)

Слабая copyleft-лицензия для библиотек. Разрешает использование в проприетарных приложениях
при условии сохранения уведомлений, предоставления текста LGPL и возможности замены библиотеки.
Модифицированные версии библиотеки должны распространяться под LGPL-3.0.
Полный текст: https://www.gnu.org/licenses/lgpl-3.0.html

---

**Контакты по лицензированию DLE:** info@hb3-accelerator.com  
**Сайт:** https://hb3-accelerator.com
