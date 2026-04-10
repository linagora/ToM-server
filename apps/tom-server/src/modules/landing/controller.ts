import { LandingPageNotFoundError } from "./errors.js";
import type { LandingService } from "./service.js";

interface LandingOutput {
  filePath: string;
}

export const landingController = (service: LandingService): LandingOutput => {
  const filePath = service.filePath;
  if (!filePath) {
    throw new LandingPageNotFoundError("landing page unavailable");
  }
  return { filePath };
};
