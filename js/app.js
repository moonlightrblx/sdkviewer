// -------------------- CONFIG --------------------
const JSON_FILES = [
    "dumped/json/client_dll.json",
    "dumped/json/buttons.json",
    "dumped/json/engine2_dll.json",
    "dumped/json/offsets.json"
];
let allClasses = {}, lastQuery = "";

// -------------------- CLEAN JSON STRING --------------------
function stripComments(jsonString) {
    // Remove // comments
    jsonString = jsonString.replace(/\/\/.*$/gm, "");
    // Remove /* */ comments
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//gm, "");
    return jsonString;
}

// -------------------- LOCAL JSON READER --------------------
function readLocalJSON(filePath) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", filePath, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {
                    try {
                        const clean = stripComments(xhr.responseText);
                        resolve(JSON.parse(clean));
                    } catch (e) {
                        reject(e);
                    }
                } else reject(new Error("Failed to read local file: " + filePath));
            }
        };
        xhr.send();
    });
}

// -------------------- FETCH DATA --------------------
async function fetchData() {
    const isLocal = window.location.protocol === "file:";

    for (const file of JSON_FILES) {
        try {
            let data;
            if (isLocal) {
                data = await readLocalJSON(file);
            } else {
                const res = await fetch(file);
                if (!res.ok) continue;
                const clean = stripComments(await res.text());
                data = JSON.parse(clean);
            }

            const main = data[Object.keys(data)[0]];

            if (main && main.classes) {
                Object.entries(main.classes).forEach(([k, v]) => allClasses[k] = v);
            }

            if (file.includes("offsets.json")) {
                allClasses.CLOUDSDKGLOBALS = { fields: {} };
                for (const [k, v] of Object.entries(data)) {
                    allClasses.CLOUDSDKGLOBALS.fields[k] = { type_name: "module", offsets: v };
                }
            }
        } catch (e) {
            console.error("Failed to load JSON:", file, e);
        }
    }

    renderClassList("");
}

// -------------------- SEARCH --------------------
function parseSearch(query) {
    query = (query || "").trim().toLowerCase();
    if (!query) return ["all", ""];
    if (query.startsWith("class:")) return ["class", query.slice(6).trim()];
    if (query.startsWith("offset:")) return ["offset", query.slice(7).trim()];
    return ["all", query];
}

function renderClassList(query) {
    lastQuery = query || "";
    const listEl = document.getElementById("classlist");
    listEl.innerHTML = "";

    const [type, term] = parseSearch(query);
    const sortedClasses = Object.keys(allClasses).sort((a, b) => a.localeCompare(b));
    let firstMatch = null;

    for (const className of sortedClasses) {
        const cls = allClasses[className];
        let visible = false;
        const nameLower = className.toLowerCase();

        if (type === "class" && nameLower.includes(term)) visible = true;
        else if (type === "offset") {
            if (cls.fields) {
                for (const [fieldName, fieldData] of Object.entries(cls.fields)) {
                    if (fieldData.offsets) {
                        for (const offsetName of Object.keys(fieldData.offsets)) {
                            if (offsetName.toLowerCase().includes(term)) { visible = true; break; }
                        }
                        if (visible) break;
                    }
                }
            }
        } else {
            if (nameLower.includes(term)) visible = true;
            if (!visible && cls.fields) {
                for (const [fieldName, fieldData] of Object.entries(cls.fields)) {
                    if (fieldName.toLowerCase().includes(term)) { visible = true; break; }
                    if (fieldData.offsets) {
                        for (const offsetName of Object.keys(fieldData.offsets)) {
                            if (offsetName.toLowerCase().includes(term)) { visible = true; break; }
                        }
                        if (visible) break;
                    }
                }
            }
        }

        if (!visible) continue;

        const div = document.createElement("div");
        div.className = "class-item";
        div.innerHTML = `<div>${className}</div><div class="meta">${cls.parent || ""}</div>`;
        div.onclick = () => selectClass(className, div, term);
        listEl.appendChild(div);

        if (!firstMatch) firstMatch = { name: className, el: div };
    }

    if (term && firstMatch) {
        setTimeout(() => {
            try {
                firstMatch.el.click();
                firstMatch.el.scrollIntoView({ block: "center", behavior: "smooth" });
            } catch (e) {}
        }, 80);
    }
}

// -------------------- FORMAT HEX --------------------
function formatHex(value) {
    if (typeof value === "number" && Number.isFinite(value)) return "0x" + value.toString(16).padStart(1, "0").toUpperCase();
    if (typeof value === "string" && /^-?\d+$/.test(value)) return "0x" + parseInt(value, 10).toString(16).toUpperCase();
    return String(value);
}

// -------------------- SELECT CLASS --------------------
function selectClass(className, element, term) {
    document.querySelectorAll(".class-item").forEach(el => el.classList.remove("active"));
    if (element) element.classList.add("active");

    const content = document.getElementById("content");
    content.innerHTML = "";

    const cls = allClasses[className] || {};
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.innerHTML = `<h1>${className}${cls.parent ? ' <span class="parent">: ' + cls.parent + "</span>" : ""}</h1>`;
    content.appendChild(titleDiv);

    if (cls.fields) {
        const fieldsCard = document.createElement("div");
        fieldsCard.className = "card";
        fieldsCard.innerHTML = `<strong style='color:var(--accent)'>Fields — ${className}</strong>`;

        let hasOffsets = false;
        for (const val of Object.values(cls.fields)) if (val && val.offsets) { hasOffsets = true; break; }

        if (hasOffsets) {
            // Fields with offsets
            for (const [fieldName, fieldData] of Object.entries(cls.fields)) {
                if (fieldData && fieldData.offsets) {
                    const details = document.createElement("details");
                    const summary = document.createElement("summary");
                    summary.textContent = fieldName;
                    details.appendChild(summary);

                    const note = document.createElement("div");
                    note.className = "small-note";
                    note.textContent = fieldData.type_name || "";
                    details.appendChild(note);

                    const table = document.createElement("table");
                    table.innerHTML = "<thead><tr><th>Name</th><th>Hex</th></tr></thead>";
                    const tbody = document.createElement("tbody");

                    let i = 0;
                    const offsets = fieldData.offsets || {};
                    for (const [offsetName, val] of Object.entries(offsets)) {
                        const tr = document.createElement("tr");
                        tr.id = `field-${fieldName}-${i++}`;
                        tr.innerHTML = `<td style="font-weight:600">${offsetName}</td>
                                        <td><pre style="white-space:pre-wrap;font-size:11px;margin:0">${formatHex(val)}</pre></td>`;
                        tbody.appendChild(tr);
                    }

                    table.appendChild(tbody);
                    details.appendChild(table);
                    fieldsCard.appendChild(details);
                }
            }
        } else {
            // Fields without offsets
            const table = document.createElement("table");
            table.innerHTML = "<thead><tr><th>Name</th><th>Hex</th></tr></thead>";
            const tbody = document.createElement("tbody");

            for (const [fieldName, fieldData] of Object.entries(cls.fields)) {
                let offset = "?";

                if (typeof fieldData === "object") {
                    offset = fieldData.offset ?? "?";
                } else offset = fieldData;

                const tr = document.createElement("tr");
                tr.innerHTML = `<td style="font-weight:600">${fieldName}</td>
                                <td><pre style="white-space:pre-wrap;font-size:11px;margin:0">${formatHex(offset)}</pre></td>`;
                tbody.appendChild(tr);
            }

            table.appendChild(tbody);
            fieldsCard.appendChild(table);
        }

        content.appendChild(fieldsCard);
    }

    // Methods
    if (cls.methods) {
        const methodsCard = document.createElement("div");
        methodsCard.className = "card";
        methodsCard.innerHTML = "<strong style='color:var(--accent)'>Methods</strong>";

        const table = document.createElement("table");
        table.innerHTML = "<thead><tr><th>Name</th><th>Return</th><th>Args</th></tr></thead>";
        const tbody = document.createElement("tbody");

        for (const [methodName, methodData] of Object.entries(cls.methods)) {
            const returnType = methodData.return_type || "void";
            const args = (methodData.args || []).map(a => `${a.type_name || "?"} ${a.name || ""}`).join(", ");
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${methodName}</td><td>${returnType}</td><td>${args}</td>`;
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        methodsCard.appendChild(table);
        content.appendChild(methodsCard);
    }
}

// -------------------- INIT --------------------
window.addEventListener("DOMContentLoaded", fetchData);
