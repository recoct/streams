namespace WHATWG.Streams {
  export
  class WritableStreamConsumer<T> extends StreamConsumer<T> {
    private starting: boolean = false
    private started: boolean = false

    private erroring: boolean = false
    private caughtError: any

    private errored: boolean = false
    private finished: boolean = false

    private abortedUnexpectedly: boolean = false
    private abortedErrorUnexpectedly: any
    private abortedPromise: Promise<void> | undefined

    constructor(protected readonly stream: WritableStream<T>, protected readonly sink: NormalizedUnderlyingSink<T>, protected readonly controller: WritableStreamDefaultController<T>) {
      super(stream)
    }

    /** @override */
    public didInstall(host?: any): void {
      super.didInstall(host)
      this.start()
    }

    /** @throws */
    private start(): void {
      let thrown = false
      let errorThrown: any
      this.enqueueRequest({
        next: () => {
          try {
            const r = this.sink.start(this.controller)
            HANDLED(r.finally(() => this.started = true))
            return r
          } catch (e) {
            thrown = true
            errorThrown = e
            throw e // rethrow to break the runloop
          }
        },
        name: 'start'
      })
      this.starting = true
      // bubbles error outside
      if (thrown) {
        throw errorThrown
      }
    }

    /** @throws */
    private start0(): void {
      const r = this.sink.start(this.controller)
      HANDLED(r.finally(() => this.started = true))
      HANDLED(r.then(() => this.resume()))
    }

    public next(name?: string): Promise<void> {
      return HANDLED(new Promise<void>((resolve, reject) => {
        const request = {
          next: () => {
            const chunk = this.stream.peek()
            if (chunk !== CLOSE_SENTINEL) {
              const r = this.sink.write(chunk, this.controller)
              r.then(resolve, reject)
              HANDLED(r.finally(() => this.stream.dequeue()))
              return r
            } else {
              this.stream.dequeue()
              assert(this.stream.empty)
              const r = this.sink.close(this.controller)
              r.then(resolve, reject)
              r.catch(e => {
                this.abortedUnexpectedly = true
                this.abortedErrorUnexpectedly = e
              })
              HANDLED(r.then(() => this.finished = true))
              return r
            }
          },
          done: assertUnreached,
          error: (e: any) => {
            this.stream.reset()

            reject(e)
          },
          name,
        }

        // throw-safe
        try {
          const r = this.enqueueRequest(request)
          // guard(r)
          if (!r) {
            reject(new TypeError())
          }
        } catch (e) {
          /** @todo distinguish between write and close request in a better way then by name */
          if (request.name === 'close') {
            reject(new TypeError())
          } else {
            reject(e)
          }
        }
      }))
    }

    /** disable stop */
    /** @override */
    public stop(reason?: any): boolean {
      return false
    }

    public abort(reason?: any) {
      guard(typeof this.stream !== 'undefined')

      let alreadyErroring = false

      const r = this.abortedPromise ??= HANDLED(new Promise<void>((resolve, reject) => {
        let terminated = true
        try {
          terminated = !this.enqueueRequest({
            next: assertUnreached,
            done: () => {
              this.abortedPromise = undefined
              resolve()
            },
            error: e => {
              this.abortedPromise = undefined
              if (this.abortedUnexpectedly) {
                reject(this.abortedErrorUnexpectedly)
              } else
              if (alreadyErroring) {
                reject(e)
              } else {
                const r = this.sink.abort(e)
                r.then(resolve, reject)
                return r
              }
            },
            name: 'abort'
          })
        } catch (e) {} finally {
          if (terminated) {
            resolve()
          }
        }
      }))

      if (!this.error(reason)) {
        alreadyErroring = true
      }

      return r
    }

    /** @override */
    public shouldYield(): boolean {
      // no waiting before starting
      if (!this.starting) {
        return false
      }
      return super.shouldYield()
    }
  }
}
