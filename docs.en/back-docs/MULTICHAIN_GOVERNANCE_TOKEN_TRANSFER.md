**English** | [Русский](../../docs.ru/back-docs/MULTICHAIN_GOVERNANCE_TOKEN_TRANSFER.md)

# DLE Multichain Governance Token Transfer

## Overview

The DLE multichain governance system lets token holders create proposals to transfer tokens from their wallet to another address (or treasury) through voting in every network where the DLE contract is deployed. Each network has its own quorum; proposals are coordinated and shown as a single card.

## Architecture

- One DLE can be deployed on several chains (e.g. Sepolia, Arbitrum Sepolia, Base Sepolia).
- Each DLE contract per chain runs independently.
- Proposals are created, voted on, and executed **per chain**.
- Proposal IDs are **unique per chain** (e.g. ID=1 on Sepolia and ID=1 on Arbitrum Sepolia are different).

Proposals with the same description and initiator are **grouped** into one card showing status and voting in all chains.

---

## Process: Token transfer

### Stage 1: Create proposal

1. User fills form: description, recipient address, amount (tokens), voting duration, connected wallet (sender).
2. System determines all networks with deployed DLE.
3. **Sequential creation per chain:** switch MetaMask to each network (1 s delay), call DLE `createProposal(...)`, get proposal ID for that chain, delay 3 s (5 s Base Sepolia) after tx. Retry on RPC errors (e.g. up to 3 with exponential backoff).
4. User signs **one transaction per chain** in MetaMask.

**Contract:** `createProposal(description, duration, operation, targetChains, timelockDelay)`.  
**Operation:** `_transferTokens(sender, recipient, amount)` — **signature `_transferTokens(address,address,uint256)`**. All three parameters required. **Sender** must be initiator (from `signer.getAddress()` when creating in **that** chain). **Amount** must be in wei: `ethers.parseUnits(amount.toString(), 18)`.

**Encoding (ethers.js):** use Interface with `_transferTokens(address,address,uint256)` and encode sender (from signer for current chain), recipient, amountInWei. **Critical:** encode operation **inside** the loop over chains so sender is correct per chain.

**Result:** N proposals (one per chain), each with its own ID; UI shows one card with status per chain.

---

### Stage 2: Voting

1. User sees one card with all chains.
2. Chooses vote For or Against.
3. **Sequential voting:** for each active chain (state active, not executed/canceled): switch network, 1 s delay, **check token balance in that chain** (if none, skip with warning), call `vote(proposalId, support)` with **that chain’s proposal ID**, delay after tx.
4. One MetaMask signature per active chain.

**Contract:** `vote(proposalId, support)`. Use per-chain proposal ID. Quorum is per chain. Balance checked per chain; if no tokens in a chain, skip voting there.

---

### Stage 3: Execute proposal

**Condition:** Proposal can be executed only when it is **ReadyForExecution** (and quorum reached) **in every** chain where it is active.

1. System checks readiness in all chains.
2. **Sequential execution:** for each ready chain: switch network, 1 s delay, call `executeProposal(proposalId)` with **that chain’s ID**, delay after tx.
3. One signature per ready chain.

**Contract:** `executeProposal(proposalId)`. Operation `_transferTokens(sender, recipient, amount)`: sender = initiator (checked), recipient and amount from proposal. Tokens are transferred from initiator’s wallet.

---

## Cancel proposal

Only initiator can cancel, while proposal is active. **Sequential cancel** in all active chains (switch network, delay, `cancelProposal(proposalId, reason)`), one signature per chain.

---

## Important details

1. **Proposal IDs:** Each chain has its own counter. Same numeric ID on different chains = different proposals. UI stores per-chain IDs and uses them for vote/execute/cancel.
2. **Grouping:** Key `${description}_${initiator}`. One card = one logical proposal across chains.
3. **Quorum:** Independent per chain. Execution requires quorum **in all** chains.
4. **Sequential operations:** Create, vote, execute, cancel are done **one chain at a time** (no `Promise.all`) because MetaMask works with one network at a time.
5. **Errors:** Retry on retryable RPC errors; if one chain fails, continue others and report. On vote, skip chains where user has no balance (with warning).
6. **Security:** Sender must equal initiator on execute; balance checked per chain; state and data validated before each call.
7. **Token source:** Tokens are transferred **from the initiator’s wallet**, not from the contract balance.

---

## UI (summary)

Card: description, initiator, list of chains (name, status, proposal ID, For/Against, quorum), actions: Vote For/Against (if active), Execute (if ready in all), Cancel (if initiator). Statuses: Active, Ready for execution, Executed, Canceled, Expired.

---

## Contract functions (reference)

- `createProposal(description, duration, operation, targetChains, timelockDelay)` → proposalId  
- `vote(proposalId, support)`  
- `executeProposal(proposalId)`  
- `cancelProposal(proposalId, reason)`  
- `_transferTokens(sender, recipient, amount)` (internal)

---

## Encoding and implementation notes

- **Correct:** Encode `_transferTokens(sender, recipient, amountInWei)` **inside** the chain loop with `sender = await signer.getAddress()` for that chain. Use `ethers.parseUnits(amount.toString(), 18)`.
- **Wrong:** Encode once before loop; use `_transferTokens(address,uint256)`; omit sender; wrong parameter order in `createProposal`.
- **Wrong:** Use `Promise.all` for execute/vote across chains (MetaMask cannot handle multiple networks in parallel).

All critical encoding and multichain flow issues in the codebase are documented as fixed; implementation follows this spec and the contract.

---

## Conclusion

Multichain governance for DLE provides decentralized token transfer decisions with per-chain quorums and a single UI for managing proposals across all deployed networks.

**Important:** All critical bugs in operation encoding have been fixed; code matches the documentation and contract.
