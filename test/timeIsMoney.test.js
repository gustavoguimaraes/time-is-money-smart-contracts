const TimeIsMoney = artifacts.require('./TimeIsMoney.sol');

const { should, ensuresException } = require('./helpers/utils');
const expect = require('chai').expect;
const { latestTime, duration, increaseTimeTo } = require('./helpers/timer');

contract('TimeIsMoney', ([host, buyer, buyer2]) => {
    const ticketPrice = 1e18;
    let tm, startTime, endTime;

    beforeEach(async () => {
        startTime = latestTime() + duration.days(1);
        endTime = startTime + duration.hours(2);

        tm = await TimeIsMoney.new(host, ticketPrice, startTime, endTime);
    });

    describe('sets inital values', () => {
        it('has a host', async () => {
            const contractHost = await tm.host();
            contractHost.should.be.equal(host);
        });

        it('has a ticketPrice', async () => {
            const contractTicketPrice = await tm.ticketPrice();
            contractTicketPrice.should.be.bignumber.equal(ticketPrice);
        });

        it('has a startTime and it should be smaller than the endTime', async () => {
            const contractStartTime = await tm.startTime();
            const contractEndTime = await tm.endTime();

            expect(contractStartTime).to.exist;
            contractStartTime.should.be.bignumber.below(contractEndTime);
        });

        it('has an endTime and it should be bigger than the startTime', async () => {
            const contractEndTime = await tm.endTime();
            const contractStartTime = await tm.startTime();

            expect(contractEndTime).to.exist;
            contractEndTime.should.be.bignumber.above(contractStartTime);
        });
    });

    describe('buys tickets', () => {
        it('allows ticket purchases only with the exact amount', async () => {
            try {
                await tm.sendTransaction({ value: 2e18, from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            const checkBuyerTicketPurchase = await tm.boughtTicket.call(buyer);
            checkBuyerTicketPurchase.should.be.false;

            await tm.sendTransaction({ value: 1e18, from: buyer });

            const checkAgainBuyerTicketPurchase = await tm.boughtTicket.call(
                buyer
            );
            checkAgainBuyerTicketPurchase.should.be.true;
        });

        it('cannot buy more than one ticket', async () => {
            await tm.sendTransaction({ value: 1e18, from: buyer });

            try {
                await tm.sendTransaction({ value: 1e18, from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            const checkBuyerTicketPurchase = await tm.boughtTicket.call(buyer);
            checkBuyerTicketPurchase.should.be.true;
        });

        it('does not allow ticket purchasing after the startTime', async () => {
            await increaseTimeTo(latestTime() + duration.days(1));

            try {
                await tm.sendTransaction({ value: 1e18, from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            const checkBuyerTicketPurchase = await tm.boughtTicket.call(buyer);
            checkBuyerTicketPurchase.should.be.false;
        });
    });
    describe('retrieve funds', () => {
        it('allows only host to call function', async () => {
            await tm.sendTransaction({ value: 1e18, from: buyer });
            await increaseTimeTo(latestTime() + duration.days(2));
            try {
                await tm.retrieveFunds({ from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            let checkContractFunds = await web3.eth.getBalance(tm.address);
            checkContractFunds.should.be.bignumber.equal(1e18);

            await tm.retrieveFunds({ from: host });

            checkContractFunds = await web3.eth.getBalance(tm.address);
            checkContractFunds.should.be.bignumber.equal(0);
        });

        it('host cannot retrieve funds before end time', async () => {
            await tm.sendTransaction({ value: 1e18, from: buyer });
            try {
                await tm.retrieveFunds({ from: host });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }
            let checkContractFunds = await web3.eth.getBalance(tm.address);
            checkContractFunds.should.be.bignumber.equal(1e18);

            await increaseTimeTo(latestTime() + duration.days(2));

            await tm.retrieveFunds({ from: host });

            checkContractFunds = await web3.eth.getBalance(tm.address);
            checkContractFunds.should.be.bignumber.equal(0);
        });
    });

    describe('guest reimbursement', () => {
        it('only host can mark guest as arrived', async () => {
            await tm.sendTransaction({ value: 1e18, from: buyer });

            try {
                await tm.claimTicketReimbursement(buyer, { from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            let checkBuyerHasTicket = await tm.boughtTicket.call(buyer);
            checkBuyerHasTicket.should.be.true;

            await tm.claimTicketReimbursement(buyer, { from: host });

            checkBuyerHasTicket = await tm.boughtTicket.call(buyer);
            checkBuyerHasTicket.should.be.false;
        });

        it('guest arrives before event and gets full refund', async () => {
            let guestInitialBalance = await web3.eth.getBalance(buyer);
            await tm.sendTransaction({ value: 1e18, from: buyer });

            await tm.claimTicketReimbursement(buyer, { from: host });

            const guestBalance = await web3.eth.getBalance(buyer);
            guestBalance
                .toNumber()
                .should.be.closeTo(guestInitialBalance.toNumber(), 1e16);
        });

        it('guest can claim refund only once', async () => {
            let guestInitialBalance = await web3.eth.getBalance(buyer);
            await tm.sendTransaction({ value: 1e18, from: buyer });
;
            await tm.claimTicketReimbursement(buyer, { from: host });
            try {
                await tm.claimTicketReimbursement(buyer, { from: host });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }
        });

        it('guest arrives after event and gets no refund', async () => {
            await tm.sendTransaction({ value: 1e18, from: buyer });

            const guestBalanceBeforeRefund = await web3.eth.getBalance(buyer);

            await increaseTimeTo(latestTime() + duration.days(2));

            await tm.claimTicketReimbursement(buyer, { from: host });

            const guestBalanceAfterRefund = await web3.eth.getBalance(buyer);
            guestBalanceAfterRefund.should.be.bignumber.equal(
                guestBalanceBeforeRefund
            );
        });
    });
});
