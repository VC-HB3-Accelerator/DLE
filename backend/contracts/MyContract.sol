// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    address public owner;
    uint256 public price;
    
    event Purchase(address buyer, uint256 amount);

    constructor() {
        owner = msg.sender;
        price = 0.01 ether; // Начальная цена 0.01 ETH
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    function setOwner(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }

    function setPrice(uint256 newPrice) public onlyOwner {
        price = newPrice;
    }

    function getPrice() public view returns (uint256) {
        return price;
    }

    function purchase(uint256 amount) public payable {
        require(msg.value == price * amount, "Incorrect payment amount");
        emit Purchase(msg.sender, amount);
    }

    function withdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
} 