const domainRe =
  '(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9])\\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9])'
const portRe =
  '((6553[0-5])|(655[0-2][0-9])|(65[0-4][0-9]{2})|(6[0-4][0-9]{3})|([1-5][0-9]{4})|([0-5]{0,5})|([0-9]{1,4}))'
export const hostnameRe = new RegExp(`^${domainRe}(:${portRe})?$`, 'i')
