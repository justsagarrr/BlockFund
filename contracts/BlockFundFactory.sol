// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Campaign.sol";

contract BlockFundFactory {
    address[] public deployedCampaigns;

    event CampaignCreated(address campaignAddress, address creator);

    function createCampaign(
        uint256 goal,
        uint256 durationInDays,
        string[] memory milestoneNames,
        uint256[] memory milestonePercents
    ) external {
        Campaign newCampaign = new Campaign(
            msg.sender,
            goal,
            durationInDays,
            milestoneNames,
            milestonePercents
        );

        deployedCampaigns.push(address(newCampaign));
        emit CampaignCreated(address(newCampaign), msg.sender);
    }

    function getDeployedCampaigns() external view returns (address[] memory) {
        return deployedCampaigns;
    }

    function getCampaignCount() external view returns (uint256) {
        return deployedCampaigns.length;
    }
}
