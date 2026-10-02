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

function selectedStorm() {
  return snapshot?.storms.find(storm => storm.id === $('storm-select').value) || snapshot?.storms[0] || null;
}

function dataState() {
  const storm = selectedStorm();
  const times = snapshot ? `最新观测：${storm ? formatTime(storm.current.time) : '暂无活动台风'}；本站同步：${formatTime(snapshot.fetchedAt)}。` : '';
  if (networkError) return { title: '数据读取失败', detail: `${times}无法确认最新状态，请查看官方台风路径。`, kind: 'error' };
  if (!snapshot) return { title: '数据读取中', detail: '正在读取台风路径数据。', kind: 'loading' };
  if (timeAge(snapshot.fetchedAt) > 45 * 60_000 || timeAge(snapshot.fetchedAt) < -10 * 60_000) {
    return { title: '同步数据可能已过期', detail: `${times}请查看官方数据。`, kind: 'stale' };
  }
  if (storm && (timeAge(storm.current.time) > 6 * 60 * 60_000 || timeAge(storm.current.time) < -10 * 60_000)) {
    return { title: '观测资料可能已过期', detail: `${times}来源系统的观测超过 6 小时，请以官方页面为准。`, kind: 'stale' };
  }
  return { title: '站点已同步', detail: `${times}当地预警未接入。`, kind: 'ok' };
}

function renderStatus() {
  const state = dataState();
  document.body.dataset.state = state.kind;
  $('status-banner').dataset.state = state.kind;
  $('status-title').textContent = state.title;
  $('status-detail').textContent = state.detail;
  $('header-state').textContent = state.title;
  $('header-time').textContent = snapshot ? `观测 ${selectedStorm() ? formatTime(selectedStorm().current.time) : '暂无活动台风'}` : '等待数据';
  $('storm-flag').textContent = state.kind === 'ok' ? '来源实况' : '请核对时间';
}

function renderTrack(storm) {
  const grid = $('track-grid');
  const routes = $('track-routes');
  const points = $('track-points');
  grid.replaceChildren(); routes.replaceChildren(); points.replaceChildren();
  const mobile = window.innerWidth <= 680;
  const chart = mobile
    ? { width: 400, height: 350, left: 75, right: 345, top: 35, bottom: 298 }
    : { width: 800, height: 500, left: 85, right: 735, top: 75, bottom: 430 };
  $('track-svg').setAttribute('viewBox', `0 0 ${chart.width} ${chart.height}`);
  const all = [...storm.observed, ...storm.forecast];
  const lngs = all.map(p => p.lng), lats = all.map(p => p.lat);
  const minLngRaw = Math.min(...lngs), maxLngRaw = Math.max(...lngs);
  const minLatRaw = Math.min(...lats), maxLatRaw = Math.max(...lats);
  const lngPad = Math.max((maxLngRaw - minLngRaw) * 0.12, 1);
  const latPad = Math.max((maxLatRaw - minLatRaw) * 0.12, 1);
  const minLng = minLngRaw - lngPad, maxLng = maxLngRaw + lngPad;
  const minLat = minLatRaw - latPad, maxLat = maxLatRaw + latPad;
  const xy = p => ({
    x: chart.left + (p.lng - minLng) / (maxLng - minLng) * (chart.right - chart.left),
    y: chart.bottom - (p.lat - minLat) / (maxLat - minLat) * (chart.bottom - chart.top),
  });
  for (let n = 0; n <= 4; n++) {
    const x = chart.left + n * (chart.right - chart.left) / 4;
    const y = chart.bottom - n * (chart.bottom - chart.top) / 4;
    grid.append(svgElement('line', { x1: x, y1: chart.top, x2: x, y2: chart.bottom, class: 'axis-line' }));
    grid.append(svgElement('line', { x1: chart.left, y1: y, x2: chart.right, y2: y, class: 'axis-line' }));
    const lngLabel = svgElement('text', { x, y: chart.bottom + (mobile ? 27 : 35), 'text-anchor': 'middle', class: 'axis-label' });
    lngLabel.textContent = `${(minLng + n * (maxLng - minLng) / 4).toFixed(1)}°E`;
    grid.append(lngLabel);
    const latLabel = svgElement('text', { x: chart.left - 12, y: y + 6, 'text-anchor': 'end', class: 'axis-label' });
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
  const labelLeft = center.x > chart.width * .7;
  const label = svgElement('text', {
    x: mobile ? center.x : labelLeft ? center.x - 18 : center.x + 18,
    y: center.y - (mobile ? 31 : 16),
    'text-anchor': mobile ? 'middle' : labelLeft ? 'end' : 'start',
    class: 'route-point-label',
  });
  label.textContent = '最新中心'; points.append(label);
  $('track-svg-title').textContent = `${storm.name}的经纬度路径示意图`;
  $('track-location').textContent = `来源位置：${storm.current.location || position(storm.current)}`;
  $('forecast-meta').textContent = storm.forecast.length
    ? `实线为观测；虚线为${storm.forecastAgency}预报，发布于 ${formatTime(storm.forecastIssuedAt)}`
    : '来源系统暂未提供“中国”预报路径';

  const makeRouteItem = (p, forecast) => {
    const item = document.createElement('li'); if (forecast) item.className = 'forecast-step';
    const kind = document.createElement('small'); kind.textContent = forecast ? `${storm.forecastAgency}预报` : '已观测';
    const time = document.createElement('strong'); time.textContent = formatTime(p.time);
    const coords = document.createElement('span'); coords.textContent = position(p);
    item.append(kind, time, coords);
    return item;
  };
  const list = $('route-items');
  const fullList = $('route-all-items');
  list.replaceChildren(); fullList.replaceChildren();
  for (const p of storm.observed.slice(-3)) list.append(makeRouteItem(p, false));
  for (const p of storm.forecast.slice(0, 3)) list.append(makeRouteItem(p, true));
  for (const p of storm.observed) fullList.append(makeRouteItem(p, false));
  for (const p of storm.forecast) fullList.append(makeRouteItem(p, true));
  const history = $('route-history');
  history.hidden = storm.observed.length <= 3 && storm.forecast.length <= 3;
  history.dataset.total = String(all.length);
  if (history.dataset.stormId !== storm.id) history.open = false;
  history.dataset.stormId = storm.id;
  updateRouteDisclosure();
}

function updateRouteDisclosure() {
  const history = $('route-history');
  $('route-items').hidden = !history.hidden && history.open;
  history.querySelector('summary').textContent = history.open ? '收起完整路径' : `展开完整路径（${history.dataset.total || 0} 个点）`;
}

function renderOutlook(storm, emptyMessage = '预报路径暂不可用，请查看官方台风路径。') {
  const list = $('outlook-items');
  list.replaceChildren();
  if (!storm?.forecast.length) {
    $('outlook-source').textContent = storm ? `${storm.name}的预报暂未提供` : '暂无可展示的预报资料';
    const item = document.createElement('li');
    item.className = 'outlook-empty';
    item.textContent = emptyMessage;
    list.append(item);
    return;
  }
  $('outlook-source').textContent = `${storm.name}｜${storm.forecastAgency}｜预报发布：${formatTime(storm.forecastIssuedAt)}（北京时间）`;
  for (const point of storm.forecast.slice(0, 3)) {
    const item = document.createElement('li');
    const hours = Math.round((Date.parse(point.time) - Date.parse(storm.current.time)) / 3_600_000);
    const kind = document.createElement('small'); kind.textContent = `预报中心 · +${hours} 小时`;
    const time = document.createElement('strong'); time.textContent = formatTime(point.time);
    const coords = document.createElement('span'); coords.textContent = position(point);
    const intensity = document.createElement('span');
    intensity.textContent = `${point.category || '强度未提供'} · ${point.windLevel === null ? '风力未提供' : `${point.windLevel} 级`}`;
    const wind = document.createElement('span');
    wind.textContent = point.windSpeed === null ? '中心风速未提供' : `中心风速 ${point.windSpeed} 米/秒`;
    item.append(kind, time, coords, intensity, wind);
    list.append(item);
  }
}

function renderStorm(storm) {
  const p = storm.current;
  $('storm-number').textContent = `编号 ${storm.id}`;
  $('storm-name').textContent = storm.name;
  $('storm-romanized').textContent = storm.englishName || '英文名暂未提供';
  $('storm-category').textContent = p.category || '强度暂未提供';
  $('storm-position').textContent = p.location || '地理描述暂未提供';
  $('storm-coordinates').textContent = position(p);
  $('storm-direction').textContent = p.direction || '暂未提供';
  $('storm-speed').textContent = p.moveSpeed === null ? '移速暂未提供' : `移速 ${p.moveSpeed} 公里/小时`;
  $('storm-wind-level').textContent = p.windLevel === null ? '暂未提供' : `${p.windLevel} 级`;
  $('storm-wind-speed').textContent = p.windSpeed === null ? '风速暂未提供' : `${p.windSpeed} 米/秒`;
  $('storm-observed-at').textContent = `观测时间：${formatTime(p.time)}（北京时间） · 来源：浙江省水利厅台风路径系统`;
  renderOutlook(storm);
  renderTrack(storm);
}

function clearStorm(message) {
  $('storm-name').textContent = message;
  for (const id of ['storm-number','storm-romanized','storm-category','storm-position','storm-coordinates','storm-direction','storm-speed','storm-wind-level','storm-wind-speed','storm-observed-at']) $(id).textContent = '—';
  for (const id of ['track-grid','track-routes','track-points','route-items','route-all-items']) $(id).replaceChildren();
  $('route-history').hidden = true;
  $('route-history').open = false;
  $('route-items').hidden = false;
  $('track-location').textContent = '位置描述暂不可用';
  $('forecast-meta').textContent = `请查看 ${sourceUrl} 核对最新信息`;
  renderOutlook(null, message === '当前无活动台风' ? '来源系统目前没有活动台风预报。' : '预报数据暂不可用，请查看官方台风路径。');
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
    const select = $('storm-select');
    const previousId = select.value;
    select.replaceChildren();
    for (const storm of data.storms) {
      const option = document.createElement('option'); option.value = storm.id; option.textContent = `${storm.name} · ${storm.id}`; select.append(option);
    }
    select.disabled = data.storms.length < 2;
    $('storm-picker').hidden = data.storms.length < 2;
    if (data.storms.length) {
      if (data.storms.some(storm => storm.id === previousId)) select.value = previousId;
      renderStorm(selectedStorm());
    }
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
  if (storm) { renderStorm(storm); renderStatus(); }
});
$('route-history').addEventListener('toggle', updateRouteDisclosure);
window.matchMedia('(max-width: 680px)').addEventListener('change', () => {
  const storm = selectedStorm();
  if (storm) renderTrack(storm);
});
loadData();
setInterval(loadData, 5 * 60_000);
setInterval(renderStatus, 60_000);



