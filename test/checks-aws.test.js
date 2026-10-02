import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketWithBlock, check, find, ids, plan, rc } from './helpers.js';

const WORLD4 = ['0.0.0.0/0'];
const group = (ingress, extra = {}) => rc('aws_security_group', 'web', { name: 'web', ingress, egress: [], ...extra });
const rule = (over) => ({ cidr_blocks: [], ipv6_cidr_blocks: [], from_port: 443, to_port: 443, protocol: 'tcp', description: '', ...over });

test('aws s3: a public access block with a setting that is false is an error for each setting, with the attribute and the action', () => {
  const { changes, config } = bucketWithBlock('data', { settings: [true, false, true, false] });
  const r = check(plan(changes, { config }));
  const hits = find(r, 'aws-s3-public-access-block-off');
  assert.deepEqual(hits.map((f) => f.attribute), ['block_public_policy', 'restrict_public_buckets']);
  for (const f of hits) {
    assert.equal(f.severity, 'error');
    assert.equal(f.address, 'aws_s3_bucket_public_access_block.data');
    assert.equal(f.action, 'create');
    assert.equal(f.cloud, 'aws');
    assert.match(f.fix, /to true/);
  }
  assert.equal(hits[0].manual.at(-1).quote, 'Whether Amazon S3 should block public bucket policies for this bucket. Defaults to `false`.');
  assert.deepEqual(ids(r).filter((i) => i === 'aws-s3-public-access-block-missing'), []);
});

test('aws s3: a block with all four settings true and a bucket that it points at is no finding', () => {
  const { changes, config } = bucketWithBlock('data');
  const r = check(plan(changes, { config }));
  assert.deepEqual(r.findings, []);
  assert.equal(r.gate.pass, true);
});

test('aws s3: a setting that is left out is read as false, as the provider page says, and says so', () => {
  const r = check([rc('aws_s3_bucket_public_access_block', 'x', { block_public_acls: true, block_public_policy: true, ignore_public_acls: true }, { unknown: { bucket: true } })]);
  const hit = find(r, 'aws-s3-public-access-block-off');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].attribute, 'restrict_public_buckets');
  assert.match(hit[0].message, /not set \(the provider default is false\)/);
});

test('aws s3: a bucket without any public access block in the plan is a warning, and the message says that an account setting is not seen', () => {
  const r = check([rc('aws_s3_bucket', 'logs', { bucket: 'logs-prod' }, { unknown: { id: true } })]);
  assert.deepEqual(ids(r), ['aws-s3-public-access-block-missing']);
  assert.equal(r.findings[0].severity, 'warning');
  assert.match(r.findings[0].message, /account or the organization outside this plan is not seen/);
  assert.equal(r.gate.pass, true);
});

test('aws s3: a block that points at another bucket does not cover this one, but a block found by the bucket name does', () => {
  const other = bucketWithBlock('other');
  const r = check(plan([...other.changes, rc('aws_s3_bucket', 'logs', { bucket: 'logs-prod' }, { unknown: { id: true } })], { config: other.config }));
  assert.deepEqual(find(r, 'aws-s3-public-access-block-missing').map((f) => f.address), ['aws_s3_bucket.logs']);
  const byName = check([rc('aws_s3_bucket', 'logs', { bucket: 'logs-prod', id: 'logs-prod' }), rc('aws_s3_bucket_public_access_block', 'x', { bucket: 'logs-prod', block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true })]);
  assert.deepEqual(byName.findings, []);
});

test('aws s3: the link is found through the module tree of the configuration, with index keys on the instances', () => {
  const changes = [
    rc('aws_s3_bucket', 'this', { bucket: 'm' }, { module: 'module.store', index: 0, unknown: { id: true } }),
    rc('aws_s3_bucket_public_access_block', 'this', { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true }, { module: 'module.store', index: 0, unknown: { bucket: true } })
  ];
  const p = plan(changes);
  p.configuration.root_module.module_calls = { store: { module: { resources: [{ address: 'aws_s3_bucket_public_access_block.this', mode: 'managed', type: 'aws_s3_bucket_public_access_block', name: 'this', expressions: { bucket: { references: ['aws_s3_bucket.this[0].id', 'aws_s3_bucket.this[0]', 'aws_s3_bucket.this'] } } }] } } };
  assert.deepEqual(check(p).findings, []);
  p.configuration.root_module.module_calls.store.module.resources[0].expressions.bucket.references = ['aws_s3_bucket.that'];
  assert.deepEqual(ids(check(p)), ['aws-s3-public-access-block-missing']);
});

test('aws s3: a block whose bucket is a value the plan cannot resolve makes the bucket info, not a guess', () => {
  const changes = [
    rc('aws_s3_bucket', 'logs', { bucket: 'logs-prod' }, { unknown: { id: true } }),
    rc('aws_s3_bucket_public_access_block', 'x', { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true }, { unknown: { bucket: true } })
  ];
  const r = check(plan(changes, { config: [['aws_s3_bucket_public_access_block.x', { bucket: { references: ['var.bucket_name'] } }]] }));
  assert.deepEqual(ids(r), ['value-unknown']);
  assert.equal(r.findings[0].severity, 'info');
  assert.match(r.findings[0].message, /not known until apply/);
});

test('aws s3: a block that is deleted in the plan no longer covers its bucket, and a bucket that is not changed is not reported', () => {
  const { changes, config } = bucketWithBlock('data');
  changes[1] = rc('aws_s3_bucket_public_access_block', 'data', {}, { actions: ['delete'], before: { block_public_acls: true } });
  assert.deepEqual(ids(check(plan(changes, { config }))), ['aws-s3-public-access-block-missing']);
  const quiet = check([rc('aws_s3_bucket', 'logs', { bucket: 'logs' }, { actions: ['no-op'], before: { bucket: 'logs' } })]);
  assert.deepEqual(quiet.findings, []);
  assert.equal(quiet.input.changes.noop, 1);
});

test('aws sg: ssh and rdp open to the internet are errors, for the inline block and for both rule resources', () => {
  const r = check([
    group([rule({ cidr_blocks: WORLD4, from_port: 22, to_port: 22 })]),
    rc('aws_security_group_rule', 'rdp', { type: 'ingress', cidr_blocks: [], ipv6_cidr_blocks: ['::/0'], from_port: 3389, to_port: 3389, protocol: 'tcp' }),
    rc('aws_vpc_security_group_ingress_rule', 'ssh', { cidr_ipv4: '0.0.0.0/0', cidr_ipv6: null, from_port: 20, to_port: 30, ip_protocol: 'tcp' })
  ]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.address, f.attribute]), [
    ['aws-sg-ssh-open', 'aws_security_group.web', 'ingress[0].cidr_blocks[0]'],
    ['aws-sg-rdp-open', 'aws_security_group_rule.rdp', 'ipv6_cidr_blocks[0]'],
    ['aws-sg-ssh-open', 'aws_vpc_security_group_ingress_rule.ssh', 'cidr_ipv4']
  ]);
  assert.ok(r.findings.every((f) => f.severity === 'error'));
  assert.equal(r.findings[0].manual[0].quote, 'We recommend that no security group allow unrestricted ingress access to port 22.');
});

test('aws sg: near misses are no finding: a port next to 22, a private range, udp, a rule from another group, egress', () => {
  const r = check([
    group([
      rule({ cidr_blocks: WORLD4, from_port: 443, to_port: 443 }),
      rule({ cidr_blocks: WORLD4, from_port: 23, to_port: 3388 }),
      rule({ cidr_blocks: ['10.0.0.0/8'], from_port: 22, to_port: 22 }),
      rule({ cidr_blocks: ['0.0.0.0/1'], from_port: 22, to_port: 22 }),
      rule({ cidr_blocks: WORLD4, from_port: 22, to_port: 22, protocol: 'udp' }),
      rule({ cidr_blocks: WORLD4, from_port: 8, to_port: 0, protocol: 'icmp' }),
      rule({ cidr_blocks: [], from_port: 22, to_port: 22, security_groups: ['sg-1'] })
    ]),
    rc('aws_security_group_rule', 'out', { type: 'egress', cidr_blocks: WORLD4, ipv6_cidr_blocks: [], from_port: 22, to_port: 22, protocol: 'tcp' })
  ]);
  assert.deepEqual(r.findings, []);
});

test('aws sg: all protocols, and tcp over every port, from the internet are one finding about all ports, not ssh and rdp as well', () => {
  const r = check([
    group([rule({ cidr_blocks: WORLD4, from_port: 0, to_port: 0, protocol: '-1' }), rule({ ipv6_cidr_blocks: ['::/0'], from_port: 0, to_port: 65535, protocol: 'tcp' })]),
    rc('aws_vpc_security_group_ingress_rule', 'all', { cidr_ipv4: '0.0.0.0/0', ip_protocol: '-1', from_port: null, to_port: null })
  ]);
  assert.deepEqual(ids(r), ['aws-sg-all-ports-open', 'aws-sg-all-ports-open', 'aws-sg-all-ports-open']);
  assert.match(r.findings[0].message, /all protocols and all ports from 0.0.0.0\/0/);
  assert.match(r.findings[1].message, /TCP on all ports from ::\/0/);
  assert.equal(r.findings[0].manual[0].quote, 'Unless a port is specifically allowed, the port should deny unrestricted access.');
  assert.ok(r.findings[0].manual.some((m) => m.section === 'ingress'));
});

test('aws sg: a rule that has both address families open says so once', () => {
  const r = check([group([rule({ cidr_blocks: WORLD4, ipv6_cidr_blocks: ['::/0'], from_port: 22, to_port: 22 })])]);
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].message, /from 0.0.0.0\/0 and ::\/0/);
});

test('aws sg: a protocol written as a number is not guessed, and a missing port is reported as not read', () => {
  const six = check([group([rule({ cidr_blocks: WORLD4, from_port: 22, to_port: 22, protocol: '6' })])]);
  assert.deepEqual(ids(six), ['value-not-read']);
  assert.match(six.findings[0].message, /protocol name/);
  const noPort = check([group([{ cidr_blocks: WORLD4, protocol: 'tcp', from_port: null, to_port: 22 }])]);
  assert.deepEqual(ids(noPort), ['value-not-read']);
});

test('aws rds: a public instance is an error, an unencrypted one is a warning, and both are one check each', () => {
  const r = check([rc('aws_db_instance', 'db', { identifier: 'db', publicly_accessible: true, storage_encrypted: false })]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.severity, f.attribute]), [['aws-rds-public', 'error', 'publicly_accessible'], ['aws-rds-unencrypted', 'warning', 'storage_encrypted']]);
  assert.match(r.findings[1].message, /false, so the storage/);
});

test('aws rds: a private encrypted instance is no finding, and a field that is left out is read as the provider page says', () => {
  assert.deepEqual(check([rc('aws_db_instance', 'db', { publicly_accessible: false, storage_encrypted: true })]).findings, []);
  const left = check([rc('aws_db_instance', 'db', { identifier: 'db' })]);
  assert.deepEqual(ids(left), ['aws-rds-unencrypted']);
  assert.match(left.findings[0].message, /not set \(the provider default is false\)/);
});

test('aws rds: a read replica is not checked for storage_encrypted, and the report says why', () => {
  const r = check([rc('aws_db_instance', 'replica', { replicate_source_db: 'primary', storage_encrypted: false })]);
  assert.deepEqual(r.findings, []);
  assert.ok(r.notes.some((n) => /replicate_source_db/.test(n)));
});

test('aws ebs: an unencrypted volume is a warning, an encrypted one and a volume with no value are not', () => {
  assert.deepEqual(ids(check([rc('aws_ebs_volume', 'v', { encrypted: false })])), ['aws-ebs-unencrypted']);
  assert.deepEqual(check([rc('aws_ebs_volume', 'v', { encrypted: true })]).findings, []);
  assert.deepEqual(check([rc('aws_ebs_volume', 'v', { size: 10 })]).findings, []);
});

test('aws: the action of an update is named, and a resource that only a delete touches is not read for its attributes', () => {
  const r = check([rc('aws_ebs_volume', 'v', { encrypted: false }, { actions: ['update'], before: { encrypted: false } })]);
  assert.equal(r.findings[0].action, 'update');
  const gone = check([rc('aws_security_group', 'old', {}, { actions: ['delete'], before: { ingress: [rule({ cidr_blocks: WORLD4, from_port: 22, to_port: 22 })] } })]);
  assert.deepEqual(gone.findings, []);
});

test('aws: every finding has the fields a pipeline reads, and the source sentences carry their addresses', () => {
  const r = check([rc('aws_ebs_volume', 'v', { encrypted: false })]);
  const f = r.findings[0];
  assert.deepEqual(Object.keys(f), ['id', 'severity', 'cloud', 'address', 'type', 'attribute', 'action', 'message', 'fix', 'manual']);
  assert.equal(f.type, 'aws_ebs_volume');
  assert.ok(f.manual.length >= 2);
  for (const m of f.manual) assert.match(m.url, /^https:\/\//);
});
