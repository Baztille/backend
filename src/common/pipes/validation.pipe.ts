import { ArgumentMetadata, BadRequestException, HttpStatus, Injectable, PipeTransform } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { logError } from "src/utils/logger";
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  async transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }
    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true, // Make sure that a client cannot add in parameter some properties that do not match the expected object format (!very important to secure input!)
      forbidNonWhitelisted: true // see: https://stackoverflow.com/questions/54813203/how-do-i-prevent-unwanted-object-properties-from-the-client-in-nestjs-while-upda
    });
    if (errors.length > 0) {
      logError("Validation failed: ", errors);
      logError("value = ", value);
      logError("metadata = ", metadata);

      throw new BadRequestException({
        message: "Validation failed",
        statusCode: HttpStatus.BAD_REQUEST,
        errors: errors
      });
    }
    return value;
  }

  private toValidate(metatype: any): boolean {
    const types = [String, Boolean, Number, Array, Object];
    return !types.find((type) => metatype === type);
  }
}
