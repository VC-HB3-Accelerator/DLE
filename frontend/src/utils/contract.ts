import { ethers } from 'ethers';

export const formatAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const isValidAddress = (address: string): boolean => {
  return ethers.isAddress(address);
}; 