// ==================== js/app.js – MOONLIGHT BY ELLII – FINAL ULTRA-FAST EDITION ====================

const JSON_FILES = [
  "dumped/json/client_dll.json",
  "dumped/json/buttons.json",
  "dumped/json/engine2_dll.json",
  "dumped/json/offsets.json",
  "dumped/json/schemasystem_dll.json",
];

let allClasses = {};
let sortedClassNames = [];
let searchCache = new Map();
let lastQuery = "";
let searchInput = null;

// ==================== UTILS ====================
const stripComments = str => str.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const readLocalJSON = path => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", path, true);
  xhr.onload = () => (xhr.status === 200 || xhr.status === 0)
    ? resolve(JSON.parse(stripComments(xhr.responseText)))
    : reject(`HTTP ${xhr.status}`);
  xhr.onerror = () => reject("Network error");
  xhr.send();
});

// ==================== DATA LOADING ====================
async function fetchData() {
  const isLocal = location.protocol === "file:";

  for (const file of JSON_FILES) {
    try {
      let data;
      if (isLocal) {
        data = await readLocalJSON(file);
      } else {
        const res = await fetch(file);
        if (!res.ok) continue;
        data = JSON.parse(stripComments(await res.text()));
      }

      // Special handling for schemasystem_dll.json
      if (file.includes("schemasystem_dll.json")) {
        const moduleName = Object.keys(data)[0];
        const payload = data[moduleName];

        if (payload.classes) Object.assign(allClasses, payload.classes);

        // Create global SchemaSystem entry
        allClasses["[SchemaSystem]"] = { fields: {}, parent: "Global Types" };
        const globalFields = allClasses["[SchemaSystem]"].fields;

        // Add built-in types from CSchemaSystemInternalRegistration
        const regClass = payload.classes?.CSchemaSystemInternalRegistration;
        if (regClass?.fields) {
          Object.entries(regClass.fields).forEach(([name, offset]) => {
            globalFields[name] = { offset, type_name: "builtin" };
          });
        }

        continue;
      }

      // Regular class dumps
      const rootKey = Object.keys(data)[0];
      const payload = data[rootKey];
      if (payload?.classes) {
        Object.assign(allClasses, payload.classes);
      }

      // Offsets.json
      if (file.includes("offsets.json")) {
        allClasses.MoonLightGlobals ??= { fields: {}, parent: "Global Types" };
        Object.entries(data).forEach(([k, v]) => {
          allClasses.MoonLightGlobals.fields[k] = { type_name: "module", offsets: v };
        });
      }
    } catch (err) {
      console.error(`Failed to load ${file}:`, err);
    }
  }

  sortedClassNames = Object.keys(allClasses).sort((a, b) => a.localeCompare(b));
  const index = sortedClassNames.indexOf("MoonLightGlobals");
    if (index > -1) {
        sortedClassNames.splice(index, 1);
        sortedClassNames.unshift("MoonLightGlobals");
    }
  console.log("Moonlight loaded:", sortedClassNames.length, "classes");

  renderClassList("");
}

// ==================== ULTRA-FAST SEARCH (cached + pure) ====================
function getMatchingClasses(query) {
  if (!query) return sortedClassNames;
  query = query.trim().toLowerCase();

  if (searchCache.has(query)) return searchCache.get(query);

  const [mode, term] = query.startsWith("class:") ? ["class", query.slice(6).trim()] :
                       query.startsWith("offset:") ? ["offset", query.slice(7).trim()] :
                       query.startsWith("enum:") ? ["enum", query.slice(5).trim()] :
                       ["all", query];

  const result = [];

  for (const name of sortedClassNames) {
    const cls = allClasses[name];
    let matches = false;

    if (mode === "class") {
      if (name.toLowerCase().includes(term)) matches = true;
    }
    else if (mode === "enum" && name === "[SchemaSystem]") {
      matches = Object.keys(cls.fields || {}).some(k => k.toLowerCase().includes(term));
    }
    else if (mode === "offset" && cls.fields) {
      for (const field of Object.values(cls.fields)) {
        if (field?.offsets && Object.keys(field.offsets).some(k => k.toLowerCase().includes(term))) {
          matches = true;
          break;
        }
      }
    }
    else {
      if (name.toLowerCase().includes(term)) matches = true;
      if (!matches && cls.fields) {
        for (const [fieldName, field] of Object.entries(cls.fields)) {
          if (fieldName.toLowerCase().includes(term) ||
              (field?.type_name && field.type_name.toLowerCase().includes(term)) ||
              (
                field?.enum_values && Object.keys(field.enum_values).some(v => v.toLowerCase().includes(term)))) {
            matches = true;
            break;
          }
        }
      }
    }

    if (matches) result.push(name);
  }

  if (searchCache.size > 500) searchCache.clear();
  searchCache.set(query, result);
  return result;
}

// ==================== PURE DOM RENDER – ZERO LAG ====================
function renderClassList(query = "") {
  lastQuery = query;
  const container = document.getElementById("classlist");
  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const matches = getMatchingClasses(query);
  let firstMatch = null;

  for (const name of matches) {
    const cls = allClasses[name];

    const item = document.createElement("div");
    item.className = "class-item";
    item.onclick = () => selectClass(name, item);

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = name.replace(/^\[|\]$/g, "");

    const parentSpan = document.createElement("span");
    parentSpan.className = "parent";
    parentSpan.textContent = cls.parent || (name === "[SchemaSystem]" ? "Global Types" : "");

    item.appendChild(nameSpan);
    item.appendChild(parentSpan);
    if (!firstMatch) firstMatch = item;
    fragment.appendChild(item);
  }

  container.appendChild(fragment);

  if (query && firstMatch) {
    setTimeout(() => {
      firstMatch.click();
      firstMatch.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 10);
  }
}

// ==================== FORMATTER ====================
const formatHex = val => {
  if (typeof val === "number") return "0x" + val.toString(16).toUpperCase();
  if (typeof val === "string" && /^-?\d+$/.test(val)) return "0x" + Number(val).toString(16).toUpperCase();
  return val ?? "?";
};

// ==================== CLASS VIEWER (supports SchemaSystem) ====================
function selectClass(className, element) {
  document.querySelectorAll(".class-item").forEach(el => el.classList.remove("active"));
  element?.classList.add("active");

  const content = document.getElementById("content");
  content.innerHTML = "";

  const cls = allClasses[className] || {};
  const header = document.createElement("h1");
  header.className = "class-title";
  header.innerHTML = `${className.replace(/^\[|\]$/g, "")}${cls.parent ? ` <span class="parent">: ${cls.parent}</span>` : ""}`;
  content.appendChild(header);


  if (className === "[SchemaSystem]") {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong class="section-title">Schema</strong>`;

    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>Name</th><th>Type</th><th>Size/Offset</th><th>Values</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");

    Object.entries(cls.fields || {}).forEach(([name, field]) => {
      let values = "";
      if (field.enum_values) {
        const list = Object.entries(field.enum_values)
          .map(([k, v]) => `<code>${k}</code> = ${v}`).join(", ");
        values = `<details><summary>${Object.keys(field.enum_values).length} values</summary><div style="margin-top:8px;font-size:12px;">${list}</div></details>`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td><code>${name}</code></td>
        <td><code>${field.type_name || "builtin"}</code></td>
        <td><code>${field.offset !== undefined ? formatHex(field.offset) : field.size ? field.size + "B" : "?"}</code></td>
        <td>${values}</td>
      `;
      tbody.appendChild(row);
    });

    card.appendChild(table);
    content.appendChild(card);
    lucide?.createIcons();
    return;
  }

  // Regular class fields
  if (cls.fields && Object.keys(cls.fields).length) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong class="section-title">Fields</strong>`;

    const hasOffsetTables = Object.values(cls.fields).some(f => f?.offsets);

    if (hasOffsetTables) {
      for (const [fieldName, field] of Object.entries(cls.fields)) {
        if (!field?.offsets) continue;
        const details = document.createElement("details");
        details.open = true;
        const summary = document.createElement("summary");
        summary.textContent = fieldName;
        details.appendChild(summary);

        const typeNote = document.createElement("div");
        typeNote.className = "type-note";
        typeNote.textContent = field.type_name || "unknown";
        details.appendChild(typeNote);

        const table = document.createElement("table");
        table.innerHTML = `<thead><tr><th>Offset Name</th><th>Value</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector("tbody");
        for (const [offsetName, value] of Object.entries(field.offsets || {})) {
          const row = document.createElement("tr");
          row.innerHTML = `<td><code>${offsetName}</code></td><td><code>${formatHex(value)}</code></td>`;
          tbody.appendChild(row);
        }
        details.appendChild(table);
        card.appendChild(details);
      }
    } else {
      const table = document.createElement("table");
      table.innerHTML = `<thead><tr><th>Field</th><th>Offset</th></tr></thead><tbody></tbody>`;
      const tbody = table.querySelector("tbody");
      for (const [fieldName, value] of Object.entries(cls.fields)) {
        const offset = typeof value === "object" ? value.offset ?? "?" : value;
        const row = document.createElement("tr");
        row.innerHTML = `<td><code>${fieldName}</code></td><td><code>${formatHex(offset)}</code></td>`;
        tbody.appendChild(row);
      }
      card.appendChild(table);
    }
    content.appendChild(card);
  }

  // Methods
  if (cls.methods && Object.keys(cls.methods).length) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong class="section-title">Methods</strong>`;
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>Name</th><th>Return</th><th>Arguments</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector("tbody");
    for (const [name, m] of Object.entries(cls.methods)) {
      const args = (m.args || []).map(a => `${a.type_name || "?"} ${a.name || ""}`).filter(Boolean).join(", ") || "void";
      const row = document.createElement("tr");
      row.innerHTML = `<td><code>${name}</code></td><td><code>${m.return_type || "void"}</code></td><td><code>${args}</code></td>`;
      tbody.appendChild(row);
    }
    card.appendChild(table);
    content.appendChild(card);
  }

  if (!cls.fields && !cls.methods) {
    content.innerHTML += `<div class="card"><em>No data available.</em></div>`;
  }

  lucide?.createIcons();
}

// ==================== DEBOUNCED SEARCH ====================
function debouncedSearch() {
  const query = searchInput.value;
  if (query === lastQuery) return;
  renderClassList(query);
}

// ==================== INIT ====================
window.addEventListener("DOMContentLoaded", () => {
  fetchData();

  searchInput = document.getElementById("search-input");
  let timeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(timeout);
    timeout = setTimeout(debouncedSearch, 100);
  });
});