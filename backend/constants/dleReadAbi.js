/**
 * Единые human-readable ABI фрагменты для чтения DLE / DLEReader.
 * Источник правды — сигнатуры в backend/contracts/DLE.sol и DLEReader.sol
 * (AUDIT §2.2–2.4: без oktmo / governanceChainId в Proposal).
 */

/** DLE.getDLEInfo — актуальная структура без oktmo */
const DLE_GET_DLE_INFO =
  'function getDLEInfo() external view returns ('
  + 'tuple(string name, string symbol, string location, string coordinates, '
  + 'uint256 jurisdiction, string[] okvedCodes, uint256 kpp, '
  + 'uint256 creationTimestamp, bool isActive))';

/** DLE.getProposalSummary — без governanceChainId */
const DLE_GET_PROPOSAL_SUMMARY =
  'function getProposalSummary(uint256 _proposalId) external view returns ('
  + 'uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, '
  + 'bool executed, bool canceled, uint256 deadline, address initiator, '
  + 'uint256 snapshotTimepoint, uint256[] memory targetChains)';

/**
 * Public mapping proposals(uint256) — Solidity опускает targetChains и hasVoted.
 * Без governanceChainId.
 */
const DLE_PROPOSALS_GETTER =
  'function proposals(uint256) external view returns ('
  + 'uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, '
  + 'bool executed, bool canceled, uint256 deadline, address initiator, '
  + 'bytes memory operation, uint256 snapshotTimepoint)';

/** DLEReader.getProposalSummary — сводка DLE + state/passed/quorum */
const READER_GET_PROPOSAL_SUMMARY =
  'function getProposalSummary(uint256 _proposalId) external view returns ('
  + 'uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, '
  + 'bool executed, bool canceled, uint256 deadline, address initiator, '
  + 'uint256 snapshotTimepoint, uint256[] memory targetChains, '
  + 'uint8 state, bool passed, bool quorumReached)';

const DLE_GET_CURRENT_CHAIN_ID =
  'function getCurrentChainId() external view returns (uint256)';

const DLE_CHECK_PROPOSAL_RESULT =
  'function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)';

const DLE_GET_PROPOSAL_STATE =
  'function getProposalState(uint256 _proposalId) external view returns (uint8 state)';

const DLE_GET_PROPOSALS_COUNT =
  'function getProposalsCount() external view returns (uint256)';

const DLE_GET_MODULE_ADDRESS =
  'function getModuleAddress(bytes32 _moduleId) external view returns (address)';

const DLE_QUORUM_PERCENTAGE =
  'function quorumPercentage() external view returns (uint256)';

const DLE_GET_SUPPORTED_CHAIN_COUNT =
  'function getSupportedChainCount() public view returns (uint256)';

const DLE_GET_SUPPORTED_CHAIN_ID =
  'function getSupportedChainId(uint256 _index) public view returns (uint256)';

const DLE_TOTAL_SUPPLY =
  'function totalSupply() external view returns (uint256)';

/** DLEReader.getGovernanceParams — только на адресе Reader */
const READER_GET_GOVERNANCE_PARAMS =
  'function getGovernanceParams() external view returns ('
  + 'uint256 quorumPct, uint256 chainId, uint256 supportedCount, '
  + 'uint256 totalSupply, uint256 proposalsCount)';

/** DLEReader.listSupportedChains — только на адресе Reader */
const READER_LIST_SUPPORTED_CHAINS =
  'function listSupportedChains() external view returns (uint256[] memory chains)';

module.exports = {
  DLE_GET_DLE_INFO,
  DLE_GET_PROPOSAL_SUMMARY,
  DLE_PROPOSALS_GETTER,
  READER_GET_PROPOSAL_SUMMARY,
  DLE_GET_CURRENT_CHAIN_ID,
  DLE_CHECK_PROPOSAL_RESULT,
  DLE_GET_PROPOSAL_STATE,
  DLE_GET_PROPOSALS_COUNT,
  DLE_GET_MODULE_ADDRESS,
  DLE_QUORUM_PERCENTAGE,
  DLE_GET_SUPPORTED_CHAIN_COUNT,
  DLE_GET_SUPPORTED_CHAIN_ID,
  DLE_TOTAL_SUPPLY,
  READER_GET_GOVERNANCE_PARAMS,
  READER_LIST_SUPPORTED_CHAINS,
};
