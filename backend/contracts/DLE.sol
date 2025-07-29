// SPDX-License-Identifier: PROPRIETARY
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
// All rights reserved.
//
// This software is proprietary and confidential.
// Unauthorized copying, modification, or distribution is prohibited.
//
// For licensing inquiries: info@hb3-accelerator.com
// Website: https://hb3-accelerator.com
// GitHub: https://github.com/HB3-ACCELERATOR

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DLE (Digital Legal Entity)
 * @dev Основной контракт DLE с модульной архитектурой и мульти-чейн поддержкой
 */
contract DLE is ERC20, ReentrancyGuard {
    struct DLEInfo {
        string name;
        string symbol;
        string location;
        string coordinates;
        uint256 jurisdiction;
        uint256 oktmo;
        string[] okvedCodes;
        uint256 kpp;
        uint256 creationTimestamp;
        bool isActive;
    }

    struct DLEConfig {
        string name;
        string symbol;
        string location;
        string coordinates;
        uint256 jurisdiction;
        uint256 oktmo;
        string[] okvedCodes;
        uint256 kpp;
        uint256 quorumPercentage;
        address[] initialPartners;
        uint256[] initialAmounts;
        uint256[] supportedChainIds; // Поддерживаемые цепочки
    }

    struct Proposal {
        uint256 id;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        uint256 deadline;
        address initiator;
        bytes operation; // Операция для исполнения
        mapping(address => bool) hasVoted;
        mapping(uint256 => bool) chainVoteSynced; // Синхронизация голосов между цепочками
    }

    struct MultiSigOperation {
        bytes32 operationHash;
        uint256 forSignatures;
        uint256 againstSignatures;
        bool executed;
        uint256 deadline;
        address initiator;
        mapping(address => bool) hasSigned;
        mapping(uint256 => bool) chainSignSynced; // Синхронизация подписей между цепочками
    }

    // Основные настройки
    DLEInfo public dleInfo;
    uint256 public quorumPercentage;
    uint256 public proposalCounter;
    uint256 public multiSigCounter;
    uint256 public currentChainId;

    // Модули
    mapping(bytes32 => address) public modules;
    mapping(bytes32 => bool) public activeModules;

    // Предложения и мультиподписи
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => MultiSigOperation) public multiSigOperations;

    // Мульти-чейн
    mapping(uint256 => bool) public supportedChains;
    mapping(uint256 => bool) public executedProposals; // Синхронизация исполненных предложений
    mapping(uint256 => bool) public executedMultiSig; // Синхронизация исполненных мультиподписей

    // События
    event DLEInitialized(
        string name,
        string symbol,
        string location,
        string coordinates,
        uint256 jurisdiction,
        uint256 oktmo,
        string[] okvedCodes,
        uint256 kpp,
        address tokenAddress,
        uint256[] supportedChainIds
    );
    event InitialTokensDistributed(address[] partners, uint256[] amounts);
    event ProposalCreated(uint256 proposalId, address initiator, string description);
    event ProposalVoted(uint256 proposalId, address voter, bool support, uint256 votingPower);
    event ProposalExecuted(uint256 proposalId, bytes operation);
    event MultiSigOperationCreated(uint256 operationId, address initiator, bytes32 operationHash);
    event MultiSigSigned(uint256 operationId, address signer, bool support, uint256 signaturePower);
    event MultiSigExecuted(uint256 operationId, bytes32 operationHash);
    event ModuleAdded(bytes32 moduleId, address moduleAddress);
    event ModuleRemoved(bytes32 moduleId);
    event CrossChainExecutionSync(uint256 proposalId, uint256 fromChainId, uint256 toChainId);
    event CrossChainVoteSync(uint256 proposalId, uint256 fromChainId, uint256 toChainId);
    event CrossChainMultiSigSync(uint256 operationId, uint256 fromChainId, uint256 toChainId);

    constructor(
        DLEConfig memory config,
        uint256 _currentChainId
    ) ERC20(config.name, config.symbol) {
        dleInfo = DLEInfo({
            name: config.name,
            symbol: config.symbol,
            location: config.location,
            coordinates: config.coordinates,
            jurisdiction: config.jurisdiction,
            oktmo: config.oktmo,
            okvedCodes: config.okvedCodes,
            kpp: config.kpp,
            creationTimestamp: block.timestamp,
            isActive: true
        });
        
        quorumPercentage = config.quorumPercentage;
        currentChainId = _currentChainId;

        // Настраиваем поддерживаемые цепочки
        for (uint256 i = 0; i < config.supportedChainIds.length; i++) {
            supportedChains[config.supportedChainIds[i]] = true;
        }

        // Распределяем начальные токены партнерам
        require(config.initialPartners.length == config.initialAmounts.length, "Arrays length mismatch");
        require(config.initialPartners.length > 0, "No initial partners");
        
        for (uint256 i = 0; i < config.initialPartners.length; i++) {
            require(config.initialPartners[i] != address(0), "Zero address");
            require(config.initialAmounts[i] > 0, "Zero amount");
            _mint(config.initialPartners[i], config.initialAmounts[i]);
        }
        
        emit InitialTokensDistributed(config.initialPartners, config.initialAmounts);
        emit DLEInitialized(
            config.name,
            config.symbol,
            config.location,
            config.coordinates,
            config.jurisdiction,
            config.oktmo,
            config.okvedCodes,
            config.kpp,
            address(this),
            config.supportedChainIds
        );
    }

    /**
     * @dev Создать предложение с выбором цепочки для кворума
     * @param _description Описание предложения
     * @param _duration Длительность голосования в секундах
     * @param _operation Операция для исполнения
     * @param _governanceChainId ID цепочки для сбора голосов
     */
    function createProposal(
        string memory _description, 
        uint256 _duration,
        bytes memory _operation,
        uint256 _governanceChainId
    ) external returns (uint256) {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");
        require(_duration > 0, "Duration must be positive");
        require(supportedChains[_governanceChainId], "Chain not supported");
        require(checkChainConnection(_governanceChainId), "Chain not available");

        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.description = _description;
        proposal.forVotes = 0;
        proposal.againstVotes = 0;
        proposal.executed = false;
        proposal.deadline = block.timestamp + _duration;
        proposal.initiator = msg.sender;
        proposal.operation = _operation;

        emit ProposalCreated(proposalId, msg.sender, _description);
        return proposalId;
    }

    /**
     * @dev Голосовать за предложение
     * @param _proposalId ID предложения
     * @param _support Поддержка предложения
     */
    function vote(uint256 _proposalId, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        require(block.timestamp < proposal.deadline, "Voting ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(balanceOf(msg.sender) > 0, "No tokens to vote");

        uint256 votingPower = balanceOf(msg.sender);
        proposal.hasVoted[msg.sender] = true;

        if (_support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }

        emit ProposalVoted(_proposalId, msg.sender, _support, votingPower);
    }

    /**
     * @dev Синхронизировать голос из другой цепочки
     * @param _proposalId ID предложения
     * @param _fromChainId ID цепочки откуда синхронизируем
     * @param _forVotes Голоса за
     * @param _againstVotes Голоса против
     */
    function syncVoteFromChain(
        uint256 _proposalId,
        uint256 _fromChainId,
        uint256 _forVotes,
        uint256 _againstVotes,
        bytes memory /* _proof */
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        require(supportedChains[_fromChainId], "Chain not supported");
        require(!proposal.chainVoteSynced[_fromChainId], "Already synced");

        // Здесь должна быть проверка proof (для простоты пропускаем)
        // В реальной реализации нужно проверять доказательство

        proposal.forVotes += _forVotes;
        proposal.againstVotes += _againstVotes;
        proposal.chainVoteSynced[_fromChainId] = true;

        emit CrossChainVoteSync(_proposalId, _fromChainId, currentChainId);
    }

    /**
     * @dev Проверить результат предложения
     * @param _proposalId ID предложения
     * @return passed Прошло ли предложение
     * @return quorumReached Достигнут ли кворум
     */
    function checkProposalResult(uint256 _proposalId) public view returns (bool passed, bool quorumReached) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 quorumRequired = (totalSupply() * quorumPercentage) / 100;
        
        quorumReached = totalVotes >= quorumRequired;
        passed = quorumReached && proposal.forVotes > proposal.againstVotes;
        
        return (passed, quorumReached);
    }

    /**
     * @dev Исполнить предложение
     * @param _proposalId ID предложения
     */
    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.deadline, "Voting not ended");

        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        require(passed && quorumReached, "Proposal not passed");

        proposal.executed = true;
        
        // Исполняем операцию
        _executeOperation(proposal.operation);
        
        emit ProposalExecuted(_proposalId, proposal.operation);
    }

    /**
     * @dev Создать мультиподпись операцию
     * @param _operationHash Хеш операции
     * @param _duration Длительность сбора подписей
     */
    function createMultiSigOperation(
        bytes32 _operationHash,
        uint256 _duration
    ) external returns (uint256) {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create operation");
        require(_duration > 0, "Duration must be positive");

        uint256 operationId = multiSigCounter++;
        MultiSigOperation storage operation = multiSigOperations[operationId];
        
        operation.operationHash = _operationHash;
        operation.forSignatures = 0;
        operation.againstSignatures = 0;
        operation.executed = false;
        operation.deadline = block.timestamp + _duration;
        operation.initiator = msg.sender;

        emit MultiSigOperationCreated(operationId, msg.sender, _operationHash);
        return operationId;
    }

    /**
     * @dev Подписать мультиподпись операцию
     * @param _operationId ID операции
     * @param _support Поддержка операции
     */
    function signMultiSigOperation(uint256 _operationId, bool _support) external nonReentrant {
        MultiSigOperation storage operation = multiSigOperations[_operationId];
        require(operation.operationHash != bytes32(0), "Operation does not exist");
        require(block.timestamp < operation.deadline, "Signing ended");
        require(!operation.executed, "Operation already executed");
        require(!operation.hasSigned[msg.sender], "Already signed");
        require(balanceOf(msg.sender) > 0, "No tokens to sign");

        uint256 signaturePower = balanceOf(msg.sender);
        operation.hasSigned[msg.sender] = true;

        if (_support) {
            operation.forSignatures += signaturePower;
        } else {
            operation.againstSignatures += signaturePower;
        }

        emit MultiSigSigned(_operationId, msg.sender, _support, signaturePower);
    }

    /**
     * @dev Синхронизировать мультиподпись из другой цепочки
     * @param _operationId ID операции
     * @param _fromChainId ID цепочки откуда синхронизируем
     * @param _forSignatures Подписи за
     * @param _againstSignatures Подписи против
     */
    function syncMultiSigFromChain(
        uint256 _operationId,
        uint256 _fromChainId,
        uint256 _forSignatures,
        uint256 _againstSignatures,
        bytes memory /* _proof */
    ) external {
        MultiSigOperation storage operation = multiSigOperations[_operationId];
        require(operation.operationHash != bytes32(0), "Operation does not exist");
        require(supportedChains[_fromChainId], "Chain not supported");
        require(!operation.chainSignSynced[_fromChainId], "Already synced");

        // Здесь должна быть проверка proof
        // В реальной реализации нужно проверять доказательство

        operation.forSignatures += _forSignatures;
        operation.againstSignatures += _againstSignatures;
        operation.chainSignSynced[_fromChainId] = true;

        emit CrossChainMultiSigSync(_operationId, _fromChainId, currentChainId);
    }

    /**
     * @dev Проверить результат мультиподписи
     * @param _operationId ID операции
     * @return passed Прошла ли операция
     * @return quorumReached Достигнут ли кворум
     */
    function checkMultiSigResult(uint256 _operationId) public view returns (bool passed, bool quorumReached) {
        MultiSigOperation storage operation = multiSigOperations[_operationId];
        require(operation.operationHash != bytes32(0), "Operation does not exist");

        uint256 totalSignatures = operation.forSignatures + operation.againstSignatures;
        uint256 quorumRequired = (totalSupply() * quorumPercentage) / 100;
        
        quorumReached = totalSignatures >= quorumRequired;
        passed = quorumReached && operation.forSignatures > operation.againstSignatures;
        
        return (passed, quorumReached);
    }

    /**
     * @dev Исполнить мультиподпись операцию
     * @param _operationId ID операции
     */
    function executeMultiSigOperation(uint256 _operationId) external {
        MultiSigOperation storage operation = multiSigOperations[_operationId];
        require(operation.operationHash != bytes32(0), "Operation does not exist");
        require(!operation.executed, "Operation already executed");
        require(block.timestamp >= operation.deadline, "Signing not ended");

        (bool passed, bool quorumReached) = checkMultiSigResult(_operationId);
        require(passed && quorumReached, "Operation not passed");

        operation.executed = true;
        
        emit MultiSigExecuted(_operationId, operation.operationHash);
    }

    /**
     * @dev Синхронизировать исполнение из другой цепочки
     * @param _proposalId ID предложения
     * @param _fromChainId ID цепочки откуда синхронизируем
     */
    function syncExecutionFromChain(
        uint256 _proposalId,
        uint256 _fromChainId,
        bytes memory /* _proof */
    ) external {
        require(supportedChains[_fromChainId], "Chain not supported");
        require(!executedProposals[_proposalId], "Already executed");

        // Здесь должна быть проверка proof
        // В реальной реализации нужно проверять доказательство

        executedProposals[_proposalId] = true;
        
        // Получаем операцию из предложения
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id == _proposalId) {
            _executeOperation(proposal.operation);
        }

        emit CrossChainExecutionSync(_proposalId, _fromChainId, currentChainId);
    }

    /**
     * @dev Проверить подключение к цепочке
     * @param _chainId ID цепочки
     * @return isAvailable Доступна ли цепочка
     */
    function checkChainConnection(uint256 _chainId) public view returns (bool isAvailable) {
        // В реальной реализации здесь должна быть проверка подключения
        // Для примера возвращаем true для поддерживаемых цепочек
        return supportedChains[_chainId];
    }

    /**
     * @dev Проверить все подключения перед синхронизацией
     * @param _proposalId ID предложения
     * @return allChainsReady Готовы ли все цепочки
     */
    function checkSyncReadiness(uint256 _proposalId) public view returns (bool allChainsReady) {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        
        // Проверяем все поддерживаемые цепочки
        for (uint256 i = 0; i < getSupportedChainCount(); i++) {
            uint256 chainId = getSupportedChainId(i);
            if (!checkChainConnection(chainId)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * @dev Синхронизация только при 100% готовности
     * @param _proposalId ID предложения
     */
    function syncToAllChains(uint256 _proposalId) external {
        require(checkSyncReadiness(_proposalId), "Not all chains ready");
        
        // Выполняем синхронизацию во все цепочки
        for (uint256 i = 0; i < getSupportedChainCount(); i++) {
            uint256 chainId = getSupportedChainId(i);
            syncToChain(_proposalId, chainId);
        }
        
        emit SyncCompleted(_proposalId);
    }

    /**
     * @dev Синхронизация в конкретную цепочку
     * @param _proposalId ID предложения
     * @param _chainId ID цепочки
     */
    function syncToChain(uint256 _proposalId, uint256 _chainId) internal {
        // В реальной реализации здесь будет вызов cross-chain bridge
        // Для примера просто эмитим событие
        emit CrossChainExecutionSync(_proposalId, currentChainId, _chainId);
    }

    /**
     * @dev Получить количество поддерживаемых цепочек
     */
    function getSupportedChainCount() public pure returns (uint256) {
        // В реальной реализации нужно хранить массив поддерживаемых цепочек
        // Для примера возвращаем 4 (Ethereum, Polygon, BSC, Arbitrum)
        return 4;
    }

    /**
     * @dev Получить ID поддерживаемой цепочки по индексу
     * @param _index Индекс цепочки
     */
    function getSupportedChainId(uint256 _index) public pure returns (uint256) {
        if (_index == 0) return 1;      // Ethereum
        if (_index == 1) return 137;    // Polygon
        if (_index == 2) return 56;     // BSC
        if (_index == 3) return 42161;  // Arbitrum
        revert("Invalid chain index");
    }

    /**
     * @dev Исполнить операцию
     * @param _operation Операция для исполнения
     */
    function _executeOperation(bytes memory _operation) internal {
        // Декодируем операцию
        (bytes4 selector, bytes memory data) = abi.decode(_operation, (bytes4, bytes));
        
        if (selector == bytes4(keccak256("transfer(address,uint256)"))) {
            // Операция передачи токенов
            (address to, uint256 amount) = abi.decode(data, (address, uint256));
            _transfer(msg.sender, to, amount);
        } else if (selector == bytes4(keccak256("mint(address,uint256)"))) {
            // Операция минтинга токенов
            (address to, uint256 amount) = abi.decode(data, (address, uint256));
            _mint(to, amount);
        } else if (selector == bytes4(keccak256("burn(address,uint256)"))) {
            // Операция сжигания токенов
            (address from, uint256 amount) = abi.decode(data, (address, uint256));
            _burn(from, amount);
        } else {
            // Неизвестная операция
            revert("Unknown operation");
        }
    }

    /**
     * @dev Добавить модуль
     * @param _moduleId ID модуля
     * @param _moduleAddress Адрес модуля
     */
    function addModule(bytes32 _moduleId, address _moduleAddress) external {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to add module");
        require(_moduleAddress != address(0), "Zero address");
        require(!activeModules[_moduleId], "Module already exists");

        modules[_moduleId] = _moduleAddress;
        activeModules[_moduleId] = true;

        emit ModuleAdded(_moduleId, _moduleAddress);
    }

    /**
     * @dev Удалить модуль
     * @param _moduleId ID модуля
     */
    function removeModule(bytes32 _moduleId) external {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to remove module");
        require(activeModules[_moduleId], "Module does not exist");

        delete modules[_moduleId];
        activeModules[_moduleId] = false;

        emit ModuleRemoved(_moduleId);
    }

    /**
     * @dev Получить информацию о DLE
     */
    function getDLEInfo() external view returns (DLEInfo memory) {
        return dleInfo;
    }

    /**
     * @dev Проверить, активен ли модуль
     * @param _moduleId ID модуля
     */
    function isModuleActive(bytes32 _moduleId) external view returns (bool) {
        return activeModules[_moduleId];
    }

    /**
     * @dev Получить адрес модуля
     * @param _moduleId ID модуля
     */
    function getModuleAddress(bytes32 _moduleId) external view returns (address) {
        return modules[_moduleId];
    }

    /**
     * @dev Проверить, поддерживается ли цепочка
     * @param _chainId ID цепочки
     */
    function isChainSupported(uint256 _chainId) external view returns (bool) {
        return supportedChains[_chainId];
    }

    /**
     * @dev Получить текущий ID цепочки
     */
    function getCurrentChainId() external view returns (uint256) {
        return currentChainId;
    }

    // События для новых функций
    event SyncCompleted(uint256 proposalId);
} 