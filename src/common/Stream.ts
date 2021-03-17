namespace WHATWG.Streams {
  export
  abstract class Stream<T = any> {
    protected readonly queue = new Queue<T>(this.strategy)

    private _closing: boolean = false
    private _erroring: boolean = false

    constructor(protected readonly strategy?: QueuingStrategy<T>) {}

    public enqueue(item: T): void {
      this.queue.put(item)
    }

    public dequeue(): T {
      return this.queue.take()
    }

    protected unshift(item: T): void {
      this.queue.unshift(item)
    }

    public peek(): T {
      return this.queue.peek()
    }

    public get desiredSize(): number | null {
      return this.queue.desiredSize
    }

    public get thresholdSize(): number {
      return this.queue.thresholdSize
    }

    public get closing(): boolean {
      return this._closing
    }

    public close(): void {
      this._closing = true
    }

    public get erroring(): boolean {
      return this._erroring
    }

    public error(): void {
      this._erroring = true
    }

    public reset(): void {
      this.queue.reset()
    }

    public get empty(): boolean {
      return this.queue.empty
    }

    public get drained(): boolean {
      return this.queue.empty && this.closing
    }
  }
}
