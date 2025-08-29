// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
// All rights reserved.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TimelockModule
 * @dev Модуль временной задержки для критических операций DLE
 * 
 * НАЗНАЧЕНИЕ:
 * - Добавляет обязательную задержку между принятием и исполнением решений
 * - Даёт время сообществу на обнаружение и отмену вредоносных предложений
 * - Повышает безопасность критических операций (смена кворума, добавление модулей)
 * 
 * ПРИНЦИП РАБОТЫ:
 * 1. DLE исполняет операцию не напрямую, а через Timelock
 * 2. Timelock ставит операцию в очередь с задержкой
 * 3. После истечения задержки любой может исполнить операцию
 * 4. В период задержки операцию можно отменить через экстренное голосование
 */
contract TimelockModule is ReentrancyGuard {
    
    // Структура отложенной операции
    struct QueuedOperation {
        bytes32 id;                 // Уникальный ID операции
        address target;             // Целевой контракт (обычно DLE)
        bytes data;                 // Данные для вызова
        uint256 executeAfter;       // Время, после которого можно исполнить
        uint256 queuedAt;          // Время постановки в очередь
        bool executed;             // Исполнена ли операция
        bool cancelled;            // Отменена ли операция
        address proposer;          // Кто поставил в очередь
        string description;        // Описание операции
        uint256 delay;             // Задержка для этой операции
    }
    
    // Основные настройки
    address public immutable dleContract;      // Адрес DLE контракта
    uint256 public defaultDelay = 2 days;      // Стандартная задержка
    uint256 public emergencyDelay = 30 minutes; // Экстренная задержка
    uint256 public maxDelay = 30 days;         // Максимальная задержка
    uint256 public minDelay = 1 hours;         // Минимальная задержка
    
    // Хранение операций
    mapping(bytes32 => QueuedOperation) public queuedOperations;
    bytes32[] public operationQueue;           // Список всех операций
    mapping(bytes32 => uint256) public operationIndex; // ID => индекс в очереди
    
    // Категории операций с разными задержками
    mapping(bytes4 => uint256) public operationDelays;    // selector => delay
    mapping(bytes4 => bool) public criticalOperations;    // критические операции
    mapping(bytes4 => bool) public emergencyOperations;   // экстренные операции
    
    // Статистика
    uint256 public totalOperations;
    uint256 public executedOperations;  
    uint256 public cancelledOperations;
    
    // События
    event OperationQueued(
        bytes32 indexed operationId,
        address indexed target,
        bytes data,
        uint256 executeAfter,
        uint256 delay,
        string description
    );
    event OperationExecuted(bytes32 indexed operationId, address indexed executor);
    event OperationCancelled(bytes32 indexed operationId, address indexed canceller, string reason);
    event DelayUpdated(bytes4 indexed selector, uint256 oldDelay, uint256 newDelay);
    event DefaultDelayUpdated(uint256 oldDelay, uint256 newDelay);
    event EmergencyExecution(bytes32 indexed operationId, string reason);
    
    // Модификаторы
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE can call");
        _;
    }
    
    modifier validOperation(bytes32 operationId) {
        require(queuedOperations[operationId].id == operationId, "Operation not found");
        require(!queuedOperations[operationId].executed, "Already executed");
        require(!queuedOperations[operationId].cancelled, "Operation cancelled");
        _;
    }
    
    constructor(address _dleContract) {
        require(_dleContract != address(0), "DLE contract cannot be zero");
        require(_dleContract.code.length > 0, "DLE contract must exist");
        
        dleContract = _dleContract;
        totalOperations = 0;
        
        // Настраиваем задержки для разных типов операций
        _setupOperationDelays();
    }
    
    /**
     * @dev Поставить операцию в очередь (вызывается из DLE)
     * @param target Целевой контракт
     * @param data Данные операции
     * @param description Описание операции
     */
    function queueOperation(
        address target,
        bytes memory data,
        string memory description
    ) external onlyDLE returns (bytes32) {
        require(target != address(0), "Target cannot be zero");
        require(data.length >= 4, "Invalid operation data");
        
        // Определяем задержку для операции
        bytes4 selector;
        assembly {
            selector := mload(add(data, 0x20))
        }
        uint256 delay = _getOperationDelay(selector);
        
        // Создаём уникальный ID операции
        bytes32 operationId = keccak256(abi.encodePacked(
            target,
            data,
            block.timestamp,
            totalOperations
        ));
        
        // Проверяем что операция ещё не существует
        require(queuedOperations[operationId].id == bytes32(0), "Operation already exists");
        
        // Создаём операцию
        queuedOperations[operationId] = QueuedOperation({
            id: operationId,
            target: target,
            data: data,
            executeAfter: block.timestamp + delay,
            queuedAt: block.timestamp,
            executed: false,
            cancelled: false,
            proposer: msg.sender, // Адрес вызывающего (обычно DLE контракт)
            description: description,
            delay: delay
        });
        
        // Добавляем в очередь
        operationQueue.push(operationId);
        operationIndex[operationId] = operationQueue.length - 1;
        totalOperations++;
        
        emit OperationQueued(operationId, target, data, block.timestamp + delay, delay, description);
        
        return operationId;
    }
    
    /**
     * @dev Исполнить операцию после истечения задержки (может любой)
     * @param operationId ID операции
     */
    function executeOperation(bytes32 operationId) external nonReentrant validOperation(operationId) {
        QueuedOperation storage operation = queuedOperations[operationId];
        
        require(block.timestamp >= operation.executeAfter, "Timelock not expired");
        require(block.timestamp <= operation.executeAfter + 7 days, "Operation expired"); // Операции истекают через неделю
        
        operation.executed = true;
        executedOperations++;
        
        // Исполняем операцию
        (bool success, bytes memory result) = operation.target.call(operation.data);
        require(success, string(abi.encodePacked("Execution failed: ", result)));
        
        emit OperationExecuted(operationId, msg.sender);
    }
    
    /**
     * @dev Отменить операцию (только через DLE governance)
     * @param operationId ID операции
     * @param reason Причина отмены
     */
    function cancelOperation(
        bytes32 operationId, 
        string memory reason
    ) external onlyDLE validOperation(operationId) {
        QueuedOperation storage operation = queuedOperations[operationId];
        
        operation.cancelled = true;
        cancelledOperations++;
        
        emit OperationCancelled(operationId, msg.sender, reason);
    }
    
    /**
     * @dev Экстренное исполнение без задержки (только для критических ситуаций)
     * @param operationId ID операции
     * @param reason Причина экстренного исполнения
     */
    function emergencyExecute(
        bytes32 operationId,
        string memory reason
    ) external onlyDLE nonReentrant validOperation(operationId) {
        QueuedOperation storage operation = queuedOperations[operationId];
        
        // Проверяем что операция помечена как экстренная
        bytes memory opData = operation.data;
        bytes4 selector;
        assembly {
            selector := mload(add(opData, 0x20))
        }
        require(emergencyOperations[selector], "Not emergency operation");
        
        operation.executed = true;
        executedOperations++;
        
        // Исполняем операцию
        (bool success, bytes memory result) = operation.target.call(operation.data);
        require(success, string(abi.encodePacked("Emergency execution failed: ", result)));
        
        emit OperationExecuted(operationId, msg.sender);
        emit EmergencyExecution(operationId, reason);
    }
    
    /**
     * @dev Обновить задержку для типа операции (только через governance)
     * @param selector Селектор функции
     * @param newDelay Новая задержка
     * @param isCritical Является ли операция критической
     * @param isEmergency Может ли исполняться экстренно
     */
    function updateOperationDelay(
        bytes4 selector,
        uint256 newDelay,
        bool isCritical,
        bool isEmergency
    ) external onlyDLE {
        require(newDelay >= minDelay, "Delay too short");
        require(newDelay <= maxDelay, "Delay too long");
        
        uint256 oldDelay = operationDelays[selector];
        operationDelays[selector] = newDelay;
        criticalOperations[selector] = isCritical;
        emergencyOperations[selector] = isEmergency;
        
        emit DelayUpdated(selector, oldDelay, newDelay);
    }
    
    /**
     * @dev Обновить стандартную задержку (только через governance)
     * @param newDelay Новая стандартная задержка
     */
    function updateDefaultDelay(uint256 newDelay) external onlyDLE {
        require(newDelay >= minDelay, "Delay too short");
        require(newDelay <= maxDelay, "Delay too long");
        
        uint256 oldDelay = defaultDelay;
        defaultDelay = newDelay;
        
        emit DefaultDelayUpdated(oldDelay, newDelay);
    }
    
    // ===== VIEW ФУНКЦИИ =====
    
    /**
     * @dev Получить информацию об операции
     */
    function getOperation(bytes32 operationId) external view returns (QueuedOperation memory) {
        return queuedOperations[operationId];
    }
    
    /**
     * @dev Проверить, готова ли операция к исполнению
     */
    function isReady(bytes32 operationId) external view returns (bool) {
        QueuedOperation storage operation = queuedOperations[operationId];
        return operation.id != bytes32(0) && 
               !operation.executed && 
               !operation.cancelled &&
               block.timestamp >= operation.executeAfter;
    }
    
    /**
     * @dev Получить время до исполнения операции
     */
    function getTimeToExecution(bytes32 operationId) external view returns (uint256) {
        QueuedOperation storage operation = queuedOperations[operationId];
        if (operation.executeAfter <= block.timestamp) {
            return 0;
        }
        return operation.executeAfter - block.timestamp;
    }
    
    /**
     * @dev Получить список активных операций
     */
    function getActiveOperations() external view returns (bytes32[] memory) {
        uint256 activeCount = 0;
        
        // Считаем активные операции
        for (uint256 i = 0; i < operationQueue.length; i++) {
            QueuedOperation storage op = queuedOperations[operationQueue[i]];
            if (!op.executed && !op.cancelled) {
                activeCount++;
            }
        }
        
        // Заполняем массив
        bytes32[] memory activeOps = new bytes32[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < operationQueue.length; i++) {
            QueuedOperation storage op = queuedOperations[operationQueue[i]];
            if (!op.executed && !op.cancelled) {
                activeOps[index] = operationQueue[i];
                index++;
            }
        }
        
        return activeOps;
    }
    
    /**
     * @dev Получить статистику Timelock
     */
    function getTimelockStats() external view returns (
        uint256 total,
        uint256 executed,
        uint256 cancelled,
        uint256 pending,
        uint256 currentDelay
    ) {
        return (
            totalOperations,
            executedOperations,
            cancelledOperations,
            totalOperations - executedOperations - cancelledOperations,
            defaultDelay
        );
    }
    
    // ===== ВНУТРЕННИЕ ФУНКЦИИ =====
    
    /**
     * @dev Определить задержку для операции
     */
    function _getOperationDelay(bytes4 selector) internal view returns (uint256) {
        uint256 customDelay = operationDelays[selector];
        if (customDelay > 0) {
            return customDelay;
        }
        
        // Используем стандартную задержку
        return defaultDelay;
    }
    
    /**
     * @dev Настроить стандартные задержки для операций
     */
    function _setupOperationDelays() internal {
        // Критические операции - длинная задержка (7 дней)
        bytes4 updateQuorum = bytes4(keccak256("updateQuorumPercentage(uint256)"));
        bytes4 addModule = bytes4(keccak256("_addModule(bytes32,address)"));
        bytes4 removeModule = bytes4(keccak256("_removeModule(bytes32)"));
        bytes4 addChain = bytes4(keccak256("_addSupportedChain(uint256)"));
        bytes4 removeChain = bytes4(keccak256("_removeSupportedChain(uint256)"));
        
        operationDelays[updateQuorum] = 7 days;
        operationDelays[addModule] = 7 days;
        operationDelays[removeModule] = 7 days;
        operationDelays[addChain] = 5 days;
        operationDelays[removeChain] = 5 days;
        
        criticalOperations[updateQuorum] = true;
        criticalOperations[addModule] = true;
        criticalOperations[removeModule] = true;
        criticalOperations[addChain] = true;
        criticalOperations[removeChain] = true;
        
        // Обычные операции - стандартная задержка (2 дня)
        bytes4 updateDLEInfo = bytes4(keccak256("updateDLEInfo(string,string,string,string,uint256,string[],uint256)"));
        bytes4 updateChainId = bytes4(keccak256("updateCurrentChainId(uint256)"));
        bytes4 updateVotingDurations = bytes4(keccak256("_updateVotingDurations(uint256,uint256)"));
        
        operationDelays[updateDLEInfo] = 2 days;
        operationDelays[updateChainId] = 3 days;
        operationDelays[updateVotingDurations] = 1 days;
        
        // Treasury операции - короткая задержка (1 день)
        bytes4 treasuryTransfer = bytes4(keccak256("treasuryTransfer(address,address,uint256)"));
        bytes4 treasuryAddToken = bytes4(keccak256("treasuryAddToken(address,string,uint8)"));
        
        operationDelays[treasuryTransfer] = 1 days;
        operationDelays[treasuryAddToken] = 1 days;
        
        // Экстренные операции (могут исполняться немедленно при необходимости)
        emergencyOperations[removeModule] = true; // Удаление вредоносного модуля
        emergencyOperations[removeChain] = true;  // Отключение скомпрометированной сети
    }
}
