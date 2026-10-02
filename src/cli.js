// Command line: tfplan-risk-check <plan.json> [options]

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FINDINGS, LIMITS, checkPlan } from './check.js';
import { InputError, decodePlan, displayName, readPlanFile } from './files.js';
import { safeText } from './rules.js';
import { toText, toMarkdown, toJson, toCsv } from './report.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, csv: toCsv };
const THRESHOLDS = ['error', 'warning'];

export const USAGE = `Usage: tfplan-risk-check <plan.json> [options]

Reads the JSON form of a Terraform plan (terraform show -json plan.out) and reports the planned changes that would
expose data or weaken security on AWS, Azure or Google Cloud before apply: public access blocks, security groups and
firewalls open to the internet on SSH and RDP, public or unencrypted databases and disks, public storage, old TLS versions,
and the deletion or replacement of databases, buckets and volumes. Every finding names the resource address, the
attribute, the action and the severity, gives a fix and quotes the documentation it rests on. It reads that one file
only: it never runs Terraform, calls a cloud or opens a connection, and it never shows a value that the plan marks sensitive.

Options:
  --format <name>     text, markdown, json or csv (default: text)
  --fail-on <level>   exit with 1 when a finding is at this level or above: error or warning
                      (default: error); info never fails the run
  --help              show this text
  --version           show the version

Checks: ${FINDINGS.map((f) => f.id).join(', ')}

Exit codes: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error (a file that is not a plan).
`;

export function parseArgs(argv) {
  const o = { input: null, format: 'text', failOn: 'error', help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--format') o.format = next();
    else if (a === '--fail-on') o.failOn = next();
    else if (a === '-') throw new Error('reading from standard input is not supported; write the plan to a file and give its path');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else if (o.input !== null) throw new Error('give one plan file');
    else o.input = a;
  }
  if (!o.help && !o.version) {
    if (o.input === null) throw new Error('give the path of the plan file, written with: terraform show -json plan.out');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(o.input)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or csv)`);
    if (!THRESHOLDS.includes(o.failOn)) throw new Error(`--fail-on takes error or warning, not ${o.failOn}`);
  }
  return o;
}

const clean = (text) => safeText(text, 1000);

// Exit code: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error. base is the folder that a
// relative path is worked out from.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = LIMITS, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`tfplan-risk-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    const path = resolve(base, o.input);
    const buffer = await readPlanFile(path, limits);
    const name = displayName(path);
    report = checkPlan(decodePlan(buffer, name), { target: name, failOn: o.failOn, version: VERSION, limits });
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    io.err(`tfplan-risk-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report));
  return report.gate.pass ? 0 : 1;
}
