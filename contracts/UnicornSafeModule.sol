// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

contract OwnableData {
    // V1 - V5: OK
    address public owner;
    // V1 - V5: OK
    address public pendingOwner;
}

// T1 - T4: OK
contract Ownable is OwnableData {
    // E1: OK
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor () {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // F1 - F9: OK
    // C1 - C21: OK
    function transferOwnership(address newOwner, bool direct, bool renounce) public onlyOwner {
        if (direct) {
            // Checks
            require(newOwner != address(0) || renounce, "Ownable: zero address");

            // Effects
            emit OwnershipTransferred(owner, newOwner);
            owner = newOwner;
        } else {
            // Effects
            pendingOwner = newOwner;
        }
    }

    // F1 - F9: OK
    // C1 - C21: OK
    function claimOwnership() public {
        address _pendingOwner = pendingOwner;
        
        // Checks
        require(msg.sender == _pendingOwner, "Ownable: caller != pending owner");

        // Effects
        emit OwnershipTransferred(owner, _pendingOwner);
        owner = _pendingOwner;
        pendingOwner = address(0);
    }

    // M1 - M5: OK
    // C1 - C21: OK
    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }
}
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // EIP 2612
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}
interface GnosisSafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, Enum.Operation operation)
        external
        returns (bool success);

    /// @dev Allows a Module to execute a Safe transaction without any further confirmations and return data
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModuleReturnData(address to, uint256 value, bytes calldata data, Enum.Operation operation)
        external
        returns (bool success, bytes memory returnData);
    function isOwner(address owner) external view returns (bool);
    function getThreshold() external view returns (uint256);
}


/// @title A Safe Module for Unicorn token's SafeProxy Contract
/// @author Harshit S
/// @notice You can use this contract for to withdraw tokens stored in SafeProxy Contract is you have owner-signed signatures
/// @dev Made only to work with Unicorn token and one safecontract, which we will assign in constructor
contract UnicornSafeModule is Ownable {

    ///@notice `safe` to store SafeProxy contract address, made immutable 
    GnosisSafe public immutable safe;

    ///@notice `token` to store Unicorn contract address, made immutable 
    address public immutable token;

    ///@notice `expiryTime` to store SafeProxyContract address, made immutable 
    uint256 public expiryTime;

    ///@notice `claimed` mapping to map hashedMessage with true/false, based on if user has already claimed it or not
    mapping(bytes32=>bool) public claimed;

    // The constructor will accept SafeProxy & Unicorn token contract addresses as param
    // We are defining expiryTime as 10 min(=600s). It can be updated by owner by calling setExpiryTime(newExpiryTime)
    constructor(address safe_, address token_){
        safe = GnosisSafe(safe_);
        token = token_;

        // setting expiryTime, by defining this we mean, that a signature can be used for this mmuch time period from the time it was created
        expiryTime = 600;
    }

    /// @notice encodePacks the values and performs keccak256 to get hash
    /// @dev its a public function currently, kept it for testing puropse, will be made private before deploying
    /// @param _toAccount account address to which withdraw amount is assigned
    /// @param _amount the amount which the beneficiary can withdraw
    /// @param _createdAt timestamp at which the signature was created for these withdraw details by the signer
    /// @return hash in bytes32, whcih will be used as hashedMessage to verify signature
    function encodePacked(address _toAccount, uint256 _amount, uint256 _createdAt) public pure returns (bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(_toAccount, _amount, _createdAt));
        return hash;
    }

    /// @notice verifyAndGetSigner verifies the hash & signature provided, and recovers the signer address from hash & signature's v,r,s
    /// @dev its a public function currently, kept it for testing puropse, can be made private before deploying
    /// @param _hash keccak256 of withdraw params
    /// @param _signature the signature provided, created by SafeProxyContract owner, signing the withdraw params with pvtkey
    /// @return address of the signer of the _signature provided in params. Provides address(0) in case of any error
    function verifyAndGetSigner(bytes32 _hash, bytes memory _signature) public pure returns (address){
        bytes32 r;
        bytes32 s;
        uint8 v;
        // Check the signature length
        if (_signature.length != 65) {
        return address(0);
        }
        // Divide the signature in r, s and v variables
        // ecrecover takes the signature parameters, and the only way to get them
        // currently is to use assembly.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
        r := mload(add(_signature, 32))
        s := mload(add(_signature, 64))
        v := byte(0, mload(add(_signature, 96)))
        }
        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
        v += 27;
        }
        // If the version is correct return the signer address
        if (v != 27 && v != 28) {
        return address(0);
        } else {
        // solium-disable-next-line arg-overflow
        return ecrecover(keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash)
        ), v, r, s);
        }
    }

    /// @notice tokenTransfer creates the data(for Unicorn token's transfer method) & executes the execTransactionFromModule function of SafeProxy contract
    /// @dev encodes `to` & `amount` with `transfer(address,uint256)` and sends it as data in safe's `execTransactionFromModule` function
    /// @param to beneficiary address
    /// @param amount withdraw amount
    function tokenTransfer(address to, uint amount) internal {
        bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
        require(safe.execTransactionFromModule(token, 0, data, Enum.Operation.Call), "Could not execute token transfer");
    }

    /// @notice withdrawToken will be called by users to withdraw Unicorn tokens assigned to them by signers(Safe Owners)
    /// @dev when signature is created by signer(s), it is shared to beneficiary along with the withdraw data. 
    ///        These params can be used to withdraw amounts from Safe contract and transfer to beneficiary address
    /// @param _beneficiary beneficiary address
    /// @param _amount withdraw amount
    /// @param _createdAt timsetamp at which signature was created by signer
    /// @param signature array of signature(s) created by the signer(s)
    function withdrawToken(address _beneficiary, uint256 _amount, uint256 _createdAt, bytes[] memory signature) external {
        //  tokens cant be withrawn after `expiryTime` from the timestamp it was `_createdAt`
        require(block.timestamp < _createdAt + expiryTime, "Signature expired");

        // bytes32 hash is created out of withdraw params, the signer signed the hash off-chain using these params only
        bytes32 _hashedMessage = encodePacked(_beneficiary, _amount, _createdAt);
        // checking whether this hash is already claimed, assuming signer will not sign more than one withdraw params at same timestamp for a particular beneficiary
        require(!claimed[_hashedMessage], "Token already withdrawed by this user");
        // setting claimed for this `_hashedMessage` to true, to avoid re-withdraw using same signatures
        claimed[_hashedMessage]=true;

        // getting threshold number from safe contract, to meet threshold requirement of this SafeModules' withdrawToken function
        uint256 threshold = safe.getThreshold();
        // to meet threshold, number of signatures assigned to beneficiary should equal to thrshold number
        require(threshold == signature.length, "Threshold not met, provide threshold no of sigs");
        
        // verifying each signature from signature array
        for(uint i = 0; i < threshold ; i++){
            // verifying and getting signer for a particular hashedMessage and signature
            address signer = verifyAndGetSigner(_hashedMessage, signature[i]);
            // address(0) check for returned signer
            require(signer!=address(0), "Invalid signer");
            // check if signer if even owner of the Safe Contract
            require(safe.isOwner(signer), "Signer is not Safe owner");
        }
        // not failed till now, so signatures are fine, we are good to go
        // now compare Unicorn token balance for our Safe contract beforehand, to avoid trxn failures later
        // check if its more than the withdraw amount
        require(IERC20(token).balanceOf(address(safe)) >= _amount, "Safe: Insufficient Balance");
        // call made to `tokenTransfer` provided beneficiary address and withdraw amount, rest of the trxn execution will happen in Safe Contract(proxy)
        tokenTransfer(_beneficiary, _amount);

    }

    /// @notice setExpiryTime function to set or update the expiryTime
    /// @dev kept onlyOwner so that only owners of this contract can set the expiryTime
    /// @param _newExpiryTime new expiry time period (in seconds)
    function setExpiryTime(uint256 _newExpiryTime) external onlyOwner {
        expiryTime = _newExpiryTime;
    }
}