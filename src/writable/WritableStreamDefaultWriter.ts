namespace WHATWG.Streams {
  export
  class WritableStreamDefaultWriter<T> {
    protected producer!: WritableStreamProducer<T>
    protected consumer!: WritableStreamConsumer<T>

    private closedState = new StateMachine<void>()

    constructor(protected readonly stream: WritableStream<T>) {
      guard(stream instanceof WritableStream)
      guard(!stream.locked)
      this.setup()
    }

    private setup(): void {
      this.stream.installProducer()
      this.consumer = this.stream['consumer']!
      this.producer = this.stream['producer']!
      assert(typeof this.consumer !== 'undefined')
      assert(typeof this.producer !== 'undefined')

      this.syncClosedState()

      // propagate state from the consumer to the new producder
      try {
        const closed = !this.consumer.resume()
        if (closed) {
          this.producer.stop()
        } else {
          this.producer.resume()
        }
      } catch (e) {
        // error the producer if the consumer erroring
        this.producer.error(e)
      }
    }

    private teardown(): void {
      const reason = new TypeError()
      // uninstall yet keep producer reference
      this.stream.uninstallProducer(reason)
      // force to set failed
      this.closedState.setStaging()
      this.closedState.setFailed(reason)
    }

    public releaseLock() {
      if (!this.stream.locked) {
        return
      }
      if (this.producer !== this.stream['producer']) {
        return
      }

      this.teardown()
    }

    public get closed() {
      return this.closedState.current
    }

    get ready() {
      return this.producer.ready
    }

    get desiredSize() {
      guard(this.producer === this.stream['producer'])
      if (!this.consumer['finished'] && this.stream.closing) {
        return this.stream.desiredSize
      }
      return this.producer.desiredSize
    }

    write(chunk: T) {
      if (this.producer !== this.stream['producer']) {
        return HANDLED(Promise.reject(new TypeError()))
      }

      try {
        // pre-check whether consumer erroring
        this.consumer.resume()
        this.producer.next(chunk)
      } catch (e) {
        this.producer!.error(e)
        this.consumer!.error(e)
        return HANDLED(Promise.reject(e))
      }

      const r = this.consumer.next('write')
      HANDLED(r.then(() => this.producer.resume()))
      return r
    }

    public close() {
      if (this.producer !== this.stream['producer']) {
        return HANDLED(Promise.reject(new TypeError()))
      }

      try {
        this.producer.stop()
      } catch (e) {
        return HANDLED(Promise.reject(new TypeError()))
      }

      return this.consumer.next('close')
    }

    public abort(reason?: any) {
      if (this.producer !== this.stream['producer']) {
        return HANDLED(Promise.reject(new TypeError()))
      }

      return LAST(
        this.producer.error(reason),
        this.consumer.abort(reason),
      )
    }

    private syncClosedState(): void {
      this.consumer.closed.then(
        () => this.closedState.setStaged(),
        r => this.closedState.setFailed(r),
      )
    }
  }
}
