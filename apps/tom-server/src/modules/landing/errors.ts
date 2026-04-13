import { DomainError } from "../../errors/domain-error";
import { NOT_FOUND } from "../../errors/error-codes";

export class LandingPageNotFoundError extends DomainError {
  constructor(filePath: string) {
    super(NOT_FOUND, "landing page not found", { filePath });
  }
}
