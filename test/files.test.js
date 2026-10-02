import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { InputError, PLAN_LIMITS, decodePlan, displayName, readPlanFile, sizeText } from '../src/index.js';
import { withFiles } from './helpers.js';

const E = String.fromCharCode(0xe9);

// Platform notes for this file. On Windows a backslash separates folders and a name is not case sensitive. On Linux and
// macOS a backslash is an ordinary character in a file name. Tests that depend on this are guarded with process.platform,
// and the other tests build every path with resolve() from names with forward slashes.

test('files: a regular file is read whole, from a path made with resolve', async () => {
  await withFiles({ 'plan.json': '{"a":1}' }, async (dir) => {
    const bytes = await readPlanFile(resolve(dir, 'plan.json'));
    assert.equal(bytes.toString('utf8'), '{"a":1}');
  });
});

test('files: a name with spaces, a folder with spaces and a name with non-ASCII letters are read', async () => {
  await withFiles({ [`my plans/prod plan ${E}.json`]: '[]' }, async (dir) => {
    assert.equal((await readPlanFile(resolve(dir, 'my plans', `prod plan ${E}.json`))).length, 2);
  });
});

test('files: a file that does not exist is an input error that names the file and not its folder', async () => {
  await withFiles({}, async (dir) => {
    await assert.rejects(readPlanFile(resolve(dir, 'missing.json')), (e) => e instanceof InputError && /^missing\.json: no such file$/.test(e.message));
  });
});

test('files: a folder is refused with the way to write the file, and it is not read', async () => {
  await withFiles({ 'sub/plan.json': '{}' }, async (dir) => {
    await assert.rejects(readPlanFile(resolve(dir, 'sub')), (e) => e instanceof InputError && /is a folder/.test(e.message) && /terraform show -json/.test(e.message));
  });
});

test('files: a file over the size limit is refused from the size of the open file, before it is read', async () => {
  await withFiles({ 'big.json': 'x'.repeat(100) }, async (dir) => {
    await assert.rejects(readPlanFile(resolve(dir, 'big.json'), { ...PLAN_LIMITS, maxFileBytes: 99 }), (e) => e instanceof InputError && /is 100 bytes, over the 99 bytes limit/.test(e.message));
    assert.equal((await readPlanFile(resolve(dir, 'big.json'), { ...PLAN_LIMITS, maxFileBytes: 100 })).length, 100);
  });
});

test('files: the size limit is 64 MB and is written that way', () => {
  assert.equal(PLAN_LIMITS.maxFileBytes, 64 * 1024 * 1024);
  assert.equal(sizeText(PLAN_LIMITS.maxFileBytes), '64 MB');
  assert.equal(sizeText(1), '1 bytes');
  assert.equal(sizeText(1536), '1,536 bytes');
  assert.equal(sizeText(1572864), '1.5 MB');
});

test('files: a file that is not a regular file is refused (a character device, on systems that have /dev/null)', async (t) => {
  if (process.platform === 'win32' || !existsSync('/dev/null')) {
    t.skip('this system has no /dev/null');
    return;
  }
  await assert.rejects(readPlanFile('/dev/null'), (e) => e instanceof InputError && /not a regular file/.test(e.message));
});

test('files: a link that the user names is followed to a regular file, where the system allows links', async (t) => {
  await withFiles({ 'real.json': '{"a":2}' }, async (dir) => {
    try {
      await symlink(resolve(dir, 'real.json'), resolve(dir, 'link.json'));
    } catch {
      t.skip('this system does not allow symbolic links here');
      return;
    }
    assert.equal((await readPlanFile(resolve(dir, 'link.json'))).toString('utf8'), '{"a":2}');
  });
});

test('files: a link that leads nowhere is an input error, where the system allows links', async (t) => {
  await withFiles({}, async (dir) => {
    try {
      await symlink(resolve(dir, 'nowhere.json'), resolve(dir, 'dangling.json'));
    } catch {
      t.skip('this system does not allow symbolic links here');
      return;
    }
    await assert.rejects(readPlanFile(resolve(dir, 'dangling.json')), (e) => e instanceof InputError && /^dangling\.json: /.test(e.message));
  });
});

test('files: a file written to the folder after the listing is not trusted for its size: the open file decides', async () => {
  await withFiles({ 'grow.json': '{}' }, async (dir) => {
    const path = resolve(dir, 'grow.json');
    assert.equal((await readPlanFile(path, { ...PLAN_LIMITS, maxFileBytes: 50 })).length, 2);
    await writeFile(path, `{"a":"${'x'.repeat(100)}"}`);
    await assert.rejects(readPlanFile(path, { ...PLAN_LIMITS, maxFileBytes: 50 }), /over the 50 bytes limit/);
  });
});

test('files: UTF-8 text is decoded, a byte order mark is dropped, and UTF-16 is refused with the way to write UTF-8', () => {
  assert.equal(decodePlan(Buffer.from(`{"a":"${E}"}`)), `{"a":"${E}"}`);
  assert.equal(decodePlan(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), '{}');
  for (const bom of [[0xff, 0xfe], [0xfe, 0xff]]) assert.throws(() => decodePlan(Buffer.from([...bom, 0x7b, 0x00]), 'plan.json'), (e) => e instanceof InputError && /^plan\.json is UTF-16 text/.test(e.message) && /Out-File -Encoding utf8/.test(e.message));
});

test('files: bytes that are not UTF-8 are an input error and are not guessed as another encoding', () => {
  assert.throws(() => decodePlan(Buffer.from([0x7b, 0xe9, 0x7d]), 'plan.json'), /^InputError: plan\.json is not valid UTF-8|plan\.json is not valid UTF-8/);
  assert.throws(() => decodePlan(Buffer.from([0xc0, 0x80])), InputError);
});

test('files: the name of a file as shown is its last part, so the report does not depend on the path style of the system', () => {
  assert.equal(displayName(resolve('some', 'folder', 'plan.json')), 'plan.json');
  assert.equal(displayName('plan.json'), 'plan.json');
  assert.equal(displayName('a/b/c.json'), 'c.json');
  assert.equal(displayName('a/b\u001b[2J.json'), 'b [2J.json');
  assert.equal(displayName(`x/${'n'.repeat(300)}`).length, 120);
});

test('files: a backslash separates folders on Windows and is an ordinary character in a name on Linux and macOS', () => {
  if (process.platform === 'win32') assert.equal(displayName('plans\\prod\\plan.json'), 'plan.json');
  else assert.equal(displayName('plans\\prod\\plan.json'), 'plans\\prod\\plan.json');
});

test('files: on Linux and macOS a file whose name holds a backslash is an ordinary file and is read', async (t) => {
  if (process.platform === 'win32') {
    t.skip('a backslash is not allowed in a Windows file name');
    return;
  }
  await withFiles({ 'a\\b.json': '{"a":3}' }, async (dir) => {
    assert.equal((await readPlanFile(resolve(dir, 'a\\b.json'))).toString('utf8'), '{"a":3}');
  });
});
