// Section numbers are 1-99, optionally followed by a single trailing letter (e.g. "12", "99A", "99B").
export const SECTION_NUMBER_REGEX = /^([1-9]|[1-9][0-9])[A-Za-z]?$/

// Trim + uppercase so "99a" and "99A" are treated the same everywhere.
export function normalizeSectionNumber(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function isValidSectionNumber(value) {
  return SECTION_NUMBER_REGEX.test(normalizeSectionNumber(value))
}

// Split a section number into its numeric part and (optional) letter for ordering.
function sectionNumberParts(value) {
  const match = normalizeSectionNumber(value).match(/^(\d+)([A-Z]?)$/)
  if (!match) return { num: Number.POSITIVE_INFINITY, letter: '' }
  return { num: parseInt(match[1], 10), letter: match[2] || '' }
}

// Comparator: order by numeric part first, then by letter (e.g. 99 < 99A < 99B < 100).
export function compareSectionNumbers(a, b) {
  const pa = sectionNumberParts(a)
  const pb = sectionNumberParts(b)
  if (pa.num !== pb.num) return pa.num - pb.num
  return pa.letter.localeCompare(pb.letter)
}

// Parse user input into a list of normalized section numbers.
// Supports a single value ("12"), a single value with a letter ("99A"),
// or a numeric range ("20-30"). Returns null if the input is invalid.
export function parseSectionNumberInput(input) {
  const value = normalizeSectionNumber(input)

  if (SECTION_NUMBER_REGEX.test(value)) {
    return [value]
  }

  const rangeMatch = value.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10)
    const end = parseInt(rangeMatch[2], 10)
    if (start < 1 || end > 99 || start > end) return null
    return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
  }

  return null
}
