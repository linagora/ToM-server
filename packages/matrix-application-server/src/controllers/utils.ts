import type MatrixApplicationServer from '..'
import { type expressAppHandler } from '../utils'

export type AppServerController = (
  appServer: MatrixApplicationServer
) => expressAppHandler
