import * as dotenv from 'dotenv'
dotenv.config()

import { OrderBookMap, startWatch } from './manager'
import express, { Express, Request, Response } from 'express'

startWatch((getOrderBook: () => OrderBookMap) => {
  const app: Express = express()
  const port = process.env.SERVICE_PORT || 4000

  app.get('/', function (req: Request, res: Response) {
    res.send('Alive')
  })

  app.get('/event/:id', function (req: Request, res: Response) {
    const orderBooks = getOrderBook()
    res.send(orderBooks[req.params.id])
  })

  const server = app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`)
  })

  process.on('SIGINT', server.close)
  process.on('exit', server.close)
})
