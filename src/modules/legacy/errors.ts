import { DomainError } from "../../errors/domain-error";
import { NOT_FOUND } from "../../errors/error-codes";

export class TemplatesDirectoryNotFoundError extends DomainError {
  constructor() {
    super(NOT_FOUND, "templates directory not found");
  }
}
