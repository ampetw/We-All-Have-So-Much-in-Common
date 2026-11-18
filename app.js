const STORAGE_KEY = "wahsmic-tickets-v3";

const DEFAULT_OMBRE = {
  start: "#e9ca30",
  end: "#e4451a",
};

const DEFAULT_TYPE_COLOR = "#000000";

const seedTickets = [
  {
    id: 1,
    place: "Kitchen",
    date: "03/12/2014",
    passenger: "Maya",
    memory:
      "Sitting on the linoleum while someone cooked, not talking, just being in the same room.",
    ombreStart: "#f6e44a",
    ombreEnd: "#e4451a",
    code: "maya2014",
  },
  {
    id: 2,
    place: "Night",
    date: "04/02/2019",
    passenger: "Jonah",
    memory:
      "The specific quiet of a car at night when you are not the one driving.",
    ombreStart: "#7ec8ff",
    ombreEnd: "#123a8c",
    code: "jonah2019",
  },
  {
    id: 3,
    place: "Hallway",
    date: "05/19/2021",
    passenger: "Priya",
    memory:
      "Calling just to hear a voice, then forgetting what I meant to say.",
    ombreStart: "#ffb3d4",
    ombreEnd: "#d10f63",
    code: "priya2021",
  },
  {
    id: 4,
    place: "Bus 14",
    date: "06/08/2018",
    passenger: "Leo",
    memory:
      "Sharing a pair of wired earbuds, pretending the song was for both of us.",
    ombreStart: "#d7b3ff",
    ombreEnd: "#5b1a96",
    code: "leo2018",
  },
];

const views = {
  home: document.getElementById("home"),
  new: document.getElementById("new"),
  community: document.getElementById("community"),
  ticket: document.getElementById("ticket-view"),
  memory: document.getElementById("memory"),
};

const form = document.getElementById("ticket-form");
const preview = document.getElementById("ticket-preview");
const grid = document.getElementById("ticket-grid");
const ticketFull = document.getElementById("ticket-full");
const communityPrev = document.querySelector("[data-community-prev]");
const communityNext = document.querySelector("[data-community-next]");
const COMMUNITY_PAGE_SIZE = 2;
let communityPage = 0;
let communityAnimating = false;
const startGroup = document.getElementById("cmyk-start");
const endGroup = document.getElementById("cmyk-end");
const typeGroup = document.getElementById("cmyk-type");
const editorQr = document.getElementById("editor-qr");
const addMediaLink = document.getElementById("add-media");
const memoryView = document.getElementById("memory");
const qrPixels = new WeakMap();

const placeStub = document.getElementById("place-stub");
const placeMain = document.getElementById("place-main");
const dateStub = document.getElementById("date-stub");
const dateMain = document.getElementById("date-main");
const passengerStub = document.getElementById("passenger-stub");
const passengerMain = document.getElementById("passenger-main");
const memoryInput = document.getElementById("ticket-memory");
const DATE_KEYS = ["mm", "dd", "year"];
const DATE_MAX = { mm: 2, dd: 2, year: 4 };

function makeCode() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

let shareOrigin = location.origin.replace(/\/$/, "");

function ticketLink(code) {
  return `${shareOrigin}/m/${encodeURIComponent(code)}`;
}

async function loadShareOrigin() {
  try {
    const response = await fetch("/api/origin");
    if (!response.ok) return;
    const data = await response.json();
    if (data.origin) shareOrigin = String(data.origin).replace(/\/$/, "");
  } catch {
    /* static server fallback */
  }
}

function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedTickets));
      return [...seedTickets];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return [...seedTickets];
    const tickets = parsed.map(normalizeTicket);
    if (tickets.some((ticket, index) => ticket.code !== parsed[index]?.code)) {
      saveTickets(tickets);
    }
    return tickets;
  } catch {
    return [...seedTickets];
  }
}

function normalizeTicket(ticket, index) {
  return {
    id: ticket.id || index + 1,
    place: ticket.place || ticket.destination || "",
    date: ticket.date || ticket.createdAt || "",
    passenger: ticket.passenger || ticket.name || "",
    memory: ticket.memory || "",
    ombreStart: ticket.ombreStart || DEFAULT_OMBRE.start,
    ombreEnd: ticket.ombreEnd || DEFAULT_OMBRE.end,
    typeColor: ticket.typeColor || DEFAULT_TYPE_COLOR,
    code: ticket.code || makeCode(),
  };
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hexToRgb(hex) {
  const value = hex.replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const n = parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b]
      .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToCmyk({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const k = 1 - Math.max(red, green, blue);
  if (k >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - red - k) / (1 - k)) * 100),
    m: Math.round(((1 - green - k) / (1 - k)) * 100),
    y: Math.round(((1 - blue - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === red) h = ((green - blue) / d) % 6;
    else if (max === green) h = (blue - red) / d + 2;
    else h = (red - green) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h,
    s: max === 0 ? 0 : d / max,
    v: max,
  };
}

function bindDrag(element, onMove) {
  const move = (event) => onMove(event);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    onMove(event);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function createPicker(group) {
  const svCanvas = group.querySelector("[data-sv]");
  const hueCanvas = group.querySelector("[data-hue]");
  const svCursor = group.querySelector("[data-sv-cursor]");
  const hueCursor = group.querySelector("[data-hue-cursor]");
  const readout = group.querySelector("[data-readout]");
  const trigger = group.querySelector("[data-trigger]");
  const svCtx = svCanvas.getContext("2d");
  const hueCtx = hueCanvas.getContext("2d");
  const state = { h: 40, s: 0.8, v: 0.9 };

  function getHex() {
    return rgbToHex(hsvToRgb(state.h, state.s, state.v));
  }

  function drawHue() {
    const { width: w, height: h } = hueCanvas;
    const grad = hueCtx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 6; i += 1) {
      const rgb = hsvToRgb(i * 60, 1, 1);
      grad.addColorStop(i / 6, `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    }
    hueCtx.fillStyle = grad;
    hueCtx.fillRect(0, 0, w, h);
  }

  function drawSV() {
    const { width: w, height: h } = svCanvas;
    const hue = hsvToRgb(state.h, 1, 1);
    const across = svCtx.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, "#ffffff");
    across.addColorStop(1, `rgb(${hue.r}, ${hue.g}, ${hue.b})`);
    svCtx.fillStyle = across;
    svCtx.fillRect(0, 0, w, h);
    const down = svCtx.createLinearGradient(0, 0, 0, h);
    down.addColorStop(0, "rgba(0,0,0,0)");
    down.addColorStop(1, "#000000");
    svCtx.fillStyle = down;
    svCtx.fillRect(0, 0, w, h);
  }

  function updateChrome() {
    const hex = getHex();
    const cmyk = rgbToCmyk(hexToRgb(hex));
    readout.textContent = `C ${cmyk.c}   M ${cmyk.m}   Y ${cmyk.y}   K ${cmyk.k}`;
    trigger.style.setProperty("--swatch", hex);
    svCursor.style.left = `${state.s * 100}%`;
    svCursor.style.top = `${(1 - state.v) * 100}%`;
    hueCursor.style.top = `${(state.h / 360) * 100}%`;
  }

  function redraw() {
    drawSV();
    updateChrome();
  }

  function pickSV(event) {
    const box = svCanvas.getBoundingClientRect();
    state.s = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    state.v = Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height));
    updateChrome();
    syncTicket();
  }

  function pickHue(event) {
    const box = hueCanvas.getBoundingClientRect();
    state.h = Math.min(359, Math.max(0, ((event.clientY - box.top) / box.height) * 360));
    redraw();
    syncTicket();
  }

  bindDrag(svCanvas, pickSV);
  bindDrag(hueCanvas, pickHue);

  function showGraph() {
    requestAnimationFrame(() => {
      drawHue();
      redraw();
    });
  }

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !group.classList.contains("is-open");
    document.querySelectorAll(".cmyk-group.is-open").forEach((el) => {
      el.classList.remove("is-open");
      el.querySelector("[data-trigger]")?.setAttribute("aria-expanded", "false");
    });
    group.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen) showGraph();
  });

  group.addEventListener("mouseenter", showGraph);

  document.addEventListener("pointerdown", (event) => {
    if (!group.contains(event.target)) {
      group.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  function setHex(hex) {
    const hsv = rgbToHsv(hexToRgb(hex));
    state.h = hsv.h;
    state.s = hsv.s;
    state.v = hsv.v;
    redraw();
  }

  drawHue();
  redraw();

  return { getHex, setHex, redraw };
}

function currentOmbre() {
  return {
    start: startPicker.getHex(),
    end: endPicker.getHex(),
  };
}

function syncTicket() {
  const { start, end } = currentOmbre();
  const typeColor = typePicker.getHex();
  preview.style.setProperty("--ombre-start", start);
  preview.style.setProperty("--ombre-end", end);
  preview.style.setProperty("--type-color", typeColor);
  const holder = editorQr?.querySelector("[data-qr]");
  if (holder && qrPixels.has(holder)) tintQr(holder, typeColor);
}

function applyOmbre(start, end) {
  startPicker.setHex(start);
  endPicker.setHex(end);
  syncTicket();
}

function tintQr(holder, color) {
  const cached = qrPixels.get(holder);
  if (!cached) return;
  const { r, g, b } = hexToRgb(color || DEFAULT_TYPE_COLOR);
  const src = cached.pixels.data;
  const ctx = cached.canvas.getContext("2d");
  const out = ctx.createImageData(cached.pixels.width, cached.pixels.height);
  const dest = out.data;
  for (let i = 0; i < src.length; i += 4) {
    if (src[i] < 140) {
      dest[i] = r;
      dest[i + 1] = g;
      dest[i + 2] = b;
      dest[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

function paintQr(holder, url, color) {
  if (!holder || typeof QRCode === "undefined") return;
  const cached = qrPixels.get(holder);
  if (!cached || cached.url !== url) {
    holder.innerHTML = "";
    const mount = document.createElement("div");
    new QRCode(mount, {
      text: url,
      width: 160,
      height: 160,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
    const source = mount.querySelector("canvas");
    if (!source) return;
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0);
    qrPixels.set(holder, {
      url,
      canvas,
      pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
    });
    holder.appendChild(canvas);
  }
  tintQr(holder, color || DEFAULT_TYPE_COLOR);
}

function snapshotEditor() {
  return {
    code: editorCode,
    place: placeStub.value.trim().toUpperCase(),
    date: getDateValue(),
    passenger: passengerStub.value.trim().toUpperCase(),
    memory: memoryInput.value.trim(),
    ombreStart: currentOmbre().start,
    ombreEnd: currentOmbre().end,
    typeColor: typePicker.getHex(),
  };
}

function bindAddMedia() {
  addMediaLink.addEventListener("click", () => {
    sessionStorage.setItem(`wahsmic-draft-${editorCode}`, JSON.stringify(snapshotEditor()));
  });
}

function refreshEditorQr() {
  addMediaLink.href = `/#/m/${editorCode}/edit`;
  const url = ticketLink(editorCode);
  editorQr.dataset.url = url;
  paintQr(editorQr.querySelector("[data-qr]"), url, typePicker.getHex());
}

const memoryEls = {
  back: document.querySelector("[data-memory-back]"),
  title: document.querySelector("[data-memory-title]"),
  meta: document.querySelector("[data-memory-meta]"),
  addText: document.querySelector("[data-add-text]"),
  addVoice: document.querySelector("[data-add-voice]"),
  addFile: document.querySelector("[data-add-file]"),
  fileInput: document.querySelector("[data-file-input]"),
  status: document.querySelector("[data-memory-status]"),
  list: document.querySelector("[data-memory-list]"),
  empty: document.querySelector("[data-memory-empty]"),
  save: document.querySelector("[data-memory-save]"),
};

let currentMemoryCode = "";
let memoryEditable = false;
let memoryItems = [];
let activeStream = null;
let activeRecorder = null;
let objectUrls = [];

function itemId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function forgetObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function useObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
}

function setMemoryStatus(message) {
  memoryEls.status.hidden = !message;
  memoryEls.status.textContent = message || "";
}

function setVoiceButton(recording) {
  memoryEls.addVoice.textContent = recording ? "stop recording" : "add voice memo";
  memoryEls.addVoice.classList.toggle("is-recording", recording);
}

function stopActiveMedia() {
  if (activeRecorder && activeRecorder.state !== "inactive") {
    try {
      activeRecorder.stop();
    } catch {
      /* already stopped */
    }
  }
  activeRecorder = null;
  if (activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
  }
  setVoiceButton(false);
}

function findTicketByCode(code) {
  const saved = loadTickets().find((ticket) => ticket.code === code);
  if (saved) return saved;
  try {
    const draft = sessionStorage.getItem(`wahsmic-draft-${code}`);
    return draft ? JSON.parse(draft) : null;
  } catch {
    return null;
  }
}

function mediaSrc(code, filename) {
  return `/media/${encodeURIComponent(code)}/${encodeURIComponent(filename)}`;
}

function emptyMedia(code) {
  return {
    code,
    place: "",
    passenger: "",
    date: "",
    memory: "",
    ombreStart: DEFAULT_OMBRE.start,
    ombreEnd: DEFAULT_OMBRE.end,
    typeColor: DEFAULT_TYPE_COLOR,
    texts: [],
    voices: [],
    files: [],
  };
}

async function fetchSavedMedia(code) {
  try {
    const response = await fetch(`/api/media/${encodeURIComponent(code)}`);
    if (response.status === 404) return emptyMedia(code);
    if (!response.ok) return emptyMedia(code);
    return await response.json();
  } catch {
    return emptyMedia(code);
  }
}

function itemsFromSaved(saved) {
  const items = [];
  (saved.texts || []).forEach((text) => {
    items.push({ kind: "text", id: text.id || itemId("t"), body: text.body || "" });
  });
  (saved.voices || []).forEach((voice) => {
    items.push({
      kind: "voice",
      id: voice.id || itemId("v"),
      src: voice.filename ? mediaSrc(saved.code, voice.filename) : "",
      type: voice.type || "audio/webm",
      blob: null,
    });
  });
  (saved.files || []).forEach((file) => {
    items.push({
      kind: "file",
      id: file.id || itemId("f"),
      name: file.name || "Attachment",
      type: file.type || "",
      src: file.filename ? mediaSrc(saved.code, file.filename) : "",
      blob: null,
    });
  });
  return items;
}

function applyMemoryChrome(ticket) {
  memoryView.style.setProperty("--ombre-start", ticket?.ombreStart || DEFAULT_OMBRE.start);
  memoryView.style.setProperty("--ombre-end", ticket?.ombreEnd || DEFAULT_OMBRE.end);
  memoryView.style.setProperty("--type-color", ticket?.typeColor || DEFAULT_TYPE_COLOR);
  memoryEls.title.textContent = ticket?.place || "New memory";
  memoryEls.meta.textContent = [ticket?.passenger, ticket?.date].filter(Boolean).join(" · ");
}

function renderMemoryList() {
  memoryEls.list.innerHTML = "";
  memoryItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "memory-item";
    row.dataset.id = item.id;
    if (item.kind === "text") {
      if (memoryEditable) {
        const field = document.createElement("textarea");
        field.rows = 6;
        field.maxLength = 2000;
        field.placeholder = "Write more here";
        field.value = item.body || "";
        field.addEventListener("input", () => {
          item.body = field.value;
        });
        row.appendChild(field);
      } else {
        const text = document.createElement("p");
        text.className = "memory-item-text";
        text.textContent = item.body || "";
        row.appendChild(text);
      }
    } else if (item.kind === "voice") {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = item.src || (item.blob ? useObjectUrl(item.blob) : "");
      row.appendChild(audio);
    } else if (item.kind === "file") {
      const href = item.src || (item.blob ? useObjectUrl(item.blob) : "#");
      if ((item.type || "").startsWith("image/")) {
        const image = document.createElement("img");
        image.className = "memory-file-preview";
        image.alt = memoryEditable ? "Attachment" : "";
        image.src = href;
        row.appendChild(image);
      }
      if (!memoryEditable) {
        const link = document.createElement("a");
        link.className = "memory-file-link";
        link.href = href;
        link.download = item.name || "attachment";
        link.textContent = item.name || "Attachment";
        row.appendChild(link);
      }
    }
    if (memoryEditable) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "memory-remove";
      remove.textContent = "remove";
      remove.addEventListener("click", () => {
        memoryItems = memoryItems.filter((entry) => entry.id !== item.id);
        renderMemoryList();
      });
      row.appendChild(remove);
    }
    memoryEls.list.appendChild(row);
  });
  memoryEls.empty.hidden = memoryItems.length > 0 || memoryEditable;
}

async function openMemoryPage(code, editable) {
  stopActiveMedia();
  forgetObjectUrls();
  currentMemoryCode = code;
  memoryEditable = Boolean(editable);
  const saved = await fetchSavedMedia(code);
  const ticket = findTicketByCode(code) || saved;
  const published = loadTickets().some((item) => item.code === code);
  applyMemoryChrome(ticket);
  memoryView.classList.toggle("is-editable", memoryEditable);
  memoryEls.back.href = published ? "/#/community" : "/#/new";
  memoryEls.save.textContent = "Save";
  setMemoryStatus("");
  memoryItems = itemsFromSaved(saved);
  renderMemoryList();
}

async function startVoiceMemo() {
  if (!memoryEditable) return;
  if (activeRecorder && activeRecorder.state === "recording") {
    stopActiveMedia();
    return;
  }
  stopActiveMedia();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  activeStream = stream;
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  const chunks = [];
  activeRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  setVoiceButton(true);
  activeRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  activeRecorder.addEventListener("stop", () => {
    stream.getTracks().forEach((track) => track.stop());
    if (activeStream === stream) activeStream = null;
    setVoiceButton(false);
    const blob = new Blob(chunks, { type: activeRecorder?.mimeType || mimeType || chunks[0]?.type || "audio/webm" });
    activeRecorder = null;
    if (!blob.size) return;
    memoryItems.push({
      kind: "voice",
      id: itemId("v"),
      blob,
      type: blob.type,
      src: "",
    });
    renderMemoryList();
  });
  activeRecorder.start();
}

function collectTextBodies() {
  memoryEls.list.querySelectorAll(".memory-item textarea").forEach((field) => {
    const item = memoryItems.find((entry) => entry.id === field.closest(".memory-item")?.dataset.id);
    if (item && item.kind === "text") item.body = field.value;
  });
}

async function saveMemoryPage() {
  if (!currentMemoryCode || !memoryEditable) return;
  stopActiveMedia();
  collectTextBodies();
  const ticket = findTicketByCode(currentMemoryCode) || snapshotEditor();
  const payload = {
    code: currentMemoryCode,
    place: ticket.place || "",
    passenger: ticket.passenger || "",
    date: ticket.date || "",
    memory: ticket.memory || "",
    ombreStart: ticket.ombreStart || DEFAULT_OMBRE.start,
    ombreEnd: ticket.ombreEnd || DEFAULT_OMBRE.end,
    typeColor: ticket.typeColor || DEFAULT_TYPE_COLOR,
    texts: memoryItems
      .filter((item) => item.kind === "text" && item.body.trim())
      .map((item) => ({ id: item.id, body: item.body.trim() })),
  };
  const data = new FormData();
  data.append("meta", JSON.stringify(payload));
  for (const item of memoryItems) {
    if (item.kind === "voice") {
      if (item.blob) {
        data.append(`voice-${item.id}`, item.blob, `${item.id}.webm`);
      } else if (item.src) {
        const blob = await fetch(item.src).then((res) => res.blob());
        data.append(`voice-${item.id}`, blob, `${item.id}.webm`);
      }
    }
    if (item.kind === "file") {
      if (item.blob) {
        data.append(`file-${item.id}`, item.blob, item.name || "attachment");
      } else if (item.src) {
        const blob = await fetch(item.src).then((res) => res.blob());
        data.append(`file-${item.id}`, blob, item.name || "attachment");
      }
    }
  }
  setMemoryStatus("Saving…");
  try {
    const response = await fetch(`/api/media/${encodeURIComponent(currentMemoryCode)}`, {
      method: "POST",
      body: data,
    });
    if (!response.ok) throw new Error("save failed");
    const saved = await response.json();
    memoryItems = itemsFromSaved(saved);
    renderMemoryList();
    memoryEls.save.textContent = "Saved";
    setMemoryStatus("");
    window.setTimeout(() => {
      if (memoryEls.save.textContent === "Saved") memoryEls.save.textContent = "Save";
    }, 1400);
  } catch {
    setMemoryStatus("Could not save. Keep the local server running, then try again.");
  }
}

function bindMemoryPage() {
  memoryEls.addText.addEventListener("click", () => {
    if (!memoryEditable) return;
    const id = itemId("t");
    memoryItems.push({ kind: "text", id, body: "" });
    renderMemoryList();
    memoryEls.list.querySelector(`[data-id="${id}"] textarea`)?.focus();
  });
  memoryEls.addVoice.addEventListener("click", () => {
    startVoiceMemo().catch(() => {
      setMemoryStatus("Microphone permission is needed to record.");
      setVoiceButton(false);
    });
  });
  memoryEls.addFile.addEventListener("click", () => {
    if (!memoryEditable) return;
    memoryEls.fileInput.click();
  });
  memoryEls.fileInput.addEventListener("change", () => {
    if (!memoryEditable) return;
    [...(memoryEls.fileInput.files || [])].forEach((file) => {
      memoryItems.push({
        kind: "file",
        id: itemId("f"),
        blob: file,
        name: file.name,
        type: file.type,
        src: "",
      });
    });
    memoryEls.fileInput.value = "";
    renderMemoryList();
  });
  memoryEls.save.addEventListener("click", () => {
    saveMemoryPage();
  });
}

function syncPair(a, b, transform) {
  const apply = (from, to) => {
    let value = from.value;
    if (transform) value = transform(value);
    if (from.value !== value) {
      const start = from.selectionStart;
      const end = from.selectionEnd;
      from.value = value;
      if (typeof start === "number") from.setSelectionRange(start, end);
    }
    to.value = value;
  };
  a.addEventListener("input", () => apply(a, b));
  b.addEventListener("input", () => apply(b, a));
}

function dateFields(root) {
  return {
    mm: root.querySelector('[data-date="mm"]'),
    dd: root.querySelector('[data-date="dd"]'),
    year: root.querySelector('[data-date="year"]'),
  };
}

function isDateControlKey(event) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
    ].includes(event.key)
  );
}

function writeDateValues(values) {
  [dateStub, dateMain].forEach((root) => {
    const fields = dateFields(root);
    DATE_KEYS.forEach((key) => {
      fields[key].value = values[key] || "";
    });
  });
}

function readDateValues(root) {
  const fields = dateFields(root);
  return {
    mm: fields.mm.value.replace(/\D/g, "").slice(0, DATE_MAX.mm),
    dd: fields.dd.value.replace(/\D/g, "").slice(0, DATE_MAX.dd),
    year: fields.year.value.replace(/\D/g, "").slice(0, DATE_MAX.year),
  };
}

function splitDateDigits(digits) {
  const value = String(digits).replace(/\D/g, "").slice(0, 8);
  return {
    mm: value.slice(0, 2),
    dd: value.slice(2, 4),
    year: value.slice(4, 8),
  };
}

function getDateValue() {
  const { mm, dd, year } = readDateValues(dateStub);
  if (!mm && !dd && !year) return "";
  return `${mm}/${dd}/${year}`;
}

function bindDateInputs() {
  [dateStub, dateMain].forEach((root) => {
    const fields = dateFields(root);
    DATE_KEYS.forEach((key, index) => {
      const input = fields[key];

      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && index > 0) {
          event.preventDefault();
          const prev = fields[DATE_KEYS[index - 1]];
          prev.focus();
          prev.setSelectionRange(prev.value.length, prev.value.length);
          return;
        }
        if (isDateControlKey(event)) return;
        if (event.key.length === 1 && !/\d/.test(event.key)) {
          event.preventDefault();
        }
      });

      input.addEventListener("input", () => {
        const typed = input.value.replace(/\D/g, "");
        const values = readDateValues(root);
        values[key] = typed.slice(0, DATE_MAX[key]);
        let overflow = typed.slice(DATE_MAX[key]);
        for (let i = index + 1; i < DATE_KEYS.length && overflow.length; i += 1) {
          const nextKey = DATE_KEYS[i];
          values[nextKey] = overflow.slice(0, DATE_MAX[nextKey]);
          overflow = overflow.slice(DATE_MAX[nextKey]);
        }
        writeDateValues(values);
        if (typed.length >= DATE_MAX[key] && index < DATE_KEYS.length - 1) {
          const next = fields[DATE_KEYS[index + 1]];
          next.focus();
          next.select();
        }
      });

      input.addEventListener("paste", (event) => {
        const text = event.clipboardData?.getData("text") || "";
        const digits = text.replace(/\D/g, "");
        if (!digits) {
          event.preventDefault();
          return;
        }
        if (digits.length > 1) {
          event.preventDefault();
          const values = splitDateDigits(digits);
          writeDateValues(values);
          const targetKey = values.year.length
            ? "year"
            : values.dd.length
              ? "dd"
              : "mm";
          const target = fields[targetKey];
          target.focus();
          target.setSelectionRange(target.value.length, target.value.length);
        }
      });
    });
  });
}

function ticketMarkup(ticket) {
  const place = ticket.place?.trim() || "PLACE";
  const date = ticket.date?.trim() || "MM/DD/YEAR";
  const passenger = ticket.passenger?.trim() || "------------";
  const memory = ticket.memory?.trim() || "";

  return `
    <div class="ticket-face" aria-hidden="true"></div>
    <div class="ticket-stub">
      <div class="ticket-qr" aria-hidden="true">
        <div data-qr></div>
      </div>
      <p class="ticket-place">${escapeHtml(place)}</p>
      <div class="ticket-meta-field">
        <span>Date</span>
        <p class="ticket-date">${escapeHtml(date)}</p>
      </div>
      <div class="ticket-meta-field">
        <span>Passenger</span>
        <p class="ticket-passenger">${escapeHtml(passenger)}</p>
      </div>
    </div>
    <div class="ticket-main">
      <div class="ticket-main-copy">
        <p class="ticket-place">${escapeHtml(place)}</p>
        <div class="ticket-meta-field">
          <span>Date</span>
          <p class="ticket-date">${escapeHtml(date)}</p>
        </div>
        <div class="ticket-meta-field">
          <span>Passenger</span>
          <p class="ticket-passenger">${escapeHtml(passenger)}</p>
        </div>
      </div>
      <div class="ticket-write">
        <p class="ticket-memory">${escapeHtml(memory)}</p>
      </div>
    </div>
  `;
}

function communityTickets() {
  return [...loadTickets()].sort((a, b) => b.id - a.id);
}

function communityPageCount() {
  return Math.max(1, Math.ceil(communityTickets().length / COMMUNITY_PAGE_SIZE));
}

function paintTicketQrs(root) {
  root.querySelectorAll(".ticket[data-code]").forEach((card) => {
    const holder = card.querySelector("[data-qr]");
    const code = card.dataset.code;
    if (!holder || !code) return;
    paintQr(holder, ticketLink(code), card.style.getPropertyValue("--type-color").trim() || DEFAULT_TYPE_COLOR);
  });
}

function ticketCardMarkup(ticket) {
  return `
    <a class="ticket-card" href="#/ticket/${encodeURIComponent(ticket.code)}">
      <div
        class="ticket"
        data-code="${escapeHtml(ticket.code)}"
        style="--ombre-start: ${escapeHtml(ticket.ombreStart)}; --ombre-end: ${escapeHtml(ticket.ombreEnd)}; --type-color: ${escapeHtml(ticket.typeColor)}"
      >${ticketMarkup(ticket)}</div>
    </a>
  `;
}

function renderCommunityPage() {
  const tickets = communityTickets();
  const pages = communityPageCount();
  communityPage = Math.min(Math.max(0, communityPage), pages - 1);
  const start = communityPage * COMMUNITY_PAGE_SIZE;
  const visible = tickets.slice(start, start + COMMUNITY_PAGE_SIZE);
  if (!visible.length) {
    grid.innerHTML = `<p class="community-empty">No tickets yet.</p>`;
  } else {
    grid.innerHTML = visible.map(ticketCardMarkup).join("");
    paintTicketQrs(grid);
  }
  const showArrows = tickets.length > COMMUNITY_PAGE_SIZE;
  communityPrev.hidden = !showArrows;
  communityNext.hidden = !showArrows;
}

function renderCommunity() {
  grid.classList.remove("is-out-next", "is-out-prev", "is-in-next", "is-in-prev");
  renderCommunityPage();
}

function slideCommunity(delta) {
  const tickets = communityTickets();
  if (tickets.length <= COMMUNITY_PAGE_SIZE || communityAnimating) return;
  const pages = communityPageCount();
  const nextPage = (communityPage + delta + pages) % pages;
  if (nextPage === communityPage) return;
  communityAnimating = true;
  const outClass = delta > 0 ? "is-out-next" : "is-out-prev";
  const inClass = delta > 0 ? "is-in-next" : "is-in-prev";
  grid.classList.add(outClass);
  window.setTimeout(() => {
    communityPage = nextPage;
    renderCommunityPage();
    grid.classList.remove(outClass);
    grid.classList.add(inClass);
    void grid.offsetWidth;
    grid.classList.remove(inClass);
    window.setTimeout(() => {
      communityAnimating = false;
    }, 280);
  }, 220);
}

function bindCommunity() {
  communityPrev.addEventListener("click", () => slideCommunity(-1));
  communityNext.addEventListener("click", () => slideCommunity(1));
  window.addEventListener("keydown", (event) => {
    if (document.body.dataset.view !== "community") return;
    if (event.key === "ArrowLeft") slideCommunity(-1);
    if (event.key === "ArrowRight") slideCommunity(1);
  });
}

function renderTicketView(code) {
  const ticket = loadTickets().find((item) => item.code === code);
  if (!ticket) {
    location.hash = "#/community";
    return;
  }
  ticketFull.innerHTML = `
    <div
      class="ticket"
      data-code="${escapeHtml(ticket.code)}"
      style="--ombre-start: ${escapeHtml(ticket.ombreStart)}; --ombre-end: ${escapeHtml(ticket.ombreEnd)}; --type-color: ${escapeHtml(ticket.typeColor)}"
    >${ticketMarkup(ticket)}</div>
  `;
  paintTicketQrs(ticketFull);
}

function resetEditor() {
  form.reset();
  placeMain.value = "";
  passengerMain.value = "";
  writeDateValues({ mm: "", dd: "", year: "" });
  applyOmbre(DEFAULT_OMBRE.start, DEFAULT_OMBRE.end);
  typePicker.setHex(DEFAULT_TYPE_COLOR);
  editorCode = makeCode();
  refreshEditorQr();
  syncTicket();
}

function parseRoute() {
  const path = (location.pathname.replace(/\/+$/, "") || "/");
  const pathMatch = path.match(/^\/m\/([^/]+)(?:\/(edit))?$/i);
  if (pathMatch) {
    return {
      view: "memory",
      code: decodeURIComponent(pathMatch[1]),
      editable: pathMatch[2] === "edit",
    };
  }
  const hash = (location.hash || "#/").replace(/^#/, "") || "/";
  const memoryMatch = hash.match(/^\/m\/([^/?#]+)(?:\/(edit))?\/?$/);
  if (memoryMatch) {
    return {
      view: "memory",
      code: decodeURIComponent(memoryMatch[1]),
      editable: memoryMatch[2] === "edit",
    };
  }
  const ticketMatch = hash.match(/^\/ticket\/([^/?#]+)\/?$/);
  if (ticketMatch) {
    return { view: "ticket", code: decodeURIComponent(ticketMatch[1]) };
  }
  if (hash === "/" || hash === "") return { view: "home" };
  const name = hash.replace(/^\//, "");
  if (views[name]) return { view: name };
  return { view: "home" };
}

let activeViewName = null;
let activeRouteKey = "";
let routeGeneration = 0;
let settleRouteMotion = null;

function routeKey(parsed) {
  return `${parsed.view}:${parsed.code || ""}:${parsed.editable ? "edit" : ""}`;
}

function viewTitle(viewName) {
  if (viewName === "new") return "New Ticket — We All Have So Much in Common";
  if (viewName === "community") return "Community — We All Have So Much in Common";
  if (viewName === "ticket") return "Ticket — We All Have So Much in Common";
  if (viewName === "memory") return "Ticket Memory — We All Have So Much in Common";
  return "We All Have So Much in Common";
}

function applyViewVisibility(viewName) {
  Object.entries(views).forEach(([name, el]) => {
    const isActive = name === viewName;
    el.hidden = !isActive;
    el.inert = !isActive;
    el.setAttribute("aria-hidden", isActive ? "false" : "true");
    el.classList.remove("is-leaving", "is-entering");
    el.style.removeProperty("--leave-scroll");
  });
  document.body.classList.remove("is-routing");
  document.querySelectorAll(".is-route-ghost").forEach((node) => node.remove());
}

function settleMotion() {
  const settle = settleRouteMotion;
  settleRouteMotion = null;
  if (settle) settle();
}

function cloneView(view) {
  const ghost = view.cloneNode(true);
  const liveCanvas = view.querySelectorAll("canvas");
  const ghostCanvas = ghost.querySelectorAll("canvas");
  liveCanvas.forEach((canvas, index) => {
    const copy = ghostCanvas[index];
    if (!copy) return;
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext("2d");
    if (context) context.drawImage(canvas, 0, 0);
  });
  ghost.removeAttribute("id");
  ghost.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  ghost.classList.add("is-route-ghost");
  ghost.inert = true;
  return ghost;
}

function prepareView(viewName, parsed) {
  document.body.dataset.view = viewName;
  document.title = viewTitle(viewName);
  if (viewName === "community") renderCommunity();
  if (viewName === "ticket") renderTicketView(parsed.code);
  if (viewName === "new") {
    requestAnimationFrame(() => {
      startPicker.redraw();
      endPicker.redraw();
      typePicker.redraw();
      refreshEditorQr();
    });
  }
  if (viewName === "memory") openMemoryPage(parsed.code, parsed.editable);
}

function slideViews(leaving, entering, viewName) {
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
  leaving.style.setProperty("--leave-scroll", `${scrollY}px`);
  document.body.classList.add("is-routing");
  leaving.hidden = false;
  leaving.inert = true;
  entering.hidden = false;
  entering.inert = true;
  entering.setAttribute("aria-hidden", "false");
  leaving.classList.add("is-leaving");
  entering.classList.add("is-entering");
  window.scrollTo(0, 0);
  entering.scrollTop = 0;

  const generation = ++routeGeneration;
  let pending = 2;
  let settled = false;
  const settle = () => {
    if (settled || generation !== routeGeneration) return;
    settled = true;
    leaving.removeEventListener("animationend", onEnd);
    entering.removeEventListener("animationend", onEnd);
    window.clearTimeout(timer);
    if (leaving.classList.contains("is-route-ghost")) leaving.remove();
    applyViewVisibility(viewName);
    if (settleRouteMotion === settle) settleRouteMotion = null;
  };
  const finishOne = () => {
    pending -= 1;
    if (pending > 0) return;
    settle();
  };
  const onEnd = (event) => {
    if (event.target !== leaving && event.target !== entering) return;
    if (event.animationName !== "view-slide-out" && event.animationName !== "view-slide-in") return;
    finishOne();
  };
  settleRouteMotion = settle;
  leaving.addEventListener("animationend", onEnd);
  entering.addEventListener("animationend", onEnd);
  const timer = window.setTimeout(settle, 700);
}

function route() {
  stopActiveMedia();
  settleMotion();
  const parsed = parseRoute();
  const viewName = parsed.view;
  const nextKey = routeKey(parsed);
  const next = views[viewName];
  const previous = activeViewName ? views[activeViewName] : null;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const samePlace = nextKey === activeRouteKey;

  if (!previous || !next || previous === next && samePlace || samePlace || reduceMotion) {
    prepareView(viewName, parsed);
    applyViewVisibility(viewName);
    activeViewName = viewName;
    activeRouteKey = nextKey;
    window.scrollTo(0, 0);
    return;
  }

  const leaving = previous === next ? cloneView(previous) : previous;
  if (leaving !== previous) document.body.appendChild(leaving);
  Object.entries(views).forEach(([name, el]) => {
    if (el === previous || el === next) return;
    el.hidden = true;
    el.inert = true;
    el.setAttribute("aria-hidden", "true");
    el.classList.remove("is-leaving", "is-entering");
  });
  prepareView(viewName, parsed);
  activeViewName = viewName;
  activeRouteKey = nextKey;
  slideViews(leaving, next, viewName);
}

let editorCode = makeCode();
const startPicker = createPicker(startGroup);
const endPicker = createPicker(endGroup);
const typePicker = createPicker(typeGroup);
applyOmbre(DEFAULT_OMBRE.start, DEFAULT_OMBRE.end);
typePicker.setHex(DEFAULT_TYPE_COLOR);
syncTicket();
refreshEditorQr();
bindAddMedia();
bindCommunity();
bindMemoryPage();
syncPair(placeStub, placeMain, (value) => value.toUpperCase());
syncPair(passengerStub, passengerMain, (value) => value.toUpperCase());
bindDateInputs();

const MEMORY_LINES = 8;
memoryInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  if (memoryInput.value.split("\n").length >= MEMORY_LINES) {
    event.preventDefault();
  }
});
memoryInput.addEventListener("input", () => {
  const lines = memoryInput.value.split("\n");
  if (lines.length <= MEMORY_LINES) return;
  memoryInput.value = lines.slice(0, MEMORY_LINES).join("\n");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const place = placeStub.value.trim().toUpperCase();
  const passenger = passengerStub.value.trim().toUpperCase();
  const memory = memoryInput.value.trim();
  if (!place || !passenger || !memory) return;

  const tickets = loadTickets();
  tickets.push({
    id: tickets.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1,
    place,
    date: getDateValue(),
    passenger,
    memory,
    ombreStart: currentOmbre().start,
    ombreEnd: currentOmbre().end,
    typeColor: typePicker.getHex(),
    code: editorCode,
  });
  saveTickets(tickets);
  resetEditor();
  communityPage = 0;
  location.hash = "#/community";
});

window.addEventListener("hashchange", route);
loadShareOrigin().then(() => {
  refreshEditorQr();
  if (document.body.dataset.view === "community") renderCommunity();
});
route();
