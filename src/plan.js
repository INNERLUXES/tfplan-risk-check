// From the text of a plan file to the things the checks look at: the resource changes with their actions, and, for each,
// the attribute values after the change, which of them are unknown until apply and which are marked sensitive. The format
// is the one of "terraform show -json" (research/sources/tf-json-format.txt). A file that is not such a plan is refused
// with a message that says what it is missing; a plan is read as the page says: unknown properties are ignored, and an
// unsupported major version is rejected.

import { PLAN_LIMITS } from './data.js';
import { InputError } from './files.js';
import { JsonError, parseStrictJson, position } from './json.js';
import { safeText } from './rules.js';

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const ACTIONS = ['no-op', 'create', 'read', 'update', 'delete'];

// The one word for an action list: create, update, delete, replace, no-op or read. "replace" is the two lists with a delete
// and a create. Any other list is "other".
export function classify(actions) {
  const key = actions.join(',');
  if (key === 'no-op') return 'no-op';
  if (key === 'create') return 'create';
  if (key === 'read') return 'read';
  if (key === 'update') return 'update';
  if (key === 'delete') return 'delete';
  if (key === 'delete,create' || key === 'create,delete') return 'replace';
  return 'other';
}

// The address without its index keys, so that module.a["x"].aws_s3_bucket.b[0] and module.a.aws_s3_bucket.b are the same
// resource. Bracket groups are dropped whole, and a bracket inside a quoted key does not end the group.
export function baseAddress(address) {
  let out = '';
  let depth = 0;
  let quoted = false;
  for (let i = 0; i < address.length; i += 1) {
    const c = address[i];
    if (depth > 0) {
      if (quoted) {
        if (c === '\\') i += 1;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '[') depth += 1;
      else if (c === ']') depth -= 1;
    } else if (c === '[') depth = 1;
    else out += c;
  }
  return out;
}

// Looks up an attribute of the planned object after the change, with its three states. path is a list of keys and indexes.
// "after" holds the known values, "after_unknown" has true where a value is unknown until apply, and "after_sensitive" has
// true where a value is sensitive. A value that is sensitive is never returned. state is known, absent, unknown or
// sensitive; value is set only when it is known.
export function lookup(resource, path) {
  let v = resource.after;
  let u = resource.afterUnknown;
  let s = resource.afterSensitive;
  const child = (node, step) => {
    if (Array.isArray(node)) return typeof step === 'number' ? node[step] : undefined;
    if (isObject(node) && typeof step === 'string' && Object.hasOwn(node, step)) return node[step];
    return undefined;
  };
  for (const step of path) {
    if (s === true) return { state: 'sensitive' };
    if (u === true) return { state: 'unknown' };
    v = child(v, step);
    u = child(u, step);
    s = child(s, step);
  }
  if (s === true) return { state: 'sensitive' };
  if (u === true) return { state: 'unknown' };
  if (v === undefined || v === null) return { state: 'absent' };
  return { state: 'known', value: v };
}

// The same for the object before the change.
export function lookupBefore(resource, path) {
  let v = resource.before;
  let s = resource.beforeSensitive;
  const child = (node, step) => {
    if (Array.isArray(node)) return typeof step === 'number' ? node[step] : undefined;
    if (isObject(node) && typeof step === 'string' && Object.hasOwn(node, step)) return node[step];
    return undefined;
  };
  for (const step of path) {
    if (s === true) return { state: 'sensitive' };
    v = child(v, step);
    s = child(s, step);
  }
  if (s === true) return { state: 'sensitive' };
  if (v === undefined || v === null) return { state: 'absent' };
  return { state: 'known', value: v };
}

// "ingress[0].cidr_blocks[1]" from ['ingress', 0, 'cidr_blocks', 1].
export function pathText(path) {
  let out = '';
  for (const step of path) out += typeof step === 'number' ? `[${step}]` : `${out === '' ? '' : '.'}${safeText(step, 80)}`;
  return out;
}

function refuse(message) {
  throw new InputError(message);
}

// Parses the text and checks that it is the JSON of a plan. Returns { formatVersion, terraformVersion, errored, resources,
// plannedOnly, config, notes }. resources are the entries of resource_changes in order; plannedOnly are resources that are
// in planned_values and not in resource_changes (used only to pair resources); config maps the address without index of a
// resource, in module order, to its expressions.
export function readPlan(text, limits = PLAN_LIMITS) {
  let root;
  try {
    root = parseStrictJson(text, limits);
  } catch (error) {
    if (!(error instanceof JsonError)) throw error;
    const { line, column } = position(text, error.offset);
    refuse(`The file is not valid JSON: ${error.message} (line ${line}, column ${column}). A plan is written with "terraform show -json plan.out".`);
  }
  if (!isObject(root)) refuse('The JSON is not an object, so it is not a Terraform plan. A plan is written with "terraform show -json plan.out".');
  const notes = [];

  const version = root.format_version;
  if (typeof version !== 'string') refuse('The JSON has no format_version, so it is not the output of "terraform show -json". A plan is written with "terraform show -json plan.out".');
  const match = /^(\d{1,6})\.(\d{1,6})$/.exec(version);
  if (match === null) refuse(`The format_version "${safeText(version, 40)}" is not a version number of the form 1.0, so the file is not read.`);
  if (match[1] !== '1') refuse(`The format_version is ${version}. This tool reads major version 1 only; the Terraform documentation says to reject any input which reports an unsupported major version.`);

  const hasChanges = Object.hasOwn(root, 'resource_changes');
  const hasPlanned = Object.hasOwn(root, 'planned_values');
  if (!hasChanges && !hasPlanned) {
    if (Object.hasOwn(root, 'values')) refuse('This is the JSON of a state, not of a plan: it has "values" and no "planned_values" or "resource_changes". Write a plan with "terraform show -json plan.out", where plan.out comes from "terraform plan -out=plan.out".');
    refuse('The JSON has a format_version and neither "resource_changes" nor "planned_values", so it is not the JSON of a plan. A plan is written with "terraform show -json plan.out".');
  }
  if (hasChanges && !Array.isArray(root.resource_changes)) refuse('"resource_changes" is not a list, so the file is not a Terraform plan.');
  if (hasPlanned && !isObject(root.planned_values)) refuse('"planned_values" is not an object, so the file is not a Terraform plan.');

  const list = hasChanges ? root.resource_changes : [];
  if (list.length > limits.maxResources) refuse(`The plan lists ${list.length.toLocaleString('en-US')} resource changes, over the limit of ${limits.maxResources.toLocaleString('en-US')}.`);

  const resources = [];
  const seen = new Set();
  list.forEach((entry, index) => {
    const where = `resource_changes[${index}]`;
    if (!isObject(entry)) refuse(`${where} is not an object, so the file is not a Terraform plan.`);
    for (const key of ['address', 'mode', 'type', 'name']) if (typeof entry[key] !== 'string' || entry[key] === '') refuse(`${where} has no "${key}" as text, so the file is not a Terraform plan.`);
    if (!isObject(entry.change)) refuse(`${where} (${safeText(entry.address, 120)}) has no "change" object.`);
    const actions = entry.change.actions;
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > 2 || actions.some((a) => typeof a !== 'string')) refuse(`${where} (${safeText(entry.address, 120)}) has no list of actions in "change.actions".`);
    const key = `${entry.address}|${typeof entry.deposed === 'string' ? entry.deposed : ''}`;
    if (seen.has(key)) refuse(`${where}: the address ${safeText(entry.address, 120)} is listed twice.`);
    seen.add(key);
    const change = entry.change;
    const action = classify(actions);
    if (action === 'other' || actions.some((a) => !ACTIONS.includes(a))) notes.push(`${safeText(entry.address, 200)} has the actions ${safeText(actions.join(', '), 60)}, which this tool does not read, so it was not checked.`);
    resources.push({
      index,
      address: entry.address,
      module: typeof entry.module_address === 'string' ? entry.module_address : '',
      mode: entry.mode,
      type: entry.type,
      name: entry.name,
      deposed: typeof entry.deposed === 'string',
      actions,
      action,
      reason: typeof entry.action_reason === 'string' ? entry.action_reason : null,
      before: isObject(change.before) ? change.before : null,
      after: isObject(change.after) ? change.after : null,
      afterUnknown: change.after_unknown ?? null,
      afterSensitive: change.after_sensitive ?? null,
      beforeSensitive: change.before_sensitive ?? null,
      replacePaths: Array.isArray(change.replace_paths) ? change.replace_paths : [],
      source: 'resource_changes'
    });
  });

  // planned_values: resources that resource_changes does not list. They are only used to pair resources.
  const plannedOnly = [];
  if (hasPlanned) {
    const walk = (module, depth) => {
      if (!isObject(module) || depth > 64) return;
      if (Array.isArray(module.resources)) {
        for (const r of module.resources) {
          if (!isObject(r) || typeof r.address !== 'string' || typeof r.type !== 'string' || r.mode !== 'managed') continue;
          if (seen.has(`${r.address}|`)) continue;
          plannedOnly.push({
            index: -1,
            address: r.address,
            module: '',
            mode: r.mode,
            type: r.type,
            name: typeof r.name === 'string' ? r.name : '',
            deposed: false,
            actions: ['no-op'],
            action: 'no-op',
            reason: null,
            before: null,
            after: isObject(r.values) ? r.values : null,
            afterUnknown: null,
            afterSensitive: r.sensitive_values ?? null,
            beforeSensitive: null,
            replacePaths: [],
            source: 'planned_values'
          });
          const at = r.address.lastIndexOf(`.${r.type}.`);
          plannedOnly[plannedOnly.length - 1].module = at > 0 ? r.address.slice(0, at) : '';
        }
      }
      if (Array.isArray(module.child_modules)) for (const child of module.child_modules) walk(child, depth + 1);
    };
    walk(root.planned_values.root_module, 0);
  }

  // The configuration: the expressions of each resource, found by the address without index. Module names come from the
  // module_calls of the tree, so a resource in a child module has the prefix module.<name>.
  const config = new Map();
  if (isObject(root.configuration)) {
    const walk = (module, prefix, depth) => {
      if (!isObject(module) || depth > 64) return;
      if (Array.isArray(module.resources)) {
        for (const r of module.resources) {
          if (!isObject(r) || r.mode !== 'managed' || typeof r.type !== 'string' || typeof r.name !== 'string') continue;
          config.set(`${prefix}${r.type}.${r.name}`, isObject(r.expressions) ? r.expressions : {});
        }
      }
      if (isObject(module.module_calls)) {
        for (const [name, call] of Object.entries(module.module_calls)) if (isObject(call)) walk(call.module, `${prefix}module.${name}.`, depth + 1);
      }
    };
    walk(root.configuration.root_module, '', 0);
  }

  if (root.errored === true) notes.push('The plan is marked errored, so Terraform cannot apply it. The changes it lists are still checked.');

  return {
    formatVersion: version,
    terraformVersion: typeof root.terraform_version === 'string' ? safeText(root.terraform_version, 40) : null,
    errored: root.errored === true,
    resources,
    plannedOnly,
    config,
    notes
  };
}
