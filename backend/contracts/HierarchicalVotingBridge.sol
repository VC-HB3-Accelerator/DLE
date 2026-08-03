// SPDX-License-Identifier: PROPRIETARY AND MIT
pragma solidity ^0.8.20;

/**
 * @title HierarchicalVotingBridge
 * @dev Тонкий пульт HV. Только DLE → bridge → module.
 */
interface IHVOps {
    function setTreasuryModule(address _treasuryModule) external;
    function addExternalDLE(address dleAddress, string memory name, string memory symbol) external;
    function removeExternalDLE(address dleAddress) external;
    function updateExternalDLEBalance(address dleAddress) external;
    function updateAllExternalDLEBalances() external;
}

contract HierarchicalVotingBridge {
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

    function setTreasuryModule(address _treasuryModule) external onlyDLE {
        IHVOps(module).setTreasuryModule(_treasuryModule);
    }

    function addExternalDLE(address dleAddress, string calldata name, string calldata symbol) external onlyDLE {
        IHVOps(module).addExternalDLE(dleAddress, name, symbol);
    }

    function removeExternalDLE(address dleAddress) external onlyDLE {
        IHVOps(module).removeExternalDLE(dleAddress);
    }

    function updateExternalDLEBalance(address dleAddress) external onlyDLE {
        IHVOps(module).updateExternalDLEBalance(dleAddress);
    }

    function updateAllExternalDLEBalances() external onlyDLE {
        IHVOps(module).updateAllExternalDLEBalances();
    }
}
