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

// ERC-4337 интерфейсы для оплаты газа любым токеном
interface IPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;
    bytes signature;
}

enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

/**
 * @title TreasuryModule
 * @dev Модуль казны для управления активами DLE
 * 
 * ОСНОВНЫЕ ФУНКЦИИ:
 * - Управление различными ERC20 токенами
 * - Хранение и перевод нативных монет (ETH, BNB, MATIC и т.д.)
 * - Интеграция с DLE governance для авторизации операций
 * - Поддержка мульти-чейн операций
 * - Batch операции для оптимизации газа
 * 
 * БЕЗОПАСНОСТЬ:
 * - Только DLE контракт может выполнять операции
 * - Защита от реентерабельности
 * - Валидация всех входных параметров
 * - Поддержка emergency pause
 */
contract TreasuryModule is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // Структура для информации о токене
    struct TokenInfo {
        address tokenAddress;    // Адрес токена (0x0 для нативной монеты)
        string symbol;          // Символ токена
        uint8 decimals;         // Количество знаков после запятой
        bool isActive;          // Активен ли токен
        bool isNative;          // Является ли нативной монетой
        uint256 addedTimestamp; // Время добавления
        uint256 balance;        // Кэшированный баланс (обновляется при операциях)
    }

    // Структура для batch операции
    struct BatchTransfer {
        address tokenAddress;   // Адрес токена (0x0 для нативной монеты)
        address recipient;      // Получатель
        uint256 amount;         // Количество
    }

    // Основные переменные
    address public immutable dleContract;  // Адрес основного DLE контракта
    uint256 public immutable chainId;     // ID текущей сети

    // Хранение токенов
    mapping(address => TokenInfo) public supportedTokens;  // tokenAddress => TokenInfo
    address[] public tokenList;                            // Список всех добавленных токенов
    mapping(address => uint256) public tokenIndex;         // tokenAddress => index в tokenList

    // Статистика
    uint256 public totalTokensSupported;
    uint256 public totalTransactions;
    mapping(address => uint256) public tokenTransactionCount; // tokenAddress => count

    // Система экстренного останова
    bool public emergencyPaused;
    address public emergencyAdmin;
    
    // ERC-4337 Paymaster для оплаты газа любым токеном
    address public paymaster;
    mapping(address => bool) public gasPaymentTokens; // Токены, которыми можно платить за газ
    mapping(address => uint256) public gasTokenRates; // Курсы обмена токенов на нативную монету

    // События
    event TokenAdded(
        address indexed tokenAddress,
        string symbol,
        uint8 decimals,
        bool isNative,
        uint256 timestamp
    );
    event TokenRemoved(address indexed tokenAddress, string symbol, uint256 timestamp);
    event TokenStatusUpdated(address indexed tokenAddress, bool newStatus);
    event FundsDeposited(
        address indexed tokenAddress,
        address indexed from,
        uint256 amount,
        uint256 newBalance
    );
    event FundsTransferred(
        address indexed tokenAddress,
        address indexed to,
        uint256 amount,
        uint256 remainingBalance,
        bytes32 indexed proposalId
    );
    event BatchTransferExecuted(
        uint256 transferCount,
        uint256 totalAmount,
        bytes32 indexed proposalId
    );
    event EmergencyPauseToggled(bool isPaused, address admin);
    event BalanceUpdated(address indexed tokenAddress, uint256 oldBalance, uint256 newBalance);
    event PaymasterUpdated(address indexed oldPaymaster, address indexed newPaymaster);
    event GasPaymentTokenAdded(address indexed tokenAddress, uint256 rate);
    event GasPaymentTokenRemoved(address indexed tokenAddress);
    event GasPaidWithToken(address indexed tokenAddress, uint256 tokenAmount, uint256 nativeAmount);

    // Модификаторы
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE contract can call this");
        _;
    }

    modifier whenNotPaused() {
        require(!emergencyPaused, "Treasury is paused");
        _;
    }

    modifier onlyEmergencyAdmin() {
        require(msg.sender == emergencyAdmin, "Only emergency admin");
        _;
    }

    modifier validToken(address tokenAddress) {
        require(supportedTokens[tokenAddress].isActive, "Token not supported or inactive");
        _;
    }

    constructor(address _dleContract, uint256 _chainId, address _emergencyAdmin) {
        require(_dleContract != address(0), "DLE contract cannot be zero");
        require(_emergencyAdmin != address(0), "Emergency admin cannot be zero");
        require(_chainId > 0, "Chain ID must be positive");

        dleContract = _dleContract;
        chainId = _chainId;
        emergencyAdmin = _emergencyAdmin;

        // Автоматически добавляем нативную монету сети
        _addNativeToken();
    }

    /**
     * @dev Получить средства (может вызывать кто угодно для пополнения казны)
     */
    receive() external payable {
        if (msg.value > 0) {
            // Автоматически добавляем нативную монету, если её нет
            if (!supportedTokens[address(0)].isActive) {
                _addNativeToken();
            }
            
            _updateTokenBalance(address(0), supportedTokens[address(0)].balance + msg.value);
            emit FundsDeposited(address(0), msg.sender, msg.value, supportedTokens[address(0)].balance);
        }
    }

    /**
     * @dev Добавить новый токен в казну (только через DLE governance)
     * @param tokenAddress Адрес токена (0x0 для нативной монеты)
     * @param symbol Символ токена
     * @param decimals Количество знаков после запятой
     */
    function addToken(
        address tokenAddress,
        string memory symbol,
        uint8 decimals
    ) external onlyDLE whenNotPaused {
        require(!supportedTokens[tokenAddress].isActive, "Token already supported");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(bytes(symbol).length <= 20, "Symbol too long");

        // Для ERC20 токенов проверяем, что контракт существует
        if (tokenAddress != address(0)) {
            require(tokenAddress.code.length > 0, "Token contract does not exist");
            
            // Проверяем базовые ERC20 функции
            try IERC20(tokenAddress).totalSupply() returns (uint256) {
                // Token contract is valid
            } catch {
                revert("Invalid ERC20 token");
            }
        }

        // Добавляем токен
        supportedTokens[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            symbol: symbol,
            decimals: decimals,
            isActive: true,
            isNative: tokenAddress == address(0),
            addedTimestamp: block.timestamp,
            balance: 0
        });

        tokenList.push(tokenAddress);
        tokenIndex[tokenAddress] = tokenList.length - 1;
        totalTokensSupported++;

        // Обновляем баланс
        _refreshTokenBalance(tokenAddress);

        emit TokenAdded(tokenAddress, symbol, decimals, tokenAddress == address(0), block.timestamp);
    }

    /**
     * @dev Удалить токен из казны (только через DLE governance)
     * @param tokenAddress Адрес токена для удаления
     */
    function removeToken(address tokenAddress) external onlyDLE whenNotPaused validToken(tokenAddress) {
        require(tokenAddress != address(0), "Cannot remove native token");
        
        TokenInfo memory tokenInfo = supportedTokens[tokenAddress];
        require(tokenInfo.balance == 0, "Token balance must be zero before removal");

        // Удаляем из массива
        uint256 index = tokenIndex[tokenAddress];
        uint256 lastIndex = tokenList.length - 1;
        
        if (index != lastIndex) {
            address lastToken = tokenList[lastIndex];
            tokenList[index] = lastToken;
            tokenIndex[lastToken] = index;
        }
        
        tokenList.pop();
        delete tokenIndex[tokenAddress];
        delete supportedTokens[tokenAddress];
        totalTokensSupported--;

        emit TokenRemoved(tokenAddress, tokenInfo.symbol, block.timestamp);
    }

    /**
     * @dev Изменить статус токена (активен/неактивен)
     * @param tokenAddress Адрес токена
     * @param isActive Новый статус
     */
    function setTokenStatus(address tokenAddress, bool isActive) external onlyDLE {
        require(supportedTokens[tokenAddress].tokenAddress == tokenAddress, "Token not found");
        require(tokenAddress != address(0), "Cannot deactivate native token");
        
        supportedTokens[tokenAddress].isActive = isActive;
        emit TokenStatusUpdated(tokenAddress, isActive);
    }

    /**
     * @dev Перевести токены (только через DLE governance)
     * @param tokenAddress Адрес токена (0x0 для нативной монеты)
     * @param recipient Получатель
     * @param amount Количество для перевода
     * @param proposalId ID предложения DLE (для логирования)
     */
    function transferFunds(
        address tokenAddress,
        address recipient,
        uint256 amount,
        bytes32 proposalId
    ) external onlyDLE whenNotPaused validToken(tokenAddress) nonReentrant {
        require(recipient != address(0), "Recipient cannot be zero");
        require(amount > 0, "Amount must be positive");

        TokenInfo storage tokenInfo = supportedTokens[tokenAddress];
        require(tokenInfo.balance >= amount, "Insufficient balance");

        // Обновляем баланс
        _updateTokenBalance(tokenAddress, tokenInfo.balance - amount);

        // Выполняем перевод
        if (tokenInfo.isNative) {
            payable(recipient).sendValue(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(recipient, amount);
        }

        totalTransactions++;
        tokenTransactionCount[tokenAddress]++;

        emit FundsTransferred(
            tokenAddress,
            recipient,
            amount,
            tokenInfo.balance,
            proposalId
        );
    }

    /**
     * @dev Выполнить batch перевод (только через DLE governance)
     * @param transfers Массив переводов
     * @param proposalId ID предложения DLE
     */
    function batchTransfer(
        BatchTransfer[] memory transfers,
        bytes32 proposalId
    ) external onlyDLE whenNotPaused nonReentrant {
        require(transfers.length > 0, "No transfers provided");
        require(transfers.length <= 100, "Too many transfers"); // Защита от DoS

        uint256 totalAmount = 0;

        for (uint256 i = 0; i < transfers.length; i++) {
            BatchTransfer memory transfer = transfers[i];
            
            require(transfer.recipient != address(0), "Recipient cannot be zero");
            require(transfer.amount > 0, "Amount must be positive");
            require(supportedTokens[transfer.tokenAddress].isActive, "Token not supported");

            TokenInfo storage tokenInfo = supportedTokens[transfer.tokenAddress];
            require(tokenInfo.balance >= transfer.amount, "Insufficient balance");

            // Обновляем баланс
            _updateTokenBalance(transfer.tokenAddress, tokenInfo.balance - transfer.amount);

            // Выполняем перевод
            if (tokenInfo.isNative) {
                payable(transfer.recipient).sendValue(transfer.amount);
            } else {
                IERC20(transfer.tokenAddress).safeTransfer(transfer.recipient, transfer.amount);
            }

            totalAmount += transfer.amount;
            tokenTransactionCount[transfer.tokenAddress]++;

            emit FundsTransferred(
                transfer.tokenAddress,
                transfer.recipient,
                transfer.amount,
                tokenInfo.balance,
                proposalId
            );
        }

        totalTransactions += transfers.length;
        emit BatchTransferExecuted(transfers.length, totalAmount, proposalId);
    }

    /**
     * @dev Пополнить казну ERC20 токенами
     * @param tokenAddress Адрес токена
     * @param amount Количество для пополнения
     */
    function depositToken(
        address tokenAddress,
        uint256 amount
    ) external whenNotPaused validToken(tokenAddress) nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(tokenAddress != address(0), "Use receive() for native deposits");

        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        _updateTokenBalance(tokenAddress, supportedTokens[tokenAddress].balance + amount);

        emit FundsDeposited(tokenAddress, msg.sender, amount, supportedTokens[tokenAddress].balance);
    }

    /**
     * @dev Обновить баланс токена (синхронизация с реальным балансом)
     * @param tokenAddress Адрес токена
     */
    function refreshBalance(address tokenAddress) external validToken(tokenAddress) {
        _refreshTokenBalance(tokenAddress);
    }

    /**
     * @dev Обновить балансы всех токенов
     */
    function refreshAllBalances() external {
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]].isActive) {
                _refreshTokenBalance(tokenList[i]);
            }
        }
    }

    /**
     * @dev Экстренная пауза (только emergency admin)
     */
    function emergencyPause() external onlyEmergencyAdmin {
        emergencyPaused = !emergencyPaused;
        emit EmergencyPauseToggled(emergencyPaused, msg.sender);
    }
    
    // ===== ФУНКЦИИ ДЛЯ ОПЛАТЫ ГАЗА ЛЮБЫМ ТОКЕНОМ =====
    
    /**
     * @dev Установить Paymaster для ERC-4337 (только через DLE governance)
     * @param _paymaster Адрес Paymaster контракта
     */
    function setPaymaster(address _paymaster) external onlyDLE {
        require(_paymaster != address(0), "Paymaster cannot be zero");
        address oldPaymaster = paymaster;
        paymaster = _paymaster;
        emit PaymasterUpdated(oldPaymaster, _paymaster);
    }
    
    /**
     * @dev Добавить токен для оплаты газа (только через DLE governance)
     * @param tokenAddress Адрес токена
     * @param rate Курс обмена (сколько токенов за 1 нативную монету)
     */
    function addGasPaymentToken(address tokenAddress, uint256 rate) external onlyDLE {
        require(rate > 0, "Rate must be positive");
        
        // Для нативной монеты проверяем, что она активна
        if (tokenAddress == address(0)) {
            require(supportedTokens[tokenAddress].isActive, "Native token must be supported");
        } else {
            require(supportedTokens[tokenAddress].isActive, "Token must be supported");
        }
        
        gasPaymentTokens[tokenAddress] = true;
        gasTokenRates[tokenAddress] = rate;
        
        emit GasPaymentTokenAdded(tokenAddress, rate);
    }
    
    /**
     * @dev Удалить токен для оплаты газа (только через DLE governance)
     * @param tokenAddress Адрес токена
     */
    function removeGasPaymentToken(address tokenAddress) external onlyDLE {
        require(gasPaymentTokens[tokenAddress], "Token not set for gas payment");
        
        gasPaymentTokens[tokenAddress] = false;
        gasTokenRates[tokenAddress] = 0;
        
        emit GasPaymentTokenRemoved(tokenAddress);
    }
    
    /**
     * @dev Обновить курс обмена токена (только через DLE governance)
     * @param tokenAddress Адрес токена
     * @param newRate Новый курс обмена
     */
    function updateGasTokenRate(address tokenAddress, uint256 newRate) external onlyDLE {
        require(gasPaymentTokens[tokenAddress], "Token not set for gas payment");
        require(newRate > 0, "Rate must be positive");
        
        gasTokenRates[tokenAddress] = newRate;
        emit GasPaymentTokenAdded(tokenAddress, newRate); // Переиспользуем событие
    }
    
    /**
     * @dev Оплатить газ токенами (через ERC-4337 Paymaster)
     * @param tokenAddress Адрес токена для оплаты (0x0 для нативной монеты)
     * @param gasAmount Количество газа для оплаты
     * @param userOp UserOperation для ERC-4337
     */
    function payGasWithToken(
        address tokenAddress,
        uint256 gasAmount,
        UserOperation calldata userOp
    ) external onlyDLE whenNotPaused nonReentrant {
        _payGasWithToken(tokenAddress, gasAmount, userOp);
    }
    
    /**
     * @dev Проверить, можно ли оплатить газ токеном
     * @param tokenAddress Адрес токена (0x0 для нативной монеты)
     * @param gasAmount Количество газа
     * @return canPay Можно ли оплатить
     * @return tokenAmount Количество токенов для оплаты
     */
    function canPayGasWithToken(
        address tokenAddress, 
        uint256 gasAmount
    ) external view returns (bool canPay, uint256 tokenAmount) {
        if (!gasPaymentTokens[tokenAddress] || !supportedTokens[tokenAddress].isActive) {
            return (false, 0);
        }
        
        tokenAmount = (gasAmount * gasTokenRates[tokenAddress]) / 1e18;
        canPay = supportedTokens[tokenAddress].balance >= tokenAmount;
        
        return (canPay, tokenAmount);
    }
    
    /**
     * @dev Проверить, можно ли оплатить газ нативной монетой
     * @param gasAmount Количество газа
     * @return canPay Можно ли оплатить
     * @return nativeAmount Количество нативной монеты для оплаты
     */
    function canPayGasWithNative(
        uint256 gasAmount
    ) external view returns (bool canPay, uint256 nativeAmount) {
        return this.canPayGasWithToken(address(0), gasAmount);
    }
    
    /**
     * @dev Оплатить газ нативной монетой (упрощенная версия)
     * @param gasAmount Количество газа для оплаты
     * @param userOp UserOperation для ERC-4337
     */
    function payGasWithNative(
        uint256 gasAmount,
        UserOperation calldata userOp
    ) external onlyDLE whenNotPaused nonReentrant {
        // Используем нативную монету (address(0))
        _payGasWithToken(address(0), gasAmount, userOp);
    }
    
    /**
     * @dev Внутренняя функция для оплаты газа токенами
     * @param tokenAddress Адрес токена для оплаты (0x0 для нативной монеты)
     * @param gasAmount Количество газа для оплаты
     * @param userOp UserOperation для ERC-4337
     */
    function _payGasWithToken(
        address tokenAddress,
        uint256 gasAmount,
        UserOperation calldata userOp
    ) internal {
        require(gasPaymentTokens[tokenAddress], "Token not supported for gas payment");
        require(paymaster != address(0), "Paymaster not set");
        
        TokenInfo storage tokenInfo = supportedTokens[tokenAddress];
        require(tokenInfo.isActive, "Token not active");
        
        // Вычисляем количество токенов для оплаты газа
        uint256 tokenAmount = (gasAmount * gasTokenRates[tokenAddress]) / 1e18;
        require(tokenInfo.balance >= tokenAmount, "Insufficient token balance");
        
        // Обновляем баланс токена
        _updateTokenBalance(tokenAddress, tokenInfo.balance - tokenAmount);
        
        // Переводим токены на Paymaster (поддержка нативных и ERC20 токенов)
        if (tokenInfo.isNative) {
            // Для нативных токенов (ETH, BNB, MATIC и т.д.)
            payable(paymaster).sendValue(tokenAmount);
        } else {
            // Для ERC20 токенов
            IERC20(tokenAddress).safeTransfer(paymaster, tokenAmount);
        }
        
        // Вызываем Paymaster для оплаты газа
        IPaymaster(paymaster).validatePaymasterUserOp(
            userOp,
            keccak256(abi.encode(userOp)),
            gasAmount
        );
        
        emit GasPaidWithToken(tokenAddress, tokenAmount, gasAmount);
    }

    // ===== VIEW ФУНКЦИИ =====

    /**
     * @dev Получить информацию о токене
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory) {
        return supportedTokens[tokenAddress];
    }

    /**
     * @dev Получить список всех токенов
     */
    function getAllTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @dev Получить активные токены
     */
    function getActiveTokens() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Считаем активные токены (включая нативную монету)
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Нативная монета всегда активна
        if (address(this).balance > 0 || supportedTokens[address(0)].isActive) {
            activeCount++;
        }

        // Создаём массив активных токенов
        address[] memory activeTokens = new address[](activeCount);
        uint256 index = 0;
        
        // Добавляем нативную монету первой, если есть баланс
        if (address(this).balance > 0 || supportedTokens[address(0)].isActive) {
            activeTokens[index] = address(0);
            index++;
        }
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]].isActive) {
                activeTokens[index] = tokenList[i];
                index++;
            }
        }

        return activeTokens;
    }

    /**
     * @dev Получить баланс токена
     */
    function getTokenBalance(address tokenAddress) external view returns (uint256) {
        // Для нативной монеты возвращаем реальный баланс, если токен не зарегистрирован
        if (tokenAddress == address(0) && !supportedTokens[address(0)].isActive) {
            return address(this).balance;
        }
        return supportedTokens[tokenAddress].balance;
    }

    /**
     * @dev Получить реальный баланс токена (обращение к блокчейну)
     */
    function getRealTokenBalance(address tokenAddress) external view returns (uint256) {
        if (tokenAddress == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(tokenAddress).balanceOf(address(this));
        }
    }

    /**
     * @dev Проверить, поддерживается ли токен
     */
    function isTokenSupported(address tokenAddress) external view returns (bool) {
        // Нативная монета всегда поддерживается
        if (tokenAddress == address(0)) {
            return true;
        }
        return supportedTokens[tokenAddress].isActive;
    }

    /**
     * @dev Получить статистику казны
     */
    function getTreasuryStats() external view returns (
        uint256 totalTokens,
        uint256 totalTxs,
        uint256 currentChainId,
        bool isPaused,
        address paymasterAddress,
        uint256 gasPaymentTokensCount
    ) {
        // Считаем количество токенов для оплаты газа
        uint256 gasTokensCount = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (gasPaymentTokens[tokenList[i]]) {
                gasTokensCount++;
            }
        }
        
        return (
            totalTokensSupported,
            totalTransactions,
            chainId,
            emergencyPaused,
            paymaster,
            gasTokensCount
        );
    }

    // ===== ВНУТРЕННИЕ ФУНКЦИИ =====

    /**
     * @dev Автоматически добавить нативную монету
     */
    function _addNativeToken() internal {
        string memory nativeSymbol;
        
        // Определяем символ нативной монеты по chain ID
        if (chainId == 1 || chainId == 11155111) {          // Ethereum Mainnet / Sepolia
            nativeSymbol = "ETH";
        } else if (chainId == 56 || chainId == 97) {        // BSC Mainnet / Testnet
            nativeSymbol = "BNB";
        } else if (chainId == 137 || chainId == 80001) {    // Polygon Mainnet / Mumbai
            nativeSymbol = "MATIC";
        } else if (chainId == 42161) {                      // Arbitrum One
            nativeSymbol = "ETH";
        } else if (chainId == 10) {                         // Optimism
            nativeSymbol = "ETH";
        } else if (chainId == 43114) {                      // Avalanche
            nativeSymbol = "AVAX";
        } else {
            nativeSymbol = "NATIVE"; // Для неизвестных сетей
        }

        supportedTokens[address(0)] = TokenInfo({
            tokenAddress: address(0),
            symbol: nativeSymbol,
            decimals: 18,
            isActive: true,
            isNative: true,
            addedTimestamp: block.timestamp,
            balance: 0
        });

        tokenList.push(address(0));
        tokenIndex[address(0)] = 0;
        totalTokensSupported = 1;

        emit TokenAdded(address(0), nativeSymbol, 18, true, block.timestamp);
    }

    /**
     * @dev Обновить кэшированный баланс токена
     */
    function _updateTokenBalance(address tokenAddress, uint256 newBalance) internal {
        uint256 oldBalance = supportedTokens[tokenAddress].balance;
        supportedTokens[tokenAddress].balance = newBalance;
        emit BalanceUpdated(tokenAddress, oldBalance, newBalance);
    }

    /**
     * @dev Синхронизировать кэшированный баланс с реальным
     */
    function _refreshTokenBalance(address tokenAddress) internal {
        uint256 realBalance;
        
        if (tokenAddress == address(0)) {
            realBalance = address(this).balance;
        } else {
            realBalance = IERC20(tokenAddress).balanceOf(address(this));
        }

        _updateTokenBalance(tokenAddress, realBalance);
    }
}
