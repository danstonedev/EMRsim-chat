#!/usr/bin/env node

// Performance Monitoring Script
// Run this to check current optimization status

const fs = require("fs");
const path = require("path");

console.log("🎯 EMRsim-chat Optimization Status Check\n");

// Check bundle sizes
const checkBundleSizes = () => {
  const nextDir = path.join(process.cwd(), ".next");
  if (!fs.existsSync(nextDir)) {
    console.log('❌ No build found. Run "npm run build" first.');
    return;
  }

  console.log("📦 Bundle Analysis:");

  // Check CSS bundle
  const cssDir = path.join(nextDir, "static", "css");
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css"));
    cssFiles.forEach((file) => {
      const filePath = path.join(cssDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      const status = stats.size <= 40000 ? "✅" : "⚠️";
      console.log(`  ${status} CSS Bundle: ${sizeKB}KB (Target: ≤40KB)`);
    });
  }

  // Check JS chunks
  const chunksDir = path.join(nextDir, "static", "chunks");
  if (fs.existsSync(chunksDir)) {
    const chunkFiles = fs
      .readdirSync(chunksDir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => {
        const stats = fs.statSync(path.join(chunksDir, f));
        return { name: f, size: stats.size };
      })
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    console.log("\n📊 Top 5 JavaScript Chunks:");
    chunkFiles.forEach(({ name, size }) => {
      const sizeKB = (size / 1024).toFixed(2);
      console.log(`  • ${name}: ${sizeKB}KB`);
    });
  }
};

// Check service worker
const checkServiceWorker = () => {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  if (fs.existsSync(swPath)) {
    console.log("\n💾 Service Worker: ✅ Deployed");
  } else {
    console.log("\n💾 Service Worker: ❌ Not found");
  }
};

// Check optimization files
const checkOptimizationFiles = () => {
  console.log("\n⚡ Optimization Components:");

  const files = [
    "src/lib/hooks/useFastVoiceProcessing.ts",
    "src/lib/audio/AudioProcessor.ts",
    "src/app/api/transcribe-fast/route.ts",
    "src/app/api/voice-pipeline/route.ts",
    "src/lib/openai/client.ts",
    "src/lib/performance/PerformanceMonitor.ts",
    "src/lib/performance/OptimizationTracker.ts",
  ];

  files.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    const status = fs.existsSync(fullPath) ? "✅" : "❌";
    const name = path.basename(file, path.extname(file));
    console.log(`  ${status} ${name}`);
  });
};

// Check configuration
const checkConfig = () => {
  console.log("\n⚙️ Configuration Status:");

  // Check Tailwind config
  const tailwindPath = path.join(process.cwd(), "tailwind.config.ts");
  if (fs.existsSync(tailwindPath)) {
    const content = fs.readFileSync(tailwindPath, "utf8");
    const hasSafelist = content.includes("safelist");
    console.log(`  ${hasSafelist ? "✅" : "❌"} Tailwind CSS Purging`);
  }

  // Check Next.js config
  const nextConfigPath = path.join(process.cwd(), "next.config.js");
  if (fs.existsSync(nextConfigPath)) {
    const content = fs.readFileSync(nextConfigPath, "utf8");
    const hasBundleAnalyzer = content.includes("withBundleAnalyzer");
    const hasOptimization = content.includes("splitChunks");
    console.log(`  ${hasBundleAnalyzer ? "✅" : "❌"} Bundle Analyzer`);
    console.log(`  ${hasOptimization ? "✅" : "❌"} Webpack Optimization`);
  }
};

// Performance targets
const showTargets = () => {
  console.log("\n🎯 Performance Targets:");
  console.log("  • First AI Response: ≤1000ms (warmup system)");
  console.log("  • Voice Processing: ≤2000ms (50-60% improvement)");
  console.log("  • CSS Bundle Size: ≤40KB (20% reduction)");
  console.log("  • TTS Cache Hit Rate: ≥80% (service worker)");
  console.log("  • Core Web Vitals - LCP: ≤2500ms");
  console.log("  • Bundle Load Time: ≤500ms");
};

// Console commands help
const showCommands = () => {
  console.log("\n🔧 Testing Commands:");
  console.log("  • npm run dev - Start optimized dev server");
  console.log("  • npm run build:analyze - Generate bundle analysis");
  console.log("  • npm run perf:audit - Performance audit build");
  console.log("  • In browser console: getOptimizationReport()");
  console.log("  • In app: Press Ctrl+Shift+P for live performance report");
};

// Run all checks
const main = () => {
  checkBundleSizes();
  checkServiceWorker();
  checkOptimizationFiles();
  checkConfig();
  showTargets();
  showCommands();

  console.log('\n🚀 Ready to test optimizations! Start with "npm run dev"');
};

if (require.main === module) {
  main();
}

module.exports = {
  checkBundleSizes,
  checkServiceWorker,
  checkOptimizationFiles,
};
