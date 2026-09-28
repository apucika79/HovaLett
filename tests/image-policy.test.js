const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../image-policy.js");

test("at most three report images are accepted", () => {
  assert.doesNotThrow(() => policy.assertImageCount([{}, {}, {}]));
  assert.throws(() => policy.assertImageCount([{}, {}, {}, {}]), /legfeljebb 3/);
  assert.throws(() => policy.assertImageCount([{}], 3), /legfeljebb 3/);
});

test("non-image MIME types are rejected", () => {
  assert.match(policy.validateMetadata({ name: "fake.jpg", size: 10, type: "text/plain" }), /MIME/);
});

test("magic bytes, MIME type and extension are independently checked", () => {
  assert.equal(policy.detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(policy.detectImageMime(Uint8Array.from([0x4d, 0x5a, 0x90, 0x00])), null);
  assert.match(policy.validateMetadata({ name: "photo.exe", size: 10, type: "image/jpeg" }), /kiterjesztés/);
});
