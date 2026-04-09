import { DomainError } from "../errors/domain-error.js";
import { NOT_FOUND } from "../errors/error-codes.js";

export class MessagesDirNotFoundError extends DomainError {
  constructor(filePath: string) {
    super(NOT_FOUND, "i18n messages not found", { filePath });
  }
}
