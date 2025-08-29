// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockNoop
 * @dev Простой мок-контракт для тестирования FactoryDeployer
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
