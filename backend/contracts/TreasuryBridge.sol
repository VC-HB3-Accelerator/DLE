// SPDX-License-Identifier: PROPRIETARY AND MIT
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.
//
// For licensing inquiries: info@hb3-accelerator.com
pragma solidity ^0.8.20;

/**
 * @title TreasuryBridge
 * @dev Тонкий пульт казны. Только DLE → bridge → TreasuryModule.
 * Покрывает выплаты ERC-20/native/NFT, токены, смену HV и замену самого моста.
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

    function transferERC721(
        address nftContract,
        address recipient,
        uint256 tokenId,
        bytes32 proposalId
    ) external;

    function transferERC1155(
        address nftContract,
        address recipient,
        uint256 tokenId,
        uint256 amount,
        bytes32 proposalId
    ) external;

    function setHierarchicalVotingModule(address module) external;

    function setFundsBridge(address bridge) external;

    function addToken(address tokenAddress, string memory symbol, uint8 decimals) external;

    function removeToken(address tokenAddress) external;

    function setTokenStatus(address tokenAddress, bool isActive) external;
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

    function transferERC721(
        address nftContract,
        address recipient,
        uint256 tokenId,
        bytes32 proposalId
    ) external onlyDLE {
        ITreasuryFunds(treasury).transferERC721(nftContract, recipient, tokenId, proposalId);
    }

    function transferERC1155(
        address nftContract,
        address recipient,
        uint256 tokenId,
        uint256 amount,
        bytes32 proposalId
    ) external onlyDLE {
        ITreasuryFunds(treasury).transferERC1155(
            nftContract,
            recipient,
            tokenId,
            amount,
            proposalId
        );
    }

    function setHierarchicalVotingModule(address module) external onlyDLE {
        ITreasuryFunds(treasury).setHierarchicalVotingModule(module);
    }

    /// @dev Смена моста через governance (treasury принимает вызов от текущего fundsBridge).
    function setFundsBridge(address bridge) external onlyDLE {
        ITreasuryFunds(treasury).setFundsBridge(bridge);
    }

    function addToken(
        address tokenAddress,
        string memory symbol,
        uint8 decimals
    ) external onlyDLE {
        ITreasuryFunds(treasury).addToken(tokenAddress, symbol, decimals);
    }

    function removeToken(address tokenAddress) external onlyDLE {
        ITreasuryFunds(treasury).removeToken(tokenAddress);
    }

    function setTokenStatus(address tokenAddress, bool isActive) external onlyDLE {
        ITreasuryFunds(treasury).setTokenStatus(tokenAddress, isActive);
    }
}
