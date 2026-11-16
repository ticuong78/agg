import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Lead } from '../src/modules/growth/domain/lead.js';
import { Referral } from '../src/modules/growth/domain/referral.js';
import { RewardClaim, RewardPolicy } from '../src/modules/growth/domain/reward-claim.js';

describe('RewardClaim', () => {
  it('approves instant activities and holds reviewed ones', () => {
    assert.equal(RewardClaim.submit('u', 'SURVEY', 's', {}).status, 'APPROVED');
    const bug = RewardClaim.submit('u', 'BUG_REPORT', 'b', {});
    assert.equal(bug.status, 'PENDING');
    assert.throws(() => bug.decide(true, 500, undefined));
    bug.decide(true, 30, 'ok');
    assert.equal(bug.credits, 30);
    assert.throws(() => bug.decide(true, 30, undefined));
  });
});

describe('RewardPolicy', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const claim = (activity: 'SURVEY' | 'FEEDBACK', daysAgo: number) =>
    ({ ...RewardClaim.submit('u', activity, '', {}, new Date(now.getTime() - daysAgo * 86_400_000)).snapshot() });

  it('allows the survey once and feedback every 30 days', () => {
    assert.equal(RewardPolicy.canSubmit('SURVEY', [claim('SURVEY', 100)], now).allowed, false);
    assert.equal(RewardPolicy.canSubmit('FEEDBACK', [claim('FEEDBACK', 10)], now).allowed, false);
    assert.equal(RewardPolicy.canSubmit('FEEDBACK', [claim('FEEDBACK', 31)], now).allowed, true);
  });
});

describe('Referral', () => {
  it('qualifies once', () => {
    const r = Referral.signedUp('a', 'b');
    assert.equal(r.qualify(), true);
    assert.equal(r.qualify(), false);
  });
});

describe('Lead', () => {
  it('merges touches into one record and keeps consent unless a touch changes it', () => {
    const lead = Lead.capture({ email: 'Co.Lan@School.vn', source: 'GUEST_EMAIL', marketingConsent: true });
    lead.merge({ email: 'co.lan@school.vn', source: 'SURVEY', organization: 'THPT A', attributes: { role: 'Giáo viên' } });
    const s = lead.snapshot();
    assert.equal(s.email, 'co.lan@school.vn');
    assert.deepEqual(s.sources, ['GUEST_EMAIL', 'SURVEY']);
    assert.equal(s.marketingConsent, true);
    assert.equal(s.attributes.role, 'Giáo viên');
  });
});
