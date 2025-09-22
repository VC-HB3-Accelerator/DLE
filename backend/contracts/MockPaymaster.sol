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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ERC-4337 интерфейсы для тестирования
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
 * @title MockPaymaster
 * @dev Mock контракт для тестирования ERC-4337 Paymaster функциональности
 */
contract MockPaymaster is IPaymaster {
    using SafeERC20 for IERC20;
    
    // События для тестирования
    event PaymasterValidated(address indexed sender, uint256 maxCost);
    event PostOpCalled(PostOpMode mode, uint256 actualGasCost);
    event TokenReceived(address indexed token, uint256 amount);
    
    // Статистика для тестирования
    uint256 public totalValidations;
    uint256 public totalPostOps;
    mapping(address => uint256) public tokenReceived;
    
    /**
     * @dev Валидация UserOperation (всегда успешна для тестов)
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        // Используем userOpHash для избежания предупреждения
        userOpHash;
        totalValidations++;
        emit PaymasterValidated(userOp.sender, maxCost);
        
        // Возвращаем пустой контекст и 0 (успешная валидация)
        return (abi.encode(userOp.sender, maxCost), 0);
    }
    
    /**
     * @dev Post-operation обработка
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override {
        // Используем context для избежания предупреждения
        context;
        totalPostOps++;
        emit PostOpCalled(mode, actualGasCost);
    }
    
    /**
     * @dev Получить токены (для тестирования)
     */
    function receiveTokens(address tokenAddress, uint256 amount) external payable {
        if (tokenAddress == address(0)) {
            // Нативные токены
            require(msg.value == amount, "Incorrect native amount");
        } else {
            // ERC20 токены
            IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        }
        
        tokenReceived[tokenAddress] += amount;
        emit TokenReceived(tokenAddress, amount);
    }
    
    /**
     * @dev Получить нативные токены
     */
    receive() external payable {
        tokenReceived[address(0)] += msg.value;
        emit TokenReceived(address(0), msg.value);
    }
    
    /**
     * @dev Получить статистику
     */
    function getStats() external view returns (
        uint256 validations,
        uint256 postOps,
        uint256 nativeReceived
    ) {
        return (
            totalValidations,
            totalPostOps,
            tokenReceived[address(0)]
        );
    }
}
