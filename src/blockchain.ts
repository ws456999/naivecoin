import * as CryptoJS from 'crypto-js'
import * as _ from 'lodash'
import { broadcastLatest, broadCastTransactionPool } from './p2p'
import {
  createTransaction,
  findUnspentTxOuts,
  getBalance,
  getPrivateFromWallet,
  getPublicFromWallet
} from './wallet'
import {
  getCoinbaseTransaction,
  isValidAddress,
  processTransactions,
  Transaction,
  UnspentTxOut
} from './transaction'
import {
  addToTransactionPool,
  getTransactionPool,
  updateTransactionPool
} from './transactionPool'
import { hexToBinary } from './util'

// 区块产生间隔
const BLOCK_GENERATION_INTERVAL: number = 10

// in blocks 难度系数
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10

class Block {
  public index: number
  public hash: string
  public previousHash: string
  public timestamp: number
  public data: Transaction[]
  public difficulty: number
  public nonce: number

  constructor (
    index: number,
    hash: string,
    previousHash: string,
    timestamp: number,
    data: any[],
    difficulty: number,
    nonce: number
  ) {
    this.index = index
    this.previousHash = previousHash
    this.timestamp = timestamp
    this.data = data
    this.hash = hash
    this.difficulty = difficulty
    this.nonce = nonce
  }
}
// 上帝transaction
const genesisTransaction = {
  txIns: [{ signature: '', txOutId: '', txOutIndex: 0 }],
  txOuts: [
    {
      address:
        '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
      amount: 50
    }
  ],
  id: '5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9'
}

// 上帝block
const genesisBlock: Block = new Block(
  0,
  '91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627',
  '',
  1465154705,
  [genesisTransaction],
  0,
  0
)

// 第一个chain
let blockchain: Block[] = [genesisBlock]

// 当前的未处理记录
let unspentTxOuts: UnspentTxOut[] = processTransactions(
  blockchain[0].data,
  [],
  0
)

// 获取blockchain
const getBlockchain = (): Block[] => blockchain

// 获取未处理支出
const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts)

// 设置未支出记录
const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
  console.log('replacing unspentTxouts with: %s', newUnspentTxOut)
  unspentTxOuts = newUnspentTxOut
}

const getLatestBlock = (): Block => blockchain[blockchain.length - 1]

// 获取当前的难度
const getDifficulty = (aBlockchain: Block[]): number => {
  const latestBlock: Block = aBlockchain[blockchain.length - 1]
  if (
    latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latestBlock.index !== 0
  ) {
    return getAdjustedDifficulty(latestBlock, aBlockchain)
  } else {
    return latestBlock.difficulty
  }
}

// 调整难度，其实就是判断每次挖矿的间隔时间，如果太短就加难度，太长就减去难度，让时间稳定在约束时间左右
const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
  const prevAdjustmentBlock: Block =
    aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL]
  const timeExpected: number =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL
  const timeTaken: number =
    latestBlock.timestamp - prevAdjustmentBlock.timestamp
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1
  } else {
    return prevAdjustmentBlock.difficulty
  }
}

// 获取当前的时间戳
const getCurrentTimestamp = (): number =>
  Math.round(new Date().getTime() / 1000)

// 尝试生产下一个区块
const generateRawNextBlock = (blockData: Transaction[]) => {
  const previousBlock: Block = getLatestBlock()
  const difficulty: number = getDifficulty(getBlockchain())
  const nextIndex: number = previousBlock.index + 1
  const nextTimestamp: number = getCurrentTimestamp()
  const newBlock: Block = findBlock(
    nextIndex,
    previousBlock.hash,
    nextTimestamp,
    blockData,
    difficulty
  )
  if (addBlockToChain(newBlock)) {
    broadcastLatest()
    return newBlock
  } else {
    return null
  }
}

// gets the unspent transaction outputs owned by the wallet
const getMyUnspentTransactionOutputs = () => {
  return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts())
}

// 生产下一个区块
const generateNextBlock = () => {
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  )
  const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool())
  return generateRawNextBlock(blockData)
}

// 生产下一个区块，顺便把矿工费放进来
const generatenextBlockWithTransaction = (
  receiverAddress: string,
  amount: number
) => {
  if (!isValidAddress(receiverAddress)) {
    throw Error('invalid address')
  }
  if (typeof amount !== 'number') {
    throw Error('invalid amount')
  }
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  )
  const tx: Transaction = createTransaction(
    receiverAddress,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  )
  const blockData: Transaction[] = [coinbaseTx, tx]
  return generateRawNextBlock(blockData)
}

const findBlock = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number
): Block => {
  let nonce = 0
  while (true) {
    const hash: string = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    )
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      )
    }
    nonce++
  }
}

// 获取账户余额
const getAccountBalance = (): number => {
  return getBalance(getPublicFromWallet(), getUnspentTxOuts())
}

// 挖完矿，要通知其他节点更新
const sendTransaction = (address: string, amount: number): Transaction => {
  const tx: Transaction = createTransaction(
    address,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  )
  addToTransactionPool(tx, getUnspentTxOuts())
  broadCastTransactionPool()
  return tx
}

// 区块生产hash
const calculateHashForBlock = (block: Block): string =>
  calculateHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  )

// 计算hash
const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number,
  nonce: number
): string =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + data + difficulty + nonce
  ).toString()

// 检验区块结构是否合法
const isValidBlockStructure = (block: Block): boolean => {
  return (
    typeof block.index === 'number' &&
    typeof block.hash === 'string' &&
    typeof block.previousHash === 'string' &&
    typeof block.timestamp === 'number' &&
    typeof block.data === 'object'
  )
}

// 校验新区块是否合法
const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (!isValidBlockStructure(newBlock)) {
    console.log('invalid block structure: %s', JSON.stringify(newBlock))
    return false
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log('invalid index')
    return false
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log('invalid previoushash')
    return false
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log('invalid timestamp')
    return false
  } else if (!hasValidHash(newBlock)) {
    return false
  }
  return true
}

// 检验时间戳是否合法，区块生成的时间范围应该被约束到 [上一个区块的时间 - 60s, 当前时间 + 60s ] 这个时间范围内
const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  return (
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getCurrentTimestamp()
  )
}

// 统计区块链的难度，用于分叉的时候选择一条难度最大的链
const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
  return aBlockchain
    .map(block => block.difficulty)
    .map(difficulty => Math.pow(2, difficulty))
    .reduce((a, b) => a + b)
}

// 检验区块hash是否合法
const hasValidHash = (block: Block): boolean => {
  if (!hashMatchesBlockContent(block)) {
    console.log('invalid hash, got:' + block.hash)
    return false
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log(
      'block difficulty not satisfied. Expected: ' +
        block.difficulty +
        'got: ' +
        block.hash
    )
  }
  return true
}

// 验证hash是否合法，主要是检验数据是否被篡改过
const hashMatchesBlockContent = (block: Block): boolean => {
  const blockHash: string = calculateHashForBlock(block)
  return blockHash === block.hash
}

// 区块难度是否符合当前挖矿难度
const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
  const hashInBinary: string = hexToBinary(hash)
  const requiredPrefix: string = '0'.repeat(difficulty)
  return hashInBinary.startsWith(requiredPrefix)
}

/*
    检验如果区块链合法的话，返回所有没被花掉的txOut
 */
const isValidChain = (blockchainToValidate: Block[]): UnspentTxOut[] => {
  console.log('isValidChain:')
  console.log(JSON.stringify(blockchainToValidate))
  const isValidGenesis = (block: Block): boolean => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock)
  }

  if (!isValidGenesis(blockchainToValidate[0])) {
    return null
  }
  /*
  Validate each block in the chain. The block is valid if the block structure is valid
    and the transaction are valid
   */
  let aUnspentTxOuts: UnspentTxOut[] = []

  for (let i = 0; i < blockchainToValidate.length; i++) {
    const currentBlock: Block = blockchainToValidate[i]
    if (
      i !== 0 &&
      !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])
    ) {
      return null
    }
    // 如果chain上某个block没有unpenttxout的话，说明这个chain是非法的
    aUnspentTxOuts = processTransactions(
      currentBlock.data,
      aUnspentTxOuts,
      currentBlock.index
    )
    if (aUnspentTxOuts === null) {
      console.log('invalid transactions in blockchain')
      return null
    }
  }
  return aUnspentTxOuts
}

// 将区块添加进链
const addBlockToChain = (newBlock: Block): boolean => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    const retVal: UnspentTxOut[] = processTransactions(
      newBlock.data,
      getUnspentTxOuts(),
      newBlock.index
    )
    if (retVal === null) {
      console.log('block is not valid in terms of transactions')
      return false
    } else {
      blockchain.push(newBlock)
      setUnspentTxOuts(retVal)
      updateTransactionPool(unspentTxOuts)
      return true
    }
  }
  return false
}

// 如果分叉的话，选择难度最高的那条，毕竟区块链的世界，算力高的才是大哥
const replaceChain = (newBlocks: Block[]) => {
  const aUnspentTxOuts = isValidChain(newBlocks)
  const validChain: boolean = aUnspentTxOuts !== null
  if (
    validChain &&
    getAccumulatedDifficulty(newBlocks) >
      getAccumulatedDifficulty(getBlockchain())
  ) {
    console.log(
      'Received blockchain is valid. Replacing current blockchain with received blockchain'
    )
    blockchain = newBlocks
    setUnspentTxOuts(aUnspentTxOuts)
    updateTransactionPool(unspentTxOuts)
    broadcastLatest()
  } else {
    console.log('Received blockchain invalid')
  }
}

// 添加交易进交易池
const handleReceivedTransaction = (transaction: Transaction) => {
  addToTransactionPool(transaction, getUnspentTxOuts())
}

export {
  Block,
  getBlockchain,
  getUnspentTxOuts,
  getLatestBlock,
  sendTransaction,
  generateRawNextBlock,
  generateNextBlock,
  generatenextBlockWithTransaction,
  handleReceivedTransaction,
  getMyUnspentTransactionOutputs,
  getAccountBalance,
  isValidBlockStructure,
  replaceChain,
  addBlockToChain,
  genesisBlock
}
