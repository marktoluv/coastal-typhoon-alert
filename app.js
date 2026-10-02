const $ = id => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const sourceUrl = 'https://typhoon.slt.zj.gov.cn/';
let snapshot = null;
let networkError = false;

function svgElement(name, attributes) {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function formatTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '时间未提供';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function position(point) {
  return `北纬 ${point.lat.toFixed(1)}° · 东经 ${point.lng.toFixed(1)}°`;
}

function timeAge(value) {
  return Date.now() - Date.parse(value);
}

function dataState() {
  if (networkError) return { title: '数据读取失败', detail: '无法确认最新状态，请直接查看官方台风路径。', kind: 'error' };
  if (!snapshot) return { title: '数据读取中', detail: '正在读取台风路径数据。', kind: 'loading' };
  if (timeAge(snapshot.fetchedAt) > 45 * 60_000 || timeAge(snapshot.fetchedAt) < -10 * 60_000) {
    return { title: '同步数据已过期', detail: `最近成功同步：${formatTime(snapshot.fetchedAt)}。请查看官方数据。`, kind: 'stale' };
  }
  if (snapshot.storms.some(storm => timeAge(storm.current.time) > 6 * 60 * 60_000 || timeAge(storm.current.time) < -10 * 60_000)) {
    return { title: '观测资料可能已过期', detail: '来源系统的最新观测超过 6 小时，请以官方页面为准。', kind: 'stale' };
  }
  return { title: '数据已同步', detail: `最近同步：${formatTime(snapshot.fetchedAt)}。实况以各台风观测时刻为准；本地预警未接入。`, kind: 'ok' };
}

function renderStatus() {
  const state = dataState();
  document.body.dataset.state = state.kind;
  $('status-banner').dataset.state = state.kind;
  $('status-title').textContent = state.title;
  $('status-detail').textContent = state.detail;
  $('header-state').textContent = state.title;
  $('header-time').textContent = snapshot ? `同步 ${formatTime(snapshot.fetchedAt)}` : '等待数据';
  $('storm-flag').textContent = state.kind === 'ok' ? '来源实况' : '请核对时间';
}

function renderTrack(storm) {
  const grid = $('track-grid');
  const routes = $('track-routes');
  const points = $('track-points');
  grid.replaceChildren(); routes.replaceChildren(); points.replaceChildren();
  const all = [...storm.observed, ...storm.forecast];
  const lngs = all.map(p => p.lng), lats = all.map(p => p.lat);
  const minLngRaw = Math.min(...lngs), maxLngRaw = Math.max(...lngs);
  const minLatRaw = Math.min(...lats), maxLatRaw = Math.max(...lats);
  const lngPad = Math.max((maxLngRaw - minLngRaw) * 0.12, 1);
  const latPad = Math.max((maxLatRaw - minLatRaw) * 0.12, 1);
  const minLng = minLngRaw - lngPad, maxLng = maxLngRaw + lngPad;
  const minLat = minLatRaw - latPad, maxLat = maxLatRaw + latPad;
  const xy = p => ({ x: 85 + (p.lng - minLng) / (maxLng - minLng) * 650, y: 430 - (p.lat - minLat) / (maxLat - minLat) * 355 });
  for (let n = 0; n <= 4; n++) {
    const x = 85 + n * 162.5, y = 430 - n * 88.75;
    grid.append(svgElement('line', { x1: x, y1: 75, x2: x, y2: 430, class: 'axis-line' }));
    grid.append(svgElement('line', { x1: 85, y1: y, x2: 735, y2: y, class: 'axis-line' }));
    const lngLabel = svgElement('text', { x, y: 465, 'text-anchor': 'middle', class: 'axis-label' });
    lngLabel.textContent = `${(minLng + n * (maxLng - minLng) / 4).toFixed(1)}°E`;
    grid.append(lngLabel);
    const latLabel = svgElement('text', { x: 73, y: y + 6, 'text-anchor': 'end', class: 'axis-label' });
    latLabel.textContent = `${(minLat + n * (maxLat - minLat) / 4).toFixed(1)}°N`;
    grid.append(latLabel);
  }
  const line = (items, className) => svgElement('polyline', { points: items.map(p => { const c = xy(p); return `${c.x},${c.y}`; }).join(' '), class: className });
  routes.append(line(storm.observed, 'route-observed'));
  if (storm.forecast.length) routes.append(line([storm.current, ...storm.forecast], 'route-forecast'));
  storm.observed.slice(0, -1).forEach(p => { const c = xy(p); points.append(svgElement('circle', { cx: c.x, cy: c.y, r: 6, class: 'route-point' })); });
  storm.forecast.forEach(p => { const c = xy(p); points.append(svgElement('circle', { cx: c.x, cy: c.y, r: 6, class: 'route-point route-point--forecast' })); });
  const center = xy(storm.current);
  points.append(svgElement('circle', { cx: center.x, cy: center.y, r: 24, class: 'route-center-halo' }));
  points.append(svgElement('circle', { cx: center.x, cy: center.y, r: 10, class: 'route-center' }));
  const label = svgElement('text', { x: center.x > 580 ? center.x - 18 : center.x + 18, y: center.y - 16, 'text-anchor': center.x > 580 ? 'end' : 'start', class: 'route-point-label' });
  label.textContent = '最新中心'; points.append(label);
  $('track-svg-title').textContent = `${storm.name}的经纬度路径示意图`;
  $('forecast-meta').textContent = storm.forecast.length
    ? `实线为观测；虚线为${storm.forecastAgency}预报，发布于 ${formatTime(storm.forecastIssuedAt)}`
    : '来源系统暂未提供“中国”预报路径';

  const list = $('route-items'); list.replaceChildren();
  for (const [index, p] of all.entries()) {
    const forecast = index >= storm.observed.length;
    const item = document.createElement('li'); if (forecast) item.className = 'forecast-step';
    const kind = document.createElement('small'); kind.textContent = forecast ? `${storm.forecastAgency}预报` : '已观测';
    const time = document.createElement('strong'); time.textContent = formatTime(p.time);
    const coords = document.createElement('span'); coords.textContent = position(p);
    item.append(kind, time, coords); list.append(item);
  }
}

function renderStorm(storm) {
  const p = storm.current;
  $('storm-number').textContent = `编号 ${storm.id}`;
  $('storm-name').textContent = storm.name;
  $('storm-romanized').textContent = storm.englishName || '英文名暂未提供';
  $('storm-category').textContent = p.category || '强度暂未提供';
  $('storm-summary').textContent = p.location || `中心位于${position(p)}，向${p.direction || '未知方向'}移动。`;
  $('storm-position').textContent = p.location || '地理描述暂未提供';
  $('storm-coordinates').textContent = position(p);
  $('storm-direction').textContent = p.direction || '暂未提供';
  $('storm-speed').textContent = p.moveSpeed === null ? '移速暂未提供' : `移速 ${p.moveSpeed} 公里/小时`;
  $('storm-wind-level').textContent = p.windLevel === null ? '暂未提供' : `${p.windLevel} 级`;
  $('storm-wind-speed').textContent = p.windSpeed === null ? '风速暂未提供' : `${p.windSpeed} 米/秒`;
  $('storm-observed-at').textContent = `观测时间：${formatTime(p.time)}（北京时间） · 来源：浙江省水利厅台风路径系统`;
  renderTrack(storm);
}

function clearStorm(message) {
  $('storm-name').textContent = message;
  for (const id of ['storm-number','storm-romanized','storm-category','storm-summary','storm-position','storm-coordinates','storm-direction','storm-speed','storm-wind-level','storm-wind-speed','storm-observed-at']) $(id).textContent = '—';
  for (const id of ['track-grid','track-routes','track-points','route-items']) $(id).replaceChildren();
  $('forecast-meta').textContent = `请查看 ${sourceUrl} 核对最新信息`;
}

function validSnapshot(data) {
  return data && data.schemaVersion === 1 && ['active','none'].includes(data.status) && Number.isFinite(Date.parse(data.fetchedAt))
    && Array.isArray(data.storms) && data.storms.every(s => s.id && s.name && s.current && Number.isFinite(Date.parse(s.current.time)) && Array.isArray(s.observed) && s.observed.length && Array.isArray(s.forecast));
}

async function loadData() {
  try {
    const response = await fetch(`./data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!validSnapshot(data)) throw new Error('Invalid snapshot');
    snapshot = data; networkError = false;
    const select = $('storm-select'); select.replaceChildren();
    for (const storm of data.storms) {
      const option = document.createElement('option'); option.value = storm.id; option.textContent = `${storm.name} · ${storm.id}`; select.append(option);
    }
    select.disabled = data.storms.length < 2;
    if (data.storms.length) renderStorm(data.storms[0]);
    else { select.add(new Option('当前无活动台风', '')); clearStorm('当前无活动台风'); }
  } catch (error) {
    console.error('Typhoon snapshot unavailable', error);
    networkError = true;
    if (!snapshot) clearStorm('数据暂不可用');
  }
  renderStatus();
}

$('storm-select').addEventListener('change', event => {
  const storm = snapshot?.storms.find(item => item.id === event.target.value);
  if (storm) renderStorm(storm);
});
loadData();
setInterval(loadData, 5 * 60_000);
setInterval(renderStatus, 60_000);


