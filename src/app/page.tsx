"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Boxes, FileDown, FileSpreadsheet, PackagePlus, Percent, Settings, Upload, Warehouse } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Product = {
  id: number;
  code: string;
  description: string;
  unitMeasure?: string | null;
  notes?: string | null;
  category: string;
  provider: string;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  promo1Price: number;
  promo2Price: number;
  stockQuantity: number;
  active: boolean;
};

type SettingsForm = {
  wholesalePercentage: number;
  retailPercentage: number;
  promo1Percentage: number;
  promo2Percentage: number;
};

type Category = {
  id: number;
  name: string;
};

const tabs = [
  ["lista", "Lista", Boxes],
  ["base", "Base", Upload],
  ["costos", "Costos", FileSpreadsheet],
  ["porcentajes", "Porcentajes", Percent],
  ["stock", "Stock", Warehouse],
  ["productos", "Productos", PackagePlus],
] as const;

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
] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("lista");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryRows, setCategoryRows] = useState<Category[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsForm>({ wholesalePercentage: 0, retailPercentage: 0, promo1Percentage: 0, promo2Percentage: 0 });
  const [filters, setFilters] = useState({ q: "", category: "", provider: "", active: "" });
  const [toast, setToast] = useState("");
  const [baseSummary, setBaseSummary] = useState<any>(null);
  const [costPreview, setCostPreview] = useState<any>(null);
  const [costFile, setCostFile] = useState<File | null>(null);
  const [stockLookup, setStockLookup] = useState<"code" | "description" | null>(null);
  const [stockCodeSearch, setStockCodeSearch] = useState("");
  const [stockDescriptionSearch, setStockDescriptionSearch] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ code: "", description: "", categoryName: "", providerName: "", costPrice: 0, unitMeasure: "", notes: "", active: true });
  const [showExport, setShowExport] = useState<"excel" | "pdf" | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(exportColumns.map(([key, , selected]) => [key, selected])),
  );
  const [productForm, setProductForm] = useState({ code: "", description: "", categoryName: "", providerName: "", costPrice: 0, unitMeasure: "", notes: "", active: true });
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, string>>({});
  const [stockForm, setStockForm] = useState({ productId: "", movementType: "entrada", quantity: 1, reason: "", notes: "" });
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  async function loadAll() {
    const query = new URLSearchParams();
    if (filters.q) query.set("q", filters.q);
    if (filters.category) query.set("category", filters.category);
    if (filters.provider) query.set("provider", filters.provider);
    if (filters.active) query.set("active", filters.active);
    const [productRes, categoryRes, providerRes, settingsRes, movementsRes] = await Promise.all([
      fetch(`/api/products?${query}`),
      fetch("/api/categories"),
      fetch("/api/providers"),
      fetch("/api/price-settings"),
      fetch("/api/stock/movements"),
    ]);
    setProducts(await productRes.json());
    const loadedCategories = await categoryRes.json();
    setCategoryRows(loadedCategories);
    setCategories(loadedCategories.map((row: any) => row.name));
    setCategoryDrafts(Object.fromEntries(loadedCategories.map((row: any) => [row.id, row.name])));
    setProviders((await providerRes.json()).map((row: any) => row.name));
    const rawSettings = await settingsRes.json();
    setSettings({
      wholesalePercentage: Number(rawSettings.wholesalePercentage),
      retailPercentage: Number(rawSettings.retailPercentage),
      promo1Percentage: Number(rawSettings.promo1Percentage),
      promo2Percentage: Number(rawSettings.promo2Percentage),
    });
    setStockMovements(await movementsRes.json());
  }

  useEffect(() => {
    loadAll().catch(() => notify("No se pudieron cargar los datos"));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadAll().catch(() => notify("No se pudieron aplicar los filtros")), 250);
    return () => clearTimeout(timer);
  }, [filters]);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3200);
  }

  async function uploadBase(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/base", { method: "POST", body: form });
    const body = await res.json();
    setBaseSummary(body);
    if (!res.ok) notify("Importacion con errores");
    else notify("Base importada");
    await loadAll();
  }

  async function clearProductsBase() {
    const firstConfirm = confirm("Esto elimina todos los productos, stock, movimientos e historial de costos de la base de datos. Continuar?");
    if (!firstConfirm) return;
    const confirmationText = prompt('Para confirmar escribi "ELIMINAR"');
    if (confirmationText !== "ELIMINAR") return notify("Borrado cancelado");

    const res = await fetch("/api/products/clear", { method: "DELETE" });
    if (!res.ok) return notify("No se pudo eliminar la base");
    const result = await res.json();
    setBaseSummary(null);
    notify(`Productos eliminados: ${result.products ?? 0}`);
    await loadAll();
  }

  async function previewCosts(file: File | null) {
    if (!file) return;
    setCostFile(file);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/cost-preview", { method: "POST", body: form });
    const body = await res.json();
    setCostPreview(body);
    notify(res.ok ? "Previsualizacion lista" : "No se pudo analizar el Excel");
  }

  async function confirmCosts() {
    if (!costPreview?.changes?.length) return;
    if (!confirm("Confirmar actualizacion de costos?")) return;
    const res = await fetch("/api/imports/cost-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFile: costFile?.name, changes: costPreview.changes }),
    });
    const body = await res.json();
    notify(`Cambios aplicados: ${body.applied ?? 0}`);
    setCostPreview(null);
    await loadAll();
  }

  async function saveSettings() {
    const res = await fetch("/api/price-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    notify(res.ok ? "Porcentajes guardados" : "No se pudieron guardar");
    await loadAll();
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productForm),
    });
    if (!res.ok) return notify("Revisar datos del producto");
    setProductForm({ code: "", description: "", categoryName: "", providerName: "", costPrice: 0, unitMeasure: "", notes: "", active: true });
    notify("Producto guardado");
    await loadAll();
  }

  async function saveCategory(category: Category) {
    const name = (categoryDrafts[category.id] || "").trim();
    if (!name) return notify("Nombre de categoria obligatorio");
    const res = await fetch(`/api/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return notify("No se pudo guardar la categoria");
    notify("Categoria actualizada");
    await loadAll();
  }

  async function saveStock(event: FormEvent) {
    event.preventDefault();
    if (!stockForm.productId) return notify("Seleccionar producto");
    const res = await fetch("/api/stock/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stockForm),
    });
    if (!res.ok) return notify((await res.json()).error || "No se pudo registrar");
    setStockForm({ productId: "", movementType: "entrada", quantity: 1, reason: "", notes: "" });
    setStockCodeSearch("");
    setStockDescriptionSearch("");
    notify("Movimiento registrado");
    await loadAll();
  }

  const selectedExportColumns = useMemo(() => exportColumns.filter(([key]) => selectedColumns[key]), [selectedColumns]);
  const stockSuggestions = useMemo(() => {
    const query = (stockLookup === "description" ? stockDescriptionSearch : stockCodeSearch).trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((product) => product.code.toLowerCase().includes(query) || product.description.toLowerCase().includes(query))
      .sort((a, b) => {
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        const aDescription = a.description.toLowerCase();
        const bDescription = b.description.toLowerCase();
        const score = (product: Product, code: string, description: string) =>
          code === query ? 0 : description === query ? 1 : code.startsWith(query) ? 2 : description.startsWith(query) ? 3 : 4;
        return score(a, aCode, aDescription) - score(b, bCode, bDescription) || a.code.localeCompare(b.code);
      })
      .slice(0, 8);
  }, [products, stockCodeSearch, stockDescriptionSearch, stockLookup]);

  function selectStockProduct(product: Product) {
    setStockForm({ ...stockForm, productId: String(product.id) });
    setStockCodeSearch(product.code);
    setStockDescriptionSearch(product.description);
    setStockLookup(null);
  }

  function openEditProduct(product: Product) {
    setEditProduct(product);
    setEditForm({
      code: product.code,
      description: product.description,
      categoryName: product.category,
      providerName: product.provider,
      costPrice: product.costPrice,
      unitMeasure: product.unitMeasure || "",
      notes: product.notes || "",
      active: product.active,
    });
  }

  async function saveEditedProduct(event: FormEvent) {
    event.preventDefault();
    if (!editProduct) return;
    const res = await fetch(`/api/products/${editProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) return notify("No se pudo guardar el producto");
    setEditProduct(null);
    notify("Producto actualizado");
    await loadAll();
  }

  function exportExcel() {
    const rows = products.map((product) => Object.fromEntries(selectedExportColumns.map(([key, label]) => [label, (product as any)[key]])));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "lista");
    XLSX.writeFile(wb, "lista-precios-orpon.xlsx");
    setShowExport(null);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Orpon Descartables - Lista de precios", 14, 12);
    autoTable(doc, {
      head: [selectedExportColumns.map(([, label]) => label)],
      body: products.map((product) => selectedExportColumns.map(([key]) => String((product as any)[key] ?? ""))),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [225, 37, 27] },
    });
    doc.save("lista-precios-orpon.pdf");
    setShowExport(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/brand/logo.png" alt="Orpon Descartables" />
          <div>
            <h1>Orpon Descartables</h1>
            <p>Gestion comercial</p>
          </div>
        </div>
        <nav className="tabs">
          {tabs.map(([key, label, Icon]) => (
            <button key={key} className={`tab ${activeTab === key ? "active" : ""}`} onClick={() => setActiveTab(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {activeTab === "lista" && (
          <>
            <section className="panel">
              <h2>Lista de precios</h2>
              <div className="grid two">
                <label className="field"><span>Codigo o descripcion</span><input className="input" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
                <label className="field"><span>Categoria</span><select className="select" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">Todas</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="field"><span>Proveedor</span><select className="select" value={filters.provider} onChange={(e) => setFilters({ ...filters, provider: e.target.value })}><option value="">Todos</option>{providers.map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="field"><span>Estado</span><select className="select" value={filters.active} onChange={(e) => setFilters({ ...filters, active: e.target.value })}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></label>
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setShowExport("excel")}><FileDown size={18} /> Excel</button>
                <button className="btn secondary" onClick={() => setShowExport("pdf")}><FileDown size={18} /> PDF</button>
              </div>
            </section>
            <ProductList products={products} onEdit={openEditProduct} />
          </>
        )}

        {activeTab === "base" && (
          <>
            <section className="panel">
              <h2>Carga de base</h2>
              <div className="actions">
                <a className="btn secondary" href="/api/imports/template">Descargar plantilla</a>
                <label className="btn"><Upload size={18} /> Importar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={(e) => uploadBase(e.target.files?.[0] || null)} /></label>
              </div>
              {baseSummary && <Summary data={{ creados: baseSummary.created, actualizados: baseSummary.updated, ignorados: baseSummary.ignored, errores: baseSummary.errors?.length || 0 }} />}
              {baseSummary?.errors?.length ? <ErrorList errors={baseSummary.errors} /> : null}
            </section>
            <section className="panel danger-panel">
              <h2>Eliminar base de productos</h2>
              <p className="muted">Borra definitivamente productos, stock, movimientos e historial de costos en PostgreSQL.</p>
              <div className="actions">
                <button className="btn danger" type="button" onClick={clearProductsBase}>Eliminar toda la base</button>
              </div>
            </section>
          </>
        )}

        {activeTab === "costos" && (
          <section className="panel">
            <h2>Actualizacion de costos</h2>
            <label className="btn"><FileSpreadsheet size={18} /> Analizar Excel<input hidden type="file" accept=".xlsx,.xls" onChange={(e) => previewCosts(e.target.files?.[0] || null)} /></label>
            {costPreview && (
              <>
                <Summary data={{ encontrados: costPreview.found, cambios: costPreview.updated, "sin cambios": costPreview.unchanged, conflictos: costPreview.conflicts.length }} />
                <div className="actions" style={{ margin: "12px 0" }}>
                  <button className="btn good" onClick={confirmCosts} disabled={!costPreview.changes.length}>Confirmar cambios</button>
                </div>
                <DataTable rows={costPreview.changes} columns={["code", "description", "provider", "oldCostPrice", "newCostPrice"]} />
                {costPreview.conflicts?.length ? <ErrorList errors={costPreview.conflicts.map((row: any) => `${row.sheet} fila ${row.row}: ${row.code} tiene varios precios posibles (${row.prices.join(", ")})`)} /> : null}
              </>
            )}
          </section>
        )}

        {activeTab === "porcentajes" && (
          <section className="panel">
            <h2>Porcentajes</h2>
            <div className="grid two">
              {Object.entries(settings).map(([key, value]) => (
                <label className="field" key={key}><span>{settingLabel(key)}</span><input className="input" type="number" min="0" step="0.01" value={value} onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>
              ))}
            </div>
            <div className="actions" style={{ marginTop: 12 }}><button className="btn good" onClick={saveSettings}><Settings size={18} /> Guardar</button></div>
          </section>
        )}

        {activeTab === "stock" && (
          <>
            <section className="panel">
              <h2>Stock</h2>
              <form className="grid two" onSubmit={saveStock}>
                <label className="field autocomplete-field"><span>Codigo</span><input className="input" value={stockCodeSearch} onFocus={() => setStockLookup("code")} onBlur={() => setTimeout(() => setStockLookup(null), 120)} onChange={(e) => { setStockLookup("code"); setStockForm({ ...stockForm, productId: "" }); setStockCodeSearch(e.target.value); }} placeholder="Buscar por codigo" />{stockLookup === "code" && <ProductSuggestions products={stockSuggestions} onSelect={selectStockProduct} />}</label>
                <label className="field autocomplete-field"><span>Descripcion</span><input className="input" value={stockDescriptionSearch} onFocus={() => setStockLookup("description")} onBlur={() => setTimeout(() => setStockLookup(null), 120)} onChange={(e) => { setStockLookup("description"); setStockForm({ ...stockForm, productId: "" }); setStockDescriptionSearch(e.target.value); }} placeholder="Buscar por descripcion" />{stockLookup === "description" && <ProductSuggestions products={stockSuggestions} onSelect={selectStockProduct} />}</label>
                <label className="field"><span>Categoria</span><input className="input" value={products.find((product) => String(product.id) === stockForm.productId)?.category || ""} readOnly /></label>
                <label className="field"><span>Tipo</span><select className="select" value={stockForm.movementType} onChange={(e) => setStockForm({ ...stockForm, movementType: e.target.value })}><option value="entrada">Entrada</option><option value="salida">Salida</option><option value="ajuste">Ajuste</option></select></label>
                <label className="field"><span>Cantidad</span><input className="input" type="number" min="0.01" step="0.01" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} /></label>
                <label className="field"><span>Motivo</span><input className="input" value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} /></label>
                <label className="field"><span>Observaciones</span><textarea className="textarea" value={stockForm.notes} onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} /></label>
                <div className="actions"><button className="btn good">Registrar</button></div>
              </form>
            </section>
            <section className="panel"><h3>Ultimos movimientos</h3><DataTable rows={stockMovements} columns={["productCode", "productDescription", "movementType", "quantity", "previousQuantity", "newQuantity", "reason"]} /></section>
          </>
        )}

        {activeTab === "productos" && (
          <>
            <section className="panel">
              <h2>Producto</h2>
              <form className="grid two" onSubmit={saveProduct}>
                <label className="field"><span>Codigo</span><input className="input" required value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} /></label>
                <label className="field"><span>Descripcion</span><input className="input" required value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
                <label className="field"><span>Categoria</span><input className="input" required list="categories" value={productForm.categoryName} onChange={(e) => setProductForm({ ...productForm, categoryName: e.target.value })} /></label>
                <label className="field"><span>Proveedor</span><input className="input" required list="providers" value={productForm.providerName} onChange={(e) => setProductForm({ ...productForm, providerName: e.target.value })} /></label>
                <label className="field"><span>Costo</span><input className="input" required type="number" min="0" step="0.01" value={productForm.costPrice} onChange={(e) => setProductForm({ ...productForm, costPrice: Number(e.target.value) })} /></label>
                <label className="field"><span>Unidad</span><input className="input" value={productForm.unitMeasure} onChange={(e) => setProductForm({ ...productForm, unitMeasure: e.target.value })} /></label>
                <label className="checkbox-row"><input type="checkbox" checked={productForm.active} onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })} /> Activo</label>
                <div className="actions"><button className="btn good">Guardar producto</button></div>
              </form>
              <datalist id="categories">{categories.map((name) => <option key={name} value={name} />)}</datalist>
              <datalist id="providers">{providers.map((name) => <option key={name} value={name} />)}</datalist>
            </section>
            <section className="panel">
              <h2>Categorias</h2>
              <div className="category-list">
                {categoryRows.length ? categoryRows.map((category) => (
                  <div className="category-row" key={category.id}>
                    <input className="input" value={categoryDrafts[category.id] ?? category.name} onChange={(e) => setCategoryDrafts({ ...categoryDrafts, [category.id]: e.target.value })} />
                    <button className="btn good" type="button" onClick={() => saveCategory(category)}>Guardar</button>
                  </div>
                )) : <p className="muted">Sin categorias cargadas.</p>}
              </div>
            </section>
          </>
        )}
      </main>
      {showExport && <ExportModal selectedColumns={selectedColumns} setSelectedColumns={setSelectedColumns} onClose={() => setShowExport(null)} onConfirm={showExport === "excel" ? exportExcel : exportPdf} />}
      {editProduct && <EditProductModal form={editForm} setForm={setEditForm} onClose={() => setEditProduct(null)} onSave={saveEditedProduct} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ProductSuggestions({ products, onSelect }: { products: Product[]; onSelect: (product: Product) => void }) {
  if (!products.length) return null;
  return (
    <div className="suggestions">
      {products.map((product) => (
        <button type="button" className="suggestion" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(product)}>
          <strong>{product.code}</strong>
          <span>{product.description}</span>
          <em>{product.category}</em>
        </button>
      ))}
    </div>
  );
}

function ProductList({ products, onEdit }: { products: Product[]; onEdit: (product: Product) => void }) {
  return (
    <section className="panel">
      <div className="mobile-only mobile-list">
        {products.map((product) => (
          <article className="item-card" key={product.id}>
            <header><span className="code">{product.code}</span><span className={`pill ${product.active ? "good" : ""}`}>{product.active ? "Activo" : "Inactivo"}</span></header>
            <strong>{product.description}</strong>
            <p className="muted">{product.category} · {product.provider}</p>
            <div className="summary">
              <div className="metric"><strong>${product.retailPrice}</strong><span>Minorista</span></div>
              <div className="metric"><strong>{product.stockQuantity}</strong><span>Stock</span></div>
            </div>
            <div className="actions"><button className="btn secondary" type="button" onClick={() => onEdit(product)}>Editar</button></div>
          </article>
        ))}
      </div>
      <div className="desktop-only table-wrap">
        <table><thead><tr>{exportColumns.map(([, label]) => <th key={label}>{label}</th>)}<th>acciones</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}>{exportColumns.map(([key]) => <td key={key}>{String((p as any)[key])}</td>)}<td><button className="btn secondary" type="button" onClick={() => onEdit(p)}>Editar</button></td></tr>)}</tbody></table>
      </div>
    </section>
  );
}

function EditProductModal({ form, setForm, onClose, onSave }: { form: any; setForm: (form: any) => void; onClose: () => void; onSave: (event: FormEvent) => void }) {
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={onSave}>
        <h2>Editar producto</h2>
        <div className="grid two">
          <label className="field"><span>Codigo</span><input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="field"><span>Descripcion</span><input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="field"><span>Categoria</span><input className="input" required value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} /></label>
          <label className="field"><span>Proveedor</span><input className="input" required value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} /></label>
          <label className="field"><span>Precio costo</span><input className="input" required type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} /></label>
          <label className="field"><span>Observaciones</span><textarea className="textarea" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo</label>
        </div>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn good">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function DataTable({ rows, columns }: { rows: any[]; columns: string[] }) {
  if (!rows?.length) return <p className="muted">Sin registros.</p>;
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}

function Summary({ data }: { data: Record<string, number> }) {
  return <div className="summary" style={{ marginTop: 12 }}>{Object.entries(data).map(([key, value]) => <div className="metric" key={key}><strong>{value}</strong><span>{key}</span></div>)}</div>;
}

function ErrorList({ errors }: { errors: string[] }) {
  return <div style={{ marginTop: 12 }}>{errors.slice(0, 20).map((error, i) => <p className="muted" key={i}>{error}</p>)}</div>;
}

function ExportModal({ selectedColumns, setSelectedColumns, onClose, onConfirm }: any) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Columnas a exportar</h2>
        {exportColumns.map(([key, label]) => (
          <label className="checkbox-row" key={key}><input type="checkbox" checked={selectedColumns[key]} onChange={(e) => setSelectedColumns({ ...selectedColumns, [key]: e.target.checked })} /> {label}</label>
        ))}
        <div className="actions" style={{ marginTop: 12 }}><button className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn" onClick={onConfirm}>Exportar</button></div>
      </div>
    </div>
  );
}

function settingLabel(key: string) {
  return {
    wholesalePercentage: "% aumento mayorista",
    retailPercentage: "% aumento minorista",
    promo1Percentage: "% precio promocional 1",
    promo2Percentage: "% precio promocional 2",
  }[key];
}
