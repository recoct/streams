namespace WHATWG.Streams {
  export
  class WritableStreamDefaultController<T> {
    constructor(protected readonly stream: WritableStream<T>) {
      guard(stream instanceof WritableStream)
      guard(!stream.locked)
      guard(!this.consumer)
    }

    protected get producer() {
      return this.stream['producer']
    }

    protected get consumer() {
      return this.stream['consumer']!
    }

    public error(reason?: any) {
      const canPropagateError = this.consumer!.error(reason)
      if (canPropagateError) {
        this.producer?.error(reason)
      }
    }
  }
}
