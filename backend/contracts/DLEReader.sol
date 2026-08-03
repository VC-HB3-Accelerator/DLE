// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.

pragma solidity ^0.8.20;

interface IDLEReader {
    // Структуры из основного контракта
    struct DLEInfo {
        string name;
        string symbol;
        string location;
        string coordinates;
        uint256 jurisdiction;
        string[] okvedCodes;
        uint256 kpp;
        uint256 creationTimestamp;
        bool isActive;
    }

    // Автогеттер public mapping proposals: динамические поля (targetChains, hasVoted) опускаются
    function proposals(uint256) external view returns (
        uint256 id,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled,
        uint256 deadline,
        address initiator,
        bytes memory operation,
        uint256 snapshotTimepoint
    );

    function getDLEInfo() external view returns (DLEInfo memory);
    function getProposalSummary(uint256) external view returns (
        uint256 id,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled,
        uint256 deadline,
        address initiator,
        uint256 snapshotTimepoint,
        uint256[] memory targetChains
    );
    function allProposalIds(uint256) external view returns (uint256);
    function supportedChainIds(uint256) external view returns (uint256);
    function quorumPercentage() external view returns (uint256);
    function getCurrentChainId() external view returns (uint256);
    function getSupportedChainCount() external view returns (uint256);
    function getProposalsCount() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function getPastTotalSupply(uint256) external view returns (uint256);
    function getPastVotes(address, uint256) external view returns (uint256);
    function checkProposalResult(uint256) external view returns (bool, bool);
    function getProposalState(uint256) external view returns (uint8);
    function balanceOf(address) external view returns (uint256);
    function isChainSupported(uint256) external view returns (bool);
    function isModuleActive(bytes32) external view returns (bool);
    function getModuleAddress(bytes32) external view returns (address);
    function initializer() external view returns (address);
}

/**
 * @title DLEReader
 * @dev Read-only контракт для API функций DLE
 *
 * БЕЗОПАСНОСТЬ:
 * - Только чтение данных (view/pure функции)
 * - Не изменяет состояние основного контракта
 * - Можно безопасно обновлять независимо от DLE
 * - Нет доступа к приватным данным
 */
contract DLEReader {

    address public immutable dleContract;
    address public opsBridge;

    event ModuleBridgeSet(address indexed bridge);

    constructor(address _dleContract) {
        require(_dleContract != address(0), "DLE contract cannot be zero");
        require(_dleContract.code.length > 0, "DLE contract must exist");
        dleContract = _dleContract;
    }

    function setModuleBridge(address bridge) external {
        require(bridge != address(0), "Bridge cannot be zero");
        require(bridge.code.length > 0, "Bridge has no code");
        address init = IDLEReader(dleContract).initializer();
        if (opsBridge == address(0)) {
            require(msg.sender == dleContract || msg.sender == init, "Only DLE or initializer");
        } else {
            require(msg.sender == dleContract, "Only DLE");
        }
        opsBridge = bridge;
        emit ModuleBridgeSet(bridge);
    }

    function moduleBridge() external view returns (address) {
        return opsBridge;
    }

    // ===== АГРЕГИРОВАННЫЕ ДАННЫЕ =====

    /**
     * @dev Получить полную сводку по предложению
     */
    function getProposalSummary(uint256 _proposalId) external view returns (
        uint256 id,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled,
        uint256 deadline,
        address initiator,
        uint256 snapshotTimepoint,
        uint256[] memory targetChains,
        uint8 state,
        bool passed,
        bool quorumReached
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        (
            id,
            description,
            forVotes,
            againstVotes,
            executed,
            canceled,
            deadline,
            initiator,
            snapshotTimepoint,
            targetChains
        ) = dle.getProposalSummary(_proposalId);

        state = dle.getProposalState(_proposalId);
        (passed, quorumReached) = dle.checkProposalResult(_proposalId);
    }

    /**
     * @dev Получить параметры governance
     */
    function getGovernanceParams() external view returns (
        uint256 quorumPct,
        uint256 chainId,
        uint256 supportedCount,
        uint256 totalSupply,
        uint256 proposalsCount
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        quorumPct = dle.quorumPercentage();
        chainId = dle.getCurrentChainId();
        totalSupply = dle.totalSupply();
        supportedCount = dle.getSupportedChainCount();
        proposalsCount = dle.getProposalsCount();
    }

    /**
     * @dev Получить список поддерживаемых сетей
     */
    function listSupportedChains() external view returns (uint256[] memory chains) {
        IDLEReader dle = IDLEReader(dleContract);

        uint256 count = dle.getSupportedChainCount();
        chains = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            chains[i] = dle.supportedChainIds(i);
        }
    }

    /**
     * @dev Получить список предложений с пагинацией
     */
    function listProposals(uint256 offset, uint256 limit) external view returns (
        uint256[] memory proposalIds,
        uint256 total
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        // Предпочитаем O(1) счётчик, если доступен
        total = dle.getProposalsCount();
        if (offset >= total) {
            return (new uint256[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        proposalIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            proposalIds[i - offset] = dle.allProposalIds(i);
        }
    }

    /**
     * @dev Получить голосующую силу на определённый момент времени
     */
    function getVotingPowerAt(address voter, uint256 timepoint) external view returns (uint256) {
        return IDLEReader(dleContract).getPastVotes(voter, timepoint);
    }

    /**
     * @dev Получить размер кворума на определённый момент времени
     */
    function getQuorumAt(uint256 timepoint) external view returns (uint256) {
        IDLEReader dle = IDLEReader(dleContract);
        uint256 supply = dle.getPastTotalSupply(timepoint);
        uint256 quorumPct = dle.quorumPercentage();
        return (supply * quorumPct) / 100;
    }

    /**
     * @dev Получить детали голосования по предложению
     */
    function getProposalVotes(uint256 _proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 totalVotes,
        uint256 quorumRequired,
        uint256 quorumCurrent,
        bool quorumReached
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        uint256 snapshotTimepoint;
        (
            ,
            ,
            forVotes,
            againstVotes,
            ,
            ,
            ,
            ,
            snapshotTimepoint,
        ) = dle.getProposalSummary(_proposalId);

        totalVotes = forVotes + againstVotes;

        uint256 supply = dle.getPastTotalSupply(snapshotTimepoint);
        uint256 quorumPct = dle.quorumPercentage();
        quorumRequired = (supply * quorumPct) / 100;
        quorumCurrent = totalVotes;
        quorumReached = totalVotes >= quorumRequired;
    }

    /**
     * @dev Получить статистику по адресу
     */
    function getAddressStats(address user) external view returns (
        uint256 tokenBalance,
        uint256 currentVotingPower,
        uint256 delegatedTo,
        bool hasTokens
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        tokenBalance = dle.balanceOf(user);
        currentVotingPower = dle.getPastVotes(user, block.number - 1);
        hasTokens = tokenBalance > 0;

        delegatedTo = 0; // Placeholder
    }

    /**
     * @dev Получить информацию о модулях
     */
    function getModulesInfo(bytes32[] memory moduleIds) external view returns (
        address[] memory addresses,
        bool[] memory active
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        addresses = new address[](moduleIds.length);
        active = new bool[](moduleIds.length);

        for (uint256 i = 0; i < moduleIds.length; i++) {
            addresses[i] = dle.getModuleAddress(moduleIds[i]);
            active[i] = dle.isModuleActive(moduleIds[i]);
        }
    }

    /**
     * @dev Получить состояние DLE
     */
    function getDLEStatus() external view returns (
        IDLEReader.DLEInfo memory info,
        uint256 totalSupply,
        uint256 currentChain,
        uint256 quorumPct,
        uint256 totalProposals,
        uint256 supportedChains
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        info = dle.getDLEInfo();
        totalSupply = dle.totalSupply();
        currentChain = dle.getCurrentChainId();
        quorumPct = dle.quorumPercentage();

        (,, supportedChains, totalSupply, totalProposals) = this.getGovernanceParams();
    }

    /**
     * @dev Batch получение состояний предложений
     */
    function getProposalStates(uint256[] memory proposalIds) external view returns (
        uint8[] memory states,
        bool[] memory passed,
        bool[] memory quorumReached
    ) {
        IDLEReader dle = IDLEReader(dleContract);

        states = new uint8[](proposalIds.length);
        passed = new bool[](proposalIds.length);
        quorumReached = new bool[](proposalIds.length);

        for (uint256 i = 0; i < proposalIds.length; i++) {
            states[i] = dle.getProposalState(proposalIds[i]);
            (passed[i], quorumReached[i]) = dle.checkProposalResult(proposalIds[i]);
        }
    }
}
