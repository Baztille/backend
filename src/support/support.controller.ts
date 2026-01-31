import { Controller, Get, Post, Body, Param, HttpStatus, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SupportService } from "./support.service";
import { Roles } from "src/common/decorator/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { Role } from "src/common/enum";

@ApiTags("Support")
@Controller("support")
export class SupportController {
  constructor(private readonly supportService: SupportService) {}
}
