# tfplan-risk-check

Reads the JSON form of a Terraform plan (the output of `terraform show -json plan.out`) and reports the planned changes that would expose data or weaken security on AWS, Azure or Google Cloud, before you apply. You give it the file. For every problem it names the resource address, the attribute, the action (create, update, delete or replace), the severity, a sentence on how to fix it, and the sentence of the official documentation that the finding rests on, with the address of the page.

A plan fails in quiet ways. A security group with an ingress rule from `0.0.0.0/0` on port 22 passes `terraform validate` and a quick review, and the AWS Security Hub documentation says: "We recommend that no security group allow unrestricted ingress access to port 22." A bucket without a public access block is covered by a recommendation that all four settings be on "for each bucket". A database with `publicly_accessible` true is, in the words of the Security Hub control, "an Internet-facing instance with a publicly resolvable DNS name". A `google_storage_bucket_iam_member` for `allUsers` grants a role to "anyone who is on the internet, including authenticated and unauthenticated users". A plan that replaces a database or a volume destroys the old one, and the lifecycle page calls such objects "costly to reproduce". All of this is visible in the plan before it reaches a cloud. This tool reads it in a second, so the check can run on every pull request that changes the infrastructure.

- Every finding has an id, a severity (error, warning or info), the resource address and type, the attribute path, the action, a plain message, a fix and the quoted sentences of the documentation with the page address.
- The quotes are quotes. The pages of the Terraform, provider and cloud documentation are saved in [research/sources](research/sources), and a test compares every quoted sentence in [src/data.js](src/data.js), every attribute name and every list of values with the saved text. Where a finding draws a conclusion that no page states, the message says that it is the tool's own. A check that no saved page supports is not in the tool, and [docs/limits.md](docs/limits.md) lists what was left out.
- Nothing is skipped without a word. A value that is unknown until apply, a value that the plan marks sensitive, a value of the wrong kind and a resource type that is not checked are info findings or notes, never a pass and never a guess.
- It never prints a value that the plan marks sensitive: such a value is not read at all. It reads one file only. It never runs Terraform, never calls a cloud, never fetches an address and opens no connection.
- It has its own strict JSON reader, with limits on size, depth, number of values and length of strings. A key that appears twice is refused, and the file that is not a plan is refused with a message that says what it is. See [docs/method.md](docs/method.md).
- It does not repeat its neighbours: it does not read Kubernetes manifests, HTTP headers or lock files, see [Related](#related).
- Reports as text, Markdown, JSON and CSV, with an exit code for a pipeline gate. Info findings never fail the run.
- Plain JavaScript, no dependencies; the same plan always gives the same report.

```
npm test
```

```
ℹ tests 202
ℹ pass 198
ℹ fail 0
ℹ skipped 4
```

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/tfplan-risk-check.git
cd tfplan-risk-check
node bin/tfplan-risk-check.js examples/orders-app/plan.json
```

On your own plan:

```
terraform plan -out=plan.out
terraform show -json plan.out > plan.json
npx --yes github:INNERLUXES/tfplan-risk-check plan.json
```

In Windows PowerShell, write the file as UTF-8, because `>` writes UTF-16 there and the tool says so and stops: `terraform show -json plan.out | Out-File -Encoding utf8 plan.json`.

`examples/` holds the plan of a made-up orders application on the three clouds. `examples/orders-app/plan.json` has several problems, wrong on purpose: a bucket whose public access block has two settings off, a second bucket with no block, a security group open to the internet on SSH, a rule that opens every port to `::/0`, a rule open on RDP, a public and unencrypted database, an unencrypted volume, the deletion of a database with no final snapshot, the replacement of a volume, a storage account with anonymous access, TLS 1.0 and a public network, an Azure network security rule open on SSH and an inline one open on RDP, a Google Cloud bucket without uniform access and with a grant to `allUsers`, a member list that is unknown until apply, and a firewall open on SSH. It also holds near misses that must not be reported: a rule from an office network, an encrypted volume, a firewall from a private range. `examples/orders-app-fixed/plan.json` is the same application done properly, and passes the strictest gate.

## Usage

```
node bin/tfplan-risk-check.js examples/orders-app/plan.json
```

```
tfplan-risk-check: plan.json
read: 20 resources (18 create, 1 delete, 1 replace), format 1.2, Terraform 1.9.8
findings: 11 error, 8 warning, 1 info

ERROR    aws-s3-public-access-block-off  aws_s3_bucket_public_access_block.orders_exports
         action: create
         at: block_public_policy
         block_public_policy is false, so this part of S3 Block Public Access is off for the bucket.
         fix: Set block_public_policy to true; the four settings are recommended together.
         source (Amazon S3, Blocking public access): "S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (Amazon S3, Blocking public access, Important): "Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (AWS Security Hub, S3 controls, [S3.8] S3 general purpose buckets should block public access): "The control fails if any of the following settings are set to false:"
           https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html
         source (aws_s3_bucket_public_access_block (AWS provider 6.67.0), Argument Reference): "Whether Amazon S3 should block public bucket policies for this bucket. Defaults to `false`."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket_public_access_block

ERROR    aws-s3-public-access-block-off  aws_s3_bucket_public_access_block.orders_exports
         action: create
         at: restrict_public_buckets
         restrict_public_buckets is false, so this part of S3 Block Public Access is off for the bucket.
         fix: Set restrict_public_buckets to true; the four settings are recommended together.
         source (Amazon S3, Blocking public access): "S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (Amazon S3, Blocking public access, Important): "Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (AWS Security Hub, S3 controls, [S3.8] S3 general purpose buckets should block public access): "The control fails if any of the following settings are set to false:"
           https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html
         source (aws_s3_bucket_public_access_block (AWS provider 6.67.0), Argument Reference): "Whether Amazon S3 should restrict public bucket policies for this bucket. Defaults to `false`."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket_public_access_block

WARNING  aws-s3-public-access-block-missing  aws_s3_bucket.orders_uploads
         action: create
         at: (resource)
         No aws_s3_bucket_public_access_block in the plan points at this bucket, so this plan sets no Block Public Access setting on it. A setting made on the account or the organization outside this plan is not seen.
         fix: Add an aws_s3_bucket_public_access_block for the bucket with block_public_acls, block_public_policy, ignore_public_acls and restrict_public_buckets all true.
         source (Amazon S3, Blocking public access): "S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (Amazon S3, Blocking public access, Important): "Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8."
           https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
         source (AWS Security Hub, S3 controls, [S3.8] S3 general purpose buckets should block public access): "Unless you intend to have your S3 buckets publicly accessible, you should configure the bucket level Amazon S3 Block Public Access feature."
           https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html

ERROR    aws-sg-ssh-open  aws_security_group.orders_app
         action: create
         at: ingress[1].cidr_blocks[0]
         An ingress rule allows TCP port 22 (SSH) from 0.0.0.0/0, which is the whole internet.
         fix: Limit the source to the addresses that need SSH access (a CIDR block of your own, or the security group of a bastion host), or remove the rule.
         source (AWS Security Hub, EC2 controls, [EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22): "We recommend that no security group allow unrestricted ingress access to port 22."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22): "Removing unfettered connectivity to remote console services, such as SSH, reduces a server's exposure to risk."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.19] Security groups should not allow unrestricted access to ports with high risk): "Unrestricted access (0.0.0.0/0) increases opportunities for malicious activity, such as hacking, denial-of-service attacks, and loss of data."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html

ERROR    aws-sg-all-ports-open  aws_security_group_rule.debug_everything
         action: create
         at: ipv6_cidr_blocks[0]
         An ingress rule allows all protocols and all ports from ::/0, which is the whole internet.
         fix: Open only the ports that the service needs, and only to the sources that need them.
         source (AWS Security Hub, EC2 controls, [EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports): "Unless a port is specifically allowed, the port should deny unrestricted access."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports): "Unrestricted access (IP address with a /0 suffix) increases the opportunity for malicious activity such as hacking, denial-of-service attacks, and loss of data."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.19] Security groups should not allow unrestricted access to ports with high risk): "Unrestricted access (0.0.0.0/0) increases opportunities for malicious activity, such as hacking, denial-of-service attacks, and loss of data."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (aws_security_group_rule (AWS provider 6.67.0)): "Setting `protocol = "all"` or `protocol = -1` with `from_port` and `to_port` will result in the EC2 API creating a security group rule with all ports open."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group_rule
         source (aws_security_group (AWS provider 6.67.0), ingress): "If you select a protocol of `-1` (semantically equivalent to `all`, which is not a valid value here), you must specify a `from_port` and `to_port` equal to 0."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group
         source (aws_vpc_security_group_ingress_rule (AWS provider 6.67.0), Argument Reference): "Use `-1` to specify all protocols."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/vpc_security_group_ingress_rule

ERROR    aws-sg-rdp-open  aws_vpc_security_group_ingress_rule.rdp_admin
         action: create
         at: cidr_ipv4
         An ingress rule allows TCP port 3389 (RDP) from 0.0.0.0/0, which is the whole internet.
         fix: Limit the source to the addresses that need RDP access (a CIDR block of your own, or the security group of a bastion host), or remove the rule.
         source (AWS Security Hub, EC2 controls, [EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389): "We recommend that no security group allow unrestricted ingress access to port 3389."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389): "Removing unfettered connectivity to remote console services, such as RDP, reduces a server's exposure to risk."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (AWS Security Hub, EC2 controls, [EC2.19] Security groups should not allow unrestricted access to ports with high risk): "Unrestricted access (0.0.0.0/0) increases opportunities for malicious activity, such as hacking, denial-of-service attacks, and loss of data."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html

ERROR    aws-rds-public  aws_db_instance.orders
         action: create
         at: publicly_accessible
         publicly_accessible is true, so the DB instance is planned as an Internet-facing instance.
         fix: Set publicly_accessible to false and reach the database from inside the network.
         source (AWS Security Hub, RDS controls, [RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration): "When the DB instance is configured with PubliclyAccessible, it is an Internet-facing instance with a publicly resolvable DNS name, which resolves to a public IP address."
           https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html
         source (AWS Security Hub, RDS controls, [RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration): "Unless you intend for your RDS instance to be publicly accessible, the RDS instance should not be configured with PubliclyAccessible value."
           https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html
         source (aws_db_instance (AWS provider 6.67.0), Argument Reference): "Bool to control if instance is publicly accessible. Default is `false`."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance

WARNING  aws-rds-unencrypted  aws_db_instance.orders
         action: create
         at: storage_encrypted
         storage_encrypted is false, so the storage of the DB instance is not encrypted at rest.
         fix: Set storage_encrypted to true.
         source (AWS Security Hub, RDS controls, [RDS.3] RDS DB instances should have encryption at-rest enabled): "For an added layer of security for your sensitive data in RDS DB instances, you should configure your RDS DB instances to be encrypted at rest."
           https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html
         source (aws_db_instance (AWS provider 6.67.0), Argument Reference): "Note that if you are creating a cross-region read replica this field is ignored and you should instead declare `kms_key_id` with a valid ARN. The default is `false` if not specified."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance

WARNING  aws-ebs-unencrypted  aws_ebs_volume.orders_scratch
         action: create
         at: encrypted
         encrypted is false, so the volume is planned without encryption at rest.
         fix: Set encrypted to true.
         source (AWS Security Hub, EC2 controls, [EC2.3] Attached Amazon EBS volumes should be encrypted at-rest): "For an added layer of security of your sensitive data in EBS volumes, you should enable EBS encryption at rest."
           https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html
         source (aws_ebs_volume (AWS provider 6.67.0), Argument Reference): "If true, the disk will be encrypted."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/ebs_volume

WARNING  stateful-delete  aws_db_instance.legacy_reports
         action: delete
         at: (resource)
         The plan deletes this DB instance, and the data in it goes with it unless it is kept somewhere else. skip_final_snapshot is true on it, so no final snapshot is taken.
         fix: Check that the data is saved or no longer needed. To keep the object, remove it from the plan (for example with a removed block or terraform state rm) or set prevent_destroy to true.
         source (Terraform lifecycle reference, prevent_destroy): "Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources."
           https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
         source (Terraform lifecycle reference, prevent_destroy): "When prevent_destroy is set to true, Terraform rejects plans that would destroy the infrastructure object associated with the resource and returns an error."
           https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
         source (Terraform JSON Output Format, Change Representation): "The two "replace" actions are represented in this way to allow callers to e.g. just scan the list for "delete" to recognize all three situations where the object will be deleted, allowing for any new deletion combinations that might be added in future."
           https://developer.hashicorp.com/terraform/internals/json-format
         source (aws_db_instance (AWS provider 6.67.0), Argument Reference): "Whether a final DB snapshot is created before the DB instance is deleted. If true is specified, no DBSnapshot is created."
           https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance

WARNING  stateful-replace  aws_ebs_volume.orders_data
         action: replace
         at: availability_zone
         The plan replaces this volume: it is destroyed and created again, and the data in the old one is lost unless it is kept somewhere else. Terraform gives the reason replace_because_cannot_update.
         fix: Check that the data is saved or no longer needed, and look at the attribute that forces the replacement. Set prevent_destroy to true if the object must never be replaced.
         source (Terraform lifecycle reference, prevent_destroy): "Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources."
           https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
         source (Terraform lifecycle reference, prevent_destroy): "When prevent_destroy is set to true, Terraform rejects plans that would destroy the infrastructure object associated with the resource and returns an error."
           https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle
         source (Terraform JSON Output Format, Change Representation): "The two "replace" actions are represented in this way to allow callers to e.g. just scan the list for "delete" to recognize all three situations where the object will be deleted, allowing for any new deletion combinations that might be added in future."
           https://developer.hashicorp.com/terraform/internals/json-format
         source (Amazon EBS, Delete a volume): "After deletion, its data is gone and the volume can't be attached to any instance."
           https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html

ERROR    azure-storage-public-blob-access  azurerm_storage_account.orders_files
         action: create
         at: allow_nested_items_to_be_public
         allow_nested_items_to_be_public is true, so containers in the storage account can be set up for anonymous read access.
         fix: Set allow_nested_items_to_be_public to false.
         source (Microsoft Learn, Remediate anonymous read access to blob data): "When a container is configured for anonymous access, any client can read data in that container."
           https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent
         source (Microsoft Learn, Remediate anonymous read access to blob data): "Anonymous access presents a potential security risk, so if your scenario does not require it, we recommend that you disallow it for the storage account."
           https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent
         source (azurerm_storage_account (AzureRM provider 5.8.0), Arguments Reference): "Allow or disallow nested items within this Account to opt into being public. Defaults to `false`."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account
         source (azurerm_storage_account (AzureRM provider 4.64.0), Arguments Reference): "Allow or disallow nested items within this Account to opt into being public. Defaults to `true`."
           https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account

WARNING  azure-storage-public-network-access  azurerm_storage_account.orders_files
         action: create
         at: public_network_access_enabled
         The storage account has public network access enabled and no network rule that denies by default, so its public endpoint answers connections from any network.
         fix: Turn public network access off (public_network_access = "Disabled", or public_network_access_enabled = false in the older provider), or add network_rules with default_action = "Deny" and list the networks that need access.
         source (Microsoft Learn, Azure Storage firewall rules): "By default, storage accounts allow connections from any network, but you can restrict access by configuring network rules that define which sources can connect to your storage account."
           https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security
         source (Microsoft Learn, Azure Storage firewall rules): "When you configure network rules, only traffic from explicitly allowed sources can access your storage account through its public endpoint. All other traffic is denied."
           https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security
         source (azurerm_storage_account (AzureRM provider 5.8.0), Arguments Reference): "The public network access setting. Possible values are `Disabled`, `Enabled`, and `SecuredByPerimeter`. Defaults to `Enabled`."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account
         source (azurerm_storage_account (AzureRM provider 4.64.0), Arguments Reference): "Whether the public network access is enabled? Defaults to `true`."
           https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account
         source (azurerm_storage_account (AzureRM provider 5.8.0), Arguments Reference): "Network Rules can be defined either directly on the `azurerm_storage_account` resource, or using the `azurerm_storage_account_network_rules` resource - but the two cannot be used together."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account

WARNING  azure-storage-min-tls  azurerm_storage_account.orders_files
         action: create
         at: min_tls_version
         min_tls_version is TLS1_0, which is below TLS1_2, the minimum that Microsoft recommends.
         fix: Set min_tls_version to TLS1_2.
         source (Microsoft Learn, Minimum TLS version for a storage account): "The recommended minimum TLS version is TLS 1.2."
           https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version
         source (Microsoft Learn, Minimum TLS version for a storage account, Remediate security risks with a minimum version of TLS): "Requiring that clients use a minimum version of TLS to make requests against a storage account is part of a strategy to minimize security risks to your data."
           https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version
         source (azurerm_storage_account (AzureRM provider 4.64.0), Arguments Reference): "The minimum supported TLS version for the storage account. Possible values are `TLS1_0`, `TLS1_1`, `TLS1_2` and `TLS1_3`. Defaults to `TLS1_2` for new storage accounts."
           https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account

ERROR    azure-nsg-ssh-open  azurerm_network_security_rule.ssh_any
         action: create
         at: source_address_prefix
         An inbound rule allows TCP from any source to port 22 (SSH), so SSH is open to the internet.
         fix: Limit the source to the addresses that need SSH access, or use just-in-time access, or remove the rule.
         source (Microsoft Learn, Just-in-time machine access): "Just-in-time protects your resources from threat actors actively hunting for machines with open management ports, such as Remote Desktop Protocol (RDP) or Secure Shell (SSH)."
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview
         source (Microsoft Learn, Just-in-time machine access): "To reduce attack surfaces, minimize open ports, especially management ports."
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview
         source (Microsoft Learn, Enable just-in-time access, Enable JIT on your VMs from Microsoft Defender for Cloud): "The JIT VM access page opens listing the ports that Defender for Cloud recommends protecting:"
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage
         source (azurerm_network_security_rule (AzureRM provider 5.8.0), Arguments Reference): "CIDR or source IP range or * to match any IP. Tags such as `VirtualNetwork`, `AzureLoadBalancer` and `Internet` can also be used."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule
         source (azurerm_network_security_rule (AzureRM provider 5.8.0), Arguments Reference): "Network protocol this rule applies to. Possible values include `Tcp`, `Udp`, `Icmp`, `Esp`, `Ah` or `*` (which matches all)."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule
         source (Microsoft Learn, Network security groups, DenyAllOutBound): "0.0.0.0/0 in the Source and Destination columns represents all IP addresses."
           https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview

ERROR    azure-nsg-rdp-open  azurerm_network_security_group.orders_inline
         action: create
         at: security_rule[0].source_address_prefix
         An inbound rule allows all protocols from Internet to port 3389 (RDP), so RDP is open to the internet.
         fix: Limit the source to the addresses that need RDP access, or use just-in-time access, or remove the rule.
         source (Microsoft Learn, Just-in-time machine access): "Just-in-time protects your resources from threat actors actively hunting for machines with open management ports, such as Remote Desktop Protocol (RDP) or Secure Shell (SSH)."
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview
         source (Microsoft Learn, Just-in-time machine access): "To reduce attack surfaces, minimize open ports, especially management ports."
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview
         source (Microsoft Learn, Enable just-in-time access, Enable JIT on your VMs from Microsoft Defender for Cloud): "The JIT VM access page opens listing the ports that Defender for Cloud recommends protecting:"
           https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage
         source (azurerm_network_security_rule (AzureRM provider 5.8.0), Arguments Reference): "CIDR or source IP range or * to match any IP. Tags such as `VirtualNetwork`, `AzureLoadBalancer` and `Internet` can also be used."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule
         source (azurerm_network_security_rule (AzureRM provider 5.8.0), Arguments Reference): "Network protocol this rule applies to. Possible values include `Tcp`, `Udp`, `Icmp`, `Esp`, `Ah` or `*` (which matches all)."
           https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule
         source (Microsoft Learn, Network security groups, DenyAllOutBound): "0.0.0.0/0 in the Source and Destination columns represents all IP addresses."
           https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview

WARNING  gcp-bucket-uniform-access-off  google_storage_bucket.orders_exports
         action: create
         at: uniform_bucket_level_access
         uniform_bucket_level_access is false, so ACLs stay active on the bucket next to IAM.
         fix: Set uniform_bucket_level_access to true.
         source (Google Cloud, Uniform bucket-level access, Should you use uniform bucket-level access?): "Uniform bucket-level access prevents unintended data exposure from ACLs."
           https://cloud.google.com/storage/docs/uniform-bucket-level-access
         source (Google Cloud, Uniform bucket-level access): "When you enable uniform bucket-level access on a bucket, Access Control Lists (ACLs) are disabled, and only bucket-level Identity and Access Management (IAM) permissions grant access to that bucket and the objects it contains."
           https://cloud.google.com/storage/docs/uniform-bucket-level-access
         source (Google Cloud, Security Command Center vulnerability findings, Bucket policy only disabled): "Uniform bucket-level access, previously called Bucket Policy Only, isn't configured."
           https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings

ERROR    gcp-bucket-public-all-users  google_storage_bucket_iam_member.public_read
         action: create
         at: member
         allUsers is granted the role roles/storage.objectViewer on the bucket, so anyone on the internet gets that access.
         fix: Grant the role to the identities that need it (users, groups or service accounts), and not to a special identifier for everyone.
         source (Google Cloud, IAM principals, allUsers): "The value allUsers is a special identifier that represents anyone who is on the internet, including authenticated and unauthenticated users."
           https://cloud.google.com/iam/docs/principals-overview
         source (google_storage_bucket_iam (Google provider 8.5.0), Argument Reference): "A special identifier that represents anyone who is on the internet; with or without a Google account."
           https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket_iam

INFO     value-unknown  google_storage_bucket_iam_binding.support
         action: create
         at: members
         members is not known until apply, so the check on it was not made and nothing was guessed.
         fix: Make the value one that Terraform can know at plan time, or review it by hand after apply.
         source (Terraform JSON Output Format, Change Representation): ""after_unknown" is an object value with similar structure to "after", but with all unknown leaf values replaced with "true", and all known leaf values omitted."
           https://developer.hashicorp.com/terraform/internals/json-format

ERROR    gcp-firewall-ssh-open  google_compute_firewall.ssh
         action: create
         at: source_ranges[0]
         The firewall rule allows ingress from 0.0.0.0/0, which is any IPv4 address, to TCP port 22 (SSH).
         fix: Limit source_ranges to the addresses that need SSH access, or reach the machines through a proxy such as Identity-Aware Proxy, or remove the rule.
         source (Google Cloud, Security Command Center vulnerability findings, Open SSH port): "A firewall is configured to have an open SSH port that allows generic access."
           https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings
         source (Google Cloud, VPC firewall rules, Ingress cases): "The default source is any IPv4 address (0.0.0.0/0)."
           https://cloud.google.com/firewall/docs/firewalls

note: Changed resources of other types are counted and not checked: aws_instance (1).

GATE: FAIL - 11 errors
```

The same plan, fixed, with the strictest gate:

```
node bin/tfplan-risk-check.js examples/orders-app-fixed/plan.json --fail-on warning
```

```
tfplan-risk-check: plan.json
read: 15 resources (14 create, 1 update), format 1.2, Terraform 1.9.8
findings: 0 error, 0 warning, 0 info

no findings

note: Changed resources of other types are counted and not checked: aws_instance (1).

GATE: PASS (--fail-on warning)
```

`npm run example` runs both, checks that they report what is shown here, and writes the report of the failing plan in every format to [examples/output](examples/output).

## What is checked

Types: `aws_s3_bucket`, `aws_s3_bucket_public_access_block`, `aws_security_group`, `aws_security_group_rule`, `aws_vpc_security_group_ingress_rule`, `aws_db_instance`, `aws_ebs_volume`, `azurerm_storage_account`, `azurerm_network_security_rule`, `azurerm_network_security_group`, `google_storage_bucket`, `google_storage_bucket_iam_member`, `google_storage_bucket_iam_binding` and `google_compute_firewall`, when the plan creates, updates or replaces them, and eight types that hold data (databases, buckets, volumes, disks and storage accounts) when the plan deletes or replaces them. A resource that the plan leaves as it is, a data source and any other type are counted and not checked.

| Check | Severity | What it reports |
| --- | --- | --- |
| `aws-s3-public-access-block-off` | error | one of the four settings of a public access block is false or left out |
| `aws-sg-ssh-open` | error | ingress from `0.0.0.0/0` or `::/0` on TCP port 22 |
| `aws-sg-rdp-open` | error | ingress from `0.0.0.0/0` or `::/0` on TCP port 3389 |
| `aws-sg-all-ports-open` | error | ingress from `0.0.0.0/0` or `::/0` on all protocols or all ports |
| `aws-rds-public` | error | a DB instance with `publicly_accessible` true |
| `azure-storage-public-blob-access` | error | a storage account with `allow_nested_items_to_be_public` true |
| `azure-nsg-ssh-open` | error | an inbound allow rule from `*`, `0.0.0.0/0` or `Internet` to port 22 |
| `azure-nsg-rdp-open` | error | the same to port 3389 |
| `gcp-bucket-public-all-users` | error | a bucket grant to `allUsers` |
| `gcp-bucket-public-all-authenticated` | error | a bucket grant to `allAuthenticatedUsers` |
| `gcp-firewall-ssh-open` | error | an ingress rule from `0.0.0.0/0` to TCP port 22 |
| `gcp-firewall-rdp-open` | error | the same to port 3389 |
| `aws-s3-public-access-block-missing` | warning | a bucket with no public access block in the plan that points at it |
| `aws-rds-unencrypted` | warning | a DB instance with `storage_encrypted` false or left out |
| `aws-ebs-unencrypted` | warning | a volume with `encrypted` false |
| `azure-storage-public-network-access` | warning | a storage account on every network: public access on and no deny rule |
| `azure-storage-min-tls` | warning | `min_tls_version` of `TLS1_0` or `TLS1_1` |
| `gcp-bucket-uniform-access-off` | warning | `uniform_bucket_level_access` false or left out |
| `stateful-delete` | warning | the deletion of a database, bucket, volume, disk or storage account |
| `stateful-replace` | warning | the replacement of the same |
| `value-unknown` | info | a value that a check needs is unknown until apply |
| `value-sensitive` | info | a value that a check needs is marked sensitive and was not read |
| `value-not-read` | info | a value is not of the kind that the provider page lists |

[docs/method.md](docs/method.md) gives each check, its exact rule, what it can see and what it cannot. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every quoted sentence and attribute with the saved page it comes from.

## Severity

The pages give reasons and no scale, so the severity is the tool's own mapping. An error is a change that opens a resource to the whole internet or switches off a block on public access. A warning is a change that weakens a protection, leaves one out, or deletes or replaces something that holds data. Info is a thing the tool could not read. Each finding says its severity and the page it rests on, and [docs/method.md](docs/method.md) says how it was decided.

## Where the facts come from

| Fact | Source |
| --- | --- |
| The plan format: actions, `after_unknown`, `after_sensitive`, the configuration | https://developer.hashicorp.com/terraform/internals/json-format |
| Why deleting and replacing stateful objects matters | https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle |
| Attribute names and defaults of the resources | the provider pages in https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs, https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs (and 4.64.0 for the storage account) and https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs |
| S3 Block Public Access, EBS volumes | https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html and https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html |
| Security groups, RDS and EBS encryption, S3 public access | the AWS Security Hub controls: https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html, https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html and https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html |
| Azure storage: anonymous access, TLS, network rules | https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent, https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version and https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security |
| Azure management ports, security group sources | https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview, https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage and https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview |
| Google Cloud buckets and IAM principals | https://cloud.google.com/storage/docs/uniform-bucket-level-access and https://cloud.google.com/iam/docs/principals-overview |
| Google Cloud firewall rules | https://cloud.google.com/firewall/docs/firewalls and https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings |

## Formats

- `text`: for a terminal: the file read, the counts, then each finding with its resource address, the action, the attribute, message, fix and the quoted sentences with their addresses.
- `markdown`: the same as a table for a pull request comment or the job summary. Pipes, line breaks and angle brackets from the input are escaped, so a name from a plan cannot break the table.
- `json`: the whole report: the input (file name, size, versions, counts by action, checked), every finding with id, severity, cloud, address, type, attribute, action, message, fix and source sentences, the notes and the gate.
- `csv`: one row per finding, quoted as RFC 4180 says. A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.

To put the report in the job summary of a GitHub Actions run:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Plan
    run: |
      terraform plan -out=plan.out
      terraform show -json plan.out > plan.json
  - name: Plan report
    run: npx --yes github:INNERLUXES/tfplan-risk-check plan.json --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Plan gate
    run: npx --yes github:INNERLUXES/tfplan-risk-check plan.json --fail-on warning
```

It needs no cloud credentials of its own and no network access of its own: it runs on the file that `terraform show` wrote, and the plan step is yours. A plan file holds the values that Terraform plans to write, so keep it out of artifacts that others can download. Start with the default gate (errors only), and move to `--fail-on warning` when the first report is clean.

## Options and exit codes

`tfplan-risk-check <plan.json> [--format <name>] [--fail-on <level>]`. `--format <name>` is `text` (the default), `markdown`, `json` or `csv`. `--fail-on <level>` is `error` (the default) or `warning`; info never fails the run. `--help` and `--version` print and exit with `0`.

`0` no finding at the `--fail-on` level, `1` at least one such finding (by default: an error), `2` a usage or input error (a missing file, a folder, a file that is not a plan, JSON that breaks a limit, an unknown option, a URL in place of a path, standard input).

A file that is not a plan is exit code `2` and writes nothing to standard output, so a pipeline stops instead of passing on an empty report.

## Limits

The tool reads what a plan says, not what a cloud does. It does not see an account or organization setting, a network ACL, a route, a rule that overrides another by priority, or what already exists and is not changed by the plan. A value that is unknown until apply is not guessed, and a value that is marked sensitive is not read. A finding says what the plan shows. A pass is not a secure environment. [docs/limits.md](docs/limits.md) lists the rest, including the checks that were left out because no saved page supports them, and [docs/threat-model.md](docs/threat-model.md) and [docs/secure-defaults.md](docs/secure-defaults.md) say how the tool treats a hostile file.

## Related

The tool covers Terraform plans. It does not repeat its neighbours in the same organization: `k8s-manifest-check` reads the manifests of Kubernetes workloads, `security-headers-check` reads the security headers of saved HTTP responses, and `lockfile-check` reads npm lock files. This tool reads the JSON of a plan, which none of them reads.

## Background

- How cloud applications are designed, built, deployed and run, with checks like this one in the pipeline: [cloud application development services](https://innerluxes.dev/application/development/cloud).

## License

MIT
