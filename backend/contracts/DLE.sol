// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
        uint256 governanceChainId;    // сеть голосования (Single-Chain Governance)
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
    event ProposalGovernanceChainSet(uint256 proposalId, uint256 governanceChainId);
    event ModuleAdded(bytes32 moduleId, address moduleAddress);
    event ModuleRemoved(bytes32 moduleId);
    event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId);
    event ChainAdded(uint256 chainId);
    event ChainRemoved(uint256 chainId);
    event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp);
    event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage);
    event TokensTransferredByGovernance(address indexed recipient, uint256 amount);

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
    error ErrChainAlreadySupported();
    error ErrChainNotSupported();
    error ErrCannotRemoveCurrentChain();
    error ErrTransfersDisabled();
    error ErrApprovalsDisabled();
    error ErrProposalCanceled();
    
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

    // Создать предложение с выбором цепочки для кворума
    function createProposal(
        string memory _description, 
        uint256 _duration,
        bytes memory _operation,
        uint256 _governanceChainId,
        uint256[] memory _targetChains,
        uint256 /* _timelockDelay */
    ) external returns (uint256) {
        if (balanceOf(msg.sender) == 0) revert ErrNotHolder();
        if (_duration < minVotingDuration) revert ErrTooShort();
        if (_duration > maxVotingDuration) revert ErrTooLong();
        if (!supportedChains[_governanceChainId]) revert ErrBadChain();
        // _timelockDelay параметр игнорируется; timelock вынесем в отдельный модуль
        return _createProposalInternal(
            _description,
            _duration,
            _operation,
            _governanceChainId,
            _targetChains,
            msg.sender
        );
    }

    function _createProposalInternal(
        string memory _description,
        uint256 _duration,
        bytes memory _operation,
        uint256 _governanceChainId,
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
        proposal.governanceChainId = _governanceChainId;

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
        emit ProposalGovernanceChainSet(proposalId, _governanceChainId);
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


    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        if (proposal.id != _proposalId) revert ErrProposalMissing();
        if (proposal.executed) revert ErrProposalExecuted();
        if (proposal.canceled) revert ErrProposalCanceled();
        // Проверяем, что текущая сеть поддерживается
        if (!supportedChains[block.chainid]) revert ErrUnsupportedChain();

        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        
        // Предложение можно выполнить если:
        // 1. Дедлайн истек ИЛИ кворум достигнут
        if (!(block.timestamp >= proposal.deadline || quorumReached)) revert ErrNotReady();
        if (!(passed && quorumReached)) revert ErrNotReady();

        proposal.executed = true;
        
        // Исполняем операцию
        _executeOperation(proposal.operation);
        
        emit ProposalExecuted(_proposalId, proposal.operation);
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
        // Проверяем, что текущая сеть поддерживается
        if (!supportedChains[block.chainid]) revert ErrUnsupportedChain();
        // Проверяем, что текущая сеть является целевой для предложения
        if (!_isTargetChain(proposal, block.chainid)) revert ErrBadTarget();

        if (signers.length != signatures.length) revert ErrSigLengthMismatch();
        if (signers.length == 0) revert ErrNoSigners();
        // Все держатели токенов имеют право голосовать
        
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
        if (votesFor < quorumRequired) revert ErrNoPower();

        proposal.executed = true;
        _executeOperation(proposal.operation);
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
        require(_chainId != block.chainid, "Cannot add current chain");
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
        require(_chainId != block.chainid, "Cannot remove current chain");
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
     * @dev Исполнить операцию
     * @param _operation Операция для исполнения
     */
    function _executeOperation(bytes memory _operation) internal {
        if (_operation.length < 4) revert ErrInvalidOperation();
        
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
        } else if (selector == bytes4(keccak256("_addSupportedChain(uint256)"))) {
            (uint256 chainIdToAdd) = abi.decode(data, (uint256));
            _addSupportedChain(chainIdToAdd);
        } else if (selector == bytes4(keccak256("_removeSupportedChain(uint256)"))) {
            (uint256 chainIdToRemove) = abi.decode(data, (uint256));
            _removeSupportedChain(chainIdToRemove);
        } else if (selector == bytes4(keccak256("_transferTokens(address,uint256)"))) {
            // Операция перевода токенов через governance
            (address recipient, uint256 amount) = abi.decode(data, (address, uint256));
            _transferTokens(recipient, amount);
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
        } else if (selector == bytes4(keccak256("offchainAction(bytes32,string,bytes32)"))) {
            // Оффчейн операция для приложения: идентификатор, тип, хеш полезной нагрузки
            // (bytes32 actionId, string memory kind, bytes32 payloadHash) = abi.decode(data, (bytes32, string, bytes32));
            // Ончейн-побочных эффектов нет. Факт решения фиксируется событием ProposalExecuted.
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
        if (bytes(_name).length == 0) revert ErrNameEmpty();
        if (bytes(_symbol).length == 0) revert ErrSymbolEmpty();
        if (bytes(_location).length == 0) revert ErrLocationEmpty();
        if (_jurisdiction == 0) revert ErrBadJurisdiction();
        if (_kpp == 0) revert ErrBadKPP();

        dleInfo.name = _name;
        dleInfo.symbol = _symbol;
        dleInfo.location = _location;
        dleInfo.coordinates = _coordinates;
        dleInfo.jurisdiction = _jurisdiction;
        dleInfo.okvedCodes = _okvedCodes;
        dleInfo.kpp = _kpp;

        emit DLEInfoUpdated(_name, _symbol, _location, _coordinates, _jurisdiction, _okvedCodes, _kpp);
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
    function _transferTokens(address _recipient, uint256 _amount) internal {
        if (_recipient == address(0)) revert ErrZeroAddress();
        if (_amount == 0) revert ErrZeroAmount();
        require(balanceOf(address(this)) >= _amount, "Insufficient DLE balance");
        
        // Переводим токены от имени DLE (address(this))
        _transfer(address(this), _recipient, _amount);
        
        emit TokensTransferredByGovernance(_recipient, _amount);
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
            _chainId,
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
            _chainId,
            targets,
            msg.sender
        );
    }

    // Treasury операции перенесены в TreasuryModule для экономии байт-кода

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

        emit ModuleAdded(_moduleId, _moduleAddress);
    }

    /**
     * @dev Удалить модуль (внутренняя функция, вызывается через кворум)
     * @param _moduleId ID модуля
     */
    function _removeModule(bytes32 _moduleId) internal {
        if (!activeModules[_moduleId]) revert ErrProposalMissing();

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
     * @dev Получить URI логотипа токена (альтернативная функция для блокчейн-сканеров)
     * @return URI логотипа или пустую строку если не установлен
     */
    function logo() external view returns (string memory) {
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
            chains[i] = supportedChainIds[i];
            addrs[i] = address(this); // Детерминированный деплой обеспечивает одинаковые адреса
        }
        
        return (chains, addrs);
    }

    /**
     * @dev Получить мультичейн метаданные в JSON формате для блокчейн-сканеров
     * @return metadata JSON строка с информацией о мультичейн развертывании
     * 
     * Архитектура: Single-Chain Governance - голосование происходит в одной сети,
     * но исполнение может быть в любой из поддерживаемых сетей через подписи.
     */
    function getMultichainMetadata() external view returns (string memory metadata) {
        // Формируем JSON с информацией о мультичейн развертывании
        string memory json = string(abi.encodePacked(
            '{"multichain": {',
            '"supportedChains": ['
        ));
        
        for (uint256 i = 0; i < supportedChainIds.length; i++) {
            if (i > 0) {
                json = string(abi.encodePacked(json, ','));
            }
            json = string(abi.encodePacked(json, _toString(supportedChainIds[i])));
        }
        
        json = string(abi.encodePacked(
            json,
            '],',
            '"defaultVotingChain": ',
            _toString(block.chainid),
            ',',
            '"note": "All chains are equal, voting can happen on any supported chain",',
            '"contractAddress": "',
            _toHexString(address(this)),
            '"',
            '}}'
        ));
        
        return json;
    }

    /**
     * @dev Вспомогательная функция для конвертации uint256 в string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Вспомогательная функция для конвертации address в hex string
     */
    function _toHexString(address addr) internal pure returns (string memory) {
        return _toHexString(abi.encodePacked(addr));
    }

    /**
     * @dev Вспомогательная функция для конвертации bytes в hex string
     */
    function _toHexString(bytes memory data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }


    // API функции вынесены в отдельный reader контракт для экономии байт-кода

    // 0=Pending, 1=Succeeded, 2=Defeated, 3=Executed, 4=Canceled, 5=ReadyForExecution
    function getProposalState(uint256 _proposalId) public view returns (uint8 state) {
        Proposal storage p = proposals[_proposalId];
        require(p.id == _proposalId, "Proposal does not exist");
        if (p.canceled) return 4;
        if (p.executed) return 3;
        (bool passed, bool quorumReached) = checkProposalResult(_proposalId);
        bool votingOver = block.timestamp >= p.deadline;
        bool ready = passed && quorumReached;
        if (ready) return 5; // ReadyForExecution
        if (passed && (votingOver || quorumReached)) return 1; // Succeeded
        if (votingOver && !passed) return 2; // Defeated
        return 0; // Pending
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
        uint256 governanceChainId,
        uint256 snapshotTimepoint,
        uint256[] memory targetChains
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
            p.snapshotTimepoint,
            p.targetChains
        );
    }

    // Деактивация вынесена в отдельный модуль. См. DeactivationModule.
    function isActive() external view returns (bool) {
        return dleInfo.isActive;
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
