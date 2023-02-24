#Objective
The contract written for this challenge should use this functionality to allow accounts that are not related to the Safe to withdraw a predetermined amount of a specific token.
To better understand this let’s take an example:
Alice has set up a Safe which they use to hold all of their Unicorn tokens. They want to hand out unicorn tokens easily without having Alice trigger a transaction each time. Therefore they enable the module written in this challenge. Now they can generate a signature which allows anyone to withdraw Unicorn tokens from their Safe. With this they generate a signature for a withdrawal of 10 Unicorn tokens and share it with Bob. Now Bob can use this signature and interact with the module which then will send 10 Unicorn tokens from Alice Safe to Bob's address.
If there are any questions on this challenge feel free to reach out to the hiring team and we will get back to you as soon as possible.

#Features
The following features should be included in the module:
- Module should be specific to a token address and to a Safe
- The module is not required to work for multiple token address or multiple safe addresses
- Method to withdraw tokens (via a transaction) - The method should take the
- amount of tokens to withdraw
- a beneficiary (receiver of the tokens)
- signature of an owner of the Safe it is attached to
Optional features:
- Signatures should expire after a set time
- The module should require the signatures of multiple owners (to meet the threshold
requirement of the attached Safe)