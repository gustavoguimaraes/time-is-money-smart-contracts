pragma solidity 0.4.21;

import "./SafeMath.sol";


contract TimeIsMoney {
    using SafeMath for uint256;
    mapping (address => bool) public boughtTicket;
    mapping (address => bytes32) public userSeedHash;

    address public host;
    uint256 public ticketPrice;
    uint256 public startTime;
    uint256 public endTime;

    function TimeIsMoney
        (
            address _host,
            uint256 _ticketPrice,
            uint256 _startTime,
            uint256 _endTime
        )
            public
        {
            require(_host != address(0) && _ticketPrice != 0);
            require(_startTime != 0 && _endTime != 0);
            require(_endTime > _startTime);

            host = _host;
            ticketPrice = _ticketPrice;
            startTime = _startTime;
            endTime = _endTime;
        }

    function retrieveFunds() external {
        require(host == msg.sender);
        require(now > endTime);

        host.transfer(address(this).balance);
    }

    function buyTicket(bytes32 seedHash) public payable {
        require(msg.value == ticketPrice && now < startTime);
        require(!boughtTicket[msg.sender]);

        boughtTicket[msg.sender] = true;
        userSeedHash[msg.sender] = seedHash;
    }

    function claimTicketReimbursement(address guest, uint256 seed) public {
        require(host == msg.sender);
        require(boughtTicket[guest]);
        require(userSeedHash[guest] == keccak256(seed));

        boughtTicket[guest] = false;
        uint256 reimbursement = calculateReturnMoney(now);
        guest.transfer(reimbursement);
    }

    function calculateReturnMoney(uint256 _currentTime) view internal returns (uint256) {
        if (_currentTime < startTime) {
            return ticketPrice;
        }

        if (_currentTime > endTime) {
            return 0;
        }

        uint256 totalDuration = endTime.sub(startTime);
        uint256 currentDuration = _currentTime.sub(startTime);
        return ticketPrice.sub(ticketPrice.mul(currentDuration).div(totalDuration));
    }
}
