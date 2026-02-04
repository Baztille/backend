import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, IsString, ValidateNested } from "class-validator";

export class CountryCreateUserDto {
  @ApiProperty({ description: "Country unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  @IsString()
  _id: string;

  @ApiProperty({ description: "ISO 3166-1 alpha-2 country code", example: "FR" })
  @IsString()
  alpha2: string;

  @ApiProperty({ description: "Country name in French", example: "France" })
  @IsString()
  fr: string;
}

export class CreateUserDto {
  @ApiProperty({
    example: "email@example.com",
    description: "User's email address"
  })
  @IsString()
  @IsEmail()
  readonly email: string;

  @ApiProperty({
    example: "Polling station ID",
    description: "User's polling station ID"
  })
  @IsString()
  @IsOptional()
  pollingStationId?: string;

  @ApiProperty({
    example: "true",
    description: "true if user is not sure about his polling station (must ask him again later)"
  })
  @IsBoolean()
  @IsOptional()
  pollingStationUncertain?: boolean;

  @ApiPropertyOptional({
    example: "XYZ",
    description: "Invitation code provided by the inviter/mentor"
  })
  @IsString()
  @IsOptional()
  invitationCode?: string; // = the string provided by the user during registration, used to link the new user to the inviter/mentor

  @ApiProperty({ description: "User's country information", type: () => CountryCreateUserDto })
  @ValidateNested()
  @Type(() => CountryCreateUserDto)
  @IsOptional()
  country?: CountryCreateUserDto;
}
