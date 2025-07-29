/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DLE Smart Contract", function () {
    let DLE;
    let dle;
    let owner;
    let partner1;
    let partner2;
    let partner3;
    let addrs;

    beforeEach(async function () {
        // Получаем аккаунты
        [owner, partner1, partner2, partner3, ...addrs] = await ethers.getSigners();

        // Деплоим контракт
        const DLEFactory = await ethers.getContractFactory("DLE");
        
        const config = {
            name: "Digital Legal Entity",
            symbol: "DLE",
            location: "Moscow, Russia",
            coordinates: "55.7558,37.6176",
            jurisdiction: 1, // Россия
            oktmo: 45000000000,
            okvedCodes: ["62.01", "62.02", "62.03"],
            kpp: 770101001,
            quorumPercentage: 60, // 60%
            initialPartners: [partner1.address, partner2.address, partner3.address],
            initialAmounts: [ethers.parseEther("1000"), ethers.parseEther("1000"), ethers.parseEther("1000")],
            supportedChainIds: [1, 137, 56, 42161] // Ethereum, Polygon, BSC, Arbitrum
        };

        dle = await DLEFactory.deploy(config, 1); // ChainId = 1 (Ethereum)
        await dle.waitForDeployment();
    });

    describe("Деплой и инициализация", function () {
        it("Должен правильно инициализировать DLE", async function () {
            const dleInfo = await dle.getDLEInfo();
            
            expect(dleInfo.name).to.equal("Digital Legal Entity");
            expect(dleInfo.symbol).to.equal("DLE");
            expect(dleInfo.location).to.equal("Moscow, Russia");
            expect(dleInfo.jurisdiction).to.equal(1);
            expect(dleInfo.isActive).to.be.true;
        });

        it("Должен распределить начальные токены", async function () {
            expect(await dle.balanceOf(partner1.address)).to.equal(ethers.parseEther("1000"));
            expect(await dle.balanceOf(partner2.address)).to.equal(ethers.parseEther("1000"));
            expect(await dle.balanceOf(partner3.address)).to.equal(ethers.parseEther("1000"));
        });

        it("Должен установить кворум", async function () {
            expect(await dle.quorumPercentage()).to.equal(60);
        });

        it("Должен настроить поддерживаемые цепочки", async function () {
            expect(await dle.isChainSupported(1)).to.be.true;      // Ethereum
            expect(await dle.isChainSupported(137)).to.be.true;     // Polygon
            expect(await dle.isChainSupported(56)).to.be.true;      // BSC
            expect(await dle.isChainSupported(42161)).to.be.true;   // Arbitrum
            expect(await dle.isChainSupported(999)).to.be.false;    // Неподдерживаемая цепочка
        });
    });

    describe("Система голосования", function () {
        it("Должен создать предложение", async function () {
            const description = "Передать 100 токенов от Partner1 к Partner2";
            const duration = 7 * 24 * 60 * 60; // 7 дней
            const operation = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes4", "bytes"],
                [
                    "0xa9059cbb", // transfer(address,uint256) selector
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["address", "uint256"],
                        [partner2.address, ethers.parseEther("100")]
                    )
                ]
            );

            const tx = await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1 // governanceChainId = Ethereum
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "ProposalCreated"
            );

            expect(event).to.not.be.undefined;
            expect(await dle.proposalCounter()).to.equal(1);
        });

        it("Должен голосовать за предложение", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Голосуем за предложение
            await dle.connect(partner1).vote(0, true);
            await dle.connect(partner2).vote(0, true);

            const proposal = await dle.proposals(0);
            expect(proposal.forVotes).to.equal(ethers.parseEther("2000")); // 1000 + 1000
            expect(proposal.againstVotes).to.equal(0);
        });

        it("Должен проверить результат голосования", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Голосуем за предложение (60% от 3000 = 1800)
            await dle.connect(partner1).vote(0, true); // 1000
            await dle.connect(partner2).vote(0, true); // 1000
            await dle.connect(partner3).vote(0, true); // 1000

            const [passed, quorumReached] = await dle.checkProposalResult(0);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;
        });

        it("Не должен позволить голосовать дважды", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Первое голосование
            await dle.connect(partner1).vote(0, true);

            // Второе голосование должно упасть
            await expect(
                dle.connect(partner1).vote(0, true)
            ).to.be.revertedWith("Already voted");
        });

        it("Не должен позволить голосовать без токенов", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Голосование без токенов должно упасть
            await expect(
                dle.connect(addrs[0]).vote(0, true)
            ).to.be.revertedWith("No tokens to vote");
        });
    });

    describe("Мультиподпись", function () {
        it("Должен создать мультиподпись операцию", async function () {
            const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
            const duration = 7 * 24 * 60 * 60;

            const tx = await dle.connect(partner1).createMultiSigOperation(
                operationHash,
                duration
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => 
                log.fragment && log.fragment.name === "MultiSigOperationCreated"
            );

            expect(event).to.not.be.undefined;
            expect(await dle.multiSigCounter()).to.equal(1);
        });

        it("Должен подписать мультиподпись операцию", async function () {
            const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
            const duration = 7 * 24 * 60 * 60;

            await dle.connect(partner1).createMultiSigOperation(
                operationHash,
                duration
            );

            // Подписываем операцию
            await dle.connect(partner1).signMultiSigOperation(0, true);
            await dle.connect(partner2).signMultiSigOperation(0, true);

            const operation = await dle.multiSigOperations(0);
            expect(operation.forSignatures).to.equal(ethers.parseEther("2000")); // 1000 + 1000
            expect(operation.againstSignatures).to.equal(0);
        });

        it("Должен проверить результат мультиподписи", async function () {
            const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
            const duration = 7 * 24 * 60 * 60;

            await dle.connect(partner1).createMultiSigOperation(
                operationHash,
                duration
            );

            // Подписываем операцию (60% от 3000 = 1800)
            await dle.connect(partner1).signMultiSigOperation(0, true); // 1000
            await dle.connect(partner2).signMultiSigOperation(0, true); // 1000
            await dle.connect(partner3).signMultiSigOperation(0, true); // 1000

            const [passed, quorumReached] = await dle.checkMultiSigResult(0);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;
        });
    });

    describe("Мульти-чейн синхронизация", function () {
        it("Должен синхронизировать голоса из другой цепочки", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Синхронизируем голоса из другой цепочки
            await dle.connect(partner1).syncVoteFromChain(
                0, // proposalId
                137, // fromChainId (Polygon)
                ethers.parseEther("500"), // forVotes
                ethers.parseEther("200"), // againstVotes
                "0x" // proof
            );

            const proposal = await dle.proposals(0);
            expect(proposal.forVotes).to.equal(ethers.parseEther("500"));
            expect(proposal.againstVotes).to.equal(ethers.parseEther("200"));
        });

        it("Должен синхронизировать мультиподпись из другой цепочки", async function () {
            const operationHash = ethers.keccak256(ethers.toUtf8Bytes("test operation"));
            const duration = 7 * 24 * 60 * 60;

            await dle.connect(partner1).createMultiSigOperation(
                operationHash,
                duration
            );

            // Синхронизируем мультиподпись из другой цепочки
            await dle.connect(partner1).syncMultiSigFromChain(
                0, // operationId
                137, // fromChainId (Polygon)
                ethers.parseEther("800"), // forSignatures
                ethers.parseEther("300"), // againstSignatures
                "0x" // proof
            );

            const operation = await dle.multiSigOperations(0);
            expect(operation.forSignatures).to.equal(ethers.parseEther("800"));
            expect(operation.againstSignatures).to.equal(ethers.parseEther("300"));
        });

        it("Должен проверить готовность синхронизации", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Проверяем готовность синхронизации
            const isReady = await dle.checkSyncReadiness(0);
            expect(isReady).to.be.true;
        });
    });

    describe("Управление модулями", function () {
        it("Должен добавить модуль", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TreasuryModule"));
            const moduleAddress = addrs[0].address;

            await dle.connect(partner1).addModule(moduleId, moduleAddress);

            expect(await dle.isModuleActive(moduleId)).to.be.true;
            expect(await dle.getModuleAddress(moduleId)).to.equal(moduleAddress);
        });

        it("Должен удалить модуль", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TreasuryModule"));
            const moduleAddress = addrs[0].address;

            await dle.connect(partner1).addModule(moduleId, moduleAddress);
            await dle.connect(partner1).removeModule(moduleId);

            expect(await dle.isModuleActive(moduleId)).to.be.false;
        });

        it("Не должен позволить добавить модуль без токенов", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TreasuryModule"));
            const moduleAddress = addrs[0].address;

            await expect(
                dle.connect(addrs[0]).addModule(moduleId, moduleAddress)
            ).to.be.revertedWith("Must hold tokens to add module");
        });
    });

    describe("Проверка подключений", function () {
        it("Должен проверить подключение к цепочке", async function () {
            expect(await dle.checkChainConnection(1)).to.be.true;      // Ethereum
            expect(await dle.checkChainConnection(137)).to.be.true;     // Polygon
            expect(await dle.checkChainConnection(56)).to.be.true;      // BSC
            expect(await dle.checkChainConnection(42161)).to.be.true;   // Arbitrum
            expect(await dle.checkChainConnection(999)).to.be.false;    // Неподдерживаемая цепочка
        });

        it("Должен получить количество поддерживаемых цепочек", async function () {
            expect(await dle.getSupportedChainCount()).to.equal(4);
        });

        it("Должен получить ID поддерживаемой цепочки", async function () {
            expect(await dle.getSupportedChainId(0)).to.equal(1);      // Ethereum
            expect(await dle.getSupportedChainId(1)).to.equal(137);    // Polygon
            expect(await dle.getSupportedChainId(2)).to.equal(56);     // BSC
            expect(await dle.getSupportedChainId(3)).to.equal(42161);  // Arbitrum
        });
    });

    describe("Исполнение операций", function () {
        it("Должен исполнить предложение с передачей токенов", async function () {
            // Создаем предложение для передачи токенов
            const description = "Передать 100 токенов от Partner1 к Partner2";
            const duration = 7 * 24 * 60 * 60;
            const operation = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes4", "bytes"],
                [
                    "0xa9059cbb", // transfer(address,uint256) selector
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["address", "uint256"],
                        [partner2.address, ethers.parseEther("100")]
                    )
                ]
            );

            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Голосуем за предложение
            await dle.connect(partner1).vote(0, true);
            await dle.connect(partner2).vote(0, true);
            await dle.connect(partner3).vote(0, true);

            // Ждем окончания голосования
            await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine");

            // Исполняем предложение
            await dle.connect(partner1).executeProposal(0);

            // Проверяем, что токены переданы
            expect(await dle.balanceOf(partner1.address)).to.equal(ethers.parseEther("900")); // 1000 - 100
            expect(await dle.balanceOf(partner2.address)).to.equal(ethers.parseEther("1100")); // 1000 + 100
        });
    });

    describe("Безопасность", function () {
        it("Не должен позволить создать предложение без токенов", async function () {
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";

            await expect(
                dle.connect(addrs[0]).createProposal(
                    description,
                    duration,
                    operation,
                    1
                )
            ).to.be.revertedWith("Must hold tokens to create proposal");
        });

        it("Не должен позволить голосовать после окончания срока", async function () {
            // Создаем предложение с коротким сроком
            const description = "Тестовое предложение";
            const duration = 1; // 1 секунда
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Ждем окончания срока
            await ethers.provider.send("evm_increaseTime", [2]);
            await ethers.provider.send("evm_mine");

            // Голосование должно упасть
            await expect(
                dle.connect(partner1).vote(0, true)
            ).to.be.revertedWith("Voting ended");
        });

        it("Не должен позволить исполнить предложение до окончания срока", async function () {
            // Создаем предложение
            const description = "Тестовое предложение";
            const duration = 7 * 24 * 60 * 60;
            const operation = "0x";
            
            await dle.connect(partner1).createProposal(
                description,
                duration,
                operation,
                1
            );

            // Голосуем за предложение
            await dle.connect(partner1).vote(0, true);
            await dle.connect(partner2).vote(0, true);
            await dle.connect(partner3).vote(0, true);

            // Исполнение должно упасть
            await expect(
                dle.connect(partner1).executeProposal(0)
            ).to.be.revertedWith("Voting not ended");
        });
    });
}); 