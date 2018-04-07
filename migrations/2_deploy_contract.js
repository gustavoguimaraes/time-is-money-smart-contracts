const TimeIsMoney = artifacts.require('./TimeIsMoney.sol');

const ticketPrice = 1e18;
const openingTime = web3.eth.getBlock('latest').timestamp + 20; // twenty secs in the future
const closingTime = openingTime + 360; // 360 secs which is 1 hour

module.exports = function(deployer, network, [host]) {
    deployer.deploy(TimeIsMoney, host, ticketPrice, openingTime, closingTime);
};
