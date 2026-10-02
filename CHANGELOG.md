# Changes

## 1.0.0

First release.

- Reads the JSON form of a Terraform plan (`terraform show -json plan.out`) and reports the planned changes that would expose data or weaken security on AWS, Azure or Google Cloud, before apply. Reads one file. Never runs Terraform, never calls a cloud, never fetches anything, never prints a value that the plan marks sensitive.
- Errors: `aws-s3-public-access-block-off`, `aws-sg-ssh-open`, `aws-sg-rdp-open`, `aws-sg-all-ports-open`, `aws-rds-public`, `azure-storage-public-blob-access`, `azure-nsg-ssh-open`, `azure-nsg-rdp-open`, `gcp-bucket-public-all-users`, `gcp-bucket-public-all-authenticated`, `gcp-firewall-ssh-open` and `gcp-firewall-rdp-open`.
- Warnings: `aws-s3-public-access-block-missing`, `aws-rds-unencrypted`, `aws-ebs-unencrypted`, `azure-storage-public-network-access`, `azure-storage-min-tls`, `gcp-bucket-uniform-access-off`, `stateful-delete` and `stateful-replace`.
- Info findings, which never fail a run: `value-unknown`, `value-sensitive` and `value-not-read`.
- Every finding names the resource address, the type, the attribute path, the action (create, update, delete or replace), the severity, a fix and the sentences of the Terraform, provider or cloud documentation it rests on, with the address of the page.
- Nothing is guessed and nothing is skipped silently: a value that is unknown until apply, a value marked sensitive and a value of the wrong kind are info findings, and the resource types that are not checked, a plan marked errored and the resources that only `planned_values` lists are in the notes.
- A strict JSON reader of its own: RFC 8259 and nothing more, with a line and a column for every error. A key that appears twice, a comment, a trailing comma and a raw control character are refused. Objects have no prototype. The size of the file, the nesting depth, the number of values, and the length of a string, a key and a number are limited, and so is the number of resource changes.
- A file that is not a plan (the JSON of a state, the result of `terraform validate -json`, another major version of `format_version`, any other JSON) is refused with a message that says what it is, and exit code `2`. A UTF-16 file, as Windows PowerShell writes a redirected output, is refused with the way to write UTF-8.
- An S3 public access block is paired with its bucket through the references of the configuration, found through the module tree, or through a known bucket name.
- The pages of the sources are saved in `research/sources`, each at the provider version named in its address; a test compares every quoted sentence, every attribute name and every list of values with the saved text. Checks that no saved page supports are listed in `docs/limits.md` and are not in the tool.
- Reports as text, Markdown, JSON and CSV; `--fail-on` for a pipeline gate; info never fails the run; exit code `2` for a usage or input error.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
