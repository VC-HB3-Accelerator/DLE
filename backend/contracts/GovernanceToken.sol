// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title GovernanceToken
 * @dev Токен управления ERC20Votes с функциями голосования для DAO
 */
contract GovernanceToken is ERC20Permit, ERC20Votes, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(initialOwner) {
        // Конструктор остается пустым, начальное распределение происходит через
        // вызов функции mintInitialSupply ниже
    }

    /**
     * @dev Минтит начальный запас токенов для распределения между партнерами
     * @param partners Массив адресов партнеров
     * @param amounts Массив сумм токенов для каждого партнера
     */
    function mintInitialSupply(
        address[] memory partners,
        uint256[] memory amounts
    ) external onlyOwner {
        require(partners.length == amounts.length, "Arrays length mismatch");
        require(partners.length > 0, "Empty arrays");

        uint256 totalSupply = 0;
        for (uint256 i = 0; i < partners.length; i++) {
            require(partners[i] != address(0), "Zero address");
            require(amounts[i] > 0, "Zero amount");
            
            totalSupply += amounts[i];
            _mint(partners[i], amounts[i]);
        }

        // После начального распределения отказываемся от права создавать новые токены
        renounceOwnership();
    }

    // Переопределения, необходимые для корректной работы токена голосования

    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
} 