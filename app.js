/* ========================================
   Smart Wardrobe v2 - App Logic
   ======================================== */

// ===== Constants & State =====
const CATEGORIES = { tops:"����", bottoms:"��װ", shoes:"Ь��", outerwear:"����", dresses:"����ȹ", accessories:"����" };
const SEASONS = { all:"ȫ��", spring:"��", summer:"��", autumn:"��", winter:"��" };
const SEASON_ICON = { all:"", spring:"??", summer:"??", autumn:"??", winter:"??" };
const OCCASIONS = ["�ճ�","ͨ��","�˶�","Լ��","�ۻ�","����","����"];

const DB_NAME = "SmartWardrobeDB", DB_VER = 2, STORE_ITEMS = "items", STORE_OUTFITS = "outfits", STORE_WARDROBES = "wardrobes";

let state = { wardrobes: [], selectedWardrobeId: null,
  items: [], outfits: [], currentTab: "wardrobe",
  catFilter: "all", seasonFilter: "all", searchQuery: "",
  editingId: null
};

const WMO_CODES = {
  0:"����",1:"����",2:"����",3:"����",45:"��",48:"��ڡ",51:"Сëë��",53:"ëë��",
  55:"��ëë��",56:"��ëë��",57:"��ëë��",61:"С��",63:"����",65:"����",
  66:"����",67:"����",71:"Сѩ",73:"��ѩ",75:"��ѩ",77:"ѩ��",
  80:"����",81:"������",82:"������",85:"С��ѩ",86:"����ѩ",95:"�ױ�",
  96:"�ױ�+����",99:"�ױ�+����"
};
const WMO_ICONS = { 0:"??",1:"??",2:"?",3:"??",45:"??",48:"??",51:"??",53:"??",55:"??",
  56:"??",57:"??",61:"??",63:"??",65:"??",66:"??",67:"??",71:"??",73:"??",75:"??",
  77:"??",80:"??",81:"??",82:"??",85:"??",86:"??",95:"?",96:"?",99:"?" };

// ===== IndexedDB =====
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const s = db.createObjectStore(STORE_ITEMS, { keyPath: "id" });
        s.createIndex("createdAt","createdAt",{unique:false});
        s.createIndex("category","category",{unique:false});
      }
      if (!db.objectStoreNames.contains(STORE_OUTFITS)) {
        const s = db.createObjectStore(STORE_OUTFITS, { keyPath: "id" });
        s.createIndex("createdAt","createdAt",{unique:false});
      }
      if (!db.objectStoreNames.contains(STORE_WARDROBES)) {
        db.createObjectStore(STORE_WARDROBES, { keyPath: "id" });
      }
    };
    r.onsuccess = (e) => resolve(e.target.result);
    r.onerror = (e) => reject(e.target.error);
  });
}
async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store,"readonly"), s = t.objectStore(store);
    const r = s.getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbPut(store, item) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store,"readwrite"), s = t.objectStore(store);
    const r = s.put(item);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}
async function dbDelete(store, id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store,"readwrite"), s = t.objectStore(store);
    const r = s.delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

// ===== Image Helpers =====
function readFileAsDataURL(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.readAsDataURL(file);
  });
}
function compressImage(dataURL, maxW=800) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg",0.8));
    };
    img.src = dataURL;
  });
}

// ===== Toast =====
let toastTimer;
function showToast(msg, type) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "toast " + (type||"info");
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
}
// ===== Tab Switching =====
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  document.getElementById("tab" + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add("active");
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add("active");
  document.getElementById("searchBar").classList.add("hidden");
  document.getElementById("searchInput").value = "";
  state.searchQuery = "";
  if (tab === "outfits") fetchWeather();
  if (tab === "profile") renderProfile();
}

// ===== Wardrobe: CRUD =====
async function loadItems() {
  try { state.items = await dbGetAll(STORE_ITEMS); }
  catch(e) { state.items = []; }
  renderWardrobe();
  renderProfile();
}
async function saveItem(data) {
  const now = Date.now();
  const item = { ...data, updatedAt: now };
  if (!item.id) item.id = "i_" + now + "_" + Math.random().toString(36).substr(2,6);
  if (!item.createdAt) item.createdAt = now;
  await dbPut(STORE_ITEMS, item);
  await loadItems();
  showToast(data.id ? "�Ѹ���" : "�����", "success");
}
async function deleteItem(id) {
  await dbDelete(STORE_ITEMS, id);
  await loadItems();
  showToast("��ɾ��", "success");
}

// ===== Wardrobe: Render =====
function getFilteredItems() {
  let items = state.selectedWardrobeId ? state.items.filter(i => i.wardrobeId === state.selectedWardrobeId || !i.wardrobeId) : [...state.items];

  if (state.catFilter !== "all") items = items.filter(i => i.category === state.catFilter);
  if (state.seasonFilter !== "all") items = items.filter(i => i.season === state.seasonFilter || i.season === "all");
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter(i => (i.name||"").toLowerCase().includes(q) || (i.brand||"").toLowerCase().includes(q));
  }
  items.sort((a,b) => b.createdAt - a.createdAt);
  return items;
}

function renderWardrobe() {
  const filtered = getFilteredItems();
  const grid = document.getElementById("itemsGrid");
  const count = document.getElementById("itemCount");
  const total = document.getElementById("totalValue");

  count.textContent = "�� " + state.items.length + " ��";
  const sum = state.items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  total.textContent = "�ܼ�ֵ ��" + sum.toFixed(0);

  if (filtered.length === 0) {
    grid.classList.add("hidden");
    return;
  }
  grid.classList.remove("hidden");
  grid.innerHTML = "";
  filtered.forEach(item => grid.appendChild(createItemCard(item)));
}

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = "item-card";
  if (item.imageData) {
    const img = document.createElement("img");
    img.className = "item-card-image"; img.src = item.imageData;
    img.alt = item.name||"����"; img.loading = "lazy";
    card.appendChild(img);
  } else {
    const p = document.createElement("div");
    p.className = "item-card-placeholder";
    p.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    card.appendChild(p);
  }
  const body = document.createElement("div");
  body.className = "item-card-body";
  body.innerHTML = `<div class="item-card-name">${item.name||"δ����"}</div>
    <div class="item-card-brand">${item.brand||""}</div>
    <div class="item-card-meta">
      ${item.price ? `<span class="item-card-price">��${parseFloat(item.price).toFixed(0)}</span>` : ""}
      ${item.season && item.season !== "all" ? `<span class="item-card-season">${SEASON_ICON[item.season]}${SEASONS[item.season]}</span>` : ""}
    </div>`;
  card.appendChild(body);
  card.addEventListener("click", () => showDetail(item.id));
  return card;
}
// ===== Weather =====
async function fetchWeather() {
  const card = document.getElementById("weatherCard");
  card.innerHTML = '<div class="weather-loading">��ȡ������Ϣ...</div>';
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:5000}));
    const { latitude:lat, longitude:lon } = pos.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
    const resp = await fetch(url);
    const data = await resp.json();
    renderWeather(card, data, lat, lon);
  } catch {
    // Fallback: use mock data
    const month = new Date().getMonth();
    let temp = 22, icon = "??", desc = "��";
    if (month >= 3 && month <= 5) { temp = 22; icon = "??"; desc = "����"; }
    else if (month >= 6 && month <= 8) { temp = 32; icon = "??"; desc = "�ļ�"; }
    else if (month >= 9 && month <= 11) { temp = 18; icon = "??"; desc = "�＾"; }
    else { temp = 8; icon = "??"; desc = "����"; }
    card.innerHTML = `<div class="weather-main">
      <div class="weather-icon">${icon}</div>
      <div class="weather-temp">${temp}<sup>��C</sup></div>
      <div class="weather-info"><div class="weather-desc">${desc}</div><div class="weather-location">��ǰλ��</div></div>
    </div><div class="weather-details"><div class="weather-detail"><span>���</span>${temp-2}��C</div>
    <div class="weather-detail"><span>ʪ��</span>60%</div></div>`;
  }
}

function renderWeather(card, data) {
  const cur = data.current;
  const code = cur.weather_code;
  const icon = WMO_ICONS[code] || "??";
  const desc = WMO_CODES[code] || "δ֪";
  card.innerHTML = `<div class="weather-main">
    <div class="weather-icon">${icon}</div>
    <div class="weather-temp">${Math.round(cur.temperature_2m)}<sup>��C</sup></div>
    <div class="weather-info">
      <div class="weather-desc">${desc} �� ���${Math.round(cur.apparent_temperature)}��C</div>
      <div class="weather-location">��ǰλ��</div>
    </div>
  </div><div class="weather-details">
    <div class="weather-detail"><span>ʪ��</span>${cur.relative_humidity_2m}%</div>
    <div class="weather-detail"><span>����</span>${cur.wind_speed_10m} km/h</div>
  </div>`;
}

// ===== Outfits CRUD =====
async function loadOutfits() {
  try { state.outfits = await dbGetAll(STORE_OUTFITS); }
  catch(e) { state.outfits = []; }
  renderOutfits();
}

function renderOutfits() {
  const grid = document.getElementById("outfitsGrid");
  const empty = document.getElementById("outfitsEmpty");
  if (state.outfits.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  grid.classList.remove("hidden");
  empty.classList.add("hidden");
  const list = document.getElementById("outfitsList");
  list.innerHTML = "";
  state.outfits.slice().reverse().forEach(o => list.appendChild(createOutfitCard(o)));
}

function createOutfitCard(outfit) {
  const card = document.createElement("div");
  card.className = "outfit-card";
  const items = outfit.itemIds.map(id => state.items.find(i => i.id === id)).filter(Boolean);
  card.innerHTML = `<div class="outfit-card-header">
    <span class="outfit-card-name">${outfit.name}</span>
    <span class="outfit-card-occasion">${outfit.occasion||"�ճ�"}</span>
  </div><div class="outfit-items">${items.map(i =>
    i ? (i.imageData ? `<img class="outfit-item-thumb" src="${i.imageData}" alt="">` :
      '<div class="outfit-item-thumb-placeholder">??</div>') : '<div class="outfit-item-thumb-placeholder">?</div>'
  ).join("")}</div>
  ${outfit.weatherTag ? `<div class="outfit-card-weather">${outfit.weatherTag}</div>` : ""}`;

  const del = document.createElement("button");
  del.className = "outfit-delete";
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  del.addEventListener("click", (e) => { e.stopPropagation();
    showConfirm("ɾ������", `ȷ��ɾ����${outfit.name}����`, () => deleteOutfit(outfit.id));
  });
  card.appendChild(del);
  return card;
}

async function saveOutfit(data) {
  const now = Date.now();
  const o = { ...data, updatedAt: now };
  if (!o.id) o.id = "o_" + now + "_" + Math.random().toString(36).substr(2,6);
  if (!o.createdAt) o.createdAt = now;
  await dbPut(STORE_OUTFITS, o);
  await loadOutfits();
  closeAllModals();
  showToast("�����ѱ���", "success");
}

async function deleteOutfit(id) {
  await dbDelete(STORE_OUTFITS, id);
  await loadOutfits();
  showToast("������ɾ��", "success");
}

// ===== AI Recommendations =====
const RECO_TEMPLATES = [
  { temp: [25,45], name:"������ˬ", tags:["����","��װ","Ь��"], desc:"�������ȣ��Ƽ��ᱡ͸���Ĵ���", items:{ tops:["T��","����"], bottoms:["�̿�","��ȹ"], shoes:["��Ь","�˶�Ь"] } },
  { temp: [18,24], name:"��������", tags:["����","��װ","Ь��"], desc:"�¶����ˣ��ճ�ͨ�ڴ���", items:{ tops:["����","����T��"], bottoms:["����","����ȹ"], shoes:["��Ь","����Ь"] } },
  { temp: [10,17], name:"����΢��", tags:["����","����","��װ"], desc:"����ת���������һ������", items:{ tops:["����","����"], outerwear:["�п�","����"], bottoms:["����"], shoes:["�˶�Ь"] } },
  { temp: [-20,9], name:"���ձ�ů", tags:["����","����","��װ","Ь��"], desc:"����������ע�Ᵽů", items:{ tops:["ë��","���"], outerwear:["���޷�","����"], bottoms:["���޿�"], shoes:["ѥ��"] } }
];

function generateRecommendations() {
  // Get current season and estimate temperature
  const month = new Date().getMonth();
  let season, temp;
  if (month >= 3 && month <= 5) { season = "spring"; temp = 22; }
  else if (month >= 6 && month <= 8) { season = "summer"; temp = 32; }
  else if (month >= 9 && month <= 11) { season = "autumn"; temp = 18; }
  else { season = "winter"; temp = 8; }

  if (state.items.length === 0) {
    showToast("�³���û������������", "error");
    return;
  }

  // Find matching template
  const tmpl = RECO_TEMPLATES.find(t => temp >= t.temp[0] && temp <= t.temp[1]) || RECO_TEMPLATES[1];

  // Categorize user's items
  const byCat = {};
  state.items.forEach(i => {
    if (!byCat[i.category]) byCat[i.category] = [];
    byCat[i.category].push(i);
  });

  // Generate multiple recommendations
  const recs = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const selected = [];
    const used = new Set();

    if (byCat["tops"]) {
      const list = byCat["tops"].filter(i => i.season === "all" || i.season === season || !i.season);
      if (list.length > 0) { const pick = list[attempt % list.length]; selected.push(pick); used.add(pick.id); }
    }
    if (byCat["bottoms"]) {
      const list = byCat["bottoms"].filter(i => i.season === "all" || i.season === season || !i.season);
      if (list.length > 0) { const pick = list[attempt % list.length]; selected.push(pick); used.add(pick.id); }
    }
    if (byCat["outerwear"] && temp < 18) {
      const list = byCat["outerwear"].filter(i => i.season === "all" || i.season === season || !i.season);
      if (list.length > 0) { const pick = list[attempt % list.length]; selected.push(pick); used.add(pick.id); }
    }
    if (byCat["shoes"]) {
      const list = byCat["shoes"];
      if (list.length > 0) { const pick = list[attempt % list.length]; if (!used.has(pick.id)) selected.push(pick); }
    }

    if (selected.length >= 2) {
      recs.push({
        id: "rec_" + attempt,
        weatherTag: `${tmpl.name} �� ${Math.round(temp)}��C`,
        items: selected,
        reason: selected.length >= 3 ? tmpl.desc : `���ڵ�ǰ�����Ƽ�${selected.map(i => i.name).join("��")}`
      });
    }
  }
  showRecommendations(recs, tmpl);
}

function showRecommendations(recs, tmpl) {
  const modal = document.createElement("div");
  modal.id = "recModal";
  modal.className = "modal";
  modal.innerHTML = `<div class="modal-content"><div class="modal-header">
    <h2>?? AI �Ƽ�����</h2>
    <button class="close-rec-btn icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div><div class="recommend-list">${recs.length === 0 ?
    '<div style="text-align:center;padding:40px;color:var(--text3)">û�п��Ƽ��Ĵ��䣬������Ӹ�������</div>' :
    recs.map(r => `<div class="recommend-item" data-rec='${JSON.stringify(r).replace(/'/g,"&#39;")}'>
      <div class="ri-weather">${r.weatherTag}</div>
      <div class="ri-items">${r.items.map(i => `<span class="ri-item-tag">${i.imageData ? "??" : "??"} ${i.name||""}</span>`).join("")}</div>
      <div class="ri-reason">${r.reason}</div>
      <button class="ri-save">�����������</button>
    </div>`).join("")}
  </div></div>`;

  document.body.appendChild(modal);
  modal.classList.remove("hidden");
  document.getElementById("modalBackdrop").classList.remove("hidden");

  modal.querySelector(".close-rec-btn").addEventListener("click", () => { modal.remove(); document.getElementById("modalBackdrop").classList.add("hidden"); });
  document.getElementById("modalBackdrop").addEventListener("click", () => { modal.remove(); document.getElementById("modalBackdrop").classList.add("hidden"); });

  modal.querySelectorAll(".ri-save").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const item = e.target.closest(".recommend-item");
      const data = JSON.parse(item.dataset.rec.replace(/&#39;/g,"'"));
      const name = prompt("����������������:", "�Ƽ����� " + (state.outfits.length + 1));
      if (!name) return;
      saveOutfit({ name, itemIds: data.items.map(i => i.id), occasion: tmpl.name, weatherTag: data.weatherTag, createdAt: Date.now() });
      modal.remove();
      document.getElementById("modalBackdrop").classList.add("hidden");
    });
  });
}
// ===== Profile =====
function renderProfile() {
  const items = state.items;
  const prof = loadProfile();
  document.getElementById("displayName").textContent = prof.name;
  const ai = document.getElementById("avatarImage");
  const ad = document.getElementById("avatarDefault");
  if (prof.avatar) { ai.src = prof.avatar; ai.classList.remove("hidden"); ad.style.display = "none"; }
  else { ai.classList.add("hidden"); ad.style.display = "block"; }
  document.getElementById("profileTotal").textContent = items.length;
  const sum = items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  document.getElementById("profileValue").textContent = "��" + sum.toFixed(0);
  document.getElementById("profileOutfits").textContent = state.outfits.length;

  const cats = new Set(items.map(i => i.category));
  document.getElementById("profileCategories").textContent = cats.size;

  renderWardrobeSwitcher(); renderWardrobeManager();
  // Category bars
  const counts = {};
  items.forEach(i => { const c = i.category || "other"; counts[c] = (counts[c]||0) + 1; });
  const max = Math.max(1, ...Object.values(counts));
  const bars = document.getElementById("profileCategoryBars");
  bars.innerHTML = Object.entries(counts).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<div class="mini-bar-row">
      <span class="mini-bar-label">${CATEGORIES[k]||k}</span>
      <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${v/max*100}%"></div></div>
      <span class="mini-bar-count">${v}</span>
    </div>`).join("");
}

// ===== Modal Management =====
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
  document.getElementById("modalBackdrop").classList.remove("hidden");
}
function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
  document.getElementById("modalBackdrop").classList.add("hidden");
  const recModal = document.getElementById("recModal");
  if (recModal) recModal.remove();
}

// Detail View
function showDetail(id) {
  const item = state.items.find(i => i.id === id);
  if (!item) return;
  const dc = document.getElementById("detailContent");
  const cats = CATEGORIES[item.category] || item.category || "-";
  const seasonTxt = item.season ? (SEASON_ICON[item.season] + " " + SEASONS[item.season]).trim() : "-";
  const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"}) : "-";

  dc.innerHTML = `<div class="detail-image">${item.imageData ? `<img src="${item.imageData}" alt="${item.name||""}">` : '<div style="padding:60px;text-align:center;color:var(--text3)">����ͼƬ</div>'}</div>
    <div class="detail-info">
      <div class="detail-row"><span class="detail-label">����</span><span class="detail-value">${item.name||"-"}</span></div>
      <div class="detail-row"><span class="detail-label">����</span><span class="detail-value badge">${cats}</span></div>
      <div class="detail-row"><span class="detail-label">Ʒ��</span><span class="detail-value">${item.brand||"-"}</span></div>
      <div class="detail-row"><span class="detail-label">�۸�</span><span class="detail-value price">${item.price ? "��"+parseFloat(item.price).toFixed(2) : "-"}</span></div>
      <div class="detail-row"><span class="detail-label">����</span><span class="detail-value badge">${seasonTxt}</span></div>
      <div class="detail-row"><span class="detail-label">��ɫ</span><span class="detail-value">${item.color ? `<span class="color-swatch" style="background:${item.color}"></span>${item.colorText||""}` : "-"}</span></div>
      <div class="detail-row"><span class="detail-label">����</span><span class="detail-value">${date}</span></div>
      <div class="detail-row"><span class="detail-label">��ע</span><p class="detail-notes">${item.notes||"��"}</p></div>
    </div>
    <div class="detail-actions">
      <button id="detailEditBtn" class="btn-secondary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>�༭</button>
      <button id="detailDeleteBtn" class="btn-danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>ɾ��</button>
    </div>`;

  dc.querySelector("#detailEditBtn").addEventListener("click", () => { closeAllModals(); openForm(id); });
  dc.querySelector("#detailDeleteBtn").addEventListener("click", () => showConfirm("ɾ������", `${item.name||"�������"}����ɾ��`, () => deleteItem(id)));
  openModal("detailModal");
}

// Form: Open
function openForm(itemId) {
  const form = document.getElementById("itemForm");
  form.reset(); document.getElementById("itemId").value = "";
  const ws = document.getElementById("itemWardrobe");
  ws.innerHTML = "<option value=''>��ѡ���¹�</option>";
  state.wardrobes.forEach(w => {
    var o = document.createElement("option");
    o.value = w.id; o.textContent = w.name;
    if (w.id === state.selectedWardrobeId) o.selected = true;
    ws.appendChild(o);
  });
  document.getElementById("imagePreview").innerHTML =
    '<div class="image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>����ϴ�ͼƬ</span></div>';
  document.getElementById("imageActions").classList.add("hidden");
  document.getElementById("itemSeason").value = "all";
  document.getElementById("itemColor").value = "#808080";
  document.getElementById("itemColorText").value = "";
  window._pendingImageData = null;
  state.editingId = null;
  document.getElementById("modalTitle").textContent = "�������";

  if (itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (item) {
      state.editingId = itemId;
      document.getElementById("modalTitle").textContent = "�༭����";
      document.getElementById("itemId").value = itemId;
      document.getElementById("itemWardrobe").value = item.wardrobeId || "";
      document.getElementById("itemName").value = item.name || "";
      document.getElementById("itemCategory").value = item.category || "";
      document.getElementById("itemBrand").value = item.brand || "";
      document.getElementById("itemPrice").value = item.price || "";
      document.getElementById("itemSeason").value = item.season || "all";
      document.getElementById("itemColor").value = item.color || "#808080";
      document.getElementById("itemColorText").value = item.colorText || "";
      document.getElementById("itemNotes").value = item.notes || "";
      if (item.imageData) {
        document.getElementById("imagePreview").innerHTML = `<img src="${item.imageData}" alt="Ԥ��">`;
        document.getElementById("imageActions").classList.remove("hidden");
      }
    }
  }
  openModal("itemFormModal");
}

// Confirm Dialog
let confirmCallback = null;
function showConfirm(title, msg, cb) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = msg;
  confirmCallback = cb;
  openModal("confirmDialog");
}

// ===== Init =====
function init() {
  // Tab switching
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Add item buttons
  document.getElementById("profileAddBtn").addEventListener("click", () => openForm());
  document.querySelectorAll("[id$=AddBtn]").forEach(b => { b.addEventListener("click", () => openForm()); });

  // Close modals
  document.getElementById("closeFormModal").addEventListener("click", closeAllModals);
  document.getElementById("closeDetailModal").addEventListener("click", closeAllModals);
  document.getElementById("cancelFormBtn").addEventListener("click", closeAllModals);
  document.getElementById("modalBackdrop").addEventListener("click", closeAllModals);
  document.getElementById("confirmCancelBtn").addEventListener("click", closeAllModals);
  document.getElementById("confirmOkBtn").addEventListener("click", () => {
    closeAllModals();
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });

  // Form submit
  document.getElementById("itemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("itemId").value || null;
    const existing = id ? state.items.find(i => i.id === id) : null;
    const data = {
      name: document.getElementById("itemName").value.trim(),
      category: document.getElementById("itemCategory").value,
      brand: document.getElementById("itemBrand").value.trim(),
      price: parseFloat(document.getElementById("itemPrice").value) || 0,
      wardrobeId: document.getElementById("itemWardrobe").value || "",
      season: document.getElementById("itemSeason").value,
      color: document.getElementById("itemColor").value,
      colorText: document.getElementById("itemColorText").value.trim(),
      notes: document.getElementById("itemNotes").value.trim()
    };
    if (!data.name) { showToast("����������", "error"); return; }
    if (!data.category) { showToast("��ѡ�����", "error"); return; }
    if (existing) { data.id = existing.id; data.createdAt = existing.createdAt; data.imageData = existing.imageData; }
    if (window._pendingImageData) { data.imageData = window._pendingImageData; window._pendingImageData = null; }
    await saveItem(data);
    closeAllModals();
  });

  // Image upload
  document.getElementById("imagePreview").addEventListener("click", () => document.getElementById("imageInput").click());
  document.getElementById("imageInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await readFileAsDataURL(file);
      const compressed = await compressImage(url, 800);
      window._pendingImageData = compressed;
      document.getElementById("imagePreview").innerHTML = `<img src="${compressed}" alt="Ԥ��">`;
      document.getElementById("imageActions").classList.remove("hidden");
    } catch { showToast("ͼƬ����ʧ��", "error"); }
  });
  document.getElementById("changeImageBtn").addEventListener("click", () => document.getElementById("imageInput").click());
  document.getElementById("removeImageBtn").addEventListener("click", () => {
    window._pendingImageData = null; document.getElementById("imageInput").value = "";
    document.getElementById("imagePreview").innerHTML =
      '<div class="image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>����ϴ�ͼƬ</span></div>';
    document.getElementById("imageActions").classList.add("hidden");
  });

  // Filters
  document.querySelectorAll("#categoryFilters .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#categoryFilters .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.catFilter = chip.dataset.cat;
      renderWardrobe();
    });
  });
  document.querySelectorAll("#seasonFilters .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#seasonFilters .chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.seasonFilter = chip.dataset.season;
      renderWardrobe();
    });
  });

  // Search
  document.getElementById("headerSearchBtn").addEventListener("click", () => {
    const bar = document.getElementById("searchBar");
    bar.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) document.getElementById("searchInput").focus();
    else { document.getElementById("searchInput").value = ""; state.searchQuery = ""; renderWardrobe(); }
  });
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim();
    document.getElementById("searchClear").classList.toggle("hidden", !state.searchQuery);
    renderWardrobe();
  });
  document.getElementById("searchClear").addEventListener("click", () => {
    document.getElementById("searchInput").value = ""; state.searchQuery = "";
    document.getElementById("searchClear").classList.add("hidden");
    document.getElementById("searchBar").classList.add("hidden");
    renderWardrobe();
  });

  // AI Recommend
  document.getElementById("aiRecommendBtn").addEventListener("click", generateRecommendations);

  // Stats
  document.getElementById("profileStatsBtn").addEventListener("click", showStats);
  document.getElementById("avatarContainer").addEventListener("click", () => document.getElementById("avatarGalleryInput").click());
  document.getElementById("avatarGalleryInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const url = await readFileAsDataURL(file);
      const compressed = await compressImage(url, 400);
      const prof = loadProfile(); prof.avatar = compressed; saveProfile(prof);
      renderProfile(); showToast("ͷ���Ѹ���", "success");
    } catch { showToast("ͷ�����ʧ��", "error"); }
    e.target.value = "";
  });
  document.getElementById("editNameBtn").addEventListener("click", () => {
    const prof = loadProfile();
    const n = prompt("�����ǳƣ�", prof.name);
    if (n && n.trim()) { prof.name = n.trim(); saveProfile(prof); renderProfile(); showToast("�ǳ��Ѹ���", "success"); }
  });
  document.getElementById("avatarCameraInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const url = await readFileAsDataURL(file);
      const compressed = await compressImage(url, 400);
      const prof = loadProfile(); prof.avatar = compressed; saveProfile(prof);
      renderProfile(); showToast("ͷ���Ѹ���", "success");
    } catch { showToast("����ʧ��", "error"); }
    e.target.value = "";
  });
  // Wardrobe
  document.getElementById("wardrobeToggle").addEventListener("click", () => {
    document.getElementById("wardrobeDropdown").classList.toggle("hidden");
    document.getElementById("wardrobeToggle").classList.toggle("open");
    renderWardrobeSwitcher(); renderWardrobeManager();
  });
  document.getElementById("wardrobeManageBtn").addEventListener("click", () => {
    document.getElementById("wardrobeDropdown").classList.add("hidden");
    document.getElementById("wardrobeToggle").classList.remove("open");
    switchTab("profile");
  });
  document.getElementById("addWardrobeBtn").addEventListener("click", showCreateWardrobeForm);
  document.addEventListener("click", (e) => {
    if (!document.querySelector(".wardrobe-bar")?.contains(e.target)) {
      document.getElementById("wardrobeDropdown").classList.add("hidden");
      document.getElementById("wardrobeToggle").classList.remove("open");
    }
  });
  document.getElementById("avatarContainer").addEventListener("click", () => document.getElementById("avatarGalleryInput").click());
  document.getElementById("avatarGalleryInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const url = await readFileAsDataURL(file);
      const compressed = await compressImage(url, 400);
      const prof = loadProfile(); prof.avatar = compressed; saveProfile(prof);
      renderProfile(); showToast("ͷ���Ѹ���", "success");
    } catch { showToast("ͷ�����ʧ��", "error"); }
    e.target.value = "";
  });
  document.getElementById("editNameBtn").addEventListener("click", () => {
    const prof = loadProfile();
    const n = prompt("�����ǳƣ�", prof.name);
    if (n && n.trim()) { prof.name = n.trim(); saveProfile(prof); renderProfile(); showToast("�ǳ��Ѹ���", "success"); }
  });
  document.getElementById("avatarCameraInput").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const url = await readFileAsDataURL(file);
      const compressed = await compressImage(url, 400);
      const prof = loadProfile(); prof.avatar = compressed; saveProfile(prof);
      renderProfile(); showToast("ͷ���Ѹ���", "success");
    } catch { showToast("����ʧ��", "error"); }
    e.target.value = "";
  });

  // Init data
  loadWardrobes().then(() => { loadItems(); loadOutfits(); });
}

// ===== Statistics =====

// ===== Profile Data =====
function loadProfile() {
  try { return JSON.parse(localStorage.getItem("sw_profile")) || { name:"�ҵ��³�", avatar:"" }; }
  catch(e) { return { name:"�ҵ��³�", avatar:"" }; }
}
function saveProfile(data) {
  localStorage.setItem("sw_profile", JSON.stringify(data));
}


// ===== Wardrobes =====
async function loadWardrobes() {
  try { state.wardrobes = await dbGetAll(STORE_WARDROBES); }
  catch(e) { state.wardrobes = []; }
  if (state.wardrobes.length === 0) {
    const def = { id:"w_default", name:"�ҵ��³�", createdAt:Date.now() };
    await dbPut(STORE_WARDROBES, def);
    state.wardrobes = [def];
  }
  if (!state.selectedWardrobeId || !state.wardrobes.find(w=>w.id===state.selectedWardrobeId)) {
    state.selectedWardrobeId = state.wardrobes[0].id;
  }
  for (const item of state.items) {
    if (!item.wardrobeId) { item.wardrobeId = state.selectedWardrobeId; await dbPut(STORE_ITEMS, item); }
  }
  renderWardrobeSwitcher(); renderWardrobeManager();
}
function renderWardrobeSwitcher() {
  const nameEl = document.getElementById("currentWardrobeName");
  const list = document.getElementById("wardrobeList");
  if (nameEl) { const w = state.wardrobes.find(x => x.id === state.selectedWardrobeId);
    nameEl.textContent = w ? w.name : "�ҵ��³�"; }
  if (!list) return;
  list.innerHTML = state.wardrobes.map(w => {
    const cnt = state.items.filter(i => i.wardrobeId === w.id).length;
    return "<button class=\"wardrobe-option " + (w.id === state.selectedWardrobeId ? "active" : "") + "\" data-wid=\"" + w.id + "\"><span>" + w.name + " <span class=\"w-count\">" + cnt + "��</span></span>" + (state.wardrobes.length > 1 ? "<span class=\"w-del\" data-del=\"" + w.id + "\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg></span>" : "") + "</button>";
  }).join("");
  list.querySelectorAll(".wardrobe-option").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.closest(".w-del")) return;
      state.selectedWardrobeId = btn.dataset.wid;
      document.getElementById("wardrobeDropdown").classList.add("hidden");
      document.getElementById("wardrobeToggle").classList.remove("open");
      renderWardrobeSwitcher(); renderWardrobeManager(); loadItems();
    });
  });
  list.querySelectorAll(".w-del").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wid = btn.dataset.del;
      showConfirm("ɾ���¹�", (state.wardrobes.find(x=>x.id===wid)||{}).name + "�������ｫ��ɾ��", async () => {
        for (const item of state.items.filter(i=>i.wardrobeId===wid)) await dbDelete(STORE_ITEMS, item.id);
        await dbDelete(STORE_WARDROBES, wid);
        await loadWardrobes(); await loadItems(); switchTab("wardrobe");
      });
    });
  });
}
function renderWardrobeManager() {
  const container = document.getElementById("wardrobeManager");
  if (!container) return;
  container.innerHTML = state.wardrobes.map(w => {
    const cnt = state.items.filter(i => i.wardrobeId === w.id).length;
    return "<div class=\"wardrobe-mgmt-card\"><span class=\"wardrobe-mgmt-name\">" + w.name + "</span><span class=\"wardrobe-mgmt-count\">" + cnt + "��</span><button class=\"wardrobe-mgmt-rename\" data-rename=\"" + w.id + "\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg></button>" + (state.wardrobes.length > 1 ? "<button class=\"wardrobe-mgmt-del\" data-del=\"" + w.id + "\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg></button>" : "") + "</div>";
  }).join("");
  container.querySelectorAll("[data-rename]").forEach(btn => {
    btn.addEventListener("click", () => {
      const w = state.wardrobes.find(x => x.id === btn.dataset.rename);
      const n = prompt("��������", w ? w.name : "");
      if (n && n.trim() && n.trim() !== w.name) { w.name = n.trim(); dbPut(STORE_WARDROBES, w).then(loadWardrobes); }
    });
  });
  container.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const wid = btn.dataset.del;
      showConfirm("ɾ���¹�", (state.wardrobes.find(x=>x.id===wid)||{}).name + "�������ｫ��ɾ��", async () => {
        for (const item of state.items.filter(i=>i.wardrobeId===wid)) await dbDelete(STORE_ITEMS, item.id);
        await dbDelete(STORE_WARDROBES, wid);
        await loadWardrobes(); await loadItems();
      });
    });
  });
}
function showCreateWardrobeForm() {
  const n = prompt("���¹����ƣ�", "���¹�");
  if (n && n.trim()) {
    const w = { id:"w_" + Date.now(), name:n.trim(), createdAt:Date.now() };
    dbPut(STORE_WARDROBES, w).then(async () => {
      state.selectedWardrobeId = w.id;
      await loadWardrobes(); renderWardrobeSwitcher(); renderWardrobeManager();
      switchTab("wardrobe"); showToast("�Ѵ���", "success");
    });
  }
}

function showStats() {
  const items = state.items;
  const total = items.length;
  const sum = items.reduce((s,i) => s + (parseFloat(i.price)||0), 0);
  const avg = total > 0 ? sum / total : 0;
  let maxItem = null;
  if (total > 0) {
    maxItem = items.reduce((a,b) => (parseFloat(a.price)||0) > (parseFloat(b.price)||0) ? a : b);
  }

  const cats = {};
  items.forEach(i => { const c = i.category||"other"; cats[c] = (cats[c]||0)+1; });
  const maxCat = Math.max(1, ...Object.values(cats));

  const seasons = {};
  items.forEach(i => { const s = i.season||"all"; seasons[s] = (seasons[s]||0)+1; });
  const maxSeason = Math.max(1, ...Object.values(seasons));

  const m = document.createElement("div"); m.id = "statsModal";
  m.className = "modal";
  m.innerHTML = `<div class="modal-content">
    <div class="modal-header"><h2>?? �³�ͳ��</h2>
      <button id="closeStatsBtn" class="icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="recommend-list">
      <div class="profile-stats-grid">
        <div class="profile-stat-card"><span class="ps-number">${total}</span><span class="ps-label">�ܼ���</span></div>
        <div class="profile-stat-card"><span class="ps-number">��${sum.toFixed(0)}</span><span class="ps-label">�ܼ�ֵ</span></div>
        <div class="profile-stat-card"><span class="ps-number">��${avg.toFixed(0)}</span><span class="ps-label">ƽ���۸�</span></div>
        <div class="profile-stat-card"><span class="ps-number">${maxItem ? maxItem.name : "-"}</span><span class="ps-label">���Ʒ</span></div>
      </div>
      <div class="profile-section"><h3>����ֲ�</h3>
        <div class="mini-bars">${Object.entries(cats).sort((a,b)=>b[1]-a[1])
          .map(([k,v]) => `<div class="mini-bar-row"><span class="mini-bar-label">${CATEGORIES[k]||k}</span>
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${v/maxCat*100}%"></div></div>
            <span class="mini-bar-count">${v}</span></div>`).join("")}
        </div>
      </div>
      <div class="profile-section"><h3>���ڷֲ�</h3>
        <div class="mini-bars">${Object.entries(seasons).sort((a,b)=>b[1]-a[1])
          .map(([k,v]) => `<div class="mini-bar-row"><span class="mini-bar-label">${SEASONS[k]||k}</span>
            <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${v/maxSeason*100}%"></div></div>
            <span class="mini-bar-count">${v}</span></div>`).join("")}
        </div>
      </div>
    </div>
  </div>`;

  document.body.appendChild(m);
  m.classList.remove("hidden");
  document.getElementById("modalBackdrop").classList.remove("hidden");
  document.getElementById("closeStatsBtn").addEventListener("click", () => { m.remove(); document.getElementById("modalBackdrop").classList.add("hidden"); });
  document.getElementById("modalBackdrop").addEventListener("click", () => { m.remove(); document.getElementById("modalBackdrop").classList.add("hidden"); });
}

document.addEventListener("DOMContentLoaded", init);








