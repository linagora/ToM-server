import { operation } from 'retry'

interface IRetryOptions {
  retries?: number
  minTimeout?: number
  maxTimeout?: number
}

class RetryPromise<T> extends Promise<T> {
  static readonly defaultOptions = {
    retries: 3,
    minTimeout: 100,
    maxTimeout: 1000
  }

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => void,
    options: IRetryOptions = {}
  ) {
    const constructorOptions = { ...RetryPromise.defaultOptions, ...options }
    const op = operation(constructorOptions)
    super((resolve, reject) => {
      op.attempt(() => {
        executor(resolve, (e) => {
          // console.log(e)
          if (!op.retry(e)) {
            reject(op.mainError())
          }
        })
      })
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/class-literal-property-style
  static get [Symbol.species]() {
    return Promise
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  static all<T>(
    promises: Iterable<T | RetryPromise<T>>
  ): Promise<Array<Awaited<T>>> {
    const argsContainPromises = [...promises].some(
      (item) => item instanceof Promise && !(item instanceof RetryPromise)
    )
    if (argsContainPromises) {
      throw new Error('Cannot pass an instance of Promise to this method')
    }
    return Promise.all(promises)
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  static allSettled<T>(
    promises: Iterable<T | RetryPromise<T>>
  ): Promise<Array<PromiseSettledResult<Awaited<T>>>> {
    const argsContainPromises = [...promises].some(
      (item) => item instanceof Promise && !(item instanceof RetryPromise)
    )
    if (argsContainPromises) {
      throw new Error('Cannot pass an instance of Promise to this method')
    }
    return Promise.allSettled(promises)
  }
}

export default RetryPromise
