**English** | [Русский](../../docs.ru/back-docs/blockchain-integration-technical.md)

# Digital Legal Entity (DLE) Blockchain Integration

## Table of Contents

1. [Introduction](#introduction)
2. [Smart Contract Architecture](#smart-contract-architecture)
3. [DLE Core Contract](#dle-core-contract)
4. [Module System](#module-system)
5. [Multichain Architecture](#multichain-architecture)
6. [Voting (Governance) System](#voting-governance-system)
7. [Smart Contract Deployment](#smart-contract-deployment)
8. [Wallet Authentication](#wallet-authentication)
9. [Frontend Integration](#frontend-integration)
10. [Security](#security)
11. [Practical Examples](#practical-examples)

---

## Introduction

Digital Legal Entity (DLE) uses blockchain for **tokenized governance** (similar to a blockchain-based joint-stock company) and **transparent decision-making** via smart contracts.

### Why Blockchain in DLE?

1. **Governance like a joint-stock company** — decisions by token holders through on-chain voting
2. **Transparency** — all votes and operations recorded on blockchain
3. **Censorship resistance** — smart contract enforces token holder rights
4. **Immutability** — decision history cannot be altered
5. **Multichain support** — operation across multiple chains

### DLE Governance Model

| Aspect | Implementation |
|--------|----------------|
| **Voting** | Token holders (as shareholders) |
| **Quorum** | 51%+ of tokens to pass decisions |
| **Asset distribution** | Via voting (as in JSC) |
| **Parameter changes** | Via token holder voting |
| **Application code** | Proprietary (author) |
| **Updates** | Author develops; token holders vote on priorities |

### Supported Blockchains

DLE works with **EVM-compatible** networks: Ethereum (mainnet & testnets), Polygon, Arbitrum, BSC, Base, and others.

---

## Smart Contract Architecture

DLE ecosystem: **DLE Core Contract** (ERC20Votes, tokens, proposals, multichain) ↔ **Modules** (HierarchicalVotingModule, TreasuryModule, TimelockModule) ↔ **DLEReader** (batch reads, RPC optimization).

Standards: OpenZeppelin ERC20, ERC20Votes, ERC20Permit, ReentrancyGuard, ECDSA.

---

## DLE Core Contract

File: `backend/contracts/DLE.sol`

Structures: **DLEInfo** (name, symbol, location, coordinates, jurisdiction, okvedCodes, kpp, creationTimestamp, isActive), **Proposal** (id, description, forVotes, againstVotes, executed, canceled, deadline, initiator, operation, governanceChainId, targetChains, snapshotTimepoint, hasVoted).

### Main Features

- **Governance tokens (ERC20):** 1 token = 1 vote; transfers disabled (only via governance); EIP-712 for meta-transactions.
- **Voting (ERC20Votes):** snapshots (flash-loan protection), votes from past block, optional delegation.
- **Multichain:** same address across chains (deterministic deploy); voting on one chain; execution on target chains.
- **Modules:** mapping(bytes32 => address) modules, activeModules; add/remove only via voting.

### Operations Available via Voting

_addModule, _removeModule, _addSupportedChain, _removeSupportedChain, _transferTokens, _updateDLEInfo, _updateQuorumPercentage, _updateVotingDurations.

---

## Module System

### 1. HierarchicalVotingModule

DLE can hold tokens of other DLEs and vote in them. Functions: addExternalDLE, createProposalInExternalDLE, voteInExternalDLE.

### 2. TreasuryModule

Treasury and asset management. transferTokens(token, recipient, amount) only callable by DLE contract. getTokenBalance(token).

### 3. TimelockModule

Delayed execution (timelock), cancel before execution. scheduleProposal(proposalId, operation, delay), executeTimelockProposal(operationHash).

### 4. DLEReader

Batch read: getDLEFullInfo(dleAddress), getAllProposals(dleAddress).

---

## Multichain Architecture

Deterministic deploy: same address on all chains. Voting on one chain (governance chain); execution on target chains via executeWithSignatures(proposalId, operationHash, signers, signatures).

---

## Voting (Governance) System

**createProposal(description, duration, operation, chainId, targetChains, initiator)** — returns proposalId.

**vote(proposalId, support)** — true = For, false = Against.

**execute(proposalId)** — when deadline passed, quorum reached, For > Against, not executed.

**Quorum:** quorumPercentage of totalSupply; change only via voting.

---

## Smart Contract Deployment

**Script:** `backend/scripts/deploy/deploy-multichain.js` — multichain deploy, deterministic address, verification, retry, nonce management. Run: `yarn deploy:multichain`.

**Modules:** `backend/scripts/deploy/deploy-modules.js` — `yarn deploy:modules`. Config in DB (settings: supported_chain_ids, rpc_providers, dle_config). Verification via Etherscan API; supported: Etherscan, Polygonscan, Arbiscan, BSCScan, Basescan.

---

## Wallet Authentication

**SIWE (Sign-In with Ethereum):** request nonce → sign message in wallet → POST signature → backend verifies signature and token balance → session created. getUserAccessLevel(address) from contract balance and thresholds (editor, readonly).

---

## Frontend Integration

Connect wallet (MetaMask/WalletConnect), sign SIWE message, authenticateWithWallet. getDLEContract, createProposal, voteOnProposal, getProposal. Vue component example for proposal card and vote buttons.

---

## Security

See [DLE Security](../security.md). Summary: ReentrancyGuard, transfers disabled, vote snapshots, EIP-712, parameter validation, custom errors.

---

## Practical Examples

See [Blockchain for Business](../blockchain-for-business.md). Technical scenarios: multichain deploy, adding modules, hierarchical voting, treasury management.

---

## Conclusion

Blockchain in DLE provides: governance like a JSC, full transparency, multichain support, modular design, OpenZeppelin-based security.

### Resources

- [Main README](../../README.md)
- [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)
- [Setup](./setup-instruction.md)
- [Terms](../service-terms.md)
- [Legal](../../legal.en/README.md)

**Contacts:** https://hb3-accelerator.com/ | info@hb3-accelerator.com | https://github.com/VC-HB3-Accelerator

---

**© 2024-2025 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** October 2025
