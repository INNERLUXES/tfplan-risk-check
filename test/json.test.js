import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonError, PLAN_LIMITS, parseStrictJson, position } from '../src/index.js';

const fails = (text, pattern, limits) => assert.throws(() => parseStrictJson(text, limits), (e) => e instanceof JsonError && pattern.test(e.message), `${text.slice(0, 40)} -> ${pattern}`);

test('json: reads the values of the grammar and gives the same result as JSON.parse', () => {
  const text = '{"a":[1,-2.5,3e2,true,false,null,"x\\n\\u00e9\\"\\\\\\/"],"b":{"c":{}},"d":[],"e":0,"f":-0.5E-2}';
  assert.deepEqual(JSON.parse(JSON.stringify(parseStrictJson(text))), JSON.parse(text));
  assert.equal(parseStrictJson('  \n\t 7 \r\n'), 7);
  assert.equal(parseStrictJson('"a b"'), 'a b');
  assert.equal(parseStrictJson('null'), null);
});

test('json: a byte order mark at the start is ignored', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(parseStrictJson(`${String.fromCharCode(0xfeff)}{"a":1}`))), { a: 1 });
});

test('json: objects have no prototype, so a key such as __proto__ is only data and nothing is polluted', () => {
  const value = parseStrictJson('{"__proto__":{"polluted":true},"constructor":1}');
  assert.equal(Object.getPrototypeOf(value), null);
  assert.equal(Object.hasOwn(value, '__proto__'), true);
  assert.equal(value.constructor, 1);
  assert.equal({}.polluted, undefined);
});

test('json: a key that appears twice in one object is refused, and the same key in two objects is fine', () => {
  fails('{"a":1,"a":2}', /appears twice/);
  fails('{"a":{"b":1,"b":2}}', /appears twice/);
  assert.deepEqual(JSON.parse(JSON.stringify(parseStrictJson('{"a":{"x":1},"b":{"x":2}}'))), { a: { x: 1 }, b: { x: 2 } });
});

test('json: what JSON does not allow is refused: comments, trailing commas, single quotes, NaN, Infinity, hex, leading zeros', () => {
  fails('{"a":1,}', /object key/);
  fails('[1,2,]', /value is expected/);
  fails('{"a":1} // note', /after the end/);
  fails("{'a':1}", /object key/);
  fails('NaN', /value is expected/);
  fails('[Infinity]', /value is expected/);
  fails('0x10', /after the end/);
  fails('[01]', /comma or a closing bracket/);
  fails('-', /number/);
  fails('1.', /digit after the point/);
  fails('1e', /digit in its exponent/);
  fails('{"a" 1}', /colon/);
  fails('{"a":1 "b":2}', /comma or a closing brace/);
});

test('json: a number out of range or longer than the limit is refused', () => {
  fails('1e999', /out of range/);
  fails(`[${'9'.repeat(100)}]`, /longer than 64 characters/);
});

test('json: strings: raw control characters, unknown escapes, short unicode escapes and unclosed strings are refused', () => {
  fails('"a\nb"', /raw control character/);
  fails('"a\tb"', /raw control character/);
  fails('"\\x41"', /unknown escape/);
  fails('"\\u12G4"', /four hex digits/);
  fails('"\\u12"', /four hex digits/);
  fails('"never closed', /not closed/);
  fails('"ends with a backslash\\', /unknown escape|not closed/);
});

test('json: a surrogate pair written as two escapes gives the character, and a lone surrogate is kept as it is', () => {
  assert.equal(parseStrictJson('"\\ud83d\\ude00"'), '\u{1f600}');
  assert.equal(parseStrictJson('"\\ud800"').length, 1);
});

test('json: an empty text, a text of white space and text after the value are refused', () => {
  fails('', /empty/);
  fails('   \n ', /empty/);
  fails('{} {}', /after the end/);
  fails('[', /ends where a value is expected/);
  fails('{"a":', /ends where a value is expected/);
});

test('json: nesting deeper than the limit is refused with an error, and the limit itself is read', () => {
  const nest = (n) => '['.repeat(n) + ']'.repeat(n);
  assert.doesNotThrow(() => parseStrictJson(nest(PLAN_LIMITS.maxDepth + 1)));
  fails(nest(PLAN_LIMITS.maxDepth + 2), /deeper than 100 levels/);
  const objects = (n) => '{"a":'.repeat(n) + '1' + '}'.repeat(n);
  assert.doesNotThrow(() => parseStrictJson(objects(PLAN_LIMITS.maxDepth)));
  fails(objects(PLAN_LIMITS.maxDepth + 1), /deeper than 100 levels/);
});

test('json: a million opening brackets end with the depth error and never with a stack overflow', () => {
  fails('['.repeat(1000000), /deeper than 100 levels/);
  fails('{"a":'.repeat(500000), /deeper than 100 levels/);
});

test('json: a string longer than the limit, and a key longer than the limit, are refused', () => {
  fails(`"${'a'.repeat(PLAN_LIMITS.maxStringChars + 1)}"`, /longer than 1,048,576 characters/);
  assert.equal(parseStrictJson(`"${'a'.repeat(PLAN_LIMITS.maxStringChars)}"`).length, PLAN_LIMITS.maxStringChars);
  fails(`{"${'k'.repeat(PLAN_LIMITS.maxKeyChars + 1)}":1}`, /longer than 1,024 characters/);
  fails(`"${'\\n'.repeat(PLAN_LIMITS.maxStringChars + 1)}"`, /longer than 1,048,576 characters/);
});

test('json: more values than the limit are refused', () => {
  const small = { ...PLAN_LIMITS, maxNodes: 10 };
  assert.doesNotThrow(() => parseStrictJson('[1,2,3,4,5,6,7,8,9]', small));
  fails('[1,2,3,4,5,6,7,8,9,10,11]', /more than 10 values/, small);
});

test('json: a megabyte of hostile shapes is read or refused in well under a second each', () => {
  const shapes = {
    zeros: `[${'0,'.repeat(500000)}0]`,
    quotes: `"${'\\"'.repeat(500000)}"`,
    unclosed: `{"a":"${'x'.repeat(2000000)}`,
    commas: `[${','.repeat(1000000)}]`,
    colons: `{${':'.repeat(1000000)}}`,
    spaces: `${' '.repeat(2000000)}1`
  };
  for (const [name, text] of Object.entries(shapes)) {
    const started = process.hrtime.bigint();
    try {
      parseStrictJson(text);
    } catch (error) {
      assert.ok(error instanceof JsonError, name);
    }
    assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 2000, `${name} took too long`);
  }
});

test('json: a large valid plan-like document is read in linear time', () => {
  const items = Array.from({ length: 60000 }, (_, i) => ({ address: `aws_instance.n${i}`, change: { actions: ['create'], after: { n: i, tags: { a: 'b' } } } }));
  const text = JSON.stringify({ resource_changes: items });
  const started = process.hrtime.bigint();
  const value = parseStrictJson(text);
  assert.equal(value.resource_changes.length, 60000);
  assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 5000);
});

test('json: position gives the line and the column of an offset, counted from 1', () => {
  assert.deepEqual(position('ab\ncd', 0), { line: 1, column: 1 });
  assert.deepEqual(position('ab\ncd', 4), { line: 2, column: 2 });
  assert.deepEqual(position('x', 99), { line: 1, column: 2 });
  assert.equal(new JsonError('m', 5).offset, 5);
  try {
    parseStrictJson('{\n  "a": 1,\n  "a": 2\n}');
  } catch (error) {
    assert.deepEqual(position('{\n  "a": 1,\n  "a": 2\n}', error.offset), { line: 3, column: 3 });
  }
});
