import * as utils from './tokenUtils'

test('randomString', () => {
  const res = utils.randomString(64)
  expect(res).toMatch(/^[a-zA-Z0-9]{64}$/)
})
