const demoStorms = {
  lanzhou: {
    name: "澜舟", romanized: "LANZHOU · 虚构名称", number: "演示 01",
    category: "台风 · 演示强度", summary: "模拟中心位于东海中部，向西北方向移动。",
    position: "东海中部（虚构位置）", coordinates: "北纬 25.8° · 东经 123.4°（演示）",
    direction: "西北", speed: "每小时 18 公里（演示）", windLevel: "12 级", windSpeed: "33 米/秒（演示）",
    observedAt: "模拟观测时刻：09月18日 08:00 · 数据源：本站虚构样本",
    observed: [
      { x: 170, y: 418, time: "09月17日 08:00", place: "海域 A（虚构）" },
      { x: 272, y: 344, time: "09月17日 20:00", place: "海域 B（虚构）" },
      { x: 382, y: 276, time: "09月18日 08:00", place: "东海中部（虚构）" }
    ],
    forecast: [
      { x: 466, y: 215, time: "09月18日 20:00", place: "预报点 A（虚构）" },
      { x: 530, y: 160, time: "09月19日 08:00", place: "预报点 B（虚构）" }
    ]
  },
  wanghai: {
    name: "望海", romanized: "WANGHAI · 虚构名称", number: "演示 02",
    category: "强热带风暴 · 演示强度", summary: "模拟中心位于南海东北部，向北方向移动。",
    position: "南海东北部（虚构位置）", coordinates: "北纬 18.4° · 东经 117.2°（演示）",
    direction: "北", speed: "每小时 12 公里（演示）", windLevel: "10 级", windSpeed: "25 米/秒（演示）",
    observedAt: "模拟观测时刻：09月18日 08:00 · 数据源：本站虚构样本",
    observed: [
      { x: 210, y: 445, time: "09月17日 08:00", place: "海域 C（虚构）" },
      { x: 260, y: 365, time: "09月17日 20:00", place: "海域 D（虚构）" },
      { x: 305, y: 285, time: "09月18日 08:00", place: "南海东北部（虚构）" }
    ],
    forecast: [
      { x: 322, y: 212, time: "09月18日 20:00", place: "预报点 C（虚构）" },
      { x: 343, y: 145, time: "09月19日 08:00", place: "预报点 D（虚构）" }
    ]
  }
};

const demoAlerts = {
  taizhou: {
    level: "yellow", title: "台风黄色预警（演示）", region: "浙江省台州市椒江区（演示）",
    time: "09月18日 08:15（虚构）",
    message: "模拟情景：当地可能受台风外围影响，沿海出现较强风。此信息不代表该地区实际天气或已发布预警。",
    guidance: "演示防护提示：检查门窗和室外物品，减少危险的户外活动；实际行动请依据当地气象与应急部门通知。"
  },
  fuzhou: {
    level: "orange", title: "台风橙色预警（演示）", region: "福建省福州市仓山区（演示）",
    time: "09月18日 08:20（虚构）",
    message: "模拟情景：当地预计出现较强台风影响。此等级只是界面样本，并非福州市当前的官方预警。",
    guidance: "演示防护提示：留在坚固安全的室内，关注官方转移与停课通知；不要依据本页安排出行。"
  },
  shantou: {
    level: "none", title: "无生效预警示例", region: "广东省汕头市金平区（演示）",
    time: "09月18日 08:25（虚构）",
    message: "模拟情景：演示数据集中未设置该地区的台风预警。这不表示当地当前没有风险或没有官方预警。",
    guidance: "请打开官方渠道核对实际预警；没有预警信号也应关注天气变化。"
  },
  ningbo: {
    level: "unavailable", title: "预警数据不可用示例", region: "浙江省宁波市海曙区（演示）",
    time: "未提供",
    message: "模拟情景：预警数据源暂时不可用，无法判断当地是否存在生效预警。",
    guidance: "请直接查看当地气象部门或中央气象台的最新信息，不要把数据缺失理解为没有预警。"
  }
};

const $ = (id) => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes) {
  const element = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderAlert(key) {
  const alert = demoAlerts[key] || demoAlerts.taizhou;
  $("alert-panel").dataset.level = alert.level;
  $("alert-title").textContent = alert.title;
  $("alert-region").textContent = alert.region;
  $("alert-time").textContent = alert.time;
  $("alert-message").textContent = alert.message;
  $("alert-guidance").textContent = alert.guidance;
}

function renderTrack(storm) {
  const routes = $("track-routes");
  const points = $("track-points");
  routes.replaceChildren();
  points.replaceChildren();
  const current = storm.observed[storm.observed.length - 1];
  const line = (items, className) => svgElement("polyline", {
    points: items.map((point) => `${point.x},${point.y}`).join(" "), class: className
  });
  routes.append(line(storm.observed, "route-observed"));
  routes.append(line([current, ...storm.forecast], "route-forecast"));

  storm.observed.slice(0, -1).forEach((point) => {
    points.append(svgElement("circle", { cx: point.x, cy: point.y, r: 7, class: "route-point" }));
  });
  storm.forecast.forEach((point, index) => {
    points.append(svgElement("circle", { cx: point.x, cy: point.y, r: 7, class: "route-point route-point--forecast" }));
    const label = svgElement("text", { x: point.x + 13, y: point.y - 13, class: "route-point-label" });
    label.textContent = index === 0 ? "+12h" : "+24h";
    points.append(label);
  });
  points.append(svgElement("circle", { cx: current.x, cy: current.y, r: 26, class: "route-center-halo" }));
  points.append(svgElement("circle", { cx: current.x, cy: current.y, r: 11, class: "route-center" }));
  const centerLabel = svgElement("text", { x: current.x + 20, y: current.y - 19, class: "route-point-label" });
  centerLabel.textContent = "模拟中心";
  points.append(centerLabel);

  const steps = [...storm.observed, ...storm.forecast];
  const list = $("route-items");
  list.replaceChildren();
  steps.forEach((point, index) => {
    const item = document.createElement("li");
    const isForecast = index >= storm.observed.length;
    if (isForecast) item.className = "forecast-step";
    const kind = document.createElement("small");
    kind.textContent = isForecast ? `模拟预报 +${(index - storm.observed.length + 1) * 12}小时` : "模拟观测";
    const time = document.createElement("strong");
    time.textContent = point.time;
    const place = document.createElement("span");
    place.textContent = point.place;
    item.append(kind, time, place);
    list.append(item);
  });
}

function renderStorm(key) {
  const storm = demoStorms[key] || demoStorms.lanzhou;
  $("storm-number").textContent = storm.number;
  $("storm-name").textContent = storm.name;
  $("storm-romanized").textContent = storm.romanized;
  $("storm-category").textContent = storm.category;
  $("storm-summary").textContent = storm.summary;
  $("storm-position").textContent = storm.position;
  $("storm-coordinates").textContent = storm.coordinates;
  $("storm-direction").textContent = storm.direction;
  $("storm-speed").textContent = storm.speed;
  $("storm-wind-level").textContent = storm.windLevel;
  $("storm-wind-speed").textContent = storm.windSpeed;
  $("storm-observed-at").textContent = storm.observedAt;
  $("track-svg-title").textContent = `${storm.name}的虚构路径示意图`;
  renderTrack(storm);
}

function getSavedRegion() {
  try { return localStorage.getItem("demo-region"); } catch { return null; }
}

function saveRegion(region) {
  try { localStorage.setItem("demo-region", region); } catch { /* 页面仍可正常使用 */ }
}

const regionSelect = $("region-select");
const stormSelect = $("storm-select");
const savedRegion = getSavedRegion();
if (savedRegion && demoAlerts[savedRegion]) regionSelect.value = savedRegion;
renderAlert(regionSelect.value);
renderStorm(stormSelect.value);

regionSelect.addEventListener("change", () => {
  renderAlert(regionSelect.value);
  saveRegion(regionSelect.value);
});
stormSelect.addEventListener("change", () => renderStorm(stormSelect.value));
