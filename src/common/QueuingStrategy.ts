namespace WHATWG.Streams {
  interface SizingStrategy<T> {
    size(chunk: T): number
  }

  export
  interface QueuingStrategy<T> extends SizingStrategy<T> {
    readonly highWaterMark: number
    readonly lowWaterMark?: number
  }

  export
  interface QueuingStrategyInit<T> {
    readonly highWaterMark: number
  }

  export
  class CountQueuingStrategy implements QueuingStrategy<any> {
    public readonly highWaterMark: number

    constructor(init: QueuingStrategyInit<any>) {
      guard(init !== null)
      guard('highWaterMark' in init)
      this.highWaterMark = Number(init.highWaterMark)
    }

    public size() {
      return 1
    }
  }

  export
  class ByteLengthQueuingStrategy implements QueuingStrategy<ArrayBufferView> {
    public readonly highWaterMark: number

    constructor(init: QueuingStrategyInit<ArrayBufferView>) {
      guard(init !== null)
      guard('highWaterMark' in init)
      this.highWaterMark = Number(init.highWaterMark)
    }

    public size(chunk: ArrayBufferView) {
      return chunk.byteLength
    }
  }

  export
  namespace QueuingStrategy {
    const isValidSize = (size: any) => typeof size === 'number' && !Number.isNaN(size) && size >= 0

    export
    function normalize(strategy?: QueuingStrategy<any>, type?: 'bytes'): QueuingStrategy<any> {
      guard(strategy !== null)
      guard(typeof type === 'undefined' || type === 'bytes')

      let { highWaterMark, size } = strategy ?? {}
      guard(typeof size === 'undefined' || typeof size === 'function')
      if (typeof highWaterMark !== 'undefined') {
        highWaterMark = Number(highWaterMark)
        guard(isValidSize(highWaterMark), new RangeError())
      }

      if (type !== 'bytes') {
        highWaterMark ??= 1
        if (typeof size === 'undefined') {
          return new CountQueuingStrategy({ highWaterMark })
        }
        const unsafeSize = size
        size = (chunk: any) => {
          const size = unsafeSize(chunk)
          guard(isValidSize(size), new RangeError())
          guard(Number.isFinite(size), new RangeError())
          return size
        }
        return { highWaterMark, size }
      }

      assert(type === 'bytes')
      guard(typeof size === 'undefined')
      highWaterMark ??= 0
      return new ByteLengthQueuingStrategy({ highWaterMark })
    }
  }
}
