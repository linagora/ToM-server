import { config } from 'winston'
import { type IConsoleTransportOptions } from '../../../types.ts'
import { DefaultTransportOptions } from './default-transport-options.ts'

export class ConsoleTransportOptions
  extends DefaultTransportOptions
  implements IConsoleTransportOptions
{
  private _eol?: string
  private _stderrLevels?: string[]
  private _consoleWarnLevels?: string[]

  constructor(options: IConsoleTransportOptions) {
    super(options)
    this.eol = options.eol
    this.stderrLevels = options.stderrLevels
    this.consoleWarnLevels = options.consoleWarnLevels
  }

  set eol(eol: string | undefined) {
    if (eol != null && typeof eol !== 'string') {
      throw new Error('eol in error: value must be a string')
    }
    this._eol = eol
  }

  get eol(): string | undefined {
    return this._eol
  }

  set stderrLevels(stderrLevels: string[] | undefined) {
    if (
      stderrLevels != null &&
      !(
        Array.isArray(stderrLevels) &&
        stderrLevels.every(
          (level) =>
            typeof level === 'string' &&
            Object.keys(config.npm.levels).includes(level)
        )
      )
    ) {
      throw new Error(
        'stderrLevels in error: value must an array containing default npm levels as string'
      )
    }
    this._stderrLevels = stderrLevels
  }

  get stderrLevels(): string[] | undefined {
    return this._stderrLevels
  }

  set consoleWarnLevels(consoleWarnLevels: string[] | undefined) {
    if (
      consoleWarnLevels != null &&
      !(
        Array.isArray(consoleWarnLevels) &&
        consoleWarnLevels.every(
          (level) =>
            typeof level === 'string' &&
            Object.keys(config.npm.levels).includes(level)
        )
      )
    ) {
      throw new Error(
        'consoleWarnLevels in error: value must an array containing default npm levels as string'
      )
    }
    this._consoleWarnLevels = consoleWarnLevels
  }

  get consoleWarnLevels(): string[] | undefined {
    return this._consoleWarnLevels
  }
}
