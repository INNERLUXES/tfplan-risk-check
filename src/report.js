// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools, CSV for a
// spreadsheet. Findings are listed in the order of the resource changes in the plan, then by the order of the checks. A
// finding names the resource address, the attribute, the action and the severity; the sentences of the documentation
// that it quotes come with their addresses. No report holds a value that the plan marks sensitive.

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function countsLine(c) {
  return `${c.error} error, ${c.warning} warning, ${c.info} info`;
}

function gateLine(r) {
  return r.gate.pass ? `GATE: PASS (--fail-on ${r.gate.failOn})` : `GATE: FAIL - ${r.gate.reason}`;
}

// "18 resources (3 create, 1 update, 1 delete, 1 replace, 12 unchanged), format 1.2, Terraform 1.9.8"
function inputLine(r) {
  const c = r.input.changes;
  const parts = [];
  for (const [key, label] of [['create', 'create'], ['update', 'update'], ['delete', 'delete'], ['replace', 'replace'], ['noop', 'no change'], ['read', 'read'], ['other', 'other']]) if (c[key] > 0) parts.push(`${c[key].toLocaleString('en-US')} ${label}`);
  const head = `${plural(r.input.resources, 'resource')}${parts.length ? ` (${parts.join(', ')})` : ''}`;
  return `${head}, format ${r.input.formatVersion}${r.input.terraformVersion ? `, Terraform ${r.input.terraformVersion}` : ''}`;
}

const sectionOf = (m) => (m.section === m.title ? m.page : `${m.page}, ${m.section}`);

export function toText(r) {
  const lines = [`tfplan-risk-check: ${r.target}`, `read: ${inputLine(r)}`, `findings: ${countsLine(r.counts)}`];
  if (!r.findings.length) lines.push('', 'no findings');
  for (const f of r.findings) {
    lines.push('', `${f.severity.toUpperCase().padEnd(7)}  ${f.id}  ${f.address}`);
    lines.push(`         action: ${f.action}`, `         at: ${f.attribute}`, `         ${f.message}`, `         fix: ${f.fix}`);
    for (const m of f.manual) lines.push(`         source (${sectionOf(m)}): "${m.quote}"`, `           ${m.url}`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`note: ${note}`);
  lines.push('', gateLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes and pipes escaped, line breaks flattened, and <, > and & written as entities, so
// text from a plan cannot break the table or be read as HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r) {
  const lines = [`## tfplan-risk-check: ${countsLine(r.counts)}`, '', `${mdCell(r.target)}, ${mdCell(inputLine(r))}.`];
  if (!r.findings.length) lines.push('', 'No findings.');
  else {
    lines.push('', '| Severity | Check | Resource | Action | Attribute | Message | Fix | Source |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const f of r.findings) {
      const source = f.manual.map((m) => `[${mdCell(sectionOf(m))}](${m.url}): "${mdCell(m.quote)}"`).join('<br>');
      lines.push(`| ${f.severity} | ${mdCell(f.id)} | ${mdCell(f.address)} | ${mdCell(f.action)} | ${mdCell(f.attribute)} | ${mdCell(f.message)} | ${mdCell(f.fix)} | ${source || '-'} |`);
    }
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`- ${mdCell(note)}`);
  lines.push('', r.gate.pass ? `**Gate passed** (--fail-on ${r.gate.failOn}).` : `**Gate failed:** ${mdCell(r.gate.reason)}.`);
  return lines.join('\n') + '\n';
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}

// RFC 4180 quoting, and a leading quote on cells a spreadsheet would read as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per finding. source_page, source_section and source_url name the first sentence the finding quotes; the JSON
// report has all of them.
export function toCsv(r) {
  const rows = [['severity', 'id', 'cloud', 'address', 'type', 'attribute', 'action', 'message', 'fix', 'source_page', 'source_section', 'source_url']];
  for (const f of r.findings) {
    const m = f.manual[0];
    rows.push([f.severity, f.id, f.cloud, f.address, f.type, f.attribute, f.action, f.message, f.fix, m ? m.page : '', m ? m.section : '', m ? m.url : '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
