# Rules and sources

Every sentence, attribute name and value that the checks rely on comes from a page of the Terraform documentation, the Terraform provider documentation or the documentation of a cloud, saved in this repository. The first line of each saved file is the address of the page, and `test/data.test.js` compares this list, `src/data.js` and the saved text word for word. Nothing is written from memory. A check that no saved page supports is not in the tool, and [limits.md](limits.md) lists what was left out for that reason. A conclusion that no page states is marked as the tool's own in [method.md](method.md) and in the message of the finding.

A provider page is saved at the version named in its address, because the registry shows a different text for each version. Two versions of the Azure storage account page are saved: the older one lists the values `TLS1_0` and `TLS1_1` of `min_tls_version`, the attribute `public_network_access_enabled` and a default of `true` for `allow_nested_items_to_be_public`; the newer one lists `public_network_access` and a default of `false`. A plan can come from either provider version, so the tool reads both and quotes both. Five pages are long, and only the sections that the checks use are saved: the Security Hub controls for EC2, RDS and S3, the Security Command Center findings, and the Google Cloud firewall rules page without a section on one product that no check uses. The second line of such a file says so, and a quote from it always names its section.

## Saved pages

| Page | Address | Saved text |
| --- | --- | --- |
| Terraform JSON Output Format | https://developer.hashicorp.com/terraform/internals/json-format | `research/sources/tf-json-format.txt` |
| Terraform lifecycle reference | https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle | `research/sources/tf-lifecycle.txt` |
| aws_s3_bucket_public_access_block (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket_public_access_block | `research/sources/tf-aws-s3-bucket-public-access-block.txt` |
| aws_s3_bucket (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket | `research/sources/tf-aws-s3-bucket.txt` |
| aws_security_group (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group | `research/sources/tf-aws-security-group.txt` |
| aws_security_group_rule (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group_rule | `research/sources/tf-aws-security-group-rule.txt` |
| aws_vpc_security_group_ingress_rule (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/vpc_security_group_ingress_rule | `research/sources/tf-aws-vpc-security-group-ingress-rule.txt` |
| aws_db_instance (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance | `research/sources/tf-aws-db-instance.txt` |
| aws_ebs_volume (AWS provider 6.67.0) | https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/ebs_volume | `research/sources/tf-aws-ebs-volume.txt` |
| azurerm_storage_account (AzureRM provider 5.8.0) | https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account | `research/sources/tf-azurerm-storage-account.txt` |
| azurerm_storage_account (AzureRM provider 4.64.0) | https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account | `research/sources/tf-azurerm-storage-account-4.txt` |
| azurerm_network_security_rule (AzureRM provider 5.8.0) | https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule | `research/sources/tf-azurerm-network-security-rule.txt` |
| azurerm_network_security_group (AzureRM provider 5.8.0) | https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_group | `research/sources/tf-azurerm-network-security-group.txt` |
| google_storage_bucket (Google provider 8.5.0) | https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket | `research/sources/tf-google-storage-bucket.txt` |
| google_storage_bucket_iam (Google provider 8.5.0) | https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket_iam | `research/sources/tf-google-storage-bucket-iam.txt` |
| google_compute_firewall (Google provider 8.5.0) | https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/compute_firewall | `research/sources/tf-google-compute-firewall.txt` |
| Amazon S3, Blocking public access | https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html | `research/sources/aws-s3-block-public-access.txt` |
| Amazon EBS, Delete a volume | https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html | `research/sources/aws-ebs-delete-volume.txt` |
| AWS Security Hub, EC2 controls | https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html | `research/sources/aws-securityhub-ec2-controls.txt` |
| AWS Security Hub, RDS controls | https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html | `research/sources/aws-securityhub-rds-controls.txt` |
| AWS Security Hub, S3 controls | https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html | `research/sources/aws-securityhub-s3-controls.txt` |
| Microsoft Learn, Remediate anonymous read access to blob data | https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent | `research/sources/azure-anonymous-read-access-prevent.txt` |
| Microsoft Learn, Minimum TLS version for a storage account | https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version | `research/sources/azure-storage-minimum-tls.txt` |
| Microsoft Learn, Azure Storage firewall rules | https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security | `research/sources/azure-storage-network-security.txt` |
| Microsoft Learn, Network security groups | https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview | `research/sources/azure-nsg-overview.txt` |
| Microsoft Learn, Just-in-time machine access | https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview | `research/sources/azure-jit-access-overview.txt` |
| Microsoft Learn, Enable just-in-time access | https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage | `research/sources/azure-jit-access-usage.txt` |
| Google Cloud, Uniform bucket-level access | https://cloud.google.com/storage/docs/uniform-bucket-level-access | `research/sources/gcp-uniform-bucket-level-access.txt` |
| Google Cloud, IAM principals | https://cloud.google.com/iam/docs/principals-overview | `research/sources/gcp-iam-principals.txt` |
| Google Cloud, VPC firewall rules | https://cloud.google.com/firewall/docs/firewalls | `research/sources/gcp-firewall-overview.txt` |
| Google Cloud, Security Command Center vulnerability findings | https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings | `research/sources/gcp-scc-vulnerability-findings.txt` |

## Attribute names

Each attribute that a check reads is a bullet of the saved provider page of its resource. The test looks for the bullet. For the three Google Cloud bucket IAM resources the page lists the identity argument as `member/members`, and the tool reads `member` of `google_storage_bucket_iam_member` and `members` of `google_storage_bucket_iam_binding`.

| Resource | Attributes read | Saved page |
| --- | --- | --- |
| `aws_s3_bucket_public_access_block` | `block_public_acls`, `block_public_policy`, `ignore_public_acls`, `restrict_public_buckets`, `bucket` | `tf-aws-s3-bucket-public-access-block.txt` |
| `aws_s3_bucket` | `bucket`, `force_destroy` | `tf-aws-s3-bucket.txt` |
| `aws_security_group` | `ingress`, `cidr_blocks`, `ipv6_cidr_blocks`, `from_port`, `to_port`, `protocol` | `tf-aws-security-group.txt` |
| `aws_security_group_rule` | `type`, `cidr_blocks`, `ipv6_cidr_blocks`, `from_port`, `to_port`, `protocol` | `tf-aws-security-group-rule.txt` |
| `aws_vpc_security_group_ingress_rule` | `cidr_ipv4`, `cidr_ipv6`, `from_port`, `to_port`, `ip_protocol` | `tf-aws-vpc-security-group-ingress-rule.txt` |
| `aws_db_instance` | `publicly_accessible`, `storage_encrypted`, `replicate_source_db`, `skip_final_snapshot`, `deletion_protection` | `tf-aws-db-instance.txt` |
| `aws_ebs_volume` | `encrypted` | `tf-aws-ebs-volume.txt` |
| `azurerm_storage_account` (5.8.0) | `allow_nested_items_to_be_public`, `public_network_access`, `min_tls_version`, `network_rules`, `default_action` | `tf-azurerm-storage-account.txt` |
| `azurerm_storage_account` (4.64.0) | `allow_nested_items_to_be_public`, `public_network_access_enabled`, `min_tls_version`, `network_rules`, `default_action` | `tf-azurerm-storage-account-4.txt` |
| `azurerm_network_security_rule` | `protocol`, `source_address_prefix`, `source_address_prefixes`, `destination_port_range`, `destination_port_ranges`, `access`, `direction` | `tf-azurerm-network-security-rule.txt` |
| `azurerm_network_security_group` | `security_rule` and, inside it, the attributes above | `tf-azurerm-network-security-group.txt` |
| `google_storage_bucket` | `uniform_bucket_level_access`, `force_destroy` | `tf-google-storage-bucket.txt` |
| `google_storage_bucket_iam_member`, `google_storage_bucket_iam_binding` | `member`, `members`, `role` | `tf-google-storage-bucket-iam.txt` |
| `google_compute_firewall` | `allow`, `protocol`, `ports`, `direction`, `source_ranges`, `disabled` | `tf-google-compute-firewall.txt` |

## Values that a check compares with

| Value | Where it is written |
| --- | --- |
| `0.0.0.0/0` and `::/0` as the whole internet on AWS | the titles of the Security Hub controls EC2.13 and EC2.14 |
| `*`, `Internet` and `0.0.0.0/0` as the whole internet on Azure | the provider page of the network security rule (`*`, and `Internet` among the tags), and the network security groups page (`0.0.0.0/0`) |
| `0.0.0.0/0` as the whole internet on Google Cloud | the firewall rules page: the default source is any IPv4 address |
| port 22 for SSH and port 3389 for RDP | the Security Hub control EC2.19 and the Microsoft page on just-in-time access (22 - SSH, 3389 - RDP) |
| `allUsers` and `allAuthenticatedUsers` | the IAM principals page and the provider page of the bucket IAM resources |
| `TLS1_0` and `TLS1_1` below `TLS1_2`, and `TLS1_2` and `TLS1_3` at or above it | the provider page of the storage account at version 4.64.0 |
| `-1` and `all` as every protocol | the provider pages of the security group and its rules |
| `Inbound` and `Allow` as the direction and the access of a rule, `Deny` and `Allow` as the access of a rule and the default action of network rules | the provider pages of the network security rule and the storage account |

## Quoted sentences

Each sentence is quoted by at least one finding, which shows it with the address of its page. The key is the name of the sentence in `src/data.js`.

### Terraform JSON Output Format

https://developer.hashicorp.com/terraform/internals/json-format

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-replace-actions` | Change Representation | The two "replace" actions are represented in this way to allow callers to e.g. just scan the list for "delete" to recognize all three situations where the object will be deleted, allowing for any new deletion combinations that might be added in future. |
| `tf-after-unknown` | Change Representation | "after_unknown" is an object value with similar structure to "after", but with all unknown leaf values replaced with "true", and all known leaf values omitted. |
| `tf-after-sensitive` | Change Representation | "before_sensitive" and "after_sensitive" are object values with similar structure to "before" and "after", but with all sensitive leaf values replaced with true, and all non-sensitive leaf values omitted. These objects should be combined with "before" and "after" to prevent accidental display of sensitive values in user interfaces. |

### Terraform lifecycle reference

https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-prevent-destroy` | prevent_destroy | Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources. |
| `tf-prevent-destroy-rejects` | prevent_destroy | When prevent_destroy is set to true, Terraform rejects plans that would destroy the infrastructure object associated with the resource and returns an error. |

### aws_s3_bucket_public_access_block (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket_public_access_block

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-pab-block-public-acls` | Argument Reference | Whether Amazon S3 should block public ACLs for this bucket. Defaults to `false`. |
| `tf-pab-block-public-policy` | Argument Reference | Whether Amazon S3 should block public bucket policies for this bucket. Defaults to `false`. |
| `tf-pab-ignore-public-acls` | Argument Reference | Whether Amazon S3 should ignore public ACLs for this bucket. Defaults to `false`. |
| `tf-pab-restrict-public-buckets` | Argument Reference | Whether Amazon S3 should restrict public bucket policies for this bucket. Defaults to `false`. |

### aws_s3_bucket (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/s3_bucket

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-s3-force-destroy` | Argument Reference | These objects are *not* recoverable. |

### aws_security_group (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-sg-ingress-protocol` | ingress | If you select a protocol of `-1` (semantically equivalent to `all`, which is not a valid value here), you must specify a `from_port` and `to_port` equal to 0. |

### aws_security_group_rule (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/security_group_rule

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-sg-protocol-all` | Resource: aws_security_group_rule | Setting `protocol = "all"` or `protocol = -1` with `from_port` and `to_port` will result in the EC2 API creating a security group rule with all ports open. |

### aws_vpc_security_group_ingress_rule (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/vpc_security_group_ingress_rule

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-ingress-rule-protocol` | Argument Reference | Use `-1` to specify all protocols. |

### aws_db_instance (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/db_instance

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-db-public` | Argument Reference | Bool to control if instance is publicly accessible. Default is `false`. |
| `tf-db-encrypted` | Argument Reference | Note that if you are creating a cross-region read replica this field is ignored and you should instead declare `kms_key_id` with a valid ARN. The default is `false` if not specified. |
| `tf-db-final-snapshot` | Argument Reference | Whether a final DB snapshot is created before the DB instance is deleted. If true is specified, no DBSnapshot is created. |

### aws_ebs_volume (AWS provider 6.67.0)

https://registry.terraform.io/providers/hashicorp/aws/6.67.0/docs/resources/ebs_volume

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-ebs-encrypted` | Argument Reference | If true, the disk will be encrypted. |

### azurerm_storage_account (AzureRM provider 5.8.0)

https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/storage_account

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-azsa-nested-5` | Arguments Reference | Allow or disallow nested items within this Account to opt into being public. Defaults to `false`. |
| `tf-azsa-access-5` | Arguments Reference | The public network access setting. Possible values are `Disabled`, `Enabled`, and `SecuredByPerimeter`. Defaults to `Enabled`. |
| `tf-azsa-rules` | Arguments Reference | Network Rules can be defined either directly on the `azurerm_storage_account` resource, or using the `azurerm_storage_account_network_rules` resource - but the two cannot be used together. |

### azurerm_storage_account (AzureRM provider 4.64.0)

https://registry.terraform.io/providers/hashicorp/azurerm/4.64.0/docs/resources/storage_account

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-azsa-nested-4` | Arguments Reference | Allow or disallow nested items within this Account to opt into being public. Defaults to `true`. |
| `tf-azsa-access-4` | Arguments Reference | Whether the public network access is enabled? Defaults to `true`. |
| `tf-azsa-tls` | Arguments Reference | The minimum supported TLS version for the storage account. Possible values are `TLS1_0`, `TLS1_1`, `TLS1_2` and `TLS1_3`. Defaults to `TLS1_2` for new storage accounts. |

### azurerm_network_security_rule (AzureRM provider 5.8.0)

https://registry.terraform.io/providers/hashicorp/azurerm/5.8.0/docs/resources/network_security_rule

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-nsr-source` | Arguments Reference | CIDR or source IP range or * to match any IP. Tags such as `VirtualNetwork`, `AzureLoadBalancer` and `Internet` can also be used. |
| `tf-nsr-protocol` | Arguments Reference | Network protocol this rule applies to. Possible values include `Tcp`, `Udp`, `Icmp`, `Esp`, `Ah` or `*` (which matches all). |

### google_storage_bucket (Google provider 8.5.0)

https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-gcs-force-destroy` | Argument Reference | When true, before deleting a bucket, delete all objects within the bucket, or Anywhere Caches caching data for that bucket. |

### google_storage_bucket_iam (Google provider 8.5.0)

https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/storage_bucket_iam

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-giam-all-users` | Argument Reference | A special identifier that represents anyone who is on the internet; with or without a Google account. |
| `tf-giam-all-authenticated` | Argument Reference | A special identifier that represents anyone who is authenticated with a Google account or a service account. |

### google_compute_firewall (Google provider 8.5.0)

https://registry.terraform.io/providers/hashicorp/google/8.5.0/docs/resources/compute_firewall

| Key | Section | Sentence |
| --- | --- | --- |
| `tf-gfw-direction` | Argument Reference | Direction of traffic to which this firewall applies; default is INGRESS. |
| `tf-gfw-ports` | Argument Reference | If not specified, this rule applies to connections through any port. |

### Amazon S3, Blocking public access

https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html

| Key | Section | Sentence |
| --- | --- | --- |
| `aws-bpa-override` | Blocking public access to your Amazon S3 storage | S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources. |
| `aws-bpa-all-four` | Important | Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8. |

### Amazon EBS, Delete a volume

https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html

| Key | Section | Sentence |
| --- | --- | --- |
| `aws-ebs-delete` | Delete an Amazon EBS volume | After deletion, its data is gone and the volume can't be attached to any instance. |

### AWS Security Hub, EC2 controls

https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html

| Key | Section | Sentence |
| --- | --- | --- |
| `aws-ec2-13-recommend` | [EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22 | We recommend that no security group allow unrestricted ingress access to port 22. |
| `aws-ec2-13-unfettered` | [EC2.13] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 22 | Removing unfettered connectivity to remote console services, such as SSH, reduces a server's exposure to risk. |
| `aws-ec2-14-recommend` | [EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389 | We recommend that no security group allow unrestricted ingress access to port 3389. |
| `aws-ec2-14-unfettered` | [EC2.14] Security groups should not allow ingress from 0.0.0.0/0 or ::/0 to port 3389 | Removing unfettered connectivity to remote console services, such as RDP, reduces a server's exposure to risk. |
| `aws-ec2-18-port` | [EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports | Unless a port is specifically allowed, the port should deny unrestricted access. |
| `aws-ec2-18-malicious` | [EC2.18] Security groups should only allow unrestricted incoming traffic for authorized ports | Unrestricted access (IP address with a /0 suffix) increases the opportunity for malicious activity such as hacking, denial-of-service attacks, and loss of data. |
| `aws-ec2-19-malicious` | [EC2.19] Security groups should not allow unrestricted access to ports with high risk | Unrestricted access (0.0.0.0/0) increases opportunities for malicious activity, such as hacking, denial-of-service attacks, and loss of data. |
| `aws-ec2-3-encrypt` | [EC2.3] Attached Amazon EBS volumes should be encrypted at-rest | For an added layer of security of your sensitive data in EBS volumes, you should enable EBS encryption at rest. |

### AWS Security Hub, RDS controls

https://docs.aws.amazon.com/securityhub/latest/userguide/rds-controls.html

| Key | Section | Sentence |
| --- | --- | --- |
| `aws-rds-2-internet` | [RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration | When the DB instance is configured with PubliclyAccessible, it is an Internet-facing instance with a publicly resolvable DNS name, which resolves to a public IP address. |
| `aws-rds-2-unless` | [RDS.2] RDS DB Instances should prohibit public access, as determined by the PubliclyAccessible configuration | Unless you intend for your RDS instance to be publicly accessible, the RDS instance should not be configured with PubliclyAccessible value. |
| `aws-rds-3-encrypt` | [RDS.3] RDS DB instances should have encryption at-rest enabled | For an added layer of security for your sensitive data in RDS DB instances, you should configure your RDS DB instances to be encrypted at rest. |

### AWS Security Hub, S3 controls

https://docs.aws.amazon.com/securityhub/latest/userguide/s3-controls.html

| Key | Section | Sentence |
| --- | --- | --- |
| `aws-s3-8-fails` | [S3.8] S3 general purpose buckets should block public access | The control fails if any of the following settings are set to false: |
| `aws-s3-8-unless` | [S3.8] S3 general purpose buckets should block public access | Unless you intend to have your S3 buckets publicly accessible, you should configure the bucket level Amazon S3 Block Public Access feature. |

### Microsoft Learn, Remediate anonymous read access to blob data

https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent

| Key | Section | Sentence |
| --- | --- | --- |
| `az-anon-any-client` | Remediate anonymous read access to blob data (Azure Resource Manager deployments) | When a container is configured for anonymous access, any client can read data in that container. |
| `az-anon-risk` | Remediate anonymous read access to blob data (Azure Resource Manager deployments) | Anonymous access presents a potential security risk, so if your scenario does not require it, we recommend that you disallow it for the storage account. |

### Microsoft Learn, Minimum TLS version for a storage account

https://learn.microsoft.com/en-us/azure/storage/common/transport-layer-security-configure-minimum-version

| Key | Section | Sentence |
| --- | --- | --- |
| `az-tls-recommended` | Enforce a minimum required version of Transport Layer Security (TLS) for requests to a storage account | The recommended minimum TLS version is TLS 1.2. |
| `az-tls-remediate` | Remediate security risks with a minimum version of TLS | Requiring that clients use a minimum version of TLS to make requests against a storage account is part of a strategy to minimize security risks to your data. |

### Microsoft Learn, Azure Storage firewall rules

https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security

| Key | Section | Sentence |
| --- | --- | --- |
| `az-net-default` | Azure Storage firewall rules and network access control | By default, storage accounts allow connections from any network, but you can restrict access by configuring network rules that define which sources can connect to your storage account. |
| `az-net-denied` | Azure Storage firewall rules and network access control | When you configure network rules, only traffic from explicitly allowed sources can access your storage account through its public endpoint. All other traffic is denied. |

### Microsoft Learn, Network security groups

https://learn.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview

| Key | Section | Sentence |
| --- | --- | --- |
| `az-nsg-any` | DenyAllOutBound | 0.0.0.0/0 in the Source and Destination columns represents all IP addresses. |

### Microsoft Learn, Just-in-time machine access

https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-overview

| Key | Section | Sentence |
| --- | --- | --- |
| `az-jit-hunting` | Just-in-time machine access in Microsoft Defender for Cloud | Just-in-time protects your resources from threat actors actively hunting for machines with open management ports, such as Remote Desktop Protocol (RDP) or Secure Shell (SSH). |
| `az-jit-minimize` | Just-in-time machine access in Microsoft Defender for Cloud | To reduce attack surfaces, minimize open ports, especially management ports. |

### Microsoft Learn, Enable just-in-time access

https://learn.microsoft.com/en-us/azure/defender-for-cloud/just-in-time-access-usage

| Key | Section | Sentence |
| --- | --- | --- |
| `az-jit-ports` | Enable JIT on your VMs from Microsoft Defender for Cloud | The JIT VM access page opens listing the ports that Defender for Cloud recommends protecting: |

### Google Cloud, Uniform bucket-level access

https://cloud.google.com/storage/docs/uniform-bucket-level-access

| Key | Section | Sentence |
| --- | --- | --- |
| `gcp-ubla-unintended` | Should you use uniform bucket-level access? | Uniform bucket-level access prevents unintended data exposure from ACLs. |
| `gcp-ubla-iam-only` | Uniform bucket-level access | When you enable uniform bucket-level access on a bucket, Access Control Lists (ACLs) are disabled, and only bucket-level Identity and Access Management (IAM) permissions grant access to that bucket and the objects it contains. |

### Google Cloud, IAM principals

https://cloud.google.com/iam/docs/principals-overview

| Key | Section | Sentence |
| --- | --- | --- |
| `gcp-iam-all-users` | allUsers | The value allUsers is a special identifier that represents anyone who is on the internet, including authenticated and unauthenticated users. |
| `gcp-iam-all-authenticated` | allAuthenticatedUsers | The value allAuthenticatedUsers is a special identifier that represents all service accounts and all users on the internet who have authenticated with a Google Account. |

### Google Cloud, VPC firewall rules

https://cloud.google.com/firewall/docs/firewalls

| Key | Section | Sentence |
| --- | --- | --- |
| `gcp-fw-any-ipv4` | Ingress cases | The default source is any IPv4 address (0.0.0.0/0). |

### Google Cloud, Security Command Center vulnerability findings

https://cloud.google.com/security-command-center/docs/concepts-vulnerabilities-findings

| Key | Section | Sentence |
| --- | --- | --- |
| `gcp-scc-ubla` | Bucket policy only disabled | Uniform bucket-level access, previously called Bucket Policy Only, isn't configured. |
| `gcp-scc-ssh` | Open SSH port | A firewall is configured to have an open SSH port that allows generic access. |
| `gcp-scc-rdp` | Open RDP port | A firewall is configured to have an open RDP port that allows generic access. |

## Sentences of the plan format that the reader rests on

These are not quoted in a finding. They are the reason for how the plan file is read, and each is on the saved Terraform JSON Output Format page.

| Key | Section | Sentence |
| --- | --- | --- |
| `reader-version` | Introduction | Reject any input which reports an unsupported major version. |
| `reader-unrecognized` | Introduction | Ignore any object properties with unrecognized names to remain forward-compatible with future minor versions. |
| `reader-plan` | Plan Representation | A plan consists of a prior state, the configuration that is being applied to that state, and the set of changes Terraform plans to make to achieve that. |
| `reader-all-resources` | Plan Representation | All resources in the configuration are included in this list. |
| `reader-planned-values` | Plan Representation | "planned_values" is a description of what is known so far of the outcome in the standard value representation, with any as-yet-unknown values omitted. |
| `reader-unknown-null` | Values Representation | Any unknown values are omitted or set to null, making them indistinguishable from absent values; callers which need to distinguish unknown from unset must use the plan-specific or configuration-specific structures described in later sections. |
| `reader-references` | Expression Representation | Callers should only use string equality checks here, since the syntax may be extended in future releases. |
| `reader-constant` | Expression Representation | "constant_value" is set only if the expression contains no references to other objects, in which case it gives the resulting constant value. |
