// The checks: every finding id, its severity, the cloud it is about and the sentences of the saved pages that it quotes.
// docs/method.md gives the rule of each one, and docs/rules-and-sources.md lists every sentence. An id, once released,
// keeps its meaning, because pipelines read it from the JSON and CSV reports.
//
// facts: the keys of FACTS in data.js that the finding always quotes. optional: keys that a finding can add, depending
// on what the plan shows. A finding without facts is a conclusion that no page states.
//
// Severity is the tool's own mapping, because the pages give the reasons and no scale: an error is a change that opens
// a resource to the internet or switches off a block on public access; a warning is a change that weakens a protection
// (encryption, a TLS version, uniform access, the network a storage account answers on), that leaves a protection out,
// or that deletes or replaces something that holds data; info is a thing the tool could not read and never fails a run.

export const SEVERITIES = ['error', 'warning', 'info'];
export const RANK = { error: 3, warning: 2, info: 1 };

export const FINDINGS = [
  // ---- errors
  { id: 'aws-s3-public-access-block-off', severity: 'error', cloud: 'aws', facts: ['aws-bpa-override', 'aws-bpa-all-four', 'aws-s3-8-fails'], optional: ['tf-pab-block-public-acls', 'tf-pab-block-public-policy', 'tf-pab-ignore-public-acls', 'tf-pab-restrict-public-buckets'] },
  { id: 'aws-sg-ssh-open', severity: 'error', cloud: 'aws', facts: ['aws-ec2-13-recommend', 'aws-ec2-13-unfettered', 'aws-ec2-19-malicious'] },
  { id: 'aws-sg-rdp-open', severity: 'error', cloud: 'aws', facts: ['aws-ec2-14-recommend', 'aws-ec2-14-unfettered', 'aws-ec2-19-malicious'] },
  { id: 'aws-sg-all-ports-open', severity: 'error', cloud: 'aws', facts: ['aws-ec2-18-port', 'aws-ec2-18-malicious', 'aws-ec2-19-malicious'], optional: ['tf-sg-protocol-all', 'tf-sg-ingress-protocol', 'tf-ingress-rule-protocol'] },
  { id: 'aws-rds-public', severity: 'error', cloud: 'aws', facts: ['aws-rds-2-internet', 'aws-rds-2-unless', 'tf-db-public'] },
  { id: 'azure-storage-public-blob-access', severity: 'error', cloud: 'azure', facts: ['az-anon-any-client', 'az-anon-risk'], optional: ['tf-azsa-nested-5', 'tf-azsa-nested-4'] },
  { id: 'azure-nsg-ssh-open', severity: 'error', cloud: 'azure', facts: ['az-jit-hunting', 'az-jit-minimize', 'az-jit-ports'], optional: ['tf-nsr-source', 'tf-nsr-protocol', 'az-nsg-any'] },
  { id: 'azure-nsg-rdp-open', severity: 'error', cloud: 'azure', facts: ['az-jit-hunting', 'az-jit-minimize', 'az-jit-ports'], optional: ['tf-nsr-source', 'tf-nsr-protocol', 'az-nsg-any'] },
  { id: 'gcp-bucket-public-all-users', severity: 'error', cloud: 'google', facts: ['gcp-iam-all-users', 'tf-giam-all-users'] },
  { id: 'gcp-bucket-public-all-authenticated', severity: 'error', cloud: 'google', facts: ['gcp-iam-all-authenticated', 'tf-giam-all-authenticated'] },
  { id: 'gcp-firewall-ssh-open', severity: 'error', cloud: 'google', facts: ['gcp-scc-ssh', 'gcp-fw-any-ipv4'], optional: ['tf-gfw-direction', 'tf-gfw-ports'] },
  { id: 'gcp-firewall-rdp-open', severity: 'error', cloud: 'google', facts: ['gcp-scc-rdp', 'gcp-fw-any-ipv4'], optional: ['tf-gfw-direction', 'tf-gfw-ports'] },

  // ---- warnings
  { id: 'aws-s3-public-access-block-missing', severity: 'warning', cloud: 'aws', facts: ['aws-bpa-override', 'aws-bpa-all-four', 'aws-s3-8-unless'] },
  { id: 'aws-rds-unencrypted', severity: 'warning', cloud: 'aws', facts: ['aws-rds-3-encrypt', 'tf-db-encrypted'] },
  { id: 'aws-ebs-unencrypted', severity: 'warning', cloud: 'aws', facts: ['aws-ec2-3-encrypt', 'tf-ebs-encrypted'] },
  { id: 'azure-storage-public-network-access', severity: 'warning', cloud: 'azure', facts: ['az-net-default', 'az-net-denied'], optional: ['tf-azsa-access-5', 'tf-azsa-access-4', 'tf-azsa-rules'] },
  { id: 'azure-storage-min-tls', severity: 'warning', cloud: 'azure', facts: ['az-tls-recommended', 'az-tls-remediate', 'tf-azsa-tls'] },
  { id: 'gcp-bucket-uniform-access-off', severity: 'warning', cloud: 'google', facts: ['gcp-ubla-unintended', 'gcp-ubla-iam-only', 'gcp-scc-ubla'] },
  { id: 'stateful-delete', severity: 'warning', cloud: 'terraform', facts: ['tf-prevent-destroy', 'tf-prevent-destroy-rejects', 'tf-replace-actions'], optional: ['tf-db-final-snapshot', 'tf-s3-force-destroy', 'aws-ebs-delete', 'tf-gcs-force-destroy'] },
  { id: 'stateful-replace', severity: 'warning', cloud: 'terraform', facts: ['tf-prevent-destroy', 'tf-prevent-destroy-rejects', 'tf-replace-actions'], optional: ['tf-db-final-snapshot', 'tf-s3-force-destroy', 'aws-ebs-delete', 'tf-gcs-force-destroy'] },

  // ---- info: never fails the run
  { id: 'value-unknown', severity: 'info', cloud: 'terraform', facts: ['tf-after-unknown'] },
  { id: 'value-sensitive', severity: 'info', cloud: 'terraform', facts: ['tf-after-sensitive'] },
  { id: 'value-not-read', severity: 'info', cloud: 'terraform', facts: [] }
];

export const ORDER = Object.fromEntries(FINDINGS.map((f, i) => [f.id, i]));

export const meetsThreshold = (severity, failOn) => RANK[severity] >= RANK[failOn];

// C0 and C1 control characters, line and paragraph separators, and the Unicode direction controls.
const UNSAFE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]', 'g');

// Text that comes from a file goes through this before it reaches a message: control, line separator and direction
// characters become a space, and the length is cut.
export function safeText(value, max = 200) {
  const text = String(value).replace(UNSAFE, ' ');
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}
