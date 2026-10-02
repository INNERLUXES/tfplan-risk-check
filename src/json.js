// A strict JSON reader of our own, for the plan file. It reads the grammar of RFC 8259 and nothing else: no comments, no
// trailing commas, no single quotes, no NaN or Infinity, no raw control character in a string. Beyond what JSON.parse
// refuses it also refuses a key that appears twice in one object (two readers could take different values from such a
// file) and enforces limits: nesting depth, number of values, length of a string, of a key and of a number. Objects are
// made without a prototype, so a key such as "__proto__" is only data. The read is linear: each character is looked at a
// bounded number of times, and recursion never goes deeper than the depth limit.

import { PLAN_LIMITS } from './data.js';

export class JsonError extends Error {
  constructor(message, offset) {
    super(message);
    this.name = 'JsonError';
    this.offset = offset;
  }
}

// 1-based line and column of an offset in the text.
export function position(text, offset) {
  let line = 1;
  let column = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      line += 1;
      column = 1;
    } else column += 1;
  }
  return { line, column };
}

const WS = (c) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
const DIGIT = (c) => c >= 0x30 && c <= 0x39;
const HEX = (c) => DIGIT(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);
const STRING_STOP = /["\\\u0000-\u001f]/g;

const ESCAPES = { 0x22: '"', 0x5c: '\\', 0x2f: '/', 0x62: '\b', 0x66: '\f', 0x6e: '\n', 0x72: '\r', 0x74: '\t' };

export function parseStrictJson(text, limits = PLAN_LIMITS) {
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let nodes = 0;

  const fail = (message, at = i) => {
    throw new JsonError(message, at);
  };
  const skip = () => {
    while (i < text.length && WS(text.charCodeAt(i))) i += 1;
  };
  const count = () => {
    nodes += 1;
    if (nodes > limits.maxNodes) fail(`more than ${limits.maxNodes.toLocaleString('en-US')} values`);
  };

  function readString(maxChars) {
    const start = i;
    i += 1;
    let out = '';
    let from = i;
    for (;;) {
      STRING_STOP.lastIndex = i;
      const m = STRING_STOP.exec(text);
      if (m === null) fail('a string is not closed', start);
      const at = m.index;
      const c = text.charCodeAt(at);
      if (c === 0x22) {
        out += text.slice(from, at);
        i = at + 1;
        if (out.length > maxChars) fail(`a string is longer than ${maxChars.toLocaleString('en-US')} characters`, start);
        return out;
      }
      if (c < 0x20) fail('a raw control character in a string; it must be written as an escape', at);
      out += text.slice(from, at);
      const e = text.charCodeAt(at + 1);
      if (e === 0x75) {
        for (let k = 2; k <= 5; k += 1) if (!HEX(text.charCodeAt(at + k))) fail('a \\u escape needs four hex digits', at);
        out += String.fromCharCode(parseInt(text.slice(at + 2, at + 6), 16));
        i = at + 6;
      } else if (Object.hasOwn(ESCAPES, e)) {
        out += ESCAPES[e];
        i = at + 2;
      } else fail('an unknown escape in a string', at);
      from = i;
      if (out.length > maxChars) fail(`a string is longer than ${maxChars.toLocaleString('en-US')} characters`, start);
    }
  }

  function readNumber() {
    const start = i;
    if (text.charCodeAt(i) === 0x2d) i += 1;
    if (text.charCodeAt(i) === 0x30) i += 1;
    else if (DIGIT(text.charCodeAt(i))) while (DIGIT(text.charCodeAt(i))) i += 1;
    else fail('a number is not written as JSON writes it');
    if (text.charCodeAt(i) === 0x2e) {
      i += 1;
      if (!DIGIT(text.charCodeAt(i))) fail('a number needs a digit after the point');
      while (DIGIT(text.charCodeAt(i))) i += 1;
    }
    const e = text.charCodeAt(i);
    if (e === 0x65 || e === 0x45) {
      i += 1;
      const sign = text.charCodeAt(i);
      if (sign === 0x2b || sign === 0x2d) i += 1;
      if (!DIGIT(text.charCodeAt(i))) fail('a number needs a digit in its exponent');
      while (DIGIT(text.charCodeAt(i))) i += 1;
    }
    if (i - start > limits.maxNumberChars) fail(`a number is longer than ${limits.maxNumberChars} characters`, start);
    const value = Number(text.slice(start, i));
    if (!Number.isFinite(value)) fail('a number is out of range', start);
    return value;
  }

  function readValue(depth) {
    if (depth > limits.maxDepth) fail(`nesting is deeper than ${limits.maxDepth} levels`);
    count();
    const c = text.charCodeAt(i);
    if (c === 0x7b) {
      i += 1;
      const obj = Object.create(null);
      skip();
      if (text.charCodeAt(i) === 0x7d) {
        i += 1;
        return obj;
      }
      for (;;) {
        skip();
        if (text.charCodeAt(i) !== 0x22) fail('an object key must be a string in double quotes');
        const keyAt = i;
        const key = readString(limits.maxKeyChars);
        if (key in obj) fail(`the key "${key.length > 60 ? `${key.slice(0, 57)}...` : key}" appears twice in one object`, keyAt);
        skip();
        if (text.charCodeAt(i) !== 0x3a) fail('a colon is missing after an object key');
        i += 1;
        skip();
        obj[key] = readValue(depth + 1);
        skip();
        const d = text.charCodeAt(i);
        if (d === 0x2c) {
          i += 1;
          continue;
        }
        if (d === 0x7d) {
          i += 1;
          return obj;
        }
        fail('a comma or a closing brace is missing');
      }
    }
    if (c === 0x5b) {
      i += 1;
      const arr = [];
      skip();
      if (text.charCodeAt(i) === 0x5d) {
        i += 1;
        return arr;
      }
      for (;;) {
        skip();
        arr.push(readValue(depth + 1));
        skip();
        const d = text.charCodeAt(i);
        if (d === 0x2c) {
          i += 1;
          continue;
        }
        if (d === 0x5d) {
          i += 1;
          return arr;
        }
        fail('a comma or a closing bracket is missing');
      }
    }
    if (c === 0x22) return readString(limits.maxStringChars);
    if (c === 0x2d || DIGIT(c)) return readNumber();
    if (text.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (text.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (text.startsWith('null', i)) {
      i += 4;
      return null;
    }
    if (i >= text.length) fail('the text ends where a value is expected');
    fail('a value is expected here');
  }

  skip();
  if (i >= text.length) fail('the file is empty');
  const value = readValue(0);
  skip();
  if (i < text.length) fail('text after the end of the JSON value');
  return value;
}
