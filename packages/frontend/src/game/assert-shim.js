/**
 * Minimal browser shim for Node.js `assert` module.
 *
 * poker-ts uses `assert(condition)` for internal invariants.
 * This provides a lightweight browser equivalent.
 */

function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.default = assert;
assert.ok = assert;
assert.strictEqual = function(a, b, message) {
  if (a !== b) throw new Error(message || 'Expected ' + a + ' === ' + b);
};

module.exports = assert;
