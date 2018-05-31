import * as _ from 'lodash'
import {
  Transaction,
  TxIn,
  UnspentTxOut,
  validateTransaction
} from './transaction'

let transactionPool: Transaction[] = []

// 获取交易列表
const getTransactionPool = () => {
  return _.cloneDeep(transactionPool)
}

// 添加交易进交易池
const addToTransactionPool = (
  transaction: Transaction,
  unspentTxOuts: UnspentTxOut[]
) => {
  if (!validateTransaction(transaction, unspentTxOuts)) {
    throw Error('Trying to add invalid tx to pool')
  }

  if (!isValidTxForPool(transaction, transactionPool)) {
    throw Error('Trying to add invalid tx to pool')
  }
  console.log('adding to txPool: %s', JSON.stringify(transaction))
  transactionPool.push(transaction)
}

// 判断txIn在unspentTxOut 里面有没有对应的记录
const hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
  const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  })
  return foundTxIn !== undefined
}

// 更新transaction pool 移除不相关的transaction
const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
  const invalidTxs = []
  for (const tx of transactionPool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx)
        break
      }
    }
  }
  if (invalidTxs.length > 0) {
    console.log(
      'removing the following transactions from txPool: %s',
      JSON.stringify(invalidTxs)
    )
    transactionPool = _.without(transactionPool, ...invalidTxs)
  }
}

// 获取交易池中的所有txIn[]
const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => {
  return _(aTransactionPool)
    .map(tx => tx.txIns)
    .flatten()
    .value()
}

// 判断交易的out 是否在交易池中已经存在了
const isValidTxForPool = (
  tx: Transaction,
  transactionPool: Transaction[]
): boolean => {
  const txPoolIns: TxIn[] = getTxPoolIns(transactionPool)

  const containsTxIn = (txIns: TxIn[], txIn: TxIn) => {
    return _.find(txPoolIns, txPoolIn => {
      return (
        txIn.txOutIndex === txPoolIn.txOutIndex &&
        txIn.txOutId === txPoolIn.txOutId
      )
    })
  }

  for (const txIn of tx.txIns) {
    if (containsTxIn(txPoolIns, txIn)) {
      console.log('txIn already found in the txPool')
      return false
    }
  }
  return true
}

export { addToTransactionPool, getTransactionPool, updateTransactionPool }
