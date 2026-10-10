require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: './.env.local' });

const operatorKey = process.env.HEDERA_OPERATOR_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
  paths: { tests: './contracts/test' },
  gasReporter: { enabled: false },
  networks: {
    hederaTestnet: {
      url: 'https://testnet.hashio.io/api',
      chainId: 296,
      accounts: operatorKey ? [operatorKey.startsWith('0x') ? operatorKey : `0x${operatorKey}`] : [],
    },
  },
};
