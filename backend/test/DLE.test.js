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
    let partner1, partner2, partner3;
    let addrs;
    let treasuryAddr, timelockAddr, readerAddr;

    const SAMPLE_CONFIG = {
        name: "Test DLE",
        symbol: "TDLE",
        location: "Test Location",
        coordinates: "0,0",
        jurisdiction: 1,
        okvedCodes: ["62.01"],
        kpp: 123456789,
        quorumPercentage: 51,
        initialPartners: [], // Will set in beforeEach
        initialAmounts: [],
        supportedChainIds: [1, 137]
    };

    beforeEach(async function () {
        [owner, partner1, partner2, partner3, ...addrs] = await ethers.getSigners();

        DLE = await ethers.getContractFactory("DLE");

        SAMPLE_CONFIG.initialPartners = [partner1.address, partner2.address, partner3.address];
        SAMPLE_CONFIG.initialAmounts = [ethers.parseEther("100"), ethers.parseEther("100"), ethers.parseEther("100")];

        dle = await DLE.deploy(SAMPLE_CONFIG, 1, owner.address); // currentChainId=1
        await dle.waitForDeployment();

        // Используем EOAs как адреса модулей (ядро не проверяет код при инициализации)
        treasuryAddr = addrs[0].address;
        timelockAddr = addrs[1].address;
        readerAddr = addrs[2].address;

        // Initialize base modules
        await dle.initializeBaseModules(treasuryAddr, timelockAddr, readerAddr);
    });

    describe("Deployment and Initialization", function () {
        it("Should set correct initial state", async function () {
            const info = await dle.dleInfo();
            expect(info.name).to.equal(SAMPLE_CONFIG.name);
            expect(info.symbol).to.equal(SAMPLE_CONFIG.symbol);
            expect(await dle.quorumPercentage()).to.equal(SAMPLE_CONFIG.quorumPercentage);
            expect(await dle.currentChainId()).to.equal(1);
            expect(await dle.totalSupply()).to.equal(ethers.parseEther("300"));
        });

        it("Should distribute initial tokens and delegate", async function () {
            expect(await dle.balanceOf(partner1.address)).to.equal(ethers.parseEther("100"));
            expect(await dle.getVotes(partner1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should initialize modules correctly", async function () {
            // Modules are already initialized in beforeEach
            expect(await dle.modules(ethers.keccak256(ethers.toUtf8Bytes("TREASURY")))).to.equal(treasuryAddr);
            expect(await dle.modulesInitialized()).to.be.true;

            // Cannot initialize twice
            await expect(dle.initializeBaseModules(treasuryAddr, timelockAddr, readerAddr))
                .to.be.revertedWithCustomError(dle, "ErrProposalExecuted");
        });

        it("Should prevent non-initializer from initializing modules", async function () {
            // Create a new DLE instance for this test
            const newDle = await DLE.deploy(SAMPLE_CONFIG, 1, owner.address);
            await newDle.waitForDeployment();
            
            await expect(newDle.connect(partner1).initializeBaseModules(treasuryAddr, timelockAddr, readerAddr))
                .to.be.revertedWithCustomError(newDle, "ErrOnlyInitializer");
        });

        it("Should prevent initialization with zero addresses", async function () {
            // Create a new DLE instance for this test
            const newDle = await DLE.deploy(SAMPLE_CONFIG, 1, owner.address);
            await newDle.waitForDeployment();
            
            await expect(newDle.initializeBaseModules(ethers.ZeroAddress, timelockAddr, readerAddr))
                .to.be.revertedWithCustomError(newDle, "ErrZeroAddress");
        });
    });

    describe("Proposals", function () {
        it("Should create a proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();

            expect(await dle.proposalCounter()).to.equal(1);
        });

        it("Should not allow non-holders to create proposals", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            await expect(dle.connect(addrs[0]).createProposal(description, duration, operation, governanceChainId, targetChains, 0))
                .to.be.revertedWithCustomError(dle, "ErrNotHolder");
        });

        it("Should prevent creating proposal with too short duration", async function () {
            const description = "Test Proposal";
            const duration = 59; // Less than minimum
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            await expect(dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0))
                .to.be.revertedWithCustomError(dle, "ErrTooShort");
        });

        it("Should prevent creating proposal with too long duration", async function () {
            const description = "Test Proposal";
            const duration = 30 * 24 * 60 * 60 + 1; // More than maximum
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            await expect(dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0))
                .to.be.revertedWithCustomError(dle, "ErrTooLong");
        });

        it("Should prevent creating proposal with unsupported governance chain", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 999; // Unsupported chain
            const targetChains = [1, 137];

            await expect(dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0))
                .to.be.revertedWithCustomError(dle, "ErrBadChain");
        });

        it("Should prevent creating proposal with unsupported target chain", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [999]; // Unsupported chain

            await expect(dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0))
                .to.be.revertedWithCustomError(dle, "ErrBadTarget");
        });
    });

    describe("Voting System", function () {
        it("Should allow token holders to vote", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).vote(proposalId, true);
            const proposal = await dle.proposals(proposalId);
            expect(proposal.forVotes).to.equal(ethers.parseEther("100"));
        });

        it("Should allow voting against proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).vote(proposalId, false);
            const proposal = await dle.proposals(proposalId);
            expect(proposal.againstVotes).to.equal(ethers.parseEther("100"));
        });

        it("Should prevent voting twice", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).vote(proposalId, true);
            await expect(dle.connect(partner1).vote(proposalId, true))
                .to.be.revertedWithCustomError(dle, "ErrAlreadyVoted");
        });

        it("Should prevent voting on non-existent proposal", async function () {
            await expect(dle.connect(partner1).vote(999, true))
                .to.be.revertedWithCustomError(dle, "ErrProposalMissing");
        });

        it("Should prevent voting after deadline", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            await expect(dle.connect(partner1).vote(proposalId, true))
                .to.be.revertedWithCustomError(dle, "ErrProposalEnded");
        });

        it("Should prevent voting in wrong chain", async function () {
            // Create DLE in different chain
            const DLE2 = await ethers.getContractFactory("DLE");
            const cfg2 = { ...SAMPLE_CONFIG, supportedChainIds: [1, 2] };
            const dle2 = await DLE2.deploy(cfg2, 2, owner.address);
            await dle2.waitForDeployment();

            // Initialize modules
            await dle2.initializeBaseModules(treasuryAddr, timelockAddr, readerAddr);

            const description = "Cross-chain proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [2];

            await dle2.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);

            await expect(dle2.connect(partner1).vote(0, true))
                .to.be.revertedWithCustomError(dle2, "ErrWrongChain");
        });

        it("Should prevent voting without tokens", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await expect(dle.connect(addrs[0]).vote(proposalId, true))
                .to.be.revertedWithCustomError(dle, "ErrNoPower");
        });
    });

    describe("Proposal Result Checking", function () {
        it("Should return correct result for passed proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;
        });

        it("Should return correct result for failed proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote against
            await dle.connect(partner1).vote(proposalId, false);
            await dle.connect(partner2).vote(proposalId, false);

            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.false;
            expect(quorumReached).to.be.true;
        });

        it("Should return correct result for proposal without quorum", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with insufficient quorum
            await dle.connect(partner1).vote(proposalId, true);

            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.false;
            expect(quorumReached).to.be.false;
        });

        it("Should handle non-existent proposal", async function () {
            await expect(dle.checkProposalResult(999))
                .to.be.revertedWithCustomError(dle, "ErrProposalMissing");
        });
    });

    describe("Execution by signatures (EIP-712)", function () {
        it("Should execute proposal in non-governance chain with quorum signatures", async function () {
            // Deploy DLE with currentChainId=2 and support [1,2]
            const DLE2 = await ethers.getContractFactory("DLE");
            const cfg2 = {
                name: SAMPLE_CONFIG.name,
                symbol: SAMPLE_CONFIG.symbol,
                location: SAMPLE_CONFIG.location,
                coordinates: SAMPLE_CONFIG.coordinates,
                jurisdiction: SAMPLE_CONFIG.jurisdiction,
                okvedCodes: SAMPLE_CONFIG.okvedCodes,
                kpp: SAMPLE_CONFIG.kpp,
                quorumPercentage: 51,
                initialPartners: [partner1.address, partner2.address, partner3.address],
                initialAmounts: [ethers.parseEther("100"), ethers.parseEther("100"), ethers.parseEther("100")],
                supportedChainIds: [1, 2]
            };
            const dle2 = await DLE2.deploy(cfg2, 2, owner.address);
            await dle2.waitForDeployment();

            // Initialize modules
            await dle2.initializeBaseModules(treasuryAddr, timelockAddr, readerAddr);

            // Create proposal with governanceChainId=1 and targetChains=[2]
            // Use a valid operation - add a module
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TEST_MODULE"));
            const moduleAddress = addrs[5].address;
            
            const tx = await dle2.connect(partner1).createAddModuleProposal("Sig Exec", 3600, moduleId, moduleAddress, 1);
            const receipt = await tx.wait();
            const proposalId = (await dle2.proposalCounter()) - 1n;

            // Get snapshotTimepoint
            const p = await dle2.proposals(proposalId);
            const snapshotTimepoint = p.snapshotTimepoint;

            // Create EIP-712 signatures for three partners
            const domain = {
                name: cfg2.name,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await dle2.getAddress()
            };

            const types = {
                ExecutionApproval: [
                    { name: "proposalId", type: "uint256" },
                    { name: "operationHash", type: "bytes32" },
                    { name: "chainId", type: "uint256" },
                    { name: "snapshotTimepoint", type: "uint256" }
                ]
            };

            const value = {
                proposalId: proposalId,
                operationHash: ethers.keccak256(p.operation),
                chainId: 2,
                snapshotTimepoint
            };

            const sig1 = await partner1.signTypedData(domain, types, value);
            const sig2 = await partner2.signTypedData(domain, types, value);
            const sig3 = await partner3.signTypedData(domain, types, value);

            // Execute by signatures (quorum 51%, total 300 -> need 153, we have 300)
            await expect(dle2.executeProposalBySignatures(proposalId, [partner1.address, partner2.address, partner3.address], [sig1, sig2, sig3]))
                .to.emit(dle2, "ProposalExecuted");
        });
    });

    describe("Token Transfer Blocking", function () {
        it("Should revert direct transfers", async function () {
            await expect(dle.connect(partner1).transfer(partner2.address, ethers.parseEther("10")))
                .to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });

        it("Should revert approvals", async function () {
            await expect(dle.connect(partner1).approve(partner2.address, ethers.parseEther("10")))
                .to.be.revertedWithCustomError(dle, "ErrApprovalsDisabled");
        });

        it("Should revert transferFrom", async function () {
            await expect(dle.connect(partner2).transferFrom(partner1.address, partner3.address, ethers.parseEther("10")))
                .to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });
    });

    describe("Chain Management", function () {
        it("Should return correct chain information", async function () {
            expect(await dle.getSupportedChainCount()).to.equal(2);
            expect(await dle.getSupportedChainId(0)).to.equal(1);
            expect(await dle.getSupportedChainId(1)).to.equal(137);
            expect(await dle.getCurrentChainId()).to.equal(1);
        });
    });

    describe("View Functions", function () {
        it("Should return correct DLE info", async function () {
            const info = await dle.dleInfo();
            expect(info.name).to.equal(SAMPLE_CONFIG.name);
            expect(info.symbol).to.equal(SAMPLE_CONFIG.symbol);
            expect(info.location).to.equal(SAMPLE_CONFIG.location);
            expect(info.coordinates).to.equal(SAMPLE_CONFIG.coordinates);
            expect(info.jurisdiction).to.equal(SAMPLE_CONFIG.jurisdiction);
            expect(info.kpp).to.equal(SAMPLE_CONFIG.kpp);
            expect(info.isActive).to.be.true;
        });

        it("Should return correct voting power", async function () {
            expect(await dle.getVotes(partner1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should return correct nonces", async function () {
            expect(await dle.nonces(partner1.address)).to.equal(0);
        });
    });

    describe("Delegation", function () {
        it("Should allow self-delegation", async function () {
            await dle.connect(partner1).delegate(partner1.address);
            expect(await dle.getVotes(partner1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should prevent delegation to others", async function () {
            await expect(dle.connect(partner1).delegate(partner2.address))
                .to.be.revertedWith("Delegation disabled");
        });
    });

    describe("Error Handling", function () {
        it("Should handle invalid operations", async function () {
            await expect(dle.connect(partner1).transfer(partner2.address, ethers.parseEther("10")))
                .to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });

        it("Should handle unsupported operations", async function () {
            await expect(dle.connect(partner1).approve(partner2.address, ethers.parseEther("10")))
                .to.be.revertedWithCustomError(dle, "ErrApprovalsDisabled");
        });
    });

    describe("Proposal Cancellation", function () {
        it("Should allow canceling proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).cancelProposal(proposalId, "Test cancellation");
            const proposal = await dle.proposals(proposalId);
            expect(proposal.canceled).to.be.true;
        });

        it("Should prevent voting on canceled proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).cancelProposal(proposalId, "Test cancellation");

            await expect(dle.connect(partner1).vote(proposalId, true))
                .to.be.revertedWithCustomError(dle, "ErrProposalCanceled");
        });

        it("Should prevent executing canceled proposal", async function () {
            const description = "Test Proposal";
            const duration = 3600;
            const operation = ethers.toUtf8Bytes("test operation");
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            await dle.connect(partner1).cancelProposal(proposalId, "Test cancellation");

            await expect(dle.executeProposal(proposalId))
                .to.be.revertedWithCustomError(dle, "ErrProposalCanceled");
        });
    });

    describe("Logo URI Management", function () {
        it("Should allow initializer to set logo URI", async function () {
            const logoURI = "https://example.com/logo.png";
            await dle.initializeLogoURI(logoURI);
            expect(await dle.logoURI()).to.equal(logoURI);
        });

        it("Should prevent setting logo URI twice", async function () {
            const logoURI = "https://example.com/logo.png";
            await dle.initializeLogoURI(logoURI);
            await expect(dle.initializeLogoURI(logoURI))
                .to.be.revertedWithCustomError(dle, "ErrLogoAlreadySet");
        });

        it("Should prevent non-initializer from setting logo", async function () {
            const logoURI = "https://example.com/logo.png";
            await expect(dle.connect(partner1).initializeLogoURI(logoURI))
                .to.be.revertedWithCustomError(dle, "ErrOnlyInitializer");
        });
    });

    describe("Module Management", function () {
        it("Should add module through governance", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TEST_MODULE"));
            const moduleAddress = addrs[5].address;

            // Create proposal to add module
            const description = "Add test module";
            const duration = 3600;
            const chainId = 1;

            const tx = await dle.connect(partner1).createAddModuleProposal(description, duration, moduleId, moduleAddress, chainId);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(proposalId);

            // Verify module was added
            expect(await dle.activeModules(moduleId)).to.be.true;
            expect(await dle.modules(moduleId)).to.equal(moduleAddress);
        });

        it("Should remove module through governance", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TEST_MODULE_FOR_REMOVAL"));
            const moduleAddress = addrs[6].address;

            // First add the module
            const addDescription = "Add test module for removal";
            const duration = 3600;
            const chainId = 1;

            const addTx = await dle.connect(partner1).createAddModuleProposal(addDescription, duration, moduleId, moduleAddress, chainId);
            const addReceipt = await addTx.wait();
            const addProposalId = (await dle.proposalCounter()) - 1n;

            // Vote and execute add proposal
            await dle.connect(partner1).vote(addProposalId, true);
            await dle.connect(partner2).vote(addProposalId, true);

            // Check proposal result
            const [addPassed, addQuorumReached] = await dle.checkProposalResult(addProposalId);
            expect(addPassed).to.be.true;
            expect(addQuorumReached).to.be.true;

            await dle.executeProposal(addProposalId);

            // Now create proposal to remove module
            const removeDescription = "Remove test module";
            const removeTx = await dle.connect(partner1).createRemoveModuleProposal(removeDescription, duration, moduleId, chainId);
            const removeReceipt = await removeTx.wait();
            const removeProposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(removeProposalId, true);
            await dle.connect(partner2).vote(removeProposalId, true);

            // Check proposal result
            const [removePassed, removeQuorumReached] = await dle.checkProposalResult(removeProposalId);
            expect(removePassed).to.be.true;
            expect(removeQuorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(removeProposalId);

            // Verify module was removed
            expect(await dle.activeModules(moduleId)).to.be.false;
            expect(await dle.modules(moduleId)).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Chain Management", function () {
        it("Should add supported chain through governance", async function () {
            const newChainId = 56; // BSC

            // Create proposal to add chain using internal operation
            const description = "Add BSC chain";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _addSupportedChain(uint256 chainId)"
            ]);
            const operation = dleInterface.encodeFunctionData("_addSupportedChain", [newChainId]);
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(proposalId);

            // Verify chain was added
            expect(await dle.supportedChains(newChainId)).to.be.true;
        });

        it("Should remove supported chain through governance", async function () {
            const chainToRemove = 137; // Polygon

            // Create proposal to remove chain using internal operation
            const description = "Remove Polygon chain";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _removeSupportedChain(uint256 chainId)"
            ]);
            const operation = dleInterface.encodeFunctionData("_removeSupportedChain", [chainToRemove]);
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(proposalId);

            // Verify chain was removed
            expect(await dle.supportedChains(chainToRemove)).to.be.false;
        });

        it("Should prevent removing current chain", async function () {
            const currentChainId = 1;

            // Create proposal to remove current chain using internal operation
            const description = "Remove current chain";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _removeSupportedChain(uint256 chainId)"
            ]);
            const operation = dleInterface.encodeFunctionData("_removeSupportedChain", [currentChainId]);
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal should fail
            await expect(dle.executeProposal(proposalId))
                .to.be.revertedWith("Cannot remove current chain");
        });
    });

    describe("DLE Information Management", function () {
        it("Should update quorum percentage through governance", async function () {
            const newQuorum = 60;

            // Create proposal to update quorum using internal operation
            const description = "Update quorum percentage";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [newQuorum]);
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(proposalId);

            // Verify quorum was updated
            expect(await dle.quorumPercentage()).to.equal(newQuorum);
        });

        it("Should update voting durations through governance", async function () {
            const newMinDuration = 7200; // 2 hours
            const newMaxDuration = 14 * 24 * 60 * 60; // 14 days

            // Create proposal to update durations using internal operation
            const description = "Update voting durations";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateVotingDurations(uint256 minDuration, uint256 maxDuration)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateVotingDurations", [newMinDuration, newMaxDuration]);
            const governanceChainId = 1;
            const targetChains = [1, 137];

            const tx = await dle.connect(partner1).createProposal(description, duration, operation, governanceChainId, targetChains, 0);
            const receipt = await tx.wait();
            const proposalId = (await dle.proposalCounter()) - 1n;

            // Vote with quorum
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);

            // Check proposal result
            const [passed, quorumReached] = await dle.checkProposalResult(proposalId);
            expect(passed).to.be.true;
            expect(quorumReached).to.be.true;

            // Execute proposal
            await dle.executeProposal(proposalId);

            // Verify durations were updated
            expect(await dle.minVotingDuration()).to.equal(newMinDuration);
            expect(await dle.maxVotingDuration()).to.equal(newMaxDuration);
        });
    });

    describe("Token Management", function () {
        it("Should prevent insufficient balance transfer", async function () {
            await expect(dle.connect(partner1).transfer(partner2.address, ethers.parseEther("1000")))
                .to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });
    });

    describe("Proposal State Management", function () {
        it("Should handle non-existent proposal state", async function () {
            await expect(dle.getProposalState(999))
                .to.be.revertedWith("Proposal does not exist");
        });

        it("Should return DLE info", async function () {
            const info = await dle.dleInfo();
            expect(info.name).to.equal(SAMPLE_CONFIG.name);
            expect(info.symbol).to.equal(SAMPLE_CONFIG.symbol);
            expect(info.location).to.equal(SAMPLE_CONFIG.location);
            expect(info.coordinates).to.equal(SAMPLE_CONFIG.coordinates);
            expect(info.jurisdiction).to.equal(SAMPLE_CONFIG.jurisdiction);
            expect(info.kpp).to.equal(SAMPLE_CONFIG.kpp);
            expect(info.isActive).to.be.true;
        });

        it("Should check if module is active", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("NON_EXISTENT"));
            expect(await dle.activeModules(moduleId)).to.be.false;
        });

        it("Should return module address", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("NON_EXISTENT"));
            expect(await dle.modules(moduleId)).to.equal(ethers.ZeroAddress);
        });

        it("Should check if chain is supported", async function () {
            expect(await dle.supportedChains(1)).to.be.true;
            expect(await dle.supportedChains(137)).to.be.true;
            expect(await dle.supportedChains(999)).to.be.false;
        });

        it("Should return current chain ID", async function () {
            expect(await dle.currentChainId()).to.equal(1);
        });

        it("Should check if DLE is active", async function () {
            const info = await dle.dleInfo();
            expect(info.isActive).to.be.true;
        });

        it("Should prevent adding zero address module", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("TEST_MODULE"));

            // Create proposal to add zero address module
            const description = "Add Zero Address Module";
            const duration = 3600;
            const chainId = 1;

            await expect(dle.connect(partner1).createAddModuleProposal(description, duration, moduleId, ethers.ZeroAddress, chainId))
                .to.be.revertedWithCustomError(dle, "ErrZeroAddress");
        });

        it("Should prevent adding duplicate module", async function () {
            // Test that we can't add modules that already exist
            const treasuryId = ethers.keccak256(ethers.toUtf8Bytes("TREASURY"));
            const newTreasuryAddress = addrs[6].address;

            // Try to add TREASURY module again (it already exists)
            await expect(dle.connect(partner1).createAddModuleProposal("Add Duplicate Treasury", 3600, treasuryId, newTreasuryAddress, 1))
                .to.be.revertedWithCustomError(dle, "ErrProposalExecuted");
        });

        it("Should prevent removing non-existent module", async function () {
            const moduleId = ethers.keccak256(ethers.toUtf8Bytes("NONEXISTENT_MODULE"));

            // Create a proposal to remove non-existent module should revert immediately
            await expect(dle.connect(partner1).createRemoveModuleProposal(
                "Remove non-existent module",
                2 * 24 * 60 * 60, // 2 days
                moduleId,
                1 // chainId
            )).to.be.revertedWithCustomError(dle, "ErrProposalMissing");
        });
    });

    describe("Additional Coverage Tests", function () {
        it("Should test getProposalState for all states", async function () {
            // Создаем предложение
            const description = "Test proposal for state coverage";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // State 0: Pending (до голосования)
            expect(await dle.getProposalState(proposalId)).to.equal(0);

            // State 5: ReadyForExecution (прошло голосование, достигнут кворум)
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);
            await dle.connect(partner3).vote(proposalId, true);
            expect(await dle.getProposalState(proposalId)).to.equal(5);

            // State 3: Executed (исполнено)
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            await dle.executeProposal(proposalId);
            expect(await dle.getProposalState(proposalId)).to.equal(3);
        });

        it("Should test getProposalState for defeated proposal", async function () {
            // Создаем предложение
            const description = "Test proposal for defeat";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // Голосуем против
            await dle.connect(partner1).vote(proposalId, false);
            await dle.connect(partner2).vote(proposalId, false);
            await dle.connect(partner3).vote(proposalId, false);

            // State 2: Defeated (прошло время голосования и не прошло)
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");
            expect(await dle.getProposalState(proposalId)).to.equal(2);
        });

        it("Should test getProposalState for canceled proposal", async function () {
            // Создаем предложение
            const description = "Test proposal for cancellation";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // State 4: Canceled
            await dle.connect(partner1).cancelProposal(proposalId, "Test cancellation");
            expect(await dle.getProposalState(proposalId)).to.equal(4);
        });

        it("Should test getProposalState for ready for execution", async function () {
            // Создаем предложение
            const description = "Test proposal for ready state";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // Голосуем за
            await dle.connect(partner1).vote(proposalId, true);
            await dle.connect(partner2).vote(proposalId, true);
            await dle.connect(partner3).vote(proposalId, true);

            // State 5: ReadyForExecution (прошло голосование, достигнут кворум, но еще не исполнено)
            expect(await dle.getProposalState(proposalId)).to.equal(5);
        });

        it("Should test _isTargetChain function", async function () {
            // Создаем предложение с несколькими целевыми цепочками
            const description = "Test proposal with multiple target chains";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1, 137], 0);
            const proposalId = 0;

            // Проверяем что предложение создано с правильными целевыми цепочками
            // Используем getProposalState для проверки что предложение создано корректно
            expect(await dle.getProposalState(proposalId)).to.equal(0);
            
            // Проверяем что предложение существует и можно голосовать
            await dle.connect(partner1).vote(proposalId, true);
            expect(await dle.getProposalState(proposalId)).to.equal(0); // все еще pending
        });

        it("Should test _update function override", async function () {
            // Тестируем делегирование (которое вызывает _update)
            await dle.connect(partner1).delegate(partner1.address);
            expect(await dle.delegates(partner1.address)).to.equal(partner1.address);
        });

        it("Should test nonces function override", async function () {
            // Тестируем nonces
            const nonce = await dle.nonces(partner1.address);
            expect(nonce).to.be.a("bigint");
        });

        it("Should test _delegate function override", async function () {
            // Тестируем делегирование самому себе (разрешено)
            await dle.connect(partner1).delegate(partner1.address);
            expect(await dle.delegates(partner1.address)).to.equal(partner1.address);

            // Тестируем делегирование другому (запрещено)
            await expect(dle.connect(partner1).delegate(partner2.address))
                .to.be.revertedWith("Delegation disabled");
        });

        it("Should test isActive function", async function () {
            // По умолчанию DLE активен
            expect(await dle.isActive()).to.be.true;
        });

        it("Should test getModuleAddress for non-existent module", async function () {
            // Тестируем getModuleAddress для несуществующего модуля
            const nonExistentModuleId = ethers.id("NON_EXISTENT");
            const address = await dle.getModuleAddress(nonExistentModuleId);
            expect(address).to.equal(ethers.ZeroAddress);
        });

        it("Should test isChainSupported for non-supported chain", async function () {
            // Тестируем isChainSupported для неподдерживаемой цепочки
            expect(await dle.isChainSupported(999)).to.be.false;
        });

        it("Should test getCurrentChainId", async function () {
            // Тестируем getCurrentChainId
            const currentChainId = await dle.getCurrentChainId();
            expect(currentChainId).to.equal(1); // По умолчанию 1
        });

        it("Should test getDLEInfo", async function () {
            // Тестируем getDLEInfo
            const dleInfo = await dle.getDLEInfo();
            expect(dleInfo.name).to.equal("Test DLE");
            expect(dleInfo.symbol).to.equal("TDLE");
            expect(dleInfo.location).to.equal("Test Location");
            expect(dleInfo.coordinates).to.equal("0,0");
            expect(dleInfo.jurisdiction).to.equal(1);
            expect(dleInfo.okvedCodes).to.deep.equal(["62.01"]);
            expect(dleInfo.kpp).to.equal(123456789); // Исправляем ожидаемое значение
            expect(dleInfo.isActive).to.be.true;
        });

        it("Should test isModuleActive for existing module", async function () {
            // Тестируем isModuleActive для существующего модуля
            const treasuryId = ethers.id("TREASURY");
            expect(await dle.isModuleActive(treasuryId)).to.be.true;
        });

        it("Should test isModuleActive for non-existent module", async function () {
            // Тестируем isModuleActive для несуществующего модуля
            const nonExistentModuleId = ethers.id("NON_EXISTENT");
            expect(await dle.isModuleActive(nonExistentModuleId)).to.be.false;
        });

        it("Should test getProposalState for non-existent proposal", async function () {
            // Тестируем getProposalState для несуществующего предложения
            await expect(dle.getProposalState(999))
                .to.be.revertedWith("Proposal does not exist");
        });

        it("Should test getProposalState for defeated after deadline", async function () {
            // Создаем предложение
            const description = "Test proposal for defeated after deadline";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // Голосуем против
            await dle.connect(partner1).vote(proposalId, false);
            await dle.connect(partner2).vote(proposalId, false);
            // partner3 не голосует

            // Проходит время голосования
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // State 2: Defeated (прошло время голосования и не прошло)
            expect(await dle.getProposalState(proposalId)).to.equal(2);
        });

        it("Should test getProposalState for pending during voting", async function () {
            // Создаем предложение
            const description = "Test proposal for pending during voting";
            const duration = 3600;
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);
            
            await dle.connect(partner1).createProposal(description, duration, operation, 1, [1], 0);
            const proposalId = 0;

            // Голосуем только один раз
            await dle.connect(partner1).vote(proposalId, true);

            // State 0: Pending (голосование еще идет, не достигнут кворум)
            expect(await dle.getProposalState(proposalId)).to.equal(0);
        });

        it("Should test getProposalState for pending with mixed votes", async function () {
            // Create a proposal using partner1 who has tokens
            const tx = await dle.connect(partner1).createProposal(
                "Test proposal with mixed votes",
                3600,
                "0x12345678",
                1,
                [1], // Only supported chain
                partner1.address
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "ProposalCreated");
            const proposalId = event.args.proposalId;

            // Vote for the proposal
            await dle.connect(partner1).vote(proposalId, true);

            // Vote against the proposal
            await dle.connect(partner2).vote(proposalId, false);

            // Check proposal state (should be pending)
            const state = await dle.getProposalState(proposalId);
            expect(state).to.equal(0); // Pending
        });

        it("Should test blocked transfer function", async function () {
            // Try to transfer tokens (should be blocked)
            await expect(
                dle.connect(addrs[0]).transfer(addrs[1].address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });

        it("Should test blocked transferFrom function", async function () {
            // Try to transfer tokens via transferFrom (should be blocked)
            await expect(
                dle.connect(addrs[0]).transferFrom(addrs[0].address, addrs[1].address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(dle, "ErrTransfersDisabled");
        });

        it("Should test blocked approve function", async function () {
            // Try to approve tokens (should be blocked)
            await expect(
                dle.connect(addrs[0]).approve(addrs[1].address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(dle, "ErrApprovalsDisabled");
        });

        it("Should test token transfer through governance", async function () {
            // Create a proposal to transfer tokens using a simple operation
            const dleInterface = new ethers.Interface([
                "function _updateQuorumPercentage(uint256 newQuorumPercentage)"
            ]);
            const operation = dleInterface.encodeFunctionData("_updateQuorumPercentage", [60]);

            const tx = await dle.connect(partner1).createProposal(
                "Update quorum percentage",
                3600,
                operation,
                1,
                [1],
                partner1.address
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment && log.fragment.name === "ProposalCreated");
            const proposalId = event.args.proposalId;

            // Vote for the proposal
            await dle.connect(partner1).vote(proposalId, true);

            // Vote for the proposal with partner2 to reach quorum
            await dle.connect(partner2).vote(proposalId, true);

            // Advance time to pass deadline
            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine");

            // Execute the proposal
            await dle.connect(partner1).executeProposal(proposalId);

            // Check that quorum was updated
            const quorumPercentage = await dle.quorumPercentage();
            expect(quorumPercentage).to.equal(60);
        });
    });
});