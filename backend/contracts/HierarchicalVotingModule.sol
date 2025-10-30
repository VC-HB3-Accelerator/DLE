// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title HierarchicalVotingModule
 * @dev Модуль для иерархического голосования между DLE
 * 
 * ОСНОВНЫЕ ФУНКЦИИ:
 * - Владение токенами других DLE
 * - Создание предложений для голосования в других DLE
 * - Внутреннее голосование для внешнего голосования
 * - Выполнение внешнего голосования после достижения кворума
 * 
 * БЕЗОПАСНОСТЬ:
 * - Только DLE контракт может выполнять операции
 * - Защита от реентерабельности
 * - Валидация всех входных параметров
 * - Проверка прав через governance
 */
contract HierarchicalVotingModule is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    // Структура для внешнего голосования
    struct ExternalVotingProposal {
        address targetDLE;           // Адрес целевого DLE
        uint256 targetProposalId;    // ID предложения в целевом DLE
        bool support;               // Поддержка предложения
        string reason;              // Причина голосования
        bool executed;              // Выполнено ли внешнее голосование
        uint256 internalProposalId; // ID внутреннего предложения в DLE
        uint256 votingPower;        // Сила голоса (количество токенов)
        uint256 createdAt;          // Время создания
    }

    // Структура для информации о внешнем DLE
    struct ExternalDLEInfo {
        address dleAddress;         // Адрес DLE
        string name;               // Название DLE
        string symbol;             // Символ токена DLE
        uint256 tokenBalance;      // Количество токенов на балансе
        bool isActive;            // Активен ли DLE
        uint256 addedAt;          // Время добавления
    }

    // Основные переменные
    address public immutable dleContract;  // Адрес основного DLE контракта
    address public treasuryModule; // Адрес TreasuryModule (может быть установлен позже)
    
    // Хранение внешних DLE
    mapping(address => ExternalDLEInfo) public externalDLEs;
    address[] public externalDLEList;
    mapping(address => uint256) public externalDLEIndex;
    
    // Внешние предложения
    mapping(uint256 => ExternalVotingProposal) public externalVotingProposals;
    uint256 public externalProposalCounter;
    
    // Статистика
    uint256 public totalExternalDLEs;
    uint256 public totalExternalProposals;
    uint256 public totalExternalVotes;

    // События
    event TreasuryModuleSet(address indexed treasuryModule, uint256 timestamp);
    event ExternalDLEAdded(
        address indexed dleAddress,
        string name,
        string symbol,
        uint256 tokenBalance,
        uint256 timestamp
    );
    event ExternalDLERemoved(address indexed dleAddress, uint256 timestamp);
    event ExternalVotingProposalCreated(
        uint256 indexed proposalId,
        address indexed targetDLE,
        uint256 targetProposalId,
        bool support,
        string reason,
        uint256 internalProposalId
    );
    event ExternalVoteExecuted(
        uint256 indexed proposalId,
        address indexed targetDLE,
        uint256 targetProposalId,
        bool support,
        uint256 votingPower
    );
    event ExternalDLEBalanceUpdated(
        address indexed dleAddress,
        uint256 oldBalance,
        uint256 newBalance
    );

    // Модификаторы
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE contract can call this");
        _;
    }

    modifier validExternalDLE(address dleAddress) {
        require(externalDLEs[dleAddress].isActive, "External DLE not active");
        _;
    }

    constructor(address _dleContract) {
        require(_dleContract != address(0), "DLE contract cannot be zero");
        
        dleContract = _dleContract;
        treasuryModule = address(0); // Будет установлен позже через governance
    }

    /**
     * @dev Установить адрес TreasuryModule (только через DLE governance)
     * @param _treasuryModule Адрес TreasuryModule
     */
    function setTreasuryModule(address _treasuryModule) external onlyDLE {
        require(_treasuryModule != address(0), "Treasury module cannot be zero");
        require(_treasuryModule.code.length > 0, "Treasury module contract does not exist");
        
        treasuryModule = _treasuryModule;
        
        emit TreasuryModuleSet(_treasuryModule, block.timestamp);
    }

    /**
     * @dev Добавить внешний DLE (только через DLE governance)
     * @param dleAddress Адрес внешнего DLE
     * @param name Название DLE
     * @param symbol Символ токена DLE
     */
    function addExternalDLE(
        address dleAddress,
        string memory name,
        string memory symbol
    ) external onlyDLE {
        require(dleAddress != address(0), "DLE address cannot be zero");
        require(!externalDLEs[dleAddress].isActive, "External DLE already added");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(treasuryModule != address(0), "Treasury module not set");

        // Проверяем, что DLE контракт существует
        require(dleAddress.code.length > 0, "DLE contract does not exist");

        // Получаем баланс токенов этого DLE в TreasuryModule
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

    /**
     * @dev Удалить внешний DLE (только через DLE governance)
     * @param dleAddress Адрес внешнего DLE
     */
    function removeExternalDLE(address dleAddress) external onlyDLE validExternalDLE(dleAddress) {
        require(externalDLEs[dleAddress].tokenBalance == 0, "Token balance must be zero");

        // Удаляем из массива
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

    /**
     * @dev Создать предложение для внешнего голосования
     * @param targetDLE Адрес целевого DLE
     * @param targetProposalId ID предложения в целевом DLE
     * @param support Поддержка предложения
     * @param reason Причина голосования
     * @return proposalId ID созданного предложения
     */
    function createExternalVotingProposal(
        address targetDLE,
        uint256 targetProposalId,
        bool support,
        string memory reason
    ) external onlyDLE validExternalDLE(targetDLE) returns (uint256) {
        require(targetProposalId > 0, "Target proposal ID must be positive");
        require(bytes(reason).length > 0, "Reason cannot be empty");

        ExternalDLEInfo memory dleInfo = externalDLEs[targetDLE];
        require(dleInfo.tokenBalance > 0, "No tokens in target DLE");

        // Создаем описание для внутреннего предложения
        string memory description = string(abi.encodePacked(
            "Vote in DLE ", dleInfo.name, " (", dleInfo.symbol, ") on proposal #", 
            _toString(targetProposalId), ": ", reason
        ));

        // Создаем внутреннее предложение через DLE
        // Это требует интеграции с DLE контрактом
        uint256 internalProposalId = _createInternalProposal(description);

        uint256 proposalId = externalProposalCounter++;
        externalVotingProposals[proposalId] = ExternalVotingProposal({
            targetDLE: targetDLE,
            targetProposalId: targetProposalId,
            support: support,
            reason: reason,
            executed: false,
            internalProposalId: internalProposalId,
            votingPower: dleInfo.tokenBalance,
            createdAt: block.timestamp
        });

        totalExternalProposals++;

        emit ExternalVotingProposalCreated(
            proposalId,
            targetDLE,
            targetProposalId,
            support,
            reason,
            internalProposalId
        );

        return proposalId;
    }

    /**
     * @dev Выполнить внешнее голосование (после прохождения внутреннего предложения)
     * @param proposalId ID внешнего предложения
     */
    function executeExternalVote(uint256 proposalId) external onlyDLE nonReentrant {
        ExternalVotingProposal storage proposal = externalVotingProposals[proposalId];
        require(proposal.targetDLE != address(0), "Proposal not found");
        require(!proposal.executed, "External vote already executed");

        // Проверяем, что внутреннее предложение прошло
        require(_isInternalProposalPassed(proposal.internalProposalId), "Internal proposal not passed");

        // Выполняем голосование в целевом DLE
        _executeVoteInTargetDLE(proposal.targetDLE, proposal.targetProposalId, proposal.support);

        proposal.executed = true;
        totalExternalVotes++;

        emit ExternalVoteExecuted(
            proposalId,
            proposal.targetDLE,
            proposal.targetProposalId,
            proposal.support,
            proposal.votingPower
        );
    }

    /**
     * @dev Обновить баланс токенов внешнего DLE
     * @param dleAddress Адрес внешнего DLE
     */
    function updateExternalDLEBalance(address dleAddress) external onlyDLE validExternalDLE(dleAddress) {
        uint256 oldBalance = externalDLEs[dleAddress].tokenBalance;
        uint256 newBalance = IERC20(dleAddress).balanceOf(treasuryModule);
        
        externalDLEs[dleAddress].tokenBalance = newBalance;
        
        emit ExternalDLEBalanceUpdated(dleAddress, oldBalance, newBalance);
    }

    /**
     * @dev Обновить балансы всех внешних DLE
     */
    function updateAllExternalDLEBalances() external onlyDLE {
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

    // ===== VIEW ФУНКЦИИ =====

    /**
     * @dev Получить информацию о внешнем DLE
     */
    function getExternalDLEInfo(address dleAddress) external view returns (ExternalDLEInfo memory) {
        return externalDLEs[dleAddress];
    }

    /**
     * @dev Получить список всех внешних DLE
     */
    function getAllExternalDLEs() external view returns (address[] memory) {
        return externalDLEList;
    }

    /**
     * @dev Получить активные внешние DLE
     */
    function getActiveExternalDLEs() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < externalDLEList.length; i++) {
            if (externalDLEs[externalDLEList[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeDLEs = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < externalDLEList.length; i++) {
            if (externalDLEs[externalDLEList[i]].isActive) {
                activeDLEs[index] = externalDLEList[i];
                index++;
            }
        }

        return activeDLEs;
    }

    /**
     * @dev Получить информацию о внешнем предложении
     */
    function getExternalVotingProposal(uint256 proposalId) external view returns (ExternalVotingProposal memory) {
        return externalVotingProposals[proposalId];
    }

    /**
     * @dev Получить статистику модуля
     */
    function getModuleStats() external view returns (
        uint256 totalDLEs,
        uint256 totalProposals,
        uint256 totalVotes,
        uint256 activeDLEs
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < externalDLEList.length; i++) {
            if (externalDLEs[externalDLEList[i]].isActive) {
                activeCount++;
            }
        }

        return (
            totalExternalDLEs,
            totalExternalProposals,
            totalExternalVotes,
            activeCount
        );
    }

    // ===== ВНУТРЕННИЕ ФУНКЦИИ =====

    /**
     * @dev Создать внутреннее предложение в DLE
     * @param description Описание предложения
     * @return proposalId ID созданного предложения
     */
    function _createInternalProposal(string memory description) internal returns (uint256) {
        // Создаем предложение через стандартный интерфейс DLE
        (bool success, bytes memory data) = dleContract.call(
            abi.encodeWithSignature(
                "createProposal(string,uint256,bytes,uint256,uint256[],uint256)",
                description,
                7 days, // 7 дней голосования
                "", // Пустая операция
                block.chainid, // Текущая сеть
                new uint256[](0), // Пустой массив целевых цепочек
                0 // Без timelock
            )
        );
        
        require(success, "Failed to create internal proposal");
        return abi.decode(data, (uint256));
    }

    /**
     * @dev Проверить, прошло ли внутреннее предложение
     * @param proposalId ID внутреннего предложения
     * @return passed Прошло ли предложение
     */
    function _isInternalProposalPassed(uint256 proposalId) internal view returns (bool) {
        (bool success, bytes memory data) = dleContract.staticcall(
            abi.encodeWithSignature("checkProposalResult(uint256)", proposalId)
        );
        
        if (!success) return false;
        (bool passed, bool quorumReached) = abi.decode(data, (bool, bool));
        return passed && quorumReached;
    }

    /**
     * @dev Выполнить голосование в целевом DLE
     * @param targetDLE Адрес целевого DLE
     * @param proposalId ID предложения
     * @param support Поддержка предложения
     */
    function _executeVoteInTargetDLE(
        address targetDLE,
        uint256 proposalId,
        bool support
    ) internal {
        // Выполняем голосование напрямую в целевом DLE
        // Это требует, чтобы целевой DLE имел функцию vote
        (bool success, ) = targetDLE.call(
            abi.encodeWithSignature("vote(uint256,bool)", proposalId, support)
        );
        
        require(success, "Failed to execute vote in target DLE");
    }

    /**
     * @dev Конвертировать uint256 в string
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
}
