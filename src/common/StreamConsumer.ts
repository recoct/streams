namespace WHATWG.Streams {
  export
  class StreamConsumer<T> extends Runloop implements ISlot {
    protected readonly closedState = new ClosedState(this)

    constructor(protected readonly stream: Stream<T>) {
      super()
    }

    public didInstall(host?: any) {
    }

    public willUninstall(host: any) {
      this.closedState.setStaging()
      this.closedState.setFailed(new TypeError())
    }

    public get closed() {
      return this.closedState.current
    }

    public next(): void {
      this.resume()
    }

    /** @override */
    protected shouldExit() {
      return this.stream.drained
    }

    /** @override */
    protected shouldYield() {
      return this.stream.empty || this.stream.thresholdSize >= 0 && !this.stream.closing
    }
  }
}
