// SPDX-License-Identifier: PROPRIETARY
// Copyright (c) 2024-2025 Тарабанов Александр Викторович
// All rights reserved.
//
// This software is proprietary and confidential.
// Unauthorized copying, modification, or distribution is prohibited.
//
// For licensing inquiries: info@hb3-accelerator.com
// Website: https://hb3-accelerator.com
// GitHub: https://github.com/HB3-ACCELERATOR

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockToken
 * @dev Мок-токен для тестирования TreasuryModule
 */
contract MockToken is ERC20 {
    address public minter;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        minter = msg.sender;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "Only minter can call this function");
        _;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
