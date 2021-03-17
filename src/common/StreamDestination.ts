namespace WHATWG.Streams {
	export
	interface GenericController {
    error(e?: any): void
  }

	export
	interface SetUpLogic<C extends GenericController = any> {
    /** @hook @async */
    start?(controller: C): void | Promise<void>
  }

  export
  interface TearDownLogic {
    /** @hook @async */
    cancel?(reason?: any): void | Promise<void>
    /** @hook @async */
    abort?(reason?: any): void | Promise<void>
  }

  export
  interface Source<C extends GenericController = any> extends SetUpLogic<C>, Pick<TearDownLogic, 'cancel'> {
    /** @hook @async */
    pull?(controller: C): void | Promise<void>
  }

  export
  interface Sink<T, C extends GenericController = any> extends SetUpLogic<C>, Pick<TearDownLogic, 'abort'> {
  	/** @hook @async */
  	write?(chunk: T, controller: C): void | Promise<void>
  	/** @hook @async */
    /** @deprecated_parameter controller */
    close?(/*controller: C*/): void | Promise<void>
  }

  export
  interface UnderlyingSource<T> extends Source<ReadableStreamDefaultController<T>> {
    type: 'bytes' | undefined
  }

  export
  interface UnderlyingSink<T> extends Sink<T, WritableStreamDefaultController<T>> {}

  export
  type NormalizedUnderlyingSource<T> = MapMethodsReturnTypes<Required<UnderlyingSource<T>>, Promise<void>>

  export
  type NormalizedUnderlyingSink<T> = MapMethodsReturnTypes<Required<UnderlyingSink<T>>, Promise<void>>
}
