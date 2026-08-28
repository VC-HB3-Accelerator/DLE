// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.
//
// This software is proprietary and confidential.
// Unauthorized copying, modification, or distribution is prohibited.
//
// For licensing inquiries: info@hb3-accelerator.com
// Website: https://hb3-accelerator.com
// GitHub: https://github.com/VC-HB3-Accelerator

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Минимальный read API ядра DLE для силы голоса A (не ERC20Votes.delegate на другого).
 */
interface IDLEHierarchy {
    function balanceOf(address account) external view returns (uint256);
    function getPastVotes(address account, uint256 timepoint) external view returns (uint256);
    function getPastTotalSupply(uint256 timepoint) external view returns (uint256);
    function quorumPercentage() external view returns (uint256);
    function clock() external view returns (uint48);
    function isModuleContract(address module) external view returns (bool);
    function initializer() external view returns (address);
}

interface ITreasuryHierarchical {
    function castExternalVote(address targetDLE, uint256 proposalId, bool support) external;
    function ensureVotingPower(address token) external;
}

/**
 * @title HierarchicalVotingModule
 * @dev Голос A на B через казну A (T2, docs.ru/tz-hierarchical-voting.ru.md).
 *
 * Холдеры A on-chain approve/reject операцию (сила с snapshot A).
 * Execute: for>against + кворум A → treasury.castExternalVote → B.vote от казны.
 * Не использует DLE.delegate на другого адреса.
 */
contract HierarchicalVotingModule is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct ExternalDLEInfo {
        address dleAddress;
        string name;
        string symbol;
        uint256 tokenBalance;
        bool isActive;
        uint256 addedAt;
    }

    /// @dev Операция «vote на B от имени A» (итерация 1).
    struct ExternalVoteOp {
        address targetDLE;
        uint256 targetProposalId;
        bool supportOnB;
        address creator;
        address executor;
        uint256 snapshotA;
        uint256 deadline;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool exists;
    }

    address public immutable dleContract;
    address public treasuryModule;
    /// @dev Тонкий HierarchicalVotingBridge.
    address public opsBridge;

    mapping(address => ExternalDLEInfo) public externalDLEs;
    address[] public externalDLEList;
    mapping(address => uint256) public externalDLEIndex;

    mapping(uint256 => ExternalVoteOp) public externalVoteOps;
    uint256 public externalVoteOpCounter;
    /// @dev holder => opId => уже поставил позицию
    mapping(address => mapping(uint256 => bool)) public hasStakedOnOp;

    uint256 public totalExternalDLEs;
    uint256 public totalExternalVoteOps;
    uint256 public totalExternalVotesExecuted;

    event TreasuryModuleSet(address indexed treasuryModule, uint256 timestamp);
    event ModuleBridgeSet(address indexed bridge);
    event ExternalDLEAdded(
        address indexed dleAddress,
        string name,
        string symbol,
        uint256 tokenBalance,
        uint256 timestamp
    );
    event ExternalDLERemoved(address indexed dleAddress, uint256 timestamp);
    event ExternalDLEBalanceUpdated(address indexed dleAddress, uint256 oldBalance, uint256 newBalance);
    event ExternalVoteOpCreated(
        uint256 indexed opId,
        address indexed targetDLE,
        uint256 targetProposalId,
        bool supportOnB,
        address creator,
        address executor,
        uint256 snapshotA,
        uint256 deadline
    );
    event ExternalVoteOpStaked(uint256 indexed opId, address indexed holder, bool support, uint256 power);
    event ExternalVoteOpExecuted(
        uint256 indexed opId,
        address indexed targetDLE,
        uint256 targetProposalId,
        bool supportOnB,
        uint256 treasuryBalance
    );

    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE contract can call this");
        _;
    }

    modifier onlyDLEOrBridge() {
        require(
            msg.sender == dleContract || msg.sender == opsBridge,
            "Only DLE or bridge"
        );
        _;
    }

    /// @dev Bootstrap после деплоя: initializer A или сам DLE (governance callback) или bridge.
    modifier onlyDLEOrInitializer() {
        require(
            msg.sender == dleContract
                || msg.sender == opsBridge
                || msg.sender == IDLEHierarchy(dleContract).initializer(),
            "Only DLE or initializer"
        );
        _;
    }

    modifier validExternalDLE(address dleAddress) {
        require(externalDLEs[dleAddress].isActive, "External DLE not active");
        _;
    }

    constructor(address _dleContract) {
        require(_dleContract != address(0), "DLE contract cannot be zero");
        dleContract = _dleContract;
        treasuryModule = address(0);
    }

    function setModuleBridge(address bridge) external {
        require(bridge != address(0), "Bridge cannot be zero");
        require(bridge.code.length > 0, "Bridge has no code");
        address init = IDLEHierarchy(dleContract).initializer();
        if (opsBridge == address(0)) {
            require(
                msg.sender == dleContract || msg.sender == init,
                "Only DLE or initializer"
            );
        } else {
            // Смена моста через governance: DLE → oldBridge.setModuleBridge → module
            require(
                msg.sender == dleContract || msg.sender == opsBridge,
                "Only DLE or current ops bridge"
            );
        }
        opsBridge = bridge;
        emit ModuleBridgeSet(bridge);
    }

    function moduleBridge() external view returns (address) {
        return opsBridge;
    }

    function setTreasuryModule(address _treasuryModule) external {
        require(
            msg.sender == dleContract
                || msg.sender == opsBridge
                || msg.sender == IDLEHierarchy(dleContract).initializer(),
            "Only DLE, bridge or initializer"
        );
        require(_treasuryModule != address(0), "Treasury module cannot be zero");
        require(_treasuryModule.code.length > 0, "Treasury module contract does not exist");
        treasuryModule = _treasuryModule;
        emit TreasuryModuleSet(_treasuryModule, block.timestamp);
    }

    function addExternalDLE(
        address dleAddress,
        string memory name,
        string memory symbol
    ) external {
        require(
            msg.sender == dleContract
                || msg.sender == opsBridge
                || msg.sender == IDLEHierarchy(dleContract).initializer(),
            "Only DLE, bridge or initializer"
        );
        require(dleAddress != address(0), "DLE address cannot be zero");
        require(!externalDLEs[dleAddress].isActive, "External DLE already added");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(treasuryModule != address(0), "Treasury module not set");
        require(dleAddress.code.length > 0, "DLE contract does not exist");

        uint256 tokenBalance = IERC20(dleAddress).balanceOf(treasuryModule);

        externalDLEs[dleAddress] = ExternalDLEInfo({
            dleAddress: dleAddress,
            name: name,
            symbol: symbol,
            tokenBalance: tokenBalance,
            isActive: true,
            addedAt: block.timestamp
        });

        externalDLEList.push(dleAddress);
        externalDLEIndex[dleAddress] = externalDLEList.length - 1;
        totalExternalDLEs++;

        emit ExternalDLEAdded(dleAddress, name, symbol, tokenBalance, block.timestamp);
    }

    function removeExternalDLE(address dleAddress) external onlyDLEOrBridge validExternalDLE(dleAddress) {
        require(externalDLEs[dleAddress].tokenBalance == 0, "Token balance must be zero");

        uint256 index = externalDLEIndex[dleAddress];
        uint256 lastIndex = externalDLEList.length - 1;

        if (index != lastIndex) {
            address lastDLE = externalDLEList[lastIndex];
            externalDLEList[index] = lastDLE;
            externalDLEIndex[lastDLE] = index;
        }

        externalDLEList.pop();
        delete externalDLEIndex[dleAddress];
        delete externalDLEs[dleAddress];
        totalExternalDLEs--;

        emit ExternalDLERemoved(dleAddress, block.timestamp);
    }

    function updateExternalDLEBalance(address dleAddress) external onlyDLEOrBridge validExternalDLE(dleAddress) {
        uint256 oldBalance = externalDLEs[dleAddress].tokenBalance;
        uint256 newBalance = IERC20(dleAddress).balanceOf(treasuryModule);
        externalDLEs[dleAddress].tokenBalance = newBalance;
        emit ExternalDLEBalanceUpdated(dleAddress, oldBalance, newBalance);
    }

    function updateAllExternalDLEBalances() external onlyDLEOrBridge {
        for (uint256 i = 0; i < externalDLEList.length; i++) {
            address dleAddress = externalDLEList[i];
            if (externalDLEs[dleAddress].isActive) {
                uint256 oldBalance = externalDLEs[dleAddress].tokenBalance;
                uint256 newBalance = IERC20(dleAddress).balanceOf(treasuryModule);
                externalDLEs[dleAddress].tokenBalance = newBalance;
                emit ExternalDLEBalanceUpdated(dleAddress, oldBalance, newBalance);
            }
        }
    }

    /**
     * @dev Холдер A создаёт операцию vote на B. Не onlyDLE — кошелёк холдера.
     */
    function createExternalVoteOp(
        address targetDLE,
        uint256 targetProposalId,
        bool supportOnB,
        uint256 duration,
        address executor
    ) external nonReentrant validExternalDLE(targetDLE) returns (uint256 opId) {
        require(IDLEHierarchy(dleContract).isModuleContract(address(this)), "HV not registered on DLE");
        require(treasuryModule != address(0), "Treasury module not set");
        require(IDLEHierarchy(dleContract).balanceOf(msg.sender) > 0, "Not A holder");
        require(IERC20(targetDLE).balanceOf(treasuryModule) > 0, "No B tokens in treasury");
        require(duration > 0, "Duration must be positive");
        require(executor != address(0), "Executor cannot be zero");
        require(IDLEHierarchy(dleContract).balanceOf(executor) > 0, "Executor not A holder");

        uint256 nowClock = uint256(IDLEHierarchy(dleContract).clock());
        uint256 snapshotA = nowClock == 0 ? 0 : nowClock - 1;

        opId = externalVoteOpCounter++;
        externalVoteOps[opId] = ExternalVoteOp({
            targetDLE: targetDLE,
            targetProposalId: targetProposalId,
            supportOnB: supportOnB,
            creator: msg.sender,
            executor: executor,
            snapshotA: snapshotA,
            deadline: block.timestamp + duration,
            forVotes: 0,
            againstVotes: 0,
            executed: false,
            exists: true
        });

        totalExternalVoteOps++;
        // кэш баланса
        externalDLEs[targetDLE].tokenBalance = IERC20(targetDLE).balanceOf(treasuryModule);

        emit ExternalVoteOpCreated(
            opId,
            targetDLE,
            targetProposalId,
            supportOnB,
            msg.sender,
            executor,
            snapshotA,
            block.timestamp + duration
        );
    }

    function approveOperation(uint256 opId) external nonReentrant {
        _stakeOnOp(opId, true);
    }

    function rejectOperation(uint256 opId) external nonReentrant {
        _stakeOnOp(opId, false);
    }

    function _stakeOnOp(uint256 opId, bool support) internal {
        ExternalVoteOp storage op = externalVoteOps[opId];
        require(op.exists, "Op not found");
        require(!op.executed, "Op already executed");
        require(block.timestamp < op.deadline, "Op expired");
        require(!hasStakedOnOp[msg.sender][opId], "Already staked");

        uint256 power = IDLEHierarchy(dleContract).getPastVotes(msg.sender, op.snapshotA);
        require(power > 0, "No voting power at snapshot");

        hasStakedOnOp[msg.sender][opId] = true;
        if (support) {
            op.forVotes += power;
        } else {
            op.againstVotes += power;
        }

        emit ExternalVoteOpStaked(opId, msg.sender, support, power);
    }

    /**
     * @dev Как checkProposalResult ядра A: кворум по сумме голосов и for > against.
     */
    function checkOpResult(uint256 opId) public view returns (bool passed, bool quorumReached) {
        ExternalVoteOp storage op = externalVoteOps[opId];
        require(op.exists, "Op not found");

        uint256 totalVotes = op.forVotes + op.againstVotes;
        uint256 pastSupply = IDLEHierarchy(dleContract).getPastTotalSupply(op.snapshotA);
        uint256 quorumRequired = (pastSupply * IDLEHierarchy(dleContract).quorumPercentage()) / 100;

        quorumReached = totalVotes >= quorumRequired;
        passed = quorumReached && op.forVotes > op.againstVotes;
    }

    /**
     * @dev Только executor; затем treasury.castExternalVote (T2).
     */
    function executeExternalVote(uint256 opId) external nonReentrant {
        ExternalVoteOp storage op = externalVoteOps[opId];
        require(op.exists, "Op not found");
        require(!op.executed, "Op already executed");
        require(block.timestamp < op.deadline, "Op expired");
        require(msg.sender == op.executor, "Only executor");

        (bool passed, bool quorumReached) = checkOpResult(opId);
        require(quorumReached && passed, "A quorum/result not met");

        uint256 treasuryBal = IERC20(op.targetDLE).balanceOf(treasuryModule);
        require(treasuryBal > 0, "No B tokens in treasury");

        // best-effort self-delegate казны на B
        try ITreasuryHierarchical(treasuryModule).ensureVotingPower(op.targetDLE) {} catch {}

        ITreasuryHierarchical(treasuryModule).castExternalVote(
            op.targetDLE,
            op.targetProposalId,
            op.supportOnB
        );

        op.executed = true;
        totalExternalVotesExecuted++;
        externalDLEs[op.targetDLE].tokenBalance = treasuryBal;

        emit ExternalVoteOpExecuted(
            opId,
            op.targetDLE,
            op.targetProposalId,
            op.supportOnB,
            treasuryBal
        );
    }

    // ===== VIEW =====

    function getExternalDLEInfo(address dleAddress) external view returns (ExternalDLEInfo memory) {
        return externalDLEs[dleAddress];
    }

    function getAllExternalDLEs() external view returns (address[] memory) {
        return externalDLEList;
    }

    function getExternalVoteOp(uint256 opId) external view returns (ExternalVoteOp memory) {
        return externalVoteOps[opId];
    }

    function getModuleStats()
        external
        view
        returns (uint256 totalDLEs, uint256 totalOps, uint256 totalVotes, uint256 activeDLEs)
    {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < externalDLEList.length; i++) {
            if (externalDLEs[externalDLEList[i]].isActive) {
                activeCount++;
            }
        }
        return (totalExternalDLEs, totalExternalVoteOps, totalExternalVotesExecuted, activeCount);
    }
}
