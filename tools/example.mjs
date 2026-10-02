// Runs the README examples, checks that they report what the README shows, and writes the reports of the failing
// example to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, LIMITS } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// Runs the tool on files of the repository; the file name shown in the report is the name of the file that is checked.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, LIMITS, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const failingArgs = ['examples/orders-app/plan.json'];
const failing = await run(failingArgs);
process.stdout.write(failing.out);
expect('failing plan', failing, 1, [
  'read: 20 resources (18 create, 1 delete, 1 replace), format 1.2, Terraform 1.9.8',
  'findings: 11 error, 8 warning, 1 info',
  'ERROR    aws-s3-public-access-block-off  aws_s3_bucket_public_access_block.orders_exports',
  'WARNING  aws-s3-public-access-block-missing  aws_s3_bucket.orders_uploads',
  'ERROR    aws-sg-ssh-open  aws_security_group.orders_app',
  'ERROR    aws-sg-all-ports-open  aws_security_group_rule.debug_everything',
  'ERROR    aws-sg-rdp-open  aws_vpc_security_group_ingress_rule.rdp_admin',
  'ERROR    aws-rds-public  aws_db_instance.orders',
  'WARNING  aws-rds-unencrypted  aws_db_instance.orders',
  'WARNING  aws-ebs-unencrypted  aws_ebs_volume.orders_scratch',
  'WARNING  stateful-delete  aws_db_instance.legacy_reports',
  'WARNING  stateful-replace  aws_ebs_volume.orders_data',
  'ERROR    azure-storage-public-blob-access  azurerm_storage_account.orders_files',
  'WARNING  azure-storage-public-network-access  azurerm_storage_account.orders_files',
  'WARNING  azure-storage-min-tls  azurerm_storage_account.orders_files',
  'ERROR    azure-nsg-ssh-open  azurerm_network_security_rule.ssh_any',
  'ERROR    azure-nsg-rdp-open  azurerm_network_security_group.orders_inline',
  'WARNING  gcp-bucket-uniform-access-off  google_storage_bucket.orders_exports',
  'ERROR    gcp-bucket-public-all-users  google_storage_bucket_iam_member.public_read',
  'INFO     value-unknown  google_storage_bucket_iam_binding.support',
  'ERROR    gcp-firewall-ssh-open  google_compute_firewall.ssh',
  'GATE: FAIL - 11 errors'
], ['GATE: PASS', 'example-not-a-real-value', 'office_vpn', 'office_only']);

process.stdout.write('\n');
const fixedArgs = ['examples/orders-app-fixed/plan.json', '--fail-on', 'warning'];
const fixed = await run(fixedArgs);
process.stdout.write(fixed.out);
expect('fixed plan with --fail-on warning', fixed, 0, [
  'findings: 0 error, 0 warning, 0 info',
  'GATE: PASS (--fail-on warning)'
], ['ERROR', 'WARNING ', 'example-not-a-real-value']);

// The README shows the runs as they are printed.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(failing.out)) problems.push('README: the sample output of the failing plan differs from a real run');
if (!readme.includes(fixed.out)) problems.push('README: the sample output of the fixed plan differs from a real run');

// The same plan in the other formats, kept as examples of what each one looks like.
await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/orders-app.txt'), failing.out);
for (const [format, name] of [['markdown', 'orders-app.md'], ['json', 'orders-app.json'], ['csv', 'orders-app.csv']]) {
  const r = await run([...failingArgs, '--format', format]);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  if (r.out.includes('example-not-a-real-value')) problems.push(`${format}: the report holds a value that the plan marks sensitive`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
