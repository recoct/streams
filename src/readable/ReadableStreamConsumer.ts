namespace WHATWG.Streams {
  export
  class ReadableStreamConsumer<T> extends StreamConsumer<T> implements ISlot {
    protected readonly closedState = new ClosedState(this, true)

    /** @override */
    public next(): Promise<IteratorResult<T, undefined>> {
      return HANDLED(new Promise((resolve, reject) => {
        const request = {
          next: () => {
            const chunk = this.stream.dequeue()
            resolve({ done: false, value: chunk })
          },
          done: () => {
            resolve({ done: true, value: undefined })
          },
          error: (e: any) => {
            reject(e)
          },
          name: 'read'
        }
        try {
          const r = this.enqueueRequest(request)
          if (!r) {
            request.done()
          }
        } catch (e) {
          request.error(e)
        }
      }))
    }
  }
}
