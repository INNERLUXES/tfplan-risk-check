import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USAGE, VERSION, csvCell, mdCell, parseArgs, safeText, toCsv, toJson, toMarkdown, toText } from '../src/index.js';
import { check, cli, plan, rc, run } from './helpers.js';

// Characters that the Write of this file would turn into raw ones are built from their numbers.
const RLO = String.fromCharCode(0x202e);
const LS = String.fromCharCode(0x2028);
const BAD = plan([rc('aws_ebs_volume', 'scratch', { encrypted: false })]);
const ERR = plan([rc('aws_db_instance', 'db', { publicly_accessible: true, storage_encrypted: true })]);
const OK = plan([rc('aws_ebs_volume', 'ok', { encrypted: true })]);
const text = (p) => JSON.stringify(p);

test('exit codes: 0 without a finding at the level, 1 with one, 2 for a usage or input error', async () => {
  assert.equal((await run({ 'plan.json': text(OK) }, ['plan.json'])).code, 0);
  assert.equal((await run({ 'plan.json': text(ERR) }, ['plan.json'])).code, 1);
  assert.equal((await run({ 'plan.json': text(OK) }, [])).code, 2);
  assert.equal((await run({}, ['missing.json'])).code, 2);
  assert.equal((await run({ 'package.json': '{"name":"x"}' }, ['package.json'])).code, 2);
  assert.equal((await run({ 'sub/plan.json': '{}' }, ['sub'])).code, 2);
});

test('--fail-on: warnings fail only at the level warning, and info never fails', async () => {
  const warn = { 'plan.json': text(BAD) };
  assert.equal((await run(warn, ['plan.json'])).code, 0);
  const strict = await run(warn, ['plan.json', '--fail-on', 'warning']);
  assert.equal(strict.code, 1);
  assert.match(strict.out, /GATE: FAIL - 1 warning/);
  const info = { 'plan.json': text(plan([rc('aws_db_instance', 'd', { identifier: 'd' }, { unknown: { publicly_accessible: true, storage_encrypted: true } })])) };
  const r = await run(info, ['plan.json', '--fail-on', 'warning']);
  assert.equal(r.code, 0);
  assert.match(r.out, /INFO {5}value-unknown/);
  assert.match(r.out, /GATE: PASS \(--fail-on warning\)/);
  assert.equal((await run(info, ['plan.json', '--fail-on', 'info'])).code, 2);
});

test('arguments: unknown options, missing values, bad formats and addresses are usage errors that print the usage', async () => {
  for (const argv of [['--nope'], ['plan.json', '--format'], ['plan.json', '--format', 'xml'], ['https://example.test/plan.json'], ['-'], ['plan.json', '--fail-on', '--format'], ['a.json', 'b.json'], ['plan.json', '--fail-on', 'info']]) {
    const r = await cli(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.err, /Usage: tfplan-risk-check/);
    assert.equal(r.out, '');
  }
  assert.throws(() => parseArgs(['plan.json', '--format']), /needs a value/);
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
});

test('arguments: --help and --version print and exit 0, and the usage lists the checks and the exit codes', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  assert.match(USAGE, /aws-sg-ssh-open/);
  assert.match(USAGE, /stateful-replace/);
  assert.match(USAGE, /Exit codes: 0 no finding/);
  const version = await cli(['--version']);
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal((await cli(['-h'])).code, 0);
  assert.equal((await cli(['-v'])).out, `${VERSION}\n`);
});

test('input: the report shows the name of the file and not its folder, whatever way the path is written', async () => {
  const files = { 'infra/prod/plan.json': text(BAD) };
  const a = JSON.parse((await run(files, ['infra/prod/plan.json', '--format', 'json'])).out);
  const b = JSON.parse((await run(files, ['./infra/../infra/prod/plan.json', '--format', 'json'])).out);
  assert.equal(a.target, 'plan.json');
  assert.equal(b.target, 'plan.json');
  assert.equal(a.input.file, 'plan.json');
});

test('input: a path written with backslashes is read on Windows, where a backslash separates folders', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('a backslash is an ordinary character in a file name on this system');
    return;
  }
  const r = await run({ 'infra/prod/plan.json': text(BAD) }, ['infra\\prod\\plan.json', '--format', 'json']);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).target, 'plan.json');
});

test('input: an error is written to standard error and nothing to standard output, with the exit code 2', async () => {
  const r = await run({ 'plan.json': '{"a":' }, ['plan.json']);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
  assert.match(r.err, /^tfplan-risk-check: The file is not valid JSON: the text ends where a value is expected \(line 1, column 6\)/);
});

test('input: a UTF-16 plan, as Windows PowerShell writes a redirected file, is refused with the way to write UTF-8', async () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text(OK), 'utf16le')]);
  const r = await run({ 'plan.json': utf16 }, ['plan.json']);
  assert.equal(r.code, 2);
  assert.match(r.err, /plan\.json is UTF-16 text/);
});

test('input: a plan with a byte order mark is read', async () => {
  const r = await run({ 'plan.json': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text(OK))]) }, ['plan.json']);
  assert.equal(r.code, 0);
});

test('text report: the lines, the counts, the action, the attribute, the source with its address and the gate', () => {
  const t = toText(check(BAD, { target: 'plan.json' }));
  assert.match(t, /^tfplan-risk-check: plan\.json\nread: 1 resource \(1 create\), format 1\.2, Terraform 1\.9\.8\nfindings: 0 error, 1 warning, 0 info\n/);
  assert.match(t, /WARNING {2}aws-ebs-unencrypted {2}aws_ebs_volume\.scratch\n {9}action: create\n {9}at: encrypted\n/);
  assert.match(t, / {9}source \(AWS Security Hub, EC2 controls, \[EC2\.3\] Attached Amazon EBS volumes should be encrypted at-rest\): "For an added layer of security of your sensitive data in EBS volumes, you should enable EBS encryption at rest\."/);
  assert.match(t, / {11}https:\/\/docs\.aws\.amazon\.com\/securityhub\/latest\/userguide\/ec2-controls\.html/);
  assert.match(t, /GATE: PASS \(--fail-on error\)\n$/);
});

test('text report: a quote from the top of a page names the page once, and a plan with no change is read as such', () => {
  const t = toText(check(plan([rc('aws_s3_bucket_public_access_block', 'x', { block_public_acls: false, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true })])));
  assert.match(t, /source \(Amazon S3, Blocking public access\): "S3 Block Public Access settings override/);
  const none = toText(check({ format_version: '1.2', planned_values: { root_module: {} } }));
  assert.match(none, /read: 0 resources, format 1\.2\n/);
  assert.match(none, /no findings/);
});

test('markdown report: a table with the resource, the action, the attribute and the source links, and the gate line', () => {
  const md = toMarkdown(check(BAD, { target: 'plan.json' }));
  assert.match(md, /^## tfplan-risk-check: 0 error, 1 warning, 0 info\n\nplan\.json, 1 resource \(1 create\), format 1\.2, Terraform 1\.9\.8\.\n/);
  assert.match(md, /\| Severity \| Check \| Resource \| Action \| Attribute \| Message \| Fix \| Source \|/);
  assert.match(md, /\| warning \| aws-ebs-unencrypted \| aws_ebs_volume\.scratch \| create \| encrypted \|/);
  assert.match(md, /\[AWS Security Hub, EC2 controls, \[EC2\.3\]/);
  assert.match(md, /\*\*Gate passed\*\* \(--fail-on error\)\./);
  assert.match(toMarkdown(check(OK)), /No findings\./);
});

test('markdown report: pipes, angle brackets and line breaks from a plan cannot break the table or become HTML', () => {
  const name = 'a|b<script>x</script>&';
  const r = check(plan([rc('aws_ebs_volume', name, { encrypted: false })]));
  const md = toMarkdown(r);
  assert.ok(!md.includes('<script>'));
  assert.ok(md.includes('a\\|b&lt;script&gt;'));
  assert.equal(mdCell('x\r\ny|z\\'), 'x y\\|z\\\\');
  for (const line of md.split('\n').filter((l) => l.startsWith('| warning'))) assert.equal(line.replace(/\\\|/g, '').split('|').length, 10);
});

test('json report: the whole report with the input, counts, findings with their sources, notes and the gate', () => {
  const r = JSON.parse(toJson(check(BAD, { target: 'plan.json', version: '9.9.9' })));
  assert.equal(r.tool, 'tfplan-risk-check');
  assert.equal(r.version, '9.9.9');
  assert.deepEqual(r.input, { file: 'plan.json', bytes: Buffer.byteLength(JSON.stringify(BAD)), formatVersion: '1.2', terraformVersion: '1.9.8', resources: 1, changes: { create: 1, update: 0, delete: 0, replace: 0, noop: 0, read: 0, other: 0 }, checked: 1 });
  assert.deepEqual(r.counts, { error: 0, warning: 1, info: 0 });
  assert.deepEqual(r.gate, { failOn: 'error', pass: true, reason: '' });
  assert.equal(r.findings[0].manual[0].page, 'AWS Security Hub, EC2 controls');
  assert.equal(r.findings[0].manual[0].url, 'https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html');
});

test('csv report: RFC 4180 quoting with CRLF line ends, one row per finding, and a formula is defused', () => {
  const csv = toCsv(check(BAD));
  const rows = csv.split('\r\n');
  assert.equal(rows[0], 'severity,id,cloud,address,type,attribute,action,message,fix,source_page,source_section,source_url');
  assert.equal(rows.length, 3);
  assert.match(rows[1], /^warning,aws-ebs-unencrypted,aws,aws_ebs_volume\.scratch,aws_ebs_volume,encrypted,create,"encrypted is false, so the volume is planned/);
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(null), '');
  const evil = toCsv(check(plan([rc('aws_ebs_volume', '=cmd', { encrypted: false })])));
  assert.match(evil, /,'aws_ebs_volume\.=cmd|"?aws_ebs_volume\.=cmd/);
  assert.ok(!evil.split('\r\n')[1].split(',').some((c) => c.startsWith('=')));
});

test('safeText: control, line separator and direction characters become a space, and the length is cut', () => {
  assert.equal(safeText(`a[31mb${RLO}c${LS}d`), 'a [31mb c d');
  assert.equal(safeText('x'.repeat(300), 20), `${'x'.repeat(17)}...`);
  assert.equal(safeText(42), '42');
});

test('terminal safety: an address made of escape sequences and direction controls is cleaned in every format', () => {
  const evil = `v[2J${RLO}${LS}x`;
  const r = check(plan([rc('aws_ebs_volume', evil, { encrypted: false })]));
  for (const out of [toText(r), toMarkdown(r), toJson(r), toCsv(r)]) assert.doesNotMatch(out, new RegExp(`[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f${RLO}${LS}]`));
  assert.equal(r.findings[0].address.includes('\u001b'), false);
});

test('terminal safety: a very long address is cut in the report', () => {
  const r = check(plan([rc('aws_ebs_volume', 'v'.repeat(5000), { encrypted: false })]));
  assert.equal(r.findings[0].address.length, 300);
  assert.ok(toText(r).length < 6000);
});

test('no value of a plan is printed: not a password, not a sensitive source, not an attribute that no check reads', async () => {
  const changes = [
    rc('aws_db_instance', 'db', { identifier: 'db', 'password': 'canary-password-7731', publicly_accessible: true, storage_encrypted: false, tags: { owner: 'canary-tag-value-2210' } }, { sensitive: { 'password': true } }),
    rc('aws_security_group', 'g', { ingress: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 22, to_port: 22, protocol: 'tcp' }] }, { sensitive: { ingress: [{ cidr_blocks: true }] } })
  ];
  const r = check(plan(changes));
  for (const out of [toText(r), toMarkdown(r), toJson(r), toCsv(r)]) {
    assert.ok(!out.includes('canary-password-7731'));
    assert.ok(!out.includes('canary-tag-value-2210'));
  }
  const viaCli = await run({ 'plan.json': text(plan(changes)) }, ['plan.json', '--format', 'json']);
  assert.ok(!viaCli.out.includes('canary-password-7731'));
  assert.ok(!viaCli.out.includes('canary-tag-value-2210'));
});
