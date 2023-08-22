import RetryPromise from '.'

describe('Retry promise', () => {
  const promiseTest = {
    default: async () => await Promise.resolve(1)
  }

  const promiseError = new Error('error on resolving promise')

  describe('Constructor', () => {
    test('should retry the promise three times on create', async () => {
      jest
        .spyOn(promiseTest, 'default')
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockResolvedValueOnce(1)

      await expect(
        new RetryPromise((resolve, reject) => {
          promiseTest
            .default()
            .then((value) => {
              resolve(value)
            })
            .catch(reject)
        })
      ).resolves.toEqual(1)
    })

    test('should retry the promise a custom number of times on create', async () => {
      jest
        .spyOn(promiseTest, 'default')
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockResolvedValueOnce(1)

      await expect(
        new RetryPromise(
          (resolve, reject) => {
            promiseTest
              .default()
              .then((value) => {
                resolve(value)
              })
              .catch(reject)
          },
          { retries: 6 }
        )
      ).resolves.toEqual(1)
    })

    test('should reject the promise if it fails four times', async () => {
      jest
        .spyOn(promiseTest, 'default')
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockRejectedValueOnce(promiseError)
        .mockResolvedValueOnce(1)

      await expect(
        new RetryPromise((resolve, reject) => {
          promiseTest
            .default()
            .then((value) => {
              resolve(value)
            })
            .catch(reject)
        })
      ).rejects.toEqual(promiseError)
    })
  })

  describe('Static methods', () => {
    const promiseTest1 = {
      default: async () => await Promise.resolve(1)
    }

    const promiseTest2 = {
      default: async () => await Promise.resolve(2)
    }

    describe('All method', () => {
      test('should retry the rejected promise three times', async () => {
        jest
          .spyOn(promiseTest2, 'default')
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockResolvedValueOnce(2)

        await expect(
          RetryPromise.all([
            new RetryPromise((resolve, reject) => {
              promiseTest1
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            new RetryPromise((resolve, reject) => {
              promiseTest2
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            })
          ])
        ).resolves.toEqual([1, 2])
      })

      test('should reject if one promise fails three times', async () => {
        jest
          .spyOn(promiseTest2, 'default')
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockResolvedValueOnce(2)

        await expect(
          RetryPromise.all([
            new RetryPromise((resolve, reject) => {
              promiseTest1
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            new RetryPromise((resolve, reject) => {
              promiseTest2
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            })
          ])
        ).rejects.toEqual(promiseError)
      })

      test('should reject if one parameter is a promise', async () => {
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        expect(() =>
          RetryPromise.all([
            new RetryPromise((resolve, reject) => {
              promiseTest1
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            new RetryPromise((resolve, reject) => {
              promiseTest2
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            Promise.resolve(2)
          ])
        ).toThrowError('Cannot pass an instance of Promise to this method')
      })
    })

    describe('AllSettled method', () => {
      test('should retry the reject promise three times', async () => {
        jest
          .spyOn(promiseTest2, 'default')
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockResolvedValueOnce(2)

        await expect(
          RetryPromise.allSettled([
            new RetryPromise((resolve, reject) => {
              promiseTest1
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            new RetryPromise((resolve, reject) => {
              promiseTest2
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            })
          ])
        ).resolves.toEqual([
          { status: 'fulfilled', value: 1 },
          { status: 'fulfilled', value: 2 }
        ])
      })

      test('should resolve if one promise fails three times', async () => {
        jest
          .spyOn(promiseTest2, 'default')
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockRejectedValueOnce(promiseError)
          .mockResolvedValueOnce(2)

        await expect(
          RetryPromise.allSettled([
            new RetryPromise((resolve, reject) => {
              promiseTest1
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            }),
            new RetryPromise((resolve, reject) => {
              promiseTest2
                .default()
                .then((value) => {
                  resolve(value)
                })
                .catch(reject)
            })
          ])
        ).resolves.toEqual([
          { status: 'fulfilled', value: 1 },
          { status: 'rejected', reason: promiseError }
        ])
      })

      test('should reject if one parameter is a promise', async () => {
        expect(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          () =>
            RetryPromise.allSettled([
              new RetryPromise((resolve, reject) => {
                promiseTest1
                  .default()
                  .then((value) => {
                    resolve(value)
                  })
                  .catch(reject)
              }),
              new RetryPromise((resolve, reject) => {
                promiseTest2
                  .default()
                  .then((value) => {
                    resolve(value)
                  })
                  .catch(reject)
              }),
              Promise.resolve(1)
            ])
        ).toThrowError('Cannot pass an instance of Promise to this method')
      })
    })
  })
})
