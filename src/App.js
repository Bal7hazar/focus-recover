import React, { useState } from 'react';
import { Account, Provider, Contract, CallData, TransactionType, constants, uint256, num, cairo } from "starknet";
import ethAbi from './eth.json';
import './App.css';

const ethAddress = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const contractAddress = "0x0377c2d65debb3978ea81904e7d59740da1f07412e30d01c5ded1c5d6f1ddc43";

function App() {
  const [accountAddress, setAccountAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [includeEth, setIncludeEth] = useState(false);
  const [log, setLog] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLog('');
    try {
      // Instantiate account
      const provider = new Provider({ sequencer: { network: constants.NetworkName.SN_MAIN  } });

      // Check account exists
      let code = await provider.getCode(accountAddress);
      if (code.bytecode.length === 0) {
        setLog("Error: Account does not exist.")
        return;
      }

      // Check recipient exists
      code = await provider.getCode(recipientAddress);
      if (code.bytecode.length === 0) {
        setLog("Error: Recipient Account does not exist.")
        return;
      }
      const account = new Account(provider, accountAddress, privateKey);

      // Instantiate Focus Tree contract
      const { abi } = await provider.getClassAt(contractAddress);
      const contract = new Contract(abi, contractAddress, provider);

      // Connect account to contract
      contract.connect(account);

      // Check owner
      try {
        const owner = await contract.owner_of(tokenId);
        const address = num.toBigInt(accountAddress);
        if (owner !== address) {
          setLog("Error: You are not the owner of this token.");
          return;
        }
      } catch (error) {
        setLog(`ERC721: invalid token ID`);
        return;
      }

      // Check balance
      const eth = new Contract(ethAbi, ethAddress, provider);
      eth.connect(account);
      const res = await eth.balanceOf(accountAddress);
      const balance = uint256.uint256ToBN(res.balance);
      console.log(balance);
      if (balance <= 1000000000000000n) {
        setLog("Error: not enough ETH to proceed.");
        return;
      }

      // Tranfer nft
      let { transaction_hash } = await contract.transfer_from(accountAddress, recipientAddress, cairo.uint256(tokenId));
      setLog(`NFT transfer transaction hash: ${transaction_hash}`);

      // Transfer remaining eth if enable
      if (includeEth) {
        const ethContract = new Contract(ethAbi, ethAddress, provider);
        ethContract.connect(account);
        const res = await ethContract.balanceOf(accountAddress);
        const balance = uint256.uint256ToBN(res.balance);

        // Compute fees
        const fee = await account.getSuggestedMaxFee({
          type: TransactionType.INVOKE,
          payload: {
            contractAddress: ethAddress,
            entrypoint: 'transfer',
            calldata: CallData.compile({
              recipient: recipientAddress,
              amount: res.balance,
            })
          }
        });

        // Compute amount
        const amount = cairo.uint256(balance - fee);
        let { transaction_hash } = await account.execute(
          {
            contractAddress: ethAddress,
            entrypoint: 'transfer',
            calldata: CallData.compile({
              recipient: recipientAddress,
              amount: amount,
            })
          }
        );
        setLog(`ETH Transfer transaction hash: ${transaction_hash}`);
      }
    } catch (error) {
      setLog(`Error: ${error.message}`);
    }
  };

  return (
    <div className="App">
      <div className="form-container">
        <h1>Focus Recover</h1>
        <hr />
        <p>
          This application has not been developped by Focus Tree team. Use it at your own risk.<br />
          Code is open sourced, you can check it <a href="https://github.com/Bal7hazar/focus-recover">here</a>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input type="text" placeholder="Account Address: 0x123...789" value={accountAddress} onChange={e => setAccountAddress(e.target.value)} required />
          </div>
          <div className="input-group">
            <input type="text" placeholder="Private Key: 0x123...789" value={privateKey} onChange={e => setPrivateKey(e.target.value)} required />
            <small>Never share your private key to a not trust party</small>
          </div>
          <div className="input-group">
            <input type="text" placeholder="Token ID: 1337" value={tokenId} onChange={e => setTokenId(e.target.value)} required />
          </div>
          <div className="input-group">
            <input type="text" placeholder="Recipient Address: 0x123...789" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} required />
          </div>
          <div className="input-group checkbox-group">
            <label className="checkbox-label">
              Transfer remaining $ETH
              <input type="checkbox" checked={includeEth} onChange={e => setIncludeEth(e.target.checked)} />
            </label>
          </div>
          <div className="input-group">
            <button type="submit">Run</button>
          </div>
        </form>
        <div className="log">{log}</div>
      </div>
    </div>
  );
}

export default App;
