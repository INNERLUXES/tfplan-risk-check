import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, find, ids, rc } from './helpers.js';

const account = (over, opts) => rc('azurerm_storage_account', 'files', { name: 'files', ...over }, opts);
const nsr = (over, opts) => rc('azurerm_network_security_rule', 'r', { name: 'r', direction: 'Inbound', access: 'Allow', protocol: 'Tcp', source_address_prefix: '*', source_address_prefixes: null, destination_port_range: '22', destination_port_ranges: null, ...over }, opts);

test('azure storage: nested items that can be public are an error, with the attribute and the quoted pages of both provider versions', () => {
  const r = check([account({ allow_nested_items_to_be_public: true })]);
  const f = find(r, 'azure-storage-public-blob-access');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
  assert.equal(f[0].attribute, 'allow_nested_items_to_be_public');
  assert.deepEqual(f[0].manual.slice(-2).map((m) => m.page), ['azurerm_storage_account (AzureRM provider 5.8.0)', 'azurerm_storage_account (AzureRM provider 4.64.0)']);
});

test('azure storage: false and a missing value are no finding', () => {
  assert.deepEqual(check([account({ allow_nested_items_to_be_public: false, min_tls_version: 'TLS1_2', public_network_access: 'Disabled' })]).findings, []);
  assert.deepEqual(check([account({})]).findings, []);
});

test('azure storage: a minimum TLS version below 1.2 is a warning for each of the two old values, and 1.2 and 1.3 are not', () => {
  for (const value of ['TLS1_0', 'TLS1_1']) {
    const r = check([account({ min_tls_version: value })]);
    assert.deepEqual(r.findings.map((f) => [f.id, f.severity]), [['azure-storage-min-tls', 'warning']]);
    assert.match(r.findings[0].message, new RegExp(`min_tls_version is ${value}, which is below TLS1_2`));
  }
  for (const value of ['TLS1_2', 'TLS1_3']) assert.deepEqual(check([account({ min_tls_version: value })]).findings, []);
});

test('azure storage: a TLS version that no page lists is reported as not read, and the value is not guessed', () => {
  const r = check([account({ min_tls_version: 'TLS9_9' })]);
  assert.deepEqual(ids(r), ['value-not-read']);
  assert.equal(r.findings[0].message.includes('TLS9_9'), false);
});

test('azure storage: public network access with no network rules is a warning, in the newer and the older attribute', () => {
  const modern = check([account({ public_network_access: 'Enabled', network_rules: [] })]);
  assert.deepEqual(modern.findings.map((f) => [f.id, f.attribute]), [['azure-storage-public-network-access', 'public_network_access']]);
  const older = check([account({ public_network_access_enabled: true })]);
  assert.deepEqual(older.findings.map((f) => [f.id, f.attribute]), [['azure-storage-public-network-access', 'public_network_access_enabled']]);
  assert.equal(older.findings[0].severity, 'warning');
});

test('azure storage: a default action of Deny on the network rules, or public network access turned off, is no finding, and Allow is one', () => {
  assert.deepEqual(check([account({ public_network_access_enabled: true, network_rules: [{ default_action: 'Deny', ip_rules: ['203.0.113.0/24'] }] })]).findings, []);
  assert.deepEqual(check([account({ public_network_access: 'SecuredByPerimeter' })]).findings, []);
  assert.deepEqual(check([account({ public_network_access_enabled: false })]).findings, []);
  assert.deepEqual(ids(check([account({ public_network_access: 'Enabled', network_rules: [{ default_action: 'Allow' }] })])), ['azure-storage-public-network-access']);
});

test('azure storage: network rules in a separate resource are not seen, so the check is not made and the report says why', () => {
  const r = check([account({ public_network_access: 'Enabled' }), rc('azurerm_storage_account_network_rules', 'r', { default_action: 'Deny' })]);
  assert.deepEqual(r.findings, []);
  assert.ok(r.notes.some((n) => /azurerm_storage_account_network_rules/.test(n)));
});

test('azure storage: an unknown network rule or an unknown access setting is reported as unknown and not guessed', () => {
  const r = check([account({ public_network_access: 'Enabled' }, { unknown: { network_rules: true } })]);
  assert.deepEqual(ids(r), ['value-unknown']);
  const action = check([account({ public_network_access: 'Enabled', network_rules: [{}] }, { unknown: { network_rules: [{ default_action: true }] } })]);
  assert.deepEqual(ids(action), ['value-unknown']);
});

test('azure nsg: an inbound allow rule from any source to port 22 or 3389 is an error, with the attribute of the source', () => {
  const ssh = check([nsr({})]);
  assert.deepEqual(ssh.findings.map((f) => [f.id, f.attribute, f.severity]), [['azure-nsg-ssh-open', 'source_address_prefix', 'error']]);
  assert.match(ssh.findings[0].message, /TCP from any source to port 22 \(SSH\)/);
  const rdp = check([nsr({ destination_port_range: '3389', source_address_prefix: 'Internet' })]);
  assert.deepEqual(ids(rdp), ['azure-nsg-rdp-open']);
  assert.match(rdp.findings[0].message, /from Internet to port 3389 \(RDP\)/);
});

test('azure nsg: the other ways to write the whole internet, a list of prefixes, a range and a list of ports are read', () => {
  assert.deepEqual(ids(check([nsr({ source_address_prefix: '', source_address_prefixes: ['10.0.0.0/8', '0.0.0.0/0'] })])), ['azure-nsg-ssh-open']);
  assert.equal(check([nsr({ source_address_prefix: '', source_address_prefixes: ['10.0.0.0/8', '0.0.0.0/0'] })]).findings[0].attribute, 'source_address_prefixes[1]');
  assert.deepEqual(ids(check([nsr({ destination_port_range: '20-30' })])), ['azure-nsg-ssh-open']);
  assert.deepEqual(ids(check([nsr({ destination_port_range: '', destination_port_ranges: ['80', '443', '22'] })])), ['azure-nsg-ssh-open']);
  assert.deepEqual(ids(check([nsr({ source_address_prefix: 'internet' })])), ['azure-nsg-ssh-open']);
});

test('azure nsg: any port from any source and any protocol cover both management ports', () => {
  const r = check([nsr({ destination_port_range: '*', protocol: '*' })]);
  assert.deepEqual(ids(r), ['azure-nsg-ssh-open', 'azure-nsg-rdp-open']);
  assert.match(r.findings[0].message, /all protocols from any source to any port, which includes SSH on port 22/);
});

test('azure nsg: near misses are no finding: deny, outbound, udp, a private source, a tag, another port, a range around the port', () => {
  for (const over of [{ access: 'Deny' }, { direction: 'Outbound' }, { protocol: 'Udp' }, { source_address_prefix: '10.0.0.0/8' }, { source_address_prefix: 'VirtualNetwork' }, { destination_port_range: '23' }, { destination_port_range: '23-3388' }, { destination_port_range: '2200' }]) {
    assert.deepEqual(check([nsr(over)]).findings, [], JSON.stringify(over));
  }
});

test('azure nsg: a port that is not a number, a range or * is reported as not read', () => {
  const r = check([nsr({ destination_port_range: 'ssh' })]);
  assert.deepEqual(ids(r), ['value-not-read']);
});

test('azure nsg: the rules written inline in a network security group are read with their index', () => {
  const inline = (rules) => rc('azurerm_network_security_group', 'g', { name: 'g', security_rule: rules });
  const bad = { name: 'a', direction: 'Inbound', access: 'Allow', protocol: '*', source_address_prefix: '*', source_address_prefixes: [], destination_port_range: '', destination_port_ranges: ['3389'] };
  const good = { ...bad, name: 'b', source_address_prefix: '10.0.0.0/8' };
  const r = check([inline([good, bad])]);
  assert.deepEqual(r.findings.map((f) => [f.id, f.attribute]), [['azure-nsg-rdp-open', 'security_rule[1].source_address_prefix']]);
  assert.deepEqual(check([inline([good])]).findings, []);
});

test('azure nsg: an unknown or sensitive source is reported once and the rule is not judged', () => {
  const unknown = check([nsr({ source_address_prefix: null }, { unknown: { source_address_prefix: true } })]);
  assert.deepEqual(ids(unknown), ['value-unknown']);
  const sensitive = check([nsr({ source_address_prefix: '*' }, { sensitive: { source_address_prefix: true } })]);
  assert.deepEqual(ids(sensitive), ['value-sensitive']);
  assert.equal(JSON.stringify(sensitive).includes('"*"'), false);
});
