import type { WellKnownClientService } from "./service";
import type { WellKnownClientDocument } from "./types";

export const wellKnownClientController = (service: WellKnownClientService): WellKnownClientDocument => {
  return service.document;
};
