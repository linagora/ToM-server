import { PlatformType, ResourceType, type IClient, type InstallLink } from '$lib/types'
import {
  getAppStoreLink,
  getFdroidInstallLink,
  getFlatHubLink,
  getPlayStoreInstallLink
} from '../../utils/links'
import { detectPlatform } from '../../utils/platform'
import { parseURL } from '../../utils/url'

export class FluffyChatClient implements IClient {
  name = 'FluffyChat'
  description = 'Chat with your friends using the cutest messenger in the Matrix network.'
  homepage = 'https://fluffychat.im'
  author = 'Krille Fear'
  icon = 'fluffychat.svg'
  platforms = [
    PlatformType.ANDROID,
    PlatformType.IOS,
    PlatformType.LINUX,
    PlatformType.MACOS,
    PlatformType.WINDOWS,
    PlatformType.WEB
  ]

  constructor(private readonly link: string) {}

  get deepLink(): string | null {
    const platform = detectPlatform()

    if (platform === PlatformType.ANDROID || platform === PlatformType.IOS)
      return `im.fluffychat://chat/${this.link}`

    return null
  }

  get installLinks(): InstallLink[] {
    const platform = detectPlatform()

    if (platform === PlatformType.ANDROID) {
      return [
        {
          url: getPlayStoreInstallLink('chat.fluffy.fluffychat'),
          platform: 'PlayStore'
        },
        {
          url: getFdroidInstallLink('chat.fluffy.fluffychat'),
          platform: 'FDroid'
        }
      ]
    }

    if (platform === PlatformType.IOS) {
      return [
        {
          url: getAppStoreLink('id1551469600', 'fluffychat'),
          platform: 'AppStore'
        }
      ]
    }

    if (platform === PlatformType.LINUX) {
      return [
        {
          url: getFlatHubLink('im.fluffychat.Fluffychat'),
          platform: 'FlatHub'
        },
        {
          url: this.homepage,
          platform: 'Linux'
        }
      ]
    }

    return [{ platform: 'Web', url: this.homepage }]
  }

  get webLink() {
    return null
  }

  get instructions() {
    const platform = detectPlatform()
    const parsedLink = parseURL(this.link)

    if (!platform) return null

    if (parsedLink.type === ResourceType.USER) {
      if (platform === PlatformType.ANDROID) return null

      if ([PlatformType.LINUX, PlatformType.MACOS, PlatformType.WINDOWS].includes(platform)) {
        return `Open the web app and log in to your account. Click on '+' and paste the username.`
      }

      return `Open the app and click on ' + ' and paste the username.`
    }

    if ([ResourceType.ROOM_ALIAS, ResourceType.ROOM_ID].includes(parsedLink.type)) {
      if (platform === PlatformType.ANDROID) return null

      if ([PlatformType.LINUX, PlatformType.MACOS, PlatformType.WINDOWS].includes(platform)) {
        return `Open the web app and log in to your account. Click on 'Discover' and paste the identifier.`
      }

      return "Open the app on your device. Click on 'Discover' and paste the identifier."
    }

    return null
  }
}
