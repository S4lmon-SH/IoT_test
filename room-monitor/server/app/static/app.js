const SVG_NS = "http://www.w3.org/2000/svg";
const DEVICE_ID = "room-uno-r4";

const state = {
  range: "1h",
  bucketSeconds: 60,
  points: [],
  current: null,
};

const elements = {
  temperature: document.querySelector("#temperature-value"),
  humidity: document.querySelector("#humidity-value"),
  temperatureRange: document.querySelector("#temperature-range"),
  humidityRange: document.querySelector("#humidity-range"),
  temperatureAverage: document.querySelector("#temperature-average"),
  humidityAverage: document.querySelector("#humidity-average"),
  readingCount: document.querySelector("#reading-count"),
  motionCount: document.querySelector("#motion-count"),
  comfort: document.querySelector("#comfort-value"),
  comfortDescription: document.querySelector("#comfort-description"),
  comfortMessage: document.querySelector("#comfort-message"),
  comfortScale: document.querySelectorAll(".comfort-scale span"),
  lastUpdated: document.querySelector("#last-updated"),
  connectionDot: document.querySelector("#connection-dot"),
  connectionLabel: document.querySelector("#connection-label"),
  headerTime: document.querySelector("#header-time"),
  sampleCount: document.querySelector("#sample-count"),
  deviceId: document.querySelector("#device-id"),
  chart: document.querySelector("#environment-chart"),
  chartWrap: document.querySelector("#chart-wrap"),
  chartEmpty: document.querySelector("#chart-empty"),
  tooltip: document.querySelector("#chart-tooltip"),
};

function setClock() {
  elements.headerTime.textContent = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }
  return Number(value).toFixed(digits);
}

function formatLocalDate(value, includeDate = false) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("ko-KR", {
    month: includeDate ? "short" : undefined,
    day: includeDate ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function relativeTime(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value)) / 1000));
  if (seconds < 10) return "방금 전";
  if (seconds < 60) return `${seconds}초 전`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
  return `${Math.floor(seconds / 86400)}일 전`;
}

function classifyComfort(temperature, humidity) {
  if (humidity >= 70) {
    return {
      label: "습함",
      detail: "환기가 필요할 수 있어요",
      message: "습도가 높게 측정되었습니다. 잠시 환기해 보세요.",
      level: 4,
    };
  }
  if (humidity < 30) {
    return {
      label: "건조",
      detail: "습도가 낮아요",
      message: "공기가 건조합니다. 수분 섭취와 적절한 가습을 권합니다.",
      level: 1,
    };
  }
  if (temperature >= 28) {
    return {
      label: "더움",
      detail: "온도가 높은 편이에요",
      message: "실내 온도가 높습니다. 환기나 냉방 상태를 확인하세요.",
      level: 5,
    };
  }
  if (temperature <= 18) {
    return {
      label: "서늘함",
      detail: "온도가 낮은 편이에요",
      message: "실내가 다소 서늘합니다. 적정 온도를 확인하세요.",
      level: 2,
    };
  }
  return {
    label: "쾌적",
    detail: "좋은 상태를 유지 중이에요",
    message: "현재 온도와 습도가 편안한 범위에 있습니다.",
    level: 3,
  };
}

function updateConnection(current) {
  elements.connectionDot.classList.remove(
    "is-online",
    "is-offline",
    "is-waiting",
  );

  if (!current) {
    elements.connectionDot.classList.add("is-waiting");
    elements.connectionLabel.textContent = "데이터 기다리는 중";
    return;
  }

  const ageSeconds = (Date.now() - new Date(current.recorded_at)) / 1000;
  const isOnline = ageSeconds < 180;
  elements.connectionDot.classList.add(isOnline ? "is-online" : "is-offline");
  elements.connectionLabel.textContent = isOnline
    ? "센서 온라인"
    : "센서 연결 끊김";
}

function updateCurrent(current) {
  state.current = current;
  updateConnection(current);
  if (!current) return;

  elements.temperature.textContent = formatNumber(current.temperature, 1);
  elements.humidity.textContent = formatNumber(current.humidity, 0);
  elements.deviceId.textContent = current.device_id;
  elements.lastUpdated.textContent = `마지막 업데이트 ${relativeTime(
    current.recorded_at,
  )} · ${formatLocalDate(current.recorded_at, true)}`;

  const comfort = classifyComfort(current.temperature, current.humidity);
  elements.comfort.textContent = comfort.label;
  elements.comfortDescription.textContent = comfort.detail;
  elements.comfortMessage.textContent = comfort.message;
  elements.comfortScale.forEach((bar, index) => {
    bar.classList.toggle("is-active", index < comfort.level);
  });
}

function updateSummary(summary) {
  if (!summary || !summary.sample_count) return;

  elements.temperatureRange.textContent =
    `최저 ${formatNumber(summary.temperature_min)}° · ` +
    `최고 ${formatNumber(summary.temperature_max)}°`;
  elements.humidityRange.textContent =
    `최저 ${formatNumber(summary.humidity_min, 0)}% · ` +
    `최고 ${formatNumber(summary.humidity_max, 0)}%`;
  elements.temperatureAverage.textContent =
    `${formatNumber(summary.temperature_avg)}°`;
  elements.humidityAverage.textContent =
    `${formatNumber(summary.humidity_avg, 0)}%`;
  elements.readingCount.textContent = summary.sample_count.toLocaleString("ko-KR");
  elements.motionCount.textContent = summary.motion_count
    ? `${summary.motion_count.toLocaleString("ko-KR")}회`
    : "사용 안 함";
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  return node;
}

function scaleExtent(values, minimumSpan, lowerBound, upperBound) {
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  const center = (minimum + maximum) / 2;
  const span = Math.max(maximum - minimum, minimumSpan);
  minimum = center - span / 2;
  maximum = center + span / 2;
  const padding = span * 0.18;
  return [
    Math.max(lowerBound, minimum - padding),
    Math.min(upperBound, maximum + padding),
  ];
}

function pathFor(points, xFor, yFor) {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xFor(index).toFixed(2)},${yFor(point).toFixed(2)}`;
    })
    .join(" ");
}

function formatBucket(bucketSeconds) {
  if (bucketSeconds < 3600) {
    return `${Math.round(bucketSeconds / 60)}분 간격`;
  }
  return `${Math.round(bucketSeconds / 3600)}시간 평균`;
}

function nearestPointIndex(times, targetTime) {
  let low = 0;
  let high = times.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < targetTime) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  if (low === 0) return 0;
  return targetTime - times[low - 1] <= times[low] - targetTime
    ? low - 1
    : low;
}

function renderChart(points, bucketSeconds = state.bucketSeconds) {
  state.points = points;
  state.bucketSeconds = bucketSeconds;
  elements.chart.innerHTML = "";
  elements.tooltip.hidden = true;
  elements.sampleCount.textContent =
    `${formatBucket(bucketSeconds)} · ` +
    `${points.length.toLocaleString("ko-KR")}개 측정값`;

  if (!points.length) {
    elements.chartEmpty.hidden = false;
    return;
  }
  elements.chartEmpty.hidden = true;

  const width = Math.max(320, Math.round(elements.chartWrap.clientWidth));
  const height = Math.max(260, Math.round(elements.chartWrap.clientHeight));
  const compact = width < 600;
  const margin = compact
    ? { top: 18, right: 38, bottom: 38, left: 38 }
    : { top: 20, right: 54, bottom: 42, left: 54 };
  elements.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const pointTimes = points.map((point) => new Date(point.recorded_at).getTime());
  const timeStart = pointTimes[0];
  const timeEnd = pointTimes[pointTimes.length - 1];
  const timeSpan = Math.max(1, timeEnd - timeStart);
  const xFor = (index) => margin.left +
    ((pointTimes[index] - timeStart) / timeSpan) * plotWidth;

  const temperatures = points.map((point) => point.temperature);
  const humidities = points.map((point) => point.humidity);
  const [tempMin, tempMax] = scaleExtent(temperatures, 4, -40, 80);
  const [humidityMin, humidityMax] = scaleExtent(humidities, 20, 0, 100);
  const temperatureY = (point) =>
    margin.top +
    ((tempMax - point.temperature) / (tempMax - tempMin)) * plotHeight;
  const humidityY = (point) =>
    margin.top +
    ((humidityMax - point.humidity) / (humidityMax - humidityMin)) * plotHeight;

  const definitions = svgElement("defs");
  const temperatureGradient = svgElement("linearGradient", {
    id: "temperature-gradient",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  temperatureGradient.append(
    svgElement("stop", {
      offset: "0%",
      "stop-color": "#ef6b45",
      "stop-opacity": "0.16",
    }),
    svgElement("stop", {
      offset: "100%",
      "stop-color": "#ef6b45",
      "stop-opacity": "0",
    }),
  );
  const humidityGradient = svgElement("linearGradient", {
    id: "humidity-gradient",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1",
  });
  humidityGradient.append(
    svgElement("stop", {
      offset: "0%",
      "stop-color": "#448bc5",
      "stop-opacity": "0.11",
    }),
    svgElement("stop", {
      offset: "100%",
      "stop-color": "#448bc5",
      "stop-opacity": "0",
    }),
  );
  definitions.append(temperatureGradient, humidityGradient);
  elements.chart.append(definitions);

  for (let index = 0; index <= 4; index += 1) {
    const y = margin.top + (index / 4) * plotHeight;
    elements.chart.append(
      svgElement("line", {
        x1: margin.left,
        x2: width - margin.right,
        y1: y,
        y2: y,
        class: "chart-grid",
      }),
    );

    const tempLabel = svgElement("text", {
      x: margin.left - 12,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    tempLabel.textContent =
      `${(tempMax - (index / 4) * (tempMax - tempMin)).toFixed(0)}°`;
    const humidityLabel = svgElement("text", {
      x: width - margin.right + 12,
      y: y + 4,
      "text-anchor": "start",
      class: "chart-axis-label",
    });
    humidityLabel.textContent =
      `${(humidityMax - (index / 4) * (humidityMax - humidityMin)).toFixed(0)}%`;
    elements.chart.append(tempLabel, humidityLabel);
  }

  const labelRatios = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const labelIndexes = [...new Set(labelRatios.map(
    (ratio) => Math.round(ratio * (points.length - 1)),
  ))];
  labelIndexes.forEach((index) => {
    const label = svgElement("text", {
      x: xFor(index),
      y: height - 12,
      "text-anchor":
        index === 0 ? "start" : index === points.length - 1 ? "end" : "middle",
      class: "chart-axis-label",
    });
    label.textContent = formatLocalDate(
      points[index].recorded_at,
      state.range !== "24h",
    );
    elements.chart.append(label);
  });

  const temperaturePath = pathFor(points, xFor, temperatureY);
  const humidityPath = pathFor(points, xFor, humidityY);
  const baseY = margin.top + plotHeight;

  elements.chart.append(
    svgElement("path", {
      d: `${temperaturePath} L${xFor(points.length - 1)},${baseY} ` +
        `L${xFor(0)},${baseY} Z`,
      class: "chart-area-temperature",
    }),
    svgElement("path", {
      d: `${humidityPath} L${xFor(points.length - 1)},${baseY} ` +
        `L${xFor(0)},${baseY} Z`,
      class: "chart-area-humidity",
    }),
    svgElement("path", {
      d: temperaturePath,
      class: "chart-line chart-line-temperature",
    }),
    svgElement("path", {
      d: humidityPath,
      class: "chart-line chart-line-humidity",
    }),
  );

  const interactionGroup = svgElement("g");
  const crosshair = svgElement("line", {
    y1: margin.top,
    y2: baseY,
    class: "chart-crosshair",
    visibility: "hidden",
  });
  const temperaturePoint = svgElement("circle", {
    r: 5,
    fill: "#ef6b45",
    class: "chart-point",
    visibility: "hidden",
  });
  const humidityPoint = svgElement("circle", {
    r: 5,
    fill: "#448bc5",
    class: "chart-point",
    visibility: "hidden",
  });
  const overlay = svgElement("rect", {
    x: margin.left,
    y: margin.top,
    width: plotWidth,
    height: plotHeight,
    fill: "transparent",
  });
  interactionGroup.append(crosshair, temperaturePoint, humidityPoint, overlay);
  elements.chart.append(interactionGroup);

  const hideTooltip = () => {
    crosshair.setAttribute("visibility", "hidden");
    temperaturePoint.setAttribute("visibility", "hidden");
    humidityPoint.setAttribute("visibility", "hidden");
    elements.tooltip.hidden = true;
  };

  const showTooltip = (event) => {
    const bounds = elements.chart.getBoundingClientRect();
    const relativeX = Math.min(
      plotWidth,
      Math.max(0, ((event.clientX - bounds.left) / bounds.width) * width - margin.left),
    );
    const targetTime = timeStart + (relativeX / plotWidth) * timeSpan;
    const index = nearestPointIndex(
      pointTimes,
      targetTime,
    );
    const point = points[index];
    const x = xFor(index);
    const tY = temperatureY(point);
    const hY = humidityY(point);

    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.setAttribute("visibility", "visible");
    temperaturePoint.setAttribute("cx", x);
    temperaturePoint.setAttribute("cy", tY);
    temperaturePoint.setAttribute("visibility", "visible");
    humidityPoint.setAttribute("cx", x);
    humidityPoint.setAttribute("cy", hY);
    humidityPoint.setAttribute("visibility", "visible");

    elements.tooltip.innerHTML = `
      <time>${formatLocalDate(point.recorded_at, true)}</time>
      <div><span>온도</span><strong>${formatNumber(point.temperature)}°C</strong></div>
      <div><span>습도</span><strong>${formatNumber(point.humidity, 0)}%</strong></div>
    `;
    elements.tooltip.hidden = false;
    elements.tooltip.style.left = `${(x / width) * 100}%`;
    elements.tooltip.style.top = `${(Math.min(tY, hY) / height) * 100}%`;
  };

  overlay.addEventListener("pointermove", showTooltip);
  overlay.addEventListener("pointerdown", showTooltip);
  overlay.addEventListener("pointerleave", hideTooltip);
}

async function requestJson(path, allowNotFound = false) {
  const response = await fetch(path, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function refreshDashboard() {
  try {
    const [current, summary, history] = await Promise.all([
      requestJson(`/api/v1/current?device_id=${DEVICE_ID}`, true),
      requestJson(`/api/v1/summary?device_id=${DEVICE_ID}&hours=24`),
      requestJson(
        `/api/v1/history?device_id=${DEVICE_ID}&range=${state.range}`,
      ),
    ]);
    updateCurrent(current);
    updateSummary(summary);
    renderChart(history.points, history.bucket_seconds);
  } catch (error) {
    console.error("대시보드를 불러오지 못했습니다.", error);
    elements.connectionDot.classList.remove("is-online", "is-waiting");
    elements.connectionDot.classList.add("is-offline");
    elements.connectionLabel.textContent = "서버 연결 오류";
  }
}

document.querySelectorAll(".range-button").forEach((button) => {
  button.addEventListener("click", async () => {
    document
      .querySelectorAll(".range-button")
      .forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    state.range = button.dataset.range;
    try {
      const history = await requestJson(
        `/api/v1/history?device_id=${DEVICE_ID}&range=${state.range}`,
      );
      renderChart(history.points, history.bucket_seconds);
    } catch (error) {
      console.error("그래프를 불러오지 못했습니다.", error);
    }
  });
});

setClock();
setInterval(setClock, 30_000);
refreshDashboard();
setInterval(refreshDashboard, 60_000);

let chartResizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(
    () => renderChart(state.points, state.bucketSeconds),
    120,
  );
});
