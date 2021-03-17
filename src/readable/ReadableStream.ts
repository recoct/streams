namespace WHATWG.Streams {
  export
  class ReadableStream<T> extends Stream<T> {
    protected producer?: ReadableStreamProducer<T>
    protected consumer?: ReadableStreamConsumer<T>

    constructor(init: UnderlyingSource<T>, strategy?: QueuingStrategy<T>) {
      super(strategy)
      const source = UnderlyingSource.normalize(init)
      const controller = new ReadableStreamDefaultController(this)
      this.installProducer(source, controller)
    }

    public cancel(reason?: any): Promise<void> {
      if (this.consumer) {
        return HANDLED(Promise.reject(new TypeError()))
      }
      return this.producer!.cancel(reason)
    }

    public getReader(options: any = {}): ReadableStreamDefaultReader<T> {
      guard(typeof options === 'object' || typeof options === 'function')
      guard(typeof options.mode === 'undefined' || String(options.mode) === 'byob')
      guard(!this.locked)
      // readable bytes stream not supported yet
      guard(typeof options.mode === 'undefined')
      return new ReadableStreamDefaultReader(this)
    }

    public getController(): ReadableStreamDefaultController<T> {
      const controller = new ReadableStreamDefaultController(this)
      return controller
    }

    public installProducer(source: NormalizedUnderlyingSource<T>, controller: ReadableStreamDefaultController<T>): void {
      guard(!this.producer)
      this.producer = new ReadableStreamProducer(this, source, controller)
      this.producer.didInstall(this)
    }

    public installConsumer(): void {
      guard(!this.consumer)
      this.consumer = new ReadableStreamConsumer(this)
      this.consumer.didInstall(this)
    }

    public uninstallProducer(): void {
      guard(!!this.producer)
      this.producer.willUninstall(this)
      this.producer = undefined
    }

    public uninstallConsumer(): void {
      guard(!!this.consumer)
      this.consumer.willUninstall(this)
      this.consumer = undefined
    }

    public get locked(): boolean {
      return typeof this.consumer !== 'undefined' && typeof this.producer !== 'undefined'
    }
  }
}
