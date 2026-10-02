# Limits

## What a plan can show

- **It shows a plan, not a cloud.** The tool reads what Terraform plans to do. It does not know what already exists in the account, what a policy or an organization setting adds, which route reaches a database, or what an image does. A finding says what the plan shows. A pass is not a secure environment: it means that the plan holds none of the changes below.
- **Only changes are reported.** A resource that the plan leaves as it is (`no-op`) is counted and not checked, so a risk that is already in the account and is not touched by this plan is not shown. A resource that is changed is checked as a whole, so an update of a tag on a security group that is open to the internet is reported.
- **A finding is a review item, not proof.** Several findings rest on a conclusion that the pages do not state, and the message says so. A security group rule can be open to the internet and sit behind a network ACL or a firewall appliance. A bucket without a public access block can be protected by an account setting. A storage account that answers on every network can still need a key.
- **Unknown values are not guessed.** A value that is unknown until apply gives an info finding and no verdict. A plan made before the values are known (a resource that depends on another one that is created in the same plan) shows less than the state after apply. Run the check on the plan, and review the info findings by hand.
- **Sensitive values are not read.** A value that the plan marks sensitive is not read, so a setting that is marked sensitive is not checked. The info finding says so.
- **Severity is the tool's own.** The pages give reasons and no scale. [method.md](method.md) says how errors, warnings and info are decided.
- **Provider versions differ.** The attribute names, values and defaults come from the provider pages that are saved at the versions named in [rules-and-sources.md](rules-and-sources.md). The Azure storage account page changed between two versions that are saved: the older one lists `TLS1_0` and `TLS1_1`, `public_network_access_enabled` and a default of `true` for `allow_nested_items_to_be_public`, and the newer one lists `public_network_access` and a default of `false`. The tool reads both forms. A resource type or an attribute that is not on a saved page is not read.
- **Pairing by address.** A public access block is paired with its bucket by the references in the configuration, or by a known bucket name. A block with `count` or `for_each` counts for every instance of the bucket that it references, because the pairing does not look at index keys.
- **Rules that override each other are not evaluated.** A network security rule with a lower priority number that denies the traffic, a firewall rule of higher priority, and a network ACL are not seen. The rule that opens the port is reported.

## Checks that were left out because no saved page supports them

The tool only has a check when a saved page states the fact. These were considered and are not in the tool, with the reason:

- **Security groups open to the internet on other ports** (databases, caches, an administration port other than 22 and 3389): the saved Security Hub controls list high-risk ports for AWS, but the Azure and Google Cloud pages saved here name only SSH and RDP, so the same list is not applied to the three clouds. All ports on AWS is checked.
- **Azure network security rules and Google firewall rules open to the internet on all ports** as a finding of its own: a rule on any port is reported as an SSH and an RDP finding with a message that says so, because the saved pages name those two ports; no saved Azure or Google page states a rule about "all ports" in itself.
- **IPv6 on Azure and Google Cloud:** the saved Google page names `0.0.0.0/0` as the default source, "any IPv4 address", and names no IPv6 range for the whole internet. The saved Azure pages name `0.0.0.0/0`, `*` and the `Internet` tag. `::/0` is read on AWS only, where the control titles name it.
- **S3 bucket policies and ACLs that grant public access** (the JSON of `aws_s3_bucket_policy`, `aws_s3_bucket_acl`): no saved page describes how to read a policy, and the tool does not parse policy JSON.
- **Google Cloud `google_storage_bucket_iam_policy`**: the policy is a JSON text; the tool reads `member` and `members` of the member and binding resources only.
- **Google Cloud public access prevention, retention and versioning**, **S3 versioning, logging and encryption of objects**, **KMS key rotation**, **CloudTrail**, **flow logs** and **Cloud SQL public IP**: not checked. They are good practices, and no page that was saved for this tool states them as risks of a change.
- **`aws_rds_cluster` and other RDS resource types, `aws_instance` metadata options, Azure SQL, managed disks without encryption, Azure Key Vault, Google Compute instances and disks:** only the types listed in [method.md](method.md) are read. Other types are counted in a note and are not checked.
- **Azure storage accounts with network rules in a separate resource:** the saved provider page says that the rules "can be defined either directly on the `azurerm_storage_account` resource, or using the `azurerm_storage_account_network_rules` resource", and the tool does not read the second resource, so the public network access is not checked when the plan has one.
- **Account-level and organization-level settings:** `aws_s3_account_public_access_block`, organization policies and Azure Policy are not read, and the message of the missing-block finding says that they are not seen.
- **Replacement reasons.** The plan format lists reasons (`replace_because_tainted` and others) and calls them "display hints only"; the tool shows the reason that Terraform gives and decides nothing from it.

## What the stateful check leaves out

The list of types that hold data is the tool's own reading of "database instances, storage, or other stateful resources" on the lifecycle page. It has eight types. A queue, a secret, a key, a DNS zone, a Kubernetes cluster and a virtual machine disk that is not one of the listed types are not on it, and the deletion of one of them is not reported. A deletion that Terraform refuses because of `prevent_destroy` is an error of the plan itself and does not reach this tool.

## What the reader leaves out

Nothing in the plan is evaluated: no expression, no function, no module. The configuration is read for the references of one expression only. A plan that is too large for a limit is refused, and [inputs.md](inputs.md) lists the limits.
