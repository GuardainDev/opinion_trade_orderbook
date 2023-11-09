import Denque from 'denque'
import { Order } from './order'

export class OrderQueue {
  private _price: number
  private _volume: number
  private orders: Denque<Order>

  constructor(price: number) {
    this._price = price
    this._volume = 0
    this.orders = new Denque<Order>()
  }

  // returns the number of orders in queue
  len = (): number => {
    return this.orders.length
  }

  toArray = (): Order[] => {
    return this.orders.toArray()
  }

  // returns price level of the queue
  price = (): number => {
    return this._price
  }

  // returns price level of the queue
  volume = (): number => {
    return this._volume
  }

  // returns top order in queue
  head = (): Order | undefined => {
    return this.orders.peekFront()
  }

  // returns bottom order in queue
  tail = (): Order | undefined => {
    return this.orders.peekBack()
  }

  // adds order to tail of the queue
  append = (order: Order): Order => {
    this._volume += order.size
    this.orders.push(order)
    return order
  }

  // sets up new order to list value
  update = (oldOrder: Order, newOrder: Order) => {
    this._volume -= oldOrder.size
    this._volume += newOrder.size
    // Remove old order from head
    this.orders.removeOne(0)
    // Add new order to head // TODO head?? or tail???
    this.orders.unshift(newOrder)
  }

  // removes order from the queue
  remove = (order: Order) => {
    this._volume -= order.size
    this.orders.removeOne(0)
  }

  updateOrderSize = (order: Order, newSize: number) => {
    this._volume += newSize - order.size // update volume
    order.size = newSize
    order.time = Date.now()
  }
}
