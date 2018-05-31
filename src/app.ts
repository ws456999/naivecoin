import * as Koa from 'koa'
import * as json from 'koa-json'
import * as onerror from 'koa-onerror'
import * as bodyparser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import * as cors from 'koa2-cors'

import { router } from './routes'

export const initHttpServer = (myHttpPort: number) => {
  const app = new Koa()

  onerror(app)
  app.use(
    bodyparser({
      enableTypes: ['json', 'form', 'text']
    })
  )
  app.use(json())
  app.use(logger())
  app.use(cors())

  app.use(router.routes()).use(router.allowedMethods())

  // 监听端口，启动程序
  app.listen(myHttpPort, () => {
    console.log(`blockchain listening on port ${myHttpPort}`)
  })
}
