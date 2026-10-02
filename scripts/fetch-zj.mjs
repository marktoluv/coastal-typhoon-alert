import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = 'https://typhoon.slt.zj.gov.cn/Api';
const output = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'latest.json');

function chinaYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(date));
}

async function getJson(path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${base}${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'coastal-typhoon-alert/1.0 (+https://github.com/marktoluv/coastal-typhoon-alert)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} (${path})`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

function sourceTime(value) {
  if (typeof value !== 'string') throw new Error('Missing source time');
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}+08:00`;
  const ms = Date.parse(normalized);
  if (!Number.isFinite(ms)) throw new Error(`Invalid source time: ${value}`);
  return new Date(ms).toISOString();
}

function number(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function shortText(value, maxLength = 160) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function point(value) {
  const lat = number(value?.lat, -90, 90);
  const lng = number(value?.lng, -180, 180);
  if (lat === null || lng === null) throw new Error('Missing or invalid typhoon coordinates');
  return {
    time: sourceTime(value.time), lat, lng,
    category: shortText(value.strong, 40),
    windLevel: number(value.power, 0, 30),
    windSpeed: number(value.speed, 0, 150),
    direction: shortText(value.movedirection, 30),
    moveSpeed: number(value.movespeed, 0, 300),
    location: shortText(value.ckposition),
  };
}

function normalizeStorm(detail) {
  if (!detail || !/^\d{6}$/.test(String(detail.tfid)) || !Array.isArray(detail.points) || !detail.points.length) {
    throw new Error('Unexpected TyphoonInfo shape');
  }
  const observed = detail.points.map(point).sort((a, b) => a.time.localeCompare(b.time)).slice(-12);
  const current = observed.at(-1);
  if (!shortText(detail.name)) throw new Error(`Typhoon ${detail.tfid} has no name`);
  const agency = detail.points.at(-1).forecast?.find(item => item.tm === '中国');
  const forecast = Array.isArray(agency?.forecastpoints)
    ? agency.forecastpoints.map(point).filter(item => item.time > current.time).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 12)
    : [];
  const firstForecast = agency?.forecastpoints?.find(item => item.ybsj);
  return {
    id: String(detail.tfid), name: shortText(detail.name, 60), englishName: shortText(detail.enname, 60),
    current, observed, forecast,
    forecastAgency: forecast.length ? '中国（来源系统标记）' : null,
    forecastIssuedAt: forecast.length && firstForecast ? sourceTime(firstForecast.ybsj) : null,
  };
}

export async function buildSnapshot({ get = getJson, now = new Date() } = {}) {
  const year = chinaYear(now);
  const [activity, currentYear, previousYear] = await Promise.all([
    get('/TyhoonActivity'), get(`/TyphoonList/${year}`), get(`/TyphoonList/${year - 1}`),
  ]);
  if (!Array.isArray(currentYear) || !Array.isArray(previousYear)) throw new Error('Unexpected TyphoonList shape');
  const active = new Map();
  for (const item of [...previousYear, ...currentYear]) {
    if (String(item?.isactive) === '1' && /^\d{6}$/.test(String(item?.tfid))) active.set(String(item.tfid), true);
  }
  const activityItems = activity == null ? [] : Array.isArray(activity) ? activity : [activity];
  if (!activityItems.every(item => item && typeof item === 'object')) throw new Error('Unexpected TyhoonActivity shape');
  if (activityItems.some(item => Object.keys(item).length && !/^\d{6}$/.test(String(item.tfid)))) throw new Error('Unexpected TyhoonActivity item');
  for (const item of activityItems) {
    if (/^\d{6}$/.test(String(item.tfid))) active.set(String(item.tfid), true);
  }
  const storms = await Promise.all([...active.keys()].map(async id => normalizeStorm(await get(`/TyphoonInfo/${id}`))));
  storms.sort((a, b) => b.current.time.localeCompare(a.current.time));
  return {
    schemaVersion: 1, fetchedAt: now.toISOString(), status: storms.length ? 'active' : 'none',
    source: { name: '浙江省水利厅实时台风路径系统', url: 'https://typhoon.slt.zj.gov.cn/' },
    warnings: { status: 'unavailable', reason: '未接入区县级气象预警数据' },
    storms,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const snapshot = await buildSnapshot();
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(`Saved ${snapshot.storms.length} active typhoon(s) at ${snapshot.fetchedAt}`);
  } catch (error) {
    console.error('Source fetch failed; deployment must not replace the last successful snapshot:', error);
    process.exitCode = 1;
  }
}

