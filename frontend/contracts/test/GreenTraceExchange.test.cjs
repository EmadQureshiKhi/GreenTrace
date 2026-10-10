const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('GreenTraceExchange', () => {
  async function deploy() {
    const [deployer, treasury, buyer] = await ethers.getSigners();
    const Exchange = await ethers.getContractFactory('GreenTraceExchange');
    const exchange = await Exchange.deploy(treasury.address);
    return { exchange, deployer, treasury, buyer };
  }

  it('rejects a zero treasury', async () => {
    const Exchange = await ethers.getContractFactory('GreenTraceExchange');
    await expect(Exchange.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(Exchange, 'TreasuryRequired');
  });

  it('forwards purchase payments to the treasury and emits the order reference', async () => {
    const { exchange, treasury, buyer } = await deploy();
    const orderRef = ethers.id('order-1');
    const value = ethers.parseEther('2');

    const tx = exchange.connect(buyer).purchase(orderRef, { value });
    await expect(tx).to.emit(exchange, 'CreditsPurchased').withArgs(orderRef, buyer.address, value);
    await expect(tx).to.changeEtherBalances([buyer, treasury], [-value, value]);

    expect(await ethers.provider.getBalance(await exchange.getAddress())).to.equal(0n);
  });

  it('rejects paying the same order twice', async () => {
    const { exchange, buyer } = await deploy();
    const orderRef = ethers.id('order-3');
    await exchange.connect(buyer).purchase(orderRef, { value: 1n });
    expect(await exchange.paidOrders(orderRef)).to.equal(true);
    await expect(exchange.connect(buyer).purchase(orderRef, { value: 1n })).to.be.revertedWithCustomError(exchange, 'OrderAlreadyPaid');
  });

  it('rejects a purchase without payment', async () => {
    const { exchange, buyer } = await deploy();
    await expect(exchange.connect(buyer).purchase(ethers.id('order-2'))).to.be.revertedWithCustomError(
      exchange,
      'ZeroAmount',
    );
  });

  it('records retirement requests from the holder', async () => {
    const { exchange, buyer } = await deploy();
    await expect(exchange.connect(buyer).requestRetirement(3, 'GT-2026-ABC123'))
      .to.emit(exchange, 'RetirementRequested')
      .withArgs(buyer.address, 3, 'GT-2026-ABC123');
  });

  it('rejects empty retirement requests', async () => {
    const { exchange, buyer } = await deploy();
    await expect(exchange.connect(buyer).requestRetirement(0, 'GT-1')).to.be.revertedWithCustomError(
      exchange,
      'ZeroAmount',
    );
    await expect(exchange.connect(buyer).requestRetirement(1, '')).to.be.revertedWithCustomError(
      exchange,
      'MissingCertificate',
    );
  });
});
