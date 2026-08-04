// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.
// For licensing inquiries: info@hb3-accelerator.com
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


interface IERC1271 {
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface IMultichainMetadata {
    function getMultichainInfo() external view returns (uint256[] memory supportedChainIds, uint256 defaultVotingChain);
    function getMultichainAddresses() external view returns (uint256[] memory chainIds, address[] memory addresses);
}

/// @dev Модуль объявляет тонкий bridge для governance-вызовов (см. tz-module-bridge).
interface IModuleBridgeSource {
    function moduleBridge() external view returns (address);
}

// DLE (Digital Legal Entity) - основной контракт с модульной архитектурой
contract DLE is ERC20, ERC20Permit, ERC20Votes, ReentrancyGuard, IMultichainMetadata {
    using ECDSA for bytes32;
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

    struct DLEConfig {
        string name;
        string symbol;
        string location;
        string coordinates;
        uint256 jurisdiction;
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
        uint256[] targetChains;       // целевые сети для исполнения
        uint256 snapshotTimepoint;    // блок/временная точка для getPastVotes
        mapping(address => bool) hasVoted;
    }



    // Основные настройки
    DLEInfo public dleInfo;
    uint256 public quorumPercentage;
    uint256 public proposalCounter;
    // Удален currentChainId - теперь используется block.chainid для проверок
    // Публичный URI логотипа токена/организации (можно установить при деплое через инициализатор)
    string public logoURI;

    // Модули
    mapping(bytes32 => address) public modules;
    mapping(bytes32 => bool) public activeModules;
    address public immutable initializer; // Адрес, имеющий право на однократную инициализацию логотипа

    // Предложения
    mapping(uint256 => Proposal) public proposals;
    uint256[] public allProposalIds;

    // Мульти-чейн
    mapping(uint256 => bool) public supportedChains;
    uint256[] public supportedChainIds;
    /// @dev Фактический адрес того же DLE в другой сети (не address(this) наугад).
    mapping(uint256 => address) public peerContracts;
    /// @dev Исполнение предложения в конкретной сети (мультичейн).
    mapping(uint256 => mapping(uint256 => bool)) public proposalExecutedInChain;
    /// @dev Адрес активного модуля → true (для createProposal от модулей).
    mapping(address => bool) public isModuleContract;

    // События
    event DLEInitialized(
        string name,
        string symbol,
        string location,
        string coordinates,
        uint256 jurisdiction,
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
    event ProposalTargetsSet(uint256 proposalId, uint256[] targetChains);
    event ModuleAdded(bytes32 moduleId, address moduleAddress);
    event ModuleRemoved(bytes32 moduleId);
    event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId);
    event PeerContractSet(uint256 indexed chainId, address peer);
    event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp);
    event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage);
    event TokensTransferredByGovernance(address indexed sender, address indexed recipient, uint256 amount);
    event OffchainActionApproved(uint256 indexed proposalId, bytes32 indexed actionId, bytes32 indexed kindHash, bytes32 payloadHash);

    event VotingDurationsUpdated(uint256 oldMinDuration, uint256 newMinDuration, uint256 oldMaxDuration, uint256 newMaxDuration);
    event LogoURIUpdated(string oldURI, string newURI);

    // EIP712 typehash для подписи одобрения исполнения предложения
    bytes32 private constant EXECUTION_APPROVAL_TYPEHASH = keccak256(
        "ExecutionApproval(uint256 proposalId,bytes32 operationHash,uint256 chainId,uint256 snapshotTimepoint)"
    );
    // Custom errors (reduce bytecode size)
    error ErrZeroAddress();
    error ErrArrayMismatch();
    error ErrNoPartners();
    error ErrZeroAmount();
    error ErrOnlyInitializer();
    error ErrLogoAlreadySet();
    error ErrNotHolder();
    error ErrTooShort();
    error ErrTooLong();
    error ErrBadChain();
    error ErrProposalMissing();
    error ErrProposalEnded();
    error ErrProposalExecuted();
    error ErrAlreadyVoted();
    error ErrWrongChain();
    error ErrUnsupportedChain();
    error ErrNoPower();
    error ErrNotReady();
    error ErrNotInitiator();
    error ErrUnauthorized();
    error ErrLowPower();
    error ErrBadTarget();
    error ErrBadSig1271();
    error ErrBadSig();
    error ErrDuplicateSigner();
    error ErrNoSigners();
    error ErrSigLengthMismatch();
    error ErrInvalidOperation();
    error ErrNameEmpty();
    error ErrSymbolEmpty();
    error ErrLocationEmpty();
    error ErrBadJurisdiction();
    error ErrBadKPP();
    error ErrBadQuorum();
    error ErrChainNotSupported();
    error ErrTransfersDisabled();
    error ErrApprovalsDisabled();
    error ErrProposalCanceled();
    error ErrAlreadyExecutedInChain();
    error ErrBadOffchainKind();
    
    // Допустимые kind для offchainAction (хеш keccak256 строки)
    bytes32 private constant OFFCHAIN_KIND_PAYMENT = keccak256("payment");
    bytes32 private constant OFFCHAIN_KIND_NOTE = keccak256("note");
    bytes32 private constant OFFCHAIN_KIND_DOCUMENT = keccak256("document");
    bytes32 private constant OFFCHAIN_KIND_CUSTOM = keccak256("custom");

    // Константы безопасности (можно изменять через governance)
    uint256 public maxVotingDuration = 30 days; // Максимальное время голосования
    uint256 public minVotingDuration = 1 hours; // Минимальное время голосования
    // Удалён буфер ограничения голосования в последние минуты перед дедлайном

    constructor(
        DLEConfig memory config,
        address _initializer
    ) ERC20(config.name, config.symbol) ERC20Permit(config.name) {
        if (_initializer == address(0)) revert ErrZeroAddress();
        initializer = _initializer;
        _validateDLEInfoFields(
            config.name,
            config.symbol,
            config.location,
            config.jurisdiction,
            config.kpp
        );
        if (!(config.quorumPercentage > 0 && config.quorumPercentage <= 100)) revert ErrBadQuorum();

        dleInfo = DLEInfo({
            name: config.name,
            symbol: config.symbol,
            location: config.location,
            coordinates: config.coordinates,
            jurisdiction: config.jurisdiction,
            okvedCodes: config.okvedCodes,
            kpp: config.kpp,
            creationTimestamp: block.timestamp,
            isActive: true
        });
        
        quorumPercentage = config.quorumPercentage;

        // Настраиваем поддерживаемые цепочки
        for (uint256 i = 0; i < config.supportedChainIds.length; i++) {
            supportedChains[config.supportedChainIds[i]] = true;
            supportedChainIds.push(config.supportedChainIds[i]);
        }
        // Текущая сеть: peer = этот контракт
        peerContracts[block.chainid] = address(this);

        // Распределяем начальные токены партнерам
        if (config.initialPartners.length != config.initialAmounts.length) revert ErrArrayMismatch();
        if (config.initialPartners.length == 0) revert ErrNoPartners();
        
        for (uint256 i = 0; i < config.initialPartners.length; i++) {
            address partner = config.initialPartners[i];
            uint256 amount = config.initialAmounts[i];
            if (partner == address(0)) revert ErrZeroAddress();
            if (amount == 0) revert ErrZeroAmount();
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
            config.okvedCodes,
            config.kpp,
            address(this),
            config.supportedChainIds
        );
    }

    // Одноразовая инициализация URI логотипа
    function initializeLogoURI(string calldata _logoURI) external {
        if (msg.sender != initializer) revert ErrOnlyInitializer();
        if (bytes(logoURI).length != 0) revert ErrLogoAlreadySet();
        string memory old = logoURI;
        logoURI = _logoURI;
        emit LogoURIUpdated(old, _logoURI);
    }

    // Создать предложение для multi-chain голосования
    function createProposal(
        string memory _description,
        uint256 _duration,
        bytes memory _operation,
        uint256[] memory _targetChains,
        uint256 /* _timelockDelay */
    ) external returns (uint256) {
        // Держатель долей ИЛИ активный модуль (напр. HierarchicalVotingModule)
        if (balanceOf(msg.sender) == 0 && !isModuleContract[msg.sender]) revert ErrNotHolder();
        if (_duration < minVotingDuration) revert ErrTooShort();
        if (_duration > maxVotingDuration) revert ErrTooLong();
        // _timelockDelay параметр игнорируется; timelock вынесем в отдельный модуль
        return _createProposalInternal(
            _description,
            _duration,
            _operation,
            _targetChains,
            msg.sender
        );
    }

    function _createProposalInternal(
        string memory _description,
        uint256 _duration,
        bytes memory _operation,
        uint256[] memory _targetChains,
        address _initiator
    ) internal returns (uint256) {
        uint256 proposalId = proposalCounter++;
        Proposal storage proposal = proposals[proposalId];

        proposal.id = proposalId;
        proposal.description = _description;
        proposal.forVotes = 0;
        proposal.againstVotes = 0;
        proposal.executed = false;
        proposal.deadline = block.timestamp + _duration;
        proposal.initiator = _initiator;
        proposal.operation = _operation;

        // Снимок голосов: используем прошлую точку времени, чтобы getPastVotes был валиден в текущем блоке
        uint256 nowClock = clock();
        proposal.snapshotTimepoint = nowClock == 0 ? 0 : nowClock - 1;

        // запись целевых сетей
        for (uint256 i = 0; i < _targetChains.length; i++) {
            if (!supportedChains[_targetChains[i]]) revert ErrBadTarget();
            proposal.targetChains.push(_targetChains[i]);
        }

        allProposalIds.push(proposalId);
        emit ProposalCreated(proposalId, _initiator, _description);
        emit ProposalTargetsSet(proposalId, _targetChains);
        return proposalId;
    }

    // Голосовать за предложение
    function vote(uint256 _proposalId, bool _support) external nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();
        if (block.timestamp >= proposal.deadline) revert ErrProposalEnded();
        if (proposal.executed) revert ErrProposalExecuted();
        if (proposal.canceled) revert ErrProposalCanceled();
        if (proposal.hasVoted[msg.sender]) revert ErrAlreadyVoted();
        // Проверяем, что текущая сеть поддерживается
        if (!supportedChains[block.chainid]) revert ErrUnsupportedChain();

        uint256 votingPower = getPastVotes(msg.sender, proposal.snapshotTimepoint);
        if (votingPower == 0) revert ErrNoPower();
        proposal.hasVoted[msg.sender] = true;

        if (_support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }

        emit ProposalVoted(_proposalId, msg.sender, _support, votingPower);
    }

    function checkProposalResult(uint256 _proposalId) public view returns (bool passed, bool quorumReached) {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        // Используем снапшот totalSupply на момент начала голосования
        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        uint256 quorumRequired = (pastSupply * quorumPercentage) / 100;
        
        quorumReached = totalVotes >= quorumRequired;
        passed = quorumReached && proposal.forVotes > proposal.againstVotes;
        
        return (passed, quorumReached);
    }


    function executeProposal(uint256 _proposalId) external nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();
        if (proposal.executed) revert ErrProposalExecuted();
        if (proposal.canceled) revert ErrProposalCanceled();
        if (proposalExecutedInChain[_proposalId][block.chainid]) revert ErrAlreadyExecutedInChain();
        if (!supportedChains[block.chainid]) revert ErrUnsupportedChain();
        if (!_isTargetChain(proposal, block.chainid)) revert ErrBadTarget();

        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);

        // Дедлайн истёк ИЛИ кворум достигнут
        if (!(block.timestamp >= proposal.deadline || quorumReached)) revert ErrNotReady();
        if (!(passed && quorumReached)) revert ErrNotReady();

        // Anti-replay: флаг текущей сети + локально закрыто (без ожидания чужих chainId)
        proposalExecutedInChain[_proposalId][block.chainid] = true;
        proposal.executed = true;

        _executeOperation(_proposalId, proposal.operation);

        emit ProposalExecuted(_proposalId, proposal.operation);
        emit ProposalExecutionApprovedInChain(_proposalId, block.chainid);
    }


    function cancelProposal(uint256 _proposalId, string calldata reason) external {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();
        if (proposal.executed) revert ErrProposalExecuted();
        if (block.timestamp + 900 >= proposal.deadline) revert ErrProposalEnded();
        if (msg.sender != proposal.initiator) revert ErrNotInitiator();
        uint256 vp = getPastVotes(msg.sender, proposal.snapshotTimepoint);
        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        if (vp * 10 < pastSupply) revert ErrLowPower();

        proposal.canceled = true;
        emit ProposalCancelled(_proposalId, reason);
    }

    // УДАЛЕНО: syncExecutionFromChain с MerkleProof — небезопасно без доверенного моста
    function executeProposalBySignatures(
        uint256 _proposalId,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();
        if (proposal.executed) revert ErrProposalExecuted();
        if (proposal.canceled) revert ErrProposalCanceled();
        if (proposalExecutedInChain[_proposalId][block.chainid]) revert ErrAlreadyExecutedInChain();
        // Проверяем, что текущая сеть поддерживается
        if (!supportedChains[block.chainid]) revert ErrUnsupportedChain();
        // Проверяем, что текущая сеть является целевой для предложения
        if (!_isTargetChain(proposal, block.chainid)) revert ErrBadTarget();

        // Как в executeProposal: итог ончейн-голосования обязателен (for > against + кворум)
        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        if (!(block.timestamp >= proposal.deadline || quorumReached)) revert ErrNotReady();
        if (!(passed && quorumReached)) revert ErrNotReady();

        if (signers.length != signatures.length) revert ErrSigLengthMismatch();
        if (signers.length == 0) revert ErrNoSigners();
        
        bytes32 opHash = keccak256(proposal.operation);
        bytes32 structHash = keccak256(abi.encode(
            EXECUTION_APPROVAL_TYPEHASH,
            _proposalId,
            opHash,
            block.chainid,
            proposal.snapshotTimepoint
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        uint256 votesFor = 0;
        
        for (uint256 i = 0; i < signers.length; i++) {
            address signer = signers[i];
            if (signer.code.length > 0) {
                // Контрактный кошелёк: проверяем подпись по EIP-1271
                try IERC1271(signer).isValidSignature(digest, signatures[i]) returns (bytes4 magic) {
                    if (magic != 0x1626ba7e) revert ErrBadSig1271();
                } catch {
                    revert ErrBadSig1271();
                }
            } else {
                // EOA подпись через ECDSA
                address recovered = ECDSA.recover(digest, signatures[i]);
                if (recovered != signer) revert ErrBadSig();
            }

            for (uint256 j = 0; j < i; j++) {
                if (signers[j] == signer) revert ErrDuplicateSigner();
            }

            uint256 vp = getPastVotes(signer, proposal.snapshotTimepoint);
            if (vp == 0) revert ErrNoPower();
            votesFor += vp;
        }

        uint256 pastSupply = getPastTotalSupply(proposal.snapshotTimepoint);
        uint256 quorumRequired = (pastSupply * quorumPercentage) / 100;
        // Подписи = одобрение исполнения в этой сети; порог тот же, что кворум
        if (votesFor < quorumRequired) revert ErrNoPower();

        proposalExecutedInChain[_proposalId][block.chainid] = true;
        proposal.executed = true;

        _executeOperation(_proposalId, proposal.operation);
        emit ProposalExecuted(_proposalId, proposal.operation);
        emit ProposalExecutionApprovedInChain(_proposalId, block.chainid);
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
        if (_index >= supportedChainIds.length) revert ErrBadChain();
        return supportedChainIds[_index];
    }

    /**
     * @dev Исполнить операцию
     * @param _proposalId ID предложения
     * @param _operation Операция для исполнения
     */
    function _executeOperation(uint256 _proposalId, bytes memory _operation) internal {
        if (_operation.length < 4) revert ErrInvalidOperation();

        // Получаем информацию о предложении для доступа к initiator
        Proposal storage proposal = proposals[_proposalId];

        // Декодируем операцию из formата abi.encodeWithSelector
        bytes4 selector;
        bytes memory data;
        
        // Извлекаем селектор (первые 4 байта)
        assembly {
            selector := mload(add(_operation, 0x20))
        }
        
        // Извлекаем данные (все после первых 4 байтов)
        if (_operation.length > 4) {
            data = new bytes(_operation.length - 4);
            for (uint256 i = 0; i < data.length; i++) {
                data[i] = _operation[i + 4];
            }
        } else {
            data = new bytes(0);
        }
        
        if (selector == bytes4(keccak256("_addModule(bytes32,address)"))) {
            // Операция добавления модуля
            (bytes32 moduleId, address moduleAddress) = abi.decode(data, (bytes32, address));
            _addModule(moduleId, moduleAddress);
        } else if (selector == bytes4(keccak256("_removeModule(bytes32)"))) {
            // Операция удаления модуля
            (bytes32 moduleId) = abi.decode(data, (bytes32));
            _removeModule(moduleId);
        } else if (selector == bytes4(keccak256("_transferTokens(address,address,uint256)"))) {
            // Операция перевода токенов через governance от инициатора
            (address sender, address recipient, uint256 amount) = abi.decode(data, (address, address, uint256));
            // Проверяем, что sender совпадает с инициатором предложения
            if (sender != proposal.initiator) revert ErrUnauthorized();
            _transferTokens(sender, recipient, amount);
        } else if (selector == bytes4(keccak256("_updateVotingDurations(uint256,uint256)"))) {
            // Операция обновления времени голосования
            (uint256 newMinDuration, uint256 newMaxDuration) = abi.decode(data, (uint256, uint256));
            _updateVotingDurations(newMinDuration, newMaxDuration);
        } else if (selector == bytes4(keccak256("_setLogoURI(string)"))) {
            // Обновление логотипа через governance
            (string memory newLogo) = abi.decode(data, (string));
            _setLogoURI(newLogo);
        } else if (selector == bytes4(keccak256("_updateQuorumPercentage(uint256)"))) {
            // Операция обновления процента кворума
            (uint256 newQuorumPercentage) = abi.decode(data, (uint256));
            _updateQuorumPercentage(newQuorumPercentage);
        } else if (selector == bytes4(keccak256("_updateDLEInfo(string,string,string,string,uint256,string[],uint256)"))) {
            // Операция обновления информации DLE
            (string memory name, string memory symbol, string memory location, string memory coordinates, uint256 jurisdiction, string[] memory okvedCodes, uint256 kpp) = abi.decode(data, (string, string, string, string, uint256, string[], uint256));
            _updateDLEInfo(name, symbol, location, coordinates, jurisdiction, okvedCodes, kpp);
        } else if (selector == bytes4(keccak256("_setPeerContract(uint256,address)"))) {
            (uint256 peerChainId, address peer) = abi.decode(data, (uint256, address));
            _setPeerContract(peerChainId, peer);
        } else if (selector == bytes4(keccak256("offchainAction(bytes32,string,bytes32)"))) {
            // Оффчейн операция: идентификатор, тип (whitelist), хеш полезной нагрузки
            (bytes32 actionId, string memory kind, bytes32 payloadHash) = abi.decode(data, (bytes32, string, bytes32));
            bytes32 kindHash = keccak256(bytes(kind));
            if (
                kindHash != OFFCHAIN_KIND_PAYMENT
                && kindHash != OFFCHAIN_KIND_NOTE
                && kindHash != OFFCHAIN_KIND_DOCUMENT
                && kindHash != OFFCHAIN_KIND_CUSTOM
            ) revert ErrBadOffchainKind();
            emit OffchainActionApproved(_proposalId, actionId, kindHash, payloadHash);
        } else if (selector == bytes4(keccak256("_callModuleBridge(bytes32,bytes)"))) {
            (bytes32 moduleId, bytes memory callData) = abi.decode(data, (bytes32, bytes));
            _callModuleBridge(moduleId, callData);
        } else {
            revert ErrInvalidOperation();
        }
    }

    /**
     * @dev Обновить информацию DLE
     * @param _name Новое название
     * @param _symbol Новый символ
     * @param _location Новое местонахождение
     * @param _coordinates Новые координаты
     * @param _jurisdiction Новая юрисдикция
     * @param _okvedCodes Новые коды ОКВЭД
     * @param _kpp Новый КПП
     */
    function _updateDLEInfo(
        string memory _name,
        string memory _symbol,
        string memory _location,
        string memory _coordinates,
        uint256 _jurisdiction,
        string[] memory _okvedCodes,
        uint256 _kpp
    ) internal {
        _validateDLEInfoFields(_name, _symbol, _location, _jurisdiction, _kpp);

        dleInfo.name = _name;
        dleInfo.symbol = _symbol;
        dleInfo.location = _location;
        dleInfo.coordinates = _coordinates;
        dleInfo.jurisdiction = _jurisdiction;
        dleInfo.okvedCodes = _okvedCodes;
        dleInfo.kpp = _kpp;

        emit DLEInfoUpdated(_name, _symbol, _location, _coordinates, _jurisdiction, _okvedCodes, _kpp);
    }

    function _validateDLEInfoFields(
        string memory _name,
        string memory _symbol,
        string memory _location,
        uint256 _jurisdiction,
        uint256 _kpp
    ) internal pure {
        if (bytes(_name).length == 0) revert ErrNameEmpty();
        if (bytes(_symbol).length == 0) revert ErrSymbolEmpty();
        if (bytes(_location).length == 0) revert ErrLocationEmpty();
        if (_jurisdiction == 0) revert ErrBadJurisdiction();
        if (_kpp == 0) revert ErrBadKPP();
    }

    function _setPeerContract(uint256 _chainId, address _peer) internal {
        if (!supportedChains[_chainId]) revert ErrChainNotSupported();
        if (_peer == address(0)) revert ErrZeroAddress();
        peerContracts[_chainId] = _peer;
        emit PeerContractSet(_chainId, _peer);
    }

    /**
     * @dev Обновить процент кворума
     * @param _newQuorumPercentage Новый процент кворума
     */
    function _updateQuorumPercentage(uint256 _newQuorumPercentage) internal {
        if (!(_newQuorumPercentage > 0 && _newQuorumPercentage <= 100)) revert ErrBadQuorum();
        
        uint256 oldQuorumPercentage = quorumPercentage;
        quorumPercentage = _newQuorumPercentage;
        
        emit QuorumPercentageUpdated(oldQuorumPercentage, _newQuorumPercentage);
    }


    /**
     * @dev Перевести токены через governance (от имени DLE)
     * @param _recipient Адрес получателя
     * @param _amount Количество токенов для перевода
     */
    function _transferTokens(address _sender, address _recipient, uint256 _amount) internal {
        if (_recipient == address(0)) revert ErrZeroAddress();
        if (_amount == 0) revert ErrZeroAmount();
        require(balanceOf(_sender) >= _amount, "Insufficient token balance");

        // Переводим токены от отправителя к получателю
        _transfer(_sender, _recipient, _amount);

        emit TokensTransferredByGovernance(_sender, _recipient, _amount);
    }

    /**
     * @dev Обновить время голосования (только через governance)
     * @param _newMinDuration Новое минимальное время голосования
     * @param _newMaxDuration Новое максимальное время голосования
     */
    function _updateVotingDurations(uint256 _newMinDuration, uint256 _newMaxDuration) internal {
        if (_newMinDuration == 0) revert ErrTooShort();
        if (!(_newMaxDuration > _newMinDuration)) revert ErrTooLong();
        if (_newMinDuration < 10 minutes) revert ErrTooShort();
        if (_newMaxDuration > 365 days) revert ErrTooLong();
        
        uint256 oldMinDuration = minVotingDuration;
        uint256 oldMaxDuration = maxVotingDuration;
        
        minVotingDuration = _newMinDuration;
        maxVotingDuration = _newMaxDuration;
        
        emit VotingDurationsUpdated(oldMinDuration, _newMinDuration, oldMaxDuration, _newMaxDuration);
    }

    /**
     * @dev Внутреннее обновление URI логотипа (только через governance).
     */
    function _setLogoURI(string memory _logoURI) internal {
        string memory old = logoURI;
        logoURI = _logoURI;
        emit LogoURIUpdated(old, _logoURI);
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
        if (!supportedChains[_chainId]) revert ErrChainNotSupported();
        if (_moduleAddress == address(0)) revert ErrZeroAddress();
        if (activeModules[_moduleId]) revert ErrProposalExecuted();
        if (balanceOf(msg.sender) == 0) revert ErrNotHolder();

        // Операция добавления модуля
        bytes memory operation = abi.encodeWithSelector(
            bytes4(keccak256("_addModule(bytes32,address)")),
            _moduleId,
            _moduleAddress
        );

        // Целевые сети: по умолчанию все поддерживаемые сети
        uint256[] memory targets = new uint256[](supportedChainIds.length);
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            targets[i] = supportedChainIds[i];
        }

        // Таймлок больше не используется в ядре; модуль Timelock будет добавлен отдельно
        return _createProposalInternal(
            _description,
            _duration,
            operation,
            targets,
            msg.sender
        );
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
        if (!supportedChains[_chainId]) revert ErrChainNotSupported();
        if (!activeModules[_moduleId]) revert ErrProposalMissing();
        if (balanceOf(msg.sender) == 0) revert ErrNotHolder();

        // Операция удаления модуля
        bytes memory operation = abi.encodeWithSelector(
            bytes4(keccak256("_removeModule(bytes32)")),
            _moduleId
        );

        // Целевые сети: по умолчанию все поддерживаемые сети
        uint256[] memory targets = new uint256[](supportedChainIds.length);
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            targets[i] = supportedChainIds[i];
        }

        // Таймлок больше не используется в ядре; модуль Timelock будет добавлен отдельно
        return _createProposalInternal(
            _description,
            _duration,
            operation,
            targets,
            msg.sender
        );
    }

    // Money / module ops: тонкий ModuleBridge (адрес = module.moduleBridge())

    /**
     * @dev Вызов только bridge, объявленного самим активным модулем (не произвольный call).
     */
    function _callModuleBridge(bytes32 _moduleId, bytes memory _callData) internal {
        if (!activeModules[_moduleId]) revert ErrProposalMissing();
        address module = modules[_moduleId];
        address bridge = IModuleBridgeSource(module).moduleBridge();
        if (bridge == address(0)) revert ErrZeroAddress();
        if (_callData.length < 4) revert ErrInvalidOperation();
        (bool ok, ) = bridge.call(_callData);
        if (!ok) revert ErrInvalidOperation();
    }

    /**
     * @dev Добавить модуль (внутренняя функция, вызывается через кворум)
     * @param _moduleId ID модуля
     * @param _moduleAddress Адрес модуля
     */
    function _addModule(bytes32 _moduleId, address _moduleAddress) internal {
        if (_moduleAddress == address(0)) revert ErrZeroAddress();
        if (activeModules[_moduleId]) revert ErrProposalExecuted();

        modules[_moduleId] = _moduleAddress;
        activeModules[_moduleId] = true;
        isModuleContract[_moduleAddress] = true;

        emit ModuleAdded(_moduleId, _moduleAddress);
    }

    /**
     * @dev Удалить модуль (внутренняя функция, вызывается через кворум)
     * @param _moduleId ID модуля
     */
    function _removeModule(bytes32 _moduleId) internal {
        if (!activeModules[_moduleId]) revert ErrProposalMissing();

        address moduleAddress = modules[_moduleId];
        delete modules[_moduleId];
        activeModules[_moduleId] = false;
        if (moduleAddress != address(0)) {
            isModuleContract[moduleAddress] = false;
        }

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
     * @dev Получить текущий ID цепочки (теперь используется block.chainid)
     */
    function getCurrentChainId() external view returns (uint256) {
        return block.chainid;
    }

    /**
     * @dev Получить URI логотипа токена (стандартная функция для блокчейн-сканеров)
     * @return URI логотипа или пустую строку если не установлен
     */
    function tokenURI() external view returns (string memory) {
        return logoURI;
    }

    /**
     * @dev Получить информацию о мультичейн развертывании для блокчейн-сканеров
     * @return chains Массив всех поддерживаемых chain ID (все сети равноправны)
     * @return defaultVotingChain ID сети по умолчанию для голосования (может быть любая из поддерживаемых)
     */
    function getMultichainInfo() external view returns (uint256[] memory chains, uint256 defaultVotingChain) {
        return (supportedChainIds, block.chainid);
    }

    /**
     * @dev Получить адреса контракта в других сетях (для мультичейн сканеров)
     * @return chainIds Массив chain ID где развернут контракт
     * @return addresses Массив адресов контракта в соответствующих сетях
     */
    function getMultichainAddresses() external view returns (uint256[] memory chainIds, address[] memory addresses) {
        uint256[] memory chains = new uint256[](supportedChainIds.length);
        address[] memory addrs = new address[](supportedChainIds.length);
        
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            uint256 cid = supportedChainIds[i];
            chains[i] = cid;
            if (cid == block.chainid) {
                addrs[i] = address(this);
            } else {
                // Только фактически зарегистрированный peer; иначе 0 (не врать сканерам)
                addrs[i] = peerContracts[cid];
            }
        }
        
        return (chains, addrs);
    }

    // API функции вынесены в отдельный reader контракт для экономии байт-кода

    // 0=Pending, 1=Succeeded, 2=Defeated, 3=Executed, 4=Canceled, 5=ReadyForExecution
    function getProposalState(uint256 _proposalId) public view returns (uint8 state) {
        Proposal storage p = proposals[_proposalId];
        if (p.id != _proposalId) revert ErrProposalMissing();
        if (p.canceled) return 4;
        if (p.executed) return 3;
        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        if (passed && quorumReached) return 5;
        if (block.timestamp >= p.deadline && !passed) return 2;
        return 0;
    }

    // Функции для подсчёта голосов вынесены в reader контракт

    // Получить полную сводку по предложению
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
        uint256[] memory targetChains
    ) {
        Proposal storage p = proposals[_proposalId];
        if (p.id != _proposalId) revert ErrProposalMissing();

        return (
            p.id,
            p.description,
            p.forVotes,
            p.againstVotes,
            p.executed,
            p.canceled,
            p.deadline,
            p.initiator,
            p.snapshotTimepoint,
            p.targetChains
        );
    }

    /// @dev Число предложений (для Reader / агрегаторов без перебора allProposalIds)
    function getProposalsCount() external view returns (uint256) {
        return allProposalIds.length;
    }

    // Деактивация вынесена в отдельный модуль. См. DeactivationModule.
    function isActive() external view returns (bool) {
        return dleInfo.isActive;
    }
    // ===== Вспомогательные функции =====
    function _isTargetChain(Proposal storage p, uint256 chainId) internal view returns (bool) {
        // Пустой список = исполнение на текущей (любой поддерживаемой) сети
        if (p.targetChains.length == 0) return true;
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

    // Разрешение неоднозначности nonces между ERC20Permit и Nonces
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

    // ===== Блокировка прямых переводов токенов =====
    // Токены DLE могут быть переведены только через governance
    
    /**
     * @dev Блокирует прямые переводы токенов
     * @return Всегда ревертится
     */
    function transfer(address /*to*/, uint256 /*amount*/) public pure override returns (bool) { 
        // coverage:ignore-line
        revert ErrTransfersDisabled(); 
    }

    /**
     * @dev Блокирует прямые переводы токенов через approve/transferFrom
     * @return Всегда ревертится
     */
    function transferFrom(address /*from*/, address /*to*/, uint256 /*amount*/) public pure override returns (bool) { 
        // coverage:ignore-line
        revert ErrTransfersDisabled(); 
    }

    /**
     * @dev Блокирует прямые разрешения на перевод токенов
     * @return Всегда ревертится
     */
    function approve(address /*spender*/, uint256 /*amount*/) public pure override returns (bool) { 
        // coverage:ignore-line
        revert ErrApprovalsDisabled(); 
    }
}
