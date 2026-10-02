# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "tfplan-risk-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up plan file that shows the problem, what you expected and what happened. Use made-up names, and no real data, credentials, internal addresses or customer information.

## Scope

In scope:

- an input that makes the tool fetch an address, open a network connection, call a cloud, run Terraform or any program, or open a file other than the one it was given
- an input that makes the tool print a value that the plan marks sensitive, or any value of the plan other than the names listed in docs/secure-defaults.md
- an input that makes the tool hang, take very long, run out of memory, overflow the stack or crash, such as very deep nesting, a very long string, a long run of quotes, brackets or commas, very many values or resource changes, or a path that is not a regular file
- an input that the JSON reader accepts but should refuse (a duplicate key, a comment, a trailing comma, a raw control character), or that it refuses but docs/method.md says it reads
- text from a name that breaks a Markdown table, injects a formula into a CSV report, or rewrites the terminal through control or direction characters
- a finding that docs/method.md says is reported, for an input the tool accepts, that the report leaves out, or a value that docs/method.md says is reported as unknown or sensitive that the tool reads and judges

Out of scope: whether your cloud account is secure (docs/limits.md lists what a plan cannot show), the content of the documentation pages and the behavior of a cloud or of Terraform itself, and how your pipeline stores the plan file and the reports.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
