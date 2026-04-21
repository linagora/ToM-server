import { LandingPageNotFoundError } from "./errors";
import type { LandingService } from "./service";

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
