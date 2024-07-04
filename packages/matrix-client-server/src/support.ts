import {
  send,
  type expressAppHandler
} from '../../matrix-identity-server/src/utils'

// TODO : update contacts
// const contacts: object[] = [
//  {
//    email_address: '',
//    matrix_id: '',
//    role: 'm.role.admin' || 'm.role.security'
//  }
//  ]

// TODO : update support page
const supportPage: string = 'https://twake.app/support'

const getSupport: expressAppHandler = (req, res) => {
  const response: { contacts?: object[]; supportPage: string } = {
    supportPage
  }
  // if (contacts.length > 0) {
  //   response.contacts = contacts
  // }
  send(res, 200, response)
}

export default getSupport
