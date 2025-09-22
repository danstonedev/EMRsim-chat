#!/usr/bin/env node
/**
 * Development Environment Monitor
 *
 * This script continuously monitors the development environment
 * for common issues and provides real-time feedback.
 *
 * Usage: node scripts/dev-monitor.js [--interval=5000]
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const chokidar = require("chokidar");

class DevMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 5000; // 5 seconds
    this.rootDir = path.join(__dirname, "..");
    this.isRunning = false;
    this.watchers = [];
    this.lastCheck = {};
    this.issues = new Set();
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const prefix = {
      error: "❌",
      warning: "⚠️ ",
      success: "✅",
      info: "ℹ️ ",
      monitor: "👁️ ",
    }[type];

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async checkDevServer() {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.get("http://localhost:3001", (res) => {
          resolve({
            statusCode: res.statusCode,
            success: res.statusCode === 200,
          });
        });

        req.on("error", reject);
        req.setTimeout(3000, () => {
          req.destroy();
          reject(new Error("Request timeout"));
        });
      });

      if (this.issues.has("server-down")) {
        this.issues.delete("server-down");
        this.log("Development server is back online", "success");
      }

      return response.success;
    } catch (error) {
      if (!this.issues.has("server-down")) {
        this.issues.add("server-down");
        this.log("Development server is not responding", "error");
        this.log("Try: npm run dev", "info");
      }
      return false;
    }
  }

  checkFileIntegrity() {
    const criticalFiles = [
      "package.json",
      "next.config.js",
      "tsconfig.json",
      "src/app/layout.tsx",
      "src/app/page.tsx",
    ];

    let allGood = true;

    for (const file of criticalFiles) {
      const filePath = path.join(this.rootDir, file);

      if (!fs.existsSync(filePath)) {
        if (!this.issues.has(`missing-${file}`)) {
          this.issues.add(`missing-${file}`);
          this.log(`Critical file missing: ${file}`, "error");
        }
        allGood = false;
      } else {
        if (this.issues.has(`missing-${file}`)) {
          this.issues.delete(`missing-${file}`);
          this.log(`Critical file restored: ${file}`, "success");
        }
      }

      // Check for syntax issues in specific files
      if (file === "package.json") {
        try {
          JSON.parse(fs.readFileSync(filePath, "utf8"));
          if (this.issues.has("invalid-package-json")) {
            this.issues.delete("invalid-package-json");
            this.log("package.json syntax is now valid", "success");
          }
        } catch (error) {
          if (!this.issues.has("invalid-package-json")) {
            this.issues.add("invalid-package-json");
            this.log("package.json has invalid JSON syntax", "error");
          }
          allGood = false;
        }
      }
    }

    return allGood;
  }

  checkNodeModules() {
    const nodeModulesPath = path.join(this.rootDir, "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
      if (!this.issues.has("no-node-modules")) {
        this.issues.add("no-node-modules");
        this.log("node_modules directory is missing", "error");
        this.log("Run: npm install", "info");
      }
      return false;
    } else {
      if (this.issues.has("no-node-modules")) {
        this.issues.delete("no-node-modules");
        this.log("node_modules directory restored", "success");
      }
    }

    return true;
  }

  setupFileWatchers() {
    const criticalFiles = [
      "package.json",
      "next.config.js",
      "tsconfig.json",
      "tailwind.config.ts",
    ];

    for (const file of criticalFiles) {
      const watcher = chokidar.watch(path.join(this.rootDir, file), {
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on("change", () => {
        this.log(`Critical file changed: ${file}`, "warning");
        this.log("Development server may need restart", "info");

        // Quick validation for specific files
        if (file === "package.json") {
          this.checkFileIntegrity();
        }
      });

      watcher.on("unlink", () => {
        this.log(`Critical file deleted: ${file}`, "error");
      });

      this.watchers.push(watcher);
    }

    // Watch .next directory for build issues
    const nextWatcher = chokidar.watch(path.join(this.rootDir, ".next"), {
      persistent: true,
      ignoreInitial: true,
      depth: 1,
    });

    nextWatcher.on("add", (filePath) => {
      if (filePath.includes("build-manifest.json")) {
        this.log("Build completed successfully", "success");
      }
    });

    this.watchers.push(nextWatcher);
  }

  async performHealthCheck() {
    const serverOk = await this.checkDevServer();
    const filesOk = this.checkFileIntegrity();
    const nodeModulesOk = this.checkNodeModules();

    const overallHealth = serverOk && filesOk && nodeModulesOk;

    if (overallHealth && this.issues.size === 0) {
      // Only log success every 10 checks to reduce noise
      const checkCount = (this.lastCheck.count || 0) + 1;
      this.lastCheck.count = checkCount;

      if (checkCount % 10 === 0) {
        this.log(`Environment healthy (check #${checkCount})`, "monitor");
      }
    }

    return overallHealth;
  }

  async start() {
    this.log("🚀 Starting development environment monitor...", "monitor");
    this.log(`Checking every ${this.interval}ms`, "info");

    this.isRunning = true;
    this.setupFileWatchers();

    // Initial health check
    await this.performHealthCheck();

    // Set up periodic monitoring
    const monitorLoop = async () => {
      if (!this.isRunning) return;

      try {
        await this.performHealthCheck();
      } catch (error) {
        this.log(`Monitor error: ${error.message}`, "error");
      }

      setTimeout(monitorLoop, this.interval);
    };

    setTimeout(monitorLoop, this.interval);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      this.stop();
    });

    this.log("Monitor started. Press Ctrl+C to stop.", "info");
  }

  stop() {
    this.log("Stopping development environment monitor...", "monitor");
    this.isRunning = false;

    // Close all file watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }

    this.log("Monitor stopped.", "info");
    process.exit(0);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      issues: Array.from(this.issues),
      lastCheck: this.lastCheck,
    };
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const intervalArg = args.find((arg) => arg.startsWith("--interval="));
const interval = intervalArg ? parseInt(intervalArg.split("=")[1]) : 5000;

// Run the monitor if called directly
if (require.main === module) {
  const monitor = new DevMonitor({ interval });
  monitor.start();
}

module.exports = DevMonitor;
