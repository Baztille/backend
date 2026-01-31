import { HttpStatus } from "@nestjs/common";

export class BaztilleError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = HttpStatus.BAD_REQUEST) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
  }
}
