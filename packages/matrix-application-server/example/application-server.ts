import express from 'express'

import MatrixApplicationServer from '@twake/matrix-application-server'

const appServer = new MatrixApplicationServer({
  base_url: 'https://localhost:3000',
  sender_localpart: 'foobot',
  registration_file_path: 'registration.yaml',
  namespaces: {}
})

const app = express()

app.use(appServer.router.routes)

const port = process.argv[2] != null ? parseInt(process.argv[2]) : 3000
console.log(`Listening on port ${port}`)
app.listen(port)
