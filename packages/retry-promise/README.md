# @twake/retry-promise

Simple module extending javascript Promise with retry strategy

## Synopsis

```js
import RetryPromise from '@twake/retry-promise'

const promise = new RetryPromise((resolve, reject) => {
  fetch(URL)
    .then(val => resolve())
    .catch(reject)
})

const promiseWithOption = new RetryPromise((resolve, reject) => {
  fetch(URL)
    .then(val => resolve())
    .catch(reject)
  },{
    retries: 6
    minTimeout: 10 // The number of milliseconds before starting the first retry
    maxTimeout: 100 // The maximum number of milliseconds between two retries
  }
)

const allPromises = RetryPromise.all([
      new RetryPromise((resolve, reject) => {
        fetch(URL_1)
          .then(val => resolve())
          .catch(reject)
      }),
      new RetryPromise((resolve, reject) => {
        fetch(URL_2)
          .then(val => resolve())
          .catch(reject)
      })
    ])

const allSettledtPromises = RetryPromise.allSettled([
      new RetryPromise((resolve, reject) => {
        fetch(URL_1)
          .then(val => resolve())
          .catch(reject)
      }),
      new RetryPromise((resolve, reject) => {
        fetch(URL_2)
          .then(val => resolve())
          .catch(reject)
      })
    ])
```

## How it works

`RetryPromise` allows to build promises that can be re-triggered 3 times or a custom number of times. We can also redefine `minTimeout` option and `maxTimeout` option values, by default it is 100 ms and 1000 ms. Finally, `all` and `allSettled` are very similar to the native Promise methods, but they do not accept Promises instances as parameters.

## Copyright and license

Copyright (c) 2023-present Linagora <https://linagora.com>

License: [GNU AFFERO GENERAL PUBLIC LICENSE](https://ci.linagora.com/publicgroup/oss/twake/tom-server/-/blob/master/LICENSE)
