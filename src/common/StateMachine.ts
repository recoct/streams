namespace WHATWG.Streams {
  export
  class StateMachine<T = any> {
    private state: Promise<T>
    private resolve?: (value: T | PromiseLike<T>) => void
    private reject?: (reason?: any) => void

    constructor(resolved?: boolean) {
      this.state = this.reset()
    }

    public get current(): Promise<T> {
      return this.state
    }

    public setStaging(): void {
      this.state = this.reset()
    }

    public setStaged(v: T | PromiseLike<T>): void {
      this.resolve?.(v)
      delete this.resolve
    }

    public setFailed(e?: any): void {
      this.reject?.(e)
      // this.state = Promise.reject(e)
      // this.state.catch(NO_OP)
      delete this.reject
    }

    private reset(): Promise<T> {
      if (this.resolve && this.reject) {
        return this.state
      }
      return HANDLED(new Promise<T>((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      }))
    }

  }
}
