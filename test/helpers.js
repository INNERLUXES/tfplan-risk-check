// Shared test helpers: plans written inline as objects, files written into a temporary folder that is removed after the
// test, and the command line run with captured output. Paths are built with resolve() from forward-slash names, so the
// same test runs on Linux, macOS and Windows.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkPlan, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'tfplan-risk-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// One entry of resource_changes. after is the planned object; actions defaults to create. unknown and sensitive are the
// after_unknown and after_sensitive objects.
export function rc(type, name, after, { actions = ['create'], before = null, unknown = {}, sensitive = {}, beforeSensitive = {}, reason, replacePaths, module, index } = {}) {
  const prefix = module ? `${module}.` : '';
  const suffix = index === undefined ? '' : typeof index === 'number' ? `[${index}]` : `["${index}"]`;
  const change = { actions, before, after: actions.length === 1 && actions[0] === 'delete' ? null : after, after_unknown: unknown, before_sensitive: beforeSensitive, after_sensitive: sensitive };
  if (replacePaths) change.replace_paths = replacePaths;
  const entry = { address: `${prefix}${type}.${name}${suffix}`, mode: 'managed', type, name, provider_name: `registry.terraform.io/hashicorp/${type.split('_')[0]}`, change };
  if (module) entry.module_address = module;
  if (index !== undefined) entry.index = index;
  if (reason) entry.action_reason = reason;
  return entry;
}

// A whole plan around the resource changes. config is a list of [address, expressions] for the configuration tree.
export function plan(changes, { config = [], formatVersion = '1.2', extra = {}, planned } = {}) {
  return {
    format_version: formatVersion,
    terraform_version: '1.9.8',
    planned_values: { root_module: { resources: planned ?? [] } },
    resource_changes: changes,
    configuration: { root_module: { resources: config.map(([address, expressions]) => {
      const [type, name] = address.split('.');
      return { address, mode: 'managed', type, name, expressions };
    }) } },
    ...extra
  };
}

// Checks a plan given as an object, or a list of resource changes, or text.
export function check(input, options = {}) {
  const text = typeof input === 'string' ? input : JSON.stringify(Array.isArray(input) ? plan(input) : input);
  return checkPlan(text, options);
}

export const ids = (report) => report.findings.map((f) => f.id);
export const find = (report, id) => report.findings.filter((f) => f.id === id);

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = []) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments.
export async function cli(argv) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { code, out, err };
}

// A bucket with all four settings of its public access block, linked by a reference in the configuration.
export function bucketWithBlock(name, { settings = [true, true, true, true] } = {}) {
  return {
    changes: [
      rc('aws_s3_bucket', name, { bucket: name, force_destroy: false }, { unknown: { id: true } }),
      rc('aws_s3_bucket_public_access_block', name, { block_public_acls: settings[0], block_public_policy: settings[1], ignore_public_acls: settings[2], restrict_public_buckets: settings[3] }, { unknown: { bucket: true, id: true } })
    ],
    config: [[`aws_s3_bucket_public_access_block.${name}`, { bucket: { references: [`aws_s3_bucket.${name}.id`, `aws_s3_bucket.${name}`] } }], [`aws_s3_bucket.${name}`, {}]]
  };
}
