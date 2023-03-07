import {errMsg} from './errors'

test('Errors', () => {
  expect( JSON.parse( errMsg('forbidden','Not authorized') ) )
    .toEqual({"errcode":"M_FORBIDDEN","error":"Not authorized"})
})
