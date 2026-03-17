import { ethers } from 'ethers';

export function isMetaMaskInstalled() {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
}

export function getProvider() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use blockchain features.');
  }
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = getProvider();
  return await provider.getSigner();
}

export async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    return accounts[0];
  } catch (error) {
    if (error.code === 4001) {
      throw new Error('Wallet connection rejected by user.');
    }
    throw error;
  }
}

export async function getCurrentAccount() {
  if (!isMetaMaskInstalled()) return null;

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_accounts'
    });
    return accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
}

// These will be populated after deploy script runs and copies files to src/contracts/
let factoryABI = null;
let campaignABI = null;
let contractAddresses = null;

async function loadContractData() {
  if (!factoryABI) {
    try {
      const factoryModule = await import('../contracts/BlockFundFactory.json');
      factoryABI = factoryModule.default?.abi || factoryModule.abi;
    } catch {
      throw new Error('BlockFundFactory ABI not found. Please compile and deploy contracts first.');
    }
  }
  if (!campaignABI) {
    try {
      const campaignModule = await import('../contracts/Campaign.json');
      campaignABI = campaignModule.default?.abi || campaignModule.abi;
    } catch {
      throw new Error('Campaign ABI not found. Please compile and deploy contracts first.');
    }
  }
  if (!contractAddresses) {
    try {
      const addressModule = await import('../contracts/contractAddresses.json');
      contractAddresses = addressModule.default || addressModule;
    } catch {
      throw new Error('Contract addresses not found. Please deploy the smart contracts first.');
    }
  }
}

export async function getFactoryContract(signerOrProvider) {
  await loadContractData();
  return new ethers.Contract(contractAddresses.BlockFundFactory, factoryABI, signerOrProvider);
}

export function getCampaignContract(campaignAddress, signerOrProvider) {
  if (!campaignABI) {
    throw new Error('Campaign ABI not loaded. Call loadContractData first or use getCampaignContractAsync.');
  }
  return new ethers.Contract(campaignAddress, campaignABI, signerOrProvider);
}

export async function getCampaignContractAsync(campaignAddress, signerOrProvider) {
  await loadContractData();
  return new ethers.Contract(campaignAddress, campaignABI, signerOrProvider);
}

export function formatEth(weiValue) {
  try {
    return parseFloat(ethers.formatEther(weiValue)).toFixed(4);
  } catch {
    return '0.0000';
  }
}

export function parseEth(ethValue) {
  return ethers.parseEther(ethValue.toString());
}
