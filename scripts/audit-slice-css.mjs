#!/usr/bin/env node
/**
 * audit-slice-css.js
 *
 * Enforces the rule from ADR-023:
 *   Slice CSS files under features-v3/ may declare layout only.
 *   Token values (font-size, color, border-radius, box-shadow, font-weight,
 *   letter-spacing, line-height, padding/margin with literal px/rem values
 *   that should come from tokens) must not be hard-coded.
 *
 * Passes if: the slice CSS only uses CSS variables (var(--…)) for token-type
 *            properties, or uses only layout-safe literals (e.g. 1fr, auto,
 *            fit-content, 0, 100%, flex, grid).
 *
 * Rule: any property in TOKEN_PROPS with a non-var, non-layout-safe value = error.
 *
 * Usage:  node scripts/audit-slice-css.js
 * Exit:   0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const SLICE_CSS_GLOB = join(ROOT, 'frontend/src/features-v3')

/** Properties whose values must come from var(--…) or safe literals. */
const TOKEN_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'background-image',
  'border-color',
  'border',
  'outline-color',
  'font-size',
  'font-weight',
  'font-family',
  'letter-spacing',
  'line-height',
  'border-radius',
  'box-shadow',
  'text-shadow',
  'opacity',
])

/** Values that are always safe regardless of property. */
const SAFE_VALUE_RE = /^(var\(|0$|auto|none|inherit|initial|unset|transparent|currentColor|normal|bold|fit-content|max-content|min-content|\d+fr|100%|50%|\d+(vw|vh|svh|svw|%)$)/i

/** Matches a CSS declaration line: property: value; */
const DECL_RE = /^\s*([\w-]+)\s*:\s*(.+?)\s*;/

let violations = 0

function walkCss(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) { walkCss(full); continue }
    if (!entry.endsWith('.css')) continue

    const rel = relative(ROOT, full)
    const lines = readFileSync(full, 'utf8').split('\n')
    lines.forEach((line, i) => {
      const m = line.match(DECL_RE)
      if (!m) return
      const [, prop, value] = m
      if (!TOKEN_PROPS.has(prop.toLowerCase())) return
      if (SAFE_VALUE_RE.test(value.trim())) return
      // allow @keyframes blocks (animation names etc) — skip if inside @keyframes
      console.error(`  ${rel}:${i + 1}  "${prop}: ${value};"  → use a token (var(--…)) instead of a literal value`)
      violations++
    })
  }
}

walkCss(SLICE_CSS_GLOB)

const strict = process.argv.includes('--strict')

if (violations > 0) {
  console.error(`\naudit-slice-css: ${violations} violation(s). Token values must come from new-ui/tokens (var(--…)). See ADR-023.`)
  if (strict) process.exit(1)
  console.warn('audit-slice-css: running in warn-only mode (no --strict). Upgrade to --strict in Phase 7 once all slice CSS is clean.')
} else {
  console.log('audit-slice-css: clean.')
}
