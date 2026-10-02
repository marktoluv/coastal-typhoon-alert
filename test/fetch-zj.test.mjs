import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../scripts/fetch-zj.mjs';

const now = new Date('2026-10-02T05:30:00Z');
const observed = { time: '2026-10-02 11:00:00', lat: '17.10', lng: '144.60', power: '10', speed: '28', movedirection: '北', movespeed: '6' };
const forecast = { time: '2026-10-02 23:00:00', lat: '17.70', lng: '144.50', ybsj: '2026-10-02T11:00:00+08:00' };

test('normalizes an active storm and keeps forecasts separate from observations', async () => {
  const get = async path => {
    if (path === '/TyhoonActivity') return { tfid: '202627' };
    if (path.startsWith('/TyphoonList/')) return [];
    if (path === '/TyphoonInfo/202627') return {
      tfid: '202627', name: '彩云', enname: 'CHOI-WAN',
      points: [{ ...observed, forecast: [{ tm: '中国', forecastpoints: [observed, forecast] }] }],
    };
    throw new Error(path);
  };
  const data = await buildSnapshot({ get, now });
  assert.equal(data.status, 'active');
  assert.equal(data.storms[0].current.time, '2026-10-02T03:00:00.000Z');
  assert.equal(data.storms[0].current.windLevel, 10);
  assert.equal(data.storms[0].forecast.length, 1);
  assert.equal(data.storms[0].forecast[0].time, '2026-10-02T15:00:00.000Z');
  assert.equal(data.warnings.status, 'unavailable');
});

test('reports no active storm only when all source lists are empty', async () => {
  const data = await buildSnapshot({ get: async () => [], now });
  assert.equal(data.status, 'none');
  assert.deepEqual(data.storms, []);
});

test('rejects an invalid source response instead of publishing an empty state', async () => {
  await assert.rejects(buildSnapshot({
    get: async path => path === '/TyhoonActivity' ? { error: 'upstream failed' } : [], now,
  }), /Unexpected TyhoonActivity item/);
});

