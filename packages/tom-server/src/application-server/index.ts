import { type ConfigDescription } from '@twake/config-parser'
import MatrixApplicationServer, {
  type AppService
} from '@twake/matrix-application-server'
import type TwakeServer from '..'
import defaultConfig from '../config.json'

export default class TwakeApplicationServer
  extends MatrixApplicationServer
  implements AppService
{
  constructor(parent: TwakeServer, confDesc?: ConfigDescription) {
    if (confDesc == null) confDesc = defaultConfig
    super(parent.conf, confDesc)
  }
}
