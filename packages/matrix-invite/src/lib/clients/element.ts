import { getAppStoreLink, getFdroidInstallLink, getPlayStoreInstallLink } from '../../utils/links'
import { detectPlatform, getPlatformString } from '../../utils/platform'
import { parseURL } from '../../utils/url'
import { type IClient, PlatformType, ResourceType, type InstallLink } from '../types'

export class ElementClient implements IClient {
  name = 'Element'
  description = 'Fully-featured Matrix client, used by millions.'
  homepage = 'https://element.io'
  author = 'Element'
  icon = 'element.svg'
  platforms = [
    PlatformType.ANDROID,
    PlatformType.IOS,
    PlatformType.WINDOWS,
    PlatformType.LINUX,
    PlatformType.WEB,
    PlatformType.MACOS
  ]
  trustedWebInstance = 'app.element.io'

  constructor(private readonly link: string) {}

  get deepLink() {
    const platform = detectPlatform()

    const path = this.getPath()

    if (platform === PlatformType.IOS) {
      return `https://${this.trustedWebInstance}/#/${path}`
    }

    if (platform === PlatformType.LINUX || PlatformType.WINDOWS || PlatformType.MACOS) {
      return `element://vector/webapp/#/${path}`
    }

    return `element://${path}`
  }

  get installLinks(): InstallLink[] {
    const platform = detectPlatform()

    if (!platform) return []

    if (platform === PlatformType.ANDROID) {
      return [
        {
          url: getPlayStoreInstallLink('im.vector.app'),
          platform: 'PlayStore'
        },
        {
          url: getFdroidInstallLink('im.vector.app'),
          platform: 'FDroid'
        }
      ]
    }

    if (platform === PlatformType.IOS) {
      return [
        {
          url: getAppStoreLink('id1083446067', 'vector'),
          platform: 'AppStore'
        }
      ]
    }

    return [
      {
        url: `${this.homepage}/get-started`,
        platform: getPlatformString(platform)
      }
    ]
  }

  get webLink() {
    const path = this.getPath()

    return `https://${this.trustedWebInstance}/#/${path}`
  }

  get instructions() {
    return null
  }

  /**
   * Returns the Path for the given matrix resource link.
   *
   * @returns {string}
   */
  private getPath(): string {
    const parsedUrl = parseURL(this.link)

    let path: string

    switch (parsedUrl.type) {
      case ResourceType.USER:
        path = `user/${encodeURIComponent(this.link)}`
        break

      case ResourceType.ROOM_ALIAS:
      case ResourceType.ROOM_ID:
      case ResourceType.EVENT:
        path = `room/${encodeURIComponent(this.link)}`
        break

      case ResourceType.GROUP:
        path = `group/${encodeURIComponent(this.link)}`
    }

    if (parsedUrl.type === ResourceType.EVENT || parsedUrl.type === ResourceType.ROOM_ALIAS) {
      path = `${path}?via=${parsedUrl.domain}`
    }

    return path
  }
}
