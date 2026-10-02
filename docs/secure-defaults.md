# Secure defaults

The default run is the safe run. Nothing below needs a flag, and none of it can be switched off.

## How the tool behaves by default

- **No network, no cloud, no Terraform.** The tool reads one file and sends nothing anywhere. It never runs Terraform, never calls an API of a cloud, never fetches an address, does not download a page of the documentation, and does not check for updates. The pages that the findings quote are saved in the repository.
- **No code is run.** The plan is read as text by a strict JSON reader of our own. Nothing in it is evaluated, loaded or given to another program. The tool has no code path that calls `eval`, `new Function` or `import()` on input.
- **No commands.** The tool never runs a program or a shell. No name or value from the plan is put on a command line.
- **No dependencies.** Node 22 or newer and nothing else, so a check that runs in a pipeline adds no supply chain of its own and there is no JSON library to keep up to date. There is no `node_modules` to install before it runs.
- **Strict JSON.** Comments, trailing commas, a key that appears twice, raw control characters and every other form that RFC 8259 does not have are refused with a line and a column. A key such as `__proto__` is data, because objects are made without a prototype.
- **Bounded.** The size of the file, the depth, the number of values, the length of a string, a key and a number, and the number of resource changes are limited, and the limits are checked while the text is read. A file of hostile shape is refused or read in linear time.
- **One regular file.** The type and the size are taken from the open file. A folder, a pipe, a device and a file over the limit are refused before they are read. Standard input is not read.
- **Sensitive values are never read.** A value that the plan marks as sensitive is not read, no check is made from it, and it is in no report. The info finding names the attribute and not the value.
- **Unknown values are not guessed.** A value that is unknown until apply gives an info finding, and no verdict.
- **No value is printed beyond a few names.** The report holds the file name, resource addresses, types, attribute paths, the action, names of the checks and quoted sentences of the documentation. A role name on a public grant, a TLS version from the list of the page and the reason that Terraform gives for a replacement are the only values of the plan that can appear, and none of them when it is marked sensitive.
- **Control characters are removed.** Control, line separator and direction characters are replaced by a space before any text reaches a report or an error message, so a hostile address cannot rewrite the terminal or reorder what a reader sees.
- **Strict formats.** In the Markdown report, pipes, backslashes, angle brackets and ampersands are escaped. In the CSV report, every cell is quoted as RFC 4180 says, and a cell that starts with `=`, `+`, `-`, `@` or a tab or a carriage return gets a leading quote, so a spreadsheet does not run it as a formula.
- **Nothing is skipped without a word.** A value that cannot be read, a resource type that is not checked, a plan that is marked errored and a resource that the plan lists only in `planned_values` are findings or notes, never a silent pass.
- **Exit code 2 for input that is not a plan.** A file that is not a plan is not a pass and not a finding. The tool says what the file is, writes nothing to standard output and exits with `2`, so a pipeline stops.

## What the tool writes

The report to standard output, and a message to standard error for an input error. It writes no file, no cache and no log.

## What a pipeline should do

- Give the tool the plan of the change that is about to be applied, and run it before `terraform apply`, with `--fail-on error` first and `--fail-on warning` when the first report is clean.
- Treat the plan file as sensitive. It holds the values that Terraform plans to write, including the sensitive ones in their marked form. This tool does not print them, but the file is yours to protect.
- Keep the report in the job summary, not in a public comment, if the resource names are not public.
- Pin the tool to a release or a commit, as the example in the README pins the actions.
