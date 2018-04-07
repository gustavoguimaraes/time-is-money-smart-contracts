const TimeIsMoney = artifacts.require('./TimeIsMoney.sol');
var Web3Utils = require('web3-utils');
const { should, ensuresException } = require('./helpers/utils');
const expect = require('chai').expect;
const { latestTime, duration, increaseTimeTo } = require('./helpers/timer');

contract('TimeIsMoney', ([host, buyer, buyer2]) => {
    const ticketPrice = 1e18;
    let tm, startTime, endTime;
    const seed1 = 12345;
    const seed2 = 56789;
    const hashOfSeed1 = Web3Utils.soliditySha3(seed1);
    const hashOfSeed2 = Web3Utils.soliditySha3(seed2);

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
                await tm.buyTicket(hashOfSeed1, { value: 2e18, from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            const checkBuyerTicketPurchase = await tm.boughtTicket.call(buyer);
            checkBuyerTicketPurchase.should.be.false;

            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });

            const checkAgainBuyerTicketPurchase = await tm.boughtTicket.call(
                buyer
            );
            checkAgainBuyerTicketPurchase.should.be.true;
        });

        it('cannot buy more than one ticket', async () => {
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });

            try {
                await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
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
                await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
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
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
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
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
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
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });

            try {
                await tm.claimTicketReimbursement(buyer, seed1, { from: buyer });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }

            let checkBuyerHasTicket = await tm.boughtTicket.call(buyer);
            checkBuyerHasTicket.should.be.true;

            await tm.claimTicketReimbursement(buyer, seed1, { from: host });

            checkBuyerHasTicket = await tm.boughtTicket.call(buyer);
            checkBuyerHasTicket.should.be.false;
        });

        it('guest arrives before event and gets full refund', async () => {
            let guestInitialBalance = await web3.eth.getBalance(buyer);
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });

            await tm.claimTicketReimbursement(buyer, seed1, { from: host });

            const guestBalance = await web3.eth.getBalance(buyer);
            guestBalance
                .toNumber()
                .should.be.closeTo(guestInitialBalance.toNumber(), 1e16);
        });

        it('guest can claim refund only once', async () => {
            let guestInitialBalance = await web3.eth.getBalance(buyer);
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
;
            await tm.claimTicketReimbursement(buyer, seed1, { from: host });
            try {
                await tm.claimTicketReimbursement(buyer, seed1, { from: host });
                assert.fail();
            } catch (error) {
                ensuresException(error);
            }
        });

        it('guest arrives after event and gets no refund', async () => {
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });

            const guestBalanceBeforeRefund = await web3.eth.getBalance(buyer);

            await increaseTimeTo(latestTime() + duration.days(2));

            await tm.claimTicketReimbursement(buyer, seed1, { from: host });

            const guestBalanceAfterRefund = await web3.eth.getBalance(buyer);
            guestBalanceAfterRefund.should.be.bignumber.equal(
                guestBalanceBeforeRefund
            );
        });

        it.only('later guest gets less the earlier one', async () => {

            const guestBalanceBeforeTransactionBuyer = await web3.eth.getBalance(buyer);
            const guestBalanceBeforeTransactionBuyer2 = await web3.eth.getBalance(buyer2);
   
            const difference = guestBalanceBeforeTransactionBuyer.sub(guestBalanceBeforeTransactionBuyer2);

            guestBalanceBeforeTransactionBuyer2.add(difference).should.be.bignumber.equal(
                guestBalanceBeforeTransactionBuyer
            );
            await tm.buyTicket(hashOfSeed1, { value: 1e18, from: buyer });
            await tm.buyTicket(hashOfSeed2, { value: 1e18, from: buyer2 });

            const guestBalanceBeforeRefundBuyer = await web3.eth.getBalance(buyer);
            const guestBalanceBeforeRefundBuyer2 = await web3.eth.getBalance(buyer2);
            guestBalanceBeforeRefundBuyer2.add(difference).toNumber().should.be.bignumber.closeTo(
                guestBalanceBeforeRefundBuyer.toNumber(), 1e13
            );

            startTime = latestTime() + duration.days(1);
            endTime = startTime + duration.hours(2);

            await increaseTimeTo(latestTime() + duration.days(1) + duration.minutes(30));

            await tm.claimTicketReimbursement(buyer, seed1, { from: host });

            const guestBalanceAfterRefundBuyer = await web3.eth.getBalance(buyer);
    
            await increaseTimeTo(latestTime() + duration.minutes(60));

            await tm.claimTicketReimbursement(buyer2, seed2, { from: host });

            const guestBalanceAfterRefundBuyer2 = await web3.eth.getBalance(buyer2);
            
            guestBalanceAfterRefundBuyer2.add(difference).should.be.bignumber.lessThan(guestBalanceAfterRefundBuyer);


        });
    });
});
