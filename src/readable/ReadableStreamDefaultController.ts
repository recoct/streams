namespace WHATWG.Streams {
  export
  class ReadableStreamDefaultController<T> {
    constructor(protected readonly stream: ReadableStream<T>) {
      guard(stream instanceof ReadableStream)
      guard(!stream.locked)
    }

    protected get producer() {
      return this.stream['producer']!
    }

    protected get consumer() {
      return this.stream['consumer']
    }

    public get desiredSize(): number | null {
      return this.producer.desiredSize
    }

    /** @throws */
    public enqueue(chunk: T) {
      try {
        guard(!this.stream.closing && !this.stream.erroring)
        this.stream.enqueue(chunk)
      } catch (e) {
        this.error(e)
        throw e
      }
      this.consumer?.resume()
      this.producer.next()
    }

    /** @throws */
    public close() {
      try {
        guard(!this.stream.closing && !this.stream.erroring)
        this.stream.close()
      } catch (e) {
        this.error(e)
        throw e
      }
      this.producer.stop()
      this.consumer?.resume()
    }

    /** safe to error more than one times */
    public error(reason?: any) {
      this.stream.error()
      this.producer.error(reason)
      this.consumer?.error(reason)
    }
  }
}
