namespace WHATWG.Streams {
  export
  class WritableStream<T> extends Stream<T> {
    protected producer?: WritableStreamProducer<T>
    protected consumer?: WritableStreamConsumer<T>

    constructor(init: UnderlyingSink<T>, strategy?: QueuingStrategy<T>) {
      super(strategy)
      const sink = UnderlyingSink.normalize(init)
      const controller = new WritableStreamDefaultController(this)
      this.installConsumer(sink, controller)
    }

    public getWriter(): WritableStreamDefaultWriter<T> {
      guard(!this.locked)
      return new WritableStreamDefaultWriter(this)
    }

    public installConsumer(sink: NormalizedUnderlyingSink<T>, controller: WritableStreamDefaultController<T>): void {
      guard(!this.consumer)
      this.consumer = new WritableStreamConsumer(this, sink, controller)
      this.consumer.didInstall(this)
    }

    public installProducer(): void {
      guard(!this.producer)
      this.producer = new WritableStreamProducer(this)
      this.producer.didInstall(this)
    }

    public uninstallConsumer(): void {
      guard(!!this.consumer)
      this.consumer.willUninstall(this)
      this.consumer = undefined
    }

    public uninstallProducer(data?: any): void {
      guard(!!this.producer)
      this.producer.willUninstall(this, data)
      this.producer = undefined
    }

    public abort(reason?: any): Promise<void> {
      if (typeof this.producer !== 'undefined') {
        return HANDLED(Promise.reject(new TypeError()))
      }
      return this.consumer!.abort(reason)
    }

    /** @override */
    public close() {
      if (typeof this.producer !== 'undefined') {
        return HANDLED(Promise.reject(new TypeError()))
      }

      try {
        guard(!this.closing)
        this.enqueue(CLOSE_SENTINEL)
        super.close()
      } catch (e) {
        return HANDLED(Promise.reject(e))
      }

      return this.consumer!.next('close')
    }

    public get locked(): boolean {
      return typeof this.producer !== 'undefined' && typeof this.consumer !== 'undefined'
    }
  }
}
