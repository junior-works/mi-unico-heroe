/* Cliente Supabase mínimo (sin SDK) para Mi único héroe.
   Cubre: select con filtros, insert, update, llamadas a RPC, auth con magic link.
   Usamos fetch + headers — el front no necesita el SDK pesado de @supabase/supabase-js.
*/
(function () {
  const cfg = window.MUH_CONFIG;
  if (!cfg) throw new Error("MUH_CONFIG no cargado");

  const REST = cfg.SUPABASE_URL + "/rest/v1";
  const AUTH = cfg.SUPABASE_URL + "/auth/v1";
  const STORAGE_KEY = "muh.session.v1";

  function getSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // Expira en expires_at (segundos epoch); damos margen de 60s.
      if (s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 60000)) {
        return s;
      }
      return null;
    } catch (_) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
    document.dispatchEvent(new CustomEvent("muh-auth-cambio", { detail: s }));
  }

  function headers(extra) {
    const s = getSession();
    const h = {
      "apikey": cfg.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Authorization": "Bearer " + (s && s.access_token ? s.access_token : cfg.SUPABASE_ANON_KEY)
    };
    return Object.assign(h, extra || {});
  }

  async function rest(path, opts) {
    const url = path.startsWith("http") ? path : REST + path;
    const r = await fetch(url, Object.assign({ headers: headers(opts && opts.extraHeaders) }, opts));
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error("REST " + r.status + ": " + txt.slice(0, 300));
    }
    if (r.status === 204) return null;
    return r.json();
  }

  // ============ AUTH ============
  async function enviarMagicLink(email, redirectTo) {
    const url = AUTH + "/otp";
    const body = { email: email, create_user: true, options: { email_redirect_to: redirectTo || location.origin + location.pathname } };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error("Auth: " + txt.slice(0, 200));
    }
    return true;
  }

  // Lee el hash del redirect (#access_token=... &refresh_token=... &expires_in=...)
  // y guarda la sesión.
  function procesarRedirectHash() {
    const h = location.hash.replace(/^#/, "");
    if (!h.includes("access_token=")) return false;
    const params = new URLSearchParams(h);
    const session = {
      access_token: params.get("access_token"),
      refresh_token: params.get("refresh_token"),
      expires_in: parseInt(params.get("expires_in") || "3600", 10),
      expires_at: Math.floor(Date.now() / 1000) + parseInt(params.get("expires_in") || "3600", 10),
      token_type: params.get("token_type") || "bearer"
    };
    setSession(session);
    // Limpiamos la URL para no dejar tokens en el address bar.
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  }

  async function getUsuarioActual() {
    const s = getSession();
    if (!s) return null;
    try {
      const r = await fetch(AUTH + "/user", { headers: headers() });
      if (!r.ok) { setSession(null); return null; }
      return r.json();
    } catch (e) { return null; }
  }

  function cerrarSesion() {
    setSession(null);
  }

  // ============ DATA HELPERS ============
  async function listarEntradasGlosario() {
    // Sólo publicadas (RLS lo asegura para anon también)
    return rest("/glosario_entradas?estado=eq.publicado&order=anio.asc,disco.asc,termino.asc&select=*");
  }

  async function obtenerEntradaGlosario(id) {
    const r = await rest("/glosario_entradas?id=eq." + encodeURIComponent(id) + "&select=*");
    return r && r.length ? r[0] : null;
  }

  async function proponerEntrada(payload) {
    // payload: { id, termino, tipo, cancion, disco, anio, banda, posicion, verso, que_es, fuentes }
    const u = await getUsuarioActual();
    if (!u) throw new Error("Tenés que iniciar sesión para proponer una entrada.");
    const data = Object.assign({}, payload, {
      estado: "propuesto",
      confianza: "media",
      creado_por: u.id
    });
    return rest("/glosario_entradas", { method: "POST", body: JSON.stringify(data), extraHeaders: { "Prefer": "return=representation" } });
  }

  async function listarEspacios(tipo) {
    let q = "/espacios?order=tipo.asc,nombre.asc&select=*";
    if (tipo) q = "/espacios?tipo=eq." + tipo + "&order=nombre.asc&select=*";
    return rest(q);
  }

  async function obtenerEspacio(slug) {
    const r = await rest("/espacios?slug=eq." + encodeURIComponent(slug) + "&select=*");
    return r && r.length ? r[0] : null;
  }

  async function listarPostsDeEspacio(espacio_id) {
    return rest("/posts?espacio_id=eq." + espacio_id + "&order=created_at.desc&select=*,autor:usuarios(id,nombre_display,pais,ciudad,avatar_url)");
  }

  async function crearPost(payload) {
    const u = await getUsuarioActual();
    if (!u) throw new Error("Tenés que iniciar sesión para postear.");
    const data = Object.assign({}, payload, { autor_id: u.id });
    return rest("/posts", { method: "POST", body: JSON.stringify(data), extraHeaders: { "Prefer": "return=representation" } });
  }

  async function listarComentariosEntrada(entrada_id) {
    return rest("/comentarios?entrada_glosario_id=eq." + encodeURIComponent(entrada_id) + "&order=created_at.asc&select=*,autor:usuarios(id,nombre_display,avatar_url)");
  }

  async function comentarEntrada(entrada_id, texto) {
    const u = await getUsuarioActual();
    if (!u) throw new Error("Tenés que iniciar sesión para comentar.");
    return rest("/comentarios", { method: "POST", body: JSON.stringify({ entrada_glosario_id: entrada_id, autor_id: u.id, texto: texto }), extraHeaders: { "Prefer": "return=representation" } });
  }

  async function listarTributos() {
    return rest("/tributos?estado=eq.aprobado&order=pais.asc,ciudad.asc&select=*");
  }
  async function proponerTributo(payload) {
    const u = await getUsuarioActual();
    if (!u) throw new Error("Tenés que iniciar sesión para proponer un tributo.");
    const data = Object.assign({}, payload, { propuesto_por: u.id });
    return rest("/tributos", { method: "POST", body: JSON.stringify(data), extraHeaders: { "Prefer": "return=representation" } });
  }

  async function listarEventos() {
    const ahora = new Date().toISOString();
    return rest("/eventos?aprobado=eq.true&fecha_inicio=gte." + ahora + "&order=fecha_inicio.asc&select=*");
  }

  async function listarRicoterosEnMapa() {
    return rest("/usuarios?en_mapa_publico=eq.true&pais=not.is.null&select=id,nombre_display,pais,ciudad,avatar_url&order=pais.asc,ciudad.asc");
  }

  async function obtenerPerfilPropio() {
    const u = await getUsuarioActual();
    if (!u) return null;
    const r = await rest("/usuarios?id=eq." + u.id + "&select=*");
    return r && r.length ? r[0] : null;
  }

  async function actualizarPerfil(patch) {
    const u = await getUsuarioActual();
    if (!u) throw new Error("Tenés que iniciar sesión.");
    return rest("/usuarios?id=eq." + u.id, { method: "PATCH", body: JSON.stringify(patch), extraHeaders: { "Prefer": "return=representation" } });
  }

  window.MUH_SUPA = {
    cfg, REST, AUTH,
    getSession, getUsuarioActual, cerrarSesion,
    enviarMagicLink, procesarRedirectHash,
    listarEntradasGlosario, obtenerEntradaGlosario, proponerEntrada,
    listarEspacios, obtenerEspacio,
    listarPostsDeEspacio, crearPost,
    listarComentariosEntrada, comentarEntrada,
    listarTributos, proponerTributo,
    listarEventos, listarRicoterosEnMapa,
    obtenerPerfilPropio, actualizarPerfil
  };

  // Procesar redirect en cada page load (por si volvimos del magic link)
  procesarRedirectHash();
})();
