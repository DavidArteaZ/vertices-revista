/* Sistema de idiomas de Vértices (sin build).
   Los diccionarios viven en idiomas/{codigo}.js y mapean el texto ESPAÑOL
   exacto (normalizado) a su traducción. El español es el idioma fuente:
   volver a "es" restaura los textos originales del HTML.
   Páginas: los valores que viajan a la API y al Excel siguen SIEMPRE en
   español (se traducen las etiquetas visibles, no los value de los option). */
(() => {
  const IDIOMAS = [
    ["es", "ES", "Español"],
    ["en", "EN", "English"],
    ["fr", "FR", "Français"],
    ["it", "IT", "Italiano"],
    ["pt", "PT", "Português"],
    ["ru", "RU", "Русский"],
  ];
  const CLAVE_LS = "vertices_lang";
  window.VERTICES_TRAD = window.VERTICES_TRAD || {};

  const norma = (s) => s.replace(/\s+/g, " ").trim();

  // registro de nodos de texto y atributos con su original en español
  const nodos = [];      // { nodo, original, pre, post }
  const atributos = [];  // { el, attr, original }
  let tituloOriginal = document.title;

  function recolecta() {
    const paseo = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const padre = n.parentElement;
        if (!padre) return NodeFilter.FILTER_REJECT;
        const tag = padre.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        return norma(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = paseo.nextNode())) {
      const v = n.nodeValue;
      nodos.push({
        nodo: n,
        original: norma(v),
        pre: v.match(/^\s*/)[0],
        post: v.match(/\s*$/)[0],
      });
    }
    for (const el of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
      for (const attr of ["placeholder", "aria-label", "title"]) {
        const v = el.getAttribute(attr);
        if (v && norma(v)) atributos.push({ el, attr, original: norma(v) });
      }
    }
  }

  function aplica(codigo) {
    const dicc = codigo === "es" ? null : (window.VERTICES_TRAD[codigo] || {}).textos || {};
    const t = (s) => (dicc ? dicc[s] || s : s);
    for (const r of nodos) {
      if (!r.nodo.isConnected) continue;
      r.nodo.nodeValue = r.pre + t(r.original) + r.post;
    }
    for (const a of atributos) a.el.setAttribute(a.attr, t(a.original));
    document.title = t(tituloOriginal);
    document.documentElement.lang = codigo;
    window.__dicc = dicc || null;             // usado por TR() en los scripts de página
    window.__idioma = codigo;
    if (typeof window.__alCambiarIdioma === "function") window.__alCambiarIdioma();
  }

  function carga(codigo) {
    return new Promise((listo, falla) => {
      if (codigo === "es" || window.VERTICES_TRAD[codigo]) return listo();
      const s = document.createElement("script");
      s.src = `idiomas/${codigo}.js?v=5`;
      s.onload = listo;
      s.onerror = () => falla(new Error(codigo));
      document.head.appendChild(s);
    });
  }

  async function cambia(codigo) {
    try {
      await carga(codigo);
      aplica(codigo);
      localStorage.setItem(CLAVE_LS, codigo);
      const sel = document.getElementById("selIdioma");
      if (sel) sel.value = codigo;
      const nombre = document.getElementById("selIdiomaNombre");
      if (nombre) {
        const idioma = IDIOMAS.find(([c]) => c === codigo);
        if (idioma) nombre.textContent = idioma[1];
      }
    } catch {
      console.warn("No se pudo cargar el idioma", codigo);
    }
  }
  window.__cambiaIdioma = cambia;

  function montaSelector() {
    const nav = document.querySelector(".marco nav");
    if (!nav || document.getElementById("selIdioma")) return;

    // pastilla con globo lineal + nombre del idioma + flecha, en la esquina
    // superior derecha; en pantallas angostas queda solo el globo
    const estilo = document.createElement("style");
    estilo.textContent = [
      "#selIdiomaWrap{position:relative;display:inline-flex;align-items:center;gap:8px;flex:none;",
      "border:1px solid rgba(45,35,46,.3);border-radius:999px;padding:9px 14px;cursor:pointer;color:inherit;}",
      "#selIdiomaWrap:hover{border-color:rgba(45,35,46,.55);}",
      "#selIdiomaGlobo{width:16px;height:16px;flex:none;display:block;}",
      "#selIdiomaNombre{font:500 11px var(--f-ui,Arial);letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;}",
      "#selIdiomaFlecha{width:7px;height:7px;border-right:1.3px solid currentColor;border-bottom:1.3px solid currentColor;",
      "transform:rotate(45deg);margin-top:-3px;flex:none;}",
      "#selIdioma{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;-webkit-appearance:none;appearance:none;}",
      "@media (max-width:820px){#selIdiomaNombre,#selIdiomaFlecha{display:none;}#selIdiomaWrap{padding:9px 10px;}}",
    ].join("");
    document.head.appendChild(estilo);

    const wrap = document.createElement("span");
    wrap.id = "selIdiomaWrap";
    wrap.innerHTML =
      '<svg id="selIdiomaGlobo" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
      '<circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="3.6" ry="8"/>' +
      '<path d="M2.4 7.2 H17.6 M2.4 12.8 H17.6"/></svg>' +
      '<span id="selIdiomaNombre"></span><i id="selIdiomaFlecha"></i>';

    const sel = document.createElement("select");
    sel.id = "selIdioma";
    sel.setAttribute("aria-label", "Idioma");
    for (const [cod, , nombre] of IDIOMAS) {
      const o = document.createElement("option");
      o.value = cod;
      o.textContent = nombre;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => cambia(sel.value));
    wrap.appendChild(sel);
    const menu = nav.querySelector(".menu-boton");
    menu ? nav.insertBefore(wrap, menu) : nav.appendChild(wrap);

    const actual = IDIOMAS.find(([c]) => c === (localStorage.getItem(CLAVE_LS) || "es")) || IDIOMAS[0];
    wrap.querySelector("#selIdiomaNombre").textContent = actual[1];
    sel.value = actual[0];
  }

  function inicia() {
    recolecta();
    montaSelector();
    const guardado = localStorage.getItem(CLAVE_LS);
    if (guardado && guardado !== "es") cambia(guardado);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", inicia)
    : inicia();
})();
