namespace WHATWG.Streams {
  export
  class StreamProducer<T> extends Runloop implements ISlot {
    protected readonly closedState = new ClosedState(this)

    protected erroring: boolean = false

    constructor(protected readonly stream: Stream<T>) {
      super()
    }

    public didInstall(host?: any): void {
    }

    public willUninstall(host: any): void {
    }

    public get desiredSize(): number | null {
      if (this.erroring) {
        return null
      }
      if (this.stream.drained) {
        return 0
      }
      return this.stream.desiredSize
    }

    public next(): void {
      this.resume()
    }

    /** @override */
    public error(reason?: any): boolean {
      this.erroring = true
      return super.error(reason)
    }

    /** @override */
    protected shouldExit() {
      return this.stream.closing
    }

    /** @override */
    protected shouldYield() {
      return this.stream.desiredSize! <= 0
    }
  }
}
