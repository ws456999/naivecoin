import * as CryptoJS from 'crypto-js'
import * as ecdsa from 'elliptic'
import * as _ from 'lodash'

const ec = new ecdsa.ec('secp256k1')

const COINBASE_AMOUT: number = 50

// 还没有spent的交易
class UnspentTxOut {
  public readonly txOutId: string
  public readonly txOutIndex: number
  public readonly address: string
  public readonly amount: number
  constructor (
    txOutId: string,
    txOutIndex: number,
    address: string,
    amount: number
  ) {
    this.txOutId = txOutId
    this.txOutIndex = txOutIndex
    this.address = address
    this.amount = amount
  }
}

// 交易发起者
// 交易的发起者需要提供自己token来源的证据，也就是指向之前的交易。但是他要证明自己对这个交易的拥有权，因此需要提供通过自己私钥加密的签名。这个结构体的代码如下：
class TxIn {
  public txOutId: string
  public txOutIndex: number
  public signature: string
}

// 接受者
class TxOut {
  public address: string
  public amount: number

  constructor (address: string, amount: number) {
    this.address = address
    this.amount = amount
  }
}

// 一个交易
class Transaction {
  public id: string
  public txIns: TxIn[]
  public txOuts: TxOut[]
}

// 给交易信息打一个hash
const getTransactionId = (transaction: Transaction): string => {
  const txInContent: string = transaction.txIns
    .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, '')
  const txOutContent: string = transaction.txOuts
    .map((txOut: TxOut) => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, '')

  return CryptoJS.SHA256(txInContent, txOutContent).toString()
}

// 校验交易是否合法
const validateTransaction = (
  transaction: Transaction,
  aUnspentTxOuts: UnspentTxOut[]
): boolean => {
  if (!isValidTransactionStructure(transaction)) {
    return false
  }

  if (getTransactionId(transaction) !== transaction.id) {
    console.log('invalid tx id: ' + transaction.id)
    return false
  }
  const hasValidTxIns: boolean = transaction.txIns
    .map(txIn => validateTxIn(txIn, transaction, aUnspentTxOuts))
    .reduce((a, b) => a && b, true)

  if (!hasValidTxIns) {
    console.log('some of the txIns are invalid in tx: ' + transaction.id)
    return false
  }

  const totalTxInValues: number = transaction.txIns
    .map(txIn => getTxInAmount(txIn, aUnspentTxOuts))
    .reduce((a, b) => a + b, 0)

  const totalTxOutValues: number = transaction.txOuts
    .map(txOut => txOut.amount)
    .reduce((a, b) => a + b, 0)

  if (totalTxOutValues !== totalTxInValues) {
    console.log('totalTxOutValues !== totalTxInValues in tx: ' + transaction.id)
    return false
  }

  return true
}

const validateBlockTransactions = (
  transactions: Transaction[],
  unspentTxOuts: UnspentTxOut[],
  blockIndex: number
): boolean => {
  // 通常挖矿后悔把上一次的矿工收益放在下一个区块的第一个交易，如果我没记错的话
  const coinbaseTx = transactions[0]
  // if ()

  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log('invalid coinbase transaction: ' + JSON.stringify(coinbaseTx))
    return false
  }

  // check for duplicate txIns. Each txIn can be included only once
  const txIns: TxIn[] = _(transactions)
    .map(tx => tx.txIns)
    .flatten()
    .value()

  if (hasDuplicates(txIns)) {
    return false
  }

  // all but coinbase transactions
  const normalTransactions: Transaction[] = transactions.slice(1)
  return normalTransactions
    .map(tx => validateTransaction(tx, unspentTxOuts))
    .reduce((a, b) => a && b, true)
}

// 判断有没有一样的发起者
const hasDuplicates = (txIns: TxIn[]): boolean => {
  const groups = _.countBy(
    txIns,
    (txIn: TxIn) => txIn.txOutId + txIn.txOutIndex
  )
  return _(groups)
    .map((value, key) => {
      if (value > 1) {
        console.log('duplicate txIn: ' + key)
        return true
      } else {
        return false
      }
    })
    .includes(true)
}

// 验证挖矿奖励是否合法
const validateCoinbaseTx = (
  transaction: Transaction,
  blockIndex: number
): boolean => {
  if (!transaction) {
    console.log(
      'the first transaction in the block must be coinbase transaction'
    )
    return false
  }
  if (getTransactionId(transaction) !== transaction.id) {
    console.log('invalid coinbase tx id: ' + transaction.id)
    return false
  }
  if (transaction.txIns.length !== 1) {
    console.log('one txIn must be specified in the coinbase transaction')
    return false
  }
  // txOutIndex必须是当前区块的高度
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
    console.log('the txIn signature in coinbase tx must be the block height')
    return false
  }
  if (transaction.txOuts.length !== 1) {
    console.log('invalid number of txOuts in coinbase transaction')
    return false
  }

  if (transaction.txOuts[0].amount !== COINBASE_AMOUT) {
    console.log('invalid coinbase amount in coinbase transaction')
    return false
  }

  return true
}

// 校验接受方是否合法
const validateTxIn = (
  txIn: TxIn,
  transaction: Transaction,
  unspentTxOuts: UnspentTxOut[]
): boolean => {
  const referencedUTxOut: UnspentTxOut =
    // 在未入链的交易的接收方找到相同的txIn
    unspentTxOuts.find(
      txOut =>
        txOut.txOutId === txIn.txOutId && txOut.txOutIndex === txIn.txOutIndex
    )
  if (referencedUTxOut == null) {
    console.log('referenced txOut not found: ' + JSON.stringify(txIn))
    return false
  }
  const address = referencedUTxOut.address

  // address 是不是就是一个公钥？
  // 验证sinature是否合法
  const key = ec.keyFromPublic(address, 'hex')
  const validSignature: boolean = key.verify(transaction.id, txIn.signature)
  if (!validSignature) {
    console.log(
      'invalid txIn signature: %s txId: %s address: %s',
      txIn.signature,
      transaction.id,
      referencedUTxOut.address
    )
    return false
  }
  return true
}

// 获取接收方的amount
const getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number => {
  return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount
}

// 在未完成交易里面找到某个交易发起者
const findUnspentTxOut = (
  transactionId: string,
  index: number,
  aUnspentTxOuts: UnspentTxOut[]
): UnspentTxOut => {
  return aUnspentTxOuts.find(
    uTxO => uTxO.txOutId === transactionId && uTxO.txOutIndex === index
  )
}

// 给矿工利益的transaction
const getCoinbaseTransaction = (
  address: string,
  blockIndex: number
): Transaction => {
  const t = new Transaction()
  const txIn: TxIn = new TxIn()
  txIn.signature = ''
  txIn.txOutId = ''
  txIn.txOutIndex = blockIndex

  t.txIns = [txIn]
  t.txOuts = [new TxOut(address, COINBASE_AMOUT)]
  t.id = getTransactionId(t)
  return t
}

// 获取txIn的signature
const signTxIn = (
  transaction: Transaction,
  txInIndex: number,
  privateKey: string,
  aUnspentTxOuts: UnspentTxOut[]
): string => {
  const txIn: TxIn = transaction.txIns[txInIndex]

  const dataToSign = transaction.id
  const referencedUnspentTxOut: UnspentTxOut = findUnspentTxOut(
    txIn.txOutId,
    txIn.txOutIndex,
    aUnspentTxOuts
  )
  if (referencedUnspentTxOut == null) {
    console.log('could not find referenced txOut')
    throw Error()
  }
  const referencedAddress = referencedUnspentTxOut.address

  if (getPublicKey(privateKey) !== referencedAddress) {
    console.log(
      'trying to sign an input with private' +
        ' key that does not match the address that is referenced in txIn'
    )
    throw Error()
  }
  const key = ec.keyFromPrivate(privateKey, 'hex')
  const signature: string = toHexString(key.sign(dataToSign).toDER())

  return signature
}

// 将交易过transaction的txOut 移除 unspentTxOut
const updateUnspentTxOuts = (
  aTransactions: Transaction[],
  aUnspentTxOuts: UnspentTxOut[]
): UnspentTxOut[] => {
  const newUnspentTxOuts: UnspentTxOut[] = aTransactions
    .map(t => {
      return t.txOuts.map(
        (txOut, index) =>
          new UnspentTxOut(t.id, index, txOut.address, txOut.amount)
      )
    })
    .reduce((a, b) => a.concat(b), [])

  const consumedTxOuts: UnspentTxOut[] = aTransactions
    .map(t => t.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map(txIn => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0))

  const resultingUnspentTxOuts = aUnspentTxOuts
    .filter(
      uTxO => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)
    )
    .concat(newUnspentTxOuts)

  return resultingUnspentTxOuts
}

// 处理交易，更新unspentTxOut
const processTransactions = (
  aTransactions: Transaction[],
  aUnspentTxOuts: UnspentTxOut[],
  blockIndex: number
) => {
  if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
    console.log('invalid block transactions')
    return null
  }
  return updateUnspentTxOuts(aTransactions, aUnspentTxOuts)
}

// 转16进制
const toHexString = (byteArray): string => {
  return Array.from(byteArray, (byte: any) => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2)
  }).join('')
}

// 根据私钥获取公钥
const getPublicKey = (privateKey: string): string => {
  return ec
    .keyFromPrivate(privateKey, 'hex')
    .getPublic()
    .encode('hex')
}

const isValidTxInStructure = (txIn: TxIn): boolean => {
  if (txIn == null) {
    console.log('txIn is null')
    return false
  } else if (typeof txIn.signature !== 'string') {
    console.log('invalid signature type in txIn')
    return false
  } else if (typeof txIn.txOutId !== 'string') {
    console.log('invalid txOutId type in txIn')
    return false
  } else if (typeof txIn.txOutIndex !== 'number') {
    console.log('invalid txOutIndex type in txIn')
    return false
  } else {
    return true
  }
}

const isValidTxOutStructure = (txOut: TxOut): boolean => {
  if (txOut == null) {
    console.log('txOut is null')
    return false
  } else if (typeof txOut.address !== 'string') {
    console.log('invalid address type in txOut')
    return false
  } else if (!isValidAddress(txOut.address)) {
    console.log('invalid TxOut address')
    return false
  } else if (typeof txOut.amount !== 'number') {
    console.log('invalid amount type in txOut')
    return false
  } else {
    return true
  }
}

const isValidTransactionStructure = (transaction: Transaction) => {
  if (typeof transaction.id !== 'string') {
    console.log('transactionId missing')
    return false
  }
  if (!(transaction.txIns instanceof Array)) {
    console.log('invalid txIns type in transaction')
    return false
  }
  if (
    !transaction.txIns.map(isValidTxInStructure).reduce((a, b) => a && b, true)
  ) {
    return false
  }

  if (!(transaction.txOuts instanceof Array)) {
    console.log('invalid txIns type in transaction')
    return false
  }

  if (
    !transaction.txOuts
      .map(isValidTxOutStructure)
      .reduce((a, b) => a && b, true)
  ) {
    return false
  }
  return true
}

// valid address is a valid ecdsa public key in the 04 + X-coordinate + Y-coordinate format
const isValidAddress = (address: string): boolean => {
  if (address.length !== 130) {
    console.log(address)
    console.log('invalid public key length')
    return false
  } else if (address.match('^[a-fA-F0-9]+$') === null) {
    console.log('public key must contain only hex characters')
    return false
  } else if (!address.startsWith('04')) {
    console.log('public key must start with 04')
    return false
  }
  return true
}

export {
  processTransactions,
  signTxIn,
  getTransactionId,
  isValidAddress,
  validateTransaction,
  UnspentTxOut,
  TxIn,
  TxOut,
  getCoinbaseTransaction,
  getPublicKey,
  hasDuplicates,
  Transaction
}
