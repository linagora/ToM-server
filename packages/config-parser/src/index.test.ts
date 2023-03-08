import twakeConfig from './index'

test('Default values', () => {
  const res = twakeConfig({
    value_1: null,
    value_2: null,
    value_3: 1,
    value_4: true,
    value_6: false,
    value_7: 'ZZZ'
  })
  expect(res).toEqual({
    value_3: 1,
    value_4: true,
    value_6: false,
    value_7: 'ZZZ'
  })
})

test('Default values with file', () => {
  const res = twakeConfig({
    value_1: null,
    value_2: null,
    value_3: 1,
    value_4: true,
    value_6: false,
    value_7: 'ZZZ'
  }, './src/__testData__/desc1.json')
  expect(res).toEqual({
    value_1: 'val1',
    value_3: 'val3',
    value_4: true,
    value_6: false,
    value_7: 'ZZZ'
  })
})

test('Environment variables', () => {
  process.env.VALUE_2 = 'val2'
  process.env.VALUE_3 = 'val__3'
  process.env.VALUE_4 = 'val4'
  const res = twakeConfig({
    value_1: null,
    value_2: null,
    value_3: 1,
    value_4: true,
    value_6: false,
    value_7: 'ZZZ'
  }, './src/__testData__/desc1.json')
  expect(res).toEqual({
    value_1: 'val1',
    value_2: 'val2',
    value_3: 'val__3',
    value_4: 'val4',
    value_6: false,
    value_7: 'ZZZ'
  })
})

test('Unwanted key', () => {
  expect(() => {
    twakeConfig({
      value_1: null,
      value_2: null,
      value_3: 1,
      value_4: true,
      value_6: false,
      value_7: 'ZZZ'
    }, './src/__testData__/desc2.json')
  }).toThrowError("Key unwanted_value isn't accepted")
})
