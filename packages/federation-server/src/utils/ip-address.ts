import { Address4, Address6 } from 'ip-address'

export const convertToIPv6 = (ipAddress: string): Address6 => {
  if (typeof ipAddress !== 'string') {
    throw new Error('An IP address must be of string type')
  }
  if (Address6.isValid(ipAddress)) {
    return new Address6(ipAddress)
  } else if (Address4.isValid(ipAddress)) {
    return Address6.fromAddress4(ipAddress)
  } else {
    throw new Error(`The IP address ${ipAddress} is not valid`)
  }
}
