import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { UserPrivateViewDto } from "src/profile/user/dto/user-private-view.dto";

export class LoginWithEmailDto {
  @ApiProperty({
    example: "email@example.com",
    description: "User's email address"
  })
  @IsNotEmpty()
  @IsString()
  email: string;
}

export class VerifyCodeDto {
  @ApiProperty({
    example: "email@example.com",
    description: "User's email address"
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    example: "1234",
    description: "Code received by user vie email"
  })
  @IsNotEmpty()
  @IsString()
  code: string;
}

export class VerifyCodeUserDetailsDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT access token for authenticated user"
  })
  accessToken: string;

  @ApiProperty({ type: UserPrivateViewDto })
  user: UserPrivateViewDto;
}

export class VerifyCodeResponseDto {
  @ApiProperty({ type: VerifyCodeUserDetailsDto })
  data: VerifyCodeUserDetailsDto;

  @ApiProperty({ example: "Verification successful", description: "Response message" })
  message: string;
}
