import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputError, baseAddress, classify, lookup, lookupBefore, pathText, readPlan } from '../src/index.js';
import { plan, rc } from './helpers.js';

const read = (value) => readPlan(typeof value === 'string' ? value : JSON.stringify(value));
const refused = (value, pattern) => assert.throws(() => read(value), (e) => e instanceof InputError && pattern.test(e.message), JSON.stringify(value).slice(0, 80));

test('plan: a plan with resource changes is read, with the versions, the changes and the actions', () => {
  const p = read(plan([rc('aws_ebs_volume', 'a', { encrypted: false }), rc('aws_ebs_volume', 'b', { size: 1 }, { actions: ['update'], before: { size: 2 } })]));
  assert.equal(p.formatVersion, '1.2');
  assert.equal(p.terraformVersion, '1.9.8');
  assert.deepEqual(p.resources.map((r) => [r.address, r.action]), [['aws_ebs_volume.a', 'create'], ['aws_ebs_volume.b', 'update']]);
  assert.equal(p.resources[1].before.size, 2);
});

test('plan: the output of terraform show -json for a state, not a plan, is refused with the way to write a plan', () => {
  refused({ format_version: '1.0', terraform_version: '1.9.8', values: { root_module: {} } }, /state, not of a plan/);
});

test('plan: other JSON is refused with a clear message: no object, no format_version, no plan keys', () => {
  refused([], /not an object/);
  refused('"text"', /not an object/);
  refused({ resource_changes: [] }, /no format_version/);
  refused({ format_version: 1 }, /no format_version/);
  refused({ format_version: '1.0', valid: true, error_count: 0 }, /neither "resource_changes" nor "planned_values"/);
  refused({ name: 'package', version: '1.0.0' }, /no format_version/);
});

test('plan: an unsupported major version is rejected, as the format page says, and a newer minor version is read', () => {
  refused(plan([], { formatVersion: '2.0' }), /major version 1 only/);
  refused(plan([], { formatVersion: '0.2' }), /major version 1 only/);
  refused(plan([], { formatVersion: 'one' }), /not a version number/);
  refused(plan([], { formatVersion: '1' }), /not a version number/);
  assert.equal(read(plan([], { formatVersion: '1.7' })).formatVersion, '1.7');
});

test('plan: properties that the reader does not know are ignored, as the format page says', () => {
  const p = read(plan([rc('aws_ebs_volume', 'a', { encrypted: true })], { extra: { future_thing: { a: [1, 2] }, applyable: true } }));
  assert.equal(p.resources.length, 1);
});

test('plan: a plan with planned_values and no resource_changes is a plan with no changes', () => {
  const p = read({ format_version: '1.2', planned_values: { root_module: {} } });
  assert.equal(p.resources.length, 0);
});

test('plan: resource_changes that is not a list, or an entry that is not a resource change, is refused', () => {
  refused({ format_version: '1.2', resource_changes: {} }, /not a list/);
  refused({ format_version: '1.2', resource_changes: ['x'] }, /resource_changes\[0\] is not an object/);
  refused({ format_version: '1.2', resource_changes: [{ type: 't', name: 'n', mode: 'managed', change: { actions: ['create'] } }] }, /no "address"/);
  refused({ format_version: '1.2', resource_changes: [{ address: 'a.b', type: 'a', name: 'b', mode: 'managed' }] }, /no "change" object/);
  refused({ format_version: '1.2', resource_changes: [{ address: 'a.b', type: 'a', name: 'b', mode: 'managed', change: { actions: [] } }] }, /no list of actions/);
  refused({ format_version: '1.2', resource_changes: [{ address: 'a.b', type: 'a', name: 'b', mode: 'managed', change: { actions: [1] } }] }, /no list of actions/);
  refused({ format_version: '1.2', planned_values: [] }, /not an object/);
});

test('plan: an address listed twice is refused, and the same address with a deposed key is two objects', () => {
  const a = rc('aws_ebs_volume', 'a', { encrypted: true });
  refused(plan([a, a]), /listed twice/);
  const deposed = { ...structuredClone(a), deposed: 'abc123' };
  assert.equal(read(plan([a, deposed])).resources.length, 2);
});

test('plan: more resource changes than the limit are refused', () => {
  const many = Array.from({ length: 6 }, (_, i) => rc('aws_ebs_volume', `v${i}`, { encrypted: true }));
  assert.throws(() => readPlan(JSON.stringify(plan(many)), { maxFileBytes: 1, maxDepth: 100, maxNodes: 1e6, maxStringChars: 1e6, maxKeyChars: 100, maxNumberChars: 30, maxResources: 5 }), /over the limit of 5/);
});

test('plan: classify gives one word for an action list, and replace is either order of delete and create', () => {
  assert.equal(classify(['no-op']), 'no-op');
  assert.equal(classify(['create']), 'create');
  assert.equal(classify(['read']), 'read');
  assert.equal(classify(['update']), 'update');
  assert.equal(classify(['delete']), 'delete');
  assert.equal(classify(['delete', 'create']), 'replace');
  assert.equal(classify(['create', 'delete']), 'replace');
  assert.equal(classify(['update', 'update']), 'other');
});

test('plan: an action list that the reader does not know is noted and not checked', () => {
  const p = read(plan([rc('aws_ebs_volume', 'a', { encrypted: false }, { actions: ['forget'] })]));
  assert.equal(p.resources[0].action, 'other');
  assert.match(p.notes[0], /does not read/);
});

test('plan: an errored plan is read and noted', () => {
  const p = read(plan([], { extra: { errored: true } }));
  assert.equal(p.errored, true);
  assert.match(p.notes[0], /errored/);
});

test('plan: resources that only planned_values lists are kept for pairing, with their module', () => {
  const p = read({ format_version: '1.2', planned_values: { root_module: { resources: [{ address: 'aws_s3_bucket.a', mode: 'managed', type: 'aws_s3_bucket', name: 'a', values: { bucket: 'a' } }], child_modules: [{ address: 'module.m', resources: [{ address: 'module.m.aws_s3_bucket_public_access_block.b', mode: 'managed', type: 'aws_s3_bucket_public_access_block', name: 'b', values: {} }] }] } } });
  assert.deepEqual(p.plannedOnly.map((r) => [r.address, r.module]), [['aws_s3_bucket.a', ''], ['module.m.aws_s3_bucket_public_access_block.b', 'module.m']]);
});

test('plan: the configuration is indexed by the address without index, with the module names of the tree', () => {
  const p = read({ format_version: '1.2', resource_changes: [], configuration: { root_module: { resources: [{ address: 'aws_s3_bucket.a', mode: 'managed', type: 'aws_s3_bucket', name: 'a', expressions: { bucket: { constant_value: 'a' } } }], module_calls: { child: { module: { resources: [{ address: 'aws_s3_bucket.b', mode: 'managed', type: 'aws_s3_bucket', name: 'b', expressions: {} }] } } } } } });
  assert.deepEqual([...p.config.keys()].sort(), ['aws_s3_bucket.a', 'module.child.aws_s3_bucket.b']);
});

test('plan: baseAddress drops the index keys of resources and modules, also when a key holds brackets or dots', () => {
  assert.equal(baseAddress('aws_s3_bucket.a'), 'aws_s3_bucket.a');
  assert.equal(baseAddress('aws_s3_bucket.a[0]'), 'aws_s3_bucket.a');
  assert.equal(baseAddress('module.x["eu-west-1"].aws_s3_bucket.a["a.b[1]"]'), 'module.x.aws_s3_bucket.a');
  assert.equal(baseAddress('module.x[2].module.y[0].aws_instance.z[1]'), 'module.x.module.y.aws_instance.z');
  assert.equal(baseAddress('aws_s3_bucket.a["quote\\"]x"]'), 'aws_s3_bucket.a');
});

test('lookup: a value is known, absent, unknown or sensitive, and a sensitive or unknown parent covers what is below it', () => {
  const r = { after: { a: 1, nested: [{ b: 'x' }], gone: null, s: 'secret', list: ['p', 'q'], u: null, deep: { c: 1 } }, afterUnknown: { u: true, nested: [{ b: true }], deep: true }, afterSensitive: { s: true, list: true } };
  assert.deepEqual(lookup(r, ['a']), { state: 'known', value: 1 });
  assert.deepEqual(lookup(r, ['nested', 0, 'b']), { state: 'unknown' });
  assert.deepEqual(lookup(r, ['gone']), { state: 'absent' });
  assert.deepEqual(lookup(r, ['missing']), { state: 'absent' });
  assert.deepEqual(lookup(r, ['s']), { state: 'sensitive' });
  assert.deepEqual(lookup(r, ['list', 1]), { state: 'sensitive' });
  assert.deepEqual(lookup(r, ['u']), { state: 'unknown' });
  assert.deepEqual(lookup(r, ['deep', 'c']), { state: 'unknown' });
  assert.equal(JSON.stringify(lookup(r, ['s'])).includes('secret'), false);
});

test('lookup: a key that is only on the prototype is not a value, and an index on an object is not a value', () => {
  const r = { after: { a: 1 }, afterUnknown: {}, afterSensitive: {} };
  assert.deepEqual(lookup(r, ['toString']), { state: 'absent' });
  assert.deepEqual(lookup(r, ['__proto__']), { state: 'absent' });
  assert.deepEqual(lookup(r, [0]), { state: 'absent' });
  assert.deepEqual(lookup({ after: null, afterUnknown: null, afterSensitive: null }, ['a']), { state: 'absent' });
});

test('lookupBefore: reads the object before the change, and a sensitive value is not returned', () => {
  const r = { before: { a: true, s: 1 }, beforeSensitive: { s: true } };
  assert.deepEqual(lookupBefore(r, ['a']), { state: 'known', value: true });
  assert.deepEqual(lookupBefore(r, ['s']), { state: 'sensitive' });
  assert.deepEqual(lookupBefore({ before: null, beforeSensitive: null }, ['a']), { state: 'absent' });
});

test('pathText: writes indexes in brackets and cleans the names', () => {
  assert.equal(pathText(['ingress', 0, 'cidr_blocks', 1]), 'ingress[0].cidr_blocks[1]');
  assert.equal(pathText(['a']), 'a');
  assert.equal(pathText([0, 'a']), '[0].a');
  assert.equal(pathText(['a\u001bb']), 'a b');
});

test('plan: the text of an address and the version string are cleaned before they are shown', () => {
  const p = read({ ...plan([]), terraform_version: '1.9\u001b[2J.8' });
  assert.equal(p.terraformVersion.includes('\u001b'), false);
});
