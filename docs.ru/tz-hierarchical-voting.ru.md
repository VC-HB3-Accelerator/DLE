# ТЗ: иерархическое голосование A → B (HierarchicalVoting)

**Статус:** модель T2 зафиксирована; дыры ревью закрыты в спецификации; реализация в `.sol` по этому документу  
**Выбор msg.sender на B:** **T2** (см. §6)  
**Итерация 1:** только **vote** по уже существующему `targetProposalId` на B (не createProposal на B)

**Продукт:** DLE  
**Контракты:** `DLE.sol`, `TreasuryModule.sol`, `HierarchicalVotingModule.sol`  
**Аудит:** 2.5 (сигнатура) + модель силы голоса / подписи

---

## 1. Цель

Головной профиль **A** владеет долями дочернего **B** (токены B на **казне A**). Холдеры A проводят **vote на B от имени A**, если:

1. у инициатора есть доля **A**;
2. на казне **A** есть токены **B**;
3. по операции набран кворум A **и** `for > against` (как в ядре A).

Нет кворума / `for <= against` → **execute на B нельзя**.

Сила голоса на B = `balanceOf_B(treasuryA)` (**1 токен = 1 голос**).  
Представитель только запускает execute кошельком холдера A; **сам на B не голосует**.

---

## 2. Роли

| Сущность | Роль |
|----------|------|
| DLE A | Ядро + модули HV + Treasury |
| DLE B | Целевой контракт, существующее proposal |
| Казна A | Holder токенов B; `msg.sender` при `B.vote` |
| Холдер A | Создаёт операцию / ставит for|against своей силой с snapshot |
| Executor (представитель) | Холдер A, указанный в операции; вызывает `execute` после порога |

---

## 3. Жёсткие правила (закрытие дыр ревью)

### 3.1. Делегирование ≠ `DLE.delegate`

В ядре `delegator == delegatee` (Delegation disabled).  
Кворум под A→B — **отдельный** учёт в `HierarchicalVotingModule`:

- `approveOperation(opId)` → сила в `forVotes`;
- `rejectOperation(opId)` → сила в `againstVotes`;
- сила = `A.getPastVotes(msg.sender, snapshot)`;
- один адрес — одна позиция на op (смена запрещена или только до execute — **запрещена**).

Это **не** ERC20Votes.delegate.

### 3.2. Кворум + против (как `checkProposalResult`)

Execute разрешён только если:

```
quorumReached = (forVotes + againstVotes) >= (pastSupplyA(snapshot) * quorumPercentageA / 100)
passed       = quorumReached && forVotes > againstVotes
```

Только `for >= quorum` **без** сравнения с against — **запрещено** (класс бага 2.1).

### 3.3. Объект операции (итерация 1 = vote)

```
opHash = keccak256(abi.encode(
  chainId, address(A), address(HV), opId,
  targetB, targetProposalId, supportOnB, snapshotA, deadline, executor
))
```

Поля операции: `targetB`, `targetProposalId`, `supportOnB`, `snapshotA`, `deadline`, `executor`, `forVotes`, `againstVotes`, `executed`, `creator`.

Итерация 1: **только vote**; create proposal на B — вне скоупа.

### 3.4. Путь вызова казны

`Treasury.castExternalVote` вызывается **только**:

- `msg.sender == hierarchicalVotingModule`, или  
- `msg.sender == dleContract`.

HV **не** зовёт `B.vote` сам.  
Казна после успеха: `B.vote(proposalId, support)` → на B `msg.sender = treasury`.

### 3.5. Узкий API казны

`castExternalVote(targetDLE, proposalId, support)` — без произвольного calldata.  
Адрес HV задаётся `setHierarchicalVotingModule` через `onlyDLE` (governance A).

### 3.6. Snapshot и вес

| Что | Когда |
|-----|--------|
| Сила холдеров A | `getPastVotes` / `getPastTotalSupply` на `snapshotA` при создании op (`clock()-1` или аналог ядра) |
| Вес на B | `IERC20(B).balanceOf(treasury)` **в момент** `castExternalVote` (≥1) **и** `getPastVotes(treasury, snapshot предложения B) > 0` |

**Важно:** `B.vote` считает силу как `getPastVotes(treasury, snapshotB)`. Токены B должны лежать на казне A **и** self-delegate должен быть выполнен **до** snapshot предложения B, иначе голос казны = 0.

### 3.7. Mint токенов B казне A

`transfer` B запрещён → доля на казне только **mint при деплое B** (казнA в `initialPartners`). Иначе P2 невыполним. (Пункт деплоя/фабрики — см. §7.)

### 3.8. Voting power казны на B

После mint казна вызывает self-delegate на B (`delegate(treasury)`), т.к. иначе `getPastVotes(treasury)=0`.  
`Treasury.ensureVotingPower(tokenB)` — best-effort `token.delegate(address(this))`.

### 3.9. Один голос / replay

- `op.executed` → повторный execute revert;  
- на B `hasVoted[treasury]` → повторный vote revert;  
- `block.timestamp > deadline` → нельзя approve/reject/execute;  
- `opHash` включает `chainId` — нет кросс-чейн replay одной подписи (для on-chain v1 достаточно id+executed).

### 3.10. Executor

`execute` только от `op.executor` (представитель).  
Approve/reject — любой холдер A с силой на snapshot.

---

## 4. Предусловия

Создание op:

| # | Проверка |
|---|----------|
| P1 | `balanceOf_A(creator) > 0` |
| P2 | `balanceOf_B(treasuryA) > 0` |
| P3 | B в списке внешних DLE модуля |
| P4 | `treasuryModule != 0`, HV зарегистрирован в A (`isModuleContract`) |
| P5 | `executor` — ненулевой; `targetProposalId > 0`; `deadline > now` |

Execute:

| # | Проверка |
|---|----------|
| E1 | op существует, не executed, не истёк |
| E2–E4 | `passed && quorumReached` (§3.2) |
| E5 | `msg.sender == executor` |
| E6 | `balanceOf_B(treasury) > 0` |
| E7 | `castExternalVote` успешен |

---

## 5. Поток

```
1. Mint B → treasury A; treasury.ensureVotingPower(B)
2. setTreasuryModule / setHierarchicalVotingModule (governance)
3. addExternalDLE(B)
4. creator: createExternalVoteOp(B, proposalId, supportOnB, deadline, executor)
5. холдеры A: approveOperation / rejectOperation
6. executor: executeExternalVote(opId)
      → HV проверяет passed
      → treasury.castExternalVote(B, proposalId, supportOnB)
      → B.vote от treasury
```

---

## 6. T2 (выбран)

`msg.sender` на B = **treasury A**. Вес = votes/balance казны по B.  
Представитель не voter на B.

T1 — запасной; T3 — не для vote.

---

## 7. Вне скоупа этой итерации

- CREATE2; CSRF/SIWE; ключ деплоя из БД; OZ Governor  
- Автоmint B казне в фабрике (отдельная задача деплоя)  
- EIP-712 офчейн-подписи (v1 — on-chain approve/reject)  
- Создание proposal на B из HV

---

## 8. Критерии приёмки

1. Нет B на казне → create revert.  
2. Нет доли A у creator → create revert.  
3. `!quorum || for <= against` → execute revert.  
4. Порог пройден → B.vote от treasury с весом казны.  
5. `for <= against` при кворуме → execute нельзя.  
6. Повторный execute → revert.  
7. Вызов `B.vote` не с HV-адреса, а с treasury.  
8. `DLE.delegate` на другого по-прежнему запрещён; HV не использует его.  
9. Чужой `castExternalVote` (не HV/DLE) → revert.

---

## 9. Реализация

Файлы: `HierarchicalVotingModule.sol`, `TreasuryModule.sol` (+ при необходимости тонкий helper).  
Редеплой — только по явной команде.
