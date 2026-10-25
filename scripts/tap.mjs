// Pure TAP evaluation: no I/O.
export function evaluateTap(lines) {
  let passed = 0
  let failed = 0
  let plan = null
  for (const raw of lines) {
    const line = String(raw).trim()
    const planMatch = /^1\.\.(\d+)$/.exec(line)
    if (planMatch) {
      plan = Number(planMatch[1])
    } else if (/^not ok\b/.test(line)) {
      failed++
    } else if (/^ok\b/.test(line)) {
      passed++
    }
  }
  const planOk = plan !== null && plan === passed + failed
  return { passed, failed, planOk }
}
