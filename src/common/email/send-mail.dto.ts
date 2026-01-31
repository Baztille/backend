import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export const ALL_USERS = "all_users";

export class SendMailDto {
  @IsNotEmpty()
  @IsString({ each: true })
  to: string | string[]; // May be a single email or an array of emails or keyword ALL_USERS for all users with confirmed email

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsOptional()
  attachement?: string[];

  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  dynamicTemplateData: { [key: string]: any };
}

export class SendMailToListDto {
  @IsString()
  name: string; // Note: name of the single send

  categories?: string[]; // Note: categories of the single send

  @IsString()
  @IsOptional()
  subject?: string;

  @IsOptional()
  attachement?: string[];

  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  dynamicTemplateData: { [key: string]: any };
}

export type SendGridTemplateList = {
  [key: string]: {
    category: "mandatory" | "essentials" | "vote";
    template: string;
    default?: boolean;
  };
};
