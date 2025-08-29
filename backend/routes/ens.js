/**
 * ENS utilities: resolve avatar URL for a given ENS name
 */
const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

function getMainnetProvider() {
  const url = process.env.MAINNET_RPC_URL || process.env.ETH_MAINNET_RPC || 'https://ethereum.publicnode.com';
  return new ethers.JsonRpcProvider(url);
}

// GET /api/ens/avatar?name=vc-hb3-accelerator.eth
router.get('/avatar', async (req, res) => {
  try {
    const name = String(req.query.name || '').trim();
    if (!name || !name.endsWith('.eth')) {
      return res.status(400).json({ success: false, message: 'ENS name is required (e.g., example.eth)' });
    }
    const provider = getMainnetProvider();
    const url = await provider.getAvatar(name);
    return res.json({ success: true, data: { url: url || null } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


