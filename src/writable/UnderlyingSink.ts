namespace WHATWG.Streams {
  export
  namespace UnderlyingSink {
    export
    function normalize<T>(sink?: UnderlyingSink<T>): NormalizedUnderlyingSink<T> {
      guard(sink !== null)

      const { start, write, close, abort } = sink ?? {}
      guard(typeof start === 'undefined' || typeof start === 'function')
      guard(typeof write === 'undefined' || typeof write === 'function')
      guard(typeof close === 'undefined' || typeof close === 'function')
      guard(typeof abort === 'undefined' || typeof abort === 'function')

      return {
        /**
         * execute or throws
         * @throws @rejection_handled
         */
        start(controller) {
          let r = start && Reflect.apply(start, sink, [ controller ])
          if (r && typeof r.then === 'function') {
            if (!(r instanceof Promise)) {
              r = new Promise(r.then.bind(r))
            }
            // ensure return as Promise<void>
            return HANDLED(r.then(NO_OP, (e: any) => {
              controller.error(e)
              throw e
            }))
          }
          return Promise.resolve()
        },

        /**
         * execute or error
         * @rejection_handled
         */
        write(chunk, controller) {
          try {
            let r = write && Reflect.apply(write, sink, [ chunk, controller ])
            if (r && typeof r.then === 'function') {
              if (!(r instanceof Promise)) {
                r = new Promise(r.then.bind(r))
              }
              // ensure return as Promise<void>
              return HANDLED(r.then(NO_OP, (e: any) => {
                controller.error(e)
                throw e
              }))
            }
            return Promise.resolve()
          } catch (e) {
            return DEFER(() => {
              controller.error(e)
              throw e
            })
          }
        },

        /**
         * execute or error
         * @rejection_handled
         * @deprecated_paramter controller
         */
        close(controller) {
          try {
            let r = close && Reflect.apply(close, sink, [ /*controller*/ ])
            if (r && typeof r.then === 'function') {
              // ensure return as Promise<void>
              if (!(r instanceof Promise)) {
                r = new Promise(r.then.bind(r))
              }
              // ensure return as Promise<void>
              return HANDLED(r.then(NO_OP, (e: any) => {
                controller.error(e)
                throw e
              }))
            }
            return Promise.resolve()
          } catch (e) {
            return DEFER(() => {
              controller.error(e)
              throw e
            })
          }
        },

        /**
         * execute
         * @rejection_handled
         */
        abort(reason?: any) {
          try {
            let r = abort && Reflect.apply(abort, sink, [ reason ])
            if (r && typeof r.then === 'function') {
              if (!(r instanceof Promise)) {
                r = new Promise(r.then.bind(r))
              }
              // ensure return as Promise<void>
              return HANDLED(r.then(NO_OP))
            }
            return Promise.resolve()
          } catch (e) {
            return HANDLED(Promise.reject(e))
          }
        },
      }
    }

    export
    const from = normalize
  }
}
