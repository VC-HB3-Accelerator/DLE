// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title GovernanceTimelock
 * @dev Контракт таймлока для DAO, обеспечивающий задержку между одобрением и исполнением предложений
 */
contract GovernanceTimelock is TimelockController {
    /**
     * @dev Конструктор
     * @param minDelay Минимальная задержка в секундах перед выполнением транзакции
     * @param proposers Адреса, которые могут предлагать транзакции
     * @param executors Адреса, которые могут выполнять транзакции
     * @param admin Адрес администратора (обычно адрес нулевой для децентрализации)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(
        minDelay,
        proposers,
        executors,
        admin
    ) {}
} 