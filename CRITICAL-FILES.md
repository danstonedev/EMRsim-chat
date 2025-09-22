# Critical Development Files Documentation

This document identifies all the critical files that affect local development server functionality. **Be extra careful when modifying these files** as changes can break localhost functionality.

## 🚨 CRITICAL FILES - Handle with Care

### Core Configuration Files

#### `package.json` ⚠️ CRITICAL
**Purpose**: Defines project dependencies, scripts, and metadata
**Critical Sections**:
- `scripts.dev`: Development server startup command
- `dependencies`: Must include `next`, `react`, `react-dom`
- `devDependencies`: TypeScript and build tools

**⚠️ Breaking Changes**:
- Removing or modifying the `dev` script
- Removing Next.js, React, or TypeScript dependencies
- Changing port configuration without updating related files

**Safe Changes**:
- Adding new dependencies
- Adding new scripts (as long as they don't conflict)
- Updating dependency versions (with testing)

#### `next.config.js` ⚠️ CRITICAL
**Purpose**: Next.js framework configuration
**Critical Sections**:
- `reactStrictMode`: Should remain `true` for dev consistency
- `experimental`: Contains performance optimizations
- `rewrites`: URL rewrite rules

**⚠️ Breaking Changes**:
- Syntax errors (will prevent server startup)
- Removing `reactStrictMode`
- Invalid experimental flags
- Malformed rewrites/redirects

**Safe Changes**:
- Adding new experimental features (test first)
- Adding environment-specific configurations
- Adding new rewrites/redirects

#### `tsconfig.json` ⚠️ CRITICAL
**Purpose**: TypeScript compiler configuration
**Critical Sections**:
- `compilerOptions.baseUrl`: Should be "."
- `compilerOptions.paths`: Path mapping for imports
- `include`: Must include all source directories
- `exclude`: Should exclude build artifacts

**⚠️ Breaking Changes**:
- Invalid JSON syntax
- Removing path mappings used in code
- Excluding source directories
- Incompatible compiler options

**Safe Changes**:
- Adding new path mappings
- Adjusting strict mode settings
- Adding new include patterns

### Build and Styling Configuration

#### `tailwind.config.ts` ⚠️ MODERATE RISK
**Purpose**: Tailwind CSS configuration
**Critical Sections**:
- `content`: Must include all template files
- `theme`: Custom theme definitions
- `plugins`: Tailwind plugins

**⚠️ Breaking Changes**:
- Excluding source files from content scanning
- Syntax errors
- Incompatible plugin configurations

#### `postcss.config.js` ⚠️ MODERATE RISK
**Purpose**: PostCSS configuration for CSS processing
**Critical Sections**:
- `plugins`: Must include Tailwind and autoprefixer

### Application Structure Files

#### `src/app/layout.tsx` ⚠️ HIGH RISK
**Purpose**: Root application layout component
**Critical Sections**:
- HTML structure
- Global CSS imports
- Provider components (MuiProvider, etc.)
- Metadata configuration

**⚠️ Breaking Changes**:
- Removing required HTML elements
- Breaking provider component hierarchy
- Removing global CSS imports
- Invalid React syntax

#### `src/app/page.tsx` ⚠️ MODERATE RISK
**Purpose**: Home page component
**Critical Sections**:
- Component imports
- React component structure

### Environment and Development Files

#### `.env.local` ⚠️ LOW RISK (but important)
**Purpose**: Local environment variables
**Critical Variables**:
- `OPENAI_API_KEY`: Required for AI functionality
- `NODE_ENV`: Should be "development"
- `NEXT_PUBLIC_*`: Client-side environment variables

#### `.env.local.example` ℹ️ REFERENCE ONLY
**Purpose**: Template for environment variables
**Usage**: Copy to `.env.local` and customize

### VS Code Configuration

#### `.vscode/settings.json` ℹ️ OPTIONAL
**Purpose**: Editor-specific settings for better DX
**Sections**:
- Formatter configuration
- Tailwind CSS support
- TypeScript preferences

#### `.vscode/extensions.json` ℹ️ OPTIONAL
**Purpose**: Recommended VS Code extensions

### Build Artifacts (Auto-generated)

#### `.next/` 🚫 DO NOT MODIFY
**Purpose**: Next.js build cache and generated files
**Action**: Delete if corrupted (`npm run clean`)

#### `node_modules/` 🚫 DO NOT MODIFY
**Purpose**: Installed dependencies
**Action**: Regenerate with `npm install`

## 🛡️ Protection Mechanisms

### Automated Safeguards

1. **Pre-commit Git Hook** (`.githooks/pre-commit`)
   - Validates critical files before commits
   - Checks for syntax errors
   - Prevents removal of essential configurations
   - Override with `git commit --no-verify` if needed

2. **Post-merge Git Hook** (`.githooks/post-merge`)
   - Automatically runs after pulling changes
   - Updates dependencies if package.json changed
   - Runs health checks
   - Auto-fixes common issues

3. **Health Check Script** (`scripts/dev-health-check.js`)
   - Validates entire development environment
   - Run with: `npm run dev:check`
   - Returns detailed report of issues

4. **Troubleshooter Script** (`scripts/dev-troubleshoot.js`)
   - Automatically fixes common issues
   - Run with: `npm run dev:fix` (auto-fix)
   - Run with: `npm run dev:troubleshoot` (guided)

### Manual Verification Steps

Before modifying critical files:

1. **Backup Current State**:
   ```bash
   git add -A
   git commit -m "Backup before config changes"
   ```

2. **Test Current Setup**:
   ```bash
   npm run dev:check
   ```

3. **Make Changes Incrementally**:
   - Change one file at a time
   - Test after each change
   - Document what you changed

4. **Verify After Changes**:
   ```bash
   npm run dev:check
   npm run dev  # Test actual server startup
   ```

### Emergency Recovery

If development server breaks:

1. **Quick Fix Attempt**:
   ```bash
   npm run dev:fix
   ```

2. **Manual Troubleshooting**:
   ```bash
   npm run dev:troubleshoot
   ```

3. **Full Reset**:
   ```bash
   npm run clean
   rm -rf node_modules
   npm install
   ```

4. **Git Revert**:
   ```bash
   git log --oneline -10  # Find last working commit
   git revert <commit-hash>
   ```

## 📋 Pre-Modification Checklist

Before editing any critical file:

- [ ] Current dev server is working (`npm run dev`)
- [ ] All changes are committed or stashed
- [ ] You understand what the file does
- [ ] You have a rollback plan
- [ ] You've tested similar changes in isolation
- [ ] You've informed team members (if applicable)

After modification:

- [ ] Health check passes (`npm run dev:check`)
- [ ] Dev server starts successfully
- [ ] Hot reload works correctly
- [ ] All API routes respond correctly
- [ ] TypeScript compilation succeeds
- [ ] No console errors in browser

## 🆘 Getting Help

If you break the development environment:

1. **Check this document** for recovery procedures
2. **Run the troubleshooter**: `npm run dev:troubleshoot`
3. **Review recent commits**: Look for what changed
4. **Check the health check output**: `npm run dev:check`
5. **Ask for help**: Share the health check results

Remember: It's better to ask questions before making changes than to spend hours debugging afterwards!