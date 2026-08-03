// SPDX-License-Identifier: PROPRIETARY AND MIT
pragma solidity ^0.8.20;

/**
 * @title TimelockBridge
 * @dev Тонкий пульт TimelockModule. Только DLE → bridge → module.
 */
interface ITimelockOps {
    function queueOperation(address target, bytes memory data, string memory description) external returns (bytes32);
    function cancelOperation(bytes32 operationId, string memory reason) external;
    function updateOperationDelay(bytes4 selector, uint256 newDelay) external;
    function updateDefaultDelay(uint256 newDelay) external;
}

contract TimelockBridge {
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

    function queueOperation(address target, bytes calldata data, string calldata description)
        external
        onlyDLE
        returns (bytes32)
    {
        return ITimelockOps(module).queueOperation(target, data, description);
    }

    function cancelOperation(bytes32 operationId, string calldata reason) external onlyDLE {
        ITimelockOps(module).cancelOperation(operationId, reason);
    }

    function updateOperationDelay(bytes4 selector, uint256 newDelay) external onlyDLE {
        ITimelockOps(module).updateOperationDelay(selector, newDelay);
    }

    function updateDefaultDelay(uint256 newDelay) external onlyDLE {
        ITimelockOps(module).updateDefaultDelay(newDelay);
    }
}
