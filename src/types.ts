import type { Request } from "express";
import type { Logger } from "winston";

export interface TomRequest extends Request {
  requestId: string;
  log: Logger;
}
