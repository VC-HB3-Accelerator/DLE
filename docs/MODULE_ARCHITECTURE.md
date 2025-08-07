# Архитектура модулей DLE

## Обзор

DLE использует модульную архитектуру, где каждый модуль может иметь свои правила доступа и функциональность.

## Типы модулей

### 1. Простые модули (Вариант 1)
Модули сами проверяют права доступа токен-холдеров.

```solidity
contract SimpleModule {
    address public dleContract;
    
    modifier onlyDLEHolders() {
        require(IERC20(dleContract).balanceOf(msg.sender) > 0, "Must hold DLE tokens");
        _;
    }
    
    function someFunction() external onlyDLEHolders {
        // Логика функции
    }
}
```

### 2. Сложные модули (Вариант 3)
Модули работают через основной контракт DLE.

```solidity
contract ComplexModule {
    address public dleContract;
    
    function executeOperation(address caller, bytes calldata operation) external {
        require(msg.sender == dleContract, "Only DLE can call");
        require(IERC20(dleContract).balanceOf(caller) > 0, "Must hold tokens");
        
        // Выполняем операцию
        _executeOperation(caller, operation);
    }
}
```

## Рекомендации по выбору

### Используйте Вариант 1 для:
- ✅ Простых операций (чтение данных)
- ✅ Модулей с минимальной логикой
- ✅ Быстрых операций

### Используйте Вариант 3 для:
- ✅ Сложных финансовых операций
- ✅ Модулей с критической логикой
- ✅ Операций, требующих аудита

## Примеры модулей

### TreasuryModule (Казна)
```solidity
contract TreasuryModule {
    address public dleContract;
    mapping(address => bool) public supportedTokens;
    
    modifier onlyDLEHolders() {
        require(IERC20(dleContract).balanceOf(msg.sender) > 0, "Must hold DLE tokens");
        _;
    }
    
    function depositToken(address token, uint256 amount) external onlyDLEHolders {
        require(supportedTokens[token], "Token not supported");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
    
    function withdrawToken(address token, uint256 amount) external onlyDLEHolders {
        require(supportedTokens[token], "Token not supported");
        IERC20(token).transfer(msg.sender, amount);
    }
}
```

### GovernanceModule (Управление)
```solidity
contract GovernanceModule {
    address public dleContract;
    
    function executeOperation(address caller, bytes calldata operation) external {
        require(msg.sender == dleContract, "Only DLE can call");
        require(IERC20(dleContract).balanceOf(caller) > 0, "Must hold tokens");
        
        // Выполняем операцию управления
        _executeGovernanceOperation(caller, operation);
    }
}
```

## Безопасность

### Общие принципы:
1. **Всегда проверяйте** баланс токенов DLE
2. **Валидируйте входные данные** в модулях
3. **Используйте ReentrancyGuard** для финансовых операций
4. **Логируйте важные операции** через события

### Аудит модулей:
- Проверяйте права доступа
- Тестируйте граничные случаи
- Валидируйте входные параметры
- Проверяйте обработку ошибок 