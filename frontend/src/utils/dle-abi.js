/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

/**
 * ABI для DLE смарт-контракта
 * АВТОМАТИЧЕСКИ СГЕНЕРИРОВАНО - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ
 * Для обновления запустите: node backend/scripts/generate-abi.js
 * 
 * Последнее обновление: 2025-09-29T18:16:32.027Z
 */

export const DLE_ABI = [
  "function CLOCK_MODE() returns (string)",
  "function DOMAIN_SEPARATOR() returns (bytes32)",
  "function activeModules(bytes32 ) returns (bool)",
  "function allProposalIds(uint256 ) returns (uint256)",
  "function allowance(address owner, address spender) returns (uint256)",
  "function approve(address , uint256 ) returns (bool)",
  "function balanceOf(address account) returns (uint256)",
  "function cancelProposal(uint256 _proposalId, string reason)",
  "function checkProposalResult(uint256 _proposalId) returns (bool, bool)",
  "function checkpoints(address account, uint32 pos) returns (tuple)",
  "function clock() returns (uint48)",
  "function createAddModuleProposal(string _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) returns (uint256)",
  "function createProposal(string _description, uint256 _duration, bytes _operation, uint256 _governanceChainId, uint256[] _targetChains, uint256 ) returns (uint256)",
  "function createRemoveModuleProposal(string _description, uint256 _duration, bytes32 _moduleId, uint256 _chainId) returns (uint256)",
  "function decimals() returns (uint8)",
  "function delegate(address delegatee)",
  "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  "function delegates(address account) returns (address)",
  "function dleInfo() returns (string, string, string, string, uint256, uint256, uint256, bool)",
  "function eip712Domain() returns (bytes1, string, string, uint256, address, bytes32, uint256[])",
  "function executeProposal(uint256 _proposalId)",
  "function executeProposalBySignatures(uint256 _proposalId, address[] signers, bytes[] signatures)",
  "function getCurrentChainId() returns (uint256)",
  "function getDLEInfo() returns (tuple)",
  "function getModuleAddress(bytes32 _moduleId) returns (address)",
  "function getMultichainAddresses() returns (uint256[], address[])",
  "function getMultichainInfo() returns (uint256[], uint256)",
  "function getMultichainMetadata() returns (string)",
  "function getPastTotalSupply(uint256 timepoint) returns (uint256)",
  "function getPastVotes(address account, uint256 timepoint) returns (uint256)",
  "function getProposalState(uint256 _proposalId) returns (uint8)",
  "function getProposalSummary(uint256 _proposalId) returns (uint256, string, uint256, uint256, bool, bool, uint256, address, uint256, uint256, uint256[])",
  "function getSupportedChainCount() returns (uint256)",
  "function getSupportedChainId(uint256 _index) returns (uint256)",
  "function getVotes(address account) returns (uint256)",
  "function initializeLogoURI(string _logoURI)",
  "function initializer() returns (address)",
  "function isActive() returns (bool)",
  "function isChainSupported(uint256 _chainId) returns (bool)",
  "function isModuleActive(bytes32 _moduleId) returns (bool)",
  "function logo() returns (string)",
  "function logoURI() returns (string)",
  "function maxVotingDuration() returns (uint256)",
  "function minVotingDuration() returns (uint256)",
  "function modules(bytes32 ) returns (address)",
  "function name() returns (string)",
  "function nonces(address owner) returns (uint256)",
  "function numCheckpoints(address account) returns (uint32)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function proposalCounter() returns (uint256)",
  "function proposals(uint256 ) returns (uint256, string, uint256, uint256, bool, bool, uint256, address, bytes, uint256, uint256)",
  "function quorumPercentage() returns (uint256)",
  "function supportedChainIds(uint256 ) returns (uint256)",
  "function supportedChains(uint256 ) returns (bool)",
  "function symbol() returns (string)",
  "function tokenURI() returns (string)",
  "function totalSupply() returns (uint256)",
  "function transfer(address , uint256 ) returns (bool)",
  "function transferFrom(address , address , uint256 ) returns (bool)",
  "function vote(uint256 _proposalId, bool _support)",
  "event Approval(address owner, address spender, uint256 value)",
  "event ChainAdded(uint256 chainId)",
  "event ChainRemoved(uint256 chainId)",
  "event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp)",
  "event DLEInitialized(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, address tokenAddress, uint256[] supportedChainIds)",
  "event DelegateChanged(address delegator, address fromDelegate, address toDelegate)",
  "event DelegateVotesChanged(address delegate, uint256 previousVotes, uint256 newVotes)",
  "event EIP712DomainChanged()",
  "event InitialTokensDistributed(address[] partners, uint256[] amounts)",
  "event LogoURIUpdated(string oldURI, string newURI)",
  "event ModuleAdded(bytes32 moduleId, address moduleAddress)",
  "event ModuleRemoved(bytes32 moduleId)",
  "event ProposalCancelled(uint256 proposalId, string reason)",
  "event ProposalCreated(uint256 proposalId, address initiator, string description)",
  "event ProposalExecuted(uint256 proposalId, bytes operation)",
  "event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId)",
  "event ProposalGovernanceChainSet(uint256 proposalId, uint256 governanceChainId)",
  "event ProposalTargetsSet(uint256 proposalId, uint256[] targetChains)",
  "event ProposalVoted(uint256 proposalId, address voter, bool support, uint256 votingPower)",
  "event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage)",
  "event TokensTransferredByGovernance(address recipient, uint256 amount)",
  "event Transfer(address from, address to, uint256 value)",
  "event VotingDurationsUpdated(uint256 oldMinDuration, uint256 newMinDuration, uint256 oldMaxDuration, uint256 newMaxDuration)",
];


// ABI для деактивации (специальные функции) - НЕ СУЩЕСТВУЮТ В КОНТРАКТЕ
export const DLE_DEACTIVATION_ABI = [
  // Эти функции не существуют в контракте DLE
];

// ABI для токенов (базовые функции)
export const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];
