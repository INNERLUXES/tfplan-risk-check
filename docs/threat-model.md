# Threat model

## What the tool touches

- It reads the one file that is named on the command line. Nothing else on the disk is opened.
- It writes only to the screen (standard output and standard error).
- It opens no network connection, calls no cloud and runs no program: not Terraform, not a shell.

## What the input may hold

A plan is often checked in a pipeline that runs on pull requests, including pull requests from people outside the team, and a plan file can come from a build that the author controls. The tool treats the file as possibly hostile. It can be huge, nest a million levels deep, hold one string of gigabytes, hold a key twice with two different values, hold names made of control characters, be a link to another file, be a device, or not be a plan at all. A plan also holds real secrets: Terraform writes the values of the resources that it will create, and a sensitive value is in the file in its marked form. The tool reads such a value as little as it can and never prints it.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| Deep nesting exhausts the stack | The depth is checked before each value is read and the reader stops at 100 levels, so recursion never goes deeper |
| A huge file, many values or a huge string exhaust memory or time | A file over 64 MB is refused from the size of the open file before it is read, a document stops at 4,000,000 values, a string at 1,048,576 characters, a key at 1,024 and a number at 64. Tests run megabytes of each hostile shape with a time limit |
| A key appears twice, so two readers see two plans | A duplicate key in one object is refused with its line and column |
| A key such as `__proto__` changes the behavior of the program | Objects are made without a prototype, only own keys are looked up, and nothing is merged by key |
| A plan is crafted so that a check passes by accident: a value of the wrong kind, a list where an object is expected | A value of another kind than the provider page lists is an info finding, and a shape that does not follow the format is read as absent or refused; no check treats it as safe without a finding |
| A sensitive value is shown in the report | A value that `after_sensitive` or `before_sensitive` marks is not read. A test puts a made-up secret in the plan, in a checked and in an unchecked attribute, and searches all four report formats for it |
| An unknown value is taken for a safe one | An unknown value gives an info finding with the attribute, and the check on it is not made |
| A hostile resource name rewrites the terminal or breaks the Markdown table or the CSV | Control and direction characters are replaced, Markdown is escaped, CSV is quoted and formulas are defused |
| The file name or a path leaks into the report | The report shows the last part of the path only |
| The file is a pipe, a device, a very large file or a link that changes | The type and the size come from the open file, and anything that is not a regular file or is over the limit is refused before it is read |
| A plan file from Windows PowerShell is UTF-16 and is read as garbage | A UTF-16 byte order mark is refused with the way to write UTF-8 |
| A dependency is compromised | There is none |
| A release is tampered with | Releases carry a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, and the workflows pin every action to a commit |

## What the tool does not defend against

- **A plan that lies.** The tool reads what the plan says. A plan made from a different configuration than the one that is applied, or edited by hand, is read as it is.
- **A pipeline that does not run the tool.** A gate that is not in the pipeline gates nothing.
- **A finding that is read as a pass.** [limits.md](limits.md) lists what a plan cannot show; a plan with no finding is not a secure environment.
