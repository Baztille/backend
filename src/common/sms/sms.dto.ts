import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SMSDto {
  @ApiProperty({
    example: "+33 6 12 34 56 78",
    description: "User's phone number"
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class SMSVerifyDto {
  @ApiProperty({
    example: "+33 6 12 34 56 78",
    description: "User's phone number"
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: "1234",
    description: "Verification code"
  })
  @IsString()
  @IsOptional()
  code?: string;
}
