import {
  isClientSecretValid,
  isEventTypeValid,
  isMatrixIdValid,
  isRoomIdValid,
  isSidValid,
  isStateKeyValid,
  isCountryValid,
  isPhoneNumberValid,
  isEmailValid,
  isRoomAliasValid
} from './regex'

describe('isClientSecretValid', () => {
  it('should return true if the client secret is valid', () => {
    expect(isClientSecretValid('abc123._=-')).toBe(true)
  })

  it('should return false if the client secret is invalid', () => {
    expect(isClientSecretValid('abc')).toBe(false)
  })
})

describe('isEventTypeValid', () => {
  it('should return true if the event type is valid', () => {
    expect(isEventTypeValid('m.room.message')).toBe(true)
  })

  it('should return false if the event type is invalid', () => {
    expect(isEventTypeValid('m.room..message')).toBe(false)
  })

  it('should return false if the event type is too long', () => {
    expect(isEventTypeValid('m.' + 'a'.repeat(255))).toBe(false)
  })
})

describe('isMatrixIdValid', () => {
  it('should return true if the matrix ID is valid', () => {
    expect(isMatrixIdValid('@user:matrix.org')).toBe(true)
  })

  it('should return false if the matrix ID is invalid', () => {
    expect(isMatrixIdValid('user:matrix.org')).toBe(false)
  })

  it('should return false if the matrix ID is too long', () => {
    expect(isMatrixIdValid('@' + 'a'.repeat(256))).toBe(false)
  })
})

describe('isRoomIdValid', () => {
  it('should return true if the room ID is valid', () => {
    expect(isRoomIdValid('!abc123:matrix.org')).toBe(true)
  })

  it('should return false if the room ID is invalid', () => {
    expect(isRoomIdValid('abc123:matrix.org')).toBe(false)
  })

  it('should return false if the room ID is too long', () => {
    expect(isRoomIdValid('!' + 'a'.repeat(256))).toBe(false)
  })
})

describe('isSidValid', () => {
  it('should return true if the sid is valid', () => {
    expect(isSidValid('abc123._=-')).toBe(true)
  })

  it('should return false if the sid is invalid', () => {
    expect(isSidValid('')).toBe(false)
  })
})

describe('isStateKeyValid', () => {
  it('should return true if the state key is valid', () => {
    expect(isStateKeyValid('stateKey')).toBe(true)
  })

  it('should return false if the state key is too long', () => {
    expect(isStateKeyValid('a'.repeat(256))).toBe(false)
  })
})

describe('isCountryValid', () => {
  it('should return true if the country code is valid', () => {
    expect(isCountryValid('US')).toBe(true)
  })

  it('should return false if the country code is invalid', () => {
    expect(isCountryValid('USA')).toBe(false)
  })
})

describe('isPhoneNumberValid', () => {
  it('should return true if the phone number is valid', () => {
    expect(isPhoneNumberValid('1234567890')).toBe(true)
  })

  it('should return false if the phone number is invalid', () => {
    expect(isPhoneNumberValid('01234567890')).toBe(false)
  })
})

describe('isEmailValid', () => {
  it('should return true if the email is valid', () => {
    expect(isEmailValid('test@example.com')).toBe(true)
  })

  it('should return false if the email is invalid', () => {
    expect(isEmailValid('test@com')).toBe(false)
  })
})

describe('isRoomAliasValid', () => {
  it('should return true if the room alias is valid', () => {
    expect(isRoomAliasValid('#room:matrix.org')).toBe(true)
  })

  it('should return false if the room alias is invalid', () => {
    expect(isRoomAliasValid('room:matrix.org')).toBe(false)
  })
})
