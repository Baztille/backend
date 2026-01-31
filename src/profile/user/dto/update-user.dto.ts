import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { UserDiscoverStep } from "src/profile/user/types/user-discover-step.enum";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    example: "John",
    description: "User's first name"
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: "Doe",
    description: "User's last name"
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    example: "20/03/2024",
    description: "user's date of birth (timestamp)"
  })
  @IsOptional()
  @IsNumber()
  readonly birthDate?: number;

  @ApiProperty({
    description: "user's Polling station ID"
  })
  @IsOptional()
  @IsString()
  readonly pollingStationId?: string;

  @ApiPropertyOptional({
    description: "user public name"
  })
  @IsOptional()
  @IsString()
  publicName?: string;

  @ApiPropertyOptional({
    example: "CONVINCED",
    description: "User's discover step (NOT_CONVINCED, CONVINCED, SUPPORTER)",
    enum: UserDiscoverStep
  })
  @IsOptional()
  @IsEnum(UserDiscoverStep)
  discoverStep?: UserDiscoverStep;
}
