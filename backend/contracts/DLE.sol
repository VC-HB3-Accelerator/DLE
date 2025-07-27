// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title DLE (Digital Legal Entity)
 * @dev Основной контракт DLE с отдельным модулем TimelockController.
 */
contract DLE is 
    ERC20Votes, 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotesQuorumFraction, 
    GovernorTimelockControl 
{
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
        uint48 votingDelay;
        uint32 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercentage;
        address[] initialPartners;
        uint256[] initialAmounts;
    }

    struct Proposal {
        bytes operation;
        uint256[] targetChains;
        uint256 timelock;
        uint256 governanceChain;
        address initiator;
        bytes[] signatures;
        bool executed;
        uint256 quorumRequired;
        uint256 signaturesCount;
    }

    struct TokenDistributionProposal {
        address[] partners;
        uint256[] amounts;
        uint256 timelock;
        address initiator;
        bytes[] signatures;
        bool executed;
        uint256 quorumRequired;
        uint256 signaturesCount;
        string description;
    }

    struct TreasuryProposal {
        address recipient;
        uint256 amount;
        uint256 timelock;
        address initiator;
        bytes[] signatures;
        bool executed;
        uint256 quorumRequired;
        uint256 signaturesCount;
        string description;
    }

    DLEInfo public dleInfo;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => TokenDistributionProposal) public tokenDistributionProposals;
    mapping(uint256 => TreasuryProposal) public treasuryProposals;
    uint256 public proposalCounter;
    uint256 public tokenDistributionProposalCounter;
    uint256 public treasuryProposalCounter;
    uint256 public quorumPercentage;
    bool public initialTokensDistributed = false;

    // Казначейские функции
    mapping(address => uint256) public lastWithdrawalBlock; // Последний блок вывода для каждого адреса
    uint256 public totalTreasuryBalance; // Общий баланс казны

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
        address timelockAddress,
        address governorAddress
    );
    event InitialTokensDistributed(address[] partners, uint256[] amounts);
    event TokensDepositedToTreasury(address depositor, uint256 amount);
    event TreasuryProposalCreated(uint256 proposalId, address initiator, address recipient, uint256 amount, string description);
    event TreasuryProposalSigned(uint256 proposalId, address signer, uint256 signaturesCount);
    event TreasuryProposalExecuted(uint256 proposalId, address recipient, uint256 amount);
    event TokenDistributionProposalCreated(uint256 proposalId, address initiator, address[] partners, uint256[] amounts, string description);
    event TokenDistributionProposalSigned(uint256 proposalId, address signer, uint256 signaturesCount);
    event TokenDistributionProposalExecuted(uint256 proposalId, address[] partners, uint256[] amounts);
    event ProposalCreated(uint256 proposalId, address initiator, bytes operation);
    event ProposalSigned(uint256 proposalId, address signer, uint256 signaturesCount);
    event ModuleInstalled(string moduleName, address moduleAddress);

    constructor(
        DLEConfig memory config,
        address timelockAddress
    )
        ERC20(config.name, config.symbol)
        Governor(config.name)
        GovernorSettings(config.votingDelay, config.votingPeriod, config.proposalThreshold)
        GovernorVotesQuorumFraction(config.quorumPercentage)
        GovernorTimelockControl(TimelockController(payable(timelockAddress)))
        GovernorVotes(IVotes(address(this)))
    {
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

        // Автоматически распределяем начальные токены партнерам при деплое
        require(config.initialPartners.length == config.initialAmounts.length, "Arrays length mismatch");
        require(config.initialPartners.length > 0, "No initial partners");
        
        for (uint256 i = 0; i < config.initialPartners.length; i++) {
            require(config.initialPartners[i] != address(0), "Zero address");
            require(config.initialAmounts[i] > 0, "Zero amount");
            _mint(config.initialPartners[i], config.initialAmounts[i]);
        }
        
        initialTokensDistributed = true;
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
            timelockAddress,
            address(this)
        );
    }

    /**
     * @dev Создать предложение на распределение токенов
     * @param _partners Массив адресов партнеров
     * @param _amounts Массив сумм токенов для каждого партнера
     * @param _timelock Время исполнения (timestamp)
     * @param _description Описание предложения
     */
    function createTokenDistributionProposal(
        address[] memory _partners,
        uint256[] memory _amounts,
        uint256 _timelock,
        string memory _description
    ) external returns (uint256) {
        require(_partners.length == _amounts.length, "Arrays length mismatch");
        require(_partners.length > 0, "Empty arrays");
        require(_timelock > block.timestamp, "Invalid timelock");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");

        uint256 proposalId = tokenDistributionProposalCounter++;
        
        tokenDistributionProposals[proposalId] = TokenDistributionProposal({
            partners: _partners,
            amounts: _amounts,
            timelock: _timelock,
            initiator: msg.sender,
            signatures: new bytes[](0),
            executed: false,
            quorumRequired: (totalSupply() * quorumPercentage) / 100,
            signaturesCount: 0,
            description: _description
        });

        emit TokenDistributionProposalCreated(proposalId, msg.sender, _partners, _amounts, _description);
        return proposalId;
    }

    /**
     * @dev Подписать предложение на распределение токенов
     * @param _proposalId ID предложения
     */
    function signTokenDistributionProposal(uint256 _proposalId) external {
        TokenDistributionProposal storage proposal = tokenDistributionProposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp < proposal.timelock, "Proposal expired");
        require(balanceOf(msg.sender) > 0, "No tokens to sign");

        // Проверяем, что пользователь еще не подписал
        for (uint256 i = 0; i < proposal.signatures.length; i++) {
            require(
                proposal.signatures[i].length == 0 || 
                abi.decode(proposal.signatures[i], (address)) != msg.sender,
                "Already signed"
            );
        }

        proposal.signatures.push(abi.encodePacked(msg.sender));
        proposal.signaturesCount++;

        emit TokenDistributionProposalSigned(_proposalId, msg.sender, proposal.signaturesCount);

        // Проверяем, достигнут ли кворум
        if (proposal.signaturesCount >= proposal.quorumRequired) {
            proposal.executed = true;
            _executeTokenDistribution(_proposalId);
        }
    }

    /**
     * @dev Выполнить распределение токенов после достижения кворума
     * @param _proposalId ID предложения
     */
    function _executeTokenDistribution(uint256 _proposalId) internal {
        TokenDistributionProposal storage proposal = tokenDistributionProposals[_proposalId];
        require(proposal.executed, "Proposal not executed");
        require(proposal.signaturesCount >= proposal.quorumRequired, "Insufficient quorum");

        for (uint256 i = 0; i < proposal.partners.length; i++) {
            require(proposal.partners[i] != address(0), "Zero address");
            require(proposal.amounts[i] > 0, "Zero amount");
            _mint(proposal.partners[i], proposal.amounts[i]);
        }

        emit TokenDistributionProposalExecuted(_proposalId, proposal.partners, proposal.amounts);
    }

    /**
     * @dev Выполнить предложение на распределение токенов после истечения таймлока
     * @param _proposalId ID предложения
     */
    function executeTokenDistributionProposal(uint256 _proposalId) external {
        TokenDistributionProposal storage proposal = tokenDistributionProposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.timelock, "Timelock not expired");
        require(proposal.signaturesCount >= proposal.quorumRequired, "Insufficient quorum");

        proposal.executed = true;
        _executeTokenDistribution(_proposalId);
    }

    function createProposal(
        bytes memory _operation,
        uint256[] memory _targetChains,
        uint256 _timelock,
        uint256 _governanceChain
    ) external returns (uint256) {
        require(_operation.length > 0, "Empty operation");
        require(_targetChains.length > 0, "Empty target chains");
        require(_timelock > block.timestamp, "Invalid timelock");
        uint256 proposalId = proposalCounter++;
        proposals[proposalId] = Proposal({
            operation: _operation,
            targetChains: _targetChains,
            timelock: _timelock,
            governanceChain: _governanceChain,
            initiator: msg.sender,
            signatures: new bytes[](0),
            executed: false,
            quorumRequired: (totalSupply() * quorumPercentage) / 100,
            signaturesCount: 0
        });
        emit ProposalCreated(proposalId, msg.sender, _operation);
        return proposalId;
    }

    function signProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp < proposal.timelock, "Proposal expired");
        require(balanceOf(msg.sender) > 0, "No tokens to sign");
        proposal.signatures.push(abi.encodePacked(msg.sender));
        proposal.signaturesCount++;
        emit ProposalSigned(_proposalId, msg.sender, proposal.signaturesCount);
        if (proposal.signaturesCount >= proposal.quorumRequired) {
            proposal.executed = true;
            emit IGovernor.ProposalExecuted(_proposalId);
        }
    }

    function installModule(string memory _moduleName, address _moduleAddress) external {
        emit ModuleInstalled(_moduleName, _moduleAddress);
    }

    /**
     * @dev Внести токены в казну DLE
     * @param _amount Количество токенов для внесения
     */
    function depositToTreasury(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= _amount, "Insufficient balance");
        
        _transfer(msg.sender, address(this), _amount);
        totalTreasuryBalance += _amount;
        
        emit TokensDepositedToTreasury(msg.sender, _amount);
    }

    /**
     * @dev Создать предложение на вывод средств из казны
     * @param _recipient Адрес получателя
     * @param _amount Количество токенов для вывода
     * @param _timelock Время исполнения (timestamp)
     * @param _description Описание предложения
     */
    function createTreasuryProposal(
        address _recipient,
        uint256 _amount,
        uint256 _timelock,
        string memory _description
    ) external returns (uint256) {
        require(_recipient != address(0), "Zero address");
        require(_amount > 0, "Amount must be greater than 0");
        require(_amount <= totalTreasuryBalance, "Insufficient treasury balance");
        require(_timelock > block.timestamp, "Invalid timelock");
        require(balanceOf(msg.sender) > 0, "Must hold tokens to create proposal");

        uint256 proposalId = treasuryProposalCounter++;
        
        treasuryProposals[proposalId] = TreasuryProposal({
            recipient: _recipient,
            amount: _amount,
            timelock: _timelock,
            initiator: msg.sender,
            signatures: new bytes[](0),
            executed: false,
            quorumRequired: (totalSupply() * quorumPercentage) / 100,
            signaturesCount: 0,
            description: _description
        });

        emit TreasuryProposalCreated(proposalId, msg.sender, _recipient, _amount, _description);
        return proposalId;
    }

    /**
     * @dev Подписать предложение на вывод средств из казны
     * @param _proposalId ID предложения
     */
    function signTreasuryProposal(uint256 _proposalId) external {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp < proposal.timelock, "Proposal expired");
        require(balanceOf(msg.sender) > 0, "No tokens to sign");

        // Проверяем, что пользователь еще не подписал
        for (uint256 i = 0; i < proposal.signatures.length; i++) {
            require(
                proposal.signatures[i].length == 0 || 
                abi.decode(proposal.signatures[i], (address)) != msg.sender,
                "Already signed"
            );
        }

        proposal.signatures.push(abi.encodePacked(msg.sender));
        proposal.signaturesCount++;

        emit TreasuryProposalSigned(_proposalId, msg.sender, proposal.signaturesCount);

        // Проверяем, достигнут ли кворум
        if (proposal.signaturesCount >= proposal.quorumRequired) {
            proposal.executed = true;
            _executeTreasuryProposal(_proposalId);
        }
    }

    /**
     * @dev Выполнить предложение на вывод средств из казны
     * @param _proposalId ID предложения
     */
    function _executeTreasuryProposal(uint256 _proposalId) internal {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(proposal.executed, "Proposal not executed");
        require(proposal.signaturesCount >= proposal.quorumRequired, "Insufficient quorum");
        require(proposal.amount <= totalTreasuryBalance, "Insufficient treasury balance");

        totalTreasuryBalance -= proposal.amount;
        _transfer(address(this), proposal.recipient, proposal.amount);

        emit TreasuryProposalExecuted(_proposalId, proposal.recipient, proposal.amount);
    }

    /**
     * @dev Выполнить предложение на вывод средств после истечения таймлока
     * @param _proposalId ID предложения
     */
    function executeTreasuryProposal(uint256 _proposalId) external {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp >= proposal.timelock, "Timelock not expired");
        require(proposal.signaturesCount >= proposal.quorumRequired, "Insufficient quorum");

        proposal.executed = true;
        _executeTreasuryProposal(_proposalId);
    }



    /**
     * @dev Получить доступную для вывода сумму для адреса (пропорционально доле)
     * @param _address Адрес для проверки
     * @return Доступная сумма для вывода
     */
    function getAvailableWithdrawal(address _address) public view returns (uint256) {
        uint256 userBalance = balanceOf(_address);
        if (userBalance == 0 || totalTreasuryBalance == 0) {
            return 0;
        }
        
        // Пропорционально доле в общем количестве токенов
        uint256 userShare = (userBalance * totalTreasuryBalance) / totalSupply();
        return userShare;
    }



    // Переопределения для совместимости с ERC-6372
    function CLOCK_MODE() public pure override(Governor, GovernorVotes, Votes) returns (string memory) {
        return "mode=blocknumber&from=default";
    }
    function clock() public view override(Governor, GovernorVotes, Votes) returns (uint48) {
        return uint48(block.number);
    }
    function _update(address from, address to, uint256 amount) internal override(ERC20Votes) {
        super._update(from, to, amount);
    }
    function nonces(address owner) public view override(Nonces) returns (uint256) {
        return super.nonces(owner);
    }
    function name() public view override(ERC20, Governor) returns (string memory) {
        return super.name();
    }
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }
    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
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
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
    function supportsInterface(bytes4 interfaceId) public view override(Governor) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
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