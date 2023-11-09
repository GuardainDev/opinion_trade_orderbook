import { ERROR, CustomError } from './errors'
import { Order, OrderUpdate } from './order'
import { OrderQueue } from './orderqueue'
import { OrderSide } from './orderside'
import { Side } from './side'

export interface ProcessOrder {
  err: Error | null
  executedOrders: Array<ExecutedOrderDetails>
  partialQuantity: number | null
  // marketPrice: MarketPrice
}

enum OrderStatus {
  OPEN,
  PARTIAL_OPEN,
  COMPLETED,
  CANCELED,
}

export type ExecutedOrderDetails = {
  order: Order
  quantityExecuted: number
  status: OrderStatus
}

// export type MarketPrice = {
//   YES: number
//   NO: number
// }

export enum OrderVerifyStatus {
  VALID,
  REMOVE,
  UPDATE,
}

export type VerifyOrderCallBack = (
  orderId: string,
  size: number
) => Promise<{ status: OrderVerifyStatus; size: number }>

export class OrderBook {
  public orders: { [key: string]: Order } = {}
  private bids: OrderSide
  private asks: OrderSide
  private currentExecutedOrders: Array<ExecutedOrderDetails> = []

  public static readonly BASE_DIV_PRICE = 0.5
  public static readonly BASE_PRICE = 1
  public static readonly HIGHEST_ALLOWED_PRICE = 0.95
  public static readonly LOWEST_ALLOWED_PRICE = 0.05

  // private _marketPrice: MarketPrice = {
  //   YES: OrderBook.BASE_DIV_PRICE,
  //   NO: OrderBook.BASE_DIV_PRICE,
  // }

  private verifyOrderCallback: VerifyOrderCallBack

  constructor(verifyOrderCallback: VerifyOrderCallBack) {
    this.verifyOrderCallback = verifyOrderCallback
    this.bids = new OrderSide()
    this.asks = new OrderSide()
  }

  // Places new limit order to the OrderBook
  // Arguments:
  //      side     - what do you want to do (ob.Sell or ob.Buy)
  //      orderID  - unique order ID in depth
  //      quantity - how much quantity you want to sell or buy
  //      price    - no more expensive (or cheaper) this price
  //      * to create new decimal number you should use decimal.New() func
  //        read more at https://github.com/shopspring/decimal
  // Return:
  //      error   - not nil if quantity (or price) is less or equal 0. Or if order with given ID is exists
  //      done    - not nil if your order produces ends of anoter order, this order will add to
  //                the "done" slice. If your order have done too, it will be places to this array too
  //      partial - not nil if your order has done but top order is not fully done. Or if your order is
  //                partial done and placed to the orderbook without full quantity - partial will contain
  //                your order with quantity to left
  //      partialQuantityProcessed - if partial order is not nil this result contains processed quatity from partial order
  limit = async (
    side: Side,
    orderID: string,
    size: number,
    price: number,
    user_slug: string
  ): Promise<ProcessOrder> => {
    const response: ProcessOrder = {
      executedOrders: [],
      partialQuantity: null,
      err: null,
      // marketPrice: this.marketPrice,
    }

    const order = this.orders[orderID]
    if (order) {
      response.err = CustomError(ERROR.ErrOrderExists)
      return response
    }

    if (!size || typeof size !== 'number' || size <= 0) {
      response.err = CustomError(ERROR.ErrInvalidQuantity)
      return response
    }

    if (!price || typeof price !== 'number' || price <= 0) {
      response.err = CustomError(ERROR.ErrInvalidPrice)
      return response
    }

    return await this.limitOrderProcessing(
      side,
      orderID,
      size,
      price,
      user_slug,
      response
    )
  }

  limitOrderProcessing = async (
    side: Side,
    orderID: string,
    quantityToTrade: number,
    price: number,
    user_slug: string,
    response: ProcessOrder
  ): Promise<ProcessOrder> => {
    this.currentExecutedOrders = []
    const { sideToAdd, sideToProcess, comparator, bestPrice } =
      this.orderParams(
        side,
        this.ensurePriceWithinLimit(OrderBook.BASE_PRICE - price)
      )
    console.log({ bestPrice, quantityToTrade, side, price })

    if (
      quantityToTrade > 0 &&
      sideToProcess.len() > 0 &&
      bestPrice &&
      comparator(price, bestPrice.price())
    ) {
      const { quantityLeft } = await this.processQueue(
        bestPrice,
        quantityToTrade
      )
      quantityToTrade = quantityLeft || 0
    }

    if (quantityToTrade > 0) {
      const order = new Order(
        orderID,
        side,
        quantityToTrade,
        price,
        user_slug,
        Date.now()
      )
      this.orders[orderID] = sideToAdd.append(order)
      response.partialQuantity = quantityToTrade
    } else {
      response.partialQuantity = 0
    }

    response.executedOrders = this.currentExecutedOrders
    console.log({ currentExecutedOrders: this.currentExecutedOrders })
    this.currentExecutedOrders = []
    // this.calculateMarketPrice()
    // response.marketPrice = this.marketPrice
    return response
  }

  ensurePriceWithinLimit = (val: number) => {
    val = val == OrderBook.BASE_PRICE ? OrderBook.HIGHEST_ALLOWED_PRICE : val
    val =
      val < OrderBook.LOWEST_ALLOWED_PRICE
        ? OrderBook.LOWEST_ALLOWED_PRICE
        : val
    return +val.toPrecision(2)
  }

  // calculateMarketPrice = () => {
  //   const orders = Object.values(this.orders)
  //   const total = orders.reduce(
  //     (total, order) => total + order.price * order.size,
  //     OrderBook.BASE_PRICE
  //   )
  //   const buyTotal = orders
  //     .filter((x) => x.side == Side.BUY)
  //     .reduce(
  //       (total, order) => total + order.price * order.size,
  //       OrderBook.BASE_DIV_PRICE
  //     )

  //   const finalTotal = buyTotal / total
  //   let initialVal =
  //     Math.ceil(finalTotal / OrderBook.LOWEST_ALLOWED_PRICE) *
  //     OrderBook.LOWEST_ALLOWED_PRICE
  //   let oppositeVal =
  //     Math.ceil(
  //       (OrderBook.BASE_PRICE - initialVal) / OrderBook.LOWEST_ALLOWED_PRICE
  //     ) * OrderBook.LOWEST_ALLOWED_PRICE
  //   initialVal = this.ensurePriceWithinLimit(initialVal)
  //   oppositeVal = this.ensurePriceWithinLimit(oppositeVal)

  //   this.marketPrice = {
  //     YES: initialVal,
  //     NO: oppositeVal,
  //   }
  //   console.log({ marketPrice: this.marketPrice })
  // }

  // get marketPrice(): MarketPrice {
  //   return this._marketPrice
  // }

  // set marketPrice(marketPrice: MarketPrice) {
  //   this._marketPrice = marketPrice
  // }

  checkIfMatches = (a: number, b: number): boolean => {
    return a + b == 1
  }

  greaterThanOrEqual = (a: number, b: number): boolean => {
    return a >= b
  }

  lessThanOrEqual = (a: number, b: number): boolean => {
    return a <= b
  }

  verifyAndUpdateOrder = async (
    order: Order,
    orderQueue: OrderQueue
  ): Promise<boolean> => {
    const { status, size } = await this.verifyOrderCallback(
      order.id,
      order.size
    )

    if (status === OrderVerifyStatus.REMOVE) {
      orderQueue.remove(order)
      return false
    }

    if (status === OrderVerifyStatus.UPDATE) {
      orderQueue.updateOrderSize(order, size)
    }

    return true
  }

  processQueue = async (orderQueue: OrderQueue, quantityToTrade: number) => {
    let quantityLeft = quantityToTrade
    if (quantityLeft) {
      while (orderQueue.len() > 0 && quantityLeft > 0) {
        const headOrder = orderQueue.head()
        if (
          !headOrder ||
          !(await this.verifyAndUpdateOrder(headOrder, orderQueue))
        ) {
          continue
        }
        if (quantityLeft < headOrder.size) {
          const order = new Order(
            headOrder.id,
            headOrder.side,
            headOrder.size - quantityLeft,
            headOrder.price,
            headOrder.user_slug,
            headOrder.time
          )
          const quantityExecuted = quantityLeft
          orderQueue.update(headOrder, order)
          quantityLeft = 0
          this.currentExecutedOrders.push({
            order,
            quantityExecuted,
            status: OrderStatus.PARTIAL_OPEN,
          })
        } else {
          quantityLeft = quantityLeft - headOrder.size
          this.cancel(headOrder.id)
          const quantityExecuted = headOrder.size
          headOrder.size = 0
          this.currentExecutedOrders.push({
            order: headOrder,
            quantityExecuted,
            status: OrderStatus.COMPLETED,
          })
        }
        console.log('\n', '\n')
      }
    }
    return {
      quantityLeft,
    }
  }

  // Returns order by id
  order = (orderID: string): Order | undefined => {
    return this.orders[orderID]
  }

  // Returns price levels and volume at price level
  depth = () => {
    let level = this.asks.maxPriceQueue()
    const asks = []
    const bids = []
    while (level) {
      const levelPrice = level.price()
      asks.push([levelPrice, level.volume()])
      level = this.asks.lessThan(levelPrice)
    }

    level = this.bids.maxPriceQueue()
    while (level) {
      const levelPrice = level.price()
      bids.push([levelPrice, level.volume()])
      level = this.bids.lessThan(levelPrice)
    }
    return [asks, bids]
  }

  // Modify an existing order with given ID
  modify = (
    orderID: string,
    orderUpdate: OrderUpdate
  ): Order | undefined | void => {
    const order = this.orders[orderID]
    if (!order) return
    const side = orderUpdate.side
    if (side === Side.BUY) {
      return this.bids.update(order, orderUpdate)
    } else if (side === Side.SELL) {
      return this.asks.update(order, orderUpdate)
    } else {
      throw CustomError(ERROR.ErrInvalidSide)
    }
  }

  // Removes order with given ID from the order book
  cancel = (orderID: string): Order | undefined => {
    const order = this.orders[orderID]
    if (!order) return
    delete this.orders[orderID]
    if (order.side === Side.BUY) {
      return this.bids.remove(order)
    }
    return this.asks.remove(order)
  }

  toString(): string {
    return (
      this.asks.toString() +
      '\r\n------------------------------------' +
      this.bids.toString()
    )
  }

  private orderParams(side: Side, opposite_price: number) {
    let sideToProcess: OrderSide
    let sideToAdd: OrderSide
    let comparator
    let bestPrice

    console.log({ opposite_price })
    if (side === Side.BUY) {
      sideToAdd = this.bids
      sideToProcess = this.asks
      comparator = this.checkIfMatches
      bestPrice = this.asks.find(opposite_price)
    } else {
      sideToAdd = this.asks
      sideToProcess = this.bids
      comparator = this.checkIfMatches
      bestPrice = this.bids.find(opposite_price)
    }
    return {
      sideToAdd,
      sideToProcess,
      comparator,
      bestPrice,
    }
  }
}
