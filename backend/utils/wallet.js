import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
