import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemberAuth } from '../backend/src/security/memberAuth';

test('member history excludes another owner even with matching contact or destination', async () => {
  const member = { id: 'owner-a', phone: '081234567890', email: 'shared@example.invalid' };
  const rows = [
    { id: 'mine', userId: member.id, guestAccessToken: 'private' },
    { id: 'other', userId: 'owner-b', customerPhone: member.phone, customerEmail: member.email, targetDestination: member.phone },
    { id: 'unowned', customerPhone: member.phone },
  ];
  const matches = (row: any, filter: any): boolean => filter.$or
    ? filter.$or.some((f: any) => matches(row, f))
    : Object.entries(filter).every(([key, value]) => row[key] === value);
  const db: any = { collection(name: string) {
    return {
      async createIndex() {},
      async findOne() { return name === 'member_sessions' ? { userId: member.id } : member; },
      find(filter: any) {
        const cursor = { sort() { return cursor; }, limit() { return cursor; }, async toArray() { return rows.filter(r => matches(r, filter)); } };
        return cursor;
      },
    };
  } };
  const { router } = createMemberAuth(async () => db, false);
  const layer = (router as any).stack.find((l: any) => l.route?.path === '/orders');
  let payload: any;
  const res: any = { status() { return res; }, json(value: any) { payload = value; return res; } };
  await layer.route.stack[0].handle({ headers: { cookie: `wd_member_session=${'a'.repeat(64)}` } }, res);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.map((o: any) => o.id), ['mine']);
  assert.equal(payload.data[0].guestAccessToken, undefined);
});
