import assert from 'node:assert/strict';
import test from 'node:test';
import { pickEditable } from '../Services/resumeFields.js';

test('pickEditable strips unsafe fields from resume payloads', () => {
  const result = pickEditable({
    title: 'My resume',
    status: 'generated',
    pdfUrl: '../../.env',
    userId: 'bad-user-id',
    personal: { fullName: 'Ada Lovelace' },
    achievements: ['Published paper'],
    experience: [{ title: 'Intern' }],
    ignored: 'not-allowed',
  });

  assert.deepEqual(result, {
    title: 'My resume',
    personal: { fullName: 'Ada Lovelace' },
    achievements: ['Published paper'],
    experience: [{ title: 'Intern' }],
  });
  assert.equal(result.status, undefined);
  assert.equal(result.pdfUrl, undefined);
  assert.equal(result.userId, undefined);
});
