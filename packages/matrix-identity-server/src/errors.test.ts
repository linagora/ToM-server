import {errMsg} from './errors'

test('Errors', () => {
  expect( JSON.parse( errMsg('forbidden','Not authorized') ) )
    .toEqual({"errcode":"M_FORBIDDEN","error":"Not authorized"})
  expect( JSON.parse( errMsg('threepidInUse') ) )
    .toEqual({"errcode":"M_THREEPID_IN_USE","error":"Threepid In Use"})
})
