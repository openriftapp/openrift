const CELL_ATTRIBUTE = "data-openrift-cell";

// The header and every article row get the same last column, or the header
// stops lining up with the rows.
// Layout only: text style comes from Cardmarket's own header and row rules.
const CELL_STYLE = [
  "display:flex",
  "align-items:center",
  "gap:8px",
  "min-width:210px",
  "padding-left:12px",
  "white-space:nowrap",
].join(";");

/** The row's OpenRift cell, created as its last column on first use. */
export function overlayCell(row: HTMLElement, doc: Document): HTMLElement {
  const existing = row.querySelector<HTMLElement>(`[${CELL_ATTRIBUTE}]`);
  if (existing !== null) {
    return existing;
  }
  const cell = doc.createElement("div");
  cell.setAttribute(CELL_ATTRIBUTE, "");
  cell.className = "col-auto";
  cell.setAttribute("style", CELL_STYLE);
  row.append(cell);
  return cell;
}

const HEADER_SELECTOR = ".table-header";
const HEADER_LABEL = "OpenRift";
const HEADER_ATTRIBUTE = "data-openrift-header";
const HELP_TOGGLE_ATTRIBUTE = "data-openrift-help-toggle";
const HELP_ATTRIBUTE = "data-openrift-help";

const HELP_LINES = [
  [
    "own · want",
    "Copies of this card in your collections, and how many your wishlists still ask for.",
  ],
  [
    "Price under the seller's",
    "Your own reference price. The seller's asking price turns green at or under it, amber up to a fifth over, red beyond.",
  ],
  [
    "− / +",
    "Pick copies to buy from this seller. Send the picks to OpenRift from the toolbar popup to turn them into a list.",
  ],
] as const;

const TOGGLE_STYLE = [
  "display:inline-flex",
  "align-items:center",
  "justify-content:center",
  "width:16px",
  "height:16px",
  "margin-left:6px",
  "padding:0",
  "border:1px solid currentColor",
  "border-radius:999px",
  "background:transparent",
  "color:inherit",
  "font:inherit",
  "font-size:10px",
  "font-weight:700",
  "line-height:1",
  "cursor:pointer",
  "opacity:0.7",
].join(";");

const HELP_STYLE = [
  "position:absolute",
  "top:100%",
  "right:0",
  "z-index:1000",
  "width:300px",
  "margin-top:4px",
  "padding:10px 12px",
  "border-radius:6px",
  "font-size:12px",
  "font-weight:400",
  "line-height:1.4",
  "text-align:left",
  "white-space:normal",
  "box-shadow:0 4px 12px rgba(0,0,0,0.25)",
].join(";");

const HELP_LIGHT = "background:#fff;color:#111827;border:1px solid #d1d5db";
const HELP_DARK = "background:#1f2937;color:#f3f4f6;border:1px solid #4b5563";

function helpBox(doc: Document): HTMLElement {
  const box = doc.createElement("div");
  box.setAttribute(HELP_ATTRIBUTE, "");
  const theme = doc.documentElement.dataset.bsTheme === "dark" ? HELP_DARK : HELP_LIGHT;
  box.setAttribute("style", `${HELP_STYLE};${theme}`);
  box.hidden = true;
  for (const [term, text] of HELP_LINES) {
    const line = doc.createElement("p");
    line.setAttribute("style", "margin:0 0 6px");
    const strong = doc.createElement("strong");
    strong.textContent = term;
    line.append(strong, doc.createTextNode(`: ${text}`));
    box.append(line);
  }
  return box;
}

function buildHeader(cell: HTMLElement, doc: Document): void {
  const label = doc.createElement("div");
  label.setAttribute(HEADER_ATTRIBUTE, "");
  label.setAttribute("style", "display:inline-flex;align-items:center");
  label.append(doc.createTextNode(HEADER_LABEL));

  const toggle = doc.createElement("button");
  toggle.type = "button";
  toggle.setAttribute(HELP_TOGGLE_ATTRIBUTE, "");
  toggle.setAttribute("style", TOGGLE_STYLE);
  toggle.setAttribute("aria-label", "What the OpenRift column shows");
  toggle.setAttribute("aria-expanded", "false");
  toggle.textContent = "i";

  const box = helpBox(doc);
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    box.hidden = !box.hidden;
    toggle.setAttribute("aria-expanded", String(!box.hidden));
  });
  doc.addEventListener("click", (event) => {
    if (!box.hidden && !(event.target instanceof Node && cell.contains(event.target))) {
      box.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  cell.style.setProperty("position", "relative");
  cell.replaceChildren(label, toggle, box);
}

/** A column label in the table header, placed the same way as the row cells. */
export function overlayHeader(root: ParentNode, doc: Document): boolean {
  const header = root.querySelector<HTMLElement>(HEADER_SELECTOR);
  if (header === null) {
    return false;
  }
  const row = header.querySelector<HTMLElement>(":scope > .row") ?? header;
  const cell = overlayCell(row, doc);
  if (cell.querySelector(`[${HEADER_ATTRIBUTE}]`) === null) {
    buildHeader(cell, doc);
  }
  return true;
}
