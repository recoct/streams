namespace WHATWG.Streams {
  export
  enum RunloopState {
    Running = 0x01,
    Waiting = 0x02,

    Finished = 0x10,
    Stopped = 0x20,
    Errored = 0x40,

    Finishing = Finished | Running,
    Stopping = Stopped | Running,
    Erroring = Errored | Running,

    Cycling = Running | Waiting,
    Terminating = Finishing | Stopping | Erroring,
    Terminated = Finished | Stopped | Errored,

    All = Cycling | Terminating | Terminated,
  }

  export
  interface RunloopRequest {
    next?(): void | Promise<void>
    done?(): void
    error?(reason: any): void
    name?: any
  }

  export
  type RunloopObserverCallback= (state: RunloopState, error?: any) => void

  interface RunloopObserver {
    readonly state: RunloopState
    readonly handler: RunloopObserverCallback
  }

  export
  class Runloop {
    private requests: RunloopRequest[] = []
    private observers: RunloopObserver[] = []
    private state: RunloopState = 0
    private storedError: any
    private generator = this.startGenerator()
    private locked: boolean = false
    private disabled: boolean = false

    public get idle(): boolean {
      return this.requests.length === 0
    }

    /** @ensure_entered */
    public resume(): boolean {
      if (!this.ensureEntered('resume')) {
        return false
      }

      if (!this.locked) {
        this.generator.next()
      }

      return true
    }

    /** @throws @ensure_entered */
    public stop(): boolean {
      if (!this.ensureEntered('stop')) {
        return false
      }

      this.state |= RunloopState.Stopping
      if (!this.locked) {
        this.generator.return()
      }

      return true
    }

    /** @ensure_entered */
    public error(e?: any): boolean {
      if (!this.ensureEntered('error')) {
        return false
      }

      this.state |= RunloopState.Stopping | RunloopState.Erroring
      this.storedError = e
      if (!this.locked) {
        try {
          this.generator.throw(e)
        } catch (e) {}
      }

      return true
    }

    /** @throws @ensure_entered */
    public enqueueRequest(request: RunloopRequest): boolean {
      if (!this.ensureEntered('request')) {
        return false
      }

      if (!(this.state & RunloopState.Running)) {
        if (this.state & RunloopState.Errored) {
          throw this.storedError
        }
        return false
      }

      this.requests.push(request)

      if (!this.locked) {
        this.generator.next()
      }

      return true
    }

    public addObserver(state: RunloopState, handler: RunloopObserverCallback): boolean {
      if (this.disabled) {
        return false
      }
      if (this.state > 0 && !(this.state & RunloopState.Running)) {
        return false
      }
      this.observers.push({ state, handler })
      return true
    }

    /** ensure entered the try-catch-finally block to catch abort signals */
    private ensureEntered(action: 'resume' | 'stop' | 'error' | 'request'): boolean {
      if (this.disabled) {
        return false
      }

      const shouldCconcernTerminated = action !== 'request'
      const shouldThrow = action === 'stop' || action === 'resume'/* || action === 'request'*/
      if (shouldCconcernTerminated && this.isTerminated(shouldThrow)) {
        return false
      }

      if (this.state === 0) {
        assert(!this.locked)
        this.generator.next()
      }

      return true
    }

    private *startGenerator() {
      let sync = true
      try {
        this.state |= RunloopState.Running
        yield

        while (true) {
          if (this.shouldExit()) {
            this.state |= RunloopState.Finished
            return
          }

          if (this.requests.length === 0 || this.shouldYield()) {
            if (!(this.state & RunloopState.Waiting)) {
              this.state |= RunloopState.Waiting
              this.notifyObservers()
            }
            // might receive abort signals (.stop, .error) here
            yield
            // check exit or yield condition again
            continue
          }

          if (this.state & RunloopState.Waiting) {
            this.state ^= RunloopState.Waiting
            this.notifyObservers()
          }

          const request = this.requests.shift()
          assert(typeof request !== 'undefined')
          const { next } = request

          sync = true
          // might receive abort signals during the exeuction
          const r = this.execute(next)

          if (r && r instanceof Promise) {
            sync = false
            let settled = false
            r.then(
              () => {
                settled = true
                if (this.shouldExit()) {
                  // if should exit, ignore abort signals from outside
                  if (this.state & RunloopState.Terminated) {
                    this.state &= ~RunloopState.Terminated
                  }
                  this.state |= RunloopState.Finished
                  this.generator.return()
                } else {
                // if (!(this.state & RunloopState.Terminated)) {
                  this.generator.next()
                // }
              }
              },
              e => {
                settled = true
                if (!(this.state & RunloopState.Terminated)) {
                  this.generator.throw(e)
                } else {
                  this.generator.next()
                }
              }
            )
            while (!settled) {
              // might receive abort signals here
              try {
                yield
              } catch (e) {
                if (settled) {
                  throw e
                }
              }
            }
          }


          if (sync) {
            assert(!(this.state & RunloopState.Terminated))
            continue
          }

          // defer handling abort signals
          if (this.state & RunloopState.Errored) {
            throw this.storedError
          } else
          if (this.state & RunloopState.Terminated) {
            return
          }
        }
      } catch (e) {
        if (!(this.state & RunloopState.Errored)) {
          this.state |= RunloopState.Errored
          this.storedError = e
          // do not rethrow error here 'cause it is unpredicatable to throw error async
        }

      } finally {
        this.notifyObservers()

        this.state &= ~RunloopState.Cycling

        let pending: Promise<void> | undefined
        if (this.state & RunloopState.Errored) {
          for (const { error } of this.requests) {
            if (typeof pending === 'undefined') {
              try {
                const r = this.execute(error, this.storedError)
                if (r && r instanceof Promise) {
                  pending = r
                } else
                if (r && typeof r.then === 'function') {
                  pending = new Promise(r.then.bind(r))
                }
              } catch (e) {}
            } else {
              pending = pending.finally(() => this.execute(error, this.storedError))
              HANDLED(pending)
            }
          }
        } else {
          for (const { done } of this.requests) {
            if (typeof pending === 'undefined') {
              try {
                const r = this.execute(done, this.storedError)
                if (r && r instanceof Promise) {
                  pending = r
                } else
                if (r && typeof r.then === 'function') {
                  pending = new Promise(r.then.bind(r))
                }
              } catch (e) {}
            } else {
              pending = pending.finally(() => this.execute(done, this.storedError))
              HANDLED(pending)
            }
          }
        }
        this.requests.length = 0

        if (typeof pending === 'undefined') {
          this.notifyObservers()
          this.observers.length = 0
        } else {
          pending.finally(() => {
            this.notifyObservers()
            this.observers.length = 0
          }).catch(NO_OP)
        }
      }
    }

    private notifyObservers(): void {
      this.disabled = true
      for (const observer of this.observers.slice()) {
        if (this.state & observer.state) {
          try {
            observer.handler(this.state, this.storedError)
          } catch (e) {}
        }
      }
      this.disabled = false
    }

    private execute(callback: RunloopRequest['next' | 'done' | 'error'], arg?: any): any {
      if (typeof callback !== 'function') {
        return
      }
      assert(!this.locked)
      this.locked = true
      try {
        return Reflect.apply(callback, null, [ arg ])
      } finally {
        this.locked = false
      }
    }

    private isTerminated(throws: boolean = true): boolean {
      if (this.state & RunloopState.Errored && throws) {
        throw this.storedError
      }
      return (this.state & RunloopState.Terminated) !== 0
    }

    /** to override */
    protected shouldExit(): boolean {
      return false
    }

    /** to override */
    protected shouldYield(): boolean {
      return false
    }
  }
}
