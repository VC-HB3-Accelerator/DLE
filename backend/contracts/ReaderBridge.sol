// SPDX-License-Identifier: PROPRIETARY AND MIT
pragma solidity ^0.8.20;

/**
 * @title ReaderBridge
 * @dev Заготовка пульта для DLEReader (view-only). Адрес есть для единого moduleBridge()-паттерна.
 */
contract ReaderBridge {
    address public immutable dleContract;
    address public immutable module;

    error ErrOnlyDLE();
    error ErrZeroAddress();

    modifier onlyDLE() {
        if (msg.sender != dleContract) revert ErrOnlyDLE();
        _;
    }

    constructor(address _dle, address _module) {
        if (_dle == address(0) || _module == address(0)) revert ErrZeroAddress();
        dleContract = _dle;
        module = _module;
    }

    function ping() external onlyDLE returns (address) {
        return module;
    }
}
