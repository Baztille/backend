import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOkResponse({
    type: String,
    description: "Return API version"
  })
  getHello(): string {
    return this.appService.getHello();
  }

  // Support favicon.ico requests
  @Get("favicon.ico")
  @ApiOkResponse({
    type: String,
    description: "Support favicon.ico requests"
  })
  favicon() {
    // This is to avoid 404 errors in the logs for favicon.ico requests
    return "";
  }
}
