# naivecoin

The repository for the naivecoin tutorial: https://lhartikk.github.io/

explain how blockchain work and transaction by typescript,

```sh
  yarn
  npm run dev
```

Get blockchain
```sh
curl http://localhost:3001/blocks
```
Mine a block
```sh
curl -X POST http://localhost:3001/mineBlock
```
Send transaction
```sh
curl -H "Content-type: application/json" --data '{"address": "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534b", "amount" : 35}' http://localhost:3001/sendTransaction
```
Query transaction pool
```sh
curl http://localhost:3001/transactionPool
```
Mine transaction
```sh
curl -H "Content-type: application/json" --data '{"address": "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534b", "amount" : 35}' http://localhost:3001/mineTransaction
```
Get balance
```sh
curl http://localhost:3001/balance
```
Query information about a specific address
```sh
curl http://localhost:3001/address/04f72a4541275aeb4344a8b049bfe2734b49fe25c08d56918f033507b96a61f9e3c330c4fcd46d0854a712dc878b9c280abe90c788c47497e06df78b25bf60ae64
```
Add peer
```sh
curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3001/addPeer
```
Query connected peers
```sh
curl http://localhost:3001/peers
```
