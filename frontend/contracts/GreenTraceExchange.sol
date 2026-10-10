// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GreenTraceExchange
/// @notice On-chain entry point for the two user-initiated actions in GreenTrace.
///
/// Purchases: a buyer pays HBAR against an order created off-chain. The payment is forwarded to the
/// treasury in the same transaction and the `CreditsPurchased` event binds it to the order reference.
/// The GreenTrace server delivers the CO2e tokens only after verifying this event on the mirror node.
///
/// Retirements: a holder signs a retirement request with their own wallet. The server verifies the
/// `RetirementRequested` event, removes exactly that amount of CO2e from the holder's account (the
/// token's wipe key, so total supply drops and the credit can never be counted twice) and anchors the
/// result on the Hedera Consensus Service.
contract GreenTraceExchange {
    address payable public immutable treasury;

    /// @notice Order references that have already been paid. An order can be paid exactly once.
    mapping(bytes32 => bool) public paidOrders;

    event CreditsPurchased(bytes32 indexed orderRef, address indexed buyer, uint256 amountPaid);
    event RetirementRequested(address indexed retiree, uint256 amount, string certificateId);

    error ZeroAmount();
    error MissingCertificate();
    error TreasuryRequired();
    error TransferFailed();
    error OrderAlreadyPaid();

    constructor(address payable treasury_) {
        if (treasury_ == address(0)) revert TreasuryRequired();
        treasury = treasury_;
    }

    /// @param orderRef The order reference returned by the GreenTrace API when the order was created.
    function purchase(bytes32 orderRef) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (paidOrders[orderRef]) revert OrderAlreadyPaid();
        paidOrders[orderRef] = true;
        (bool ok, ) = treasury.call{value: msg.value}("");
        if (!ok) revert TransferFailed();
        emit CreditsPurchased(orderRef, msg.sender, msg.value);
    }

    /// @param amount Whole CO2e tokens (tonnes) to retire.
    /// @param certificateId The GreenTrace certificate the retirement offsets.
    function requestRetirement(uint256 amount, string calldata certificateId) external {
        if (amount == 0) revert ZeroAmount();
        if (bytes(certificateId).length == 0) revert MissingCertificate();
        emit RetirementRequested(msg.sender, amount, certificateId);
    }
}
