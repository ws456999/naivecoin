import * as Router from 'koa-router'
import * as _ from 'lodash'

import {
  genesisBlock,
  Block,
  generateNextBlock,
  generatenextBlockWithTransaction,
  generateRawNextBlock,
  getAccountBalance,
  getBlockchain,
  getMyUnspentTransactionOutputs,
  getUnspentTxOuts,
  sendTransaction
} from '../blockchain'
import { connectToPeers, getSockets, initP2PServer } from '../p2p'
import { UnspentTxOut } from '../transaction'
import { getTransactionPool } from '../transactionPool'
import { getPublicFromWallet, initWallet } from '../wallet'

export const router = new Router()

router.get('/blocks', async (ctx, next) => {
  ctx.body = getBlockchain()
})

router.get('/block/:hash', async (ctx, next) => {
  const block = _.find(getBlockchain(), { hash: ctx.params.hash })
  ctx.body = block
})

router.get('/transaction/:id', async (ctx, next) => {
  const tx = _(getBlockchain())
    .map(blocks => blocks.data)
    .flatten()
    .find({ id: ctx.params.id })
  ctx.body = tx
})

router.get('/address/:address', async (ctx, next) => {
  const unspentTxOuts: UnspentTxOut[] = _.filter(
    getUnspentTxOuts(),
    uTxO => uTxO.address === ctx.params.address
  )
  ctx.body = { unspentTxOuts: unspentTxOuts }
})

router.get('/unspentTransactionOutputs', async (ctx, next) => {
  ctx.body = getUnspentTxOuts()
})

router.get('/myUnspentTransactionOutputs', async (ctx, next) => {
  ctx.body = getMyUnspentTransactionOutputs()
})

router.post('/mineRawBlock', async (ctx, next) => {
  if (ctx.body.data == null) {
    ctx.body = 'data parameter is missing'
    return
  }
  const newBlock: Block = generateRawNextBlock(ctx.body.data)
  if (newBlock === null) {
    ctx.status = 400
    ctx.body = 'could not generate block'
  } else {
    ctx.body = newBlock
  }
})

router.post('/mineBlock', async (ctx, next) => {
  const newBlock: Block = generateNextBlock()
  if (newBlock === null) {
    ctx.status = 400
    ctx.body = 'could not generate block'
  } else {
    ctx.body = newBlock
  }
})

router.get('/balance', async (ctx, next) => {
  const balance: number = getAccountBalance()
  ctx.body = { balance: balance }
})

router.get('/address', async (ctx, next) => {
  const address: string = getPublicFromWallet()
  ctx.body = { address: address }
})

router.post('/mineTransaction', async (ctx, next) => {
  const address = ctx.body.address
  const amount = ctx.body.amount
  try {
    const resp = generatenextBlockWithTransaction(address, amount)
    ctx.body = resp
  } catch (e) {
    console.log(e.message)
    ctx.status = 400
    ctx.body = e.message
  }
})

router.post('/sendTransaction', async (ctx, next) => {
  try {
    const address = ctx.body.address
    const amount = ctx.body.amount

    if (address === undefined || amount === undefined) {
      throw Error('invalid address or amount')
    }
    const resp = sendTransaction(address, amount)
    ctx.body = resp
  } catch (e) {
    console.log(e.message)
    ctx.status = 400
    ctx.body = e.message
  }
})

router.get('/transactionPool', async (ctx, next) => {
  ctx.body = getTransactionPool()
})

router.get('/peers', async (ctx, next) => {
  ctx.body = getSockets().map(
    (s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort
  )
})
router.post('/addPeer', async (ctx, next) => {
  connectToPeers(ctx.body.peer)
  // res.send()
})

router.post('/stop', async (ctx, next) => {
  ctx.body = { msg: 'stopping server' }
  process.exit()
})
