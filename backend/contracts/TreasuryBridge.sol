// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.
//
// For licensing inquiries: info@hb3-accelerator.com
pragma solidity ^0.8.20;

/**
 * @title TreasuryBridge
 * @dev Тонкий пульт выплат для казны. Вызывает только DLE; дергает только transfer/batch на Treasury.
 * См. docs.ru/tz-module-bridge.ru.md
 */
interface ITreasuryFunds {
    struct BatchTransfer {
        address tokenAddress;
        address recipient;
        uint256 amount;
    }

    function transferFunds(
        address tokenAddress,
        address recipient,
        uint256 amount,
        bytes32 proposalId
    ) external;

    function batchTransfer(BatchTransfer[] calldata transfers, bytes32 proposalId) external;
}

contract TreasuryBridge {
    address public immutable dleContract;
    address public immutable treasury;

    error ErrOnlyDLE();
    error ErrZeroAddress();

    modifier onlyDLE() {
        if (msg.sender != dleContract) revert ErrOnlyDLE();
        _;
    }

    constructor(address _dle, address _treasury) {
        if (_dle == address(0) || _treasury == address(0)) revert ErrZeroAddress();
        dleContract = _dle;
        treasury = _treasury;
    }

    function transferFunds(
        address tokenAddress,
        address recipient,
        uint256 amount,
        bytes32 proposalId
    ) external onlyDLE {
        ITreasuryFunds(treasury).transferFunds(tokenAddress, recipient, amount, proposalId);
    }

    function batchTransfer(
        ITreasuryFunds.BatchTransfer[] calldata transfers,
        bytes32 proposalId
    ) external onlyDLE {
        ITreasuryFunds(treasury).batchTransfer(transfers, proposalId);
    }
}
