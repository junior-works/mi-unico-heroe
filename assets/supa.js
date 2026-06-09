/* Mi único héroe — cliente Supabase
   v0.3.0 — incluye canciones (discografía + letra + video).
*/
(function () {
  if (!window.MUH_CONFIG) throw new Error("MUH_CONFIG no cargado");
  const cfg = window.MUH_CONFIG;
  const REST = cfg.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
  const AUTH = cfg.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1";

  const SESSION_KEY = "muh:session";

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  }

  function authHeaders(extra) {
    const s = getSession();
    const h = { apikey: cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (s && s.access_token) h["Authorization"] = "Bearer " + s.access_token;
    return Object.assign(h, extra || {});
  }

  async function jfetch(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) {
      let txt = "";
      try { txt = await r.text(); } catch (e) {}
      throw new Error("HTTP " + r.status + " " + (txt || ""));
    }
    if (r.status === 204) return null;
    return await r.json();
  }

  async function getUsuarioActual() {
    const s = getSession();
    if (!s || !s.access_token) return null;
    try {
      const r = await fetch(AUTH + "/user", { headers: authHeaders() });
      if (!r.ok) { setSession(null); return null; }
      const u = await r.json();
      return u;
    } catch (e) { return null; }
  }

  async function cerrarSesion() {
    const s = getSession();
    if (s && s.access_token) {
      try { await fetch(AUTH + "/logout", { method: "POST", headers: authHeaders() }); } catch (e) {}
    }
    setSession(null);
  }

  async function enviarMagicLink(email, redirectTo) {
    const body = { email: email, options: { email_redirect_to: redirectTo || location.origin + location.pathname.replace(/[^/]*$/, "") } };
    return await jfetch(AUTH + "/otp", {
      method: "POST",
      headers: { apikey: cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function procesarRedirectHash() {
    const h = location.hash;
    if (!h || h.length < 2) return false;
    const params = new URLSearchParams(h.slice(1));
    const at = params.get("access_token");
    const rt = params.get("refresh_token");
    if (!at) return false;
    setSession({
      access_token: at,
      refresh_token: rt,
      expires_at: parseInt(params.get("expires_at") || "0", 10),
      token_type: params.get("token_type") || "bearer"
    });
    history.replaceState({}, "", location.pathname + location.search);
    return true;
  }

  async function listarEntradasGlosario() {
    return await jfetch(REST + "/glosario_entradas?estado=eq.publicado&order=termino.asc&limit=500", {
      headers: authHeaders({ Prefer: "count=exact" })
    });
  }

  async function obtenerEntradaGlosario(id) {
    const arr = await jfetch(REST + "/glosario_entradas?id=eq." + encodeURIComponent(id) + "&select=*", {
      headers: authHeaders()
    });
    return arr && arr[0] || null;
  }

  async function proponerEntrada(payload) {
    payload.estado = "propuesto";
    return await jfetch(REST + "/glosario_entradas", {
      method: "POST",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(payload)
    });
  }

  async function listarEspacios() {
    return await jfetch(REST + "/espacios?order=es_oficial.desc,nombre.asc&limit=200", { headers: authHeaders() });
  }

  async function obtenerEspacio(slug) {
    const arr = await jfetch(REST + "/espacios?slug=eq." + encodeURIComponent(slug) + "&select=*", { headers: authHeaders() });
    return arr && arr[0] || null;
  }

  async function listarPostsDeEspacio(espacioId) {
    return await jfetch(REST + "/posts?espacio_id=eq." + encodeURIComponent(espacioId) + "&order=created_at.desc&limit=100", { headers: authHeaders() });
  }

  async function crearPost(payload) {
    return await jfetch(REST + "/posts", {
      method: "POST",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(payload)
    });
  }

  async function listarComentariosEntrada(entradaId) {
    return await jfetch(REST + "/comentarios?entrada_glosario_id=eq." + encodeURIComponent(entradaId) + "&order=created_at.asc&limit=200", { headers: authHeaders() });
  }

  async function comentarEntrada(entradaId, texto) {
    return await jfetch(REST + "/comentarios", {
      method: "POST",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({ entrada_glosario_id: entradaId, texto: texto })
    });
  }

  async function listarTributos() {
    return await jfetch(REST + "/tributos?estado=eq.aprobado&order=pais.asc,ciudad.asc&limit=500", { headers: authHeaders() });
  }

  async function proponerTributo(payload) {
    payload.estado = "pendiente";
    return await jfetch(REST + "/tributos", {
      method: "POST",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify(payload)
    });
  }

  async function listarEventos() {
    return await jfetch(REST + "/eventos?aprobado=eq.true&order=fecha_inicio.asc&limit=200", { headers: authHeaders() });
  }

  async function listarRicoterosEnMapa() {
    return await jfetch(REST + "/usuarios?en_mapa_publico=eq.true&select=id,nombre_display,pais,ciudad,avatar_url&limit=1000", { headers: authHeaders() });
  }

  async function obtenerPerfilPropio() {
    const u = await getUsuarioActual();
    if (!u) return null;
    const arr = await jfetch(REST + "/usuarios?id=eq." + encodeURIComponent(u.id) + "&select=*", { headers: authHeaders() });
    return arr && arr[0] || null;
  }

  // --- CANCIONES (nuevo en v0.3.0) -------------------------------------------------

  async function listarCanciones() {
    return await jfetch(REST + "/canciones?order=banda.asc,anio.asc.nullsfirst,disco.asc.nullsfirst,titulo.asc&limit=500", { headers: authHeaders() });
  }

  async function obtenerCancionPorSlug(slug) {
    const arr = await jfetch(REST + "/canciones?slug=eq." + encodeURIComponent(slug) + "&select=*", { headers: authHeaders() });
    return arr && arr[0] || null;
  }

  async function listarEntradasDeCancion(cancionId) {
    return await jfetch(REST + "/glosario_entradas?cancion_id=eq." + encodeURIComponent(cancionId) + "&estado=eq.publicado&order=termino.asc&limit=200", { headers: authHeaders() });
  }

  // ---- exposición -------

  window.MUH_SUPA = {
    cfg: cfg,
    REST: REST,
    AUTH: AUTH,
    getSession: getSession,
    getUsuarioActual: getUsuarioActual,
    cerrarSesion: cerrarSesion,
    enviarMagicLink: enviarMagicLink,
    procesarRedirectHash: procesarRedirectHash,
    listarEntradasGlosario: listarEntradasGlosario,
    obtenerEntradaGlosario: obtenerEntradaGlosario,
    proponerEntrada: proponerEntrada,
    listarEspacios: listarEspacios,
    obtenerEspacio: obtenerEspacio,
    listarPostsDeEspacio: listarPostsDeEspacio,
    crearPost: crearPost,
    listarComentariosEntrada: listarComentariosEntrada,
    comentarEntrada: comentarEntrada,
    listarTributos: listarTributos,
    proponerTributo: proponerTributo,
    listarEventos: listarEventos,
    listarRicoterosEnMapa: listarRicoterosEnMapa,
    obtenerPerfilPropio: obtenerPerfilPropio,
    listarCanciones: listarCanciones,
    obtenerCancionPorSlug: obtenerCancionPorSlug,
    listarEntradasDeCancion: listarEntradasDeCancion
  };
})();
