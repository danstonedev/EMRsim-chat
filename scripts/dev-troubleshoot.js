#!/usr/bin/env node
/**
 * Development Environment Troubleshooter
 *
 * This script can automatically fix common development issues
 * and provides guided troubleshooting for complex problems.
 *
 * Usage: node scripts/dev-troubleshoot.js [--fix-auto]
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

class DevTroubleshooter {
  constructor(options = {}) {
    this.autoFix = options.autoFix || process.argv.includes("--fix-auto");
    this.rootDir = path.join(__dirname, "..");
    this.fixedIssues = [];
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const prefix = {
      error: "❌",
      warning: "⚠️ ",
      success: "✅",
      info: "ℹ️ ",
      fix: "🔧",
    }[type];

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runCommand(command, description) {
    this.log(`Running: ${command}`, "info");
    try {
      const output = execSync(command, {
        cwd: this.rootDir,
        encoding: "utf8",
        stdio: "pipe",
      });
      this.log(`${description} completed successfully`, "success");
      return { success: true, output };
    } catch (error) {
      this.log(`${description} failed: ${error.message}`, "error");
      return { success: false, error: error.message };
    }
  }

  async fixMissingNodeModules() {
    const nodeModulesPath = path.join(this.rootDir, "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
      this.log("Missing node_modules detected", "warning");

      if (this.autoFix) {
        this.log("Installing dependencies...", "fix");
        const result = await this.runCommand(
          "npm install",
          "Dependency installation"
        );
        if (result.success) {
          this.fixedIssues.push("Installed missing dependencies");
        }
        return result.success;
      } else {
        this.log("Run: npm install", "info");
        return false;
      }
    }
    return true;
  }

  async fixPortConflicts() {
    const port = 3001;

    try {
      // Check if port is in use
      const netstatResult = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
        stdio: "pipe",
      });

      if (netstatResult.trim()) {
        this.log(`Port ${port} is in use`, "warning");

        if (this.autoFix) {
          this.log("Attempting to free port...", "fix");
          try {
            await this.runCommand(`npx kill-port ${port}`, "Port cleanup");
            this.fixedIssues.push(`Freed port ${port}`);
            return true;
          } catch (error) {
            this.log(
              `Could not free port automatically. Manual intervention required.`,
              "error"
            );
            return false;
          }
        } else {
          this.log(`Run: npx kill-port ${port}`, "info");
          return false;
        }
      }
    } catch (error) {
      // Port is likely free if netstat command fails
    }

    return true;
  }

  async fixEnvironmentFiles() {
    const envExamplePath = path.join(this.rootDir, ".env.local.example");
    const envLocalPath = path.join(this.rootDir, ".env.local");

    if (fs.existsSync(envExamplePath) && !fs.existsSync(envLocalPath)) {
      this.log("Missing .env.local file", "warning");

      if (this.autoFix) {
        this.log("Creating .env.local from template...", "fix");
        try {
          fs.copyFileSync(envExamplePath, envLocalPath);
          this.fixedIssues.push("Created .env.local from template");
          this.log(
            "Remember to update .env.local with your actual values!",
            "warning"
          );
          return true;
        } catch (error) {
          this.log(`Failed to create .env.local: ${error.message}`, "error");
          return false;
        }
      } else {
        this.log("Run: cp .env.local.example .env.local", "info");
        return false;
      }
    }

    return true;
  }

  async fixBuildCache() {
    const nextCachePath = path.join(this.rootDir, ".next");

    if (fs.existsSync(nextCachePath)) {
      this.log("Clearing Next.js build cache...", "fix");

      if (this.autoFix) {
        try {
          fs.rmSync(nextCachePath, { recursive: true, force: true });
          this.fixedIssues.push("Cleared Next.js build cache");
          return true;
        } catch (error) {
          this.log(`Failed to clear cache: ${error.message}`, "error");
          return false;
        }
      } else {
        this.log("Run: npm run clean", "info");
        return false;
      }
    }

    return true;
  }

  async fixLintingIssues() {
    this.log("Checking for linting issues...", "info");

    if (this.autoFix) {
      this.log("Running automatic lint fixes...", "fix");
      const result = await this.runCommand("npm run lint:fix", "Linting fixes");
      if (result.success) {
        this.fixedIssues.push("Fixed linting issues");
      }
      return result.success;
    } else {
      this.log("Run: npm run lint:fix", "info");
      return false;
    }
  }

  async fixTypeScriptIssues() {
    this.log("Checking TypeScript configuration...", "info");

    const result = await this.runCommand(
      "npm run type-check",
      "TypeScript check"
    );
    if (!result.success) {
      this.log(
        "TypeScript errors detected. Review and fix manually.",
        "warning"
      );
      this.log("Common fixes:", "info");
      console.log("  - Add missing type annotations");
      console.log("  - Fix import paths");
      console.log("  - Update component prop types");
      return false;
    }

    return true;
  }

  async verifyDevServerStart() {
    this.log("Testing development server startup...", "info");

    return new Promise((resolve) => {
      const devProcess = spawn("npm", ["run", "dev"], {
        cwd: this.rootDir,
        stdio: "pipe",
      });

      let output = "";
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          devProcess.kill();
          this.log("Dev server startup test timed out", "error");
          resolve(false);
        }
      }, 15000);

      devProcess.stdout.on("data", (data) => {
        output += data.toString();
        if (output.includes("Ready in") && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          devProcess.kill();
          this.log("Dev server starts successfully", "success");
          resolve(true);
        }
      });

      devProcess.stderr.on("data", (data) => {
        const error = data.toString();
        if (error.includes("Error:") && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          devProcess.kill();
          this.log(`Dev server failed to start: ${error}`, "error");
          resolve(false);
        }
      });

      devProcess.on("error", (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.log(`Dev server process error: ${error.message}`, "error");
          resolve(false);
        }
      });
    });
  }

  generateReport() {
    this.log("\n🔧 TROUBLESHOOTING REPORT", "info");
    this.log("========================", "info");

    if (this.fixedIssues.length > 0) {
      this.log(`\n✅ ISSUES FIXED (${this.fixedIssues.length}):`, "success");
      this.fixedIssues.forEach((fix, i) => {
        console.log(`${i + 1}. ${fix}`);
      });
    } else {
      this.log("No issues were automatically fixed", "info");
    }

    this.log("\n🚀 NEXT STEPS:", "info");
    console.log('1. Run "npm run dev" to start the development server');
    console.log("2. Open http://localhost:3001 in your browser");
    console.log("3. Check the terminal for any error messages");
    console.log(
      "4. Run this troubleshooter with --fix-auto for automatic fixes"
    );

    this.log("\n📞 NEED MORE HELP?", "info");
    console.log("- Check DEVELOPMENT.md for detailed setup instructions");
    console.log(
      '- Run "node scripts/dev-health-check.js" for comprehensive diagnostics'
    );
    console.log(
      "- Review the Next.js documentation for advanced troubleshooting"
    );
  }

  async run() {
    this.log(
      `🔧 Starting development troubleshooter... (auto-fix: ${this.autoFix})`,
      "info"
    );

    // Run all troubleshooting steps
    await this.fixMissingNodeModules();
    await this.fixPortConflicts();
    await this.fixEnvironmentFiles();
    await this.fixBuildCache();
    await this.fixLintingIssues();
    await this.fixTypeScriptIssues();

    // Final verification
    const devServerWorks = await this.verifyDevServerStart();

    this.generateReport();

    return {
      fixed: this.fixedIssues.length > 0,
      devServerWorks,
      fixedIssues: this.fixedIssues,
    };
  }
}

// Run the troubleshooter if called directly
if (require.main === module) {
  const troubleshooter = new DevTroubleshooter();
  troubleshooter.run().then((report) => {
    process.exit(report.devServerWorks ? 0 : 1);
  });
}

module.exports = DevTroubleshooter;
