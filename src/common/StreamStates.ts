namespace WHATWG.Streams {
  abstract class RunloopStateMachine extends StateMachine<void> {
    private readonly _observer = this.observer.bind(this)

    constructor(protected readonly runloop: Runloop) {
      super()
      this.setup()
    }

    protected abstract get statesToObserve(): RunloopState
    protected abstract observer(state: RunloopState, error?: any): void

    private setup(): void {
      const states = this.statesToObserve
      try {
        const r = this.runloop.addObserver(states, this._observer)
        if (!r) {
          this.observer(RunloopState.Stopped | RunloopState.Finished)
        }
      } catch (e) {
        this.observer(RunloopState.Errored, e)
      }
    }

    public destroy(): void {
      // const states = this.statesToObserve
      // this.runloop.removeObserver(states, this._observer)
    }
  }

  export
  class ClosedState extends RunloopStateMachine {
    constructor(protected readonly runloop: Runloop, private readonly early: boolean = false) {
      super(runloop)
    }

    protected get statesToObserve() {
      return RunloopState.Terminated
    }

    protected observer(state: RunloopState, error?: any): void {
      if ((state & RunloopState.Running) && !this.early) {
        return
      }

      if (state & RunloopState.Errored) {
        this.setFailed(error)
      } else
      if (state & RunloopState.Terminated) {
        this.setStaged()
      }
    }
  }


  export
  class ReadyState extends RunloopStateMachine {
    protected get statesToObserve() {
      return RunloopState.All
    }

    protected observer(state: RunloopState, error?: any): void {
      if (state & RunloopState.Errored) {
        this.setFailed(error)
      } else
      if (state & RunloopState.Terminated) {
        this.setStaged()
      } else
      if (state & RunloopState.Waiting) {
        this.setStaging()
      } else {
        this.setStaged()
      }
    }
  }
}
