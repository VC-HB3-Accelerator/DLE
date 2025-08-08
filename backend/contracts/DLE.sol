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
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title DLE (Digital Legal Entity)
 * @dev Основной контракт DLE с модульной архитектурой, Single-Chain Governance
 * и безопасной мульти-чейн синхронизацией без сторонних мостов (через подписи холдеров).
 */
contract DLE is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard {
    using ECDSA for bytes32;
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
        bool canceled;
        uint256 deadline;             // конец периода голосования (sec)
        address initiator;
        bytes operation;              // операция для исполнения
        uint256 governanceChainId;    // сеть голосования (Single-Chain Governance)
        uint256[] targetChains;       // целевые сети для исполнения
        uint256 timelock;             // earliest execution timestamp (sec)
        uint256 snapshotTimepoint;    // блок/временная точка для getPastVotes
        mapping(address => bool) hasVoted;
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
    uint256[] public allProposalIds;

    // Мульти-чейн
    mapping(uint256 => bool) public supportedChains;
    uint256[] public supportedChainIds;

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
    event ProposalCancelled(uint256 proposalId, string reason);
    event ProposalTimelockSet(uint256 proposalId, uint256 timelock);
    event ProposalTargetsSet(uint256 proposalId, uint256[] targetChains);
    event ProposalGovernanceChainSet(uint256 proposalId, uint256 governanceChainId);
    event ModuleAdded(bytes32 moduleId, address moduleAddress);
    event ModuleRemoved(bytes32 moduleId);
    event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId);
    event ChainAdded(uint256 chainId);
    event ChainRemoved(uint256 chainId);
    event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp);
    event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage);
    event CurrentChainIdUpdated(uint256 oldChainId, uint256 newChainId);

    // EIP712 typehash для подписи одобрения исполнения предложения в целевой сети
    // ExecutionApproval(uint256 proposalId, bytes32 operationHash, uint256 chainId, uint256 snapshotTimepoint)
    bytes32 private constant EXECUTION_APPROVAL_TYPEHASH = keccak256(
        "ExecutionApproval(uint256 proposalId,bytes32 operationHash,uint256 chainId,uint256 snapshotTimepoint)"
    );

    constructor(
        DLEConfig memory config,
        uint256 _currentChainId
    ) ERC20(config.name, config.symbol) ERC20Permit(config.name) {
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
            address partner = config.initialPartners[i];
            uint256 amount = config.initialAmounts[i];
            require(partner != address(0), "Zero address");
            require(amount > 0, "Zero amount");
            _mint(partner, amount);
            // Авто-делегирование голосов себе, чтобы getPastVotes работал без действия пользователя
            _delegate(partner, partner);
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
        uint256 _governanceChainId,
        uint256[] memory _targetChains,
        uint256 _timelockDelay
    ) external returns (uint256) {
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");
        require(_duration > 0, "Duration must be positive");
        require(supportedChains[_governanceChainId], "Chain not supported");
        require(_timelockDelay <= 365 days, "Timelock too big");

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
        proposal.governanceChainId = _governanceChainId;
        proposal.timelock = block.timestamp + _timelockDelay;
        // Снимок голосов: используем прошлую точку времени, чтобы getPastVotes был валиден в текущем блоке
        uint256 nowClock = clock();
        proposal.snapshotTimepoint = nowClock == 0 ? 0 : nowClock - 1;
        // запись целевых сетей
        for (uint256 i = 0; i < _targetChains.length; i++) {
            require(supportedChains[_targetChains[i]], "Target chain not supported");
            proposal.targetChains.push(_targetChains[i]);
        }

        allProposalIds.push(proposalId);
        emit ProposalCreated(proposalId, msg.sender, _description);
        emit ProposalGovernanceChainSet(proposalId, _governanceChainId);
        emit ProposalTargetsSet(proposalId, _targetChains);
        emit ProposalTimelockSet(proposalId, proposal.timelock);
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
        require(currentChainId == proposal.governanceChainId, "Wrong chain for voting");

        // используем снапшот голосов для защиты от перелива
        uint256 votingPower = getPastVotes(msg.sender, proposal.snapshotTimepoint);
        proposal.hasVoted[msg.sender] = true;

        if (_support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }

        emit ProposalVoted(_proposalId, msg.sender, _support, votingPower);
    }

    // УДАЛЕНО: syncVoteFromChain с MerkleProof — небезопасно без доверенного моста

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
        // Используем снапшот totalSupply на момент начала голосования
        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        uint256 quorumRequired = (pastSupply * quorumPercentage) / 100;
        
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
        require(currentChainId == proposal.governanceChainId, "Execute only in governance chain");

        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        
        // Предложение можно выполнить если:
        // 1. Дедлайн истек ИЛИ кворум достигнут
        require(
            block.timestamp >= proposal.deadline || quorumReached, 
            "Voting not ended and quorum not reached"
        );
        require(passed && quorumReached, "Proposal not passed");
        require(block.timestamp >= proposal.timelock, "Timelock not expired");

        proposal.executed = true;
        
        // Исполняем операцию
        _executeOperation(proposal.operation);
        
        emit ProposalExecuted(_proposalId, proposal.operation);
    }

    /**
     * @dev Отмена предложения до истечения голосования инициатором при наличии достаточной голосующей силы.
     * Это soft-cancel для защиты от явных ошибок. Порог: >= 10% от снапшотного supply.
     */
    function cancelProposal(uint256 _proposalId, string calldata reason) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.id == _proposalId, "Proposal does not exist");
        require(!proposal.executed, "Already executed");
        require(block.timestamp < proposal.deadline, "Voting ended");
        require(msg.sender == proposal.initiator, "Only initiator");
        uint256 vp = getPastVotes(msg.sender, proposal.snapshotTimepoint);
        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        require(vp * 10 >= pastSupply, "Insufficient voting power to cancel");

        proposal.canceled = true;
        emit ProposalCancelled(_proposalId, reason);
    }

    // УДАЛЕНО: syncExecutionFromChain с MerkleProof — небезопасно без доверенного моста

    /**
     * @dev Исполнение предложения в НЕ governance-сети по подписям холдеров на снапшоте.
     * Подходит для target chains. Не требует внешнего моста.
     */
    function executeProposalBySignatures(
        uint256 _proposalId,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant {
    Proposal storage proposal = proposals[_proposalId];
    require(proposal.id == _proposalId, "Proposal does not exist");
        require(!proposal.executed, "Proposal already executed in this chain");
        require(currentChainId != proposal.governanceChainId, "Use executeProposal in governance chain");
        require(_isTargetChain(proposal, currentChainId), "Chain not in targets");
        require(block.timestamp >= proposal.timelock, "Timelock not expired");

        require(signers.length == signatures.length, "Bad signatures");
        bytes32 opHash = keccak256(proposal.operation);
        bytes32 structHash = keccak256(abi.encode(
            EXECUTION_APPROVAL_TYPEHASH,
            _proposalId,
            opHash,
            currentChainId,
            proposal.snapshotTimepoint
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        uint256 votesFor = 0;
        // простая защита от дублей адресов (O(n^2) по малому n)
        for (uint256 i = 0; i < signers.length; i++) {
            address recovered = ECDSA.recover(digest, signatures[i]);
            require(recovered == signers[i], "Bad signature");
            // проверка на дубли
            for (uint256 j = 0; j < i; j++) {
                require(signers[j] != recovered, "Duplicate signer");
            }
            uint256 vp = getPastVotes(recovered, proposal.snapshotTimepoint);
            require(vp > 0, "No voting power at snapshot");
            votesFor += vp;
        }

        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        uint256 quorumRequired = (pastSupply * quorumPercentage) / 100;
        require(votesFor >= quorumRequired, "Quorum not reached by sigs");

        proposal.executed = true;
        _executeOperation(proposal.operation);
        emit ProposalExecuted(_proposalId, proposal.operation);
        emit ProposalExecutionApprovedInChain(_proposalId, currentChainId);
    }

    /**
     * @dev Проверить подключение к цепочке
     * @param _chainId ID цепочки
     * @return isAvailable Доступна ли цепочка
     */
    function checkChainConnection(uint256 _chainId) public view returns (bool isAvailable) {
        // Упрощенная проверка: цепочка объявлена как поддерживаемая
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
        
        // В этой версии без внешнего моста синхронизация выполняется
        // через executeProposalBySignatures в целевых сетях.
        emit SyncCompleted(_proposalId);
    }

    /**
     * @dev Синхронизация в конкретную цепочку
     * @param _proposalId ID предложения
     * @param _chainId ID цепочки
     */
    // УДАЛЕНО: syncToChain — не используется в подпись‑ориентированной схеме

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
    // Управление списком сетей теперь выполняется только через предложения
    function _addSupportedChain(uint256 _chainId) internal {
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
    function _removeSupportedChain(uint256 _chainId) internal {
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
        emit ChainRemoved(_chainId);
    }

    /**
     * @dev Установить Merkle root для цепочки (только для владельцев токенов)
     * @param _chainId ID цепочки
     * @param _merkleRoot Merkle root для цепочки
     */
    // УДАЛЕНО: setChainMerkleRoot — небезопасно отдавать любому холдеру

    /**
     * @dev Получить Merkle root для цепочки
     * @param _chainId ID цепочки
     */
    // УДАЛЕНО: getChainMerkleRoot — устарело

    /**
     * @dev Исполнить операцию
     * @param _operation Операция для исполнения
     */
    function _executeOperation(bytes memory _operation) internal {
        // Декодируем операцию
        (bytes4 selector, bytes memory data) = abi.decode(_operation, (bytes4, bytes));
        
        if (selector == bytes4(keccak256("updateDLEInfo(string,string,string,string,uint256,uint256,string[],uint256)"))) {
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
        } else if (selector == bytes4(keccak256("_addSupportedChain(uint256)"))) {
            (uint256 chainIdToAdd) = abi.decode(data, (uint256));
            _addSupportedChain(chainIdToAdd);
        } else if (selector == bytes4(keccak256("_removeSupportedChain(uint256)"))) {
            (uint256 chainIdToRemove) = abi.decode(data, (uint256));
            _removeSupportedChain(chainIdToRemove);
        } else if (selector == bytes4(keccak256("offchainAction(bytes32,string,bytes32)"))) {
            // Оффчейн операция для приложения: идентификатор, тип, хеш полезной нагрузки
            // (bytes32 actionId, string memory kind, bytes32 payloadHash) = abi.decode(data, (bytes32, string, bytes32));
            // Ончейн-побочных эффектов нет. Факт решения фиксируется событием ProposalExecuted.
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

    // ===== Интерфейс аналитики для API =====
    function getProposalSummary(uint256 _proposalId) external view returns (
        uint256 id,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled,
        uint256 deadline,
        address initiator,
        uint256 governanceChainId,
        uint256 timelock,
        uint256 snapshotTimepoint,
        uint256[] memory targets
    ) {
        Proposal storage p = proposals[_proposalId];
        require(p.id == _proposalId, "Proposal does not exist");
        return (
            p.id,
            p.description,
            p.forVotes,
            p.againstVotes,
            p.executed,
            p.canceled,
            p.deadline,
            p.initiator,
            p.governanceChainId,
            p.timelock,
            p.snapshotTimepoint,
            p.targetChains
        );
    }

    function getGovernanceParams() external view returns (
        uint256 quorumPct,
        uint256 chainId,
        uint256 supportedCount
    ) {
        return (quorumPercentage, currentChainId, supportedChainIds.length);
    }

    function listSupportedChains() external view returns (uint256[] memory) {
        return supportedChainIds;
    }

    function getVotingPowerAt(address voter, uint256 timepoint) external view returns (uint256) {
        return getPastVotes(voter, timepoint);
    }

    // ===== Пагинация и агрегирование =====
    function getProposalsCount() external view returns (uint256) {
        return allProposalIds.length;
    }

    function listProposals(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        uint256 total = allProposalIds.length;
        if (offset >= total) {
            return new uint256[](0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256[] memory page = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = allProposalIds[i];
        }
        return page;
    }

    // 0=Pending, 1=Succeeded, 2=Defeated, 3=Executed, 4=Canceled, 5=ReadyForExecution
    function getProposalState(uint256 _proposalId) public view returns (uint8 state) {
        Proposal storage p = proposals[_proposalId];
        require(p.id == _proposalId, "Proposal does not exist");
        if (p.canceled) return 4;
        if (p.executed) return 3;
        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        bool votingOver = block.timestamp >= p.deadline;
        bool ready = passed && quorumReached && block.timestamp >= p.timelock;
        if (ready) return 5; // ReadyForExecution
        if (passed && (votingOver || quorumReached)) return 1; // Succeeded
        if (votingOver && !passed) return 2; // Defeated
        return 0; // Pending
    }

    function getQuorumAt(uint256 timepoint) external view returns (uint256) {
        uint256 supply = getPastTotalSupply(timepoint);
        return (supply * quorumPercentage) / 100;
    }

    function getProposalVotes(uint256 _proposalId) external view returns (
        uint256 forVotes,
        uint256 againstVotes,
        uint256 totalVotes,
        uint256 quorumRequired
    ) {
        Proposal storage p = proposals[_proposalId];
        require(p.id == _proposalId, "Proposal does not exist");
        uint256 supply = getPastTotalSupply(p.snapshotTimepoint);
        uint256 quorumReq = (supply * quorumPercentage) / 100;
        return (p.forVotes, p.againstVotes, p.forVotes + p.againstVotes, quorumReq);
    }

    // События для новых функций
    event SyncCompleted(uint256 proposalId);
    event DLEDeactivated(address indexed deactivatedBy, uint256 timestamp);

    bool public isDeactivated;

    // Деактивация вынесена в отдельный модуль. См. DeactivationModule.
    function isActive() external view returns (bool) {
        return !isDeactivated && dleInfo.isActive;
    }
    // ===== Вспомогательные функции =====
    function _isTargetChain(Proposal storage p, uint256 chainId) internal view returns (bool) {
        for (uint256 i = 0; i < p.targetChains.length; i++) {
            if (p.targetChains[i] == chainId) return true;
        }
        return false;
    }

    // ===== Overrides для ERC20Votes =====
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    // Разрешаем неоднозначность nonces из базовых классов
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    // Запрет делегирования на третьих лиц: разрешено только делегировать самому себе
    function _delegate(address delegator, address delegatee) internal override {
        require(delegator == delegatee, "Delegation disabled");
        super._delegate(delegator, delegatee);
    }
}
