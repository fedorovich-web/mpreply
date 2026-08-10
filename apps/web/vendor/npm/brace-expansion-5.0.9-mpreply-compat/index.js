'use strict'

const balancedModule = require('balanced-match')
const balanced = balancedModule.balanced || balancedModule

const escSlash = '\0SLASH' + Math.random() + '\0'
const escOpen = '\0OPEN' + Math.random() + '\0'
const escClose = '\0CLOSE' + Math.random() + '\0'
const escComma = '\0COMMA' + Math.random() + '\0'
const escPeriod = '\0PERIOD' + Math.random() + '\0'
const escSlashPattern = new RegExp(escSlash, 'g')
const escOpenPattern = new RegExp(escOpen, 'g')
const escClosePattern = new RegExp(escClose, 'g')
const escCommaPattern = new RegExp(escComma, 'g')
const escPeriodPattern = new RegExp(escPeriod, 'g')
const slashPattern = /\\\\/g
const openPattern = /\\{/g
const closePattern = /\\}/g
const commaPattern = /\\,/g
const periodPattern = /\\\./g

const EXPANSION_MAX = 100_000
const EXPANSION_MAX_LENGTH = 4_000_000

function numeric(str) {
  return !Number.isNaN(Number(str)) ? parseInt(str, 10) : str.charCodeAt(0)
}

function escapeBraces(str) {
  return str
    .replace(slashPattern, escSlash)
    .replace(openPattern, escOpen)
    .replace(closePattern, escClose)
    .replace(commaPattern, escComma)
    .replace(periodPattern, escPeriod)
}

function unescapeBraces(str) {
  return str
    .replace(escSlashPattern, '\\')
    .replace(escOpenPattern, '{')
    .replace(escClosePattern, '}')
    .replace(escCommaPattern, ',')
    .replace(escPeriodPattern, '.')
}

function parseCommaParts(str) {
  if (!str) return ['']

  const parts = []
  const match = balanced('{', '}', str)
  if (!match) return str.split(',')

  const pre = match.pre
  const body = match.body
  const post = match.post
  const split = pre.split(',')

  split[split.length - 1] += '{' + body + '}'
  const postParts = parseCommaParts(post)
  if (post.length) {
    split[split.length - 1] += postParts.shift()
    split.push.apply(split, postParts)
  }

  parts.push.apply(parts, split)
  return parts
}

function expand(pattern, options) {
  if (!pattern) return []

  const normalizedOptions = options || {}
  const max = normalizedOptions.max == null ? EXPANSION_MAX : normalizedOptions.max
  const maxLength = normalizedOptions.maxLength == null
    ? EXPANSION_MAX_LENGTH
    : normalizedOptions.maxLength

  let str = pattern
  if (str.slice(0, 2) === '{}') {
    str = '\\{\\}' + str.slice(2)
  }

  return expandInternal(escapeBraces(str), max, maxLength, true).map(unescapeBraces)
}

function embrace(str) {
  return '{' + str + '}'
}

function isPadded(value) {
  return /^-?0\d/.test(value)
}

function lte(left, right) {
  return left <= right
}

function gte(left, right) {
  return left >= right
}

function combine(acc, pre, values, max, maxLength, dropEmpties) {
  const output = []
  let outputLength = 0

  for (let accIndex = 0; accIndex < acc.length; accIndex += 1) {
    for (let valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
      if (output.length >= max) return output

      const expansion = acc[accIndex] + pre + values[valueIndex]
      if (dropEmpties && !expansion) continue
      if (outputLength + expansion.length > maxLength) return output

      output.push(expansion)
      outputLength += expansion.length
    }
  }

  return output
}

function expandSequence(body, isAlphaSequence, max, maxLength) {
  const parts = body.split(/\.\./)
  const output = []
  if (parts[0] === undefined || parts[1] === undefined) return output

  const start = numeric(parts[0])
  const end = numeric(parts[1])
  const width = Math.max(parts[0].length, parts[1].length)
  let increment = parts.length === 3 && parts[2] !== undefined
    ? Math.max(Math.abs(numeric(parts[2])), 1)
    : 1
  let compare = lte

  if (end < start) {
    increment *= -1
    compare = gte
  }

  const padded = parts.some(isPadded)
  let outputLength = 0

  for (let current = start; compare(current, end) && output.length < max; current += increment) {
    let value
    if (isAlphaSequence) {
      value = String.fromCharCode(current)
      if (value === '\\') value = ''
    } else {
      value = String(current)
      if (padded) {
        const required = width - value.length
        if (required > 0) {
          const zeros = new Array(required + 1).join('0')
          value = current < 0 ? '-' + zeros + value.slice(1) : zeros + value
        }
      }
    }

    if (outputLength + value.length > maxLength) break
    output.push(value)
    outputLength += value.length
  }

  return output
}

function expandInternal(input, max, maxLength, isTop) {
  let str = input
  let acc = ['']
  let dropEmpties = false
  let firstGroup = true

  for (;;) {
    const match = balanced('{', '}', str)
    if (!match) {
      return combine(acc, str, [''], max, maxLength, dropEmpties)
    }

    const pre = match.pre
    if (/\$$/.test(pre)) {
      acc = combine(
        acc,
        pre + '{' + match.body + '}',
        [''],
        max,
        maxLength,
        dropEmpties && !match.post.length,
      )
      firstGroup = false
      if (!match.post.length) break
      str = match.post
      continue
    }

    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(match.body)
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(match.body)
    const isSequence = isNumericSequence || isAlphaSequence
    const isOptions = match.body.indexOf(',') >= 0

    if (!isSequence && !isOptions) {
      if (match.post.match(/,(?!,).*\}/)) {
        str = match.pre + '{' + match.body + escClose + match.post
        isTop = true
        continue
      }

      return combine(
        acc,
        pre + '{' + match.body + '}' + match.post,
        [''],
        max,
        maxLength,
        dropEmpties,
      )
    }

    if (firstGroup) {
      dropEmpties = isTop && !isSequence
      firstGroup = false
    }

    let values
    if (isSequence) {
      values = expandSequence(match.body, isAlphaSequence, max, maxLength)
    } else {
      let commaParts = parseCommaParts(match.body)
      if (commaParts.length === 1 && commaParts[0] !== undefined) {
        commaParts = expandInternal(commaParts[0], max, maxLength, false).map(embrace)
        if (commaParts.length === 1) {
          acc = combine(
            acc,
            pre + commaParts[0],
            [''],
            max,
            maxLength,
            dropEmpties && !match.post.length,
          )
          if (!match.post.length) break
          str = match.post
          continue
        }
      }

      let dropsEmpties = dropEmpties && !match.post.length && !pre
      for (let index = 0; dropsEmpties && index < acc.length; index += 1) {
        if (acc[index]) dropsEmpties = false
      }

      values = []
      let valuesLength = 0
      alternatives: for (let partIndex = 0; partIndex < commaParts.length; partIndex += 1) {
        const expanded = expandInternal(commaParts[partIndex], max, maxLength, false)
        for (let valueIndex = 0; valueIndex < expanded.length; valueIndex += 1) {
          const value = expanded[valueIndex]
          if (dropsEmpties && !value) continue
          if (values.length >= max || valuesLength + value.length > maxLength) {
            break alternatives
          }
          values.push(value)
          valuesLength += value.length
        }
      }
    }

    acc = combine(
      acc,
      pre,
      values,
      max,
      maxLength,
      dropEmpties && !match.post.length,
    )
    if (!match.post.length) break
    str = match.post
  }

  return acc
}

module.exports = expand
module.exports.default = expand
module.exports.expand = expand
module.exports.EXPANSION_MAX = EXPANSION_MAX
module.exports.EXPANSION_MAX_LENGTH = EXPANSION_MAX_LENGTH
