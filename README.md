# Safe Module implementation

This project is a Safe Module implementation for a Safe contract to withdraw a predetermined amount of Unicorn token.
(Check TASK.md, for more task details)
Key features include:
- Module is specific to a token address(Unicorn) and to a Safe
- The module do not work for multiple token address or multiple safe addresses
- Signatures expire after a set time
- The module require the signatures of multiple owners (to meet the threshold requirement of the attached Safe)

## Contracts
- UnicornSafeModule.sol : It is the main Safe Module contract created for Unicorn token and Safe Contract. The contract function `withdrawToken` validates withdraw parameters, validates signatures, and execute the transfer of tokens from Safe(GnosisSafeProxy) contract to beneficiary.
- TestToken.sol : It was used to create test Unicorn tokens for this task, while testing. I have used a basic GnosisStandardToken from @gnosis.pm/util-contracts/contracts

## Process
The whole process of Safe Module includes these steps
```
Prerequisites, the Safe Contract and Unicorn should already be deployed and setup should be complete. Transfer Unicorn tokens to Safe
```

***
- Run ```npm i```
- Deploy UnicornSafeModule.sol (our safe module) with Safe & Unicorn contract addresses as constructor parameter. And enable this module on Safe
- Signers will sign the withdraw parameters for a beneficiary, and share the signatures array with beneficiary along with the same withdraw parameters
* Signer can use scripts, that I have added, first fill './utils/config.json' with appropriate details
* Private key will be required of owner(s) of Safe Contracts to sign and create signatures
* In this, add as many privateKey as threshold as in Safe Contract because further while generating & verifying signatures, threshold will be met
* ```npm run getSig``` run this, will get all signatures and withdraw parameters
* share this with beneficiary
- On the other hand, when beneficiary gets this data, it will call withdrawToken with withdraw paramters_(_beneficiary, _amount, _createdAt)_ along with signature array
- If all checks are passed correctly, the amount of token predetermined by signer for that beneficiary will transferred from Safe contract to beneficiary address

## Testing
```bash
npx hardhat test
```
Run the following, to test the smart contract functionality. This will test `UnicornSafeModule`
This includes deploying of `GnosisSafe`, `GnosisSafeProxyFactory`, `Unicorn-TestToken`, `SafeProxyContract` and deploying `UnicornSafeModule`. Enabling the module in Safe and run basic tests and testing functionalities of `UnicornSafeModule`.
The `hardhat.config.js` is kept minimal, and only includes necessary fields like solidity compiler versions; More networks and fields can be added as per requirement in future.
# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat compile
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.js
```
