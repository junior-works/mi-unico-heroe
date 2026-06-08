/* =========================================================
   Mi único héroe — lógica del front (v0.2.4)
   ========================================================= */
(function () {
  const MUH = {};
  window.MUH = MUH;

  const TIPO_LABEL = {
    "lugar": "Lugar",
    "figura_historica": "Figura histórica",
    "obra_cultural": "Obra cultural",
    "evento_historico": "Evento histórico",
    "marca": "Marca",
    "objeto_material": "Objeto",
    "personaje_de_ficcion": "Personaje de ficción",
    "jerga_ricotera": "Jerga ricotera",
    "practica_cultural": "Práctica cultural"
  };
  const FUENTE_LABEL = {
    "letra": "Letra",
    "enciclopedica": "Enciclopedia",
    "fan_critica": "Crítica/fan",
    "primaria": "Fuente primaria",
    "archivo_periodistico": "Archivo periodístico"
  };

  let GLOSARIO = null;
  let CARGANDO = null;

  async function cargar() {
    if (GLOSARIO) return GLOSARIO;
    if (CARGANDO) return CARGANDO;
    CARGANDO = (async () => {
      try {
        if (window.MUH_SUPA) {
          const rows = await MUH_SUPA.listarEntradasGlosario();
          if (Array.isArray(rows) && rows.length) {
            GLOSARIO = { entradas: rows.map(adaptarFila), version: "supabase" };
            return GLOSARIO;
          }
        }
      } catch (e) {
        console.warn("[MUH] Supabase no disponible, fallback al JSON estático:", e.message);
      }
      const r = await fetch("data/glosario.json");
      if (!r.ok) throw new Error("No pude cargar el glosario.");
      GLOSARIO = await r.json();
      return GLOSARIO;
    })();
    return CARGANDO;
  }
  MUH.cargar = cargar;

  function adaptarFila(row) {
    return {
      id: row.id,
      termino: row.termino,
      tipo: row.tipo,
      aparece_en: {
        cancion: row.cancion,
        disco: row.disco,
        anio: row.anio,
        banda: row.banda,
        posicion: row.posicion,
        verso: row.verso
      },
      que_es: row.que_es,
      contemporaneidad: row.contemporaneidad,
      fuentes: row.fuentes || [],
      confianza: row.confianza,
      estado: row.estado
    };
  }

  MUH.hidratarTopbar = async function () {
    const slot = document.getElementById("auth-slot");
    if (!slot || !window.MUH_SUPA) return;
    async function renderEstado() {
      const u = await MUH_SUPA.getUsuarioActual();
      if (u) {
        slot.innerHTML = '<a href="mi-perfil.html" title="Mi perfil">Mi perfil</a> <button class="link-button" id="btn-salir">Salir</button>';
        const btn = document.getElementById("btn-salir");
        if (btn) btn.addEventListener("click", () => { MUH_SUPA.cerrarSesion(); renderEstado(); });
      } else {
        slot.innerHTML = '<a href="acceder.html">Acceder</a>';
      }
    }
    document.addEventListener("muh-auth-cambio", renderEstado);
    renderEstado();
  };

  MUH.hidratarHome = async function () {
    try {
      const d = await cargar();
      const elE = document.getElementById("stat-entradas");
      if (elE) elE.textContent = d.entradas.length;
      const discos = new Set(d.entradas.map(e => e.aparece_en.disco).filter(x => x && !String(x).startsWith("(")));
      const elD = document.getElementById("stat-discos");
      if (elD) elD.textContent = discos.size;
      let nFuentes = 0;
      d.entradas.forEach(e => { nFuentes += (e.fuentes || []).length; });
      const elF = document.getElementById("stat-fuentes");
      if (elF) elF.textContent = nFuentes;
      const grid = document.getElementById("muestra-grid");
      if (grid) {
        const sample = sampleVariado(d.entradas, 3);
        grid.innerHTML = sample.map(e =>
          '<div class="muestra-card" data-id="' + escapeAttr(e.id) + '">' +
            '<div class="muestra-card-tipo">' + escapeHtml(TIPO_LABEL[e.tipo] || e.tipo) + '</div>' +
            '<div class="muestra-card-term">' + escapeHtml(e.termino) + '</div>' +
            '<div class="muestra-card-cancion">en ' + escapeHtml(e.aparece_en.cancion || "(varias)") +
              (e.aparece_en.disco && !String(e.aparece_en.disco).startsWith("(") ? " · " + escapeHtml(e.aparece_en.disco) : "") +
            '</div>' +
          '</div>'
        ).join("");
        grid.addEventListener("click", (ev) => {
          const card = ev.target.closest(".muestra-card");
          if (!card) return;
          window.location.href = "glosario.html#" + card.dataset.id;
        });
      }
    } catch (e) { console.error("[home]", e); }
  };

  MUH.hidratarGlosario = async function () {
    try {
      const d = await cargar();
      const cont = document.getElementById("entradas-cont");
      const contador = document.getElementById("contador-resultados");
      const inputBuscar = document.getElementById("filtro-buscar");
      const selTipo = document.getElementById("filtro-tipo");
      const selDisco = document.getElementById("filtro-disco");
      const selConfianza = document.getElementById("filtro-confianza");
      const tipos = [...new Set(d.entradas.map(e => e.tipo))].sort();
      tipos.forEach(t => {
        const o = document.createElement("option");
        o.value = t; o.textContent = TIPO_LABEL[t] || t;
        selTipo.appendChild(o);
      });
      const discos = [...new Set(d.entradas.map(e => e.aparece_en.disco).filter(x => x && !String(x).startsWith("(")))].sort();
      discos.forEach(disco => {
        const o = document.createElement("option");
        o.value = disco; o.textContent = disco;
        selDisco.appendChild(o);
      });
      function renderizar() {
        const q = (inputBuscar.value || "").toLowerCase().trim();
        const tipo = selTipo.value;
        const disco = selDisco.value;
        const conf = selConfianza.value;
        const filtradas = d.entradas.filter(e => {
          if (tipo && e.tipo !== tipo) return false;
          if (disco && e.aparece_en.disco !== disco) return false;
          if (conf && e.confianza !== conf) return false;
          if (q) {
            const hay = [e.termino, e.que_es, e.aparece_en.cancion, e.aparece_en.disco, e.aparece_en.verso || ""].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });
        contador.textContent = filtradas.length + " " + (filtradas.length === 1 ? "entrada" : "entradas");
        cont.innerHTML = filtradas.map(e =>
          '<div class="entrada-card" data-id="' + escapeAttr(e.id) + '">' +
            '<div class="tipo-tag">' + escapeHtml(TIPO_LABEL[e.tipo] || e.tipo) + '</div>' +
            '<div class="termino">' + escapeHtml(e.termino) + '</div>' +
            '<div class="cancion">' + escapeHtml(e.aparece_en.cancion || "(varias)") +
              (e.aparece_en.disco && !String(e.aparece_en.disco).startsWith("(") ? " · " + escapeHtml(e.aparece_en.disco) : "") +
              (e.aparece_en.anio ? " (" + e.aparece_en.anio + ")" : "") +
            '</div>' +
            '<div class="resumen">' + escapeHtml(e.que_es.slice(0, 220)) + (e.que_es.length > 220 ? "…" : "") + '</div>' +
            (e.confianza === "media" ? '<div class="confianza-media">Confianza media</div>' : "") +
          '</div>'
        ).join("");
      }
      inputBuscar.addEventListener("input", renderizar);
      selTipo.addEventListener("change", renderizar);
      selDisco.addEventListener("change", renderizar);
      selConfianza.addEventListener("change", renderizar);
      cont.addEventListener("click", (ev) => {
        const card = ev.target.closest(".entrada-card");
        if (!card) return;
        abrirModal(card.dataset.id);
      });
      renderizar();
      if (window.location.hash) {
        const id = window.location.hash.replace("#", "");
        if (d.entradas.find(e => e.id === id)) setTimeout(() => abrirModal(id), 200);
      }
    } catch (e) { console.error("[glosario]", e); }
  };

  async function abrirModal(id) {
    if (!GLOSARIO) return;
    const e = GLOSARIO.entradas.find(x => x.id === id);
    if (!e) return;
    const back = document.getElementById("modal-back");
    const body = document.getElementById("modal-body");
    body.innerHTML =
      '<button class="modal-cerrar" aria-label="Cerrar">×</button>' +
      '<div class="modal-tipo">' + escapeHtml(TIPO_LABEL[e.tipo] || e.tipo) + '</div>' +
      '<h2>' + escapeHtml(e.termino) + '</h2>' +
      (e.confianza === "media" ? '<div class="confianza-media-banner">Esta entrada está en <strong>confianza media</strong>: la referencia es real y citable, pero la documentación externa no es lo suficientemente firme como para subirla a confianza alta.</div>' : "") +
      '<section><h4>Aparece en</h4>' +
        '<div><strong>' + escapeHtml(e.aparece_en.cancion || "(varias)") + '</strong>' +
          (e.aparece_en.disco && !String(e.aparece_en.disco).startsWith("(") ? ' · <em>' + escapeHtml(e.aparece_en.disco) + '</em>' : "") +
          (e.aparece_en.anio ? ' (' + e.aparece_en.anio + ')' : "") +
        '</div>' +
        (e.aparece_en.banda ? '<div style="color:var(--ink-dim); font-size:.88rem;">' + escapeHtml(e.aparece_en.banda) + '</div>' : "") +
        (e.aparece_en.verso && !String(e.aparece_en.verso).startsWith("(") ? '<div class="verso">' + escapeHtml(e.aparece_en.verso) + '</div>' : '<div style="color:var(--ink-dim); font-size:.9rem; margin-top:8px;">' + escapeHtml(e.aparece_en.verso || "(referencia en el título / posición especial)") + '</div>') +
      '</section>' +
      '<section><h4>Qué es</h4><div class="que-es">' + escapeHtml(e.que_es) + '</div></section>' +
      (e.contemporaneidad ? '<section><h4>Contemporaneidad</h4><div>' + escapeHtml(e.contemporaneidad) + '</div></section>' : "") +
      '<section><h4>Fuentes</h4><ul class="fuentes">' +
        (e.fuentes || []).map(f =>
          '<li>' +
            '<span class="fuente-tipo">' + escapeHtml(FUENTE_LABEL[f.tipo] || f.tipo) + '</span> ' +
            '<a href="' + escapeAttr(f.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(f.url.replace(/^https?:\/\//, "")) + '</a>' +
            (f.descripcion ? '<div style="color:var(--ink-dim); font-size:.84rem; margin-top:4px;">' + escapeHtml(f.descripcion) + '</div>' : "") +
          '</li>'
        ).join("") +
      '</ul></section>';
    body.querySelector(".modal-cerrar").addEventListener("click", cerrarModal);
    back.classList.add("open");
    back.addEventListener("click", (ev) => { if (ev.target === back) cerrarModal(); });
    document.addEventListener("keydown", escListener);
  }

  function cerrarModal() {
    const back = document.getElementById("modal-back");
    if (back) back.classList.remove("open");
    document.removeEventListener("keydown", escListener);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  function escListener(ev) { if (ev.key === "Escape") cerrarModal(); }

  MUH.hidratarCanciones = async function () {
    try {
      const d = await cargar();
      const cont = document.getElementById("canciones-cont");
      const porCancion = {};
      d.entradas.forEach(e => {
        const cancion = e.aparece_en.cancion;
        if (!cancion || String(cancion).startsWith("(")) return;
        const key = cancion + "||" + (e.aparece_en.disco || "");
        if (!porCancion[key]) porCancion[key] = { cancion, disco: e.aparece_en.disco, anio: e.aparece_en.anio, banda: e.aparece_en.banda, entradas: [] };
        porCancion[key].entradas.push(e);
      });
      const canciones = Object.values(porCancion).sort((a, b) => {
        if ((a.anio || 0) !== (b.anio || 0)) return (a.anio || 0) - (b.anio || 0);
        return a.cancion.localeCompare(b.cancion);
      });
      cont.innerHTML = canciones.map(c =>
        '<div class="cancion-card" data-cancion="' + escapeAttr(c.cancion) + '">' +
          '<div class="titulo">' + escapeHtml(c.cancion) + '</div>' +
          '<div class="meta">' +
            (c.disco && !String(c.disco).startsWith("(") ? '<span class="disco">' + escapeHtml(c.disco) + '</span>' : "") +
            (c.anio ? ' · ' + c.anio : "") +
            (c.banda ? ' · <span class="banda">' + escapeHtml(c.banda) + '</span>' : "") +
          '</div>' +
          '<div class="refs">' + c.entradas.length + ' ' + (c.entradas.length === 1 ? "referencia" : "referencias") + ': ' +
            c.entradas.slice(0, 4).map(e => escapeHtml(e.termino.split(" (")[0])).join(" · ") +
            (c.entradas.length > 4 ? " · …" : "") +
          '</div>' +
        '</div>'
      ).join("");
      cont.addEventListener("click", (ev) => {
        const card = ev.target.closest(".cancion-card");
        if (!card) return;
        window.location.href = "cancion.html?c=" + encodeURIComponent(card.dataset.cancion);
      });
    } catch (e) { console.error("[canciones]", e); }
  };

  MUH.hidratarEspacios = async function () {
    if (!window.MUH_SUPA) return;
    try {
      const espacios = await MUH_SUPA.listarEspacios();
      const cont = document.getElementById("espacios-cont");
      const tematicos = espacios.filter(e => e.tipo === "tematico");
      const geograficos = espacios.filter(e => e.tipo === "geografico");
      const renderCard = e =>
        '<div class="cancion-card" data-slug="' + escapeAttr(e.slug) + '">' +
          '<div class="titulo">' + escapeHtml(e.nombre) + '</div>' +
          '<div class="meta">' + escapeHtml(e.descripcion || (e.region_pais ? e.region_pais + (e.region_ciudad ? " · " + e.region_ciudad : "") : "")) + '</div>' +
        '</div>';
      cont.innerHTML =
        '<section style="margin-bottom: 36px;"><h2>Espacios temáticos</h2><div class="canciones-lista">' + tematicos.map(renderCard).join("") + '</div></section>' +
        '<section><h2>Espacios por ciudad</h2><p class="lead" style="color:var(--ink-soft); margin-bottom: 16px;">Ricoteros de cada rincón. Si tu ciudad no está, podés proponerla.</p><div class="canciones-lista">' + geograficos.map(renderCard).join("") + '</div></section>';
      cont.addEventListener("click", (ev) => {
        const card = ev.target.closest(".cancion-card");
        if (!card) return;
        window.location.href = "espacio.html?s=" + encodeURIComponent(card.dataset.slug);
      });
    } catch (e) { console.error("[espacios]", e); }
  };

  MUH.hidratarTributos = async function () {
    if (!window.MUH_SUPA) return;
    try {
      const lista = await MUH_SUPA.listarTributos();
      const cont = document.getElementById("tributos-cont");
      if (!lista.length) {
        cont.innerHTML = '<p style="color:var(--ink-soft);">Todavía no hay tributos cargados. <a href="proponer-tributo.html">¿Conocés una banda tributo? Sumala.</a></p>';
        return;
      }
      const porPais = {};
      lista.forEach(t => { if (!porPais[t.pais]) porPais[t.pais] = []; porPais[t.pais].push(t); });
      cont.innerHTML = Object.keys(porPais).sort().map(pais =>
        '<section style="margin-bottom: 36px;"><h2>' + escapeHtml(pais) + '</h2><div class="canciones-lista">' +
          porPais[pais].map(t =>
            '<div class="cancion-card">' +
              '<div class="titulo">' + escapeHtml(t.nombre) + '</div>' +
              '<div class="meta">' + escapeHtml(t.ciudad) + '</div>' +
              (t.descripcion ? '<div class="refs">' + escapeHtml(t.descripcion) + '</div>' : "") +
            '</div>'
          ).join("") +
        '</div></section>'
      ).join("");
    } catch (e) { console.error("[tributos]", e); }
  };

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function escapeAttr(s) { if (s == null) return ""; return String(s).replace(/"/g, "&quot;"); }
  function sampleVariado(arr, n) {
    const porTipo = {};
    arr.forEach(e => { if (!porTipo[e.tipo]) porTipo[e.tipo] = []; porTipo[e.tipo].push(e); });
    const tipos = Object.keys(porTipo);
    const out = []; let i = 0;
    while (out.length < n && tipos.length) {
      const tipo = tipos[i % tipos.length];
      if (porTipo[tipo].length) {
        const idx = Math.floor(Math.random() * porTipo[tipo].length);
        out.push(porTipo[tipo].splice(idx, 1)[0]);
      } else tipos.splice(i % tipos.length, 1);
      i++;
    }
    return out;
  }
})();
