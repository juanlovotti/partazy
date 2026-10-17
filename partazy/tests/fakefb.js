// Firestore + Auth falsos en memoria, compartidos entre varias "ventanas" (usuarios)
function crearStore(){ return { docs: new Map(), listeners: new Set(), seq: 0 }; }

function makeFirebase(store, getUser, onAuthReady){
  const notify = () => setTimeout(() => store.listeners.forEach(l => l()), 0);
  const deepMerge = (a, b) => {
    const out = { ...(a || {}) };
    for(const [k, v] of Object.entries(b)){
      if(v && typeof v === 'object' && v.__inc !== undefined){ out[k] = (out[k] || 0) + v.__inc; continue; }
      if(v && typeof v === 'object' && v.__del){ delete out[k]; continue; }
      out[k] = (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') ? deepMerge(out[k], v) : v;
    }
    return out;
  };
  const snapDoc = (path) => {
    const d = store.docs.get(path);
    return { id: path.split('/').pop(), exists: !!d, data: () => d && JSON.parse(JSON.stringify(d)),
             ref: { parent: { parent: { id: path.split('/').slice(-3, -2)[0] } } } };
  };
  // Modo estricto (tests de invitado): sin usuario solo se leen eventos y sus fotos
  const libre = path => /^events\/[^/]+$/.test(path) || /^events\/[^/]+\/media\/[^/]+$/.test(path);
  const chk = (path, escribe) => { if(store.estricto && !getUser() && (escribe || !libre(path))){ store.denegados = (store.denegados || []).concat(path); const e = new Error('Missing or insufficient permissions. ' + path); e.code = 'permission-denied'; throw e; } };
  function docRef(path){
    return {
      path, id: path.split('/').pop(),
      collection: n => colRef(path + '/' + n),
      get: async () => { chk(path); return snapDoc(path); },
      set: async (v, opt) => { chk(path, true); store.docs.set(path, opt?.merge ? deepMerge(store.docs.get(path), v) : JSON.parse(JSON.stringify(v))); notify(); },
      update: async v => { chk(path, true); if(!store.docs.has(path)) throw new Error('no existe ' + path); store.docs.set(path, deepMerge(store.docs.get(path), v)); notify(); },
      delete: async () => { chk(path, true); store.docs.delete(path); notify(); }
    };
  }
  function query(prefix, group, ops){
    const run = () => {
      let rows = [...store.docs.keys()].filter(k => {
        const parts = k.split('/');
        if(group) return parts[parts.length - 2] === prefix;
        return k.startsWith(prefix + '/') && parts.length === prefix.split('/').length + 1;
      }).map(snapDoc);
      for(const o of ops){
        if(o.t === 'where'){
          rows = rows.filter(r => { const v = r.data()[o.f];
            if(o.op === '==') return v === o.v;
            if(o.op === '>=') return v >= o.v;
            if(o.op === 'array-contains') return Array.isArray(v) && v.includes(o.v);
            return true; });
        }
        if(o.t === 'orderBy') rows = rows.filter(r => r.data()[o.f] !== undefined).sort((a, b) => (a.data()[o.f] > b.data()[o.f] ? 1 : -1) * (o.dir === 'desc' ? -1 : 1));
        if(o.t === 'startAt') rows = rows.filter(r => r.data()[ops.find(x => x.t === 'orderBy').f] >= o.v);
        if(o.t === 'endAt') rows = rows.filter(r => r.data()[ops.find(x => x.t === 'orderBy').f] <= o.v);
        if(o.t === 'limit') rows = rows.slice(0, o.n);
        if(o.t === 'limitToLast') rows = rows.slice(-o.n);
      }
      return { docs: rows };
    };
    const q = {
      where: (f, op, v) => query(prefix, group, [...ops, { t: 'where', f, op, v }]),
      orderBy: (f, dir) => query(prefix, group, [...ops, { t: 'orderBy', f, dir }]),
      startAt: v => query(prefix, group, [...ops, { t: 'startAt', v }]),
      endAt: v => query(prefix, group, [...ops, { t: 'endAt', v }]),
      limit: n => query(prefix, group, [...ops, { t: 'limit', n }]),
      limitToLast: n => query(prefix, group, [...ops, { t: 'limitToLast', n }]),
      get: async () => { chk(group ? '**/' + prefix + '/x' : prefix + '/x'); return run(); },
      onSnapshot: (fn, onErr) => { try{ chk(group ? '**/' + prefix + '/x' : prefix + '/x'); } catch(e){ setTimeout(() => onErr && onErr(e), 0); return () => {}; } const l = () => fn(run()); store.listeners.add(l); setTimeout(l, 0); return () => store.listeners.delete(l); }
    };
    return q;
  }
  function colRef(path){
    return Object.assign(query(path, false, []), { doc: id => docRef(path + '/' + (id || 'auto' + (++store.seq))), add: async v => { const r = docRef(path + '/auto' + (++store.seq)); await r.set(v); return r; } });
  }
  const db = {
    settings(){},
    collection: n => colRef(n),
    collectionGroup: n => query(n, true, []),
    batch(){ const ops = []; return { set: (r, v, o) => ops.push(() => r.set(v, o)), update: (r, v) => ops.push(() => r.update(v)), delete: r => ops.push(() => r.delete()), commit: async () => { for(const op of ops) await op(); } }; },
    runTransaction: async fn => fn({ get: r => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v), delete: r => r.delete() })
  };
  let cb;
  const authObj = {
    onAuthStateChanged(f){ cb = f; setTimeout(() => f(getUser()), 0); },
    getRedirectResult: async () => null,
    signOut: async () => {},
    get currentUser(){ return getUser(); }
  };
  onAuthReady && onAuthReady(u => cb(u));
  return {
    initializeApp(){},
    auth: Object.assign(() => authObj, { GoogleAuthProvider: function(){ this.setCustomParameters = () => {}; } }),
    firestore: Object.assign(() => db, { FieldValue: { increment: n => ({ __inc: n }), delete: () => ({ __del: true }) } })
  };
}
module.exports = { crearStore, makeFirebase };
