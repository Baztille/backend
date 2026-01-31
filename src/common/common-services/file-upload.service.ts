import { BadRequestException, Injectable } from "@nestjs/common";
import * as ejs from "ejs";
import * as fs from "fs";
import * as mkdirp from "mkdirp";
import * as path from "path";
import { FileType } from "src/common/enum";
import { v4 as uuidv4 } from "uuid";
@Injectable()
export class FileUploadService {
  /**
   * Uploads a file to the specified directory.
   * @param type The type of file being uploaded.
   * @param file The file to be uploaded.
   * @returns A Promise resolving to the path of the uploaded file.
   */
  async upload(type: FileType, file: any): Promise<string> {
    // Constructing the directory path and URL
    const directoryPath = path.join(__dirname, "../../../public/", type, "/");
    const url = type + "/";

    // Creating directory if it doesn't exist
    mkdirp.sync(directoryPath);

    // Extracting file information
    const fileSplit = file.originalname.split(".");
    const extension = fileSplit[fileSplit.length - 1];
    const name = uuidv4();
    const filePath = directoryPath + name + "." + extension;

    // Writing file to disk
    fs.writeFile(filePath, file.buffer, (err) => {
      if (err) {
        throw new BadRequestException("File has not be written to disk");
      }
    });

    // Returning the URL of the uploaded file
    return url + name + "." + extension;
  }

  /**
   * Validates if the file is an image (JPEG or PNG).
   * @param file The file to be validated.
   * @returns A boolean indicating whether the file is a valid image.
   */
  async validateImageFile(file: any) {
    const extension = file.mimetype.split("/")[1];
    return extension.toLowerCase() === "jpeg" || extension.toLowerCase() === "png";
  }

  /**
   * Deletes a file from the specified folder.
   * @param pathFile The path of the file to be deleted.
   */
  async deleteFileFromFolder(pathFile: string) {
    fs.unlinkSync(pathFile);
  }

  /**
   * Deletes a file from the specified path.
   * @param path The path of the file to be deleted.
   * @param reject Function to handle rejection.
   */
  deleteFile(path: string, reject: any): void {
    if (fs.existsSync(path)) {
      fs.unlink(path, (err) => {
        if (err) {
          reject(err);
        }
      });
    }
  }

  /**
   * Generates a unique file name using UUID and the original file extension.
   * @param file The file for which the name is generated.
   * @returns A Promise resolving to the generated file name.
   */
  async generateFileName(file: any): Promise<string> {
    const fileSplit = file.originalname.split(".");
    const extension = fileSplit[fileSplit.length - 1];
    const name = uuidv4();
    return name + "." + extension;
  }

  /**
   * Renders a template with provided content and template name.
   * @param content The content to be rendered in the template.
   * @param templateName The name of the template file.
   * @returns A Promise resolving to the rendered template.
   */
  async renderTemplate(content, templateName): Promise<any> {
    const template = await ejs.renderFile(path.join(__dirname + "../../../../view/" + templateName), content);
    return template;
  }
}
