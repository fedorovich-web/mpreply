'use strict';

const balanced = require('balanced-match');

const escSlash = '\0SLASH' + Math.random() + '\0';
const escOpen = '\0OPEN' + Math.random() + '\0';
const escClose = '\0CLOSE' + Math.random() + '\0';
const escComma = '\0COMMA' + Math.random() + '\0';
const escPeriod = '\0PERIOD' + Math.random() + '\0';

const EXPANSION_MAX = 100_000;
const EXPANSION_MAX_LENGTH = 4_000_000;

function numeric(value) {
  return !Number.isNaN(Number(value))
    ? Number.parseInt(value, 10)
    : value.charCodeAt(0);
}

function escapeBraces(value) {
  return value
    .split('\\\\').join(escSlash)
    .split('\\{').join(escOpen)
    .split('\\}').join(escClose)
    .split('\\,').join(escComma)
    .split('\\.').join(escPeriod);
}

function unescapeBraces(value) {
  return value
    .split(escSlash).join('\\')
    .split(escOpen).join('{')
    .split(escClose).join('}')
    .split(escComma).join(',')
    .split(escPeriod).join('.');
}

function parseCommaParts(value) {
  if (!value) return [''];

  const match = balanced('{', '}', value);
  if (!match) return value.split(',');

  const parts = [];
  const split = match.pre.split(',');
  split[split.length - 1] += '{' + match.body + '}';
  const postParts = parseCommaParts(match.post);
  if (match.post.length) {
    split[split.length - 1] += postParts.shift();
    split.push(...postParts);
  }
  parts.push(...split);
  return parts;
}

function embrace(value) {
  return '{' + value + '}';
}

function isPadded(value) {
  return /^-?0\d/.test(value);
}

function combine(accumulator, prefix, values, max, maxLength, dropEmpties) {
  const output = [];
  let aggregateLength = 0;

  for (const accumulated of accumulator) {
    for (const value of values) {
      if (output.length >= max) return output;
      const expansion = accumulated + prefix + value;
      if (dropEmpties && !expansion) continue;
      if (aggregateLength + expansion.length > maxLength) return output;
      output.push(expansion);
      aggregateLength += expansion.length;
    }
  }
  return output;
}

function expandSequence(body, alphaSequence, max) {
  const parts = body.split(/\.\./);
  const output = [];
  if (parts[0] === undefined || parts[1] === undefined) return output;

  const start = numeric(parts[0]);
  const end = numeric(parts[1]);
  const width = Math.max(parts[0].length, parts[1].length);
  let increment = parts.length === 3 && parts[2] !== undefined
    ? Math.max(Math.abs(numeric(parts[2])), 1)
    : 1;
  const reverse = end < start;
  if (reverse) increment *= -1;
  const test = reverse
    ? (current, target) => current >= target
    : (current, target) => current <= target;
  const padded = parts.some(isPadded);

  for (let current = start; test(current, end) && output.length < max; current += increment) {
    let rendered;
    if (alphaSequence) {
      rendered = String.fromCharCode(current);
      if (rendered === '\\') rendered = '';
    } else {
      rendered = String(current);
      if (padded) {
        const required = width - rendered.length;
        if (required > 0) {
          const zeros = '0'.repeat(required);
          rendered = current < 0
            ? '-' + zeros + rendered.slice(1)
            : zeros + rendered;
        }
      }
    }
    output.push(rendered);
  }
  return output;
}

function expandInternal(value, max, maxLength, topLevel) {
  let accumulator = [''];
  let dropEmpties = false;
  let firstGroup = true;

  for (;;) {
    const match = balanced('{', '}', value);
    if (!match) {
      return combine(accumulator, value, [''], max, maxLength, dropEmpties);
    }

    const prefix = match.pre;
    if (/\$$/.test(prefix)) {
      accumulator = combine(
        accumulator,
        prefix + '{' + match.body + '}',
        [''],
        max,
        maxLength,
        dropEmpties && !match.post.length,
      );
      firstGroup = false;
      if (!match.post.length) break;
      value = match.post;
      continue;
    }

    const numericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(match.body);
    const alphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(match.body);
    const sequence = numericSequence || alphaSequence;
    const options = match.body.includes(',');

    if (!sequence && !options) {
      if (/,(?!,).*\}/.test(match.post)) {
        value = match.pre + '{' + match.body + escClose + match.post;
        topLevel = true;
        continue;
      }
      return combine(
        accumulator,
        prefix + '{' + match.body + '}' + match.post,
        [''],
        max,
        maxLength,
        dropEmpties,
      );
    }

    if (firstGroup) {
      dropEmpties = topLevel && !sequence;
      firstGroup = false;
    }

    let values;
    if (sequence) {
      values = expandSequence(match.body, alphaSequence, max);
    } else {
      let parts = parseCommaParts(match.body);
      if (parts.length === 1 && parts[0] !== undefined) {
        parts = expandInternal(parts[0], max, maxLength, false).map(embrace);
        if (parts.length === 1) {
          accumulator = combine(
            accumulator,
            prefix + parts[0],
            [''],
            max,
            maxLength,
            dropEmpties && !match.post.length,
          );
          if (!match.post.length) break;
          value = match.post;
          continue;
        }
      }

      values = [];
      for (const part of parts) {
        values.push(...expandInternal(part, max, maxLength, false));
      }
    }

    accumulator = combine(
      accumulator,
      prefix,
      values,
      max,
      maxLength,
      dropEmpties && !match.post.length,
    );
    if (!match.post.length) break;
    value = match.post;
  }

  return accumulator;
}

function expand(value, options = {}) {
  if (!value) return [];

  const max = options.max == null ? EXPANSION_MAX : options.max;
  const maxLength = options.maxLength == null
    ? EXPANSION_MAX_LENGTH
    : options.maxLength;
  let input = String(value);
  if (input.slice(0, 2) === '{}') input = '\\{\\}' + input.slice(2);

  return expandInternal(
    escapeBraces(input),
    max,
    maxLength,
    true,
  ).map(unescapeBraces);
}

module.exports = expand;
module.exports.expand = expand;
module.exports.default = expand;
module.exports.EXPANSION_MAX = EXPANSION_MAX;
module.exports.EXPANSION_MAX_LENGTH = EXPANSION_MAX_LENGTH;
