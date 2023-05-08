const swaggerJsDoc = require('swagger-jsdoc')
const version = require('../package.json').version
const fs = require('fs')
const path = require('path')

const vaultApiPath = path.join(
  __dirname,
  '..',
  'packages',
  'tom-server',
  'src',
  'vault-api',
  'index.ts'
)

const matrixIdentityServerApiPath = path.join(
  __dirname,
  '..',
  'packages',
  'matrix-identity-server',
  'src',
  'api-doc.ts'
)

const identityServerApiPath = path.join(
  __dirname,
  '..',
  'packages',
  'tom-server',
  'src',
  'identity-server',
  'index.ts'
)

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Twake on Matrix APIs documentation',
      version,
      description:
        'This is The documentation of all available APIs of this repository'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      responses: {
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    description: 'The message describing the internal error'
                  }
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    description:
                      'The user who sent the request is not authenticated'
                  }
                }
              },
              example: {
                error: 'Not Authorized'
              }
            }
          }
        },
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  errorCode: {
                    type: 'string',
                    description: 'A Matrix error code'
                  },
                  error: {
                    type: 'string',
                    description: 'A human-readable error message'
                  }
                }
              },
              example: {
                errorCode: 'M_MISSING_PARAMS',
                error: 'Properties are missing in the request body'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    matrixIdentityServerApiPath,
    identityServerApiPath,
    vaultApiPath,
    '**/routes/*.ts'
  ]
}

const swaggerSpec = swaggerJsDoc(options)

const docFilePath = path.join(__dirname, 'openapi.json')

if (fs.existsSync(docFilePath)) {
  fs.unlinkSync(docFilePath)
}

fs.writeFileSync(docFilePath, JSON.stringify(swaggerSpec))
