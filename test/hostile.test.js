import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, main } from '../src/index.js';
import { check, ids, plan, rc, withFiles } from './helpers.js';

// Runs the command line on a file written for the test, with the limits of the tool or smaller ones.
async function runFile(content, limits = LIMITS, args = []) {
  return withFiles({ 'plan.json': content }, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(['plan.json', ...args], { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

const elapsed = (started) => Number(process.hrtime.bigint() - started) / 1e6;
const GOOD = JSON.stringify(plan([rc('aws_ebs_volume', 'v', { encrypted: false })]));

test('hostile: five megabytes of opening brackets are refused with the depth error, quickly, with exit code 2', async () => {
  const started = process.hrtime.bigint();
  const r = await runFile('['.repeat(5000000));
  assert.equal(r.code, 2);
  assert.match(r.err, /nesting is deeper than 100 levels/);
  assert.equal(r.out, '');
  assert.ok(elapsed(started) < 3000);
});

test('hostile: deeply nested objects inside a plan are refused, and nesting at the limit is read', async () => {
  const deep = (n) => `{"format_version":"1.2","planned_values":${'{"a":'.repeat(n)}1${'}'.repeat(n)}}`;
  assert.equal((await runFile(deep(500))).code, 2);
  assert.equal((await runFile(deep(95))).code, 0);
});

test('hostile: a string over one million characters is refused, and one just under the limit in an unrelated attribute is read', async () => {
  const withString = (n) => JSON.stringify(plan([rc('aws_ebs_volume', 'v', { encrypted: true, note: 'x'.repeat(n) })]));
  const big = await runFile(withString(LIMITS.maxStringChars + 1));
  assert.equal(big.code, 2);
  assert.match(big.err, /longer than 1,048,576 characters/);
  const ok = await runFile(withString(LIMITS.maxStringChars - 1));
  assert.equal(ok.code, 0);
  assert.ok(ok.out.length < 1000);
});

test('hostile: a huge address is cut in the report and the report stays small', async () => {
  const r = await runFile(JSON.stringify(plan([rc('aws_ebs_volume', 'n'.repeat(900000), { encrypted: false })])), LIMITS, ['--format', 'json']);
  assert.equal(r.code, 0);
  assert.ok(r.out.length < 20000);
  assert.equal(JSON.parse(r.out).findings[0].address.length, 300);
});

test('hostile: the wrong format_version is refused with the reason, for a major version that is not 1 and for text that is no version', async () => {
  for (const [version, pattern] of [['2.0', /major version 1 only/], ['0.1', /major version 1 only/], ['99.0', /major version 1 only/], ['', /not a version number/], ['1.0.0', /not a version number/], ['v1.0', /not a version number/]]) {
    const r = await runFile(JSON.stringify(plan([], { formatVersion: version })));
    assert.equal(r.code, 2, version);
    assert.match(r.err, pattern, version);
    assert.equal(r.out, '');
  }
  assert.equal((await runFile(JSON.stringify({ ...plan([]), format_version: 1.2 }))).code, 2);
  assert.equal((await runFile(JSON.stringify({ ...plan([]), format_version: null }))).code, 2);
});

test('hostile: JSON that is not a plan is refused with a message that says what it is: a state, a validate result, a package file, a list, a number', async () => {
  const cases = [
    [JSON.stringify({ format_version: '1.0', terraform_version: '1.9.8', values: { root_module: {} } }), /JSON of a state/],
    [JSON.stringify({ format_version: '1.0', valid: true, error_count: 0, diagnostics: [] }), /not the JSON of a plan/],
    [JSON.stringify({ name: 'pkg', version: '1.0.0', dependencies: {} }), /no format_version/],
    ['[1,2,3]', /not an object/],
    ['42', /not an object/],
    ['null', /not an object/],
    ['"plan"', /not an object/]
  ];
  for (const [content, pattern] of cases) {
    const r = await runFile(content);
    assert.equal(r.code, 2, content.slice(0, 40));
    assert.match(r.err, pattern);
  }
});

test('hostile: bytes that are not text, a NUL byte, an empty file and text that is not JSON are input errors, never a crash', async () => {
  const noise = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 131 + 7) % 256));
  for (const content of [noise, Buffer.from('{"format_version":"1.2",\u0000"planned_values":{}}'), '', '   ', 'terraform will perform the following actions', '<html></html>', '{"a":1}{"b":2}']) {
    const r = await runFile(content);
    assert.equal(r.code, 2);
    assert.equal(r.out, '');
    assert.ok(r.err.startsWith('tfplan-risk-check: '));
  }
});

test('hostile: a key twice in one object is refused, so two readers cannot see two different plans', async () => {
  const doubled = GOOD.replace('"encrypted":false', '"encrypted":false,"encrypted":true');
  assert.notEqual(doubled, GOOD);
  const r = await runFile(doubled);
  assert.equal(r.code, 2);
  assert.match(r.err, /the key "encrypted" appears twice in one object \(line 1, column/);
});

test('hostile: a file over the size limit is refused before it is read, and the limit is the one given', async () => {
  const r = await runFile(GOOD, { ...LIMITS, maxFileBytes: GOOD.length - 1 });
  assert.equal(r.code, 2);
  assert.match(r.err, /over the .* limit, so it was not read/);
});

test('hostile: more values than the limit, and more resource changes than the limit, are refused', async () => {
  const r = await runFile(GOOD, { ...LIMITS, maxNodes: 20 });
  assert.equal(r.code, 2);
  assert.match(r.err, /more than 20 values/);
  const many = JSON.stringify(plan(Array.from({ length: LIMITS.maxResources + 1 }, (_, i) => rc('aws_ebs_volume', `v${i}`, { encrypted: true }))));
  const m = await runFile(many);
  assert.equal(m.code, 2);
  assert.match(m.err, /20,001 resource changes, over the limit of 20,000/);
});

test('hostile: a key named __proto__ or constructor in the plan is data, changes no prototype and makes no finding', () => {
  const text = GOOD.replace('"encrypted":false', '"encrypted":true,"__proto__":{"publicly_accessible":true},"constructor":{"x":1}');
  const r = check(text);
  assert.deepEqual(r.findings, []);
  assert.equal({}.publicly_accessible, undefined);
  assert.equal(Object.prototype.x, undefined);
  const db = check(JSON.stringify(plan([rc('aws_db_instance', 'd', { storage_encrypted: true })])).replace('"storage_encrypted":true', '"storage_encrypted":true,"__proto__":{"publicly_accessible":true}'));
  assert.deepEqual(db.findings, []);
});

test('hostile: values of the wrong shape where the plan format has an object do not crash the checks', () => {
  const entries = [
    { address: 'aws_ebs_volume.a', mode: 'managed', type: 'aws_ebs_volume', name: 'a', change: { actions: ['create'], after: 'text', after_unknown: 7, after_sensitive: 'x' } },
    { address: 'aws_ebs_volume.b', mode: 'managed', type: 'aws_ebs_volume', name: 'b', change: { actions: ['create'], after: [1, 2], after_unknown: [], after_sensitive: null } },
    { address: 'aws_ebs_volume.c', mode: 'managed', type: 'aws_ebs_volume', name: 'c', change: { actions: ['create'], after: { encrypted: false }, after_unknown: 'yes', after_sensitive: [true] } },
    { address: 'aws_security_group.d', mode: 'managed', type: 'aws_security_group', name: 'd', change: { actions: ['create'], after: { ingress: { cidr_blocks: ['0.0.0.0/0'] } } } },
    { address: 'aws_security_group.e', mode: 'managed', type: 'aws_security_group', name: 'e', change: { actions: ['create'], after: { ingress: [null, 5, 'x', [], { cidr_blocks: 'nope', protocol: 22 }] } } },
    { address: 'google_compute_firewall.f', mode: 'managed', type: 'google_compute_firewall', name: 'f', change: { actions: ['create'], after: { source_ranges: ['0.0.0.0/0'], allow: [1, null, { protocol: ['tcp'], ports: 22 }] } } },
    { address: 'azurerm_network_security_group.g', mode: 'managed', type: 'azurerm_network_security_group', name: 'g', change: { actions: ['create'], after: { security_rule: ['x', null, { direction: 1 }] } } }
  ];
  const r = check({ format_version: '1.2', resource_changes: entries });
  assert.ok(ids(r).includes('aws-ebs-unencrypted'));
  assert.ok(r.findings.every((f) => ['aws-ebs-unencrypted', 'value-not-read', 'value-unknown', 'value-sensitive'].includes(f.id)));
});

test('hostile: a list of fifty thousand ingress rules is read in a few seconds', () => {
  const ingress = Array.from({ length: 50000 }, (_, i) => ({ cidr_blocks: i % 1000 === 0 ? ['0.0.0.0/0'] : ['10.0.0.0/8'], ipv6_cidr_blocks: [], from_port: i % 1000 === 0 ? 22 : 8000, to_port: i % 1000 === 0 ? 22 : 8000, protocol: 'tcp' }));
  const started = process.hrtime.bigint();
  const r = check([rc('aws_security_group', 'huge', { ingress })]);
  assert.equal(r.findings.length, 50);
  assert.ok(r.findings.every((f) => f.id === 'aws-sg-ssh-open'));
  assert.ok(elapsed(started) < 10000, `took ${elapsed(started)} ms`);
});

test('hostile: thousands of unknown values give one finding for each path and a bounded report', () => {
  const sg = rc('aws_security_group', 'g', { ingress: Array.from({ length: 2000 }, () => ({ cidr_blocks: [], protocol: 'tcp', from_port: 1, to_port: 1 })) }, { unknown: { ingress: Array.from({ length: 2000 }, () => ({ cidr_blocks: true })) } });
  const r = check([sg]);
  assert.equal(r.findings.length, 2000);
  assert.ok(r.findings.every((f) => f.id === 'value-unknown'));
});

test('hostile: an address with escape sequences in JSON escapes is cleaned in every format of the command line', async () => {
  const content = GOOD.replace('"aws_ebs_volume.v"', '"aws_ebs_volume.v\\u001b[2J\\u202e"');
  assert.notEqual(content, GOOD);
  for (const format of ['text', 'markdown', 'json', 'csv']) {
    const r = await runFile(content, LIMITS, ['--format', format]);
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.out, new RegExp(`\u001b|${String.fromCharCode(0x202e)}`), format);
  }
});
