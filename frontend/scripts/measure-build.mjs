import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, '../dist')
let manifest
try { manifest = JSON.parse(readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8')) } catch { /* baseline build has one entry and no manifest */ }
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const initial = new Set()
const css = new Set()
if (manifest) {
  const visit = (key) => {
    const item = manifest[key]
    if (!item || initial.has(item.file)) return
    initial.add(item.file)
    for (const file of item.css ?? []) css.add(file)
    for (const imported of item.imports ?? []) visit(imported)
  }
  for (const [key, item] of Object.entries(manifest)) if (item.isEntry) visit(key)
} else {
  for (const match of html.matchAll(/<script[^>]+src="\/?([^"]+)"/g)) initial.add(match[1])
  for (const match of html.matchAll(/<link[^>]+href="\/?([^"]+\.css)"/g)) css.add(match[1])
}
const measure = (files) => {
  const details = [...files].map((file) => {
    const data = readFileSync(path.join(dist, file))
    return { file, bytes: data.length, gzip_bytes: gzipSync(data).length }
  })
  return { files: details, bytes: details.reduce((n, f) => n + f.bytes, 0), gzip_bytes: details.reduce((n, f) => n + f.gzip_bytes, 0) }
}
const all = readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`)
process.stdout.write(`${JSON.stringify({ initial_js: measure(initial), initial_css: measure(css), all_js: measure(all) }, null, 2)}\n`)
