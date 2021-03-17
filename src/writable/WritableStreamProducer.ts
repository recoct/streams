namespace WHATWG.Streams {
  export
  class WritableStreamProducer<T> extends StreamProducer<T> implements ISlot {
    private readonly readyState = new StateMachine<void>()

    private closing: boolean = false
    private caughtError: any

    /** @override */
    public didInstall(host?: any): void {
      super.didInstall(host)
      this.resume()
    }

    /** @override */
    public willUninstall(host: any, reserved?: any): void {
      this.readyState.setStaging()
      this.readyState.setFailed(reserved ?? new TypeError())
      super.willUninstall(host)
    }

    public get ready(): Promise<void> {
      return this.readyState.current
    }

    /** @override */
    public resume(): boolean {
      if (this.desiredSize === null) {
        this.readyState.setFailed()
        return false
      }

      if (this.desiredSize > 0 || this.closing) {
        this.readyState.setStaged()
        return true
      }

      this.readyState.setStaging()
      return false
    }

    /** @override @throws */
    public next(chunk?: T): void {
      guard(!this.closing)
      this.stream.enqueue(chunk!)
      this.resume()
    }

    /** @override @throws */
    public stop(): boolean {
      guard(!this.closing)
      if (this.erroring) {
        return false
      }
      this.closing = true
      if (!this.stream.closing) {
        this.stream.enqueue(CLOSE_SENTINEL)
        Reflect.apply(Stream.prototype.close, this.stream, [])
        // this.stream.close()
      }
      this.readyState.setStaged()
      return true
    }

    /** @overrde */
    public error(reason?: any): boolean {
      const r = super.error(reason)
      if (r) {
        assert(this.erroring)
        this.caughtError = reason
        // forcedly set failed
        this.readyState.setStaging()
        this.readyState.setFailed(reason)
      }
      return r
    }
  }
}
