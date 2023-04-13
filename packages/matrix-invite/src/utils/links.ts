export const getPlayStoreInstallLink = (appId: string): string =>
  `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`

export const getFdroidInstallLink = (appId: string): string =>
  `https://f-droid.org/packages/${encodeURIComponent(appId)}`

export const getAppStoreLink = (appId: string, org: string): string =>
  `https://apps.apple.com/app/${encodeURIComponent(org)}/${encodeURIComponent(appId)}`

export const getFlatHubLink = (appId: string): string =>
  `https://flathub.org/apps/details/${encodeURIComponent(appId)}`
