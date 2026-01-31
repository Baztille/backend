import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { catchError, firstValueFrom, map } from "rxjs";
import { AxiosError } from "axios";
import { logInfo, logError } from "src/utils/logger";
import { Cache } from "cache-manager";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { escapeHtml, escapeRegExp } from "src/common/common-functions";

@Injectable()
export class SupportService {
  constructor(private readonly httpService: HttpService, @Inject(CACHE_MANAGER) private readonly cache: Cache) {}
}
