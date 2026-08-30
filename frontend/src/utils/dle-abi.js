/**
 * ABI для DLE смарт-контракта
 * АВТОМАТИЧЕСКИ СГЕНЕРИРОВАНО - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ
 * Для обновления запустите: node backend/scripts/generate-abi.js
 * 
 * Последнее обновление: 2026-08-27T23:32:12.063Z
 */

export const DLE_ABI = [
  "function CLOCK_MODE() view returns (string)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function activeModules(bytes32) view returns (bool)",
  "function allProposalIds(uint256) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function cancelProposal(uint256 _proposalId, string reason)",
  "function checkProposalResult(uint256 _proposalId) view returns (bool, bool)",
  "function clock() view returns (uint48)",
  "function createAddModuleProposal(string _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) returns (uint256)",
  "function createProposal(string _description, uint256 _duration, bytes _operation, uint256[] _targetChains, uint256) returns (uint256)",
  "function createRemoveModuleProposal(string _description, uint256 _duration, bytes32 _moduleId, uint256 _chainId) returns (uint256)",
  "function decimals() view returns (uint8)",
  "function delegate(address delegatee)",
  "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  "function delegates(address account) view returns (address)",
  "function dleInfo() view returns (string, string, string, string, uint256, uint256, uint256, bool)",
  "function eip712Domain() view returns (bytes1, string, string, uint256, address, bytes32, uint256[])",
  "function executeProposal(uint256 _proposalId)",
  "function executeProposalBySignatures(uint256 _proposalId, address[] signers, bytes[] signatures)",
  "function getCurrentChainId() view returns (uint256)",
  "function getDLEInfo() view returns (string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive)",
  "function getModuleAddress(bytes32 _moduleId) view returns (address)",
  "function getMultichainAddresses() view returns (uint256[], address[])",
  "function getMultichainInfo() view returns (uint256[], uint256)",
  "function getPastTotalSupply(uint256 timepoint) view returns (uint256)",
  "function getPastVotes(address account, uint256 timepoint) view returns (uint256)",
  "function getProposalState(uint256 _proposalId) view returns (uint8)",
  "function getProposalSummary(uint256 _proposalId) view returns (uint256, string, uint256, uint256, bool, bool, uint256, address, uint256, uint256[])",
  "function getProposalsCount() view returns (uint256)",
  "function getSupportedChainCount() view returns (uint256)",
  "function getSupportedChainId(uint256 _index) view returns (uint256)",
  "function getVotes(address account) view returns (uint256)",
  "function hasVoted(uint256 _proposalId, address _voter) view returns (bool)",
  "function initializeLogoURI(string _logoURI)",
  "function initializer() view returns (address)",
  "function isActive() view returns (bool)",
  "function isChainSupported(uint256 _chainId) view returns (bool)",
  "function isModuleActive(bytes32 _moduleId) view returns (bool)",
  "function isModuleContract(address) view returns (bool)",
  "function logoURI() view returns (string)",
  "function maxVotingDuration() view returns (uint256)",
  "function minVotingDuration() view returns (uint256)",
  "function modules(bytes32) view returns (address)",
  "function name() view returns (string)",
  "function nonces(address owner) view returns (uint256)",
  "function numCheckpoints(address account) view returns (uint32)",
  "function peerContracts(uint256) view returns (address)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function proposalCounter() view returns (uint256)",
  "function proposalExecutedInChain(uint256, uint256) view returns (bool)",
  "function proposals(uint256) view returns (uint256, string, uint256, uint256, bool, bool, uint256, address, bytes, uint256)",
  "function quorumPercentage() view returns (uint256)",
  "function supportedChainIds(uint256) view returns (uint256)",
  "function supportedChains(uint256) view returns (bool)",
  "function symbol() view returns (string)",
  "function tokenURI() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function transferFrom(address, address, uint256) returns (bool)",
  "function vote(uint256 _proposalId, bool _support)",
  "function voteBySignature(uint256 _proposalId, bool _support, address _voter, bytes _signature)",
  "event Approval(address owner, address spender, uint256 value)",
  "event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp)",
  "event DLEInitialized(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, address tokenAddress, uint256[] supportedChainIds)",
  "event DelegateChanged(address delegator, address fromDelegate, address toDelegate)",
  "event DelegateVotesChanged(address delegate, uint256 previousVotes, uint256 newVotes)",
  "event EIP712DomainChanged()",
  "event InitialTokensDistributed(address[] partners, uint256[] amounts)",
  "event LogoURIUpdated(string oldURI, string newURI)",
  "event ModuleAdded(bytes32 moduleId, address moduleAddress)",
  "event ModuleRemoved(bytes32 moduleId)",
  "event OffchainActionApproved(uint256 proposalId, bytes32 actionId, bytes32 kindHash, bytes32 payloadHash)",
  "event PeerContractSet(uint256 chainId, address peer)",
  "event ProposalCancelled(uint256 proposalId, string reason)",
  "event ProposalCreated(uint256 proposalId, address initiator, string description)",
  "event ProposalExecuted(uint256 proposalId, bytes operation)",
  "event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId)",
  "event ProposalTargetsSet(uint256 proposalId, uint256[] targetChains)",
  "event ProposalVoted(uint256 proposalId, address voter, bool support, uint256 votingPower)",
  "event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage)",
  "event TokensTransferredByGovernance(address sender, address recipient, uint256 amount)",
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
