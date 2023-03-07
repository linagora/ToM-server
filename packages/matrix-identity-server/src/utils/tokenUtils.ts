export const randomChar = (): string => {
  let n = Math.floor(Math.random() * 62) + 48
  if (n > 57) n += 7
  if (n > 90) n += 6
  return String.fromCharCode(n)
}

export const randomString = (n: number): string => {
  let res = ''
  for (let i = 0; i < n; i++) {
    res += randomChar()
  }
  return res
}
