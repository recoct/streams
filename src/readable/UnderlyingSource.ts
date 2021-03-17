namespace WHATWG.Streams {
  export
  namespace UnderlyingSource {
    export
    function normalize<T>(source?: UnderlyingSource<T>): NormalizedUnderlyingSource<T> {
      guard(source !== null)

      const { start, pull, cancel, type } = source ?? { type: undefined }
      guard(typeof start === 'undefined' || typeof start === 'function')
      guard(typeof pull === 'undefined' || typeof pull === 'function')
      guard(typeof cancel === 'undefined' || typeof cancel === 'function')

      guard(typeof type === 'undefined' || String(type) === 'bytes')

      return {
        /**
         * execute or throws
         * @throws @rejection_handled
         */
        start(controller) {
            const r = start && Reflect.apply(start, source, [ controller ])
            if (r && r instanceof Promise) {
              r.catch(e => controller.error(e))
            }
            return Promise.resolve(r)
        },

        /**
         * execute or defer error
         * @rejection_handled
         */
        pull(controller) {
          try {
            const r = pull && Reflect.apply(pull, source, [ controller ])
            if (r && r instanceof Promise) {
              r.catch(e => controller.error(e))
            }
            return Promise.resolve(r)
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
        cancel(reason?: any) {
          try {
            const r = cancel && Reflect.apply(cancel, source, [ reason ])
            if (r && r instanceof Promise) {
              // ensure the return type is Promise<void>
              return HANDLED(r.then(NO_OP))
            }
            return Promise.resolve()
          } catch (e) {
            return HANDLED(Promise.reject(e))
          }
        },

        type,
      }
    }

    export
    const from = normalize
  }
}
