import assert from 'node:assert/strict';
import test from 'node:test';
import { isMobileWindowOpen } from '../Services/loginPolicy.js';
import { isPaymentWindowOpen } from '../Services/paymentWindow.js';
import { dailyLimitFor } from '../Services/postLimits.js';

test('isMobileWindowOpen enforces 10:00 AM - 1:00 PM IST', () => {
  // 10:30 AM IST is 05:00 UTC
  const inside = new Date('2026-10-19T05:00:00.000Z');
  assert.equal(isMobileWindowOpen(inside), true);

  // 09:30 AM IST is 04:00 UTC (before window)
  const before = new Date('2026-10-19T04:00:00.000Z');
  assert.equal(isMobileWindowOpen(before), false);

  // 01:30 PM IST is 08:00 UTC (after window)
  const after = new Date('2026-10-19T08:00:00.000Z');
  assert.equal(isMobileWindowOpen(after), false);
});

test('isPaymentWindowOpen enforces 5:00 AM - 11:45 AM IST', () => {
  // 08:00 AM IST is 02:30 UTC (inside window)
  const inside = new Date('2026-10-19T02:30:00.000Z');
  assert.equal(isPaymentWindowOpen(inside), true);

  // 04:30 AM IST is 23:00 UTC previous day (before window)
  const before = new Date('2026-10-18T23:00:00.000Z');
  assert.equal(isPaymentWindowOpen(before), false);

  // 11:50 AM IST is 06:20 UTC (after window)
  const after = new Date('2026-10-19T06:20:00.000Z');
  assert.equal(isPaymentWindowOpen(after), false);
});

test('dailyLimitFor enforces friend count posting privileges', () => {
  assert.equal(dailyLimitFor(0), 0);
  assert.equal(dailyLimitFor(1), 1);
  assert.equal(dailyLimitFor(2), 2);
  assert.equal(dailyLimitFor(5), 2);
  assert.equal(dailyLimitFor(6), 5);
  assert.equal(dailyLimitFor(10), 5);
  assert.equal(dailyLimitFor(11), Infinity);
  assert.equal(dailyLimitFor(100), Infinity);
});
