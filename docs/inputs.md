# Inputs

The tool takes one path: the JSON file that `terraform show -json` writes for a plan. It reads that file and nothing else. It follows no address, opens no other file, and never talks to a cloud or runs Terraform.

```
terraform plan -out=plan.out
terraform show -json plan.out > plan.json
tfplan-risk-check plan.json
```

## The file

- **One regular file.** A folder, a pipe or a device is refused. The type is taken from the open file, so a name cannot change into something else between the check and the read. A symbolic link that you name is followed, as it is for any program, because you chose that path.
- **No standard input.** `-` is refused with a message. Write the plan to a file and give its path. Reading from a pipe would let a producer that never ends keep the tool waiting, and a file has a size that can be checked before it is read.
- **Size.** A file over 64 MB is refused from the size of the open file, before it is read. A plan of that size has hundreds of thousands of attributes; split the work by Terraform workspace or by module if you reach it.
- **Encoding.** UTF-8. A byte order mark at the start is ignored. A file that is not valid UTF-8 is refused, and so is a file that starts with a UTF-16 byte order mark: Windows PowerShell writes UTF-16 when a program's output is redirected with `>`. The message says how to write UTF-8 (`terraform show -json plan.out | Out-File -Encoding utf8 plan.json`, or redirect in `cmd.exe`).
- **Name in the report.** The report shows the name of the file, not its path, so it is the same on Linux, macOS and Windows.

## The JSON

The text is read by the strict reader described in [method.md](method.md). The limits, each of which is an input error (exit code `2`) with a message when it is reached:

| Limit | Value |
| --- | --- |
| size of the file | 64 MB |
| nesting depth | 100 levels |
| values in the file | 4,000,000 |
| length of one string | 1,048,576 characters |
| length of one key | 1,024 characters |
| length of one number | 64 characters |
| resource changes | 20,000 |

A key that appears twice in one object is refused. The limits are checked while the text is read, so a file that breaks one is refused without being read to its end where that is possible, and no recursion goes deeper than the depth limit.

## What a plan is

The file must be an object with a `format_version` that is text of the form `1.<minor>`, and with `resource_changes` (a list) or `planned_values` (an object). The page "Terraform JSON Output Format" says: "Reject any input which reports an unsupported major version." The tool reads major version 1 and ignores properties that it does not know.

These are refused with a message that says what they are:

- the JSON of a state (`terraform show -json` on a state file): it has `values` and no `planned_values` or `resource_changes`;
- the result of `terraform validate -json`, and any other JSON that has a `format_version` and none of the plan keys;
- JSON with no `format_version`, a list, a number or text;
- a `format_version` of another major version, or one that is not a version number.

An entry of `resource_changes` must have `address`, `mode`, `type`, `name` as text and a `change` object with a list of one or two `actions` that are text. An entry that does not is refused, with its position in the list.

## What is read from a plan

- `resource_changes[].change`: `actions`, `before`, `after`, `after_unknown`, `before_sensitive`, `after_sensitive`, `replace_paths`, and `action_reason` of the entry.
- `planned_values`: resources that `resource_changes` does not list are used to find the public access block of a bucket. The page says "All resources in the configuration are included in this list." for `resource_changes`, so this is rare.
- `configuration`: the references and constants of the `bucket` expression of an S3 public access block, to pair it with its bucket.
- `terraform_version` and `errored`, for the header and a note.

Everything else is ignored: `prior_state`, `variables`, `output_changes`, `checks`, `relevant_attributes`, `resource_drift`, provider configuration, and every property that the tool does not know.

## Where the plan comes from

A plan written by `terraform plan -out=...` and shown with `terraform show -json` is the intended input. The tool reads what the page "Terraform JSON Output Format" documents. It has not been run against the output of any other program, so a plan from another tool is read only as far as it follows that page.
