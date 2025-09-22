#!/usr/bin/env node
/**
 * Development Server Health Check
 *
 * This script verifies that the development environment is properly configured
 * and can identify common issues that break localhost functionality.
 *
 * Usage: node scripts/dev-health-check.js
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

class DevHealthChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.rootDir = path.join(__dirname, "..");
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = {
      error: "❌",
      warning: "⚠️ ",
      success: "✅",
      info: "ℹ️ ",
    }[type];

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  addIssue(message) {
    this.issues.push(message);
    this.log(message, "error");
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, "warning");
  }

  checkFileExists(filePath, isRequired = true) {
    const fullPath = path.join(this.rootDir, filePath);
    if (fs.existsSync(fullPath)) {
      this.log(`Found: ${filePath}`, "success");
      return true;
    } else {
      if (isRequired) {
        this.addIssue(`Missing required file: ${filePath}`);
      } else {
        this.addWarning(`Missing optional file: ${filePath}`);
      }
      return false;
    }
  }

  checkPackageJson() {
    this.log("Checking package.json configuration...");

    if (!this.checkFileExists("package.json")) return;

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.rootDir, "package.json"))
    );

    // Check for dev script
    if (!packageJson.scripts?.dev) {
      this.addIssue('Missing "dev" script in package.json');
    } else if (!packageJson.scripts.dev.includes("next dev")) {
      this.addWarning('Dev script does not use "next dev"');
    } else {
      this.log("Dev script configured correctly", "success");
    }

    // Check for required dependencies
    const requiredDeps = ["next", "react", "react-dom"];
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies?.[dep]) {
        this.addIssue(`Missing required dependency: ${dep}`);
      }
    }

    // Check Next.js version
    const nextVersion = packageJson.dependencies?.next;
    if (nextVersion && !nextVersion.startsWith("15.")) {
      this.addWarning(
        `Next.js version ${nextVersion} - consider upgrading to 15.x`
      );
    }
  }

  checkNextConfig() {
    this.log("Checking Next.js configuration...");

    if (!this.checkFileExists("next.config.js")) return;

    const configContent = fs.readFileSync(
      path.join(this.rootDir, "next.config.js"),
      "utf8"
    );

    // Check for React Strict Mode
    if (!configContent.includes("reactStrictMode")) {
      this.addWarning("reactStrictMode not enabled in next.config.js");
    }

    // Check for development optimizations
    if (!configContent.includes("swcMinify")) {
      this.addWarning(
        "SWC minification not enabled - consider adding for faster builds"
      );
    }

    this.log("Next.js configuration looks good", "success");
  }

  checkTailwindConfig() {
    this.log("Checking Tailwind CSS configuration...");

    this.checkFileExists("tailwind.config.ts", false) ||
      this.checkFileExists("tailwind.config.js", false);

    this.checkFileExists("postcss.config.js", false);
  }

  checkTypeScriptConfig() {
    this.log("Checking TypeScript configuration...");

    if (this.checkFileExists("tsconfig.json")) {
      const tsConfig = JSON.parse(
        fs.readFileSync(path.join(this.rootDir, "tsconfig.json"))
      );

      if (tsConfig.compilerOptions?.strict !== true) {
        this.addWarning("TypeScript strict mode not enabled");
      }

      if (!tsConfig.include?.includes("src/**/*")) {
        this.addWarning("TypeScript may not include all source files");
      }
    }
  }

  checkEnvironmentFiles() {
    this.log("Checking environment configuration...");

    // Check for environment files
    this.checkFileExists(".env.local.example", false);

    if (this.checkFileExists(".env.local", false)) {
      this.log("Local environment file found", "success");
    } else {
      this.addWarning(
        "No .env.local file - copy from .env.local.example if needed"
      );
    }

    // Check gitignore
    if (this.checkFileExists(".gitignore")) {
      const gitignore = fs.readFileSync(
        path.join(this.rootDir, ".gitignore"),
        "utf8"
      );
      if (!gitignore.includes(".env.local")) {
        this.addWarning(".env.local should be in .gitignore");
      }
    }
  }

  checkDirectoryStructure() {
    this.log("Checking directory structure...");

    const requiredDirs = ["src", "src/app", "src/components", "public"];

    for (const dir of requiredDirs) {
      if (!fs.existsSync(path.join(this.rootDir, dir))) {
        this.addIssue(`Missing required directory: ${dir}`);
      }
    }
  }

  async checkPortAvailability(port = 3001) {
    return new Promise((resolve) => {
      const server = http.createServer();

      server.listen(port, () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.on("error", () => {
        resolve(false);
      });
    });
  }

  async checkDevServerHealth() {
    this.log("Checking development server health...");

    const port = 3001;
    const isPortAvailable = await this.checkPortAvailability(port);

    if (!isPortAvailable) {
      this.addWarning(
        `Port ${port} is already in use - dev server might already be running`
      );
    } else {
      this.log(`Port ${port} is available`, "success");
    }
  }

  checkNodeModules() {
    this.log("Checking node_modules...");

    if (!this.checkFileExists("node_modules", false)) {
      this.addIssue('node_modules directory missing - run "npm install"');
      return;
    }

    // Check for common problematic packages
    const nextPath = path.join(this.rootDir, "node_modules", "next");
    if (!fs.existsSync(nextPath)) {
      this.addIssue('Next.js not installed - run "npm install"');
    }
  }

  generateReport() {
    this.log("\n📋 DEVELOPMENT HEALTH CHECK REPORT", "info");
    this.log("================================", "info");

    if (this.issues.length === 0 && this.warnings.length === 0) {
      this.log(
        "🎉 All checks passed! Your development environment is healthy.",
        "success"
      );
    } else {
      if (this.issues.length > 0) {
        this.log(`\n🚨 CRITICAL ISSUES (${this.issues.length}):`, "error");
        this.issues.forEach((issue, i) => {
          console.log(`${i + 1}. ${issue}`);
        });
      }

      if (this.warnings.length > 0) {
        this.log(`\n⚠️  WARNINGS (${this.warnings.length}):`, "warning");
        this.warnings.forEach((warning, i) => {
          console.log(`${i + 1}. ${warning}`);
        });
      }
    }

    this.log("\n💡 QUICK FIXES:", "info");
    console.log('- Run "npm install" if dependencies are missing');
    console.log("- Copy .env.local.example to .env.local and configure");
    console.log('- Run "npm run dev" to start the development server');
    console.log("- Check http://localhost:3001 in your browser");
    console.log('- Run "npm run lint:fix" to fix linting issues');

    return {
      healthy: this.issues.length === 0,
      issues: this.issues,
      warnings: this.warnings,
    };
  }

  async run() {
    this.log("🔍 Starting development environment health check...", "info");

    this.checkPackageJson();
    this.checkNextConfig();
    this.checkTailwindConfig();
    this.checkTypeScriptConfig();
    this.checkEnvironmentFiles();
    this.checkDirectoryStructure();
    this.checkNodeModules();
    await this.checkDevServerHealth();

    return this.generateReport();
  }
}

// Run the health check if called directly
if (require.main === module) {
  const checker = new DevHealthChecker();
  checker.run().then((report) => {
    process.exit(report.healthy ? 0 : 1);
  });
}

module.exports = DevHealthChecker;
