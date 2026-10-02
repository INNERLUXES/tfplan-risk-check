import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, find, ids, rc } from './helpers.js';

const fw = (over, opts) => rc('google_compute_firewall', 'f', { name: 'f', network: 'default', direction: 'INGRESS', disabled: false, source_ranges: ['0.0.0.0/0'], allow: [{ protocol: 'tcp', ports: ['22'] }], ...over }, opts);

test('gcp bucket: uniform bucket-level access that is false is a warning, with the attribute and the quoted pages', () => {
  const r = check([rc('google_storage_bucket', 'b', { name: 'b', uniform_bucket_level_access: false })]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.severity, f.attribute, f.cloud]), [['gcp-bucket-uniform-access-off', 'warning', 'uniform_bucket_level_access', 'google']]);
  assert.equal(r.findings[0].manual[0].quote, 'Uniform bucket-level access prevents unintended data exposure from ACLs.');
});

test('gcp bucket: true is no finding, and a value that is left out is read as false, as the provider page says', () => {
  assert.deepEqual(check([rc('google_storage_bucket', 'b', { uniform_bucket_level_access: true })]).findings, []);
  const left = check([rc('google_storage_bucket', 'b', { name: 'b' })]);
  assert.match(left.findings[0].message, /not set \(the provider default is false\)/);
});

test('gcp bucket: an unknown value is info and nothing is guessed', () => {
  const r = check([rc('google_storage_bucket', 'b', { name: 'b' }, { unknown: { uniform_bucket_level_access: true } })]);
  assert.deepEqual(ids(r), ['value-unknown']);
});

test('gcp iam: allUsers and allAuthenticatedUsers as a member are errors, with the role and each its own id', () => {
  const r = check([
    rc('google_storage_bucket_iam_member', 'a', { bucket: 'b', member: 'allUsers', role: 'roles/storage.objectViewer' }),
    rc('google_storage_bucket_iam_member', 'b', { bucket: 'b', member: 'allAuthenticatedUsers', role: 'roles/storage.objectAdmin' })
  ]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.attribute, f.severity]), [['gcp-bucket-public-all-users', 'member', 'error'], ['gcp-bucket-public-all-authenticated', 'member', 'error']]);
  assert.match(r.findings[0].message, /allUsers is granted the role roles\/storage.objectViewer on the bucket, so anyone on the internet/);
  assert.match(r.findings[1].message, /anyone on the internet with a Google Account/);
  assert.equal(r.findings[0].manual[0].quote, 'The value allUsers is a special identifier that represents anyone who is on the internet, including authenticated and unauthenticated users.');
});

test('gcp iam: a binding is read for every member of its list, and the index is in the attribute', () => {
  const r = check([rc('google_storage_bucket_iam_binding', 'a', { bucket: 'b', role: 'roles/storage.objectViewer', members: ['user:a@example.com', 'allUsers', 'allAuthenticatedUsers'] })]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.attribute]), [['gcp-bucket-public-all-users', 'members[1]'], ['gcp-bucket-public-all-authenticated', 'members[2]']]);
});

test('gcp iam: near misses are no finding: a user, a group, a domain, a name that only contains allUsers, a different case', () => {
  for (const member of ['user:a@example.com', 'group:all@example.com', 'domain:example.com', 'serviceAccount:allUsers@example.iam.gserviceaccount.com', 'allusers', 'allUsers ']) {
    assert.deepEqual(check([rc('google_storage_bucket_iam_member', 'a', { bucket: 'b', member, role: 'roles/x' })]).findings, [], member);
  }
});

test('gcp iam: a member list that is unknown until apply is info, and a role that is sensitive is not shown', () => {
  assert.deepEqual(ids(check([rc('google_storage_bucket_iam_binding', 'a', { bucket: 'b' }, { unknown: { members: true } })])), ['value-unknown']);
  const r = check([rc('google_storage_bucket_iam_member', 'a', { bucket: 'b', member: 'allUsers', role: 'roles/secret-role-name' }, { sensitive: { role: true } })]);
  assert.deepEqual(ids(r), ['gcp-bucket-public-all-users', 'value-sensitive']);
  assert.equal(JSON.stringify(r).includes('secret-role-name'), false);
  assert.match(find(r, 'gcp-bucket-public-all-users')[0].message, /granted a role on the bucket/);
});

test('gcp firewall: ingress from 0.0.0.0/0 to tcp 22 and 3389 is an error each, with the attribute of the source', () => {
  const r = check([fw({ allow: [{ protocol: 'tcp', ports: ['22', '3389'] }] })]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.attribute, f.severity]), [['gcp-firewall-ssh-open', 'source_ranges[0]', 'error'], ['gcp-firewall-rdp-open', 'source_ranges[0]', 'error']]);
  assert.match(r.findings[0].message, /from 0.0.0.0\/0, which is any IPv4 address, to TCP port 22 \(SSH\)/);
});

test('gcp firewall: a range of ports, no ports at all on tcp, and the protocol all cover the management ports', () => {
  assert.deepEqual(ids(check([fw({ allow: [{ protocol: 'tcp', ports: ['20-30'] }] })])), ['gcp-firewall-ssh-open']);
  const any = check([fw({ allow: [{ protocol: 'tcp', ports: [] }] })]);
  assert.deepEqual(ids(any), ['gcp-firewall-ssh-open', 'gcp-firewall-rdp-open']);
  assert.match(any.findings[0].message, /any port, which includes SSH on TCP port 22/);
  assert.ok(any.findings[0].manual.some((m) => /applies to connections through any port/.test(m.quote)));
  assert.deepEqual(ids(check([fw({ allow: [{ protocol: 'all', ports: [] }] })])), ['gcp-firewall-ssh-open', 'gcp-firewall-rdp-open']);
});

test('gcp firewall: a rule without a direction is ingress, as the provider page says, and says so', () => {
  const r = check([fw({ direction: undefined })]);
  assert.deepEqual(ids(r), ['gcp-firewall-ssh-open']);
  assert.ok(r.findings[0].manual.some((m) => m.quote === 'Direction of traffic to which this firewall applies; default is INGRESS.'));
});

test('gcp firewall: near misses are no finding: egress, disabled, a private range, udp, another port, a deny rule', () => {
  for (const over of [{ direction: 'EGRESS' }, { disabled: true }, { source_ranges: ['10.0.0.0/8'] }, { source_ranges: [] }, { allow: [{ protocol: 'udp', ports: ['22'] }] }, { allow: [{ protocol: 'tcp', ports: ['2222', '443'] }] }, { allow: [{ protocol: 'icmp' }] }, { allow: [], deny: [{ protocol: 'tcp', ports: ['22'] }] }]) {
    assert.deepEqual(check([fw(over)]).findings, [], JSON.stringify(over));
  }
});

test('gcp firewall: the first allow block that matches is named, and each block is read on its own', () => {
  const r = check([fw({ allow: [{ protocol: 'tcp', ports: ['443'] }, { protocol: 'tcp', ports: ['3389'] }] })]);
  assert.deepEqual(ids(r), ['gcp-firewall-rdp-open']);
});

test('gcp firewall: a port that is not a number or a range is reported as not read', () => {
  assert.deepEqual(ids(check([fw({ allow: [{ protocol: 'tcp', ports: ['ssh'] }] })])), ['value-not-read']);
});

test('gcp firewall: an unknown list of source ranges is reported as unknown and the rule is not judged', () => {
  assert.deepEqual(ids(check([fw({ source_ranges: null }, { unknown: { source_ranges: true } })])), ['value-unknown']);
});
