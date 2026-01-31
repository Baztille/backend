import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DownloadLinkMongo } from "./download-link.schema";

@Injectable()
export class DownloadService {
  constructor(@InjectModel("Download") private readonly downloadModel: Model<DownloadLinkMongo>) {}

  async saveDownloadLink(documentId: string, url: string, expirationDate: Date): Promise<DownloadLinkMongo> {
    const newDownloadLink = new this.downloadModel({
      document_id: documentId,
      url: url,
      expiration_date: expirationDate
    });
    await newDownloadLink.save();
    return newDownloadLink;
  }

  async fetchDownloadLink(documentId: string): Promise<DownloadLinkMongo | null> {
    return this.downloadModel.findOne({ document_id: documentId }).exec();
  }
}
