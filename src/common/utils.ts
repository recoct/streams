namespace WHATWG {
  export
  type Constructor = new (...args: any[]) => any

  export
  type AnyFunction = (...args: any[]) => any
  export
  type MapReturnType<F extends AnyFunction, R> = (...args: Parameters<F>) => R
  export
  type MapMethodsReturnTypes<T, R> = { [ x in keyof T ]:  T[x] extends AnyFunction ? MapReturnType<T[x], R> : T[x] }

  declare const Error: any

  export
  function assert(condition: boolean, message?: any): asserts condition {
    if (!condition) {
      const error = message instanceof Error ? message : new Error(message)
      error.name = 'AssertionError'
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(error, assert)
      }
      throw error
    }
  }

  export
  function guard(condition: boolean, message?: any): asserts condition {
    if (!condition) {
      const error = message instanceof Error ? message : new TypeError(message)
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(error, guard)
      }
      throw error
    }
  }

  export
  function assertUnreached(message?: any): never {
    const error = message instanceof Error ? message : new Error(message)
    error.name = 'AssertionError'
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(error, assertUnreached)
    }
    throw error
  }

  export
  const ASSERT = assert

  export
  const GUARD = guard

  export
  function NO_OP(...args: any[]) {}

  export
  function DEFER(callback: () => void | PromiseLike<void>): Promise<void> {
    return HANDLED(Promise.resolve().then(callback))
  }

  export
  function REJECTION(error?: any): Promise<void> {
    return HANDLED(Promise.reject(error))
  }

  export
  const DEFER_ERROR = REJECTION

  export
  function HANDLED<T>(p: PromiseLike<T>): Promise<T> {
    const r = p instanceof Promise ? p : new Promise<T>(p.then.bind(p))
    r.then(NO_OP, NO_OP)
    return r
  }

  export
  function FIRST<T1, T2>(e1: T1, e2: T2): T1
  export
  function FIRST<T1, T2, T3>(e1: T1, e2: T2, e3: T3): T1
  export
  function FIRST<T1, T2, T3, T4>(e1: T1, e2: T2, e3: T3, e4: T4): T1
  export
  function FIRST(...args: any[]) {
    return args[0]
  }

  export
  function LAST<T1, T2>(e1: T1, e2: T2): T2
  export
  function LAST<T1, T2, T3>(e1: T1, e2: T2, e3: T3): T3
  export
  function LAST<T1, T2, T3, T4>(e1: T1, e2: T2, e3: T3, e4: T4): T4
  export
  function LAST(...args: any[]) {
    return args[args.length - 1]
  }
}
