import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { FileUploadService } from "../../common/common-services/file-upload.service";

@Module({
  imports: [HttpModule],
  providers: [FileUploadService],
  exports: [FileUploadService]
})
export class CommonServicesModule {}
