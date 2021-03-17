/// <reference path="ReadableStream.ts" />

namespace WHATWG.Streams {
  export
  interface ReadableStream<T> {
    tee(): ReadableStream<T>[]
  }

  ReadableStream.prototype.tee = function<T> (this: ReadableStream<T>) {
    const stream = this
    const reader = stream.getReader()

    let reading = false
    const reasons = [ undefined, undefined ]
    const canceleds = [ false, false ]
    const controllers: ReadableStreamDefaultController<T>[] = []
    const canceledState = new StateMachine<void>()

    const source: UnderlyingSource<T> = {
      start(controller) {
        controllers.push(controller)
      },

      pull(controller)  {
        if (reading) {
          return Promise.resolve()
        }
        reading = true
        reader.read().then(helpers.onRead, helpers.onReadEnd)
        return Promise.resolve()
      },

      type: undefined,
    }

    const helpers = {
      onRead({ done, value: chunk }: IteratorResult<T, undefined>) {
        if (!done) {
          // queueMicrotask
          // HANDLED(Promise.resolve().then(() => {
            helpers.onReadEnd()
            helpers.enqueueAll(chunk!)
          // }))
        } else {
          helpers.onReadEnd()
          helpers.closeAll()
        }
      },

      onReadEnd() {
        reading = false
      },

      enqueueAll(chunk: T) {
        for (let i = 0; i < controllers.length; i++) {
          if (!canceleds[i]) {
            const branch = branches[i]
            if (!branch.closing && !branch.erroring) {
              try {
                controllers[i].enqueue(chunk)
              } catch (e) {}
            }
          }
        }
      },

      closeAll() {
        for (let i = 0; i < controllers.length; i++) {
          if (!canceleds[i]) {
            const branch = branches[i]
            if (!branch.closing && !branch.erroring) {
              try {
                controllers[i].close()
              } catch (e) {}
            }
          }
        }
        canceledState.setStaged()
      },

      errorAll(reason: any) {
        for (let i = 0; i < controllers.length; i++) {
          controllers[i].error(reason)
        }
      },

      makeCancelHook(i: number) {
        return (reason: any) => {
          canceleds[i] = true
          reasons[i] = reason
          if (canceleds.every(r => r)) {
            const canceled = stream['producer']!.cancel(reasons)
            canceledState.setStaged(canceled)
          }
          return canceledState.current
        }
      }
    }

    const branches = [
      new ReadableStream({ ...source, cancel: helpers.makeCancelHook(0) }),
      new ReadableStream({ ...source, cancel: helpers.makeCancelHook(1) }),
    ]

    reader.closed.catch((r: any) => {
      helpers.errorAll(r)
      canceledState.setStaged()
    })

    return branches
  }
}
