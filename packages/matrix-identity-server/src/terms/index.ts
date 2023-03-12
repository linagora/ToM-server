import type IdentityServerDb from '../db'
import { type expressAppHandler, send } from '../utils'

// TODO: implement policies
const Terms = (db: IdentityServerDb): expressAppHandler => {
  return (req, res) => {
    send(res, 200, {
      policies: {
        // privacy_policy: {
        //   en: {
        //     name: "Privacy Policy",
        //     url: "https://example.org/somewhere/privacy-1.2-en.html"
        //   },
        //   version: '0.1'
        // },
        // terms_of_service: {
        //   en: {
        //     name: "Terms of service",
        //     url: "https://example.org/somewhere/terms-1.2-en.html"
        //   },
        //   version: '0.1'
        // }
      }
    })
  }
}

export default Terms
