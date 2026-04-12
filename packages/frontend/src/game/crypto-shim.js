/**
 * Browser shim for Node.js `crypto` module.
 *
 * poker-ts does `require("crypto").randomInt(max)` which only exists
 * in Node.js. This shim is pointed to by next.config.mjs's webpack
 * alias so that `require("crypto")` resolves here in client bundles.
 *
 * We expose `randomInt` using the Web Crypto API and pass through
 * everything else from the global `crypto` object.
 */

function randomInt(max) {
  var arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % max;
}

module.exports = {
  randomInt: randomInt,
  getRandomValues: function(arr) {
    return crypto.getRandomValues(arr);
  },
  subtle: typeof crypto !== 'undefined' ? crypto.subtle : undefined,
};
