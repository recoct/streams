namespace WHATWG.Streams {
  export
  class ReadableStreamDefaultReader<T> {
    protected producer!: ReadableStreamProducer<T>
    protected consumer!: ReadableStreamConsumer<T>

    constructor(protected readonly stream: ReadableStream<T>) {
      guard(stream instanceof ReadableStream)
      guard(!stream.locked)
      this.setup()
    }

    private setup(): void {
      this.stream.installConsumer()
      this.consumer = this.stream['consumer']!
      this.producer = this.stream['producer']!
      assert(typeof this.consumer !== 'undefined')
      assert(typeof this.producer !== 'undefined')

      try {
        this.producer.resume()
        this.consumer.resume()
      } catch (e) {
        // error the consumer if the producer already errored
        this.consumer.error(e)
      }
    }

    private teardown(): void {
      this.stream.uninstallConsumer()
      // keep consumer reference
    }

    public get closed() {
      return this.consumer.closed
    }

    public cancel(reason?: any) {
      if (this.consumer !== this.stream['consumer']) {
        return HANDLED(Promise.reject(new TypeError()))
      }
      return FIRST(
        this.producer.cancel(reason),
        this.consumer.stop(),
      )
    }

    public releaseLock() {
      if (!this.stream.locked) {
        return
      }
      if (this.consumer !== this.stream['consumer']) {
        return
      }
      this.teardown()
    }

    public read() {
      const r = this.consumer.next()
      this.syncReadState(r)
      this.producer.next()
      return HANDLED(r)
    }

    private syncReadState(when?: Promise<any>): void {
      if (when && when instanceof Promise) {
        HANDLED(when.then(() => { this.producer.forcedPull = !this.consumer.idle }))
      }
      this.producer.forcedPull = !this.consumer.idle
    }
  }
}
