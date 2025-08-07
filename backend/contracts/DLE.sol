// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
// All rights reserved.
//
// This software is proprietary and confidential.
// Unauthorized copying, modification, or distribution is prohibited.
//
// For licensing inquiries: info@hb3-accelerator.com
// Website: https://hb3-accelerator.com
// GitHub: https://github.com/HB3-ACCELERATOR
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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



    // Основные настройки
    DLEInfo public dleInfo;
    uint256 public quorumPercentage;
    uint256 public proposalCounter;
    uint256 public currentChainId;

    // Модули
    mapping(bytes32 => address) public modules;
    mapping(bytes32 => bool) public activeModules;

    // Предложения
    mapping(uint256 => Proposal) public proposals;

    // Мульти-чейн
    mapping(uint256 => bool) public supportedChains;
    uint256[] public supportedChainIds;
    mapping(uint256 => bool) public executedProposals; // Синхронизация исполненных предложений
    
    // Merkle proofs для cross-chain синхронизации
    mapping(uint256 => bytes32) public chainMerkleRoots; // chainId => merkleRoot
    mapping(uint256 => mapping(uint256 => bool)) public processedProofs; // proposalId => proofHash => processed

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
    event ModuleAdded(bytes32 moduleId, address moduleAddress);
    event ModuleRemoved(bytes32 moduleId);
    event CrossChainExecutionSync(uint256 proposalId, uint256 fromChainId, uint256 toChainId);
    event CrossChainVoteSync(uint256 proposalId, uint256 fromChainId, uint256 toChainId);
    event ChainAdded(uint256 chainId);
    event ChainRemoved(uint256 chainId);
    event ChainMerkleRootSet(uint256 chainId, bytes32 merkleRoot);
    event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp);
    event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage);
    event CurrentChainIdUpdated(uint256 oldChainId, uint256 newChainId);

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
            supportedChainIds.push(config.supportedChainIds[i]);
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
        bytes memory _proof
    ) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        require(supportedChains[_fromChainId], "Chain not supported");
        require(!proposal.chainVoteSynced[_fromChainId], "Already synced");

            // Проверяем доказательство cross-chain синхронизации
    require(_proof.length > 0, "Proof required for cross-chain sync");
    
    // Проверяем Merkle proof для cross-chain синхронизации
    bytes32 proofHash = keccak256(abi.encodePacked(_proposalId, _fromChainId, _forVotes, _againstVotes));
    require(!processedProofs[_proposalId][uint256(proofHash)], "Proof already processed");
    
    // Проверяем, что Merkle root для цепочки установлен
    bytes32 merkleRoot = chainMerkleRoots[_fromChainId];
    require(merkleRoot != bytes32(0), "Merkle root not set for chain");
    
    // Проверяем Merkle proof
    bytes32[] memory proof = abi.decode(_proof, (bytes32[]));
    require(MerkleProof.verify(proof, merkleRoot, proofHash), "Invalid Merkle proof");
    
    // Отмечаем proof как обработанный
    processedProofs[_proposalId][uint256(proofHash)] = true;
    
    // Проверяем, что голоса не превышают общее количество токенов
    uint256 totalVotes = _forVotes + _againstVotes;
    require(totalVotes <= totalSupply(), "Votes exceed total supply");

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

        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        
        // Предложение можно выполнить если:
        // 1. Дедлайн истек ИЛИ кворум достигнут
        require(
            block.timestamp >= proposal.deadline || quorumReached, 
            "Voting not ended and quorum not reached"
        );
        require(passed && quorumReached, "Proposal not passed");

        proposal.executed = true;
        
        // Исполняем операцию
        _executeOperation(proposal.operation);
        
        emit ProposalExecuted(_proposalId, proposal.operation);
    }

    /**
     * @dev Синхронизировать исполнение из другой цепочки
     * @param _proposalId ID предложения
     * @param _fromChainId ID цепочки откуда синхронизируем
     */
    function syncExecutionFromChain(
        uint256 _proposalId,
        uint256 _fromChainId,
        bytes memory _proof
    ) external {
        require(supportedChains[_fromChainId], "Chain not supported");
        require(!executedProposals[_proposalId], "Already executed");

            // Проверяем доказательство исполнения из другой цепочки
    require(_proof.length > 0, "Proof required for cross-chain execution");
    
    // Проверяем Merkle proof для cross-chain исполнения
    bytes32 proofHash = keccak256(abi.encodePacked(_proposalId, _fromChainId, "EXECUTION"));
    require(!processedProofs[_proposalId][uint256(proofHash)], "Proof already processed");
    
    // Проверяем, что Merkle root для цепочки установлен
    bytes32 merkleRoot = chainMerkleRoots[_fromChainId];
    require(merkleRoot != bytes32(0), "Merkle root not set for chain");
    
    // Проверяем Merkle proof
    bytes32[] memory proof = abi.decode(_proof, (bytes32[]));
    require(MerkleProof.verify(proof, merkleRoot, proofHash), "Invalid Merkle proof");
    
    // Отмечаем proof как обработанный
    processedProofs[_proposalId][uint256(proofHash)] = true;
    
        // Проверяем, что предложение существует и не было исполнено
    Proposal storage proposal = proposals[_proposalId];
    require(proposal.id == _proposalId, "Proposal does not exist");
    require(!proposal.executed, "Proposal already executed");

        executedProposals[_proposalId] = true;
        
    // Исполняем операцию из предложения
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
        // Проверяем, поддерживается ли цепочка
        if (!supportedChains[_chainId]) {
            return false;
        }
        
        // Проверяем, что Merkle root установлен для цепочки
        // Это означает, что цепочка активна и готова к синхронизации
        bytes32 merkleRoot = chainMerkleRoots[_chainId];
        if (merkleRoot == bytes32(0)) {
            return false;
        }
        
        return true;
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
        // Проверяем, что цепочка поддерживается
        require(supportedChains[_chainId], "Chain not supported");
        
        // Получаем информацию о предложении
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        
        // Проверяем, что цепочка готова к синхронизации
        require(checkChainConnection(_chainId), "Chain not ready for sync");
        
        // Создаем Merkle root для синхронизации
        bytes32 syncData = keccak256(abi.encodePacked(_proposalId, currentChainId, proposal.operation));
        
        // Обновляем Merkle root для целевой цепочки
        chainMerkleRoots[_chainId] = syncData;
        
        // Эмитим событие для cross-chain bridge
        emit CrossChainExecutionSync(_proposalId, currentChainId, _chainId);
    }

    /**
     * @dev Получить количество поддерживаемых цепочек
     */
    function getSupportedChainCount() public view returns (uint256) {
        return supportedChainIds.length;
    }

    /**
     * @dev Получить ID поддерживаемой цепочки по индексу
     * @param _index Индекс цепочки
     */
    function getSupportedChainId(uint256 _index) public view returns (uint256) {
        require(_index < supportedChainIds.length, "Invalid chain index");
        return supportedChainIds[_index];
    }

    /**
     * @dev Добавить поддерживаемую цепочку (только для владельцев токенов)
     * @param _chainId ID цепочки
     */
    function addSupportedChain(uint256 _chainId) external {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to add chain");
        require(!supportedChains[_chainId], "Chain already supported");
        require(_chainId != currentChainId, "Cannot add current chain");
        
        supportedChains[_chainId] = true;
        supportedChainIds.push(_chainId);
        
        emit ChainAdded(_chainId);
    }

    /**
     * @dev Удалить поддерживаемую цепочку (только для владельцев токенов)
     * @param _chainId ID цепочки
     */
    function removeSupportedChain(uint256 _chainId) external {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to remove chain");
        require(supportedChains[_chainId], "Chain not supported");
        require(_chainId != currentChainId, "Cannot remove current chain");
        
        supportedChains[_chainId] = false;
        
        // Удаляем из массива
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            if (supportedChainIds[i] == _chainId) {
                supportedChainIds[i] = supportedChainIds[supportedChainIds.length - 1];
                supportedChainIds.pop();
                break;
            }
        }
        
        // Очищаем Merkle root для цепочки
        delete chainMerkleRoots[_chainId];
        
        emit ChainRemoved(_chainId);
    }

    /**
     * @dev Установить Merkle root для цепочки (только для владельцев токенов)
     * @param _chainId ID цепочки
     * @param _merkleRoot Merkle root для цепочки
     */
    function setChainMerkleRoot(uint256 _chainId, bytes32 _merkleRoot) external {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to set merkle root");
        require(supportedChains[_chainId], "Chain not supported");
        
        chainMerkleRoots[_chainId] = _merkleRoot;
        
        emit ChainMerkleRootSet(_chainId, _merkleRoot);
    }

    /**
     * @dev Получить Merkle root для цепочки
     * @param _chainId ID цепочки
     */
    function getChainMerkleRoot(uint256 _chainId) external view returns (bytes32) {
        return chainMerkleRoots[_chainId];
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
        } else if (selector == bytes4(keccak256("updateDLEInfo(string,string,string,string,uint256,uint256,string[],uint256)"))) {
            // Операция обновления информации DLE
            (string memory name, string memory symbol, string memory location, string memory coordinates, 
             uint256 jurisdiction, uint256 oktmo, string[] memory okvedCodes, uint256 kpp) = abi.decode(data, (string, string, string, string, uint256, uint256, string[], uint256));
            _updateDLEInfo(name, symbol, location, coordinates, jurisdiction, oktmo, okvedCodes, kpp);
        } else if (selector == bytes4(keccak256("updateQuorumPercentage(uint256)"))) {
            // Операция обновления процента кворума
            (uint256 newQuorumPercentage) = abi.decode(data, (uint256));
            _updateQuorumPercentage(newQuorumPercentage);
        } else if (selector == bytes4(keccak256("updateCurrentChainId(uint256)"))) {
            // Операция обновления текущей цепочки
            (uint256 newChainId) = abi.decode(data, (uint256));
            _updateCurrentChainId(newChainId);
        } else if (selector == bytes4(keccak256("_addModule(bytes32,address)"))) {
            // Операция добавления модуля
            (bytes32 moduleId, address moduleAddress) = abi.decode(data, (bytes32, address));
            _addModule(moduleId, moduleAddress);
        } else if (selector == bytes4(keccak256("_removeModule(bytes32)"))) {
            // Операция удаления модуля
            (bytes32 moduleId) = abi.decode(data, (bytes32));
            _removeModule(moduleId);
        } else {
            // Неизвестная операция
            revert("Unknown operation");
        }
    }

    /**
     * @dev Обновить информацию DLE
     * @param _name Новое название
     * @param _symbol Новый символ
     * @param _location Новое местонахождение
     * @param _coordinates Новые координаты
     * @param _jurisdiction Новая юрисдикция
     * @param _oktmo Новый ОКТМО
     * @param _okvedCodes Новые коды ОКВЭД
     * @param _kpp Новый КПП
     */
    function _updateDLEInfo(
        string memory _name,
        string memory _symbol,
        string memory _location,
        string memory _coordinates,
        uint256 _jurisdiction,
        uint256 _oktmo,
        string[] memory _okvedCodes,
        uint256 _kpp
    ) internal {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(_jurisdiction > 0, "Invalid jurisdiction");
        require(_oktmo > 0, "Invalid OKTMO");
        require(_kpp > 0, "Invalid KPP");

        dleInfo.name = _name;
        dleInfo.symbol = _symbol;
        dleInfo.location = _location;
        dleInfo.coordinates = _coordinates;
        dleInfo.jurisdiction = _jurisdiction;
        dleInfo.oktmo = _oktmo;
        dleInfo.okvedCodes = _okvedCodes;
        dleInfo.kpp = _kpp;

        emit DLEInfoUpdated(_name, _symbol, _location, _coordinates, _jurisdiction, _oktmo, _okvedCodes, _kpp);
    }

    /**
     * @dev Обновить процент кворума
     * @param _newQuorumPercentage Новый процент кворума
     */
    function _updateQuorumPercentage(uint256 _newQuorumPercentage) internal {
        require(_newQuorumPercentage > 0 && _newQuorumPercentage <= 100, "Invalid quorum percentage");
        
        uint256 oldQuorumPercentage = quorumPercentage;
        quorumPercentage = _newQuorumPercentage;
        
        emit QuorumPercentageUpdated(oldQuorumPercentage, _newQuorumPercentage);
    }

    /**
     * @dev Обновить текущую цепочку
     * @param _newChainId Новый ID цепочки
     */
    function _updateCurrentChainId(uint256 _newChainId) internal {
        require(supportedChains[_newChainId], "Chain not supported");
        require(_newChainId != currentChainId, "Same chain ID");
        
        uint256 oldChainId = currentChainId;
        currentChainId = _newChainId;
        
        emit CurrentChainIdUpdated(oldChainId, _newChainId);
    }

    /**
     * @dev Создать предложение о добавлении модуля
     * @param _description Описание предложения
     * @param _duration Длительность голосования в секундах
     * @param _moduleId ID модуля
     * @param _moduleAddress Адрес модуля
     * @param _chainId ID цепочки для голосования
     */
    function createAddModuleProposal(
        string memory _description,
        uint256 _duration,
        bytes32 _moduleId,
        address _moduleAddress,
        uint256 _chainId
    ) external returns (uint256) {
        require(supportedChains[_chainId], "Chain not supported");
        require(checkChainConnection(_chainId), "Chain not available");
        require(_moduleAddress != address(0), "Zero address");
        require(!activeModules[_moduleId], "Module already exists");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");

        uint256 proposalId = proposalCounter++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.description = _description;
        proposal.deadline = block.timestamp + _duration;
        proposal.initiator = msg.sender;
        
        // Кодируем операцию добавления модуля
        bytes memory operation = abi.encodeWithSelector(
            bytes4(keccak256("_addModule(bytes32,address)")),
            _moduleId,
            _moduleAddress
        );
        proposal.operation = operation;

        emit ProposalCreated(proposalId, msg.sender, _description);
        return proposalId;
    }

    /**
     * @dev Создать предложение об удалении модуля
     * @param _description Описание предложения
     * @param _duration Длительность голосования в секундах
     * @param _moduleId ID модуля
     * @param _chainId ID цепочки для голосования
     */
    function createRemoveModuleProposal(
        string memory _description,
        uint256 _duration,
        bytes32 _moduleId,
        uint256 _chainId
    ) external returns (uint256) {
        require(supportedChains[_chainId], "Chain not supported");
        require(checkChainConnection(_chainId), "Chain not available");
        require(activeModules[_moduleId], "Module does not exist");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");

        uint256 proposalId = proposalCounter++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.description = _description;
        proposal.deadline = block.timestamp + _duration;
        proposal.initiator = msg.sender;
        
        // Кодируем операцию удаления модуля
        bytes memory operation = abi.encodeWithSelector(
            bytes4(keccak256("_removeModule(bytes32)")),
            _moduleId
        );
        proposal.operation = operation;

        emit ProposalCreated(proposalId, msg.sender, _description);
        return proposalId;
    }

    /**
     * @dev Добавить модуль (внутренняя функция, вызывается через кворум)
     * @param _moduleId ID модуля
     * @param _moduleAddress Адрес модуля
     */
    function _addModule(bytes32 _moduleId, address _moduleAddress) internal {
        require(_moduleAddress != address(0), "Zero address");
        require(!activeModules[_moduleId], "Module already exists");

        modules[_moduleId] = _moduleAddress;
        activeModules[_moduleId] = true;

        emit ModuleAdded(_moduleId, _moduleAddress);
    }

    /**
     * @dev Удалить модуль (внутренняя функция, вызывается через кворум)
     * @param _moduleId ID модуля
     */
    function _removeModule(bytes32 _moduleId) internal {
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
    event DLEDeactivated(address indexed deactivatedBy, uint256 timestamp);
    event DeactivationProposalCreated(uint256 proposalId, address indexed initiator, string description);
    event DeactivationProposalVoted(uint256 proposalId, address indexed voter, bool support, uint256 votingPower);
    event DeactivationProposalExecuted(uint256 proposalId, address indexed executedBy);

    // Структура для предложения деактивации
    struct DeactivationProposal {
        uint256 id;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        uint256 deadline;
        address initiator;
        uint256 chainId;
        mapping(address => bool) hasVoted;
    }

    // Предложения деактивации
    mapping(uint256 => DeactivationProposal) public deactivationProposals;
    uint256 public deactivationProposalCounter;
    bool public isDeactivated;

    /**
     * @dev Создать предложение о деактивации DLE
     * @param _description Описание предложения
     * @param _duration Длительность голосования в секундах
     * @param _chainId ID цепочки для деактивации
     */
    function createDeactivationProposal(
        string memory _description, 
        uint256 _duration,
        uint256 _chainId
    ) external returns (uint256) {
        require(!isDeactivated, "DLE already deactivated");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create deactivation proposal");
        require(_duration > 0, "Duration must be positive");
        require(supportedChains[_chainId], "Chain not supported");

        uint256 proposalId = deactivationProposalCounter++;
        DeactivationProposal storage proposal = deactivationProposals[proposalId];
        
        proposal.id = proposalId;
        proposal.description = _description;
        proposal.forVotes = 0;
        proposal.againstVotes = 0;
        proposal.executed = false;
        proposal.deadline = block.timestamp + _duration;
        proposal.initiator = msg.sender;
        proposal.chainId = _chainId;

        emit DeactivationProposalCreated(proposalId, msg.sender, _description);
        return proposalId;
    }

    /**
     * @dev Голосовать за предложение деактивации
     * @param _proposalId ID предложения
     * @param _support Поддержка предложения
     */
    function voteDeactivation(uint256 _proposalId, bool _support) external nonReentrant {
        DeactivationProposal storage proposal = deactivationProposals[_proposalId];
        require(proposal.id == _proposalId, "Deactivation proposal does not exist");
        require(block.timestamp < proposal.deadline, "Voting ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(balanceOf(msg.sender) > 0, "No tokens to vote");

        uint256 votingPower = balanceOf(msg.sender);
        
        if (_support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }
        
        proposal.hasVoted[msg.sender] = true;

        emit DeactivationProposalVoted(_proposalId, msg.sender, _support, votingPower);
    }

    /**
     * @dev Проверить результат предложения деактивации
     * @param _proposalId ID предложения
     */
    function checkDeactivationProposalResult(uint256 _proposalId) public view returns (bool passed, bool quorumReached) {
        DeactivationProposal storage proposal = deactivationProposals[_proposalId];
        require(proposal.id == _proposalId, "Deactivation proposal does not exist");

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 totalSupply = totalSupply();
        
        quorumReached = totalVotes >= (totalSupply * quorumPercentage) / 100;
        passed = quorumReached && proposal.forVotes > proposal.againstVotes;
        
        return (passed, quorumReached);
    }

    /**
     * @dev Исполнить предложение деактивации
     * @param _proposalId ID предложения
     */
    function executeDeactivationProposal(uint256 _proposalId) external {
        DeactivationProposal storage proposal = deactivationProposals[_proposalId];
        require(proposal.id == _proposalId, "Deactivation proposal does not exist");
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.deadline, "Voting not ended");

        (bool passed, bool quorumReached) = checkDeactivationProposalResult(_proposalId);
        require(quorumReached, "Quorum not reached");
        require(passed, "Proposal not passed");

        proposal.executed = true;
        isDeactivated = true;
        dleInfo.isActive = false;

        emit DeactivationProposalExecuted(_proposalId, msg.sender);
        emit DLEDeactivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Деактивировать DLE напрямую (только при достижении кворума)
     * Может быть вызвана только если есть активное предложение деактивации с достигнутым кворумом
     */
    function deactivate() external {
        require(!isDeactivated, "DLE already deactivated");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to deactivate DLE");

        // Проверяем, есть ли активное предложение деактивации с достигнутым кворумом
        bool hasValidDeactivationProposal = false;
        
        for (uint256 i = 0; i < deactivationProposalCounter; i++) {
            DeactivationProposal storage proposal = deactivationProposals[i];
            if (!proposal.executed && block.timestamp >= proposal.deadline) {
                (bool passed, bool quorumReached) = checkDeactivationProposalResult(i);
                if (quorumReached && passed) {
                    hasValidDeactivationProposal = true;
                    proposal.executed = true;
                    break;
                }
            }
        }

        require(hasValidDeactivationProposal, "No valid deactivation proposal with quorum");

        isDeactivated = true;
        dleInfo.isActive = false;

        emit DLEDeactivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Проверить, деактивирован ли DLE
     */
    function isActive() external view returns (bool) {
        return !isDeactivated && dleInfo.isActive;
    }

    /**
     * @dev Получить информацию о предложении деактивации
     * @param _proposalId ID предложения
     */
    function getDeactivationProposal(uint256 _proposalId) external view returns (
        uint256 id,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        uint256 deadline,
        address initiator,
        uint256 chainId
    ) {
        DeactivationProposal storage proposal = deactivationProposals[_proposalId];
        require(proposal.id == _proposalId, "Deactivation proposal does not exist");
        
        return (
            proposal.id,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.executed,
            proposal.deadline,
            proposal.initiator,
            proposal.chainId
        );
    }
} 