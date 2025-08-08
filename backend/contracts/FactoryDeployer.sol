// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FactoryDeployer {
    event Deployed(address addr, bytes32 salt);

    function deploy(bytes32 salt, bytes memory creationCode) external payable returns (address addr) {
        require(creationCode.length != 0, "init code empty");
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := create2(callvalue(), add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(addr != address(0), "CREATE2 failed");
        emit Deployed(addr, salt);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash));
        return address(uint160(uint256(hash)));
    }
}


