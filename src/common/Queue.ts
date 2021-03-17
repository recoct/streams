namespace WHATWG.Streams {
  export
  class Queue<T = any> {
    private readonly queue: [T, number][] = []
    private totalSize: number = 0

    protected readonly strategy: QueuingStrategy<T>

    constructor(strategy?: QueuingStrategy<T>) {
      this.strategy = QueuingStrategy.normalize(strategy)
    }

    /** @throws if error occurs in strategy.size function */
    public put(item: T): void {
      if (item === CLOSE_SENTINEL) {
        this.queue.push([ item, 0 ])
        return
      }
      const size = this.strategy.size(item)
      guard(size > 0, new RangeError())
      this.queue.push([ item, size ])
      this.totalSize += size
    }

    /** @throws if error occurs in strategy.size function */
    public take(): T {
      assert(this.queue.length > 0)
      const [ item, size ] = this.queue[0]
      this.totalSize -= size
      /** rounding errors @see https://streams.spec.whatwg.org/#dequeue-value */
      if (this.totalSize < 0) {
        this.totalSize = 0
      }
      this.queue.shift()
      return item
    }

    public peek(): T {
      const [ item ] = this.queue[0]
      return item
    }

    /** @throws if error occurs in strategy.size function */
    public unshift(item: T): void {
      const size = this.strategy.size(item)
      guard(size > 0, new RangeError())
      this.queue.unshift([ item, size ])
      this.totalSize += size
    }

    public get size(): number {
      return this.totalSize
    }

    public get empty(): boolean {
      return this.queue.length === 0
    }

    public reset(): void {
      this.queue.length = 0
      this.totalSize = 0
    }

    /** indicates whether should put items */
    public get desiredSize() {
      return this.strategy.highWaterMark - this.totalSize
    }

    /** indicates whether should take items */
    public get thresholdSize() {
      return (this.strategy.lowWaterMark ?? 0) - this.totalSize
    }
  }
}
