// Runs the baseline vitest and generates a markdown table of render metrics
import { spawn } from 'node:child_process'
import { platform, exit } from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(frontendDir, '..')
const perfDir = path.resolve(repoRoot, 'docs', 'perf')
const jsonPath = path.resolve(perfDir, 'metrics-baseline.json')
const mdPath = path.resolve(perfDir, 'metrics-baseline.md')

const runVitest = () =>
  new Promise((resolve, reject) => {
    const child = spawn('npx', ['vitest', 'run', 'src/shared/utils/renderMetrics.baseline.test.tsx', '--silent'], {
      cwd: frontendDir,
      stdio: 'inherit',
      shell: platform === 'win32',
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`vitest exited with code ${code}`))
    })
  })

const formatNum = (n) => Number(n.toFixed(2))

const toMarkdown = (snapshot) => {
  const rows = Object.entries(snapshot).map(([id, m]) => ({
    id,
    commits: m.commits,
    totalActual: formatNum(m.totalActual),
    avgActual: formatNum(m.totalActual / Math.max(1, m.commits)),
    maxActual: formatNum(m.maxActual),
    totalBase: formatNum(m.totalBase),
    avgBase: formatNum(m.totalBase / Math.max(1, m.commits)),
    maxBase: formatNum(m.maxBase),
  }))

  rows.sort((a, b) => b.totalActual - a.totalActual)

  const header = '| Component | Commits | Total Actual | Avg Actual | Max Actual | Total Base | Avg Base | Max Base |\n'
  const sep = '|---|---:|---:|---:|---:|---:|---:|---:|\n'
  const body = rows
    .map(
      (r) =>
        `| ${r.id} | ${r.commits} | ${r.totalActual} | ${r.avgActual} | ${r.maxActual} | ${r.totalBase} | ${r.avgBase} | ${r.maxBase} |`
    )
    .join('\n')

  const date = new Date().toISOString()
  return `# Render Metrics Baseline\n\nGenerated: ${date}\n\n${header}${sep}${body}\n`
}

async function main() {
  // Ensure perf dir exists
  fs.mkdirSync(perfDir, { recursive: true })

  await runVitest()

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Baseline JSON not found at ${jsonPath}`)
  }

  const snapshot = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  const md = toMarkdown(snapshot)
  fs.writeFileSync(mdPath, md, 'utf-8')
  console.log(`[perf] Baseline updated: ${mdPath}`)
}

main().catch((err) => {
  console.error('[perf] Baseline generation failed:', err)
  exit(1)
})
