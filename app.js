/* ============================================
   Smart Wardrobe - App Logic
   ============================================ */

// =============================================
// Data Model & State
// =============================================
const CATEGORIES = {
  tops: "上衣", bottoms: "下装", shoes: "鞋子",
  outerwear: "外套", dresses: "连衣裙", accessories: "配饰"
};

const SEASONS = {
  all: "全年", spring: "春季", summer: "夏季", autumn: "秋季", winter: "冬季"
};

const SEASON_EMOJI = { all: "", spring: "🌸", summer: "☀️", autumn: "🍂", winter: "❄️" };

let state = {
  items: [],
  categoryFilter: "all",
  seasonFilter: "all",
  searchQuery: "",
  sortBy: "newest",
  editingId: null
};

// =============================================
// IndexedDB Setup
// =============================================
const DB_NAME = "SmartWardrobeDB";
const DB_VERSION = 1;
const STORE_NAME = "items";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("category", "category", { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// =============================================
// Image Handling
// =============================================
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataURL, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = dataURL;
  });
}
// =============================================
// CRUD Operations
// =============================================
async function loadItems() {
  try {
    state.items = await dbGetAll();
  } catch (e) {
    console.error("Failed to load items:", e);
    showToast("加载数据失败", "error");
    state.items = [];
  }
  render();
}

async function saveItem(itemData) {
  try {
    const now = Date.now();
    const item = {
      ...itemData,
      createdAt: itemData.createdAt || now,
      updatedAt: now
    };
    if (!item.id) item.id = "item_" + now + "_" + Math.random().toString(36).substr(2, 6);
    await dbPut(item);
    await loadItems();
    showToast(itemData.id ? "已更新" : "已添加", "success");
    return item;
  } catch (e) {
    console.error("Failed to save item:", e);
    showToast("保存失败", "error");
  }
}

async function deleteItem(id) {
  try {
    await dbDelete(id);
    await loadItems();
    showToast("已删除", "success");
  } catch (e) {
    console.error("Failed to delete item:", e);
    showToast("删除失败", "error");
  }
}

// =============================================
// Filtering & Sorting
// =============================================
function getFilteredItems() {
  let items = [...state.items];

  if (state.categoryFilter !== "all") {
    items = items.filter((i) => i.category === state.categoryFilter);
  }
  if (state.seasonFilter !== "all") {
    items = items.filter((i) => i.season === state.seasonFilter || i.season === "all");
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    items = items.filter((i) =>
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.brand && i.brand.toLowerCase().includes(q)) ||
      (i.notes && i.notes.toLowerCase().includes(q))
    );
  }

  items.sort((a, b) => {
    switch (state.sortBy) {
      case "newest": return b.createdAt - a.createdAt;
      case "oldest": return a.createdAt - b.createdAt;
      case "name": return (a.name || "").localeCompare(b.name || "", "zh");
      case "price_high": return (b.price || 0) - (a.price || 0);
      case "price_low": return (a.price || 0) - (b.price || 0);
      default: return b.createdAt - a.createdAt;
    }
  });

  return items;
}

// =============================================
// Rendering
// =============================================
function render() {
  const filtered = getFilteredItems();
  const grid = document.getElementById("itemsGrid");
  const empty = document.getElementById("emptyState");
  const count = document.getElementById("itemCount");

  count.textContent = "共 " + state.items.length + " 件单品";

  // Total value
  const total = state.items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);
  document.getElementById("totalValue").textContent = "总价值: ¥" + total.toFixed(0);

  if (filtered.length === 0) {
    grid.classList.add("hidden");
    empty.classList.remove("hidden");
    // Adjust empty message based on filters
    const hasFilters = state.categoryFilter !== "all" || state.seasonFilter !== "all" || state.searchQuery;
    empty.querySelector("h2").textContent = hasFilters ? "没有匹配的衣物" : "衣橱还是空的";
    empty.querySelector("p").textContent = hasFilters ? "试试调整筛选条件" : "点击下方按钮，添加你的第一件衣物吧";
    return;
  }

  grid.classList.remove("hidden");
  empty.classList.add("hidden");
  grid.innerHTML = "";

  for (const item of filtered) {
    grid.appendChild(createCard(item));
  }
}

function createCard(item) {
  const card = document.createElement("div");
  card.className = "item-card";
  card.dataset.id = item.id;

  // Image
  if (item.imageData) {
    const img = document.createElement("img");
    img.className = "item-card-image";
    img.src = item.imageData;
    img.alt = item.name || "衣物图片";
    img.loading = "lazy";
    card.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "item-card-image-placeholder";
    placeholder.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    card.appendChild(placeholder);
  }

  // Info
  const info = document.createElement("div");
  info.className = "item-card-info";

  const name = document.createElement("div");
  name.className = "item-card-name";
  name.textContent = item.name || "未命名";

  const brand = document.createElement("div");
  brand.className = "item-card-brand";
  brand.textContent = item.brand || "";

  const meta = document.createElement("div");
  meta.className = "item-card-meta";

  if (item.price) {
    const price = document.createElement("span");
    price.className = "item-card-price";
    price.textContent = "¥" + parseFloat(item.price).toFixed(0);
    meta.appendChild(price);
  }

  if (item.season && item.season !== "all") {
    const season = document.createElement("span");
    season.className = "item-card-season";
    season.textContent = SEASON_EMOJI[item.season] + SEASONS[item.season];
    meta.appendChild(season);
  }

  info.appendChild(name);
  info.appendChild(brand);
  info.appendChild(meta);
  card.appendChild(info);

  card.addEventListener("click", () => showDetail(item.id));
  return card;
}
// =============================================
// Modal Management
// =============================================
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
  document.getElementById("modalBackdrop").classList.remove("hidden");
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((m) => m.classList.add("hidden"));
  document.getElementById("modalBackdrop").classList.add("hidden");
}

// ---- Add/Edit Form ----
function openForm(itemId) {
  const modal = document.getElementById("itemFormModal");
  const title = document.getElementById("modalTitle");
  const form = document.getElementById("itemForm");

  form.reset();
  document.getElementById("itemId").value = "";
  document.getElementById("imagePreview").innerHTML =
    '<div class="image-placeholder">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
    "<span>点击上传图片</span></div>";
  document.getElementById("imageActions").classList.add("hidden");
  document.getElementById("itemSeason").value = "all";
  document.getElementById("itemColor").value = "#808080";
  document.getElementById("itemColorText").value = "";

  state.editingId = null;

  if (itemId) {
    const item = state.items.find((i) => i.id === itemId);
    if (item) {
      state.editingId = itemId;
      title.textContent = "编辑衣物";
      document.getElementById("itemId").value = itemId;
      document.getElementById("itemName").value = item.name || "";
      document.getElementById("itemCategory").value = item.category || "";
      document.getElementById("itemBrand").value = item.brand || "";
      document.getElementById("itemPrice").value = item.price || "";
      document.getElementById("itemSeason").value = item.season || "all";
      document.getElementById("itemColor").value = item.color || "#808080";
      document.getElementById("itemColorText").value = item.colorText || "";
      document.getElementById("itemNotes").value = item.notes || "";

      if (item.imageData) {
        document.getElementById("imagePreview").innerHTML =
          '<img src="' + item.imageData + '" alt="预览">';
        document.getElementById("imageActions").classList.remove("hidden");
      }
    }
  } else {
    title.textContent = "添加衣物";
  }

  openModal("itemFormModal");
}

function showDetail(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  document.getElementById("detailTitle").textContent = item.name || "衣物详情";

  const img = document.getElementById("detailImage");
  if (item.imageData) {
    img.src = item.imageData;
    img.alt = item.name || "";
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }

  document.getElementById("detailName").textContent = item.name || "-";
  document.getElementById("detailCategory").textContent = CATEGORIES[item.category] || item.category || "-";
  document.getElementById("detailBrand").textContent = item.brand || "-";
  document.getElementById("detailPrice").textContent = item.price ? "¥" + parseFloat(item.price).toFixed(2) : "-";

  const seasonText = item.season ? (SEASON_EMOJI[item.season] + " " + SEASONS[item.season]).trim() : "-";
  document.getElementById("detailSeason").textContent = seasonText;

  const swatch = document.getElementById("detailColorSwatch");
  const colorText = document.getElementById("detailColorText");
  if (item.color || item.colorText) {
    swatch.style.backgroundColor = item.color || "#808080";
    colorText.textContent = item.colorText || "";
    document.getElementById("detailColor").style.display = "flex";
  } else {
    document.getElementById("detailColor").style.display = "none";
  }

  document.getElementById("detailDate").textContent = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString("zh-CN", {
        year: "numeric", month: "long", day: "numeric"
      })
    : "-";
  document.getElementById("detailNotes").textContent = item.notes || "无";

  document.getElementById("editItemBtn").onclick = () => { closeAllModals(); openForm(id); };
  document.getElementById("deleteItemBtn").onclick = () => showConfirm("删除衣物", item.name + " 将被永久删除。", () => deleteItem(id));

  openModal("itemDetailModal");
}

// ---- Confirm Dialog ----
let confirmCallback = null;

function showConfirm(title, message, callback) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  confirmCallback = callback;
  openModal("confirmDialog");
}

// ---- Statistics ----
function showStats() {
  const items = state.items;
  const total = items.length;
  const sum = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const avg = total > 0 ? sum / total : 0;
  const maxItem = items.length > 0
    ? items.reduce((a, b) => ((parseFloat(a.price) || 0) > (parseFloat(b.price) || 0) ? a : b))
    : null;

  document.getElementById("statTotalItems").textContent = total;
  document.getElementById("statTotalValue").textContent = "¥" + sum.toFixed(0);
  document.getElementById("statAvgPrice").textContent = "¥" + avg.toFixed(0);
  document.getElementById("statMostExpensive").textContent = maxItem ? maxItem.name : "-";

  // Category breakdown
  const catCounts = {};
  for (const item of items) {
    const cat = item.category || "other";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const maxCat = Math.max(1, ...Object.values(catCounts));
  const catContainer = document.getElementById("categoryStats");
  catContainer.innerHTML = "";
  for (const [key, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / maxCat) * 100;
    catContainer.appendChild(createStatBar(CATEGORIES[key] || key, pct, count));
  }

  // Season breakdown
  const seasonCounts = {};
  for (const item of items) {
    const s = item.season || "all";
    seasonCounts[s] = (seasonCounts[s] || 0) + 1;
  }
  const maxSeason = Math.max(1, ...Object.values(seasonCounts));
  const seasonContainer = document.getElementById("seasonStats");
  seasonContainer.innerHTML = "";
  for (const [key, count] of Object.entries(seasonCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / maxSeason) * 100;
    seasonContainer.appendChild(createStatBar(SEASONS[key] || key, pct, count));
  }

  openModal("statsModal");
}

function createStatBar(label, pct, count) {
  const row = document.createElement("div");
  row.className = "stat-bar-row";
  row.innerHTML =
    '<span class="stat-bar-label">' + label + '</span>' +
    '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + pct + '%"></div></div>' +
    '<span class="stat-bar-count">' + count + '</span>';
  return row;
}
// =============================================
// Toast
// =============================================
let toastTimer = null;

function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast " + (type || "info");
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
}

// =============================================
// Event Handlers
// =============================================
function initEventListeners() {
  // Add item buttons
  document.getElementById("addItemBtn").addEventListener("click", () => openForm());
  document.getElementById("emptyAddBtn").addEventListener("click", () => openForm());
  document.getElementById("fabAddBtn").addEventListener("click", () => openForm());

  // Close modals
  document.getElementById("closeFormModal").addEventListener("click", closeAllModals);
  document.getElementById("closeDetailModal").addEventListener("click", closeAllModals);
  document.getElementById("closeStatsModal").addEventListener("click", closeAllModals);
  document.getElementById("cancelFormBtn").addEventListener("click", closeAllModals);
  document.getElementById("modalBackdrop").addEventListener("click", closeAllModals);
  document.getElementById("confirmCancelBtn").addEventListener("click", closeAllModals);

  // Confirm dialog
  document.getElementById("confirmOkBtn").addEventListener("click", () => {
    closeAllModals();
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
  });

  // Form submit
  document.getElementById("itemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("itemId").value || null;
    const existing = id ? state.items.find((i) => i.id === id) : null;

    const data = {
      name: document.getElementById("itemName").value.trim(),
      category: document.getElementById("itemCategory").value,
      brand: document.getElementById("itemBrand").value.trim(),
      price: parseFloat(document.getElementById("itemPrice").value) || 0,
      season: document.getElementById("itemSeason").value,
      color: document.getElementById("itemColor").value,
      colorText: document.getElementById("itemColorText").value.trim(),
      notes: document.getElementById("itemNotes").value.trim(),
    };

    if (!data.name) { showToast("请输入名称", "error"); return; }
    if (!data.category) { showToast("请选择分类", "error"); return; }

    if (existing) {
      data.id = existing.id;
      data.createdAt = existing.createdAt;
      data.imageData = existing.imageData;
    }

    // Image data is stored separately
    if (window._pendingImageData) {
      data.imageData = window._pendingImageData;
      window._pendingImageData = null;
    }

    await saveItem(data);
    closeAllModals();
  });

  // Image upload
  const imagePreview = document.getElementById("imagePreview");
  const imageInput = document.getElementById("imageInput");

  imagePreview.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const dataURL = await readFileAsDataURL(file);
      const compressed = await compressImage(dataURL, 800);
      window._pendingImageData = compressed;
      imagePreview.innerHTML = '<img src="' + compressed + '" alt="预览">';
      document.getElementById("imageActions").classList.remove("hidden");
    } catch (err) {
      showToast("图片加载失败", "error");
    }
  });

  document.getElementById("changeImageBtn").addEventListener("click", () => imageInput.click());
  document.getElementById("removeImageBtn").addEventListener("click", () => {
    window._pendingImageData = null;
    imageInput.value = "";
    imagePreview.innerHTML =
      '<div class="image-placeholder">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
      "<span>点击上传图片</span></div>";
    document.getElementById("imageActions").classList.add("hidden");
  });

  // Category filters
  document.querySelectorAll("#categoryFilters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#categoryFilters .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.categoryFilter = chip.dataset.category;
      render();
    });
  });

  // Season filters
  document.querySelectorAll("#seasonFilters .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#seasonFilters .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.seasonFilter = chip.dataset.season;
      render();
    });
  });

  // Search
  document.getElementById("searchToggle").addEventListener("click", () => {
    const bar = document.getElementById("searchBar");
    bar.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) {
      document.getElementById("searchInput").focus();
    } else {
      document.getElementById("searchInput").value = "";
      state.searchQuery = "";
      render();
    }
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim();
    document.getElementById("searchClear").classList.toggle("hidden", !state.searchQuery);
    render();
  });

  document.getElementById("searchClear").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    state.searchQuery = "";
    document.getElementById("searchClear").classList.add("hidden");
    render();
  });

  // Sort
  const sortToggle = document.getElementById("sortToggle");
  const sortMenu = document.getElementById("sortMenu");

  sortToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!sortMenu.classList.contains("hidden") && !sortMenu.contains(e.target) && e.target !== sortToggle) {
      sortMenu.classList.add("hidden");
    }
  });

  document.querySelectorAll(".sort-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".sort-option").forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      sortMenu.classList.add("hidden");
      state.sortBy = opt.dataset.sort;
      // Update button text
      sortToggle.childNodes[2].textContent = opt.textContent;
      render();
    });
  });

  // Stats
  document.getElementById("statsToggle").addEventListener("click", showStats);
}

// =============================================
// Init
// =============================================
document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadItems();
});
