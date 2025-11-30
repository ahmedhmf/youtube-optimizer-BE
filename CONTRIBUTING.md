# Contributing to YouTube Optimizer Backend

Thank you for your interest in contributing to YouTube Optimizer Backend! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Guidelines](#testing-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Issue Guidelines](#issue-guidelines)
8. [Documentation](#documentation)
9. [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations can be reported to: [your-email@domain.com]

Project maintainers have the right to remove, edit, or reject contributions that don't align with this Code of Conduct.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 20.x** or higher
- **npm 10.x** or higher
- **Git**
- **Supabase account** (for database testing)
- **OpenAI API key** (for AI feature testing)
- **YouTube Data API key** (for video analysis testing)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork**:
```bash
git clone https://github.com/YOUR_USERNAME/youtube-optimizer-BE.git
cd youtube-optimizer-BE
```

3. **Add upstream remote**:
```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/youtube-optimizer-BE.git
```

### Setup Development Environment

1. **Install dependencies**:
```bash
npm install
```

2. **Copy environment file**:
```bash
cp .env.example .env
```

3. **Configure environment variables**:
Edit `.env` with your credentials (see [DEPLOYMENT.md](docs/DEPLOYMENT.md))

4. **Start development server**:
```bash
npm run start:dev
```

5. **Verify setup**:
```bash
curl http://localhost:3000/health
```

## Development Workflow

### Branching Strategy

We follow a simplified Git Flow:

- `main` - Production-ready code
- `develop` - Integration branch (if applicable)
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `docs/*` - Documentation updates

### Creating a Feature Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

**Examples:**
```bash
git commit -m "feat(auth): add Google OAuth login"
git commit -m "fix(youtube): handle rate limit errors gracefully"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(ai): add unit tests for AI service"
```

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Merge into your local main
git checkout main
git merge upstream/main

# Rebase your feature branch
git checkout feature/your-feature-name
git rebase main
```

## Coding Standards

### TypeScript Style Guide

We use **ESLint** and **Prettier** for code formatting.

**Run linter:**
```bash
npm run lint
```

**Auto-fix issues:**
```bash
npm run lint:fix
```

**Format code:**
```bash
npm run format
```

### Code Style Rules

1. **Use TypeScript** - No plain JavaScript files
2. **Explicit types** - Avoid `any`, use proper types
3. **Async/await** - Prefer over promises/callbacks
4. **Arrow functions** - For inline functions
5. **Destructuring** - Use object/array destructuring
6. **Template literals** - For string interpolation
7. **Const by default** - Use `const` unless reassignment needed

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `user-service.ts`)
- **Classes**: `PascalCase` (e.g., `UserService`)
- **Interfaces**: `PascalCase` with `I` prefix optional (e.g., `IUser` or `User`)
- **Functions**: `camelCase` (e.g., `getUserById`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Private members**: `_camelCase` prefix (e.g., `_privateMethod`)

### Example Code Style

```typescript
// Good
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface UserData {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async getUserById(userId: string): Promise<UserData> {
    try {
      const user = await this.findUser(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    } catch (error) {
      this.logger.error(`Failed to get user: ${error.message}`);
      throw error;
    }
  }
  
  private async findUser(id: string): Promise<UserData | null> {
    // Implementation
    return null;
  }
}
```

### NestJS Patterns

1. **Dependency Injection** - Use constructor injection
2. **Modules** - Group related features
3. **DTOs** - Use for validation and type safety
4. **Guards** - For authentication/authorization
5. **Interceptors** - For cross-cutting concerns
6. **Pipes** - For validation and transformation
7. **Exception Filters** - For error handling

### Error Handling

```typescript
// Use custom exceptions
import { HttpException, HttpStatus } from '@nestjs/common';

throw new HttpException('User not found', HttpStatus.NOT_FOUND);

// Or built-in exceptions
import { NotFoundException } from '@nestjs/common';

throw new NotFoundException('User not found');
```

### Logging

Use structured logging:

```typescript
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(ClassName.name);

// Log levels
this.logger.debug('Debug message');
this.logger.log('Info message');
this.logger.warn('Warning message');
this.logger.error('Error message', stackTrace);
```

## Testing Guidelines

### Test Structure

We use **Jest** for testing.

**Test files:**
- Unit tests: `*.spec.ts` (next to source file)
- E2E tests: `test/*.e2e-spec.ts`

### Writing Tests

**Unit test example:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { ConfigService } from '@nestjs/config';

describe('UserService', () => {
  let service: UserService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mock-value'),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      jest.spyOn(service as any, 'findUser').mockResolvedValue(mockUser);

      const result = await service.getUserById('1');
      
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      jest.spyOn(service as any, 'findUser').mockResolvedValue(null);

      await expect(service.getUserById('1')).rejects.toThrow('User 1 not found');
    });
  });
});
```

**E2E test example:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/register (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
        name: 'Test User',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
      });
  });
});
```

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Specific test file
npm test -- user.service.spec.ts
```

### Test Coverage

We aim for:
- **80%+ overall coverage**
- **90%+ for critical paths** (auth, payments, etc.)

Check coverage:
```bash
npm run test:cov
```

### Testing Best Practices

1. **AAA Pattern** - Arrange, Act, Assert
2. **One assertion per test** - When possible
3. **Descriptive names** - `it('should throw error when user not found')`
4. **Mock external services** - Don't call real APIs
5. **Test edge cases** - Null, undefined, empty, etc.
6. **Clean up** - Use `afterEach`/`afterAll`
7. **Fast tests** - Unit tests should be < 100ms

## Pull Request Process

### Before Submitting PR

- [ ] Code follows style guidelines
- [ ] All tests pass (`npm test`)
- [ ] New tests added for new features
- [ ] Documentation updated (if applicable)
- [ ] Commits follow conventional commit format
- [ ] No merge conflicts with `main`
- [ ] Build succeeds (`npm run build`)

### Creating Pull Request

1. **Push your branch**:
```bash
git push origin feature/your-feature-name
```

2. **Open PR on GitHub**:
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your feature branch

3. **Fill out PR template**:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Screenshots (if applicable)
Add screenshots/GIFs for UI changes

## Related Issues
Closes #123
```

### PR Review Process

1. **Automated checks** run (linting, tests, build)
2. **Code review** by maintainers
3. **Changes requested** (if needed)
4. **Approval** from at least one maintainer
5. **Merge** by maintainer

### After PR Merged

```bash
# Update your fork
git checkout main
git pull upstream main
git push origin main

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## Issue Guidelines

### Creating Issues

**Bug Report Template:**

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Windows 11]
- Node version: [e.g., 20.10.0]
- Browser (if applicable): [e.g., Chrome 120]

## Additional Context
Screenshots, logs, etc.
```

**Feature Request Template:**

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Mockups, examples, etc.
```

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `priority: high` - High priority
- `priority: medium` - Medium priority
- `priority: low` - Low priority

## Documentation

### Code Documentation

Use **JSDoc** comments for functions/classes:

```typescript
/**
 * Retrieves a user by their ID
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to user data
 * @throws {NotFoundException} When user is not found
 * @example
 * const user = await userService.getUserById('123');
 */
async getUserById(userId: string): Promise<UserData> {
  // Implementation
}
```

### Documentation Files

- **README.md** - Project overview and quick start
- **docs/ARCHITECTURE.md** - System architecture
- **docs/DEPLOYMENT.md** - Deployment guide
- **docs/RUNBOOK.md** - Operations guide
- **CHANGELOG.md** - Version history
- **CONTRIBUTING.md** - This file

### Updating Documentation

When adding features:
1. Update relevant documentation files
2. Update API documentation (Swagger decorators)
3. Add examples if applicable
4. Update CHANGELOG.md

## Community

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - Questions, ideas, showcases
- **Email** - [your-email@domain.com]

### Getting Help

- Read documentation first
- Search existing issues
- Ask in GitHub Discussions
- Provide context and examples

### Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- GitHub insights

## Development Tips

### Useful Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debugging

# Testing
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:cov          # With coverage
npm run test:e2e          # E2E tests

# Code Quality
npm run lint              # Check linting
npm run lint:fix          # Fix linting issues
npm run format            # Format code

# Building
npm run build             # Build for production
npm run start:prod        # Run production build

# Database
npm run db:status         # Check migration status
npm run db:push           # Apply migrations
npm run db:pull           # Pull schema
```

### Debugging in VSCode

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

### Common Pitfalls

1. **Forgotten environment variables** - Check `.env.example`
2. **Circular dependencies** - Use `forwardRef()` in NestJS
3. **Missing decorators** - Remember `@Injectable()`, `@Controller()`
4. **Async/await** - Don't forget `await` with promises
5. **Type issues** - Run `npm run build` to catch TypeScript errors

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).

## Questions?

If you have questions about contributing, please:
1. Check existing documentation
2. Search GitHub issues/discussions
3. Open a new discussion
4. Contact maintainers: [your-email@domain.com]

---

**Thank you for contributing!** 🎉

Your contributions make this project better for everyone. We appreciate your time and effort!

---

**Last Updated:** November 30, 2025  
**Maintainers:** [Your Name]
