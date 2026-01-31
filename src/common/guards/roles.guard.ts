import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { logError } from "src/utils/logger";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const roles = this.reflector.get<string[]>("roles", context.getHandler());
    if (!roles) {
      return true;
    }
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // logInfo("RolesGuard.canActivate: testing the user roles");
    // logInfo( user );

    if (!user) {
      // No user: JWT token may be absent or wrong
      throw new ForbiddenException({
        status: 403,
        message: "Access denied, insufficient permissions (not logged)"
      });
    }

    if (roles.includes(user.role)) {
      return true;
    } else {
      logError("Access denied for user " + user.email + " with role " + user.role);
      throw new ForbiddenException({
        status: 403,
        message: "Access denied, insufficient permissions"
      });
    }
  }
}
