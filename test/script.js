const canvas = document.getElementById("oddsChart");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
const matchTitle = document.getElementById("matchTitle");
const scoreBox = document.getElementById("scoreBox");
const legend = document.getElementById("legend");
const rangeLabel = document.getElementById("rangeLabel");
const eventsList = document.getElementById("eventsList");

const series = [
  { key: "homePct", label: "Home", color: "#1b77c5" },
  { key: "drawPct", label: "Draw", color: "#7a8491" },
  { key: "awayPct", label: "Away", color: "#d04a3a" },
];

let chartState = null;

fetch("match-data.txt")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load match-data.txt (${response.status})`);
    }
    return response.json();
  })
  .then((data) => {
    chartState = prepareChart(data);
    renderPage(data, chartState);
    drawChart(chartState);
  })
  .catch((error) => {
    matchTitle.textContent = "Unable to load match data";
    eventsList.innerHTML = `<p class="error">${error.message}. Run this folder through a local server so the browser can fetch the data file.</p>`;
  });

function prepareChart(data) {
  const cleanOdds = (data.oddsHistory || [])
    .map((point, index) => ({
      ...point,
      index,
      date: new Date(point.timestamp),
      hasValidDate: new Date(point.timestamp).getFullYear() > 2000,
    }))
    .filter((point) => {
      return (
        Number.isFinite(point.homePct) &&
        Number.isFinite(point.drawPct) &&
        Number.isFinite(point.awayPct)
      );
    });

  if (cleanOdds.length === 0) {
    throw new Error("No valid odds history points found");
  }

  const validDates = cleanOdds.filter((point) => point.hasValidDate);
  const maxPct = Math.ceil(Math.max(...cleanOdds.flatMap((point) => series.map((item) => point[item.key]))) / 10) * 10;
  const plottedEvents = (data.events || [])
    .map((event) => ({ ...event, date: new Date(event.timestamp) }))
    .filter((event) => event.date.getFullYear() > 2000);

  return {
    data,
    odds: cleanOdds,
    events: plottedEvents,
    minIndex: cleanOdds[0].index,
    maxIndex: cleanOdds[cleanOdds.length - 1].index,
    validStartDate: validDates[0]?.date,
    validEndDate: validDates.at(-1)?.date,
    minPct: 0,
    maxPct: Math.max(100, maxPct),
    padding: { top: 24, right: 28, bottom: 58, left: 58 },
    points: [],
  };
}

function renderPage(data, state) {
  matchTitle.textContent = `${data.homeName} vs ${data.awayName}`;
  series[0].label = data.homeName || "Home";
  series[2].label = data.awayName || "Away";

  const latestEvent = [...(data.events || [])].reverse().find((event) => Number.isFinite(event.homeScore) && Number.isFinite(event.awayScore));
  scoreBox.textContent = latestEvent ? `${latestEvent.homeScore} - ${latestEvent.awayScore}` : "--";

  rangeLabel.textContent = state.validStartDate && state.validEndDate
    ? `${formatDateTime(state.validStartDate)} to ${formatDateTime(state.validEndDate)} · ${state.odds.length} points`
    : `${state.odds.length} points`;

  legend.innerHTML = series
    .map((item) => `<span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>${item.label}</span>`)
    .join("");

  renderEvents(data.events || []);
}

function renderEvents(events) {
  if (events.length === 0) {
    eventsList.innerHTML = `<p class="empty">No match events available.</p>`;
    return;
  }

  eventsList.innerHTML = events
    .map((event) => {
      const time = event.timestamp ? formatDateTime(new Date(event.timestamp)) : "Unknown time";
      return `
        <article class="event">
          <p class="event-title">${titleCase(event.eventType || "event")} at ${event.minute || "?"}'</p>
          <p class="event-meta">${event.phase || "Match"} · ${event.homeScore ?? "-"} - ${event.awayScore ?? "-"}<br>${time}</p>
        </article>
      `;
    })
    .join("");
}

function drawChart(state) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const plot = {
    left: state.padding.left,
    top: state.padding.top,
    right: width - state.padding.right,
    bottom: height - state.padding.bottom,
  };
  plot.width = plot.right - plot.left;
  plot.height = plot.bottom - plot.top;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  drawGrid(state, plot);
  drawEventMarkers(state, plot);
  state.points = [];
  series.forEach((item) => drawLine(state, plot, item));
  drawAxes(state, plot);
}

function drawGrid(state, plot) {
  ctx.strokeStyle = "#dde5ec";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#627386";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let pct = state.minPct; pct <= state.maxPct; pct += 10) {
    const y = yScale(state, plot, pct);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.fillText(`${pct}%`, plot.left - 10, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const ticks = 5;
  for (let i = 0; i <= ticks; i += 1) {
    const ratio = i / ticks;
    const index = Math.round(state.minIndex + (state.maxIndex - state.minIndex) * ratio);
    const point = nearestPointByIndex(state.odds, index);
    const x = plot.left + plot.width * ratio;
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    ctx.fillText(formatAxisLabel(point), x, plot.bottom + 14);
  }
}

function drawAxes(state, plot) {
  ctx.strokeStyle = "#93a1af";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
}

function drawLine(state, plot, item) {
  ctx.strokeStyle = item.color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  state.odds.forEach((point, index) => {
    const x = xScale(state, plot, point.index);
    const y = yScale(state, plot, point[item.key]);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    state.points.push({ x, y, point, item });
  });

  ctx.stroke();

  const last = state.odds[state.odds.length - 1];
  const lastX = xScale(state, plot, last.index);
  const lastY = yScale(state, plot, last[item.key]);
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawEventMarkers(state, plot) {
  const datedOdds = state.odds.filter((point) => point.hasValidDate);
  state.events.forEach((event) => {
    const eventTime = event.date.getTime();
    const nearest = datedOdds.reduce((closest, point) => {
      const distance = Math.abs(point.date.getTime() - eventTime);
      if (!closest || distance < closest.distance) return { point, distance };
      return closest;
    }, null);
    if (!nearest) return;

    const x = xScale(state, plot, nearest.point.index);
    ctx.strokeStyle = "#1f9d55";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#1f9d55";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${event.minute || "?"}' goal`, x, plot.top - 4);
  });
}

function xScale(state, plot, index) {
  const span = state.maxIndex - state.minIndex || 1;
  return plot.left + ((index - state.minIndex) / span) * plot.width;
}

function yScale(state, plot, value) {
  const span = state.maxPct - state.minPct || 1;
  return plot.bottom - ((value - state.minPct) / span) * plot.height;
}

canvas.addEventListener("mousemove", (event) => {
  if (!chartState || chartState.points.length === 0) return;

  const bounds = canvas.getBoundingClientRect();
  const mouseX = event.clientX - bounds.left;
  const mouseY = event.clientY - bounds.top;
  let nearest = null;
  let nearestDistance = Infinity;

  chartState.points.forEach((candidate) => {
    const distance = Math.hypot(candidate.x - mouseX, candidate.y - mouseY);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  });

  if (!nearest || nearestDistance > 28) {
    tooltip.hidden = true;
    return;
  }

  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(mouseX + 16, bounds.width - 220)}px`;
  tooltip.style.top = `${Math.max(mouseY - 58, 8)}px`;
  tooltip.innerHTML = `
    <strong>${nearest.item.label}: ${nearest.point[nearest.item.key]}%</strong>
    Home: ${nearest.point.homePct}%<br>
    Draw: ${nearest.point.drawPct}%<br>
    Away: ${nearest.point.awayPct}%<br>
    ${nearest.point.hasValidDate ? formatDateTime(nearest.point.date) : `Point ${nearest.point.index + 1}`}
  `;
});

canvas.addEventListener("mouseleave", () => {
  tooltip.hidden = true;
});

window.addEventListener("resize", () => {
  if (chartState) drawChart(chartState);
});

function formatDateTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
  }).format(date);
}

function formatAxisLabel(point) {
  if (!point) return "";
  return point.hasValidDate ? formatShortDate(point.date) : `Point ${point.index + 1}`;
}

function nearestPointByIndex(points, index) {
  return points.reduce((closest, point) => {
    if (!closest || Math.abs(point.index - index) < Math.abs(closest.index - index)) {
      return point;
    }
    return closest;
  }, null);
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
