## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a check or to the JSON reader is described in docs/method.md, says what the check can and cannot see, and has a test with the plan written inline and a near miss that must not match
- [ ] A change to a quoted sentence, an attribute name or a list of values follows the source: the new page text is saved in research/sources, `src/data.js` and docs/rules-and-sources.md match it, and nothing was added from memory
- [ ] A check that no saved page supports is not added; it goes in docs/limits.md
- [ ] A conclusion that no source states is worded as the tool's own, in the message and in docs/method.md
- [ ] A value that the plan marks sensitive is never read or shown, and the report never prints a value of the plan other than an address, an attribute path and the names a check compares
- [ ] The JSON reader still refuses duplicate keys, and every size and depth limit still holds
- [ ] The tool still fetches nothing, opens no connection, runs no program, never runs Terraform and never calls a cloud
- [ ] A thing the tool cannot read is reported as a finding or a note, never skipped and never shown as passed
- [ ] A test that depends on the operating system (a path, a backslash, a link, the case of a name) is guarded with `process.platform`
- [ ] No real secret or key in fixtures or examples
- [ ] The commit messages of this pull request follow Conventional Commits
