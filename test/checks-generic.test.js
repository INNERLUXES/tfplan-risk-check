import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPlan } from '../src/index.js';
import { check, ids, plan, rc } from './helpers.js';

test('stateful: the deletion of a database, a bucket and a volume of each cloud is a warning, with the action delete', () => {
  const kinds = ['aws_db_instance', 'aws_s3_bucket', 'aws_ebs_volume', 'azurerm_storage_account', 'azurerm_managed_disk', 'google_storage_bucket', 'google_sql_database_instance', 'google_compute_disk'];
  const r = check(kinds.map((t) => rc(t, 'x', {}, { actions: ['delete'], before: { name: 'x' } })));
  assert.equal(r.findings.length, 8);
  for (const f of r.findings) {
    assert.equal(f.id, 'stateful-delete');
    assert.equal(f.severity, 'warning');
    assert.equal(f.action, 'delete');
    assert.equal(f.attribute, '(resource)');
  }
  assert.deepEqual(r.findings.map((f) => f.type), kinds);
  assert.match(r.findings[0].message, /deletes this DB instance/);
  assert.equal(r.findings[0].manual[0].quote, 'Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources.');
});

test('stateful: a replacement in either order of delete and create is a warning, with the attribute that forces it and the reason', () => {
  for (const actions of [['delete', 'create'], ['create', 'delete']]) {
    const r = check([rc('aws_db_instance', 'db', { identifier: 'db', storage_encrypted: true }, { actions, before: { identifier: 'old' }, reason: 'replace_because_cannot_update', replacePaths: [['identifier']] })]);
    assert.deepEqual(r.findings.map((f) => [f.id, f.action, f.attribute]), [['stateful-replace', 'replace', 'identifier']]);
    assert.match(r.findings[0].message, /Terraform gives the reason replace_because_cannot_update/);
  }
});

test('stateful: a replacement without a path names the whole resource, and a path with an index is written with brackets', () => {
  assert.equal(check([rc('aws_ebs_volume', 'v', { encrypted: true }, { actions: ['delete', 'create'], before: {} })]).findings[0].attribute, '(resource)');
  assert.equal(check([rc('aws_ebs_volume', 'v', { encrypted: true }, { actions: ['delete', 'create'], before: {}, replacePaths: [['tags', 0, 'key']] })]).findings[0].attribute, 'tags[0].key');
  assert.equal(check([rc('aws_ebs_volume', 'v', { encrypted: true }, { actions: ['delete', 'create'], before: {}, replacePaths: [[{}]] })]).findings[0].attribute, '(resource)');
});

test('stateful: the prior value adds a sentence only when it is true: no final snapshot, force_destroy', () => {
  const noSnap = check([rc('aws_db_instance', 'db', {}, { actions: ['delete'], before: { skip_final_snapshot: true } })]);
  assert.match(noSnap.findings[0].message, /skip_final_snapshot is true on it, so no final snapshot is taken/);
  assert.ok(noSnap.findings[0].manual.some((m) => m.quote.includes('no DBSnapshot is created')));
  const snap = check([rc('aws_db_instance', 'db', {}, { actions: ['delete'], before: { skip_final_snapshot: false } })]);
  assert.equal(snap.findings[0].message.includes('final snapshot'), false);
  const force = check([rc('aws_s3_bucket', 'b', {}, { actions: ['delete'], before: { force_destroy: true } })]);
  assert.match(force.findings[0].message, /force_destroy is true on it/);
  assert.ok(force.findings[0].manual.some((m) => m.quote === 'These objects are *not* recoverable.'));
  const sql = check([rc('google_sql_database_instance', 'd', {}, { actions: ['delete'], before: { deletion_protection: false } })]);
  assert.equal(sql.findings[0].message.includes('deletion_protection'), false);
  assert.equal(sql.findings[0].manual.length, 3);
  const ebs = check([rc('aws_ebs_volume', 'v', {}, { actions: ['delete'], before: {} })]);
  assert.ok(ebs.findings[0].manual.some((m) => m.quote.startsWith('After deletion, its data is gone')));
});

test('stateful: a sensitive prior value is not read, so no sentence about it is added', () => {
  const r = check([rc('aws_db_instance', 'db', {}, { actions: ['delete'], before: { skip_final_snapshot: true }, beforeSensitive: { skip_final_snapshot: true } })]);
  assert.equal(r.findings[0].message.includes('final snapshot'), false);
});

test('stateful: creating and updating a stateful resource, and deleting one of another type, are no stateful finding', () => {
  const r = check([
    rc('aws_db_instance', 'a', { storage_encrypted: true }),
    rc('aws_db_instance', 'b', { storage_encrypted: true }, { actions: ['update'], before: { storage_encrypted: true } }),
    rc('aws_instance', 'c', {}, { actions: ['delete'], before: {} }),
    rc('aws_db_instance', 'd', {}, { actions: ['no-op'], before: {} })
  ]);
  assert.deepEqual(r.findings, []);
});

test('stateful: a deposed object is counted and not checked', () => {
  const entry = { ...rc('aws_db_instance', 'db', {}, { actions: ['delete'], before: {} }), deposed: 'abc' };
  const r = check(plan([entry]));
  assert.deepEqual(r.findings, []);
  assert.ok(r.notes.some((n) => /deposed object/.test(n)));
});

test('stateful: a replacement of a resource that is also read for attributes is both: the attribute findings and the replacement', () => {
  const r = check([rc('aws_db_instance', 'db', { publicly_accessible: true, storage_encrypted: true }, { actions: ['delete', 'create'], before: {} })]);
  assert.deepEqual(ids(r), ['aws-rds-public', 'stateful-replace']);
});

test('unknown: a value that is unknown until apply is info with the attribute, never an error and never a pass by guess', () => {
  const r = check([rc('aws_db_instance', 'db', { identifier: 'db' }, { unknown: { publicly_accessible: true, storage_encrypted: true } })]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.severity, f.attribute]), [['value-unknown', 'info', 'publicly_accessible'], ['value-unknown', 'info', 'storage_encrypted']]);
  assert.match(r.findings[0].message, /not known until apply, so the check on it was not made and nothing was guessed/);
  assert.equal(r.findings[0].manual[0].quote.startsWith('"after_unknown" is an object value'), true);
  assert.equal(r.gate.pass, true);
});

test('unknown: the same unknown value is reported once, and an unknown whole list covers the items below it', () => {
  const r = check([rc('aws_security_group', 'g', {}, { unknown: { ingress: true } })]);
  assert.deepEqual(ids(r), ['value-unknown']);
  assert.equal(r.findings[0].attribute, 'ingress');
});

test('sensitive: a value that the plan marks sensitive is never read: no finding is made from it and it is not in any report', () => {
  const secret = 'canary-sensitive-value-0451';
  const r = check([rc('aws_db_instance', 'db', { identifier: 'db', password: secret, publicly_accessible: true, storage_encrypted: true }, { sensitive: { password: true, publicly_accessible: true } })]);
  assert.deepEqual(ids(r), ['value-sensitive']);
  assert.equal(r.findings[0].attribute, 'publicly_accessible');
  assert.match(r.findings[0].message, /marked sensitive in the plan, so its value was not read and is not shown/);
  assert.equal(JSON.stringify(r).includes(secret), false);
});

test('sensitive: a sensitive list of sources, and one sensitive item, are not read', () => {
  const r = check([
    rc('aws_security_group', 'g', { ingress: [{ cidr_blocks: ['0.0.0.0/0'], ipv6_cidr_blocks: [], from_port: 22, to_port: 22, protocol: 'tcp' }] }, { sensitive: { ingress: [{ cidr_blocks: true }] } }),
    rc('google_compute_firewall', 'f', { direction: 'INGRESS', source_ranges: ['0.0.0.0/0'], allow: [{ protocol: 'tcp', ports: ['22'] }] }, { sensitive: { source_ranges: [true] } })
  ]);
  assert.deepEqual(ids(r), ['value-sensitive', 'value-sensitive']);
  assert.deepEqual(r.findings.map((f) => f.attribute), ['ingress[0].cidr_blocks', 'source_ranges[0]']);
  assert.equal(JSON.stringify(r).includes('0.0.0.0/0'), false);
});

test('sensitive: a whole sensitive object after the change covers every attribute below it', () => {
  const r = check([rc('aws_s3_bucket_public_access_block', 'x', { block_public_acls: false }, { sensitive: true })]);
  assert.deepEqual(ids(r), ['value-sensitive', 'value-sensitive', 'value-sensitive', 'value-sensitive']);
});

test('not read: a value of the wrong kind is info and names the kind that the provider page lists', () => {
  const r = check([rc('aws_ebs_volume', 'v', { encrypted: 'false' }), rc('aws_security_group', 'g', { ingress: [{ cidr_blocks: ['0.0.0.0/0'], from_port: 'twenty-two', to_port: 22, protocol: 'tcp' }] })]);
  assert.deepEqual(ids(r), ['value-not-read', 'value-not-read']);
  assert.match(r.findings[0].message, /is not true or false, which is the form that the provider page lists/);
  assert.match(r.findings[1].message, /is not a whole number/);
});

test('report: the counts by action, the resources and the checked count are in the input of the report', () => {
  const r = check([
    rc('aws_ebs_volume', 'a', { encrypted: false }),
    rc('aws_ebs_volume', 'b', { encrypted: true }, { actions: ['update'], before: { encrypted: true } }),
    rc('aws_ebs_volume', 'c', {}, { actions: ['delete'], before: {} }),
    rc('aws_ebs_volume', 'd', { encrypted: true }, { actions: ['delete', 'create'], before: {} }),
    rc('aws_ebs_volume', 'e', { encrypted: true }, { actions: ['no-op'], before: { encrypted: true } }),
    rc('aws_instance', 'f', {}),
    { ...rc('aws_s3_bucket', 'g', {}, { actions: ['read'] }), mode: 'data' }
  ]);
  assert.deepEqual(r.input.changes, { create: 2, update: 1, delete: 1, replace: 1, noop: 1, read: 1, other: 0 });
  assert.equal(r.input.resources, 7);
  assert.equal(r.input.checked, 4);
  assert.equal(r.input.formatVersion, '1.2');
  assert.equal(r.input.terraformVersion, '1.9.8');
  assert.deepEqual(r.notes, ['Changed resources of other types are counted and not checked: aws_instance (1).']);
});

test('report: findings are in the order of the plan, then of the checks, and the counts and the gate follow the severities', () => {
  const r = check([
    rc('aws_ebs_volume', 'first', { encrypted: false }),
    rc('aws_db_instance', 'second', { publicly_accessible: true, storage_encrypted: false })
  ]);
  assert.deepEqual(r.findings.map((f) => f.id), ['aws-ebs-unencrypted', 'aws-rds-public', 'aws-rds-unencrypted']);
  assert.deepEqual(r.counts, { error: 1, warning: 2, info: 0 });
  assert.deepEqual(r.gate, { failOn: 'error', pass: false, reason: '1 error' });
  const strict = check([rc('aws_ebs_volume', 'first', { encrypted: false })], { failOn: 'warning' });
  assert.deepEqual(strict.gate, { failOn: 'warning', pass: false, reason: '1 warning' });
  assert.equal(check([rc('aws_ebs_volume', 'first', { encrypted: false })]).gate.pass, true);
});

test('report: a plan with no findings has an empty list and a passing gate, and an empty plan is fine', () => {
  const r = check([rc('aws_ebs_volume', 'ok', { encrypted: true })]);
  assert.deepEqual(r.findings, []);
  assert.equal(r.gate.pass, true);
  const empty = check({ format_version: '1.2', planned_values: { root_module: {} } });
  assert.deepEqual(empty.input.changes.create, 0);
  assert.equal(empty.gate.pass, true);
});

test('report: more than twenty resource types that are not checked are cut in the note, with the number of the rest', () => {
  const r = check(Array.from({ length: 25 }, (_, i) => rc(`aws_thing_${String(i).padStart(2, '0')}`, 'x', {})));
  assert.match(r.notes[0], /aws_thing_19 \(1\), and 5 more types\.$/);
});

test('report: a text input is checked as it is, and a buffer is decoded as UTF-8', () => {
  const text = JSON.stringify(plan([rc('aws_ebs_volume', 'v', { encrypted: false })]));
  assert.deepEqual(ids(check(text)), ['aws-ebs-unencrypted']);
  assert.deepEqual(ids(checkPlan(Buffer.from(text))), ['aws-ebs-unencrypted']);
  assert.throws(() => checkPlan(Buffer.from([0xff, 0xfe, 0x7b, 0x00])), /UTF-16/);
  assert.throws(() => checkPlan(Buffer.from([0x7b, 0xe9, 0x7d])), /not valid UTF-8/);
});
