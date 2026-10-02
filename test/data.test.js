import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { ADMIN_PORTS, ATTRS, AWS_WORLD, AZURE_WORLD, FACTS, FINDINGS, GCP_PUBLIC_MEMBERS, GCP_WORLD, IAM_MEMBERS_SNIPPET, ORDER, PAB_SETTINGS, READER_FACTS, SEVERITIES, SOURCES, STATEFUL_TYPES, TLS_AT_LEAST_1_2, TLS_BELOW_1_2, VALUE_NOTES, manualFor, sourceLabel, sourceUrl } from '../src/index.js';

const dir = new URL('../research/sources/', import.meta.url);
const page = async (id) => readFile(new URL(SOURCES.find((s) => s.id === id).file, dir), 'utf8');
const quotes = (t) => t.split(String.fromCharCode(0x2019)).join("'").split(String.fromCharCode(0x2018)).join("'").split(String.fromCharCode(0x201c)).join('"').split(String.fromCharCode(0x201d)).join('"');
// Text compared without line breaks, runs of white space or the typographic quotes.
// The saved plan format page keeps the comment markers of its pseudo-JSON; they are not part of the sentences.
const flat = (t) => quotes(t).replace(/(^|\n)[ \t]*\/\/ ?/g, ' ').replace(/\s+/g, ' ').trim();
const has = (text, needle) => flat(text).includes(flat(needle));

// The text of one section of a saved page: from its heading to the next heading.
function section(text, title) {
  const lines = text.split('\n');
  const at = lines.indexOf(`# ${title}`);
  assert.ok(at >= 0, `# ${title}`);
  let end = at + 1;
  while (end < lines.length && !lines[end].startsWith('# ')) end += 1;
  return lines.slice(at, end).join('\n');
}

test('sources: every saved page has its address on the first line and holds text', async () => {
  for (const s of SOURCES) {
    const text = await page(s.id);
    assert.equal(text.split('\n')[0], `Source: ${s.url}`, s.file);
    assert.ok(text.length > 1500, `${s.file} holds the page text`);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.url)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.file)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.id)).size);
});

test('sources: every file in research/sources is listed in src/data.js, and the other way round', async () => {
  const files = (await readdir(dir)).sort();
  assert.deepEqual(files, SOURCES.map((s) => s.file).sort());
});

test('sources: the pages come from the Terraform, provider, AWS, Microsoft and Google documentation only', () => {
  const hosts = new Set(['developer.hashicorp.com', 'registry.terraform.io', 'docs.aws.amazon.com', 'learn.microsoft.com', 'cloud.google.com']);
  for (const s of SOURCES) {
    const url = new URL(s.url);
    assert.equal(url.protocol, 'https:', s.url);
    assert.ok(hosts.has(url.hostname), s.url);
    assert.equal(url.search, '', s.url);
    assert.equal(url.hash, '', s.url);
  }
  assert.equal(sourceUrl('tfjson'), 'https://developer.hashicorp.com/terraform/internals/json-format');
  assert.equal(sourceLabel('tfsa4'), 'azurerm_storage_account (AzureRM provider 4.64.0)');
});

test('sources: a provider page names the provider version in its address, so the saved text is the text of that version', () => {
  for (const s of SOURCES.filter((x) => x.url.startsWith('https://registry.terraform.io/'))) assert.match(s.url, /\/providers\/hashicorp\/(?:aws|azurerm|google)\/\d+\.\d+\.\d+\/docs\/resources\/[a-z0-9_]+$/, s.url);
});

test('sources: the title of every page is a heading of the saved text', async () => {
  for (const s of SOURCES) {
    const lines = (await page(s.id)).split('\n');
    assert.ok(lines.includes(`# ${s.title}`), `${s.file}: # ${s.title}`);
  }
});

test('sources: a page that is an extract says so on the second line, and the other pages do not', async () => {
  assert.deepEqual(SOURCES.filter((s) => s.extract).map((s) => s.id), ['shec2', 'shrds', 'shs3', 'gcpfw', 'gcpscc']);
  for (const s of SOURCES) {
    const second = (await page(s.id)).split('\n')[1];
    assert.equal(second.startsWith('Extract: '), s.extract === true, s.file);
  }
});

test('facts: every quoted sentence is on the saved page it names, word for word', async () => {
  assert.ok(Object.keys(FACTS).length >= 50);
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(SOURCES.some((s) => s.id === fact.source), `${key}: source`);
    assert.ok(has(await page(fact.source), fact.text), `${key}: "${fact.text}"`);
  }
});

test('facts: the section of every fact is a heading of the saved page, and the sentence is under it', async () => {
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(has(section(await page(fact.source), fact.section), fact.text), `${key}: the sentence is under ${fact.section}`);
  }
});

test('facts: the sentences that the reader rests on are on the saved plan format page, under their section', async () => {
  for (const [key, fact] of Object.entries(READER_FACTS)) {
    assert.equal(fact.source, 'tfjson', key);
    assert.ok(has(section(await page(fact.source), fact.section), fact.text), `${key}: "${fact.text}"`);
  }
});

test('facts: no sentence is quoted twice under two names', () => {
  const seen = new Map();
  for (const [key, fact] of [...Object.entries(FACTS), ...Object.entries(READER_FACTS)]) {
    const id = `${fact.source}|${flat(fact.text)}`;
    assert.ok(!seen.has(id), `${key} repeats ${seen.get(id)}`);
    seen.set(id, key);
  }
});

test('attributes: every attribute name that a check reads is a bullet of the saved provider page of that resource', async () => {
  for (const [type, entry] of Object.entries(ATTRS)) {
    const text = await page(entry.source);
    for (const name of entry.names) assert.match(text, new RegExp(`^\\s*\\* \`${name}\` ?(?:-|\\()`, 'm'), `${type}: ${name}`);
  }
  const iam = await page('tfgiam');
  assert.ok(iam.includes(IAM_MEMBERS_SNIPPET));
  assert.equal(Object.keys(ATTRS).length, 14);
});

test('sources: every saved page is used: by a quoted sentence, a value note or an attribute of a check', async () => {
  const used = new Set([...Object.values(FACTS), ...Object.values(READER_FACTS), ...VALUE_NOTES, ...Object.values(ATTRS)].map((x) => x.source));
  for (const s of SOURCES) assert.ok(used.has(s.id), `${s.id} is not used`);
});

test('attributes: the four settings of a public access block are the four arguments of the provider page with a default of false', async () => {
  const text = await page('tfpab');
  assert.equal(PAB_SETTINGS.length, 4);
  for (const name of PAB_SETTINGS) assert.match(text, new RegExp(`\\* \`${name}\` - \\(Optional\\) Whether Amazon S3 should [^\\n]*Defaults to \`false\``), name);
});

test('values: the notes about a value, a default or a list of values are on the saved pages', async () => {
  for (const n of VALUE_NOTES) assert.ok(has(section(await page(n.source), n.section), n.text), `${n.source}: ${n.text}`);
});

test('values: the sources that mean the whole internet are written on the saved pages of their cloud', async () => {
  const ec2 = await page('shec2');
  assert.deepEqual(AWS_WORLD, ['0.0.0.0/0', '::/0']);
  assert.ok(ec2.includes('[EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22'));
  assert.ok(ec2.includes('[EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389'));
  assert.deepEqual(AZURE_WORLD, ['*', '0.0.0.0/0', 'Internet']);
  assert.ok(has(await page('tfnsr'), 'CIDR or source IP range or * to match any IP. Tags such as `VirtualNetwork`, `AzureLoadBalancer` and `Internet` can also be used.'));
  assert.ok((await page('aznsg')).includes('0.0.0.0/0 in the Source and Destination columns represents all IP addresses'));
  assert.deepEqual(GCP_WORLD, ['0.0.0.0/0']);
  assert.ok((await page('gcpfw')).includes('The default source is any IPv4 address (0.0.0.0/0)'));
});

test('values: the special identifiers of Google Cloud are on the IAM page and on the provider page', async () => {
  assert.deepEqual(Object.keys(GCP_PUBLIC_MEMBERS), ['allUsers', 'allAuthenticatedUsers']);
  const iam = await page('gcpiam');
  const provider = await page('tfgiam');
  for (const name of Object.keys(GCP_PUBLIC_MEMBERS)) {
    assert.ok(iam.includes(`The value ${name} is a special identifier`), name);
    assert.ok(provider.includes(`**${name}**: A special identifier`), name);
  }
});

test('values: the management ports are 22 for SSH and 3389 for RDP, as three saved pages name them', async () => {
  assert.deepEqual(ADMIN_PORTS.map((p) => [p.port, p.name, p.key]), [[22, 'SSH', 'ssh'], [3389, 'RDP', 'rdp']]);
  const ec2 = await page('shec2');
  const usage = await page('azjitusage');
  for (const p of ADMIN_PORTS) {
    assert.ok(ec2.includes(`${p.port} (${p.name})`), `${p.port} in the AWS controls`);
    assert.ok(usage.includes(`${p.port} - ${p.name}`), `${p.port} in the Microsoft page`);
    assert.ok(ec2.includes(`to port ${p.port}`), `${p.port} in the control title`);
  }
});

test('values: the TLS versions are the values that the provider page of version 4.64.0 lists, and the newer page lists only TLS1_2', async () => {
  const older = await page('tfsa4');
  assert.ok(has(older, 'Possible values are `TLS1_0`, `TLS1_1`, `TLS1_2` and `TLS1_3`.'));
  assert.deepEqual(TLS_BELOW_1_2, ['TLS1_0', 'TLS1_1']);
  assert.deepEqual(TLS_AT_LEAST_1_2, ['TLS1_2', 'TLS1_3']);
  assert.ok(has(await page('tfsa'), 'The only possible value is `TLS1_2`.'));
  assert.ok((await page('aztls')).includes('The recommended minimum TLS version is TLS 1.2.'));
});

test('stateful: the lifecycle page names databases, storage and other stateful resources, and each type has a cloud prefix', async () => {
  assert.ok(has(await page('tflife'), 'such as database instances, storage, or other stateful resources'));
  assert.deepEqual(Object.keys(STATEFUL_TYPES).sort(), ['aws_db_instance', 'aws_ebs_volume', 'aws_s3_bucket', 'azurerm_managed_disk', 'azurerm_storage_account', 'google_compute_disk', 'google_sql_database_instance', 'google_storage_bucket']);
  const prefix = { aws: 'aws_', azure: 'azurerm_', google: 'google_' };
  for (const [type, def] of Object.entries(STATEFUL_TYPES)) {
    assert.ok(type.startsWith(prefix[def.cloud]), type);
    for (const e of def.extra) assert.ok(FACTS[e.fact], `${type}: ${e.fact}`);
  }
});

test('findings: every check has a unique id, a severity, an order, a cloud and facts that exist', () => {
  assert.ok(FINDINGS.length >= 20);
  assert.equal(new Set(FINDINGS.map((f) => f.id)).size, FINDINGS.length);
  for (const f of FINDINGS) {
    assert.match(f.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(SEVERITIES.includes(f.severity), f.id);
    assert.ok(['aws', 'azure', 'google', 'terraform'].includes(f.cloud), f.id);
    assert.equal(typeof ORDER[f.id], 'number');
    for (const key of [...f.facts, ...(f.optional ?? [])]) assert.ok(FACTS[key], `${f.id}: ${key}`);
    if (f.cloud !== 'terraform') assert.ok(f.id.startsWith(f.cloud === 'google' ? 'gcp-' : `${f.cloud}-`), f.id);
  }
  const rank = FINDINGS.map((f) => SEVERITIES.indexOf(f.severity));
  assert.deepEqual(rank, [...rank].sort((a, b) => a - b));
});

test('findings: every fact of data.js is used by at least one check', () => {
  const used = new Set(FINDINGS.flatMap((f) => [...f.facts, ...(f.optional ?? [])]));
  for (const key of Object.keys(FACTS)) assert.ok(used.has(key), `${key} is not quoted by any check`);
});

test('findings: the checks that rest on a page quote it, and the one about a form that the tool cannot read does not', () => {
  for (const f of FINDINGS) assert.equal(f.facts.length === 0, f.id === 'value-not-read', f.id);
  const m = manualFor('aws-sg-ssh-open');
  assert.equal(m.length, 3);
  assert.deepEqual(Object.keys(m[0]).sort(), ['page', 'quote', 'section', 'title', 'url']);
  assert.equal(m[0].url, 'https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html');
  assert.equal(m[0].page, 'AWS Security Hub, EC2 controls');
  assert.throws(() => manualFor('aws-sg-ssh-open', ['tf-db-public']), /does not quote/);
});

test('findings: errors open a resource to the internet or switch off a block, and info never reads like a risk', () => {
  const errors = FINDINGS.filter((f) => f.severity === 'error').map((f) => f.id);
  for (const id of errors) assert.match(id, /open$|public|off$|blob-access$/, id);
  assert.deepEqual(FINDINGS.filter((f) => f.severity === 'info').map((f) => f.id), ['value-unknown', 'value-sensitive', 'value-not-read']);
});

test('findings: no check is written for a fact that no saved page states (the limits document lists those)', () => {
  const text = JSON.stringify(FINDINGS);
  for (const dropped of ['cloudtrail', 'iam-wildcard', 'kms', 'azure-nsg-all-ports', 'aws-s3-versioning', 'gcp-firewall-all-ports']) assert.ok(!text.includes(dropped), dropped);
});
