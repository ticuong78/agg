import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { DomainError } from '../src/shared/domain/domain-error.js';
import { Order } from '../src/modules/billing/domain/order.js';
import { price } from '../src/modules/billing/domain/pricing.js';
import { Subscription } from '../src/modules/billing/domain/subscription.js';
import { Wallet } from '../src/modules/billing/domain/wallet.js';
import { Workspace } from '../src/modules/billing/domain/workspace.js';
import { today } from '../src/modules/billing/application/billing.facade.js';
import { vnpDate, vnpSign } from '../src/modules/billing/infrastructure/payments/vnpay.gateway.js';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);

describe('Wallet', () => {
  it('spends the credits that expire first', () => {
    const w = Wallet.open('USER', 'u1');
    w.grant('TOPUP', 10, day(300), 'topup', 'x', day(0));
    w.grant('PLAN', 5, day(30), 'plan', 'x', day(0));
    w.spend(7, 'u1', 'x', 'r', day(1));
    const live = w.live(day(1));
    assert.deepEqual(live.map((b) => [b.source, b.remaining]), [['TOPUP', 8]]);
  });

  it('ignores expired credits and refuses to overdraw', () => {
    const w = Wallet.open('USER', 'u1');
    w.grant('PLAN', 5, day(10), 'plan', 'x', day(0));
    assert.equal(w.balance(day(11)), 0);
    assert.throws(() => w.spend(1, 'u1', 'x', 'r', day(11)), (e: unknown) => e instanceof DomainError && e.kind === 'payment_required');
  });

  it('grants once per reference (repeated webhooks and events)', () => {
    const w = Wallet.open('USER', 'u1');
    assert.equal(w.grant('TOPUP', 100, null, 'order:1', 'x'), true);
    assert.equal(w.grant('TOPUP', 100, null, 'order:1', 'x'), false);
    assert.equal(w.balance(), 100);
  });

  it('refills free credits up to the cap only', () => {
    const w = Wallet.open('USER', 'u1');
    w.grant('WELCOME', 25, null, 'welcome', 'x', day(0));
    w.refill('MONTHLY_FREE', 30, 10, 'free:2026-02', day(60), 'x', day(31));
    assert.equal(w.balance(day(31)), 30);
    w.refill('MONTHLY_FREE', 30, 10, 'free:2026-02', day(60), 'x', day(31));
    assert.equal(w.balance(day(31)), 30);
  });

  it('records ledger lines for grants and spending', () => {
    const w = Wallet.open('USER', 'u1');
    w.grant('REWARD', 20, null, 'r1', 'Thưởng');
    w.spend(3, 'u1', 'Gợi ý test', 'c1');
    assert.deepEqual(w.pullLines().map((l) => l.amount), [20, -3]);
    assert.deepEqual(w.pullLines(), []);
  });
});

describe('Pricing', () => {
  it('prices plans, yearly plans and extra school seats', () => {
    assert.equal(price({ kind: 'PLAN', tier: 'INDIVIDUAL', period: 'MONTH' }).amount, 99_000);
    assert.equal(price({ kind: 'PLAN', tier: 'INDIVIDUAL', period: 'YEAR' }).amount, 990_000);
    assert.equal(price({ kind: 'PLAN', tier: 'SCHOOL', period: 'MONTH', extraSeats: 2 }).amount, 1_290_000 + 98_000);
    assert.equal(price({ kind: 'TOPUP', packId: 'pack-500' }).amount, 199_000);
  });

  it('does not sell enterprise or unknown packs', () => {
    assert.throws(() => price({ kind: 'PLAN', tier: 'ENTERPRISE' as never, period: 'MONTH' }));
    assert.throws(() => price({ kind: 'TOPUP', packId: 'nope' }));
  });
});

describe('Order', () => {
  const order = () => Order.place('u1', price({ kind: 'TOPUP', packId: 'pack-100' }), 'VIETQR', null);

  it('is paid once, for its exact amount', () => {
    const o = order();
    assert.throws(() => o.markPaid(1000, 'x'));
    assert.equal(o.markPaid(49_000, 'tx1'), true);
    assert.equal(o.markPaid(49_000, 'tx1'), false);
    assert.equal(o.pullEvents().length, 1);
    assert.match(o.code, /^GD\d{8}$/);
  });
});

describe('Subscription', () => {
  it('grants monthly credits while active, each once', () => {
    const s = Subscription.start('USER', 'u1', 'INDIVIDUAL', 'YEAR', 0, day(0));
    assert.equal(s.dueGrants(day(0)).length, 1);
    assert.equal(s.dueGrants(day(0)).length, 0);
    assert.equal(s.dueGrants(day(65)).length, 2);
    assert.equal(s.dueGrants(day(400)).length, 9);
    assert.equal(s.isActive(day(400)), false);
  });

  it('renewing the same tier adds time after the current end', () => {
    const s = Subscription.start('USER', 'u1', 'INDIVIDUAL', 'MONTH', 0, day(0));
    s.renew('INDIVIDUAL', 'MONTH', 0, day(10));
    assert.equal(s.endsAt.getTime(), day(60).getTime());
  });
});

describe('Workspace', () => {
  it('invites within the seat limit and lets the invited address join', () => {
    const w = Workspace.create('Tổ Tin', { userId: 'owner', email: 'owner@school.vn' });
    w.invite('Teacher@School.vn', 2);
    assert.throws(() => w.invite('third@school.vn', 2), (e: unknown) => e instanceof DomainError && e.code === 'workspace.seats_full');
    assert.equal(w.join('t1', 'teacher@school.vn'), true);
    assert.equal(w.roleOf('t1'), 'MEMBER');
    assert.throws(() => w.remove('owner@school.vn'));
  });
});

describe('Payment signatures', () => {
  it('VNPay signs sorted, form-encoded parameters with HMAC-SHA512', () => {
    const params = { vnp_TxnRef: 'GD1', vnp_Amount: '4900000', vnp_OrderInfo: 'Thanh toan don GD1' };
    const expected = createHmac('sha512', 'secret')
      .update('vnp_Amount=4900000&vnp_OrderInfo=Thanh+toan+don+GD1&vnp_TxnRef=GD1')
      .digest('hex');
    assert.equal(vnpSign(params, 'secret'), expected);
  });

  it('VNPay dates are Vietnam local time', () => {
    assert.equal(vnpDate(new Date('2026-11-16T17:30:05Z')), '20261117003005');
  });
});

describe('Daily allowance', () => {
  it('resets at midnight in Vietnam', () => {
    assert.equal(today(new Date('2026-11-16T16:59:00Z')), '2026-11-16');
    assert.equal(today(new Date('2026-11-16T17:00:00Z')), '2026-11-17');
  });
});
