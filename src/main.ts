import { initHttpServer } from './app'
import { initP2PServer } from './p2p'
import { initWallet } from './wallet'

const httpPort: number = parseInt(process.env.HTTP_PORT, 10) || 3001
const p2pPort: number = parseInt(process.env.P2P_PORT, 10) || 6001

initHttpServer(httpPort)
initP2PServer(p2pPort)
initWallet()
