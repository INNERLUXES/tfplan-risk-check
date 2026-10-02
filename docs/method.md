# Method

How a run works, what each check reports, its exact rule, and what it can and cannot see. A sentence in quotes is on a saved page of the documentation, listed in [rules-and-sources.md](rules-and-sources.md). A conclusion that no page states is called the tool's own, here and in the message of the finding.

## A run

1. The file named on the command line is opened, its type and size are taken from the open file, and it is read whole as UTF-8 text. A file that is not a regular file, is over the size limit, is UTF-16 or is not valid UTF-8 is an input error (exit code `2`).
2. The text is read by the JSON reader below. Text that is not JSON, or JSON that breaks a limit, is an input error.
3. The JSON is checked to be a plan: an object with a `format_version` of major version 1, and a `resource_changes` list or a `planned_values` object. The JSON of a state, the result of `terraform validate -json` and any other JSON are refused with a message that says what they are.
4. Each entry of `resource_changes` is read: its address, mode, type, name, the list of actions and the objects `before`, `after`, `after_unknown`, `after_sensitive`, `before_sensitive`. An entry that does not have this shape is an input error, and so is an address that is listed twice.
5. The checks run on every managed resource that the plan creates, updates or replaces, and the generic check runs on deletions and replacements. A resource that the plan leaves as it is (`no-op`), a data source (`read`) and a deposed object are counted and not checked.
6. Findings are sorted in the order of the resource changes in the plan, then by the order of the checks in the list below, then by attribute.

The reader follows the page "Terraform JSON Output Format". It ignores properties it does not know: "Ignore any object properties with unrecognized names to remain forward-compatible with future minor versions." It rejects a major version other than 1: "Reject any input which reports an unsupported major version." It reads `format_version` as the text `1.` followed by a minor number, so `1.0`, `1.2` and `1.7` are read and `2.0`, `0.2` and `1.0.0` are not.

The tool never runs Terraform. It reads the output of `terraform show -json plan.out` and nothing else, and it does not read the binary plan file, the state file or the configuration files.

## The JSON reader

The tool has its own JSON reader, so that it decides for itself what it accepts and what it refuses (see [decisions/0001-own-strict-json-reader.md](decisions/0001-own-strict-json-reader.md)). It reads the grammar of RFC 8259 and nothing more. Refused, with the line and column: comments, trailing commas, single quotes, `NaN` and `Infinity`, hexadecimal and leading-zero numbers, raw control characters in a string, unknown escapes, `\u` escapes without four hex digits, a string that is not closed, text after the value and an empty file. A byte order mark at the start is ignored.

It also refuses a key that appears twice in one object, which `JSON.parse` would accept with the last value winning. A file that two readers could read as two different plans is not read at all.

Objects are made without a prototype, so a key such as `__proto__` or `constructor` is only data. Nothing is merged or copied into another object by key.

Limits, each an input error when it is reached: a file of 64 MB, nesting of 100 levels, 4,000,000 values, a string of 1,048,576 characters, a key of 1,024 characters, a number of 64 characters and 20,000 resource changes. The depth is checked before a value is read, so recursion never goes deeper than 100 levels. [inputs.md](inputs.md) lists them with the reason.

## Reading a value

Every check reads attributes of the planned object after the change. A value has one of four states, and the tool never turns one into another.

- **known**: the value is in `after` and is not marked in `after_unknown` or `after_sensitive`.
- **absent**: the key is not in `after`, or its value is `null`, and no marker says why. The page for the resource says what an absent value means for some attributes ("Defaults to `false`"); where it does, the check reads absent as that default and says so in the message ("not set (the provider default is false)"). Where the page gives no default, absent is no finding.
- **unknown**: the value is marked `true` in `after_unknown`. The page says: ""after_unknown" is an object value with similar structure to "after", but with all unknown leaf values replaced with "true", and all known leaf values omitted." It also says that an unknown value in `after` is "omitted or set to null, making them indistinguishable from absent values", so the tool looks at `after_unknown` and never takes null for absent when it is marked. The check on an unknown value is not made, and one `value-unknown` finding (info) names the attribute. Nothing is guessed.
- **sensitive**: the value is marked `true` in `after_sensitive` (or an ancestor is). The page says that these objects "should be combined with "before" and "after" to prevent accidental display of sensitive values in user interfaces." The tool never reads such a value: no check is made from it, it is in no report, and one `value-sensitive` finding (info) names the attribute. This also holds for a `before` value marked in `before_sensitive`.

A value that is of another kind than the provider page lists (text where a boolean is listed, a number written as text) is a `value-not-read` finding (info), and the check on it is not made.

## What a report shows from the plan

The report holds the resource address, the type, the attribute path (such as `ingress[0].cidr_blocks[1]`), the action, the file name, the version numbers, counts, and sentences of the documentation. The messages are built from constants of the check and from these names. A few plan values are printed because a check compared them with a list: the name of an IAM role on a public grant, a TLS version name from the list of the page, the reason that Terraform gives for a replacement. None of them is read if it is marked sensitive. No other value of an attribute appears. `docs/threat-model.md` lists the controls.

## Severity

The pages give reasons and no scale, so the severity is the tool's own mapping:

- **error**: a planned change opens a resource to the whole internet, or switches off a block on public access. A public access block setting that is false, a security group, network security group or firewall open to the internet on SSH or RDP or on all ports, a public database, anonymous access to storage, a public member on a bucket.
- **warning**: a planned change weakens a protection, leaves one out, or deletes or replaces something that holds data. Missing encryption, an old TLS version, uniform bucket-level access that is off, a storage account that answers on every network, a bucket without a public access block, the deletion or replacement of a database, bucket or volume.
- **info**: the tool could not read a value. Info never fails the run.

`--fail-on error` (the default) fails on errors. `--fail-on warning` fails on errors and warnings.

## Pairing a bucket with its public access block

The provider page for the public access block lists a `bucket` argument: "S3 Bucket to which this Public Access Block configuration should be applied." A plan does not hold the bucket name when the block points at a bucket that is created in the same plan, because the value is unknown until apply. The plan format has a place for it: the configuration representation holds, for each resource, the references of each expression, and the page says "Callers should only use string equality checks here". The tool finds the block of a bucket in three ways:

1. the references of the `bucket` expression of the block in the configuration include `aws_s3_bucket.<name>` (in the same module, found through the module calls of the configuration), compared by the address without index keys;
2. the `bucket` value of the block is known and is equal to the `bucket` or `id` value of the bucket, or the expression of the block is a constant equal to it;
3. nothing of the two applies, and the block points at its bucket with a value that the plan cannot show (a variable, a module output): then the tool cannot tell, and the bucket gets one `value-unknown` finding instead of a missing-block finding.

A block that the plan deletes does not count. A block that is in `planned_values` and not in `resource_changes` does count, and a note says that such resources were used. A block with `count` or `for_each` covers every instance of the bucket that it references, because the pairing is by address without index keys.

## Errors

### `aws-s3-public-access-block-off`

An `aws_s3_bucket_public_access_block` that the plan creates, updates or replaces, with `block_public_acls`, `block_public_policy`, `ignore_public_acls` or `restrict_public_buckets` false. One finding for each setting, with the setting as the attribute. A setting that is left out is read as false, because the provider page says each setting "Defaults to `false`", and the message says so. Quoted: "S3 Block Public Access settings override these policies and permissions so that you can limit public access to these resources.", "Additionally, we recommend that you also turn on all four settings for each bucket to comply with AWS Security Hub Foundational Security Best Practices control S3.8." and "The control fails if any of the following settings are set to false:", with the sentence of the provider page for the setting. The severity is the tool's own. Cannot see: a block on the account or the organization.

### `aws-sg-ssh-open`

An ingress rule that allows TCP port 22 from `0.0.0.0/0` or `::/0`. Read in the `ingress` blocks of `aws_security_group` (`cidr_blocks`, `ipv6_cidr_blocks`, `protocol`, `from_port`, `to_port`), in `aws_security_group_rule` of type `ingress` and in `aws_vpc_security_group_ingress_rule` (`cidr_ipv4`, `cidr_ipv6`, `ip_protocol`). The port is in the range when `from_port` is at most 22 and `to_port` at least 22, and the protocol is `tcp`. A rule that opens every port is `aws-sg-all-ports-open` and not this one. Quoted: "We recommend that no security group allow unrestricted ingress access to port 22.", "Removing unfettered connectivity to remote console services, such as SSH, reduces a server's exposure to risk." and the sentence of control EC2.19 on `0.0.0.0/0`. The control titles name `0.0.0.0/0` and `::/0`; the tool reads exactly these two strings. Cannot see: a rule that another security group or a network ACL limits, a prefix list, a source that is a variable that the plan does not resolve (reported as unknown), and a CIDR block that includes the internet in some other way, such as `0.0.0.0/1` together with `128.0.0.0/1`.

### `aws-sg-rdp-open`

The same for TCP port 3389, with the control EC2.14: "We recommend that no security group allow unrestricted ingress access to port 3389." and "Removing unfettered connectivity to remote console services, such as RDP, reduces a server's exposure to risk."

### `aws-sg-all-ports-open`

An ingress rule from `0.0.0.0/0` or `::/0` over all protocols (`-1` or `all`) or over TCP or UDP on ports 0 to 65535. The provider pages say that a protocol of `-1` is "semantically equivalent to `all`" and that it needs a `from_port` and a `to_port` of 0, and that it opens "all ports". Quoted from control EC2.18: "Unless a port is specifically allowed, the port should deny unrestricted access." and "Unrestricted access (IP address with a /0 suffix) increases the opportunity for malicious activity such as hacking, denial-of-service attacks, and loss of data." Only the all-ports finding is made for such a rule, not one for SSH and one for RDP besides it. A protocol written as a number other than `-1` is a `value-not-read` finding, because the saved pages give no table of protocol numbers.

### `aws-rds-public`

An `aws_db_instance` with `publicly_accessible` true. Quoted from control RDS.2: "When the DB instance is configured with PubliclyAccessible, it is an Internet-facing instance with a publicly resolvable DNS name, which resolves to a public IP address." and "Unless you intend for your RDS instance to be publicly accessible, the RDS instance should not be configured with PubliclyAccessible value." Cannot see: the subnet group, the route tables and the security groups that decide whether the instance is reachable.

### `azure-storage-public-blob-access`

An `azurerm_storage_account` with `allow_nested_items_to_be_public` true. Quoted: "When a container is configured for anonymous access, any client can read data in that container." and "Anonymous access presents a potential security risk, so if your scenario does not require it, we recommend that you disallow it for the storage account.", with the defaults of both saved provider versions (`false` in 5.8.0, `true` in 4.64.0). An absent value is no finding, because the plan of the provider version that has a default of `true` writes the value into the plan. Cannot see: the access level of each container.

### `azure-nsg-ssh-open`

An inbound `Allow` rule of TCP (or `*`) from `*`, `0.0.0.0/0` or `Internet` to port 22, read in `azurerm_network_security_rule` and in the `security_rule` list of `azurerm_network_security_group`. The source is read in `source_address_prefix` and `source_address_prefixes`; the port in `destination_port_range` and `destination_port_ranges`, as a number, a range such as `20-30` or `*`. A destination of `*` covers both management ports and gives both findings, with a message that says "any port". Quoted: "Just-in-time protects your resources from threat actors actively hunting for machines with open management ports, such as Remote Desktop Protocol (RDP) or Secure Shell (SSH).", "To reduce attack surfaces, minimize open ports, especially management ports." and "The JIT VM access page opens listing the ports that Defender for Cloud recommends protecting:", where the list gives `22 - SSH` and `3389 - RDP`. Cannot see: a rule with a lower priority number that denies the traffic first, application security groups, and a rule that a security admin rule overrides.

### `azure-nsg-rdp-open`

The same for port 3389.

### `gcp-bucket-public-all-users`

A `google_storage_bucket_iam_member` whose `member` is `allUsers`, or a `google_storage_bucket_iam_binding` whose `members` list holds it. Quoted: "The value allUsers is a special identifier that represents anyone who is on the internet, including authenticated and unauthenticated users." and the provider page's own sentence. The role is named when it is not marked sensitive. Cannot see: `google_storage_bucket_iam_policy`, whose policy is a JSON text, an IAM condition on the grant, and public access prevention on the bucket.

### `gcp-bucket-public-all-authenticated`

The same for `allAuthenticatedUsers`: "The value allAuthenticatedUsers is a special identifier that represents all service accounts and all users on the internet who have authenticated with a Google Account."

### `gcp-firewall-ssh-open`

A `google_compute_firewall` that is ingress (the direction is `INGRESS` or left out; the provider page says "default is INGRESS"), is not disabled, has `0.0.0.0/0` in `source_ranges`, and has an `allow` block of `tcp` (or `all`) whose `ports` include 22 as a number or in a range. An `allow` block of `tcp` without `ports` applies to every port ("If not specified, this rule applies to connections through any port."), and the protocol `all` does too, so they cover both management ports. Quoted: "A firewall is configured to have an open SSH port that allows generic access." and "The default source is any IPv4 address (0.0.0.0/0).". Only `0.0.0.0/0` is read, because the saved page names that range and no IPv6 range. Cannot see: target tags and service accounts that limit which machines the rule applies to, and a higher priority `deny` rule.

### `gcp-firewall-rdp-open`

The same for port 3389.

## Warnings

### `aws-s3-public-access-block-missing`

An `aws_s3_bucket` that the plan creates or updates, with no `aws_s3_bucket_public_access_block` in the plan that points at it (see pairing above). Quoted: the three sentences of the public access block finding. The message says that a setting made on the account or the organization outside the plan is not seen, because the page says that "Amazon S3 applies the most restrictive combination of the access point, bucket, and account settings" and the plan cannot show the other levels. The tool's own conclusion: a bucket whose block is not in the plan is reported, so that the absence is a decision.

### `aws-rds-unencrypted`

An `aws_db_instance` with `storage_encrypted` false or left out (the provider page: "The default is `false` if not specified."). A DB instance with `replicate_source_db` is not checked, because the same sentence says that for a cross-region read replica "this field is ignored". Quoted from control RDS.3: "For an added layer of security for your sensitive data in RDS DB instances, you should configure your RDS DB instances to be encrypted at rest."

### `aws-ebs-unencrypted`

An `aws_ebs_volume` with `encrypted` false. A volume with no `encrypted` value is no finding, because the provider page gives no default and the account can enable encryption by default. Quoted from control EC2.3: "For an added layer of security of your sensitive data in EBS volumes, you should enable EBS encryption at rest."

### `azure-storage-public-network-access`

An `azurerm_storage_account` with public network access enabled (`public_network_access` of `Enabled`, or `public_network_access_enabled` true) and no network rule that denies by default: no `network_rules` block, or one with a `default_action` of `Allow`. Quoted: "By default, storage accounts allow connections from any network, but you can restrict access by configuring network rules that define which sources can connect to your storage account." and "When you configure network rules, only traffic from explicitly allowed sources can access your storage account through its public endpoint. All other traffic is denied." If the plan has an `azurerm_storage_account_network_rules` resource, the check is not made, because the provider page says that the network rules "can be defined either directly on the `azurerm_storage_account` resource, or using the `azurerm_storage_account_network_rules` resource", and a note says so.

### `azure-storage-min-tls`

An `azurerm_storage_account` with `min_tls_version` of `TLS1_0` or `TLS1_1`. The values are those that the 4.64.0 provider page lists; the 5.8.0 page lists only `TLS1_2`. Quoted: "The recommended minimum TLS version is TLS 1.2." and "Requiring that clients use a minimum version of TLS to make requests against a storage account is part of a strategy to minimize security risks to your data." A value that is on neither list is a `value-not-read` finding.

### `gcp-bucket-uniform-access-off`

A `google_storage_bucket` with `uniform_bucket_level_access` false or left out (the provider page: "Optional, Default: false"). Quoted: "Uniform bucket-level access prevents unintended data exposure from ACLs.", the sentence that enabling it disables ACLs, and the Security Command Center finding "Uniform bucket-level access, previously called Bucket Policy Only, isn't configured."

### `stateful-delete`

A resource whose actions are `delete` alone and whose type is on the tool's own list of types that hold data: `aws_db_instance`, `aws_s3_bucket`, `aws_ebs_volume`, `azurerm_storage_account`, `azurerm_managed_disk`, `google_storage_bucket`, `google_sql_database_instance` and `google_compute_disk`. The page says what the list is a reading of: "Use this rule as protection against accidentally replacing objects that may be costly to reproduce, such as database instances, storage, or other stateful resources." The page names the kinds; it lists no types, so the list is the tool's own. The plan format says how deletions are recognised: "The two "replace" actions are represented in this way to allow callers to e.g. just scan the list for "delete" to recognize all three situations where the object will be deleted". Sentences are added from the value before the change when it is known and not sensitive: `skip_final_snapshot` true on a DB instance ("If true is specified, no DBSnapshot is created."), `force_destroy` true on a bucket ("These objects are *not* recoverable." for S3, and the sentence of the Google Cloud page), and for a volume the sentence that after deletion its data is gone.

### `stateful-replace`

The same types, with the actions `delete` and `create` in either order. The attribute is the first of `replace_paths` when the plan gives one, and the message gives the reason that Terraform names. The tool does not know whether the data is kept somewhere else, so the finding says that it is lost "unless it is kept somewhere else".

## Info

### `value-unknown`

A value that a check needs is unknown until apply, or the public access block of a bucket points at it with a value that the plan cannot show. Never fails the run.

### `value-sensitive`

A value that a check needs is marked sensitive in the plan. The value was not read. Never fails the run.

### `value-not-read`

A value is not of the kind that the provider page lists, or is a protocol number, a port or a TLS version that no saved page gives. The check on it was not made. Never fails the run.
