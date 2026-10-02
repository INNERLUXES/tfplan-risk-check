# 1. A strict JSON reader of our own

## Context

The tool needs to read the JSON of a Terraform plan and say what in it is risky. `JSON.parse` does the first part and has three properties that matter here. It accepts a key that appears twice in one object and keeps the last value, so a file can say one thing to this tool and another to a reader that keeps the first. It has no limits of its own: a plan file is written by a build, often from a pull request, and a string of gigabytes or a file of a million nested brackets is the first thing that touches the tool. And it gives no position for an error that a person can act on beyond the offset in a message that differs between Node versions.

A plan is also a file that holds secrets. The reader sits in front of every check, so it is the right place to keep objects free of a prototype and to count what is read.

## Decision

The tool has no dependencies and reads the JSON itself, for the grammar of RFC 8259 and nothing more. It refuses comments, trailing commas, single quotes, `NaN` and `Infinity`, numbers that JSON does not write, raw control characters in strings, unknown escapes and text after the value. It refuses a key that appears twice in one object. It makes objects without a prototype, so a key such as `__proto__` is only data. It bounds the depth (100 levels, checked before a value is read), the number of values, the length of a string, of a key and of a number. Every error has a line and a column, and a limit is an input error with a message, never a cut.

The size of the file is limited separately, before the file is read, from the size of the open file.

## Consequences

A hostile file cannot make the reader recurse deeply, expand or run for long, and the time is linear in the size of the input. The tool has no supply chain of its own. The price is a reader that is slower than the built-in one, which is native code, and that can have bugs that the built-in one does not have. A plan of the limit of 64 MB is read in a few seconds. The tests cover each form it reads, each form it refuses, a comparison with `JSON.parse` on valid input, and megabytes of each hostile shape with a time limit. A change to the reader is described in docs/method.md first.
