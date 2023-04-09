import { browser } from '$app/environment';
import { PlatformType, type InstallLink } from '$lib/types';

/**
 * Detects the platform the user is using.
 *
 * @returns {PlatformType}
 */
export const detectPlatform = (): PlatformType | undefined => {
	if (!browser) {
		return;
	}

	const { platform } = window.navigator || (window.navigator as any).userAgentData;
	const { userAgent } = navigator;

	if (/android/i.test(userAgent)) {
		return PlatformType.ANDROID;
	}

	if (
		(/iPad|iPhone|iPod/.test(platform) ||
			(platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
		!(window as any).MSStream
	) {
		return PlatformType.IOS;
	}

	if (platform.toLocaleLowerCase().includes('linux')) {
		return PlatformType.LINUX;
	}

	if (platform.toLocaleLowerCase().includes('mac')) {
		return PlatformType.MACOS;
	}

	return PlatformType.WINDOWS;
};

/**
 * Returns the string representation of a platform.
 *
 * @param {PlatformType} platform - the platform.
 * @returns {InstallLink["platform"]}
 */
export const getPlatformString = (platform: PlatformType): InstallLink["platform"] => {
	if (platform === PlatformType.ANDROID) return 'Android';
	if (platform === PlatformType.IOS) return 'IOS';
	if (platform === PlatformType.LINUX) return 'Linux';
	if (platform === PlatformType.MACOS) return 'MacOS';
	if (platform === PlatformType.WINDOWS) return 'Windows';

	return 'Web';
};
