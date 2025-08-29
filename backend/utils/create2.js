const { keccak256, getAddress } = require('ethers').utils || require('ethers');

function toBytes(hex) {
  if (hex.startsWith('0x')) return Buffer.from(hex.slice(2), 'hex');
  return Buffer.from(hex, 'hex');
}

function computeCreate2Address(factory, saltHex, initCodeHash) {
  const parts = [
    '0xff',
    factory.toLowerCase(),
    saltHex.toLowerCase(),
    initCodeHash.toLowerCase()
  ].map(x => x.startsWith('0x') ? x.slice(2) : x).join('');
  const hash = keccak256('0x' + parts);
  return '0x' + hash.slice(-40);
}

module.exports = { computeCreate2Address };


