const STORAGE_KEY = "wahsmic-tickets-v3";

const DEFAULT_OMBRE = {
  start: "#e9ca30",
  end: "#e4451a",
};

const DEFAULT_TYPE_COLOR = "#000000";
const EXTRAS_KEY = "wahsmic-extras-v1";
const MEDIA_DB = "wahsmic-media-v1";

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
  memory: document.getElementById("memory"),
};

const form = document.getElementById("ticket-form");
const preview = document.getElementById("ticket-preview");
const grid = document.getElementById("ticket-grid");
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

function ticketLink(code, editable = false) {
  return `${location.origin}${location.pathname}#/m/${code}${editable ? "/edit" : ""}`;
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
  addMediaLink.href = `#/m/${editorCode}/edit`;
  paintQr(editorQr.querySelector("[data-qr]"), ticketLink(editorCode), typePicker.getHex());
}

function loadExtrasMap() {
  try {
    return JSON.parse(localStorage.getItem(EXTRAS_KEY) || "{}");
  } catch {
    return {};
  }
}

function getExtras(code) {
  return (
    loadExtrasMap()[code] || {
      code,
      extraText: "",
      locked: false,
      hasVoice: false,
      hasVideo: false,
      hasFile: false,
      fileName: "",
      fileType: "",
    }
  );
}

function saveExtras(record) {
  const all = loadExtrasMap();
  all[record.code] = record;
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(all));
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putMedia(key, blob) {
  const db = await openMediaDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMedia(key) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

const memoryEls = {
  back: document.querySelector("[data-memory-back]"),
  title: document.querySelector("[data-memory-title]"),
  meta: document.querySelector("[data-memory-meta]"),
  extraText: document.querySelector("[data-extra-text]"),
  extraView: document.querySelector("[data-extra-view]"),
  save: document.querySelector("[data-memory-save]"),
  voiceRecord: document.querySelector("[data-voice-record]"),
  voiceStop: document.querySelector("[data-voice-stop]"),
  voicePlayer: document.querySelector("[data-voice-player]"),
  voiceEmpty: document.querySelector("[data-voice-empty]"),
  videoRecord: document.querySelector("[data-video-record]"),
  videoStop: document.querySelector("[data-video-stop]"),
  videoPreview: document.querySelector("[data-video-preview]"),
  videoPlayer: document.querySelector("[data-video-player]"),
  videoEmpty: document.querySelector("[data-video-empty]"),
  fileInput: document.querySelector("[data-file-input]"),
  fileName: document.querySelector("[data-file-name]"),
  fileLink: document.querySelector("[data-file-link]"),
  filePreview: document.querySelector("[data-file-preview]"),
  fileEmpty: document.querySelector("[data-file-empty]"),
};

let currentMemoryCode = "";
let memoryEditable = false;
let activeStream = null;
let activeRecorder = null;
let objectUrls = [];

function forgetObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function useObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  return url;
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
  if (memoryEls.videoPreview) {
    memoryEls.videoPreview.srcObject = null;
    memoryEls.videoPreview.hidden = true;
  }
  memoryEls.voiceStop.hidden = true;
  memoryEls.videoStop.hidden = true;
  memoryEls.voiceRecord.hidden = false;
  memoryEls.videoRecord.hidden = false;
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

function setMediaVisible(player, empty, blob) {
  if (blob) {
    player.src = useObjectUrl(blob);
    player.hidden = false;
    empty.hidden = true;
  } else {
    player.removeAttribute("src");
    player.hidden = true;
    empty.hidden = false;
  }
}

async function renderMemoryMedia(record) {
  forgetObjectUrls();
  const voice = record.hasVoice ? await getMedia(`${record.code}-voice`) : null;
  const video = record.hasVideo ? await getMedia(`${record.code}-video`) : null;
  const file = record.hasFile ? await getMedia(`${record.code}-file`) : null;
  setMediaVisible(memoryEls.voicePlayer, memoryEls.voiceEmpty, voice);
  setMediaVisible(memoryEls.videoPlayer, memoryEls.videoEmpty, video);

  if (file) {
    const url = useObjectUrl(file);
    memoryEls.fileEmpty.hidden = true;
    memoryEls.fileName.hidden = false;
    memoryEls.fileName.textContent = record.fileName || "Attachment";
    memoryEls.fileLink.hidden = false;
    memoryEls.fileLink.href = url;
    memoryEls.fileLink.download = record.fileName || "attachment";
    if ((record.fileType || file.type || "").startsWith("image/")) {
      memoryEls.filePreview.hidden = false;
      memoryEls.filePreview.src = url;
    } else {
      memoryEls.filePreview.hidden = true;
      memoryEls.filePreview.removeAttribute("src");
    }
  } else {
    memoryEls.fileEmpty.hidden = false;
    memoryEls.fileName.hidden = true;
    memoryEls.fileLink.hidden = true;
    memoryEls.fileLink.removeAttribute("href");
    memoryEls.filePreview.hidden = true;
  }
}

async function openMemoryPage(code, editable) {
  stopActiveMedia();
  currentMemoryCode = code;
  memoryEditable = Boolean(editable);
  const ticket = findTicketByCode(code);
  const record = getExtras(code);
  const saved = loadTickets().some((item) => item.code === code);
  memoryView.style.setProperty("--ombre-start", ticket?.ombreStart || DEFAULT_OMBRE.start);
  memoryView.style.setProperty("--ombre-end", ticket?.ombreEnd || DEFAULT_OMBRE.end);
  memoryView.style.setProperty("--type-color", ticket?.typeColor || DEFAULT_TYPE_COLOR);
  memoryView.classList.toggle("is-editable", memoryEditable);
  memoryEls.back.href = saved ? "#/community" : "#/new";
  memoryEls.title.textContent = ticket?.place || "New memory";
  memoryEls.meta.textContent = [ticket?.passenger, ticket?.date].filter(Boolean).join(" · ");
  memoryEls.extraText.value = record.extraText || "";
  memoryEls.extraView.textContent = record.extraText || "No extra text yet.";
  memoryEls.extraView.hidden = memoryEditable;
  memoryEls.save.textContent = "Save";
  await renderMemoryMedia(record);
}

async function startRecording(kind) {
  if (!memoryEditable) return;
  stopActiveMedia();
  const constraints = kind === "video" ? { audio: true, video: true } : { audio: true };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  activeStream = stream;
  if (kind === "video") {
    memoryEls.videoPreview.srcObject = stream;
    memoryEls.videoPreview.hidden = false;
    memoryEls.videoPlayer.hidden = true;
    memoryEls.videoRecord.hidden = true;
    memoryEls.videoStop.hidden = false;
  } else {
    memoryEls.voiceRecord.hidden = true;
    memoryEls.voiceStop.hidden = false;
  }
  const types =
    kind === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  const chunks = [];
  activeRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  activeRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  activeRecorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((track) => track.stop());
    if (activeStream === stream) activeStream = null;
    const blob = new Blob(chunks, { type: activeRecorder?.mimeType || mimeType || chunks[0]?.type });
    const record = getExtras(currentMemoryCode);
    if (kind === "video") {
      await putMedia(`${currentMemoryCode}-video`, blob);
      record.hasVideo = true;
      memoryEls.videoPreview.srcObject = null;
      memoryEls.videoPreview.hidden = true;
    } else {
      await putMedia(`${currentMemoryCode}-voice`, blob);
      record.hasVoice = true;
    }
    saveExtras(record);
    await renderMemoryMedia(record);
    memoryEls.voiceRecord.hidden = false;
    memoryEls.videoRecord.hidden = false;
    memoryEls.voiceStop.hidden = true;
    memoryEls.videoStop.hidden = true;
    activeRecorder = null;
  });
  activeRecorder.start();
}

function bindMemoryPage() {
  memoryEls.voiceRecord.addEventListener("click", () => {
    startRecording("voice").catch(() => {
      memoryEls.voiceEmpty.textContent = "Microphone permission is needed to record.";
      memoryEls.voiceEmpty.hidden = false;
    });
  });
  memoryEls.videoRecord.addEventListener("click", () => {
    startRecording("video").catch(() => {
      memoryEls.videoEmpty.textContent = "Camera permission is needed to record.";
      memoryEls.videoEmpty.hidden = false;
    });
  });
  memoryEls.voiceStop.addEventListener("click", () => stopActiveMedia());
  memoryEls.videoStop.addEventListener("click", () => stopActiveMedia());
  memoryEls.fileInput.addEventListener("change", async () => {
    if (!memoryEditable) return;
    const file = memoryEls.fileInput.files?.[0];
    if (!file) return;
    await putMedia(`${currentMemoryCode}-file`, file);
    const record = getExtras(currentMemoryCode);
    record.hasFile = true;
    record.fileName = file.name;
    record.fileType = file.type;
    saveExtras(record);
    memoryEls.fileInput.value = "";
    await renderMemoryMedia(record);
  });
  memoryEls.extraText.addEventListener("input", () => {
    if (!currentMemoryCode || !memoryEditable) return;
    const record = getExtras(currentMemoryCode);
    record.extraText = memoryEls.extraText.value;
    saveExtras(record);
  });
  memoryEls.save.addEventListener("click", () => {
    if (!currentMemoryCode || !memoryEditable) return;
    stopActiveMedia();
    const record = getExtras(currentMemoryCode);
    record.extraText = memoryEls.extraText.value.trim();
    saveExtras(record);
    memoryEls.save.textContent = "Saved";
    window.setTimeout(() => {
      if (memoryEls.save.textContent === "Saved") memoryEls.save.textContent = "Save";
    }, 1400);
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

function renderCommunity() {
  const tickets = [...loadTickets()].sort((a, b) => b.id - a.id);
  grid.innerHTML = tickets
    .map(
      (ticket) => `
        <article class="ticket-card">
          <div
            class="ticket"
            data-code="${escapeHtml(ticket.code)}"
            style="--ombre-start: ${escapeHtml(ticket.ombreStart)}; --ombre-end: ${escapeHtml(ticket.ombreEnd)}; --type-color: ${escapeHtml(ticket.typeColor)}"
          >${ticketMarkup(ticket)}</div>
        </article>
      `
    )
    .join("");
  grid.querySelectorAll(".ticket-card .ticket").forEach((card) => {
    const holder = card.querySelector("[data-qr]");
    const code = card.dataset.code;
    if (!holder || !code) return;
    paintQr(holder, ticketLink(code), card.style.getPropertyValue("--type-color").trim() || DEFAULT_TYPE_COLOR);
  });
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

function route() {
  stopActiveMedia();
  const hash = (location.hash || "#/").replace(/^#/, "") || "/";
  const memoryMatch = hash.match(/^\/m\/([^/?#]+)(?:\/(edit))?\/?$/);
  const viewName = memoryMatch
    ? "memory"
    : hash === "/" || hash === ""
      ? "home"
      : views[hash.replace(/^\//, "")]
        ? hash.replace(/^\//, "")
        : "home";

  Object.entries(views).forEach(([name, el]) => {
    const isActive = name === viewName;
    el.hidden = !isActive;
    el.setAttribute("aria-hidden", isActive ? "false" : "true");
    el.inert = !isActive;
  });

  document.body.dataset.view = viewName;
  document.title =
    viewName === "new"
      ? "New Ticket — We All Have So Much in Common"
      : viewName === "community"
        ? "View Community — We All Have So Much in Common"
        : viewName === "memory"
          ? "Ticket Memory — We All Have So Much in Common"
          : "We All Have So Much in Common";

  if (viewName === "community") renderCommunity();
  if (viewName === "new") {
    requestAnimationFrame(() => {
      startPicker.redraw();
      endPicker.redraw();
      typePicker.redraw();
      refreshEditorQr();
    });
  }
  if (viewName === "memory") {
    openMemoryPage(decodeURIComponent(memoryMatch[1]), memoryMatch[2] === "edit");
  }
  window.scrollTo(0, 0);
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
  location.hash = "#/community";
});

window.addEventListener("hashchange", route);
route();
