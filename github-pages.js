const storageKey = "orpon-pages-state";
const exportColumns = [
  ["code", "codigo_producto", true],
  ["description", "descripcion", true],
  ["category", "categoria", true],
  ["provider", "proveedor", true],
  ["costPrice", "precio_costo", false],
  ["wholesalePrice", "precio_mayorista", true],
  ["retailPrice", "precio_minorista", true],
  ["promo1Price", "precio_promocional_1", true],
  ["promo2Price", "precio_promocional_2", true],
  ["stockQuantity", "stock_actual", true],
];

let state = loadState();
let filters = { q: "", category: "", provider: "", active: "" };
let selectedColumns = Object.fromEntries(exportColumns.map(([key, , selected]) => [key, selected]));
let pendingCostPreview = null;

function loadState() {
  const fallback = {
    products: [],
    settings: { wholesalePercentage: 0, retailPercentage: 0, promo1Percentage: 0, promo2Percentage: 0 },
    movements: [],
    costHistory: [],
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function money(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function price(cost, percentage) {
  return money(Number(cost || 0) * (1 + Number(percentage || 0) / 100));
}

function priced(product) {
  return {
    ...product,
    wholesalePrice: price(product.costPrice, state.settings.wholesalePercentage),
    retailPrice: price(product.costPrice, state.settings.retailPercentage),
    promo1Price: price(product.costPrice, state.settings.promo1Percentage),
    promo2Price: price(product.costPrice, state.settings.promo2Percentage),
  };
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

function parsePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  const raw = String(value).replace(/\s/g, "").replace(/\$/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

function render() {
  renderFilters();
  renderProducts();
  renderSettings();
  renderStockSelect();
  renderMovements();
}

function filteredProducts() {
  return state.products.map(priced).filter((product) => {
    const q = filters.q.toLowerCase();
    return (!q || product.code.toLowerCase().includes(q) || product.description.toLowerCase().includes(q))
      && (!filters.category || product.category === filters.category)
      && (!filters.provider || product.provider === filters.provider)
      && (!filters.active || String(product.active) === filters.active);
  });
}

function renderFilters() {
  const categories = [...new Set(state.products.map((p) => p.category).filter(Boolean))].sort();
  const providers = [...new Set(state.products.map((p) => p.provider).filter(Boolean))].sort();
  fillSelect("filterCategory", categories, "Todas", filters.category);
  fillSelect("filterProvider", providers, "Todos", filters.provider);
}

function fillSelect(id, values, emptyLabel, selected) {
  const el = document.getElementById(id);
  const current = selected ?? el.value;
  el.innerHTML = `<option value="">${emptyLabel}</option>` + values.map((value) => `<option ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderProducts() {
  const rows = filteredProducts();
  const target = document.getElementById("productsView");
  if (!rows.length) {
    target.innerHTML = '<p class="muted">Sin productos cargados.</p>';
    return;
  }
  target.innerHTML = `
    <div class="mobile-only mobile-list">
      ${rows.map((p) => `
        <article class="item-card">
          <header><span class="code">${escapeHtml(p.code)}</span><span class="pill ${p.active ? "good" : ""}">${p.active ? "Activo" : "Inactivo"}</span></header>
          <strong>${escapeHtml(p.description)}</strong>
          <p class="muted">${escapeHtml(p.category)} · ${escapeHtml(p.provider)}</p>
          <div class="summary">
            <div class="metric"><strong>$${p.retailPrice}</strong><span>Minorista</span></div>
            <div class="metric"><strong>${p.stockQuantity || 0}</strong><span>Stock</span></div>
          </div>
        </article>`).join("")}
    </div>
    <div class="desktop-only table-wrap">
      <table><thead><tr>${exportColumns.map(([, label]) => `<th>${label}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((p) => `<tr>${exportColumns.map(([key]) => `<td>${escapeHtml(p[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>
    </div>`;
}

function renderSettings() {
  Object.entries(state.settings).forEach(([key, value]) => {
    const el = document.getElementById(key);
    if (document.activeElement !== el) el.value = value;
  });
}

function renderStockSelect() {
  const el = document.getElementById("stockProduct");
  const selected = el.value;
  const q = String(document.getElementById("stockSearch").value || "").trim().toLowerCase();
  const products = state.products
    .filter((p) => !q || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .slice(0, 60);
  el.innerHTML = '<option value="">Seleccionar</option>' + products.map((p) => `<option value="${p.code}" ${p.code === selected ? "selected" : ""}>${escapeHtml(p.code)} - ${escapeHtml(p.description)} (${p.stockQuantity || 0})</option>`).join("");
}

function renderMovements() {
  document.getElementById("movementsView").innerHTML = table(state.movements.slice(0, 100), ["code", "description", "movementType", "quantity", "previousQuantity", "newQuantity", "reason", "createdAt"]);
}

function table(rows, columns) {
  if (!rows.length) return '<p class="muted">Sin registros.</p>';
  return `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(row[c] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function addProduct(data) {
  const code = data.code.trim();
  const existing = state.products.find((p) => p.code === code);
  const next = {
    code,
    description: data.description.trim(),
    category: data.category.trim(),
    provider: data.provider.trim(),
    costPrice: money(data.costPrice),
    unitMeasure: data.unitMeasure || "",
    active: data.active,
    stockQuantity: existing?.stockQuantity || 0,
  };
  if (existing) Object.assign(existing, next);
  else state.products.push(next);
}

function importBase(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const wb = XLSX.read(reader.result, { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const summary = { created: 0, updated: 0, ignored: 0, errors: [] };
    if (!rows.length) return toast("El Excel no tiene filas");
    const headerMap = Object.fromEntries(Object.keys(rows[0]).map((key) => [normalizeHeader(key), key]));
    const required = ["codigo_producto", "descripcion", "categoria"];
    const missing = required.filter((key) => !headerMap[key]);
    if (missing.length) return toast(`Faltan columnas: ${missing.join(", ")}`);
    rows.forEach((row, index) => {
      const code = String(row[headerMap.codigo_producto] || "").trim();
      if (!code || !row[headerMap.descripcion] || !row[headerMap.categoria]) {
        summary.ignored++;
        summary.errors.push(`Fila ${index + 2}: datos invalidos`);
        return;
      }
      const existed = state.products.some((p) => p.code === code);
      const existing = state.products.find((p) => p.code === code);
      if (existing) {
        existing.description = String(row[headerMap.descripcion]).trim();
        existing.category = String(row[headerMap.categoria]).trim();
      } else {
        state.products.push({
          code,
          description: String(row[headerMap.descripcion]).trim(),
          category: String(row[headerMap.categoria]).trim(),
          provider: "Sin proveedor",
          costPrice: 0,
          unitMeasure: "",
          active: true,
          stockQuantity: 0,
        });
      }
      existed ? summary.updated++ : summary.created++;
    });
    saveState();
    document.getElementById("baseSummary").innerHTML = summaryHtml({ creados: summary.created, actualizados: summary.updated, ignorados: summary.ignored, errores: summary.errors.length }) + errorsHtml(summary.errors);
    render();
    toast("Base importada");
  };
  reader.readAsArrayBuffer(file);
}

function previewCosts(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const wb = XLSX.read(reader.result, { type: "array" });
    const byCode = new Map(state.products.map((p) => [p.code, p]));
    const result = { sourceFile: file.name, found: 0, updated: 0, unchanged: 0, notFound: [], conflicts: [], changes: [] };
    wb.SheetNames.forEach((sheetName) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
      rows.forEach((cells, index) => {
        const codes = cells.map((v) => String(v).trim()).filter((v) => byCode.has(v));
        if (!codes.length) return;
        const product = byCode.get(codes[0]);
        result.found++;
        const candidates = [...new Set(cells.map(parsePrice).filter((value) => value !== null && value !== Number(product.costPrice)))];
        if (!candidates.length) result.unchanged++;
        else if (candidates.length > 1) result.conflicts.push({ sheet: sheetName, row: index + 1, code: product.code, prices: candidates });
        else {
          result.updated++;
          result.changes.push({ code: product.code, description: product.description, provider: product.provider, oldCostPrice: product.costPrice, newCostPrice: candidates[0] });
        }
      });
    });
    pendingCostPreview = result;
    document.getElementById("costPreview").innerHTML = summaryHtml({ encontrados: result.found, cambios: result.updated, "sin cambios": result.unchanged, conflictos: result.conflicts.length })
      + '<div class="actions"><button class="btn good" id="confirmCosts">Confirmar cambios</button></div>'
      + table(result.changes, ["code", "description", "provider", "oldCostPrice", "newCostPrice"])
      + errorsHtml(result.conflicts.map((c) => `${c.sheet} fila ${c.row}: ${c.code} tiene varios precios (${c.prices.join(", ")})`));
    document.getElementById("confirmCosts").onclick = confirmCosts;
  };
  reader.readAsArrayBuffer(file);
}

function confirmCosts() {
  if (!pendingCostPreview?.changes.length) return toast("No hay cambios para aplicar");
  if (!confirm("Confirmar actualizacion de costos?")) return;
  pendingCostPreview.changes.forEach((change) => {
    const product = state.products.find((p) => p.code === change.code);
    if (!product) return;
    state.costHistory.unshift({ ...change, sourceFile: pendingCostPreview.sourceFile, createdAt: new Date().toISOString() });
    product.costPrice = change.newCostPrice;
  });
  saveState();
  render();
  toast("Costos actualizados");
}

function summaryHtml(data) {
  return `<div class="summary">${Object.entries(data).map(([key, value]) => `<div class="metric"><strong>${value}</strong><span>${key}</span></div>`).join("")}</div>`;
}

function errorsHtml(errors) {
  return errors?.length ? `<div>${errors.slice(0, 20).map((e) => `<p class="muted">${escapeHtml(e)}</p>`).join("")}</div>` : "";
}

function exportData(type) {
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");
  modal.innerHTML = `<div class="modal"><h2>Columnas a exportar</h2>${exportColumns.map(([key, label]) => `<label class="checkbox-row"><input type="checkbox" data-column="${key}" ${selectedColumns[key] ? "checked" : ""} /> ${label}</label>`).join("")}<div class="actions"><button class="btn secondary" id="cancelExport">Cancelar</button><button class="btn" id="confirmExport">Exportar</button></div></div>`;
  modal.querySelectorAll("[data-column]").forEach((input) => input.onchange = () => selectedColumns[input.dataset.column] = input.checked);
  document.getElementById("cancelExport").onclick = () => modal.classList.add("hidden");
  document.getElementById("confirmExport").onclick = () => {
    const columns = exportColumns.filter(([key]) => selectedColumns[key]);
    const rows = filteredProducts();
    if (type === "excel") {
      const data = rows.map((row) => Object.fromEntries(columns.map(([key, label]) => [label, row[key]])));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "lista");
      XLSX.writeFile(wb, "lista-precios-orpon.xlsx");
    } else {
      const doc = new window.jspdf.jsPDF({ orientation: "landscape" });
      doc.text("Orpon Descartables - Lista de precios", 14, 12);
      doc.autoTable({ head: [columns.map(([, label]) => label)], body: rows.map((row) => columns.map(([key]) => String(row[key] ?? ""))), styles: { fontSize: 7 }, headStyles: { fillColor: [225, 37, 27] } });
      doc.save("lista-precios-orpon.pdf");
    }
    modal.classList.add("hidden");
  };
}

document.querySelectorAll(".tab").forEach((button) => button.onclick = () => {
  document.querySelectorAll(".tab,.view").forEach((el) => el.classList.remove("active"));
  button.classList.add("active");
  document.getElementById(button.dataset.tab).classList.add("active");
});

["filterQ", "filterCategory", "filterProvider", "filterActive"].forEach((id) => {
  document.getElementById(id).oninput = (event) => {
    const map = { filterQ: "q", filterCategory: "category", filterProvider: "provider", filterActive: "active" };
    filters[map[id]] = event.target.value;
    render();
  };
});

document.getElementById("downloadTemplate").onclick = () => {
  const rows = [{ codigo_producto: "COD-001", descripcion: "Vaso plastico 180cc", categoria: "Vasos" }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "productos");
  XLSX.writeFile(wb, "plantilla-productos-orpon.xlsx");
};
document.getElementById("baseFile").onchange = (event) => importBase(event.target.files[0]);
document.getElementById("costFile").onchange = (event) => previewCosts(event.target.files[0]);
document.getElementById("stockSearch").oninput = renderStockSelect;
document.getElementById("exportExcel").onclick = () => exportData("excel");
document.getElementById("exportPdf").onclick = () => exportData("pdf");
document.getElementById("saveSettings").onclick = () => {
  Object.keys(state.settings).forEach((key) => state.settings[key] = Number(document.getElementById(key).value || 0));
  saveState();
  render();
  toast("Porcentajes guardados");
};
document.getElementById("productForm").onsubmit = (event) => {
  event.preventDefault();
  addProduct({
    code: code.value,
    description: description.value,
    category: category.value,
    provider: provider.value,
    costPrice: costPrice.value,
    unitMeasure: unitMeasure.value,
    active: active.checked,
  });
  saveState();
  event.target.reset();
  active.checked = true;
  render();
  toast("Producto guardado");
};
document.getElementById("stockForm").onsubmit = (event) => {
  event.preventDefault();
  const product = state.products.find((p) => p.code === stockProduct.value);
  if (!product) return toast("Seleccionar producto");
  const previous = Number(product.stockQuantity || 0);
  const quantity = Number(stockQuantity.value);
  const next = stockType.value === "entrada" ? previous + quantity : stockType.value === "salida" ? previous - quantity : quantity;
  if (next < 0) return toast("El stock no puede quedar negativo");
  product.stockQuantity = money(next);
  state.movements.unshift({ code: product.code, description: product.description, movementType: stockType.value, quantity, previousQuantity: previous, newQuantity: product.stockQuantity, reason: stockReason.value, notes: stockNotes.value, createdAt: new Date().toLocaleString("es-AR") });
  saveState();
  event.target.reset();
  stockQuantity.value = 1;
  render();
  toast("Movimiento registrado");
};

render();
