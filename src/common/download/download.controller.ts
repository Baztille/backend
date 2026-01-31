import { Controller, Get, HttpStatus, Param } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DownloadService } from "./download.service";

@ApiTags("File download")
@Controller("download")
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  /**
   * Get a file using a temporary download link
   * @param {string} document_id - The document ID to fetch the download link for.
   * @returns {Promise<void>} - A promise that resolves when the file is downloaded.
   */
  @Get(":documentId")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns requested file"
  })
  @ApiOperation({
    operationId: "getFile",
    summary: "Get a file using a temporary download link",
    description: "Fetches a file using a temporary download link."
  })
  @ApiParam({
    name: "documentId",
    type: String,
    description: "The temporary document ID to fetch the download link for"
  })
  async getFile(@Param("documentId") documentId: string) {
    return await this.downloadService.fetchDownloadLink(documentId);
  }
}
