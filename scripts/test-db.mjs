import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { evaluateTap } from './tap.mjs'

function envFromFile() {
  const out = {}
  if (!existsSync('.env.local')) return out
  for (const l of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const file = envFromFile()
const get = (k) => process.env[k] || file[k]

function connectionString() {
  const direct = get('SUPABASE_DB_URL')
  if (direct) return direct
  const password = get('SUPABASE_DB_PASSWORD')
  if (!password) throw new Error('SUPABASE_DB_URL or SUPABASE_DB_PASSWORD is required')
  const u = new URL(readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
  u.password = password
  return u.toString()
}

const secrets = []
const redact = (s) => secrets.reduce((acc, x) => (x ? acc.split(x).join('***') : acc), String(s))

const dir = 'supabase/tests'
const files = readdirSync(dir).filter((f) => f.endsWith('.test.sql')).sort()
if (files.length === 0) {
  console.error('No test files found')
  process.exit(1)
}

let bad = false
let client
try {
  const cs = connectionString()
  secrets.push(cs, get('SUPABASE_DB_PASSWORD'), get('SUPABASE_DB_URL'))
  try { secrets.push(new URL(cs).password, decodeURIComponent(new URL(cs).password)) } catch {}
  client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } })
  await client.connect()
  let total = 0
  for (const f of files) {
    console.log(`# ${f}`)
    try {
      const res = await client.query(readFileSync(join(dir, f), 'utf8'))
      const results = Array.isArray(res) ? res : [res]
      const lines = results.flatMap((r) => r.rows.map((row) => String(Object.values(row)[0])))
      lines.forEach((l) => console.log(l))
      const { passed, failed, planOk } = evaluateTap(lines)
      total += passed
      if (failed > 0 || !planOk) {
        bad = true
        console.error(`FAIL ${f}: passed=${passed} failed=${failed} planOk=${planOk}`)
      }
    } catch (e) {
      bad = true
      console.error(`FAIL ${f}: ${redact(e.message)}`)
      try { await client.query('rollback') } catch {}
    }
  }
  console.log(bad ? 'DB tests FAILED' : `DB tests passed: ${total} assertions in ${files.length} file(s)`)
} catch (e) {
  bad = true
  console.error(`test:db error: ${redact(e.message)}`)
} finally {
  if (client) await client.end().catch(() => {})
}
process.exit(bad ? 1 : 0)
