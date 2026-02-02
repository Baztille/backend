# Contributing to Baztille Backend

Thank you for your interest in contributing to Baztille! This document provides guidelines and standards for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)
- [Testing Guidelines](#testing-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect differing viewpoints and experiences
- Accept responsibility and apologize for mistakes

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 5.x
- Git
- A code editor (VS Code recommended)

### Local Setup

1. Fork the repository on GitHub
2. Clone your fork locally:

   ```bash
   git clone https://github.com/Baztille/backend.git
   cd baztille
   ```

3. Add the upstream remote:

   ```bash
   git remote add upstream https://github.com/Baztille/backend.git
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

6. Configure your `.env` file with local settings

7. Run migrations:

   ```bash
   npm run migration:run
   ```

8. Start the development server:
   ```bash
   npm run start:dev
   ```

## 🔄 Development Workflow

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes**:

   ```bash
   npm run test
   npm run test:e2e
   ```

4. **Commit your changes** following commit guidelines

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** to the `main` branch

## 💻 Coding Standards

### TypeScript Guidelines

#### File Naming

- Use **kebab-case** for file names: `user.service.ts`, `decision.controller.ts`
- Service: `*.service.ts`
- Controller: `*.controller.ts`
- Module: `*.module.ts`
- Business types: `*.type.ts`
- Schema types (Mongo): `*.schema.ts`
- DTO files: `*.dto.ts`

#### Class Naming

- Use **PascalCase** for classes, interfaces and types.
- Services: `UserService`, `DecisionService`
- Controllers: `UserController`, `DecisionController`
- @Schema() classes: `UserMongo`, `DecisionMongo`
- Mongoose Hydrated types: `UserDocument`, `DecisionDocument`
- Monoose Schema: `UserSchema`, `DecisionSchema`
- DTOs: `CreateUserDto`, `UpdateDecisionSummaryDto`

#### Variable & Function Naming

- Use **camelCase** for variables and functions
- Use descriptive names: `getUserById`, not `getU`
- Boolean variables should start with `is`, `has`, `should`: `isActive`, `hasVoted`, `b`
- Private properties start with underscore is optional but discouraged

#### Database collections

- Use **snake_case** for collections names, prefixed by their functionnal domains (c* for Country Model, d* for Decisions&Debate, e* for Events, m* for Missions and gamification, u* for users, v* for Votes & Voting sessions)
- Use **camelCase** for all Mongoose schema properties (database properties)

#### Constants & Enums

- Use **UPPER_SNAKE_CASE** for constants: `MAX_PROPOSITIONS`, `DEFAULT_TIMEOUT`
- Use **cameCase** for enum names: `Role`, `Status`
- Use **UPPER_SNAKE_CASE** for enum values: `Role.ADMIN`, `Status.IN_PROGRESS`

### NestJS Specific Standards

#### Module Structure

Each feature should follow this structure:

```
feature/
├── feature.module.ts
├── feature.controller.ts
├── feature.service.ts
├── feature.schema.ts
├── feature.dto.ts
├── feature.types.ts
```

#### Dependency Injection

- Always use constructor injection
- Use `@Injectable()` decorator for services
- Inject dependencies via constructor:
  ```typescript
  constructor(
    private readonly userService: UserService,
    private readonly emailService: EmailService,
  ) {}
  ```

#### Controllers

- Use appropriate HTTP decorators: `@Get()`, `@Post()`, `@Put()`, `@Delete()`
- Use `@ApiTags()` for Swagger grouping
- Document all endpoints with `@ApiOperation()`, `@ApiResponse()`
- Use DTOs for request validation
- Keep controllers thin - business logic belongs in services

Example:

```typescript
@ApiTags("User")
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 200, description: "User found" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.MODERATOR)
  async getUserById(@Param("id") id: string): Promise<UserPrivateViewDto> {
    return this.userService.getUserPrivateById(id);
  }
}
```

#### Services

- Keep methods focused and single-purpose
- Use async/await for asynchronous operations
- Handle errors appropriately
- Log important actions using the logger utility:

  ```typescript
  import { logInfo, logError, logDebug } from 'src/utils/logger';

  async createUser(dto: CreateUserDto): Promise<User> {
    logInfo('Creating user with email:', dto.email);
    try {
      const user = await this.userModel.create(dto);
      logInfo('User created successfully:', user._id);
      return user;
    } catch (error) {
      logError('Failed to create user:', error);
      throw error;
    }
  }
  ```

#### DTOs (Data Transfer Objects)

- Use `class-validator` decorators for validation
- Use `class-transformer` decorators for transformation
- Document properties with `@ApiProperty()`

Example:

```typescript
import { IsEmail, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: "SecurePass123!" })
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
```

#### Schemas

- Use `@Schema()` decorator with collection name
- Use `@Prop()` decorator for properties
- Enable timestamps: `timestamps: true`
- Add indexes for frequently queried fields

Example:

```typescript
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: "users", timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: String, enum: Object.values(ROLE), default: ROLE.VISITOR })
  role: ROLE;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, createdAt: -1 });
```

### Code Quality

#### Temporary Debug Code Marker

When adding temporary debug code or logging that should **never be deployed to production**, use the `DONOTCOMMIT` marker:

```typescript
// DONOTCOMMIT - Remove this debug logging before production
console.log("Debug: User data:", userData);

// DONOTCOMMIT - Temporary workaround for testing
if (process.env.SKIP_VALIDATION === "true") {
  return true;
}
```

**Important notes:**

- The `DONOTCOMMIT` marker is automatically checked during production deployment
- The CI/CD pipeline will **fail** if any `DONOTCOMMIT` markers are found
- Always remove these markers before merging to `main`
- Use this for temporary debug code, test bypasses, or work-in-progress features

**Alternatives to DONOTCOMMIT:**

- For permanent debug logging, use proper log levels: `logDebug()`, `logInfo()`
- For feature flags, use environment variables with proper configuration
- For WIP features, use feature branches and draft PRs

#### Error Handling

- Use NestJS built-in exceptions: `BadRequestException`, `NotFoundException`, etc.
- Provide meaningful error messages
- Log errors with appropriate level:
  ```typescript
  try {
    // ... operation
  } catch (error) {
    logError("Operation failed:", error);
    throw new InternalServerErrorException("Failed to complete operation");
  }
  ```

#### Logging

Use the centralized logger utility:

- `logDebug()` - Development/debugging information
- `logInfo()` - Significant business events
- `logWarning()` - Things that should be noticed
- `logError()` - Errors that need immediate attention

For cron jobs, use the cron-specific loggers:

- `cronlogDebug()`, `cronlogInfo()`, etc.

#### Type Safety

- Avoid `any` type - use proper types or `unknown`
- Use interfaces or types for complex objects
- Use enums for fixed sets of values
- Enable strict TypeScript compiler options

#### Async/Await

- Always use async/await instead of raw promises
- Handle promise rejections
- Use `Promise.all()` for parallel operations when possible:

  ```typescript
  // Good
  const [users, decisions] = await Promise.all([this.userService.findAll(), this.decisionService.findAll()]);

  // Avoid
  const users = await this.userService.findAll();
  const decisions = await this.decisionService.findAll();
  ```

### Database Guidelines

#### Queries

- Use proper projections to limit returned fields
- Add indexes for frequently queried fields
- Avoid N+1 queries - use populate or aggregation
- Use lean() for read-only queries:
  ```typescript
  // Faster for read-only data
  const users = await this.userModel.find().lean();
  ```

#### Transactions

Use transactions for operations that must be atomic:

```typescript
const session = await this.connection.startSession();
session.startTransaction();
try {
  await this.userModel.create([userData], { session });
  await this.missionModel.create([missionData], { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

#### Schema Design

- Embed related data that is always accessed together
- Reference data that is shared across documents
- Use subdocuments for logical grouping
- Consider data growth when designing schemas

### Security Best Practices

- Never commit sensitive data (keys, passwords, tokens)
- Use environment variables for configuration
- Validate all user input with DTOs
- Use guards for authentication and authorization
- Sanitize data before database operations
- Hash passwords with bcrypt (minimum 10 rounds)
- Use rate limiting on sensitive endpoints
- Enable CORS with specific origins in production

### Performance Guidelines

- Use pagination for large result sets
- Implement caching where appropriate
- Optimize database queries with indexes
- Use aggregation pipeline for complex queries
- Avoid synchronous operations in async context
- Profile and monitor slow operations

## 📁 Project Structure

### Module Organization

```
src/
├── common/              # Shared utilities and configurations
├── resources/           # Feature modules (one per domain)
├── schema/             # Shared database schemas
├── enum/               # Shared enumerations
├── interface/          # Shared interfaces and types
├── utils/              # Utility functions
└── cronJob/            # Scheduled tasks
```

### Adding a New Feature

1. Create a new directory under `src/resources/`
2. Create module, service, controller, schema files
3. Create DTOs in a `dto/` subdirectory
4. Register the module in `app.module.ts`
5. Add the schema to `for-feature.db.ts` if needed
6. Document API endpoints with Swagger decorators

## 📝 Commit Guidelines

### Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

#### Examples

```
feat(user): add email verification system

Implement email verification with SendGrid integration.
Users must verify their email before accessing full features.

Closes #123
```

```
fix(voting): prevent duplicate votes on same ballot

Added validation to check if user already voted with this ballot.

Fixes #456
```

```
docs(readme): update installation instructions

Added Docker setup instructions and troubleshooting section.
```

### Best Practices

- Keep commits atomic (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issue numbers when applicable
- Avoid mixing refactoring with feature changes

## 🔀 Pull Request Process

### Before Submitting

1. Update your branch with latest `main`:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. Run tests and linting:

   ```bash
   npm run test
   npm run lint
   ```

3. Update documentation if needed

### PR Description Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made

- List key changes
- Explain technical decisions
- Note any breaking changes

## Testing

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Related Issues

Closes #issue_number

## Screenshots (if applicable)
```

### Review Process

- At least one maintainer must approve
- All CI checks must pass
- Address all review comments
- Keep PR scope focused and manageable
- Squash commits if requested

## 📚 Documentation

### Code Documentation

- Add JSDoc comments for public methods:

  ```typescript
  /**
   * Creates a new user with the provided information
   * @param createUserDto - User creation data
   * @returns The created user object
   * @throws BadRequestException if email already exists
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Implementation
  }
  ```

- Document complex logic with inline comments
- Keep comments up-to-date with code changes

### API Documentation

- Use Swagger decorators for all endpoints
- Provide example requests/responses
- Document all possible status codes
- Group related endpoints with `@ApiTags()`

### README Updates

- Update README.md when adding major features
- Document new environment variables
- Update architecture diagrams if structure changes

## ❓ Questions?

If you have questions or need help:

- Open a GitHub issue with the `question` label
- Join our community chat
- Email the maintainers at dev@baztille.com

## 📜 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Baztille! 🗳️
