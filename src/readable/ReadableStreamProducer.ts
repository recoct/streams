namespace WHATWG.Streams {
  const MAX_PULLS_INFLIGHT = 2

  export
  class ReadableStreamProducer<T> extends StreamProducer<T> {
    private started: boolean = false
    private pulls: number = 0
    private forced: boolean = false

    constructor(protected readonly stream: ReadableStream<T>, protected readonly source: NormalizedUnderlyingSource<T>, protected readonly controller: ReadableStreamDefaultController<T>) {
      super(stream)
    }

    /** @override */
    public didInstall(host?: any): void {
      super.didInstall(host)
      this.start()
    }

    private start(): void {
      assert(!!this.source && !!this.controller)
      HANDLED(this.source.start(this.controller).then(() => {
        // if (this.stream.closing || this.stream.erroring) {
        //   return
        // }
        this.started = true
        this.next()
      }))
    }

    public next() {
      const captured = {} as any
      ;(Error as any).captureStackTrace(captured, Object.getPrototypeOf(this).next)
      if (!this.started || this.pulls >= MAX_PULLS_INFLIGHT || this.shouldYield()) {
        return
      }

      this.pulls += 1
      try {
        this.enqueueRequest({
          next: () => {
            const r = this.source.pull(this.controller)
            HANDLED(r.finally(() => { this.pulls -= 1 }))
            return r
          },
          name: 'pull'
        })
      } catch (e) {
        // this.pulls -= 1
      }
    }

    public cancel(reason?: any) {
      guard(typeof this.stream !== 'undefined')
      if (this.stream.drained || this.stream.erroring) {
        return Promise.resolve()
      }
      if (!this.stream.closing) {
        this.controller.close()
      }
      this.stream.reset()
      assert(this.stream.drained)
      return this.source.cancel(reason)
    }

    public set forcedPull(forced: boolean) {
      this.forced = forced
    }

    /** @override */
    protected shouldYield(): boolean {
      return !this.forced && super.shouldYield()
    }
  }
}

