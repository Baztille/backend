import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Inject, Injectable } from "@nestjs/common";
import { Cache } from "cache-manager";
// import { USERS_COLLECTION } from './leaderboard.module';
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { getCurrentDate } from "src/utils/date-time";
import { logDebug, logInfo } from "src/utils/logger";
import { decodeCursor, encodeCursor } from "src/utils/pagination";
import { UserDocument, UserMongo } from "../user/user.schema";
import { UserService } from "../user/user.service";
import { LeaderboardPageDto, LeaderboardUserDto } from "./dto/leaderboard.dto";
import { LeaderboardScope } from "./leaderboard-scope.type";

type Cursor = { p: number; id: string };

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly userService: UserService
  ) {}

  private mongoFilter(scope: LeaderboardScope | null) {
    if (!scope || !scope.territory_type_id) return {}; // No filter (= whole country leaderboard)

    logDebug("Leaderboard: mongoFilter: to be developed for scope ", scope);

    throw new Error("To be developed"); // TODO: filter by territory (should probably involved building a territory hierarchy for each user)
    // const field = "pollingStationId";
    //return { [field]: scope.territory_id };
  }

  /**
   * Get a cache key for the given parameters
   * @param scope: leaderboard scope
   * @param limit: number of users to get for this page
   * @param after: pagination cursor
   * @returns cache key
   */
  private getCacheKey(scope: LeaderboardScope, limit: number, after?: string) {
    const base = scope === null ? "leaderboard:global" : `leaderboard:${scope.territory_type_id}:${scope.territory_id}`;
    return after ? `${base}:after:${after}:limit:${limit}` : `${base}:page:0:limit:${limit}`;
  }

  /**
   * Get a leaderboard page
   * @param scope: leaderboard scope
   * @param limit: number of users to get for this page
   * @param after: pagination cursor
   * @returns sorted list of users
   */
  async getPage(scope: LeaderboardScope, limit = 50, after?: string): Promise<LeaderboardPageDto> {
    // Try to get this page from cache if it exists
    const cacheKey = this.getCacheKey(scope, limit, after);
    const cached = await this.cache.get<LeaderboardPageDto>(cacheKey);
    if (cached) {
      // Cache exists!
      logInfo("Leaderboard: getPage: cache hit for key ", cacheKey);
      return cached;
    }

    // Does not exists in cache: make a DB request
    logInfo("Leaderboard: getPage: cache does not exists for key ", cacheKey);

    const scopeFilter = this.mongoFilter(scope);

    // pagination SEEK: sort by points desc, _id asc
    const sort = { points: -1 as const, _id: 1 as const };

    const mongoFilter = after
      ? // If we ask for a page after a cursor ("after"), get users with less points than the cursor OR with greater IDs
        (() => {
          const cursor = decodeCursor<Cursor>(after);
          return {
            $and: [
              scopeFilter,
              {
                $or: [
                  { points: { $lt: cursor.p } },
                  { points: cursor.p, _id: { $gt: new mongoose.Types.ObjectId(cursor.id) } }
                ]
              }
            ]
          };
        })()
      : // If no page is asked, do not filter users more than the Scope filter
        scopeFilter;

    const users = await this.userModel
      .find<UserDocument>(mongoFilter, await this.userService.getPublicAccessibleFields())
      .sort(sort)
      .limit(limit);

    const lastUser = users.at(-1);
    const nextAfter = lastUser ? encodeCursor<Cursor>({ p: lastUser.points ?? 0, id: String(lastUser._id) }) : null; // Case where there are no more users

    const usersDto: LeaderboardUserDto[] = users.map((u: UserDocument) => ({
      _id: String(u._id),
      creationDate: getCurrentDate().toISOString(),
      role: u.role,
      points: u.points ?? 0,
      publicName: u.publicName,
      avatar: u.avatar
    }));

    const result: LeaderboardPageDto = {
      users: usersDto,
      nextAfter: nextAfter ?? undefined,
      scope: scope,
      generatedAt: new Date().toISOString()
    };

    // Put this result in cache, cache 10 minutes
    await this.cache.set(cacheKey, result, 10 * 60 * 1000);

    return result;
  }

  /**
   * User rank
   * Cost: 2 countDocuments() indexed.
   * To be reviewed before use
   */
  /*
  async getUserRank(scope: Scope, userId: string) {
    const user = await this.users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { points: 1, geo: 1 } },
    );
    if (!user) return null;

    const filter = this.mongoFilter(scope);

    // Tous ceux qui ont plus de points
    const higher = await this.users.countDocuments({
      ...filter,
      points: { $gt: user.points ?? 0 },
    });

    // Et ceux à égalité de points mais _id plus petit (tiebreaker)
    const equalBefore = await this.users.countDocuments({
      ...filter,
      points: user.points ?? 0,
      _id: { $lt: user._id },
    });

    const rank = 1 + higher + equalBefore;
    return { rank, points: user.points ?? 0 };
  }
*/

  /**
   * Invalidate leaderboard caches
   */
  async invalidateCaches(scopeHints: LeaderboardScope[]) {
    // NB: le cache in-memory de base n'a pas de wildcard delete.
    // On invalide les pages 1 (les plus lues). Ajuste selon ton besoin.
    const keys = [
      ...scopeHints.map((s) => this.getCacheKey(s, 50 /* limit par défaut */, undefined)),
      ...scopeHints.map((s) => this.getCacheKey(s, 100, undefined))
    ];
    await Promise.all(keys.map((k) => this.cache.del(k)));
  }
}
