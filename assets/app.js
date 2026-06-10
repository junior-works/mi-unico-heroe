/* Mi único héroe — app.js v0.3.3
   Vista canción: video YouTube + link a Letras.com + entradas del glosario
   con sus versos citados (sin letra completa por respeto a derechos).
*/
(function () {
  if (!window.MUH_SUPA) throw new Error("MUH_SUPA no cargado");
  const SUPA = window.MUH_SUPA;
  const CFG = window.MUH_CONFIG;

  const cargar = {
    entradas: null,
    canciones: null
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(s) {
    return String(s || "").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }

  function youtubeIdDeUrl(url) {
    if (!url) return null;
    const m = url.match(/[?&]v=([\w-]{11})/) || url.match(/youtu\.be\/([\w-]{11})/) || url.match(/embed\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  async function hidratarTopbar() {
    const slot = document.getElementById("auth-slot");
    if (!slot) return;
    const u = await SUPA.getUsuarioActual();
    if (u) {
      slot.innerHTML = '<a href="mi-perfil.html" class="nav-mini">Mi perfil</a> <button id="btn-salir" class="link-bare">Adieu! Bye Bye! Aufwiedersehen!</button>';
      const b = document.getElementById("btn-salir");
      if (b) b.addEventListener("click", async () => { await SUPA.cerrarSesion(); location.href = "index.html"; });
    } else {
      slot.innerHTML = '<a href="acceder.html" class="nav-mini">Entrar</a>';
    }
  }

  async function hidratarHome() {
    SUPA.procesarRedirectHash && SUPA.procesarRedirectHash();
    let entradas;
    try {
      entradas = await SUPA.listarEntradasGlosario();
      cargar.entradas = entradas;
    } catch (e) {
      const cont = document.getElementById("stat-entradas");
      if (cont) cont.textContent = "?";
      return;
    }
    const elEnt = document.getElementById("stat-entradas");
    const elDisc = document.getElementById("stat-discos");
    const elFnt = document.getElementById("stat-fuentes");
    if (elEnt) elEnt.textContent = entradas.length;
    if (elDisc) {
      const discos = new Set(entradas.map(e => e.disco).filter(Boolean));
      elDisc.textContent = discos.size;
    }
    if (elFnt) {
      let n = 0;
      entradas.forEach(e => { if (Array.isArray(e.fuentes)) n += e.fuentes.length; });
      elFnt.textContent = n;
    }
    const grid = document.getElementById("muestra-grid");
    if (grid) {
      const elegidas = ["barbazul", "kristallnacht", "ji-ji-ji"].map(s => entradas.find(e => e.id === s)).filter(Boolean).slice(0, 3);
      const fallback = entradas.slice(0, 3);
      const sample = elegidas.length ? elegidas : fallback;
      grid.innerHTML = sample.map(e =>
        '<a class="muestra-card muestra-card-term" href="glosario.html#e=' + esc(e.id) + '">' +
          '<h3>' + esc(e.termino) + '</h3>' +
          '<p class="muestra-meta">' + esc(e.cancion || "") + (e.disco ? ' · ' + esc(e.disco) : '') + (e.anio ? ' · ' + e.anio : '') + '</p>' +
          '<p class="muestra-def">' + esc((e.que_es || "").slice(0, 140)) + ((e.que_es || "").length > 140 ? "…" : "") + '</p>' +
        '</a>'
      ).join("");
    }
  }

  function renderEstado(cont, msg) { if (cont) cont.innerHTML = '<p style="opacity:.7; padding:20px 0;">' + esc(msg) + '</p>'; }

  function cardEntradaHtml(e) {
    return (
      '<a class="entrada-card" data-id="' + esc(e.id) + '" href="glosario.html#e=' + esc(e.id) + '">' +
        '<h3>' + esc(e.termino) + '</h3>' +
        (e.verso ? '<blockquote class="verso">"' + esc(e.verso) + '"</blockquote>' : '') +
        '<p class="que-es">' + esc((e.que_es || "").slice(0, 220)) + ((e.que_es || "").length > 220 ? "…" : "") + '</p>' +
        '<p class="meta-entrada">' +
          (e.cancion ? '<span class="tag tag-cancion">' + esc(e.cancion) + '</span>' : '') +
          (e.disco ? '<span class="tag tag-disco">' + esc(e.disco) + (e.anio ? " · " + e.anio : "") + '</span>' : '') +
          (e.tipo ? '<span class="tag tag-tipo">' + esc(String(e.tipo).replace(/_/g, " ")) + '</span>' : '') +
        '</p>' +
      '</a>'
    );
  }

  async function hidratarGlosario() {
    const cont = document.getElementById("entradas-cont");
    const fBuscar = document.getElementById("filtro-buscar");
    const fTipo = document.getElementById("filtro-tipo");
    const fDisco = document.getElementById("filtro-disco");
    const fConf = document.getElementById("filtro-confianza");
    const contador = document.getElementById("contador-resultados");
    if (!cont) return;

    let entradas;
    try { entradas = await SUPA.listarEntradasGlosario(); cargar.entradas = entradas; }
    catch (e) { renderEstado(cont, "No pude cargar el glosario: " + e.message); return; }

    if (fDisco) {
      const discos = Array.from(new Set(entradas.map(e => e.disco).filter(Boolean))).sort();
      discos.forEach(d => {
        const o = document.createElement("option");
        o.value = d; o.textContent = d;
        fDisco.appendChild(o);
      });
    }

    function renderizar() {
      const q = (fBuscar && fBuscar.value || "").trim().toLowerCase();
      const t = fTipo && fTipo.value || "";
      const d = fDisco && fDisco.value || "";
      const c = fConf && fConf.value || "";
      const lista = entradas.filter(e => {
        if (t && e.tipo !== t) return false;
        if (d && e.disco !== d) return false;
        if (c && e.confianza !== c) return false;
        if (q) {
          const hay = ((e.termino || "") + " " + (e.que_es || "") + " " + (e.verso || "") + " " + (e.cancion || "")).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      if (contador) contador.textContent = lista.length + " entrada" + (lista.length === 1 ? "" : "s");
      if (lista.length === 0) { cont.innerHTML = '<p style="opacity:.7;">Cuando la noche es más oscura, se viene el día en tu corazón. — Probá quitar algún filtro.</p>'; return; }
      cont.innerHTML = lista.map(cardEntradaHtml).join("");
      cont.querySelectorAll(".entrada-card").forEach(a => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          abrirModalEntrada(a.dataset.id);
        });
      });
    }

    if (fBuscar) fBuscar.addEventListener("input", renderizar);
    if (fTipo) fTipo.addEventListener("change", renderizar);
    if (fDisco) fDisco.addEventListener("change", renderizar);
    if (fConf) fConf.addEventListener("change", renderizar);
    renderizar();

    if (location.hash && location.hash.indexOf("#e=") === 0) {
      const id = decodeURIComponent(location.hash.slice(3));
      setTimeout(() => abrirModalEntrada(id), 50);
    }
  }

  async function abrirModalEntrada(id) {
    const back = document.getElementById("modal-back");
    const body = document.getElementById("modal-body");
    if (!back || !body) return;
    body.innerHTML = '<p>Cargando…</p>';
    back.classList.add("abierto");
    const e = (cargar.entradas || []).find(x => x.id === id) || await SUPA.obtenerEntradaGlosario(id);
    if (!e) { body.innerHTML = '<p>Entrada no encontrada.</p>'; return; }
    const fuentesHtml = (e.fuentes || []).map(f => {
      const lbl = f.tipo ? f.tipo.replace(/_/g, " ") : "fuente";
      return '<li><span class="fuente-tipo">' + esc(lbl) + '</span> <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a></li>';
    }).join("");
    const cancionSlug = e.cancion ? slugify(e.cancion) : null;
    body.innerHTML = (
      '<button class="modal-cerrar" aria-label="Cerrar">×</button>' +
      '<h2>' + esc(e.termino) + '</h2>' +
      '<p class="modal-meta">' +
        (e.cancion ? '<a class="modal-meta-cancion" href="cancion.html?slug=' + esc(cancionSlug || "") + '">' + esc(e.cancion) + '</a>' : '') +
        (e.disco ? ' · ' + esc(e.disco) : '') +
        (e.anio ? ' · ' + e.anio : '') +
        (e.banda ? ' · <em>' + esc(e.banda) + '</em>' : '') +
      '</p>' +
      (e.verso ? '<blockquote class="verso-modal">"' + esc(e.verso) + '"</blockquote>' : '') +
      '<div class="que-es-modal">' + esc(e.que_es || "").replace(/\n+/g, "<br><br>") + '</div>' +
      (fuentesHtml ? '<h3>Fuentes</h3><ul class="fuentes">' + fuentesHtml + '</ul>' : '') +
      (e.confianza ? '<p class="confianza-pill">Confianza: <strong>' + esc(e.confianza) + '</strong></p>' : '')
    );
    body.querySelector(".modal-cerrar").addEventListener("click", cerrarModal);
    back.addEventListener("click", function backClick(ev) { if (ev.target === back) { cerrarModal(); back.removeEventListener("click", backClick); } });
  }
  function cerrarModal() {
    const back = document.getElementById("modal-back");
    if (back) back.classList.remove("abierto");
    if (location.hash.indexOf("#e=") === 0) history.replaceState({}, "", location.pathname + location.search);
  }

  async function hidratarDiscografia() {
    const cont = document.getElementById("discografia-cont");
    if (!cont) return;
    cont.innerHTML = "Cargando…";
    let canciones;
    try { canciones = await SUPA.listarCanciones(); cargar.canciones = canciones; }
    catch (e) { renderEstado(cont, "No pude cargar la discografía: " + e.message); return; }

    const porBanda = {};
    canciones.forEach(c => {
      const b = c.banda || "(sin banda)";
      const d = c.disco || (c.es_inedita ? "Inéditos / no publicados" : "Singles");
      if (!porBanda[b]) porBanda[b] = {};
      if (!porBanda[b][d]) porBanda[b][d] = { anio: c.anio, canciones: [] };
      porBanda[b][d].canciones.push(c);
      if (c.anio && (!porBanda[b][d].anio || c.anio < porBanda[b][d].anio)) porBanda[b][d].anio = c.anio;
    });

    const orden = [
      "Patricio Rey y sus Redonditos de Ricota",
      "Indio Solari y Los Fundamentalistas del Aire Acondicionado",
      "El Mister y Los Marsupiales Extintos feat. Indio Solari"
    ];
    const bandas = Object.keys(porBanda).sort((a, b) => {
      const ia = orden.indexOf(a), ib = orden.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    cont.innerHTML = bandas.map(b => {
      const discosObj = porBanda[b];
      const discos = Object.keys(discosObj).sort((x, y) => {
        const ax = discosObj[x].anio || 9999, ay = discosObj[y].anio || 9999;
        return ax - ay;
      });
      return (
        '<section class="banda-block">' +
          '<h2 class="banda-nombre">' + esc(b) + '</h2>' +
          discos.map(d => {
            const data = discosObj[d];
            return (
              '<a class="disco-card" href="disco.html?banda=' + encodeURIComponent(b) + '&disco=' + encodeURIComponent(d) + '">' +
                '<div class="disco-title">' +
                  '<h3>' + esc(d) + '</h3>' +
                  '<p class="disco-meta">' + (data.anio ? data.anio + " · " : "") + data.canciones.length + " tema" + (data.canciones.length === 1 ? "" : "s") + '</p>' +
                '</div>' +
              '</a>'
            );
          }).join("") +
        '</section>'
      );
    }).join("");
  }

  async function hidratarDisco() {
    const cont = document.getElementById("disco-cont");
    const titulo = document.getElementById("disco-titulo");
    const meta = document.getElementById("disco-meta");
    if (!cont) return;
    const p = new URLSearchParams(location.search);
    const banda = p.get("banda");
    const disco = p.get("disco");
    if (!banda || !disco) {
      cont.innerHTML = '<p>Falta indicar disco. <a href="discografia.html">Ver discografía</a>.</p>';
      return;
    }
    let canciones;
    try { canciones = await SUPA.listarCanciones(); }
    catch (e) { renderEstado(cont, "No pude cargar: " + e.message); return; }
    const delDisco = canciones.filter(c => {
      const d = c.disco || (c.es_inedita ? "Inéditos / no publicados" : "Singles");
      return c.banda === banda && d === disco;
    });
    if (delDisco.length === 0) {
      cont.innerHTML = '<p>No encontré canciones para ese disco.</p>';
      return;
    }
    const anio = delDisco[0].anio;
    if (titulo) titulo.textContent = disco;
    if (meta) meta.innerHTML = esc(banda) + (anio ? " · " + anio : "");
    cont.innerHTML = (
      '<ol class="tracklist">' +
      delDisco.map((c, i) => (
        '<li class="track">' +
          '<a href="cancion.html?slug=' + esc(c.slug) + '">' +
            '<span class="track-num">' + (i + 1) + '</span>' +
            '<span class="track-title">' + esc(c.titulo) + '</span>' +
            (c.video_youtube_url ? '<span class="track-flag flag-video" title="Con video">▶</span>' : '') +
            (c.fuente_letra_url ? '<span class="track-flag flag-letra" title="Con letra">♪</span>' : '') +
          '</a>' +
        '</li>'
      )).join("") +
      '</ol>'
    );
  }

  // Vista canción: video + link a Letras.com + entradas del glosario con sus versos citados.
  async function hidratarCancion() {
    const cont = document.getElementById("cancion-cont");
    const tituloEl = document.getElementById("cancion-titulo");
    const metaEl = document.getElementById("cancion-meta");
    const videoEl = document.getElementById("cancion-video");
    const letraEl = document.getElementById("cancion-letra");
    const entradasEl = document.getElementById("cancion-entradas");
    const notasEl = document.getElementById("cancion-notas");
    if (!cont) return;
    const p = new URLSearchParams(location.search);
    const slug = p.get("slug") || p.get("c");
    if (!slug) {
      cont.innerHTML = '<p>No indicaste qué canción. <a href="discografia.html">Ver discografía</a>.</p>';
      return;
    }
    let c;
    try { c = await SUPA.obtenerCancionPorSlug(slug); }
    catch (e) { cont.innerHTML = '<p>No pude cargar: ' + esc(e.message) + '</p>'; return; }
    if (!c) {
      const canciones = await SUPA.listarCanciones();
      c = canciones.find(x => slugify(x.titulo) === slug);
    }
    if (!c) { cont.innerHTML = '<p>Canción no encontrada.</p>'; return; }

    if (tituloEl) tituloEl.textContent = c.titulo;
    if (metaEl) {
      const partes = [];
      if (c.disco) partes.push(c.disco);
      if (c.anio) partes.push(String(c.anio));
      if (c.banda) partes.push(c.banda);
      metaEl.textContent = partes.join(" · ");
    }
    if (notasEl) {
      if (c.notas) notasEl.innerHTML = '<p class="nota-cancion"><strong>Nota:</strong> ' + esc(c.notas) + '</p>';
      else notasEl.innerHTML = "";
    }
    if (videoEl) {
      const vid = youtubeIdDeUrl(c.video_youtube_url);
      if (vid) {
        videoEl.innerHTML = '<div class="yt-embed"><iframe src="https://www.youtube.com/embed/' + vid + '" title="' + esc(c.titulo) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>';
      } else if (c.video_youtube_url) {
        videoEl.innerHTML = '<p><a class="cta-secondary" href="' + esc(c.video_youtube_url) + '" target="_blank" rel="noopener">Ver en YouTube</a></p>';
      } else {
        videoEl.innerHTML = '<p class="placeholder">Video oficial pendiente. <a href="https://www.youtube.com/results?search_query=' + encodeURIComponent((c.banda || "") + " " + c.titulo) + '" target="_blank" rel="noopener">Buscar en YouTube</a></p>';
      }
    }

    let entradasDeCancion = [];
    try { entradasDeCancion = await SUPA.listarEntradasDeCancion(c.id); } catch (e) {}

    if (letraEl) {
      const cuerpo = [];
      cuerpo.push('<h2>Letra y palabras del glosario</h2>');
      cuerpo.push('<p class="placeholder" style="text-align:left;">');
      cuerpo.push('Por respeto a los derechos de autor, no reproducimos la letra completa acá. ');
      if (c.fuente_letra_url) {
        cuerpo.push('La podés leer en <a href="' + esc(c.fuente_letra_url) + '" target="_blank" rel="noopener">Letras.com</a>.');
      } else {
        const query = encodeURIComponent((c.banda || "") + " " + c.titulo + " letra");
        cuerpo.push('<a href="https://www.google.com/search?q=' + query + '" target="_blank" rel="noopener">Buscar la letra</a>.');
      }
      cuerpo.push('</p>');
      if (entradasDeCancion.length > 0) {
        cuerpo.push('<p style="color:var(--ink-soft);">Acá te dejamos los versos donde aparecen palabras del glosario, con su explicación:</p>');
        cuerpo.push('<ul class="versos-glosario">');
        entradasDeCancion.forEach(e => {
          cuerpo.push('<li class="verso-glosario">');
          if (e.verso) {
            cuerpo.push('<blockquote class="verso">"' + esc(e.verso) + '"</blockquote>');
          }
          cuerpo.push('<p class="verso-explica"><a class="glosario-link" data-id="' + esc(e.id) + '" href="#e=' + esc(e.id) + '"><strong>' + esc(e.termino) + '</strong></a> — ' + esc((e.que_es || "").slice(0, 200)) + ((e.que_es || "").length > 200 ? "…" : "") + '</p>');
          cuerpo.push('</li>');
        });
        cuerpo.push('</ul>');
      }
      letraEl.innerHTML = cuerpo.join("");
      letraEl.querySelectorAll(".glosario-link").forEach(a => {
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          abrirModalEntrada(a.dataset.id);
        });
      });
    }

    if (entradasEl) {
      if (entradasDeCancion.length === 0) {
        entradasEl.innerHTML = '<p class="placeholder">Esta canción todavía no tiene entradas del glosario. <a href="proponer.html">¿Querés proponer una?</a></p>';
      } else {
        entradasEl.innerHTML = '<h3>Todas las entradas del glosario en esta canción (' + entradasDeCancion.length + ')</h3>' +
          '<div class="entradas-grid">' + entradasDeCancion.map(cardEntradaHtml).join("") + '</div>';
        entradasEl.querySelectorAll(".entrada-card").forEach(a => {
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            abrirModalEntrada(a.dataset.id);
          });
        });
      }
    }

    if (location.hash && location.hash.indexOf("#e=") === 0) {
      const id = decodeURIComponent(location.hash.slice(3));
      setTimeout(() => abrirModalEntrada(id), 50);
    }
  }

  async function hidratarCanciones() {
    const cont = document.getElementById("canciones-cont");
    if (!cont) return;
    cont.innerHTML = "Cargando…";
    let canciones;
    try { canciones = await SUPA.listarCanciones(); cargar.canciones = canciones; }
    catch (e) { renderEstado(cont, "No pude cargar: " + e.message); return; }
    let entradas;
    try { entradas = cargar.entradas || await SUPA.listarEntradasGlosario(); } catch (e) { entradas = []; }
    const cancionIds = new Set(entradas.map(e => e.cancion_id).filter(Boolean));
    const lista = canciones.filter(c => cancionIds.has(c.id));
    lista.sort((a, b) => (a.anio || 9999) - (b.anio || 9999) || (a.titulo || "").localeCompare(b.titulo || ""));
    cont.innerHTML = lista.map(c => {
      const n = entradas.filter(e => e.cancion_id === c.id).length;
      return (
        '<a class="cancion-card" href="cancion.html?slug=' + esc(c.slug) + '">' +
          '<h3>' + esc(c.titulo) + '</h3>' +
          '<p class="cancion-meta">' + esc(c.disco || (c.es_inedita ? "Inédita" : "Single")) + (c.anio ? " · " + c.anio : "") + " · " + esc(c.banda) + '</p>' +
          '<p class="cancion-glosa">' + n + " referencia" + (n === 1 ? "" : "s") + " del glosario</p>" +
          (c.video_youtube_url ? '<span class="cancion-flag">▶ con video</span>' : '') +
        '</a>'
      );
    }).join("");
  }

  async function listarEspaciosUI() {
    const cont = document.getElementById("espacios-cont");
    if (!cont) return;
    try {
      const arr = await SUPA.listarEspacios();
      cont.innerHTML = arr.map(s => (
        '<a class="espacio-card" href="espacio.html?s=' + esc(s.slug) + '">' +
          '<h3>' + esc(s.nombre) + '</h3>' +
          '<p>' + esc(s.descripcion || "") + '</p>' +
          (s.tipo ? '<span class="tag tag-tipo-espacio">' + esc(s.tipo) + '</span>' : '') +
          (s.region_pais ? '<span class="tag">' + esc(s.region_pais) + (s.region_ciudad ? " · " + esc(s.region_ciudad) : "") + '</span>' : '') +
        '</a>'
      )).join("");
    } catch (e) { renderEstado(cont, "No pude cargar: " + e.message); }
  }

  async function hidratarEspacios() { return listarEspaciosUI(); }

  async function hidratarTributos() {
    const cont = document.getElementById("tributos-cont");
    if (!cont) return;
    try {
      const arr = await SUPA.listarTributos();
      if (arr.length === 0) {
        cont.innerHTML = '<p>Todavía no hay bandas tributo cargadas. ¿<a href="proponer-tributo.html">Conocés una?</a></p>';
        return;
      }
      cont.innerHTML = arr.map(t => (
        '<div class="tributo-card">' +
          '<h3>' + esc(t.nombre) + '</h3>' +
          '<p>' + esc(t.ciudad) + ', ' + esc(t.pais) + '</p>' +
          (t.descripcion ? '<p>' + esc(t.descripcion) + '</p>' : '') +
          '<p class="tributo-links">' +
            (t.instagram_url ? '<a href="' + esc(t.instagram_url) + '" target="_blank" rel="noopener">Instagram</a> ' : '') +
            (t.facebook_url ? '<a href="' + esc(t.facebook_url) + '" target="_blank" rel="noopener">Facebook</a> ' : '') +
            (t.youtube_url ? '<a href="' + esc(t.youtube_url) + '" target="_blank" rel="noopener">YouTube</a> ' : '') +
          '</p>' +
        '</div>'
      )).join("");
    } catch (e) { renderEstado(cont, "No pude cargar: " + e.message); }
  }

  window.MUH = {
    cargar: cargar,
    hidratarTopbar: hidratarTopbar,
    hidratarHome: hidratarHome,
    hidratarGlosario: hidratarGlosario,
    hidratarCanciones: hidratarCanciones,
    hidratarEspacios: hidratarEspacios,
    hidratarTributos: hidratarTributos,
    hidratarDiscografia: hidratarDiscografia,
    hidratarDisco: hidratarDisco,
    hidratarCancion: hidratarCancion,
    abrirModalEntrada: abrirModalEntrada,
    slugify: slugify
  };
})();
