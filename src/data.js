// Every attribute name, every value that a check compares with and every quoted sentence that the checks rely on comes
// from a page of the Terraform documentation, the Terraform provider documentation or the documentation of the cloud.
// The pages are saved as text in research/sources (the address is on the first line), and test/data.test.js compares
// this file with the saved text. Nothing here was written from memory: a sentence that is not on a saved page is not a
// fact of this file, and a check that no saved page supports is not in the tool (docs/limits.md lists them).

// id: used in FACTS and ATTRS; title: the first heading of the saved page; label: how a report names the page; url: the
// address; file: the saved text in research/sources; extract: true when only some sections of a long page are saved.
export const SOURCES = [
  { id: 'tfjson', title: 'JSON Output Format Overview', label: 'Terraform JSON Output Format', url: 'https://developer.hashicorp.com/terraform/internals/json-format', file: 'tf-json-format.txt' },
  { id: 'tflife', title: 'lifecycle reference', label: 'Terraform lifecycle reference', url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle', file: 'tf-lifecycle.txt' },
  { id: 'tfpab', title: 'Resource: aws_s3_bucket_public_access_block', label: 'aws_s3_bucket_public_access_block (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket_public_access_block', file: 'tf-aws-s3-bucket-public-access-block.txt' },
  { id: 'tfs3', title: 'Resource: aws_s3_bucket', label: 'aws_s3_bucket (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket', file: 'tf-aws-s3-bucket.txt' },
  { id: 'tfsg', title: 'Resource: aws_security_group', label: 'aws_security_group (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group', file: 'tf-aws-security-group.txt' },
  { id: 'tfsgrule', title: 'Resource: aws_security_group_rule', label: 'aws_security_group_rule (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group_rule', file: 'tf-aws-security-group-rule.txt' },
  { id: 'tfingress', title: 'Resource: aws_vpc_security_group_ingress_rule', label: 'aws_vpc_security_group_ingress_rule (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/vpc_security_group_ingress_rule', file: 'tf-aws-vpc-security-group-ingress-rule.txt' },
  { id: 'tfdb', title: 'Resource: aws_db_instance', label: 'aws_db_instance (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance', file: 'tf-aws-db-instance.txt' },
  { id: 'tfebs', title: 'Resource: aws_ebs_volume', label: 'aws_ebs_volume (AWS provider 6.67.0)', url: 'https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/ebs_volume', file: 'tf-aws-ebs-volume.txt' },
  { id: 'tfsa', title: 'azurerm_storage_account', label: 'azurerm_storage_account (AzureRM provider 5.8.0)', url: 'https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account', file: 'tf-azurerm-storage-account.txt' },
  { id: 'tfsa4', title: 'azurerm_storage_account', label: 'azurerm_storage_account (AzureRM provider 4.64.0)', url: 'https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account', file: 'tf-azurerm-storage-account-4.txt' },
  { id: 'tfnsr', title: 'azurerm_network_security_rule', label: 'azurerm_network_security_rule (AzureRM provider 5.8.0)', url: 'https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule', file: 'tf-azurerm-network-security-rule.txt' },
  { id: 'tfnsg', title: 'azurerm_network_security_group', label: 'azurerm_network_security_group (AzureRM provider 5.8.0)', url: 'https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_group', file: 'tf-azurerm-network-security-group.txt' },
  { id: 'tfgbucket', title: 'google_storage_bucket', label: 'google_storage_bucket (Google provider 8.5.0)', url: 'https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket', file: 'tf-google-storage-bucket.txt' },
  { id: 'tfgiam', title: 'IAM policy for Cloud Storage Bucket', label: 'google_storage_bucket_iam (Google provider 8.5.0)', url: 'https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket_iam', file: 'tf-google-storage-bucket-iam.txt' },
  { id: 'tfgfw', title: 'google_compute_firewall', label: 'google_compute_firewall (Google provider 8.5.0)', url: 'https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/compute_firewall', file: 'tf-google-compute-firewall.txt' },
  { id: 'awsbpa', title: 'Blocking public access to your Amazon S3 storage', label: 'Amazon S3, Blocking public access', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html', file: 'aws-s3-block-public-access.txt' },
  { id: 'awsebsdel', title: 'Delete an Amazon EBS volume', label: 'Amazon EBS, Delete a volume', url: 'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html', file: 'aws-ebs-delete-volume.txt' },
  { id: 'shec2', title: '[EC2.3] Attached Amazon EBS volumes should be encrypted at-rest', label: 'AWS Security Hub, EC2 controls', url: 'https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html', file: 'aws-securityhub-ec2-controls.txt', extract: true },
  { id: 'shrds', title: '[RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration', label: 'AWS Security Hub, RDS controls', url: 'https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html', file: 'aws-securityhub-rds-controls.txt', extract: true },
  { id: 'shs3', title: '[S3.8] S3 general purpose buckets should block public access', label: 'AWS Security Hub, S3 controls', url: 'https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html', file: 'aws-securityhub-s3-controls.txt', extract: true },
  { id: 'azanon', title: 'Remediate anonymous read access to blob data (Azure Resource Manager deployments)', label: 'Microsoft Learn, Remediate anonymous read access to blob data', url: 'https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent', file: 'azure-anonymous-read-access-prevent.txt' },
  { id: 'aztls', title: 'Enforce a minimum required version of Transport Layer Security (TLS) for requests to a storage account', label: 'Microsoft Learn, Minimum TLS version for a storage account', url: 'https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version', file: 'azure-storage-minimum-tls.txt' },
  { id: 'aznet', title: 'Azure Storage firewall rules and network access control', label: 'Microsoft Learn, Azure Storage firewall rules', url: 'https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security', file: 'azure-storage-network-security.txt' },
  { id: 'aznsg', title: 'Azure network security groups overview', label: 'Microsoft Learn, Network security groups', url: 'https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview', file: 'azure-nsg-overview.txt' },
  { id: 'azjit', title: 'Just-in-time machine access in Microsoft Defender for Cloud', label: 'Microsoft Learn, Just-in-time machine access', url: 'https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview', file: 'azure-jit-access-overview.txt' },
  { id: 'azjitusage', title: 'Enable just-in-time access', label: 'Microsoft Learn, Enable just-in-time access', url: 'https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage', file: 'azure-jit-access-usage.txt' },
  { id: 'gcpubla', title: 'Uniform bucket-level access', label: 'Google Cloud, Uniform bucket-level access', url: 'https://cloud.google.com/storage/docs/uniform-bucket-level-access', file: 'gcp-uniform-bucket-level-access.txt' },
  { id: 'gcpiam', title: 'IAM principals', label: 'Google Cloud, IAM principals', url: 'https://cloud.google.com/iam/docs/principals-overview', file: 'gcp-iam-principals.txt' },
  { id: 'gcpfw', title: 'VPC firewall rules', label: 'Google Cloud, VPC firewall rules', url: 'https://cloud.google.com/firewall/docs/firewalls', file: 'gcp-firewall-overview.txt', extract: true },
  { id: 'gcpscc', title: 'Bucket policy only disabled', label: 'Google Cloud, Security Command Center vulnerability findings', url: 'https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings', file: 'gcp-scc-vulnerability-findings.txt', extract: true }
];

const BY_SOURCE = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
export const sourceUrl = (id) => BY_SOURCE[id].url;
export const sourceLabel = (id) => BY_SOURCE[id].label;
// The title of the saved page when the saved text is the whole page; an extract has no title of its own, so a quote
// from it always names its section.
export const sourceTitle = (id) => (BY_SOURCE[id].extract ? '' : BY_SOURCE[id].title);

// ---- the attribute names of the resources that the checks read, with the saved page that lists each one. A name is
// written as the provider page lists it: a bullet with the name in backticks. test/data.test.js looks for the bullet.
// For a block (ingress, allow, security_rule, network_rules) the names are those of the block.
export const ATTRS = {
  'aws_s3_bucket_public_access_block': { source: 'tfpab', names: ['block_public_acls', 'block_public_policy', 'ignore_public_acls', 'restrict_public_buckets', 'bucket'] },
  'aws_s3_bucket': { source: 'tfs3', names: ['bucket', 'force_destroy'] },
  'aws_security_group': { source: 'tfsg', names: ['ingress', 'cidr_blocks', 'ipv6_cidr_blocks', 'from_port', 'to_port', 'protocol'] },
  'aws_security_group_rule': { source: 'tfsgrule', names: ['type', 'cidr_blocks', 'ipv6_cidr_blocks', 'from_port', 'to_port', 'protocol'] },
  'aws_vpc_security_group_ingress_rule': { source: 'tfingress', names: ['cidr_ipv4', 'cidr_ipv6', 'from_port', 'to_port', 'ip_protocol'] },
  'aws_db_instance': { source: 'tfdb', names: ['publicly_accessible', 'storage_encrypted', 'replicate_source_db', 'skip_final_snapshot', 'deletion_protection'] },
  'aws_ebs_volume': { source: 'tfebs', names: ['encrypted'] },
  'azurerm_storage_account': { source: 'tfsa', names: ['allow_nested_items_to_be_public', 'public_network_access', 'min_tls_version', 'network_rules', 'default_action'] },
  'azurerm_storage_account/4': { source: 'tfsa4', names: ['allow_nested_items_to_be_public', 'public_network_access_enabled', 'min_tls_version', 'network_rules', 'default_action'] },
  'azurerm_network_security_rule': { source: 'tfnsr', names: ['protocol', 'source_address_prefix', 'source_address_prefixes', 'destination_port_range', 'destination_port_ranges', 'access', 'direction'] },
  'azurerm_network_security_group': { source: 'tfnsg', names: ['security_rule', 'protocol', 'source_address_prefix', 'source_address_prefixes', 'destination_port_range', 'destination_port_ranges', 'access', 'direction'] },
  'google_storage_bucket': { source: 'tfgbucket', names: ['uniform_bucket_level_access', 'force_destroy'] },
  'google_storage_bucket_iam': { source: 'tfgiam', names: ['role'] },
  'google_compute_firewall': { source: 'tfgfw', names: ['allow', 'protocol', 'ports', 'direction', 'source_ranges', 'disabled'] },
};

// The attribute `members` of google_storage_bucket_iam_binding is listed on the page as "member/members".
export const IAM_MEMBERS_SNIPPET = '`member/members`';

// ---- the values that the checks compare with

// A source that stands for the whole internet, per cloud. AWS: the two CIDR blocks of the Security Hub controls.
// Azure: "*" and "Internet" from the provider page, and 0.0.0.0/0 from the network security group page. Google Cloud:
// 0.0.0.0/0, the default source of the firewall page.
export const AWS_WORLD = ['0.0.0.0/0', '::/0'];
export const AZURE_WORLD = ['*', '0.0.0.0/0', 'Internet'];
export const GCP_WORLD = ['0.0.0.0/0'];

// The management ports that the saved pages name: 22 (SSH) and 3389 (RDP).
export const ADMIN_PORTS = [
  { port: 22, name: 'SSH', key: 'ssh' },
  { port: 3389, name: 'RDP', key: 'rdp' }
];

// The special identifiers that stand for anyone on the internet.
export const GCP_PUBLIC_MEMBERS = { allUsers: 'all-users', allAuthenticatedUsers: 'all-authenticated' };

// The values of min_tls_version on the page of the provider version that lists them.
export const TLS_BELOW_1_2 = ['TLS1_0', 'TLS1_1'];
export const TLS_AT_LEAST_1_2 = ['TLS1_2', 'TLS1_3'];

// The four settings of an S3 public access block, as the provider page names them.
export const PAB_SETTINGS = ['block_public_acls', 'block_public_policy', 'ignore_public_acls', 'restrict_public_buckets'];

// The resource types whose deletion or replacement is reported. This is the tool's own list, a reading of the sentence
// "database instances, storage, or other stateful resources" on the lifecycle page: no page lists types. extra names
// the optional sentence that a type adds, and the attribute of the prior value that it depends on (docs/method.md).
export const STATEFUL_TYPES = {
  aws_db_instance: { cloud: 'aws', extra: [{ attr: 'skip_final_snapshot', value: true, fact: 'tf-db-final-snapshot', clause: ' skip_final_snapshot is true on it, so no final snapshot is taken.' }] },
  aws_s3_bucket: { cloud: 'aws', extra: [{ attr: 'force_destroy', value: true, fact: 'tf-s3-force-destroy', clause: ' force_destroy is true on it, so the objects in it are deleted with it.' }] },
  aws_ebs_volume: { cloud: 'aws', extra: [{ attr: null, value: null, fact: 'aws-ebs-delete', clause: '' }] },
  azurerm_storage_account: { cloud: 'azure', extra: [] },
  azurerm_managed_disk: { cloud: 'azure', extra: [] },
  google_storage_bucket: { cloud: 'google', extra: [{ attr: 'force_destroy', value: true, fact: 'tf-gcs-force-destroy', clause: ' force_destroy is true on it, so the objects in it are deleted with it.' }] },
  google_sql_database_instance: { cloud: 'google', extra: [] },
  google_compute_disk: { cloud: 'google', extra: [] }
};

// The sentences of the plan format that the reader rests on. They are not quoted in a finding.
export const READER_FACTS = {
  'reader-version': { source: 'tfjson', section: 'Introduction', text: 'Reject any input which reports an unsupported major version.' },
  'reader-unrecognized': { source: 'tfjson', section: 'Introduction', text: 'Ignore any object properties with unrecognized names to remain forward-compatible with future minor versions.' },
  'reader-plan': { source: 'tfjson', section: 'Plan Representation', text: 'A plan consists of a prior state, the configuration that is being applied to that state, and the set of changes Terraform plans to make to achieve that.' },
  'reader-all-resources': { source: 'tfjson', section: 'Plan Representation', text: 'All resources in the configuration are included in this list.' },
  'reader-planned-values': { source: 'tfjson', section: 'Plan Representation', text: '"planned_values" is a description of what is known so far of the outcome in the standard value representation, with any as-yet-unknown values omitted.' },
  'reader-unknown-null': { source: 'tfjson', section: 'Values Representation', text: 'Any unknown values are omitted or set to null, making them indistinguishable from absent values; callers which need to distinguish unknown from unset must use the plan-specific or configuration-specific structures described in later sections.' },
  'reader-references': { source: 'tfjson', section: 'Expression Representation', text: 'Callers should only use string equality checks here, since the syntax may be extended in future releases.' },
  'reader-constant': { source: 'tfjson', section: 'Expression Representation', text: '"constant_value" is set only if the expression contains no references to other objects, in which case it gives the resulting constant value.' }
};

// The sentences that the findings quote. section is a heading of the saved page; text is copied from it.
export const FACTS = {
  // ---- the plan format
  'tf-replace-actions': {
    source: 'tfjson',
    section: 'Change Representation',
    text: 'The two "replace" actions are represented in this way to allow callers to e.g. just scan the list for "delete" to recognize all three situations where the object will be deleted, allowing for any new deletion combinations that might be added in future.'
  },
  'tf-after-unknown': {
    source: 'tfjson',
    section: 'Change Representation',
    text: '"after_unknown" is an object value with similar structure to "after", but with all unknown leaf values replaced with "true", and all known leaf values omitted.'
  },
  'tf-after-sensitive': {
    source: 'tfjson',
    section: 'Change Representation',
    text: '"before_sensitive" and "after_sensitive" are object values with similar structure to "before" and "after", but with all sensitive leaf values replaced with true, and all non-sensitive leaf values omitted. These objects should be combined with "before" and "after" to prevent accidental display of sensitive values in user interfaces.'
  },
  'tf-prevent-destroy': {
    source: 'tflife',
    section: 'prevent_destroy',
    text: 'Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources.'
  },
  'tf-prevent-destroy-rejects': {
    source: 'tflife',
    section: 'prevent_destroy',
    text: 'When prevent_destroy is set to true, Terraform rejects plans that would destroy the infrastructure object associated with the resource and returns an error.'
  },

  // ---- AWS: S3
  'aws-bpa-override': {
    source: 'awsbpa',
    section: 'Blocking public access to your Amazon S3 storage',
    text: 'S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources.'
  },
  'aws-bpa-all-four': {
    source: 'awsbpa',
    section: 'Important',
    text: 'Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8.'
  },
  'aws-s3-8-fails': {
    source: 'shs3',
    section: '[S3.8] S3 general purpose buckets should block public access',
    text: 'The control fails if any of the following settings are set to false:'
  },
  'aws-s3-8-unless': {
    source: 'shs3',
    section: '[S3.8] S3 general purpose buckets should block public access',
    text: 'Unless you intend to have your S3 buckets publicly accessible, you should configure the bucket level Amazon S3 Block Public Access feature.'
  },
  'tf-pab-block-public-acls': {
    source: 'tfpab',
    section: 'Argument Reference',
    text: 'Whether Amazon S3 should block public ACLs for this bucket. Defaults to `false`.'
  },
  'tf-pab-block-public-policy': {
    source: 'tfpab',
    section: 'Argument Reference',
    text: 'Whether Amazon S3 should block public bucket policies for this bucket. Defaults to `false`.'
  },
  'tf-pab-ignore-public-acls': {
    source: 'tfpab',
    section: 'Argument Reference',
    text: 'Whether Amazon S3 should ignore public ACLs for this bucket. Defaults to `false`.'
  },
  'tf-pab-restrict-public-buckets': {
    source: 'tfpab',
    section: 'Argument Reference',
    text: 'Whether Amazon S3 should restrict public bucket policies for this bucket. Defaults to `false`.'
  },
  'tf-s3-force-destroy': {
    source: 'tfs3',
    section: 'Argument Reference',
    text: 'These objects are *not* recoverable.'
  },

  // ---- AWS: security groups
  'aws-ec2-13-recommend': {
    source: 'shec2',
    section: '[EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22',
    text: 'We recommend that no security group allow unrestricted ingress access to port 22.'
  },
  'aws-ec2-13-unfettered': {
    source: 'shec2',
    section: '[EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22',
    text: "Removing unfettered connectivity to remote console services, such as SSH, reduces a server's exposure to risk."
  },
  'aws-ec2-14-recommend': {
    source: 'shec2',
    section: '[EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389',
    text: 'We recommend that no security group allow unrestricted ingress access to port 3389.'
  },
  'aws-ec2-14-unfettered': {
    source: 'shec2',
    section: '[EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389',
    text: "Removing unfettered connectivity to remote console services, such as RDP, reduces a server's exposure to risk."
  },
  'aws-ec2-18-port': {
    source: 'shec2',
    section: '[EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports',
    text: 'Unless a port is specifically allowed, the port should deny unrestricted access.'
  },
  'aws-ec2-18-malicious': {
    source: 'shec2',
    section: '[EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports',
    text: 'Unrestricted access (IP address with a /0 suffix) increases the opportunity for malicious activity such as hacking, denial-of-service attacks, and loss of data.'
  },
  'aws-ec2-19-malicious': {
    source: 'shec2',
    section: '[EC2.19] Security groups should not allow unrestricted access to ports with high risk',
    text: 'Unrestricted access (0.0.0.0/0) increases opportunities for malicious activity, such as hacking, denial-of-service attacks, and loss of data.'
  },
  'tf-sg-protocol-all': {
    source: 'tfsgrule',
    section: 'Resource: aws_security_group_rule',
    text: 'Setting `protocol = "all"` or `protocol = -1` with `from_port` and `to_port` will result in the EC2 API creating a security group rule with all ports open.'
  },
  'tf-sg-ingress-protocol': {
    source: 'tfsg',
    section: 'ingress',
    text: 'If you select a protocol of `-1` (semantically equivalent to `all`, which is not a valid value here), you must specify a `from_port` and `to_port` equal to 0.'
  },
  'tf-ingress-rule-protocol': {
    source: 'tfingress',
    section: 'Argument Reference',
    text: 'Use `-1` to specify all protocols.'
  },

  // ---- AWS: RDS and EBS
  'aws-rds-2-internet': {
    source: 'shrds',
    section: '[RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration',
    text: 'When the DB instance is configured with PubliclyAccessible, it is an Internet-facing instance with a publicly resolvable DNS name, which resolves to a public IP address.'
  },
  'aws-rds-2-unless': {
    source: 'shrds',
    section: '[RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration',
    text: 'Unless you intend for your RDS instance to be publicly accessible, the RDS instance should not be configured with PubliclyAccessible value.'
  },
  'tf-db-public': {
    source: 'tfdb',
    section: 'Argument Reference',
    text: 'Bool to control if instance is publicly accessible. Default is `false`.'
  },
  'aws-rds-3-encrypt': {
    source: 'shrds',
    section: '[RDS.3] RDS DB instances should have encryption at-rest enabled',
    text: 'For an added layer of security for your sensitive data in RDS DB instances, you should configure your RDS DB instances to be encrypted at rest.'
  },
  'tf-db-encrypted': {
    source: 'tfdb',
    section: 'Argument Reference',
    text: 'Note that if you are creating a cross-region read replica this field is ignored and you should instead declare `kms_key_id` with a valid ARN. The default is `false` if not specified.'
  },
  'tf-db-final-snapshot': {
    source: 'tfdb',
    section: 'Argument Reference',
    text: 'Whether a final DB snapshot is created before the DB instance is deleted. If true is specified, no DBSnapshot is created.'
  },
  'aws-ec2-3-encrypt': {
    source: 'shec2',
    section: '[EC2.3] Attached Amazon EBS volumes should be encrypted at-rest',
    text: 'For an added layer of security of your sensitive data in EBS volumes, you should enable EBS encryption at rest.'
  },
  'tf-ebs-encrypted': {
    source: 'tfebs',
    section: 'Argument Reference',
    text: 'If true, the disk will be encrypted.'
  },
  'aws-ebs-delete': {
    source: 'awsebsdel',
    section: 'Delete an Amazon EBS volume',
    text: "After deletion, its data is gone and the volume can't be attached to any instance."
  },

  // ---- Azure: storage account
  'az-anon-any-client': {
    source: 'azanon',
    section: 'Remediate anonymous read access to blob data (Azure Resource Manager deployments)',
    text: 'When a container is configured for anonymous access, any client can read data in that container.'
  },
  'az-anon-risk': {
    source: 'azanon',
    section: 'Remediate anonymous read access to blob data (Azure Resource Manager deployments)',
    text: 'Anonymous access presents a potential security risk, so if your scenario does not require it, we recommend that you disallow it for the storage account.'
  },
  'tf-azsa-nested-5': {
    source: 'tfsa',
    section: 'Arguments Reference',
    text: 'Allow or disallow nested items within this Account to opt into being public. Defaults to `false`.'
  },
  'tf-azsa-nested-4': {
    source: 'tfsa4',
    section: 'Arguments Reference',
    text: 'Allow or disallow nested items within this Account to opt into being public. Defaults to `true`.'
  },
  'az-net-default': {
    source: 'aznet',
    section: 'Azure Storage firewall rules and network access control',
    text: "By default, storage accounts allow connections from any network, but you can restrict access by configuring network rules that define which sources can connect to your storage account."
  },
  'az-net-denied': {
    source: 'aznet',
    section: 'Azure Storage firewall rules and network access control',
    text: 'When you configure network rules, only traffic from explicitly allowed sources can access your storage account through its public endpoint. All other traffic is denied.'
  },
  'tf-azsa-access-5': {
    source: 'tfsa',
    section: 'Arguments Reference',
    text: 'The public network access setting. Possible values are `Disabled`, `Enabled`, and `SecuredByPerimeter`. Defaults to `Enabled`.'
  },
  'tf-azsa-access-4': {
    source: 'tfsa4',
    section: 'Arguments Reference',
    text: 'Whether the public network access is enabled? Defaults to `true`.'
  },
  'tf-azsa-rules': {
    source: 'tfsa',
    section: 'Arguments Reference',
    text: 'Network Rules can be defined either directly on the `azurerm_storage_account` resource, or using the `azurerm_storage_account_network_rules` resource - but the two cannot be used together.'
  },
  'az-tls-recommended': {
    source: 'aztls',
    section: 'Enforce a minimum required version of Transport Layer Security (TLS) for requests to a storage account',
    text: 'The recommended minimum TLS version is TLS 1.2.'
  },
  'az-tls-remediate': {
    source: 'aztls',
    section: 'Remediate security risks with a minimum version of TLS',
    text: 'Requiring that clients use a minimum version of TLS to make requests against a storage account is part of a strategy to minimize security risks to your data.'
  },
  'tf-azsa-tls': {
    source: 'tfsa4',
    section: 'Arguments Reference',
    text: 'The minimum supported TLS version for the storage account. Possible values are `TLS1_0`, `TLS1_1`, `TLS1_2` and `TLS1_3`. Defaults to `TLS1_2` for new storage accounts.'
  },

  // ---- Azure: network security rules
  'az-jit-hunting': {
    source: 'azjit',
    section: 'Just-in-time machine access in Microsoft Defender for Cloud',
    text: 'Just-in-time protects your resources from threat actors actively hunting for machines with open management ports, such as Remote Desktop Protocol (RDP) or Secure Shell (SSH).'
  },
  'az-jit-minimize': {
    source: 'azjit',
    section: 'Just-in-time machine access in Microsoft Defender for Cloud',
    text: 'To reduce attack surfaces, minimize open ports, especially management ports.'
  },
  'az-jit-ports': {
    source: 'azjitusage',
    section: 'Enable JIT on your VMs from Microsoft Defender for Cloud',
    text: 'The JIT VM access page opens listing the ports that Defender for Cloud recommends protecting:'
  },
  'tf-nsr-source': {
    source: 'tfnsr',
    section: 'Arguments Reference',
    text: 'CIDR or source IP range or * to match any IP. Tags such as `VirtualNetwork`, `AzureLoadBalancer` and `Internet` can also be used.'
  },
  'tf-nsr-protocol': {
    source: 'tfnsr',
    section: 'Arguments Reference',
    text: 'Network protocol this rule applies to. Possible values include `Tcp`, `Udp`, `Icmp`, `Esp`, `Ah` or `*` (which matches all).'
  },
  'az-nsg-any': {
    source: 'aznsg',
    section: 'DenyAllOutBound',
    text: '0.0.0.0/0 in the Source and Destination columns represents all IP addresses.'
  },

  // ---- Google Cloud: storage
  'gcp-ubla-unintended': {
    source: 'gcpubla',
    section: 'Should you use uniform bucket-level access?',
    text: 'Uniform bucket-level access prevents unintended data exposure from ACLs.'
  },
  'gcp-ubla-iam-only': {
    source: 'gcpubla',
    section: 'Uniform bucket-level access',
    text: 'When you enable uniform bucket-level access on a bucket, Access Control Lists (ACLs) are disabled, and only bucket-level Identity and Access Management (IAM) permissions grant access to that bucket and the objects it contains.'
  },
  'gcp-scc-ubla': {
    source: 'gcpscc',
    section: 'Bucket policy only disabled',
    text: "Uniform bucket-level access, previously called Bucket Policy Only, isn't configured."
  },
  'gcp-iam-all-users': {
    source: 'gcpiam',
    section: 'allUsers',
    text: 'The value allUsers is a special identifier that represents anyone who is on the internet, including authenticated and unauthenticated users.'
  },
  'gcp-iam-all-authenticated': {
    source: 'gcpiam',
    section: 'allAuthenticatedUsers',
    text: 'The value allAuthenticatedUsers is a special identifier that represents all service accounts and all users on the internet who have authenticated with a Google Account.'
  },
  'tf-giam-all-users': {
    source: 'tfgiam',
    section: 'Argument Reference',
    text: 'A special identifier that represents anyone who is on the internet; with or without a Google account.'
  },
  'tf-giam-all-authenticated': {
    source: 'tfgiam',
    section: 'Argument Reference',
    text: 'A special identifier that represents anyone who is authenticated with a Google account or a service account.'
  },
  'tf-gcs-force-destroy': {
    source: 'tfgbucket',
    section: 'Argument Reference',
    text: 'When true, before deleting a bucket, delete all objects within the bucket, or Anywhere Caches caching data for that bucket.'
  },

  // ---- Google Cloud: firewall
  'gcp-scc-ssh': {
    source: 'gcpscc',
    section: 'Open SSH port',
    text: 'A firewall is configured to have an open SSH port that allows generic access.'
  },
  'gcp-scc-rdp': {
    source: 'gcpscc',
    section: 'Open RDP port',
    text: 'A firewall is configured to have an open RDP port that allows generic access.'
  },
  'gcp-fw-any-ipv4': {
    source: 'gcpfw',
    section: 'Ingress cases',
    text: 'The default source is any IPv4 address (0.0.0.0/0).'
  },
  'tf-gfw-direction': {
    source: 'tfgfw',
    section: 'Argument Reference',
    text: 'Direction of traffic to which this firewall applies; default is INGRESS.'
  },
  'tf-gfw-ports': {
    source: 'tfgfw',
    section: 'Argument Reference',
    text: 'If not specified, this rule applies to connections through any port.'
  }
};

// Sentences of the saved pages that name a value, a default or a list of values that the tool compares with. The page
// text is searched for the text; docs/rules-and-sources.md lists them.
export const VALUE_NOTES = [
  { source: 'tfdb', section: 'Argument Reference', text: '`replicate_source_db`' },
  { source: 'tfgfw', section: 'Argument Reference', text: 'This value can either be one of the following well known protocol strings (tcp, udp, icmp, esp, ah, sctp, ipip, all), or the IP protocol number.' },
  { source: 'tfgiam', section: 'Argument Reference', text: '`member/members`' },
  { source: 'tfgbucket', section: 'Argument Reference', text: '`uniform_bucket_level_access` - (Optional, Default: false)' },
  { source: 'tfsgrule', section: 'Argument Reference', text: 'Type of rule being created. Valid options are `ingress` (inbound)' },
  { source: 'tfsa', section: 'Arguments Reference', text: 'Valid options are `Deny` or `Allow`.' },
  { source: 'tfnsr', section: 'Arguments Reference', text: 'Possible values are `Inbound` and `Outbound`.' },
  { source: 'tfnsr', section: 'Arguments Reference', text: 'Possible values are `Allow` and `Deny`.' },
  { source: 'azjitusage', section: 'Enable JIT on your VMs from Microsoft Defender for Cloud', text: '22 - SSH' },
  { source: 'azjitusage', section: 'Enable JIT on your VMs from Microsoft Defender for Cloud', text: '3389 - RDP' },
  { source: 'shec2', section: '[EC2.19] Security groups should not allow unrestricted access to ports with high risk', text: '22 (SSH)' },
  { source: 'shec2', section: '[EC2.19] Security groups should not allow unrestricted access to ports with high risk', text: '3389 (RDP)' }
];

// Limits on the plan file and on the JSON inside it. docs/inputs.md lists them.
export const PLAN_LIMITS = {
  maxFileBytes: 64 * 1024 * 1024,
  maxDepth: 100,
  maxNodes: 4000000,
  maxStringChars: 1048576,
  maxKeyChars: 1024,
  maxNumberChars: 64,
  maxResources: 20000
};
