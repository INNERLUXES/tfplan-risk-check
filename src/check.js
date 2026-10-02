// Reads a plan, runs the checks and returns one report. The tool reads the one file it is given and opens no connection:
// it never runs Terraform and never calls a cloud. docs/method.md gives the reason behind every finding. No value of the
// plan is copied into a finding except what the finding is about: the resource address, the attribute path, the name of
// a role or a TLS version that the check compared, and constants of the check itself. A value that the plan marks
// sensitive is never read, so it cannot be shown, and a value that is unknown until apply is never guessed.

import { ADMIN_PORTS, AWS_WORLD, AZURE_WORLD, FACTS, GCP_PUBLIC_MEMBERS, GCP_WORLD, PAB_SETTINGS, PLAN_LIMITS, STATEFUL_TYPES, TLS_AT_LEAST_1_2, TLS_BELOW_1_2, sourceLabel, sourceTitle, sourceUrl } from './data.js';
import { decodePlan } from './files.js';
import { FINDINGS, ORDER, RANK, SEVERITIES, meetsThreshold, safeText } from './rules.js';
import { baseAddress, isObject, lookup, lookupBefore, pathText, readPlan } from './plan.js';

export const LIMITS = { ...PLAN_LIMITS };
export { FINDINGS, RANK, SEVERITIES, meetsThreshold, safeText };

const BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

// The sentences of the pages that a finding quotes.
export function manualFor(id, extraFacts = []) {
  for (const key of extraFacts) if (!(BY_ID[id].optional ?? []).includes(key)) throw new Error(`${id} does not quote ${key}`);
  return [...BY_ID[id].facts, ...extraFacts].map((key) => {
    const fact = FACTS[key];
    return { page: sourceLabel(fact.source), title: sourceTitle(fact.source), section: fact.section, url: sourceUrl(fact.source), quote: fact.text };
  });
}

const NOUN = {
  aws_db_instance: 'DB instance',
  aws_s3_bucket: 'bucket',
  aws_ebs_volume: 'volume',
  azurerm_storage_account: 'storage account',
  azurerm_managed_disk: 'managed disk',
  google_storage_bucket: 'bucket',
  google_sql_database_instance: 'database instance',
  google_compute_disk: 'disk'
};

// ---- reading values of the plan without printing them

const isWorld = (list, value) => list.includes(value);

// Reads an attribute after the change as a given kind: boolean, string, integer or list. Returns { state, value } where
// state is value, absent or skip. A sensitive value, an unknown value and a value of another kind are reported once as
// an info finding and give skip, so the check on them is not made and nothing is guessed.
function makeReader(unreadable) {
  return function read(res, path, kind) {
    const r = lookup(res, path);
    if (r.state === 'sensitive') {
      unreadable('value-sensitive', res, path, kind);
      return { state: 'skip' };
    }
    if (r.state === 'unknown') {
      unreadable('value-unknown', res, path, kind);
      return { state: 'skip' };
    }
    if (r.state === 'absent') return { state: 'absent' };
    const v = r.value;
    const ok = kind === 'boolean' ? typeof v === 'boolean' : kind === 'string' ? typeof v === 'string' : kind === 'integer' ? Number.isInteger(v) : kind === 'list' ? Array.isArray(v) : true;
    if (!ok) {
      unreadable('value-not-read', res, path, kind);
      return { state: 'skip' };
    }
    return { state: 'value', value: v };
  };
}

const KIND_TEXT = { boolean: 'true or false', string: 'text', integer: 'a whole number', list: 'a list' };

// Checks every type that the tool reads. Each function gets the resource and the helpers.
export function checkPlan(input, { target = 'plan.json', failOn = 'error', version = '0.0.0', limits = LIMITS } = {}) {
  const text = typeof input === 'string' ? input : decodePlan(input);
  const bytes = Buffer.byteLength(text);
  const plan = readPlan(text, limits);
  const found = [];
  const notes = [...plan.notes];
  const once = new Set();

  const emit = (id, res, f) => {
    const def = BY_ID[id];
    found.push({
      id,
      severity: def.severity,
      cloud: def.cloud,
      address: safeText(res.address, 300),
      type: safeText(res.type, 120),
      attribute: safeText(f.attribute ?? '(resource)', 300),
      action: res.action,
      message: f.message,
      fix: f.fix,
      manual: manualFor(id, f.extraFacts ?? []),
      order: res.index
    });
  };

  const unreadable = (id, res, path, kind) => {
    const key = `${id}|${res.address}|${pathText(path)}`;
    if (once.has(key)) return;
    once.add(key);
    const at = pathText(path);
    if (id === 'value-sensitive') emit(id, res, { attribute: at, message: `${at} is marked sensitive in the plan, so its value was not read and is not shown, and the check on it was not made.`, fix: 'Review this setting by hand, or keep the setting that a check needs out of a sensitive value.' });
    else if (id === 'value-unknown') emit(id, res, { attribute: at, message: `${at} is not known until apply, so the check on it was not made and nothing was guessed.`, fix: 'Make the value one that Terraform can know at plan time, or review it by hand after apply.' });
    else emit(id, res, { attribute: at, message: `The value of ${at} is not ${KIND_TEXT[kind] ?? kind}, which is the form that the provider page lists, so the check on it was not made.`, fix: 'Review this setting by hand.' });
  };
  const read = makeReader(unreadable);

  // The text items of a list attribute: [{ index, value }]. An item that is unknown or sensitive is reported and left out.
  const strings = (res, path) => {
    const list = read(res, path, 'list');
    if (list.state !== 'value') return [];
    const items = [];
    list.value.forEach((_, index) => {
      const item = read(res, [...path, index], 'string');
      if (item.state === 'value') items.push({ index, value: item.value });
    });
    return items;
  };

  // ---- AWS: S3 public access blocks and buckets

  const blocks = [...plan.resources, ...plan.plannedOnly].filter((r) => r.type === 'aws_s3_bucket_public_access_block' && r.mode === 'managed' && r.after !== null && !r.deposed);
  const targetOf = (pab) => {
    const prefix = pab.module === '' ? '' : `${baseAddress(pab.module)}.`;
    const expr = plan.config.get(`${prefix}${pab.type}.${pab.name}`)?.bucket;
    const matches = new Set();
    let literal = null;
    const bucket = lookup(pab, ['bucket']);
    if (bucket.state === 'known' && typeof bucket.value === 'string') literal = bucket.value;
    if (isObject(expr)) {
      if (literal === null && typeof expr.constant_value === 'string') literal = expr.constant_value;
      if (Array.isArray(expr.references)) {
        for (const ref of expr.references) {
          if (typeof ref !== 'string') continue;
          const m = /^aws_s3_bucket\.([A-Za-z0-9_-]+)(?:$|[.[])/.exec(ref);
          if (m !== null) matches.add(`${prefix}aws_s3_bucket.${m[1]}`);
        }
      }
    }
    return { matches, literal, unresolved: literal === null && matches.size === 0 };
  };
  const targets = blocks.map(targetOf);

  const checkAwsBucket = (res) => {
    const base = baseAddress(res.address);
    const names = [];
    for (const key of ['bucket', 'id']) {
      const v = lookup(res, [key]);
      if (v.state === 'known' && typeof v.value === 'string') names.push(v.value);
    }
    const covered = targets.some((t) => t.matches.has(base) || (t.literal !== null && names.includes(t.literal)));
    if (covered) return;
    if (targets.some((t) => t.unresolved)) {
      emit('value-unknown', res, { attribute: 'bucket', message: 'The plan has an aws_s3_bucket_public_access_block that points at its bucket with a value that is not known until apply, so the tool cannot tell whether it covers this bucket, and the check was not made.', fix: 'Point the public access block at the bucket with a reference to the bucket resource, so the plan shows the link.' });
      return;
    }
    emit('aws-s3-public-access-block-missing', res, { attribute: '(resource)', message: 'No aws_s3_bucket_public_access_block in the plan points at this bucket, so this plan sets no Block Public Access setting on it. A setting made on the account or the organization outside this plan is not seen.', fix: 'Add an aws_s3_bucket_public_access_block for the bucket with block_public_acls, block_public_policy, ignore_public_acls and restrict_public_buckets all true.' });
  };

  const SETTING_FACT = { block_public_acls: 'tf-pab-block-public-acls', block_public_policy: 'tf-pab-block-public-policy', ignore_public_acls: 'tf-pab-ignore-public-acls', restrict_public_buckets: 'tf-pab-restrict-public-buckets' };
  const checkAwsBlock = (res) => {
    for (const setting of PAB_SETTINGS) {
      const v = read(res, [setting], 'boolean');
      if (v.state === 'skip' || (v.state === 'value' && v.value === true)) continue;
      emit('aws-s3-public-access-block-off', res, { attribute: setting, message: `${setting} is ${v.state === 'absent' ? 'not set (the provider default is false)' : 'false'}, so this part of S3 Block Public Access is off for the bucket.`, fix: `Set ${setting} to true; the four settings are recommended together.`, extraFacts: [SETTING_FACT[setting]] });
    }
  };

  // ---- AWS: security groups

  const awsPorts = (res, protoPath, fromPath, toPath) => {
    const proto = read(res, protoPath, 'string');
    if (proto.state !== 'value') return null;
    const p = proto.value.toLowerCase();
    if (p === '-1' || p === 'all') return { all: true, ssh: false, rdp: false, p };
    if (p !== 'tcp' && p !== 'udp') {
      if (/^\d+$/.test(p)) unreadable('value-not-read', res, protoPath, 'a protocol name');
      return null;
    }
    const from = read(res, fromPath, 'integer');
    const to = read(res, toPath, 'integer');
    if (from.state !== 'value' || to.state !== 'value') {
      if (from.state === 'absent' || to.state === 'absent') unreadable('value-not-read', res, from.state === 'absent' ? fromPath : toPath, 'integer');
      return null;
    }
    const all = from.value <= 0 && to.value >= 65535;
    return { all, ssh: !all && p === 'tcp' && from.value <= 22 && to.value >= 22, rdp: !all && p === 'tcp' && from.value <= 3389 && to.value >= 3389, p };
  };

  const reportAwsRule = (res, hits, ports, worldPath) => {
    const worldText = hits.includes('0.0.0.0/0') && hits.includes('::/0') ? '0.0.0.0/0 and ::/0' : hits[0];
    if (ports.all) {
      emit('aws-sg-all-ports-open', res, { attribute: worldPath, message: `An ingress rule allows ${ports.p === '-1' || ports.p === 'all' ? 'all protocols and all ports' : `${ports.p.toUpperCase()} on all ports`} from ${worldText}, which is the whole internet.`, fix: 'Open only the ports that the service needs, and only to the sources that need them.', extraFacts: ports.p === '-1' || ports.p === 'all' ? ['tf-sg-protocol-all', 'tf-sg-ingress-protocol', 'tf-ingress-rule-protocol'] : [] });
      return;
    }
    for (const admin of ADMIN_PORTS) {
      if (!ports[admin.key]) continue;
      emit(`aws-sg-${admin.key}-open`, res, { attribute: worldPath, message: `An ingress rule allows TCP port ${admin.port} (${admin.name}) from ${worldText}, which is the whole internet.`, fix: `Limit the source to the addresses that need ${admin.name} access (a CIDR block of your own, or the security group of a bastion host), or remove the rule.` });
    }
  };

  const checkAwsGroup = (res) => {
    const list = read(res, ['ingress'], 'list');
    if (list.state !== 'value') return;
    list.value.forEach((_, i) => {
      const hits = [];
      let worldPath = null;
      for (const key of ['cidr_blocks', 'ipv6_cidr_blocks']) {
        for (const item of strings(res, ['ingress', i, key])) {
          if (isWorld(AWS_WORLD, item.value)) {
            hits.push(item.value);
            worldPath ??= pathText(['ingress', i, key, item.index]);
          }
        }
      }
      if (hits.length === 0) return;
      const ports = awsPorts(res, ['ingress', i, 'protocol'], ['ingress', i, 'from_port'], ['ingress', i, 'to_port']);
      if (ports !== null) reportAwsRule(res, hits, ports, worldPath);
    });
  };

  const checkAwsRule = (res) => {
    const type = read(res, ['type'], 'string');
    if (type.state !== 'value' || type.value !== 'ingress') return;
    const hits = [];
    let worldPath = null;
    for (const key of ['cidr_blocks', 'ipv6_cidr_blocks']) {
      for (const item of strings(res, [key])) {
        if (isWorld(AWS_WORLD, item.value)) {
          hits.push(item.value);
          worldPath ??= pathText([key, item.index]);
        }
      }
    }
    if (hits.length === 0) return;
    const ports = awsPorts(res, ['protocol'], ['from_port'], ['to_port']);
    if (ports !== null) reportAwsRule(res, hits, ports, worldPath);
  };

  const checkAwsIngressRule = (res) => {
    const hits = [];
    let worldPath = null;
    for (const key of ['cidr_ipv4', 'cidr_ipv6']) {
      const v = read(res, [key], 'string');
      if (v.state === 'value' && isWorld(AWS_WORLD, v.value)) {
        hits.push(v.value);
        worldPath ??= key;
      }
    }
    if (hits.length === 0) return;
    const ports = awsPorts(res, ['ip_protocol'], ['from_port'], ['to_port']);
    if (ports !== null) reportAwsRule(res, hits, ports, worldPath);
  };

  // ---- AWS: RDS and EBS

  const checkAwsDb = (res) => {
    const pub = read(res, ['publicly_accessible'], 'boolean');
    if (pub.state === 'value' && pub.value === true) emit('aws-rds-public', res, { attribute: 'publicly_accessible', message: 'publicly_accessible is true, so the DB instance is planned as an Internet-facing instance.', fix: 'Set publicly_accessible to false and reach the database from inside the network.' });
    const replica = lookup(res, ['replicate_source_db']);
    if (replica.state !== 'absent') {
      once.add('replica-note');
      return;
    }
    const enc = read(res, ['storage_encrypted'], 'boolean');
    if (enc.state === 'absent' || (enc.state === 'value' && enc.value === false)) emit('aws-rds-unencrypted', res, { attribute: 'storage_encrypted', message: `storage_encrypted is ${enc.state === 'absent' ? 'not set (the provider default is false)' : 'false'}, so the storage of the DB instance is not encrypted at rest.`, fix: 'Set storage_encrypted to true.' });
  };

  const checkAwsEbs = (res) => {
    const enc = read(res, ['encrypted'], 'boolean');
    if (enc.state === 'value' && enc.value === false) emit('aws-ebs-unencrypted', res, { attribute: 'encrypted', message: 'encrypted is false, so the volume is planned without encryption at rest.', fix: 'Set encrypted to true.' });
  };

  // ---- Azure

  const separateRules = plan.resources.filter((r) => r.type === 'azurerm_storage_account_network_rules').length;
  const checkAzureStorage = (res) => {
    const nested = read(res, ['allow_nested_items_to_be_public'], 'boolean');
    if (nested.state === 'value' && nested.value === true) emit('azure-storage-public-blob-access', res, { attribute: 'allow_nested_items_to_be_public', message: 'allow_nested_items_to_be_public is true, so containers in the storage account can be set up for anonymous read access.', fix: 'Set allow_nested_items_to_be_public to false.', extraFacts: ['tf-azsa-nested-5', 'tf-azsa-nested-4'] });

    const tls = read(res, ['min_tls_version'], 'string');
    if (tls.state === 'value') {
      if (TLS_BELOW_1_2.includes(tls.value)) emit('azure-storage-min-tls', res, { attribute: 'min_tls_version', message: `min_tls_version is ${tls.value}, which is below TLS1_2, the minimum that Microsoft recommends.`, fix: 'Set min_tls_version to TLS1_2.' });
      else if (!TLS_AT_LEAST_1_2.includes(tls.value)) unreadable('value-not-read', res, ['min_tls_version'], 'a TLS version name');
    }

    let open = null;
    let attribute = null;
    const modern = read(res, ['public_network_access'], 'string');
    if (modern.state === 'value') {
      attribute = 'public_network_access';
      open = modern.value === 'Enabled';
    }
    const legacy = read(res, ['public_network_access_enabled'], 'boolean');
    if (legacy.state === 'value' && open === null) {
      attribute = 'public_network_access_enabled';
      open = legacy.value === true;
    }
    if (open !== true) return;
    if (separateRules > 0) {
      once.add('network-rules-note');
      return;
    }
    const rules = read(res, ['network_rules'], 'list');
    if (rules.state === 'skip') return;
    if (rules.state === 'value' && rules.value.length > 0) {
      const action = read(res, ['network_rules', 0, 'default_action'], 'string');
      if (action.state === 'skip') return;
      if (action.state === 'value' && action.value === 'Deny') return;
      if (action.state === 'value' && action.value !== 'Allow') {
        unreadable('value-not-read', res, ['network_rules', 0, 'default_action'], 'Allow or Deny');
        return;
      }
    }
    emit('azure-storage-public-network-access', res, { attribute, message: 'The storage account has public network access enabled and no network rule that denies by default, so its public endpoint answers connections from any network.', fix: 'Turn public network access off (public_network_access = "Disabled", or public_network_access_enabled = false in the older provider), or add network_rules with default_action = "Deny" and list the networks that need access.', extraFacts: ['tf-azsa-access-5', 'tf-azsa-access-4', 'tf-azsa-rules'] });
  };

  // One port entry of a network security rule: "*", a number or a range "a-b". Returns [low, high] or null.
  const portRange = (entry) => {
    if (entry === '*') return [0, 65535];
    let m = /^(\d{1,5})$/.exec(entry);
    if (m !== null) return [Number(m[1]), Number(m[1])];
    m = /^(\d{1,5})-(\d{1,5})$/.exec(entry);
    return m === null ? null : [Number(m[1]), Number(m[2])];
  };

  // A network security rule at a path prefix: [] for azurerm_network_security_rule, ['security_rule', i] inline.
  const checkAzureRule = (res, prefix) => {
    const direction = read(res, [...prefix, 'direction'], 'string');
    const access = read(res, [...prefix, 'access'], 'string');
    if (direction.state !== 'value' || access.state !== 'value') return;
    if (direction.value.toLowerCase() !== 'inbound' || access.value.toLowerCase() !== 'allow') return;
    const sources = [];
    const single = read(res, [...prefix, 'source_address_prefix'], 'string');
    if (single.state === 'value') sources.push({ value: single.value, path: [...prefix, 'source_address_prefix'] });
    for (const item of strings(res, [...prefix, 'source_address_prefixes'])) sources.push({ value: item.value, path: [...prefix, 'source_address_prefixes', item.index] });
    const world = sources.find((s) => AZURE_WORLD.some((w) => w.toLowerCase() === s.value.toLowerCase()));
    if (world === undefined) return;
    const worldName = AZURE_WORLD.find((w) => w.toLowerCase() === world.value.toLowerCase());
    const proto = read(res, [...prefix, 'protocol'], 'string');
    if (proto.state !== 'value') return;
    const p = proto.value.toLowerCase();
    if (p !== 'tcp' && p !== '*') return;
    const entries = [];
    const one = read(res, [...prefix, 'destination_port_range'], 'string');
    if (one.state === 'value' && one.value !== '') entries.push(one.value);
    for (const item of strings(res, [...prefix, 'destination_port_ranges'])) if (item.value !== '') entries.push(item.value);
    const ranges = [];
    for (const entry of entries) {
      const r = portRange(entry);
      if (r === null) unreadable('value-not-read', res, [...prefix, 'destination_port_range'], 'a port, a range or *');
      else ranges.push({ entry, r });
    }
    for (const admin of ADMIN_PORTS) {
      const hit = ranges.find(({ r }) => r[0] <= admin.port && admin.port <= r[1]);
      if (hit === undefined) continue;
      const portText = hit.entry === '*' ? `any port, which includes ${admin.name} on port ${admin.port}` : `port ${admin.port} (${admin.name})`;
      emit(`azure-nsg-${admin.key}-open`, res, { attribute: pathText(world.path), message: `An inbound rule allows ${p === '*' ? 'all protocols' : 'TCP'} from ${worldName === '*' ? 'any source' : worldName} to ${portText}, so ${admin.name} is open to the internet.`, fix: `Limit the source to the addresses that need ${admin.name} access, or use just-in-time access, or remove the rule.`, extraFacts: ['tf-nsr-source', 'tf-nsr-protocol', 'az-nsg-any'] });
    }
  };

  const checkAzureGroup = (res) => {
    const list = read(res, ['security_rule'], 'list');
    if (list.state !== 'value') return;
    list.value.forEach((_, i) => checkAzureRule(res, ['security_rule', i]));
  };

  // ---- Google Cloud

  const checkGcpBucket = (res) => {
    const v = read(res, ['uniform_bucket_level_access'], 'boolean');
    if (v.state === 'absent' || (v.state === 'value' && v.value === false)) emit('gcp-bucket-uniform-access-off', res, { attribute: 'uniform_bucket_level_access', message: `uniform_bucket_level_access is ${v.state === 'absent' ? 'not set (the provider default is false)' : 'false'}, so ACLs stay active on the bucket next to IAM.`, fix: 'Set uniform_bucket_level_access to true.' });
  };

  const publicMember = (res, member, path) => {
    const key = Object.hasOwn(GCP_PUBLIC_MEMBERS, member) ? GCP_PUBLIC_MEMBERS[member] : null;
    if (key === null) return;
    const role = read(res, ['role'], 'string');
    const roleText = role.state === 'value' ? ` the role ${safeText(role.value, 100)}` : ' a role';
    emit(`gcp-bucket-public-${key}`, res, { attribute: pathText(path), message: `${member} is granted${roleText} on the bucket, so ${member === 'allUsers' ? 'anyone on the internet' : 'anyone on the internet with a Google Account'} gets that access.`, fix: 'Grant the role to the identities that need it (users, groups or service accounts), and not to a special identifier for everyone.' });
  };

  const checkGcpIamMember = (res) => {
    const member = read(res, ['member'], 'string');
    if (member.state === 'value') publicMember(res, member.value, ['member']);
  };
  const checkGcpIamBinding = (res) => {
    for (const item of strings(res, ['members'])) publicMember(res, item.value, ['members', item.index]);
  };

  const checkGcpFirewall = (res) => {
    const direction = read(res, ['direction'], 'string');
    if (direction.state === 'skip') return;
    if (direction.state === 'value' && direction.value !== 'INGRESS') return;
    const disabled = read(res, ['disabled'], 'boolean');
    if (disabled.state === 'value' && disabled.value === true) return;
    const ranges = strings(res, ['source_ranges']);
    const world = ranges.find((r) => GCP_WORLD.includes(r.value));
    if (world === undefined) return;
    const allow = read(res, ['allow'], 'list');
    if (allow.state !== 'value') return;
    allow.value.forEach((_, i) => {
      const proto = read(res, ['allow', i, 'protocol'], 'string');
      if (proto.state !== 'value') return;
      const p = proto.value.toLowerCase();
      if (p !== 'tcp' && p !== 'all') return;
      const ports = p === 'all' ? [] : strings(res, ['allow', i, 'ports']);
      const portList = p === 'all' ? ['*'] : ports.length === 0 ? ['*'] : ports.map((x) => x.value);
      const parsed = portList.map((e) => ({ e, r: portRange(e) }));
      for (const _bad of parsed.filter((x) => x.r === null)) unreadable('value-not-read', res, ['allow', i, 'ports'], 'a port or a range');
      for (const admin of ADMIN_PORTS) {
        const hit = parsed.find((x) => x.r !== null && x.r[0] <= admin.port && admin.port <= x.r[1]);
        if (hit === undefined) continue;
        const portText = hit.e === '*' ? `any port, which includes ${admin.name} on TCP port ${admin.port}` : `TCP port ${admin.port} (${admin.name})`;
        emit(`gcp-firewall-${admin.key}-open`, res, { attribute: pathText(['source_ranges', world.index]), message: `The firewall rule allows ingress from 0.0.0.0/0, which is any IPv4 address, to ${portText}.`, fix: `Limit source_ranges to the addresses that need ${admin.name} access, or reach the machines through a proxy such as Identity-Aware Proxy, or remove the rule.`, extraFacts: [...(direction.state === 'absent' ? ['tf-gfw-direction'] : []), ...(p === 'tcp' && ports.length === 0 ? ['tf-gfw-ports'] : [])] });
      }
    });
  };

  // ---- the generic check: deletions and replacements of things that hold data

  const checkStateful = (res) => {
    const def = STATEFUL_TYPES[res.type];
    const noun = NOUN[res.type];
    const extra = [];
    const clauses = [];
    for (const e of def.extra) {
      if (e.attr === null) {
        extra.push(e.fact);
        continue;
      }
      const before = lookupBefore(res, [e.attr]);
      if (before.state === 'known' && before.value === e.value) {
        extra.push(e.fact);
        clauses.push(e.clause);
      }
    }
    if (res.action === 'delete') {
      emit('stateful-delete', res, { attribute: '(resource)', message: `The plan deletes this ${noun}, and the data in it goes with it unless it is kept somewhere else.${clauses.join('')}`, fix: 'Check that the data is saved or no longer needed. To keep the object, remove it from the plan (for example with a removed block or terraform state rm) or set prevent_destroy to true.', extraFacts: extra });
      return;
    }
    const paths = res.replacePaths.filter((p) => Array.isArray(p) && p.length > 0 && p.every((s) => typeof s === 'string' || Number.isInteger(s)));
    const attribute = paths.length > 0 ? pathText(paths[0]) : '(resource)';
    const reason = res.reason === null ? '' : ` Terraform gives the reason ${safeText(res.reason, 60)}.`;
    emit('stateful-replace', res, { attribute, message: `The plan replaces this ${noun}: it is destroyed and created again, and the data in the old one is lost unless it is kept somewhere else.${reason}${clauses.join('')}`, fix: 'Check that the data is saved or no longer needed, and look at the attribute that forces the replacement. Set prevent_destroy to true if the object must never be replaced.', extraFacts: extra });
  };

  // ---- run

  const BY_TYPE = {
    aws_s3_bucket: checkAwsBucket,
    aws_s3_bucket_public_access_block: checkAwsBlock,
    aws_security_group: checkAwsGroup,
    aws_security_group_rule: checkAwsRule,
    aws_vpc_security_group_ingress_rule: checkAwsIngressRule,
    aws_db_instance: checkAwsDb,
    aws_ebs_volume: checkAwsEbs,
    azurerm_storage_account: checkAzureStorage,
    azurerm_network_security_rule: (res) => checkAzureRule(res, []),
    azurerm_network_security_group: checkAzureGroup,
    google_storage_bucket: checkGcpBucket,
    google_storage_bucket_iam_member: checkGcpIamMember,
    google_storage_bucket_iam_binding: checkGcpIamBinding,
    google_compute_firewall: checkGcpFirewall
  };

  const changes = { create: 0, update: 0, delete: 0, replace: 0, noop: 0, read: 0, other: 0 };
  const skippedTypes = new Map();
  let checked = 0;
  let deposed = 0;
  for (const res of plan.resources) {
    if (res.deposed) {
      deposed += 1;
      continue;
    }
    if (res.action === 'no-op') changes.noop += 1;
    else if (res.action === 'other') changes.other += 1;
    else changes[res.action] += 1;
    if (res.mode !== 'managed' || !['create', 'update', 'delete', 'replace'].includes(res.action)) continue;
    let known = false;
    if ((res.action === 'create' || res.action === 'update' || res.action === 'replace') && res.after !== null && Object.hasOwn(BY_TYPE, res.type)) {
      known = true;
      BY_TYPE[res.type](res);
    }
    if ((res.action === 'delete' || res.action === 'replace') && Object.hasOwn(STATEFUL_TYPES, res.type)) {
      known = true;
      checkStateful(res);
    }
    if (known) checked += 1;
    else skippedTypes.set(res.type, (skippedTypes.get(res.type) ?? 0) + 1);
  }

  if (deposed > 0) notes.push(`${plural(deposed, 'deposed object')} in the plan ${deposed === 1 ? 'was' : 'were'} counted and not checked.`);
  if (skippedTypes.size > 0) {
    const names = [...skippedTypes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const shown = names.slice(0, 20).map(([k, n]) => `${safeText(k, 80)} (${n})`).join(', ');
    notes.push(`Changed resources of other types are counted and not checked: ${shown}${names.length > 20 ? `, and ${names.length - 20} more types` : ''}.`);
  }
  if (plan.plannedOnly.length > 0) notes.push(`${plural(plan.plannedOnly.length, 'resource')} in planned_values ${plan.plannedOnly.length === 1 ? 'is' : 'are'} not in resource_changes; ${plan.plannedOnly.length === 1 ? 'it is' : 'they are'} used only to find the public access block of a bucket.`);
  if (once.has('replica-note')) notes.push('A DB instance that has replicate_source_db set was not checked for storage_encrypted, because the provider page says the field is ignored for a cross-region read replica.');
  if (once.has('network-rules-note')) notes.push('The plan has an azurerm_storage_account_network_rules resource, which can hold the network rules of a storage account, so the public network access of storage accounts was not checked.');

  // ---- the report
  found.sort((a, b) => a.order - b.order || ORDER[a.id] - ORDER[b.id] || (a.attribute < b.attribute ? -1 : a.attribute > b.attribute ? 1 : 0) || (a.message < b.message ? -1 : a.message > b.message ? 1 : 0));
  const findings = found.map(({ order: _drop, ...rest }) => rest);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const failing = findings.filter((f) => meetsThreshold(f.severity, failOn));
  const eCount = failing.filter((f) => f.severity === 'error').length;
  const wCount = failing.filter((f) => f.severity === 'warning').length;
  const reason = [eCount ? plural(eCount, 'error') : null, wCount ? plural(wCount, 'warning') : null].filter(Boolean).join(', ');

  return {
    tool: 'tfplan-risk-check',
    version,
    target: safeText(target, 400),
    input: {
      file: safeText(target, 400),
      bytes,
      formatVersion: plan.formatVersion,
      terraformVersion: plan.terraformVersion,
      resources: plan.resources.length - deposed,
      changes,
      checked
    },
    findings,
    notes,
    counts,
    gate: { failOn, pass: failing.length === 0, reason }
  };
}

