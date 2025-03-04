const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('AccessToken', function () {
  let AccessToken;
  let accessToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    AccessToken = await ethers.getContractFactory('AccessToken');
    accessToken = await AccessToken.deploy();
  });

  describe('Minting', function () {
    it('Should mint admin token', async function () {
      await accessToken.mintAccessToken(addr1.address, 0);
      expect(await accessToken.checkRole(addr1.address)).to.equal(0);
    });

    it('Should mint moderator token', async function () {
      await accessToken.mintAccessToken(addr1.address, 1);
      expect(await accessToken.checkRole(addr1.address)).to.equal(1);
    });
  });

  describe('Access Control', function () {
    it('Should fail for non-token holders', async function () {
      await expect(accessToken.checkRole(addr1.address)).to.be.revertedWith('No active token');
    });

    it('Should revoke access', async function () {
      await accessToken.mintAccessToken(addr1.address, 0);
      const tokenId = await accessToken.activeTokens(addr1.address);
      await accessToken.revokeToken(tokenId);
      await expect(accessToken.checkRole(addr1.address)).to.be.revertedWith('No active token');
    });
  });
});
