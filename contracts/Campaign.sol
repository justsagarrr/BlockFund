// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Campaign {
    struct Milestone {
        string name;
        uint256 percent;
        uint256 amountToRelease;
        bool approved;
        bool executed;
        uint256 voteCount;
        mapping(address => bool) votes;
    }

    address public creator;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalRaised;
    bool public finalized;

    mapping(address => uint256) public contributions;
    address[] public investors;
    uint256 public investorCount;

    uint256 public milestoneCount;
    mapping(uint256 => Milestone) public milestones;

    event InvestmentMade(address indexed investor, uint256 amount);
    event MilestoneRequested(uint256 indexed milestoneIndex);
    event MilestoneVoted(uint256 indexed milestoneIndex, address indexed voter);
    event MilestoneExecuted(uint256 indexed milestoneIndex, uint256 amountReleased);
    event RefundIssued(address indexed investor, uint256 amount);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only the campaign creator can call this");
        _;
    }

    modifier campaignActive() {
        require(block.timestamp < deadline, "Campaign has ended");
        require(!finalized, "Campaign is finalized");
        _;
    }

    constructor(
        address _creator,
        uint256 _goal,
        uint256 _durationInDays,
        string[] memory _milestoneNames,
        uint256[] memory _milestonePercents
    ) {
        require(_milestoneNames.length == _milestonePercents.length, "Milestone arrays must match");
        require(_milestoneNames.length > 0, "At least one milestone required");

        uint256 totalPercent = 0;
        for (uint256 i = 0; i < _milestonePercents.length; i++) {
            totalPercent += _milestonePercents[i];
        }
        require(totalPercent == 100, "Milestone percentages must total 100");

        creator = _creator;
        goal = _goal;
        deadline = block.timestamp + (_durationInDays * 1 days);
        milestoneCount = _milestoneNames.length;

        for (uint256 i = 0; i < _milestoneNames.length; i++) {
            Milestone storage m = milestones[i];
            m.name = _milestoneNames[i];
            m.percent = _milestonePercents[i];
            m.amountToRelease = (_goal * _milestonePercents[i]) / 100;
        }
    }

    function invest() external payable campaignActive {
        require(msg.value > 0, "Must send ETH to invest");

        if (contributions[msg.sender] == 0) {
            investors.push(msg.sender);
            investorCount++;
        }

        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;

        emit InvestmentMade(msg.sender, msg.value);
    }

    function requestMilestone(uint256 index) external onlyCreator {
        require(index < milestoneCount, "Invalid milestone index");
        Milestone storage m = milestones[index];
        require(!m.approved, "Milestone already approved");
        require(!m.executed, "Milestone already executed");

        m.approved = true;
        emit MilestoneRequested(index);
    }

    function voteMilestone(uint256 index) external {
        require(index < milestoneCount, "Invalid milestone index");
        require(contributions[msg.sender] > 0, "Only investors can vote");

        Milestone storage m = milestones[index];
        require(m.approved, "Milestone not yet proposed");
        require(!m.executed, "Milestone already executed");
        require(!m.votes[msg.sender], "Already voted on this milestone");

        m.votes[msg.sender] = true;
        m.voteCount++;

        emit MilestoneVoted(index, msg.sender);
    }

    function executeMilestone(uint256 index) external onlyCreator {
        require(index < milestoneCount, "Invalid milestone index");

        Milestone storage m = milestones[index];
        require(m.approved, "Milestone not yet proposed");
        require(!m.executed, "Milestone already executed");

        // More than 50% of investors must have voted yes
        uint256 threshold = (investorCount / 2) + 1;
        require(m.voteCount >= threshold, "Not enough votes to execute milestone");

        m.executed = true;

        // Calculate actual release based on totalRaised (not goal), proportional to percent
        uint256 releaseAmount = (totalRaised * m.percent) / 100;

        (bool success, ) = payable(creator).call{value: releaseAmount}("");
        require(success, "Transfer failed");

        emit MilestoneExecuted(index, releaseAmount);
    }

    function refund() external {
        require(block.timestamp > deadline, "Campaign is still active");
        require(totalRaised < goal, "Goal was reached, no refunds");

        uint256 amount = contributions[msg.sender];
        require(amount > 0, "No contribution to refund");

        contributions[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund transfer failed");

        emit RefundIssued(msg.sender, amount);
    }

    function getMilestone(uint256 index) external view returns (
        string memory name,
        uint256 percent,
        uint256 amountToRelease,
        bool approved,
        bool executed,
        uint256 voteCount
    ) {
        require(index < milestoneCount, "Invalid milestone index");
        Milestone storage m = milestones[index];
        return (m.name, m.percent, m.amountToRelease, m.approved, m.executed, m.voteCount);
    }

    function hasVoted(uint256 milestoneIndex, address voter) external view returns (bool) {
        return milestones[milestoneIndex].votes[voter];
    }

    function getInvestors() external view returns (address[] memory) {
        return investors;
    }

    function isActive() external view returns (bool) {
        return block.timestamp < deadline && !finalized;
    }
}
