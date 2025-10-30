// SPDX-License-Identifier: MIT
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

/**
 * @title MockNoop
 * @dev Простой мок-контракт для тестирования
 */
contract MockNoop {
    uint256 public value;
    
    constructor() {
        value = 42;
    }
    
    function setValue(uint256 _value) external {
        value = _value;
    }
    
    function getValue() external view returns (uint256) {
        return value;
    }
}
