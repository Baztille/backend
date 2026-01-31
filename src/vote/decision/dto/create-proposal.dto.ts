import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId, IsString } from "class-validator";

export class CreateProposalDto {
  @ApiProperty({
    example: "New Proposal",
    description: "Proposal title"
  })
  @IsString()
  title: string;

  // Decision ID
  @ApiProperty({
    example: "60d21b4667d0d8992e610c85",
    description: "Decision ID associated with the proposal"
  })
  @IsMongoId()
  decisionId: string;
}
