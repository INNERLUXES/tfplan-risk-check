// Reading the plan file. The tool is given one path. It opens that file, takes the type and the size from the open file,
// so they cannot change between the check and the read, and reads it only when it is a regular file under the size limit.
// A symbolic link that the user names is followed, as it is for any program: the user chose that path. Nothing is written
// and nothing is fetched. The report shows the name of the file, never its path, so the report is the same on Linux,
// macOS and Windows and does not depend on what a backslash means there.

import { open, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { PLAN_LIMITS } from './data.js';
import { safeText } from './rules.js';

// An input error: the tool cannot read the plan at all. The message is shown to the user and the exit code is 2.
export class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
  }
}

export const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('en-US', { maximumFractionDigits: 1 })} MB` : `${bytes.toLocaleString('en-US')} bytes`);

// The name of a file as shown in a report or a message: the last part of the path, cleaned.
export const displayName = (path) => safeText(basename(String(path)), 120);

// Decodes the bytes of a plan file as UTF-8 text. A UTF-16 file is refused with the way to write it as UTF-8, because
// Windows PowerShell writes UTF-16 when a program's output is redirected into a file.
export function decodePlan(buffer, name = 'the file') {
  if (buffer.length >= 2 && ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))) {
    throw new InputError(`${name} is UTF-16 text. Write the plan as UTF-8 (in Windows PowerShell, use "terraform show -json plan.out | Out-File -Encoding utf8 plan.json", or redirect in cmd.exe).`);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new InputError(`${name} is not valid UTF-8 text, so it is not a plan written by terraform show -json.`);
  }
}

// Reads a plan file from disk and returns its bytes. Throws InputError with a message that names the file.
export async function readPlanFile(path, limits = PLAN_LIMITS) {
  const name = displayName(path);
  let info;
  try {
    info = await stat(path);
  } catch (error) {
    throw new InputError(`${name}: ${error.code === 'ENOENT' ? 'no such file' : `cannot be read (${error.code ?? error.message})`}`);
  }
  if (info.isDirectory()) throw new InputError(`${name} is a folder. Give the JSON file that "terraform show -json" wrote; the tool reads one file and no folder.`);
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    throw new InputError(`${name}: cannot be read (${error.code ?? error.message})`);
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile()) throw new InputError(`${name} is not a regular file, so it was not read.`);
    if (opened.size > limits.maxFileBytes) throw new InputError(`${name} is ${sizeText(opened.size)}, over the ${sizeText(limits.maxFileBytes)} limit, so it was not read.`);
    const buffer = Buffer.alloc(opened.size);
    let done = 0;
    while (done < opened.size) {
      const { bytesRead } = await handle.read(buffer, done, opened.size - done, done);
      if (bytesRead === 0) break;
      done += bytesRead;
    }
    return buffer.subarray(0, done);
  } finally {
    await handle.close();
  }
}
