export interface IClient {
	name: string;
	description: string;
	homepage: string;
	author: string;
	icon: string;
	platforms: PlatformType[];
  instructions: string | null;
	deepLink: string | null;
  installLinks: InstallLink[];
  webLink: string | null;
}

export enum PlatformType {
  WEB,
  ANDROID,
  IOS,
  WINDOWS,
  MACOS,
  LINUX,
}

export enum ResourceType {
  ROOM_ALIAS,
  USER,
  ROOM_ID,
  GROUP,
  EVENT,
}

export type ParsedUrl = {
	type: ResourceType;
	domain: string;
	resource: string;
};

export type InstallLink = {
  url: string;
  platform: "PlayStore" | "FDroid" | "FlatHub" | "AppStore" | "Android" | "IOS" | "Linux" | "MacOS" | "Windows" | "Web";
}
