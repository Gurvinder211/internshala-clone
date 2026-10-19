import assert from 'node:assert/strict';
import test from 'node:test';
import { generateResetPassword } from '../Services/passwordService.js';

test('generateResetPassword generates only uppercase and lowercase English letters', () => {
  for (let i = 0; i < 50; i++) {
    const pwd = generateResetPassword();
    assert.equal(pwd.length, 12, `Expected length 12, got ${pwd.length}`);
    assert.match(pwd, /^[A-Za-z]+$/, `Password must only contain English letters, got: ${pwd}`);
    assert.match(pwd, /[A-Z]/, 'Password must contain at least one uppercase letter');
    assert.match(pwd, /[a-z]/, 'Password must contain at least one lowercase letter');
    assert.equal(/[0-9]/.test(pwd), false, 'Password must not contain digits');
    assert.equal(/[^A-Za-z]/.test(pwd), false, 'Password must not contain special characters');
  }
});
