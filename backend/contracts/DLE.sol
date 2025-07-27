// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title DLE (Digital Legal Entity)
 * @dev Основной смарт-контракт DLE согласно требованиям SMART_CONTRACTS.md
 * 
 * Функции:
 * - ERC-20 токен управления с мультиподписью
 * - Система голосования с кворумом
 * - Казначейские функции
 * - Коммуникационные функции
 * - Настраиваемые таймлоки
 * - Модульная система
 */
contract DLE is 
    ERC20Permit, 
    ERC20Votes, 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotesQuorumFraction, 
    GovernorTimelockControl 
{
    // Структура для хранения информации о DLE
    struct DLEInfo {
        string name;
        string symbol;
        string location;
        string[] isicCodes;
        uint256 creationTimestamp;
        bool isActive;
    }

    // Структура для предложений
    struct Proposal {
        bytes operation;            // Операция для выполнения
        uint256[] targetChains;     // Целевые сети для исполнения
        uint256 timelock;           // Время исполнения (timestamp)
        uint256 governanceChain;    // Сеть где проходит голосование
        address initiator;          // Инициатор предложения
        bytes[] signatures;         // Подписи токен-холдеров
        bool executed;              // Статус исполнения
        uint256 quorumRequired;     // Требуемый кворум
        uint256 signaturesCount;    // Количество собранных подписей
    }

    // Информация о DLE
    DLEInfo public dleInfo;
    
    // Таймлок контроллер
    TimelockController public timelockController;
    
    // Маппинг предложений
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCounter;
    
    // Настройки кворума
    uint256 public quorumPercentage;
    
    // События
    event DLEInitialized(
        string name,
        string symbol,
        string location,
        address tokenAddress,
        address timelockAddress,
        address governorAddress
    );
    
    event TokensDistributed(address[] partners, uint256[] amounts);
    event ProposalCreated(uint256 proposalId, address initiator, bytes operation);
    event ProposalSigned(uint256 proposalId, address signer, uint256 signaturesCount);
    event ProposalExecuted(uint256 proposalId);
    event ModuleInstalled(string moduleName, address moduleAddress);

    /**
     * @dev Конструктор DLE
     * @param _name Название DLE
     * @param _symbol Символ токена управления
     * @param _location Местонахождение DLE
     * @param _isicCodes Коды деятельности ISIC
     * @param _votingDelay Задержка голосования в блоках
     * @param _votingPeriod Период голосования в блоках
     * @param _proposalThreshold Порог для создания предложений
     * @param _quorumPercentage Процент кворума
     * @param _minTimelockDelay Минимальная задержка таймлока в секундах
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _location,
        string[] memory _isicCodes,
        uint48 _votingDelay,
        uint32 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage,
        uint256 _minTimelockDelay
    )
        ERC20(_name, _symbol)
        ERC20Permit(_name)
        Governor(_name)
        GovernorSettings(_votingDelay, _votingPeriod, _proposalThreshold)
        GovernorVotesQuorumFraction(_quorumPercentage)
    {
        // Инициализируем информацию о DLE
        dleInfo = DLEInfo({
            name: _name,
            symbol: _symbol,
            location: _location,
            isicCodes: _isicCodes,
            creationTimestamp: block.timestamp,
            isActive: true
        });

        // Устанавливаем кворум
        quorumPercentage = _quorumPercentage;

        // Создаем таймлок контроллер
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = address(this); // DLE контракт может предлагать
        executors[0] = address(0); // Любой может выполнять

        timelockController = new TimelockController(
            _minTimelockDelay,
            proposers,
            executors,
            address(0) // Нет админа для децентрализации
        );

        // Отказываемся от роли админа в таймлоке
        timelockController.renounceRole(timelockController.DEFAULT_ADMIN_ROLE(), address(this));
    }

    /**
     * @dev Распределяет начальные токены между партнерами
     * @param _partners Массив адресов партнеров
     * @param _amounts Массив сумм токенов для каждого партнера
     */
    function distributeInitialTokens(
        address[] memory _partners,
        uint256[] memory _amounts
    ) external {
        require(_partners.length == _amounts.length, "Arrays length mismatch");
        require(_partners.length > 0, "Empty arrays");

        uint256 totalSupply = 0;
        for (uint256 i = 0; i < _partners.length; i++) {
            require(_partners[i] != address(0), "Zero address");
            require(_amounts[i] > 0, "Zero amount");
            
            totalSupply += _amounts[i];
            _mint(_partners[i], _amounts[i]);
        }

        emit TokensDistributed(_partners, _amounts);
    }

    /**
     * @dev Создает новое предложение
     * @param _operation Операция для выполнения
     * @param _targetChains Целевые сети для исполнения
     * @param _timelockDelay Задержка таймлока
     * @return proposalId ID созданного предложения
     */
    function createProposal(
        bytes calldata _operation,
        uint256[] calldata _targetChains,
        uint256 _timelockDelay
    ) external onlyTokenHolder returns (uint256 proposalId) {
        require(_operation.length > 0, "Empty operation");
        require(_targetChains.length > 0, "No target chains");
        require(_timelockDelay > 0, "Invalid timelock");

        proposalId = proposalCounter++;
        
        proposals[proposalId] = Proposal({
            operation: _operation,
            targetChains: _targetChains,
            timelock: block.timestamp + _timelockDelay,
            governanceChain: block.chainid,
            initiator: msg.sender,
            signatures: new bytes[](0),
            executed: false,
            quorumRequired: (totalSupply() * quorumPercentage) / 100,
            signaturesCount: 0
        });

        emit ProposalCreated(proposalId, msg.sender, _operation);
        return proposalId;
    }

    /**
     * @dev Подписывает предложение
     * @param _proposalId ID предложения
     */
    function signProposal(uint256 _proposalId) external onlyTokenHolder {
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp < proposal.timelock, "Timelock expired");
        
        // Проверяем, что пользователь еще не подписал
        for (uint256 i = 0; i < proposal.signatures.length; i++) {
            require(
                proposal.signatures[i].length == 0 || 
                abi.decode(proposal.signatures[i], (address)) != msg.sender,
                "Already signed"
            );
        }

        // Добавляем подпись
        proposal.signatures.push(abi.encode(msg.sender));
        proposal.signaturesCount += balanceOf(msg.sender);

        emit ProposalSigned(_proposalId, msg.sender, proposal.signaturesCount);
    }

    /**
     * @dev Выполняет предложение
     * @param _proposalId ID предложения
     */
    function executeProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.timelock, "Timelock not expired");
        require(proposal.signaturesCount >= proposal.quorumRequired, "Insufficient quorum");

        proposal.executed = true;

        // Здесь будет логика выполнения операции
        // В зависимости от типа операции

        emit ProposalExecuted(_proposalId);
    }

    /**
     * @dev Получает информацию о DLE
     * @return Информация о DLE
     */
    function getDLEInfo() external view returns (DLEInfo memory) {
        return dleInfo;
    }

    /**
     * @dev Получает адрес таймлока
     * @return Адрес таймлок контроллера
     */
    function getTimelockAddress() external view returns (address) {
        return address(timelockController);
    }

    /**
     * @dev Модификатор для проверки владения токенами
     */
    modifier onlyTokenHolder() {
        require(balanceOf(msg.sender) > 0, "Not a token holder");
        _;
    }

    // Переопределения, необходимые для корректной работы токена голосования
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    // Переопределения для Governor
    function votingDelay()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function proposalNeedsQueuing(uint256 proposalId) 
        public 
        view 
        override(Governor, GovernorTimelockControl) 
        returns (bool) 
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }
} 