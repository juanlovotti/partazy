// =========================================================
//  PARTAZY · js/app.js — toda la lógica de la app
//  - Script clásico (no módulo): las funciones quedan globales porque index.html
//    las llama con onclick="...".
//  - Está dividido en secciones con títulos "// ===== NOMBRE =====". El mapa
//    completo está en docs/ARQUITECTURA.md.
//  - Reglas de oro: a Firestore solo se accede por DataService; todo texto de
//    usuarios pasa por esc() antes de ir a innerHTML; la seguridad real está
//    en firestore.rules.
//  - Cada función tiene arriba un comentario corto que dice qué hace.
// =========================================================
/* =========================================================
   PARTAZY · Firebase Edition
   ---------------------------------------------------------
   Firestore:
     users/{uid}                        perfil público (nombre, ciudad, intereses, foto)
     events/{eventId}                   info pública del evento
     events/{eventId}/private/data      dirección exacta (creador + aprobados)
     events/{eventId}/attendees/{uid}   estado: solicitado | aprobado | rechazado | confirmado | en-espera
     chats/{eventId}/messages/{msgId}   chat del grupo (creador + aprobados/confirmados)
     users/{uid}/privado/datos          fecha de nacimiento y email (solo el dueño)
   Los permisos reales se aplican en firestore.rules (archivo aparte).
   Toda la app habla con DataService; nunca con firebase.firestore() directo.
   ========================================================= */

// Config del proyecto Firebase "partazy-5555d" (Configuración del proyecto → Tus apps → Web)
// No es secreta: la seguridad la dan las reglas de firestore.rules.
const firebaseConfig = {
  apiKey:            "AIzaSyBPp2zWegA2Zb7zk69Y0s49WDkjhkUAheY",
  authDomain:        "partazy-5555d.firebaseapp.com",
  projectId:         "partazy-5555d",
  storageBucket:     "partazy-5555d.firebasestorage.app",
  messagingSenderId: "368869218217",
  appId:             "1:368869218217:web:28644477f4c2395ce996b8"
};

// Si el entorno bloquea las librerías de Firebase, la app muestra un aviso en vez de romperse.
const APP_CHECK_CLAVE = '6LeoQfEtAAAAADoqMsmN55Yb2GUSTvCktkil5TCi';
const FIREBASE_OK = typeof firebase !== 'undefined';
let auth = null, db = null;
if(FIREBASE_OK){
  firebase.initializeApp(firebaseConfig);
  // App Check: frena bots y scripts que quieran usar la base sin pasar por la app.
  // Usa Google Fraud Defense (ex reCAPTCHA Enterprise). Vacía = desactivado. Ver docs/ARQUITECTURA.md.
  try{ if(APP_CHECK_CLAVE && firebase.appCheck) firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(APP_CHECK_CLAVE), true); } catch(e){ console.warn('App Check', e); }
  auth = firebase.auth();
  // La sesión queda guardada en el dispositivo: se inicia sesión una sola vez (hasta "Cerrar sesión")
  try{ if(auth.setPersistence && firebase.auth.Auth?.Persistence) auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {}); } catch(e){}
  db   = firebase.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  // Guarda una copia de los datos en el dispositivo: la próxima vez la app abre al instante con lo último
  // que vio y después se actualiza sola. Si el navegador no lo permite (modo incógnito, etc.), sigue normal.
  try{ if(db.enablePersistence) db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch(e){}
}

const HORA = 3600 * 1000;
// Cuántos eventos trae la app al abrir (después se pueden cargar más). Menos = abre más rápido.
const LIMITE_INICIAL = 50;

// =========================================================
//  DataService — única puerta a Firestore
// =========================================================
const DataService = {
  // Referencia a un evento.
  _ev(id){ return db.collection('events').doc(id); },
  // Lee la calificación que esta persona le dio al evento (o null si todavía no calificó).
  async getCalificacion(id, uid){
    const snap = await this._ev(id).collection('calificaciones').doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  // Una calificación por persona: se guarda junto con los totales del evento (y de la organización)
  async calificar(ev, uid, joda, anfitrion, esOrg){
    const inc = n => firebase.firestore.FieldValue.increment(n);
    const b = db.batch();
    b.set(this._ev(ev.id).collection('calificaciones').doc(uid), { uid, joda, anfitrion, ts: Date.now() });
    b.update(this._ev(ev.id), { califN: inc(1), califJoda: inc(joda), califAnf: inc(anfitrion) });
    if(esOrg) b.update(db.collection('users').doc(ev.creador), { califN: inc(1), califSuma: inc(anfitrion), califUlt: ev.id });
    await b.commit();
  },
  // Referencia a la asistencia de una persona en un evento.
  _at(eventId, uid){ return this._ev(eventId).collection('attendees').doc(uid); },

  // ---------- EVENTOS ----------
  // Solo eventos vigentes (empezados hace menos de 6 h o futuros): los pasados ya no tapan a los nuevos.
  // Eventos en vivo: la primera respuesta es la carga inicial; después llegan los cambios (nuevos, editados, borrados)
  escucharEventos(onData, onErr){
    return db.collection('events')
      .where('fechaTs', '>=', Date.now() - 6 * HORA)
      .orderBy('fechaTs', 'asc').limit(state.limiteEventos || LIMITE_INICIAL)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onErr);
  },
  // Carga una sola vez los próximos 100 eventos (se usa si falla la escucha en vivo).
  async listEventos(){
    const snap = await db.collection('events')
      .where('fechaTs', '>=', Date.now() - 6 * HORA)
      .orderBy('fechaTs', 'asc').limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  // Lee los nombres de la lista VIP (solo quien organiza).
  async getVip(id){
    const snap = await this._ev(id).collection('vip').doc('lista').get();
    return snap.exists ? (snap.data().nombres || []) : [];
  },
  // Guarda los nombres de la lista VIP.
  async guardarVip(id, nombres){
    await this._ev(id).collection('vip').doc('lista').set({ nombres, ts: Date.now() });
  },
  // Trae la foto grande del evento (la tarjeta usa una miniatura guardada en el evento).
  async getFotoGrande(id){
    const snap = await this._ev(id).collection('media').doc('foto').get();
    return snap.exists ? snap.data().imagen : null;
  },
  // Pasa la foto grande a media/foto y deja una miniatura en el evento (eventos viejos).
  async separarFoto(id, grande, mini){
    const batch = db.batch();
    batch.set(this._ev(id).collection('media').doc('foto'), { imagen: grande, ts: Date.now() });
    batch.update(this._ev(id), { imagen: mini, fotoGrande: true });
    await batch.commit();
  },
  // Lee un evento por su id (o null si no existe).
  async getEvento(id){
    const snap = await this._ev(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },
  // Crea evento + dirección privada + asistencia del creador en una sola escritura atómica.
  async crearEvento(id, data, direccionExacta, fotoGrande, asistenciaCreador){
    const batch = db.batch();
    const ref = this._ev(id);
    batch.set(ref, data);
    if(fotoGrande) batch.set(ref.collection('media').doc('foto'), { imagen: fotoGrande, ts: Date.now() });
    if(direccionExacta) batch.set(ref.collection('private').doc('data'), { direccion: direccionExacta, updatedAt: Date.now() });
    if(state.vipPendiente) batch.set(ref.collection('vip').doc('lista'), { nombres: state.vipPendiente, ts: Date.now() });
    batch.set(this._at(id, asistenciaCreador.uid), asistenciaCreador);
    await batch.commit();
  },

  // Edita un evento propio (y su dirección privada); si cambia algo clave, avisa en el grupo
  async editarEvento(id, cambios, direccionExacta, mensaje, fotoGrande){
    const batch = db.batch();
    const ref = this._ev(id);
    batch.update(ref, cambios);
    if(fotoGrande) batch.set(ref.collection('media').doc('foto'), { imagen: fotoGrande, ts: Date.now() });
    if(direccionExacta) batch.set(ref.collection('private').doc('data'), { direccion: direccionExacta, updatedAt: Date.now() });
    if(mensaje) batch.set(db.collection('chats').doc(id).collection('messages').doc(), mensaje);
    await batch.commit();
  },

  // Cancela el evento y deja el aviso en el grupo del evento
  async cancelarEvento(id, motivo, mensaje){
    const batch = db.batch();
    batch.update(this._ev(id), { estado: 'cancelado', motivoCancelacion: motivo || '', canceladoTs: Date.now() });
    batch.set(db.collection('chats').doc(id).collection('messages').doc(), mensaje);
    await batch.commit();
  },
  // Borra el evento, su dirección privada y la asistencia del creador
  async eliminarEvento(id, uid){
    const ref = this._ev(id);
    const batch = db.batch();
    batch.delete(ref.collection('media').doc('foto'));
    batch.delete(ref.collection('vip').doc('lista'));
    batch.delete(ref.collection('private').doc('data'));
    batch.delete(ref.collection('attendees').doc(uid));
    batch.delete(ref);
    await batch.commit();
  },

  // ---------- ASISTENCIA ----------
  async getAsistencia(eventId, uid){
    const snap = await this._at(eventId, uid).get();
    return snap.exists ? snap.data() : null;
  },
  // Todas las asistencias de una persona, en todos los eventos ("Mis entradas").
  async listAsistenciasDe(uid){
    const snap = await db.collectionGroup('attendees').where('uid', '==', uid).get();
    return snap.docs.map(d => ({ eventId: d.ref.parent.parent.id, ...d.data() }));
  },
  // Solicitud a previa privada o lista de espera (solo creación; las reglas impiden autoaprobarse).
  async crearAsistencia(eventId, datos){
    await this._at(eventId, datos.uid).set(datos);
  },
  // Confirmación a evento público: transacción que evita doble conteo y sobreventa.
  async confirmarPublico(eventId, datos){
    const evRef = this._ev(eventId), atRef = this._at(eventId, datos.uid);
    return db.runTransaction(async tx => {
      const evS = await tx.get(evRef);
      const atS = await tx.get(atRef);
      if(!evS.exists) throw new Error('INEXISTENTE');
      if(atS.exists) return atS.data();
      const ev = evS.data(), n = ev.confirmadosCount || 0;
      if(n >= ev.capacidad) throw new Error('LLENO');
      tx.set(atRef, datos);
      tx.update(evRef, { confirmadosCount: n + 1 });
      return datos;
    });
  },
  // Darse de baja: libera el lugar (con el -1 en la misma transacción) o retira la solicitud / lista de espera
  async salirDeEvento(eventId, uid, estado){
    const evRef = this._ev(eventId), atRef = this._at(eventId, uid);
    if(estado === 'confirmado' || estado === 'aprobado'){
      return db.runTransaction(async tx => {
        const evS = await tx.get(evRef);
        if(!evS.exists) throw new Error('INEXISTENTE');
        tx.delete(atRef);
        tx.update(evRef, { confirmadosCount: (evS.data().confirmadosCount || 1) - 1 });
      });
    }
    await atRef.delete();
  },
  // Pedidos pendientes para entrar a una previa privada, del más viejo al más nuevo.
  async listSolicitudes(eventId){
    const snap = await this._ev(eventId).collection('attendees').where('estado', '==', 'solicitado').get();
    return snap.docs.map(d => d.data()).sort((a,b) => a.ts - b.ts);
  },
  // Aprueba (con +1 al cupo y entrada) o rechaza un pedido, en una transacción.
  async responderSolicitud(eventId, attUid, aprobar, ticket){
    const evRef = this._ev(eventId), atRef = this._at(eventId, attUid);
    return db.runTransaction(async tx => {
      const evS = await tx.get(evRef);
      const atS = await tx.get(atRef);
      if(!atS.exists || atS.data().estado !== 'solicitado') throw new Error('YA_RESPONDIDA');
      if(!aprobar){
        tx.update(atRef, { estado: 'rechazado', respondidoTs: Date.now() });
        return;
      }
      const ev = evS.data(), n = ev.confirmadosCount || 0;
      if(n >= ev.capacidad) throw new Error('LLENO');
      tx.update(atRef, { estado: 'aprobado', ticket, respondidoTs: Date.now() });
      tx.update(evRef, { confirmadosCount: n + 1 });
    });
  },

  // ---------- RED DE AMIGOS (planes visibles solo para amigos) ----------
  async getPlanes(uid){
    const snap = await db.collection('planes').doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  // Guarda a qué eventos voy y qué compartí (lo leen mis amigos).
  async guardarPlanes(uid, data){
    await db.collection('planes').doc(uid).set(data);
  },
  // ---------- COMPARTIR (repost) ----------
  async yaCompartido(eventId, uid){
    const snap = await this._ev(eventId).collection('reposts').doc(uid).get();
    return snap.exists;
  },
  // Compartir con mis amigos (repost): registro + contador en la misma escritura.
  async compartirEvento(eventId, uid, nombre){
    const batch = db.batch();
    batch.set(this._ev(eventId).collection('reposts').doc(uid), { ts: Date.now(), nombre: String(nombre || '').slice(0, 60) });
    batch.update(this._ev(eventId), { repostsCount: firebase.firestore.FieldValue.increment(1) });
    await batch.commit();
  },
  // Deshace el compartido: borra el registro y resta 1 al contador.
  async dejarDeCompartir(eventId, uid){
    const batch = db.batch();
    batch.delete(this._ev(eventId).collection('reposts').doc(uid));
    batch.update(this._ev(eventId), { repostsCount: firebase.firestore.FieldValue.increment(-1) });
    await batch.commit();
  },

  // ---------- VISTAS (para las estadísticas de quien organiza) ----------
  // Cada persona cuenta una sola vez por evento: registro + contador en la misma escritura.
  async registrarVista(eventId, uid){
    const ref = this._ev(eventId).collection('vistas').doc(uid);
    if((await ref.get()).exists) return false;
    const b = db.batch();
    b.set(ref, { ts: Date.now() });
    b.update(this._ev(eventId), { vistasCount: firebase.firestore.FieldValue.increment(1) });
    await b.commit();
    return true;
  },
  // Amigos de una persona (amistades aceptadas). Las ve cualquiera con cuenta.
  async amigosDe(uid){
    const snap = await db.collection('friendships').where('users', 'array-contains', uid).where('estado', '==', 'aceptada').limit(500).get();
    return snap.docs.map(d => (d.data().users || []).find(x => x !== uid)).filter(Boolean);
  },

  // ---------- VOTOS DE AMBIENTE (en vivo) ----------
  async listVotos(eventId){
    const snap = await this._ev(eventId).collection('votos').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  // Voto de cómo está el evento en vivo (tranqui / bueno / explotado).
  async votarAmbiente(eventId, uid, voto){
    await this._ev(eventId).collection('votos').doc(uid).set({ voto, ts: Date.now() });
  },

  // ---------- DIRECCIÓN PROTEGIDA ----------
  async getDireccionExacta(eventId){
    try{
      const snap = await this._ev(eventId).collection('private').doc('data').get();
      return snap.exists ? snap.data().direccion : null;
    } catch(e){ return null; }
  },

  // ---------- PERFIL ----------
  async getPerfil(uid){
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  },
  // Guarda cambios del perfil público (solo los campos que se pasan).
  async savePerfil(uid, data){
    await db.collection('users').doc(uid).set(data, { merge: true });
  },
  // Primer registro: perfil público + datos privados + reserva del @usuario, en una sola escritura.
  async crearPerfil(uid, publico, privado){
    const ref = db.collection('users').doc(uid);
    const batch = db.batch();
    batch.set(ref.collection('privado').doc('datos'), privado);
    batch.set(ref, publico);
    if(publico.usuario) batch.set(db.collection('usernames').doc(publico.usuario), { uid, ts: Date.now() });
    await batch.commit();
  },
  // Actualiza el perfil; si cambió el @usuario, reserva el nuevo y libera el viejo
  async actualizarPerfil(uid, cambios, usuarioViejo){
    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), cambios, { merge: true });
    if(cambios.usuario && cambios.usuario !== usuarioViejo){
      batch.set(db.collection('usernames').doc(cambios.usuario), { uid, ts: Date.now() });
      if(usuarioViejo) batch.delete(db.collection('usernames').doc(usuarioViejo));
    }
    await batch.commit();
  },
  // ¿Este @usuario está libre (o ya es mío)?
  async usuarioDisponible(handle, uid){
    const snap = await db.collection('usernames').doc(handle).get();
    return !snap.exists || snap.data().uid === uid;
  },
  // Busca el uid dueño de un @usuario.
  async uidDeUsuario(handle){
    const snap = await db.collection('usernames').doc(handle).get();
    return snap.exists ? snap.data().uid : null;
  },
  // Lee mis datos privados (fecha de nacimiento y email).
  async getPrivado(uid){
    const snap = await db.collection('users').doc(uid).collection('privado').doc('datos').get();
    return snap.exists ? snap.data() : null;
  },

  // ---------- SEGUIDORES DE ORGANIZACIONES ----------
  // seguidores/{org}/fans/{uid}; el perfil de la organización lleva el contador "seguidores"
  async siguiendo(org, uid){
    try{ return (await db.collection('seguidores').doc(org).collection('fans').doc(uid).get()).exists; } catch(e){ return false; }
  },
  // Seguir a una organización: registro de fan + 1 al contador.
  async seguir(org, uid){
    const b = db.batch();
    b.set(db.collection('seguidores').doc(org).collection('fans').doc(uid), { uid, ts: Date.now() });
    b.update(db.collection('users').doc(org), { seguidores: firebase.firestore.FieldValue.increment(1) });
    await b.commit();
  },
  // Dejar de seguir: borra el registro y resta 1.
  async dejarDeSeguir(org, uid){
    const b = db.batch();
    b.delete(db.collection('seguidores').doc(org).collection('fans').doc(uid));
    b.update(db.collection('users').doc(org), { seguidores: firebase.firestore.FieldValue.increment(-1) });
    await b.commit();
  },
  // Seguidores de una organización (para avisarles de fechas nuevas).
  async listarFans(org){
    const snap = await db.collection('seguidores').doc(org).collection('fans').get();
    return snap.docs.map(d => d.id);
  },

  // ---------- CONTROL DE PUERTA ----------
  // Transacción: si dos personas escanean el mismo código a la vez, solo una lo valida
  async registrarIngreso(eventId, uid){
    const ref = this._at(eventId, uid);
    return db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if(!snap.exists) throw new Error('NO_EXISTE');
      if(snap.data().checkinTs) throw new Error('YA_INGRESO');
      const ts = Date.now();
      tx.update(ref, { checkinTs: ts });
      return ts;
    });
  },

  // ---------- ACREDITACIONES DE PRENSA ----------
  async getAcreditacion(eventId, uid){
    try{
      const snap = await this._ev(eventId).collection('acreditaciones').doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch(e){ return null; }
  },
  // Pedido de acreditación de prensa para un evento.
  async pedirAcreditacion(eventId, uid, datos){
    await this._ev(eventId).collection('acreditaciones').doc(uid).set({ ...datos, uid, estado: 'pendiente', ts: Date.now() });
  },
  // Pedidos de prensa de un evento (solo quien organiza).
  async listarAcreditaciones(eventId){
    const snap = await this._ev(eventId).collection('acreditaciones').get();
    return snap.docs.map(d => d.data());
  },
  // Aprueba o rechaza un pedido de prensa.
  async responderAcreditacion(eventId, uid, aprobar){
    await this._ev(eventId).collection('acreditaciones').doc(uid).update({ estado: aprobar ? 'aprobada' : 'rechazada', respondidoTs: Date.now() });
  },

  // ---------- ELIMINAR CUENTA ----------
  async eliminarDatosDeCuenta(uid, usuario, amistades, bloqueados, eventosPropios){
    const ops = [];
    const notifs = await db.collection('notificaciones').doc(uid).collection('items').limit(400).get();
    notifs.docs.forEach(d => ops.push(b => b.delete(db.collection('notificaciones').doc(uid).collection('items').doc(d.id))));
    amistades.forEach(id => ops.push(b => b.delete(db.collection('friendships').doc(id))));
    bloqueados.forEach(a => ops.push(b => b.delete(db.collection('bloqueos').doc(`${uid}_${a}`))));
    eventosPropios.forEach(id => {
      ops.push(b => b.delete(this._ev(id).collection('private').doc('data')));
      ops.push(b => b.delete(this._ev(id).collection('media').doc('foto')));
      ops.push(b => b.delete(this._at(id, uid)));
      ops.push(b => b.delete(this._ev(id)));
    });
    ops.push(b => b.delete(db.collection('verificaciones').doc(uid)));
    ops.push(b => b.delete(db.collection('planes').doc(uid)));
    for(let i = 0; i < ops.length; i += 400){
      const b = db.batch();
      ops.slice(i, i + 400).forEach(f => f(b));
      await b.commit();
    }
    // Al final, juntos: perfil, datos privados y @usuario
    const b = db.batch();
    b.delete(db.collection('users').doc(uid).collection('privado').doc('datos'));
    if(usuario) b.delete(db.collection('usernames').doc(usuario));
    b.delete(db.collection('users').doc(uid));
    await b.commit();
  },

  // ---------- NOTIFICACIONES ----------
  async crearNotificacion(dest, datos){
    await db.collection('notificaciones').doc(dest).collection('items').add(datos);
  },
  // Escucha en vivo mis últimas 50 notificaciones.
  escucharNotificaciones(uid, onData, onError){
    return db.collection('notificaciones').doc(uid).collection('items')
      .orderBy('ts', 'desc').limit(50)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Marca notificaciones como leídas (en tandas).
  async marcarNotificacionesLeidas(uid, ids){
    const batch = db.batch();
    ids.slice(0, 400).forEach(id => batch.update(db.collection('notificaciones').doc(uid).collection('items').doc(id), { leida: true }));
    await batch.commit();
  },
  // Asistentes de un evento (solo lo puede leer quien lo organiza)
  async listarAsistentes(eventId){
    const snap = await this._ev(eventId).collection('attendees').get();
    return snap.docs.map(d => d.data());
  },

  // Todos los eventos creados por una persona (para la limpieza de viejos).
  async eventosDe(uid){
    const snap = await db.collection('events').where('creador', '==', uid).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  // Guarda una consulta del formulario de contacto (cualquiera puede mandar; solo admins las leen).
  async enviarConsulta(datos){
    await db.collection('consultas').add(datos);
  },
  // Admins: consultas recibidas, las más nuevas primero.
  async listarConsultas(){
    const snap = await db.collection('consultas').orderBy('ts', 'desc').limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  // Admins: borra una consulta ya respondida.
  async borrarConsulta(id){ await db.collection('consultas').doc(id).delete(); },
  // ---------- VERIFICACIÓN DE ORGANIZACIONES ----------
  async getVerificacion(uid){
    try{
      const snap = await db.collection('verificaciones').doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch(e){ return null; }
  },
  // Pedido de insignia ✓ de una organización.
  async pedirVerificacion(uid, datos){
    await db.collection('verificaciones').doc(uid).set({ ...datos, uid, estado: 'pendiente', ts: Date.now() });
  },
  // Admins: escucha los pedidos de verificación pendientes.
  escucharVerificacionesPendientes(onData, onError){
    return db.collection('verificaciones').where('estado', '==', 'pendiente')
      .onSnapshot(snap => onData(snap.docs.map(d => d.data())), onError);
  },
  // Aprobar marca la cuenta y todos sus eventos como verificados
  async resolverVerificacion(uid, aprobar, motivo, adminUid){
    const batch = db.batch();
    batch.update(db.collection('verificaciones').doc(uid), {
      estado: aprobar ? 'aprobada' : 'rechazada', motivoRechazo: aprobar ? '' : (motivo || ''),
      revisadoPor: adminUid, revisadoTs: Date.now()
    });
    if(aprobar){
      batch.update(db.collection('users').doc(uid), { verificado: true });
      const evs = await db.collection('events').where('creador', '==', uid).get();
      evs.docs.slice(0, 450).forEach(d => batch.update(this._ev(d.id), { verificado: true }));
    }
    await batch.commit();
  },

  // ---------- DENUNCIAS ----------
  // reports/{tipo_objeto_reportante}: una denuncia por persona y contenido.
  // Eventos y perfiles llevan un contador "denuncias" (se ocultan al llegar a 3).
  async denunciar(datos, uid){
    const batch = db.batch();
    batch.set(db.collection('reports').doc(`${datos.tipo}_${datos.objetoId}_${uid}`),
      { ...datos, reportante: uid, estado: 'pendiente', ts: Date.now() });
    const inc = firebase.firestore.FieldValue.increment(1);
    if(datos.tipo === 'evento') batch.update(this._ev(datos.objetoId), { denuncias: inc });
    if(datos.tipo === 'usuario') batch.update(db.collection('users').doc(datos.objetoId), { denuncias: inc });
    await batch.commit();
  },

  // ---------- BLOQUEOS ----------
  escucharBloqueos(uid, onData, onError){
    return db.collection('bloqueos').where('de', '==', uid)
      .onSnapshot(snap => onData(snap.docs.map(d => d.data().a)), onError);
  },
  // Bloquea a alguien y borra la amistad si había.
  async bloquear(de, a, amistadId){
    const batch = db.batch();
    batch.set(db.collection('bloqueos').doc(`${de}_${a}`), { de, a, ts: Date.now() });
    if(amistadId) batch.delete(db.collection('friendships').doc(amistadId));
    await batch.commit();
  },
  // Quita un bloqueo.
  async desbloquear(de, a){
    await db.collection('bloqueos').doc(`${de}_${a}`).delete();
  },

  // ---------- MODERACIÓN (solo admins: admins/{uid} creado a mano en la consola) ----------
  async esAdmin(uid){
    try{ return (await db.collection('admins').doc(uid).get()).exists; } catch(e){ return false; }
  },
  // Admins: escucha las denuncias pendientes.
  escucharReportes(onData, onError){
    return db.collection('reports').where('estado', '==', 'pendiente')
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Admins: marca denuncias como resueltas (en tandas de 400).
  async resolverReportes(ids, accion, adminUid){
    for(let i = 0; i < ids.length; i += 400){
      const batch = db.batch();
      ids.slice(i, i + 400).forEach(id => batch.update(db.collection('reports').doc(id),
        { estado: 'resuelto', accion, resueltoPor: adminUid, resueltoTs: Date.now() }));
      await batch.commit();
    }
  },
  // Admins: cambia campos de moderación de un evento.
  async adminActualizarEvento(id, cambios){ await this._ev(id).update(cambios); },
  // Admins: borra la foto grande de un evento.
  async borrarFotoGrande(id){ await this._ev(id).collection('media').doc('foto').delete(); },
  // Admins: cambia campos de moderación de una persona.
  async adminActualizarUsuario(uid, cambios){ await db.collection('users').doc(uid).update(cambios); },
  // Admins: borra un evento denunciado.
  async adminEliminarEvento(id){
    const batch = db.batch();
    batch.delete(this._ev(id).collection('media').doc('foto'));
    batch.delete(this._ev(id).collection('vip').doc('lista'));
    batch.delete(this._ev(id).collection('private').doc('data'));
    batch.delete(this._ev(id));
    await batch.commit();
  },

  // ---------- AMIGOS ----------
  // friendships/{uidA_uidB} (uids ordenados): { users, de, para, estado: 'pendiente' | 'aceptada', ts }
  escucharAmistades(uid, onData, onError){
    return db.collection('friendships').where('users', 'array-contains', uid)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Manda solicitud de amistad (el id del par va ordenado: a_b).
  async pedirAmistad(de, para){
    const users = [de, para].sort();
    await db.collection('friendships').doc(users.join('_')).set({ users, de, para, estado: 'pendiente', ts: Date.now() });
  },
  // Acepta una solicitud de amistad recibida.
  async aceptarAmistad(pid){
    await db.collection('friendships').doc(pid).update({ estado: 'aceptada', aceptadaTs: Date.now() });
  },
  // Cancela, rechaza o elimina una amistad.
  async borrarAmistad(pid){
    await db.collection('friendships').doc(pid).delete();
  },
  // Busca por comienzo del nombre completo ("juan lo...") o por una palabra exacta ("lovotti")
  async personasDeCiudad(ciudad){
    const snap = await db.collection('users').where('ciudad', '==', ciudad).limit(25).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  // Algunas organizaciones para sugerir a quién seguir.
  async organizaciones(){
    const snap = await db.collection('users').where('tipoCuenta', '==', 'organizacion').limit(25).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },
  // Busca gente por nombre, palabra o @usuario (3 consultas juntas).
  async buscarPersonas(q){
    const col = db.collection('users');
    const h = q.replace(/^@+/, '').replace(/\s+/g, '');
    const [porNombre, porPalabra, porUsuario] = await Promise.all([
      col.orderBy('nombreBusqueda').startAt(q).endAt(q + '').limit(20).get(),
      col.where('palabras', 'array-contains', q.replace(/^@+/, '').split(' ')[0]).limit(20).get(),
      h ? col.orderBy('usuario').startAt(h).endAt(h + '').limit(10).get() : Promise.resolve({ docs: [] })
    ]);
    const vistos = new Map();
    [...porUsuario.docs, ...porNombre.docs, ...porPalabra.docs].forEach(d => vistos.set(d.id, { uid: d.id, ...d.data() }));
    return [...vistos.values()];
  },

  // ---------- MENSAJES DIRECTOS ----------
  // dms/{uidA_uidB}: { miembros, ultimoMsg, ultimoTs, ultimoDe, vistoPor: { uid: ts } }
  // dms/{uidA_uidB}/mensajes/{id}: { de, tipo: 'texto' | 'evento', texto, ts, evento... }
  escucharDMs(uid, onData, onError){
    return db.collection('dms').where('miembros', 'array-contains', uid)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Escucha en vivo los últimos 150 mensajes de un chat privado.
  escucharMensajesDM(pid, onData, onError){
    return db.collection('dms').doc(pid).collection('mensajes')
      .orderBy('ts', 'asc').limitToLast(150)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Manda un mensaje privado y actualiza la vista previa del chat.
  async enviarDM(pid, miembros, uid, msg, preview, extra){
    const ref = db.collection('dms').doc(pid);
    const batch = db.batch();
    batch.set(ref, { miembros, ultimoMsg: preview, ultimoTs: msg.ts, ultimoDe: uid, vistoPor: { [uid]: msg.ts }, ...(extra || {}) }, { merge: true });
    batch.set(ref.collection('mensajes').doc(), msg);
    await batch.commit();
  },
  // Acepta o rechaza una solicitud de mensaje de alguien que no es amigo.
  async responderSolicitudDM(pid, miembros, uid, aceptar){
    await db.collection('dms').doc(pid).set({ miembros, estado: aceptar ? 'aceptado' : 'rechazado', vistoPor: { [uid]: Date.now() } }, { merge: true });
  },
  // Avisa "escribiendo…" al otro (se borra solo a los pocos segundos).
  async marcarEscribiendo(pid, miembros, uid){
    await db.collection('dms').doc(pid).set({ miembros, escribiendo: { [uid]: Date.now() } }, { merge: true });
  },
  // Marca el chat como visto hasta cierto momento (para el "no leído").
  async marcarVisto(pid, miembros, uid, hasta){
    // Nunca antes que el último mensaje (por si el reloj del otro celular está adelantado)
    await db.collection('dms').doc(pid).set({ miembros, vistoPor: { [uid]: Math.max(Date.now(), hasta || 0) } }, { merge: true });
  },

  // ---------- CHAT ----------
  suscribirMensajes(eventId, onData, onError){
    return db.collection('chats').doc(eventId).collection('messages')
      .orderBy('ts', 'asc').limitToLast(120)
      .onSnapshot(snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))), onError);
  },
  // Manda un mensaje al grupo del evento.
  async enviarMensaje(eventId, msg){
    await db.collection('chats').doc(eventId).collection('messages').add(msg);
  },

};
// Para migrar a otro backend: reimplementar estos métodos con las mismas firmas.

// =========================================================
//  ESTADO
// =========================================================
const CBA_CENTER = { lat:-31.4201, lng:-64.1888 };

// Coordenadas aproximadas de barrios (para ubicar eventos sin exponer la dirección)
const BARRIOS = {
  'Centro':[-31.4167,-64.1833], 'Nueva Córdoba':[-31.4280,-64.1870], 'Güemes':[-31.4245,-64.1935],
  'Observatorio':[-31.4225,-64.1985], 'Alberdi':[-31.4095,-64.2010], 'General Paz':[-31.4110,-64.1690],
  'San Vicente':[-31.4255,-64.1600], 'Alta Córdoba':[-31.3890,-64.1795], 'Cofico':[-31.3985,-64.1815],
  'Cerro de las Rosas':[-31.3705,-64.2290], 'Argüello':[-31.3470,-64.2610], 'Ciudad Universitaria':[-31.4390,-64.1910],
  'Barrio Jardín':[-31.4555,-64.1790], 'Villa Allende':[-31.2950,-64.2950]
};

const state = {
  uid: null,
  perfil: null,
  eventos: [],
  userCoords: null,
  filtroActivoHome: 'hoy',
  filtroActivoExplorar: 'todas',
  busqueda: '',
  tipoEventoActivo: 'fiesta',
  imagenNueva: null,
  chatUnsub: null,
  privado: null,        // { nacimiento, email } (solo lo lee el dueño)
  usuarios: {},         // caché de perfiles públicos por uid
  fotoPerfilNueva: null,
  bloqueados: new Set(), // uids que bloqueé
  esAdmin: false,
  reportes: [],
  msgsVistos: {},        // mensajes en pantalla, por id (para poder denunciarlos)
  notificaciones: [],
  notifResaltadas: new Set(),
  verificacion: null,    // mi pedido de verificación (organizaciones)
  verifPendientes: [],   // para admins
  sigo: {},              // organizaciones que sigo (caché)
  amistades: [],        // en tiempo real
  dms: [],              // conversaciones, en tiempo real
  socialUnsubs: [],
  dmActual: null,
  dmUnsub: null,
  usuarioActual: null,
  resultadosPersonas: null,
  busquedaPersonas: '',
  rutaPendiente: location.hash || null,   // link compartido abierto antes de iniciar sesión
  email: '',
  tok: 0,               // invalida renders asíncronos viejos al cambiar de pantalla
  ultimoCreado: null
};

// =========================================================
//  UTILS
// =========================================================
function rid(n = 10){
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => abc[x % 36]).join('');
}
// Id nuevo para un evento (fecha + aleatorio).
function nuevoEventoId(){ return 'ev_' + Date.now().toString(36) + '_' + rid(6); }
// Código de entrada (ej. PT-AB12CD34EF).
function ticketCode(){ return 'PT-' + rid(10).toUpperCase(); }

// Escapa texto para meterlo en HTML sin riesgo (usar SIEMPRE con datos de usuarios).
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Minúsculas y sin tildes, para comparar y buscar.
function normalizar(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Distancia en km entre dos puntos (fórmula de Haversine).
function distanciaKm(lat1,lng1,lat2,lng2){
  const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
// Formatea un precio: "$5.000" o "Gratis".
function money(n){ return n>0 ? '$'+Number(n).toLocaleString('es-AR') : 'Gratis'; }
// Mensaje gris de "no hay nada" para listas vacías.
function emptyState(msg){ return `<div class="empty-state">${esc(msg)}</div>`; }
// Lista vacía con botón para crear un evento.
function emptyCrear(msg){
  return `<div class="empty-cta">${esc(msg)}<br>¿Organizás algo? Sé el primero.<button class="btn btn-primario btn-mini" onclick="ir('crear')">Crear evento</button></div>`;
}

// Cartelito abajo que desaparece solo.
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}
// Pantalla de carga con un texto.
function mostrarLoader(txt){
  const l = document.getElementById('loader');
  l.classList.remove('off'); l.style.display='flex';
  if(txt) document.getElementById('loader-txt').textContent = txt;
}
// Saca la pantalla de carga y muestra la app.
function ocultarLoader(){
  const l = document.getElementById('loader');
  l.classList.add('off');
  setTimeout(()=>{ l.style.display='none'; }, 350);
  document.getElementById('app').style.display='flex';
}
// Ventana de confirmación. Devuelve una promesa: true si acepta, false si cancela.
function confirmar(titulo, texto, okTxt = 'Aceptar'){
  return new Promise(resolve => {
    const bg = document.getElementById('modal-bg');
    const ok = document.getElementById('modal-ok');
    const cancel = document.getElementById('modal-cancelar');
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-texto').textContent = texto;
    document.getElementById('modal-input').style.display = 'none';
    ok.textContent = okTxt;
    bg.classList.add('show');
    ok.focus();
    const done = (val) => {
      bg.classList.remove('show');
      ok.onclick = cancel.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = e => { if(e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    ok.onclick = ()=>done(true);
    cancel.onclick = ()=>done(false);
  });
}

// Cuenta las palabras de un texto.
function contarPalabras(t){ return String(t || '').trim().split(/\s+/).filter(Boolean).length; }
// Igual que confirmar(), pero con un campo de texto. Devuelve el texto, o null si se cancela.
// opciones: { maxPalabras, maxCaracteres, cancelarTxt } → muestra un contador y frena el botón si se pasa.
function pedirTexto(titulo, texto, placeholder, okTxt, opciones = {}){
  return new Promise(resolve => {
    const bg = document.getElementById('modal-bg');
    const ok = document.getElementById('modal-ok');
    const cancel = document.getElementById('modal-cancelar');
    const input = document.getElementById('modal-input');
    const contador = document.getElementById('modal-contador');
    const maxP = opciones.maxPalabras || 0;
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-texto').textContent = texto;
    input.maxLength = opciones.maxCaracteres || 200;
    input.value = opciones.valorInicial || '';
    input.placeholder = placeholder || '';
    input.style.display = 'block';
    ok.textContent = okTxt || 'Aceptar';
    cancel.textContent = opciones.cancelarTxt || 'Volver';
    const revisar = () => {
      if(!maxP || !contador) return;
      const n = contarPalabras(input.value);
      contador.style.display = 'block';
      contador.textContent = n > maxP ? `${n}/${maxP} palabras · sacá ${n - maxP}` : `${n}/${maxP} palabras`;
      contador.classList.toggle('pasado', n > maxP);
      ok.disabled = n > maxP;
    };
    const lista = document.getElementById('modal-menciones');
    // Menciones: al escribir @ aparecen tus amigos para elegir
    const pintarMenciones = () => {
      if(!opciones.menciones || !lista) return;
      const antes = input.value.slice(0, input.selectionStart ?? input.value.length);
      const m = antes.match(/(^|\s)@([a-z0-9._]{0,20})$/i);
      const opcionesM = m ? amigosParaMencionar(m[2]) : [];
      lista.style.display = opcionesM.length ? 'block' : 'none';
      lista.innerHTML = opcionesM.map(u => `<button type="button" role="option" class="mencion-opcion" data-mencion="${esc(u.usuario)}">${avatarMini(u)}<span><b>${esc(nombreVisible(u))}</b><small>@${esc(u.usuario)}</small></span></button>`).join('');
      lista.querySelectorAll('[data-mencion]').forEach(b => b.onmousedown = e => {
        e.preventDefault();
        const pos = input.selectionStart ?? input.value.length;
        const izq = input.value.slice(0, pos).replace(/@([a-z0-9._]{0,20})$/i, '@' + b.dataset.mencion + ' ');
        input.value = izq + input.value.slice(pos).replace(/^\S*/, '');
        input.focus(); input.selectionStart = input.selectionEnd = izq.length;
        revisar(); pintarMenciones();
      });
    };
    input.oninput = () => { revisar(); pintarMenciones(); };
    input.onkeyup = e => { if(['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) pintarMenciones(); };
    revisar();
    bg.classList.add('show');
    input.focus(); input.selectionStart = input.selectionEnd = input.value.length;
    const done = val => {
      bg.classList.remove('show');
      input.style.display = 'none';
      if(contador){ contador.style.display = 'none'; contador.classList.remove('pasado'); }
      input.oninput = input.onkeyup = null; input.maxLength = 200; ok.disabled = false;
      if(lista){ lista.style.display = 'none'; lista.innerHTML = ''; }
      cancel.textContent = 'Cancelar';
      ok.onclick = cancel.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const onKey = e => { if(e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    ok.onclick = () => done(input.value.trim());
    cancel.onclick = () => done(null);
  });
}

// Fechas
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
// Fecha y hora larga: "Sáb 17 oct · 23:30".
function fmtFecha(ts){
  const d = new Date(ts);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
// Tiempo relativo: "hace 5 min", "hace 2 h"...
function hace(ts){
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if(m < 1) return 'recién';
  if(m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h/24)} d`;
}
// "Esta noche" va de las 08:00 de hoy a las 08:00 de mañana (a las 2 AM seguís en "esta noche").
function esEstaNoche(ts){
  const ini = new Date();
  if(ini.getHours() < 8) ini.setDate(ini.getDate() - 1);
  ini.setHours(8, 0, 0, 0);
  return ts >= ini.getTime() && ts < ini.getTime() + 24 * HORA;
}

// Ubicación pública aproximada a partir del barrio escrito
// ¿Estás en Córdoba capital o alrededores? (los barrios cargados son de ahí)
function cercaDeCordoba(){
  const u = state.userCoords;
  return !!u && distanciaKm(u.lat, u.lng, CBA_CENTER.lat, CBA_CENTER.lng) < 40;
}
// Ciudad de referencia para ubicar direcciones: donde estás ahora o, si no, la de tu perfil.
// "Villa Zoila, Río Tercero" → "Río Tercero"
function ciudadReferencia(){
  const c = state.ciudadActual || state.perfil?.ciudad || '';
  const partes = c.split(',').map(x => x.trim()).filter(Boolean);
  return partes[partes.length - 1] || '';
}
// ¿Estás en Córdoba capital? Solo ahí valen los barrios cargados ("Centro", "Güemes"...).
// Antes se usaban aunque estuvieras en otra ciudad, y "Centro" de Río Tercero caía en Córdoba capital.
function enCordobaCapital(){
  if(state.userCoords) return cercaDeCordoba();
  return normalizar(ciudadReferencia()) === 'cordoba';
}
// Coordenadas aproximadas sin internet: barrios de Córdoba (solo si estás ahí) o tu ubicación / tu ciudad.
function coordsDeLugar(lugar){
  if(enCordobaCapital()){
    const n = normalizar(lugar);
    for(const [barrio, [lat, lng]] of Object.entries(BARRIOS)) if(n.includes(normalizar(barrio))) return { lat, lng };
  }
  if(state.userCoords) return { ...state.userCoords };
  const g = leerPref('geoPerfil');
  return g && typeof g.lat === 'number' ? { lat: g.lat, lng: g.lng } : { ...CBA_CENTER };
}
// Ubica el lugar del evento en cualquier ciudad de Argentina, SIEMPRE cerca de donde estás:
// 1) "lugar, tu ciudad" dentro de tu zona  2) "lugar" dentro de tu zona  3) si escribiste la ciudad, en cualquier lado
// 4) si no aparece, el centro de tu ciudad (nunca otra ciudad con el mismo nombre de barrio)
async function ubicarLugar(lugar){
  if(enCordobaCapital()){
    const n = normalizar(lugar);
    for(const [barrio, [lat, lng]] of Object.entries(BARRIOS)) if(n.includes(normalizar(barrio))) return { lat, lng, ciudad: 'Córdoba' };
  }
  if(typeof fetch !== 'function' || !lugar) return coordsDeLugar(lugar);
  const u = state.userCoords || (() => { const g = leerPref('geoPerfil'); return g && typeof g.lat === 'number' ? g : null; })();
  const ref = ciudadReferencia();
  const conCiudad = ref && !normalizar(lugar).includes(normalizar(ref)) ? `${lugar}, ${ref}` : lugar;
  const escribioCiudad = lugar.includes(',');
  const intentos = [];
  if(u) intentos.push({ q: conCiudad, caja: true }, { q: lugar, caja: true });
  intentos.push({ q: conCiudad, caja: false });
  if(escribioCiudad) intentos.push({ q: lugar, caja: false });
  for(const it of intentos){
    try{
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const t = ctl && setTimeout(() => ctl.abort(), 4500);
      const caja = it.caja && u ? `&viewbox=${u.lng - 0.45},${u.lat + 0.45},${u.lng + 0.45},${u.lat - 0.45}&bounded=1` : '';
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&addressdetails=1&accept-language=es${caja}&q=${encodeURIComponent(it.q)}`, ctl ? { signal: ctl.signal } : {});
      clearTimeout(t);
      const [x] = await r.json();
      if(!x) continue;
      const c = { lat: parseFloat(x.lat), lng: parseFloat(x.lon) };
      // Sin la ciudad escrita, no aceptamos un resultado a más de 60 km de donde estás
      if(u && !escribioCiudad && distanciaKm(u.lat, u.lng, c.lat, c.lng) > 60) continue;
      const a = x.address || {};
      return { ...c, ciudad: a.city || a.town || a.village || a.municipality || ref };
    } catch(e){ break; }
  }
  // No apareció: usamos el centro de tu ciudad (aproximado), nunca otra ciudad
  if(ref){ const l = await buscarLugares(ref, 1); if(l && l.length) return { lat: l[0].lat, lng: l[0].lng, ciudad: l[0].ciudad || ref, aproximada: true }; }
  return { ...coordsDeLugar(lugar), aproximada: true };
}

// Imágenes
const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="#272325" width="400" height="300"/><text x="200" y="150" fill="#F26A1B" font-family="sans-serif" font-size="28" font-weight="700" text-anchor="middle">PARTAZY</text></svg>`
);
// Devuelve la imagen solo si es una URL/dato de imagen válido (si no, una genérica).
function imgSafe(url){
  if(!url || typeof url !== 'string') return FALLBACK_IMG;
  if(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(url)) return url;
  if(/^https:\/\//.test(url)) return url;
  return FALLBACK_IMG;
}
// Valor seguro para background-image (evita romper el CSS o el atributo con comillas/paréntesis)
function cssUrl(url){
  const u = imgSafe(url).replace(/["'()\\\s]/g, c => '%' + c.charCodeAt(0).toString(16).padStart(2,'0'));
  return esc(`url("${u}")`);
}

// Iniciales para el avatar sin foto (ej. "Juan Pérez" → "JP").
function inicialesDe(nombre){
  return String(nombre || '??').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '??';
}
// Busca un evento entre los ya cargados (sin leer la base).
function eventoEnCache(id){ return state.eventos.find(e => e.id === id); }
// Evento desde la memoria, o leyéndolo de la base si no está.
async function eventoPorId(id){ return eventoEnCache(id) || await DataService.getEvento(id); }
// Lee la versión actual del evento (puede haber cambiado: cupo, cancelación) y actualiza la copia local
async function eventoActual(id){
  let ev = null;
  try{ ev = await DataService.getEvento(id); } catch(e){ console.warn('evento', id, e); }
  if(!ev) return eventoEnCache(id) || null;
  const i = state.eventos.findIndex(e => e.id === id);
  if(i >= 0) state.eventos[i] = ev;
  return ev;
}
// Suma 1 confirmado en la copia local (para no recargar).
function sumarConfirmadoEnCache(id){
  const e = eventoEnCache(id);
  if(e) e.confirmadosCount = (e.confirmadosCount || 0) + 1;
}

// =========================================================
//  CUENTAS: Google + email y contraseña
// =========================================================
// Gustos de la persona, en dos grupos: la música que le gusta y los planes que le copan.
// Se guardan juntos en users/{uid}.intereses (así las cuentas viejas siguen funcionando).
const INTERESES_MUSICA = ['Techno','House','Electrónica','Cachengue','Reggaetón','Cumbia','Cuarteto','Rock','Pop','Trap'];
const INTERESES_PLANES = ['Previas','After','Universitarias','Peñas','Egresados','Música en vivo','Gastronomía','Charlas y talleres','Arte y cultura','Deportes','Ferias'];
const INTERESES = [...INTERESES_MUSICA, ...INTERESES_PLANES];
let modoAuth = 'ingresar'; // 'ingresar' | 'crear'

const ERRORES_AUTH = {
  'auth/invalid-email': 'El email no es válido.',
  'auth/missing-password': 'Escribí tu contraseña.',
  'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese email. Probá ingresar.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email.',
  'auth/user-disabled': 'Esta cuenta está suspendida.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/account-exists-with-different-credential': 'Ese email ya está registrado con otro método. Ingresá con email y contraseña.',
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet.',
  'auth/operation-not-allowed': 'Este método de ingreso todavía no está activado en Firebase.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.'
};
// Traduce un error de Firebase Auth a un mensaje en castellano.
function mensajeAuth(e){ return ERRORES_AUTH[e?.code] ?? 'No pudimos completar el ingreso. Probá de nuevo.'; }
// Muestra un error en la pantalla de ingreso.
function errorAuth(msg){ document.getElementById('auth-error').textContent = msg || ''; }

// Cambia el formulario de email entre "Ingresar" y "Crear cuenta".
function setModoAuth(modo){
  modoAuth = modo;
  const crear = modo === 'crear';
  document.getElementById('btn-auth-principal').textContent = crear ? 'Crear cuenta' : 'Ingresar';
  document.getElementById('btn-auth-alternar').textContent = crear ? '¿Ya tenés cuenta? Ingresá' : '¿No tenés cuenta? Creá una';
  document.getElementById('auth-pass').setAttribute('autocomplete', crear ? 'new-password' : 'current-password');
  document.getElementById('btn-auth-olvide').style.display = crear ? 'none' : 'block';
  errorAuth('');
}

// Deshabilita el botón mientras corre la acción (evita doble envío)
async function conBoton(btn, fn){
  btn.disabled = true;
  try{ await fn(); } finally { btn.disabled = false; }
}

// Ingreso con Facebook: se prende cuando la app de Meta está configurada en Firebase (ver instrucciones)
const LOGIN_FACEBOOK = false;
// Login con Facebook (apagado hasta configurar la app en Meta).
async function ingresarConFacebook(){
  errorAuth('');
  const provider = new firebase.auth.FacebookAuthProvider();
  provider.addScope('email');
  try{
    await auth.signInWithPopup(provider);
  } catch(e){
    if(e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment'){
      try{ await auth.signInWithRedirect(provider); } catch(e2){ errorAuth(mensajeAuth(e2)); }
    } else if(e.code === 'auth/account-exists-with-different-credential'){
      errorAuth('Ya tenés una cuenta con ese email. Entrá con Google o con tu email y contraseña.');
    } else if(e.code === 'auth/operation-not-allowed'){
      errorAuth('El ingreso con Facebook todavía no está disponible. Usá Google o tu email.');
    } else {
      errorAuth(mensajeAuth(e));
    }
  }
}

// Login con Google (ventana emergente; si se bloquea, redirección).
async function ingresarConGoogle(){
  errorAuth('');
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try{
    await auth.signInWithPopup(provider);
  } catch(e){
    // Si el navegador bloquea la ventana emergente, usamos redirección
    if(e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment'){
      try{ await auth.signInWithRedirect(provider); } catch(e2){ errorAuth(mensajeAuth(e2)); }
    } else {
      errorAuth(mensajeAuth(e));
    }
  }
}

// Login o registro con email y contraseña.
async function ingresarConEmail(){
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if(!email){ errorAuth('Escribí tu email.'); return; }
  if(pass.length < 6){ errorAuth('La contraseña tiene que tener al menos 6 caracteres.'); return; }
  errorAuth('');
  try{
    if(modoAuth === 'crear'){
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      cred.user.sendEmailVerification().catch(() => {});
    } else {
      await auth.signInWithEmailAndPassword(email, pass);
    }
  } catch(e){ errorAuth(mensajeAuth(e)); }
}

// Manda el mail para restablecer la contraseña.
async function olvideContrasena(){
  const email = document.getElementById('auth-email').value.trim();
  if(!email){ errorAuth('Escribí tu email arriba y volvé a tocar "Olvidé mi contraseña".'); return; }
  try{
    await auth.sendPasswordResetEmail(email);
    errorAuth('');
    toast('Si hay una cuenta con ese email, te llegó un link para cambiar la contraseña');
  } catch(e){ errorAuth(mensajeAuth(e)); }
}

// Edad exacta a partir de 'AAAA-MM-DD'
function edadDesde(fechaStr){
  const [y, m, d] = String(fechaStr || '').split('-').map(Number);
  if(!y || !m || !d) return NaN;
  const hoyD = new Date();
  let edad = hoyD.getFullYear() - y;
  const mes = hoyD.getMonth() + 1;
  if(mes < m || (mes === m && hoyD.getDate() < d)) edad--;
  return edad;
}
// Mi edad según la fecha de nacimiento privada.
function edadUsuario(){ return edadDesde(state.privado?.nacimiento); }

// Selector de intereses (chips que se activan al tocarlos)
function renderSelectorIntereses(contId, seleccion, esOrg){
  const sel = seleccion || [];
  if(esOrg === undefined){ const op = document.querySelector(`#${contId.split('-')[0]}-tipo [data-tipo-cuenta].activo`); esOrg = op ? op.dataset.tipoCuenta === 'organizacion' : esOrganizacion(state.perfil); }
  const chip = i => `<div class="chip ${sel.includes(i) ? 'activo' : ''}" role="button" tabindex="0" aria-pressed="${sel.includes(i)}" data-interes="${esc(i)}">${esc(i)}</div>`;
  document.getElementById(contId).innerHTML = `
    <div class="grupo-intereses" data-grupo="musica"><div class="grupo-tit">🎧 ${esOrg ? '¿Qué música se escucha en tus eventos?' : 'Música que te gusta'}</div><div class="grupo-chips">${INTERESES_MUSICA.map(chip).join('')}</div></div>
    <div class="grupo-intereses" data-grupo="planes"><div class="grupo-tit">🎉 ${esOrg ? '¿Qué tipo de eventos organizás?' : 'Planes que te copan'}</div><div class="grupo-chips">${INTERESES_PLANES.map(chip).join('')}</div></div>`;
  const lab = document.getElementById(contId)?.closest('.campo')?.querySelector('label');
  if(lab) lab.textContent = esOrg ? 'Tu propuesta' : (contId.startsWith('rg') ? '¿Qué te gusta?' : 'Tus gustos');
}
// Lee los intereses marcados en un selector.
function interesesElegidos(contId){
  return [...document.querySelectorAll('#' + contId + ' .chip.activo')].map(c => c.dataset.interes);
}

// Muestra u oculta la barra de navegación.
function setNav(visible){ document.getElementById('app').classList.toggle('sin-nav', !visible); }

// Pantalla de ingreso.
function mostrarBienvenida(){
  setNav(false);
  ir('bienvenida');
  ocultarLoader();
}

// Formulario de "completá tu perfil" (primera vez).
function mostrarRegistro(user){
  setNav(false);
  document.getElementById('rg-nombre').value = user.displayName || '';
  document.getElementById('rg-error').textContent = '';
  state.fotoPerfilNueva = null;
  elegirTipoCuenta('rg-tipo', 'persona');
  pintarFotoPerfil('rg-foto', user.photoURL || '', '+');
  const sugerido = sugerirUsuario(user.displayName || (user.email || '').split('@')[0]);
  document.getElementById('rg-usuario').value = sugerido;
  comprobarUsuario(sugerido, 'rg-usuario-estado');
  const max = new Date(); max.setFullYear(max.getFullYear() - 18);
  document.getElementById('rg-nacimiento').max = max.toISOString().slice(0, 10);
  renderSelectorIntereses('rg-intereses', []);
  const rc = document.getElementById('rg-ciudad'); if(rc && !rc.value && state.ciudadActual && state.userCoords){ rc.value = state.ciudadActual; rc.dataset.ok = '1'; }
  autocompletarLugar(rc);
  ir('registro');
  ocultarLoader();
}

// Valida (+18, @usuario libre, normas aceptadas) y crea el perfil.
async function completarRegistro(){
  const err = m => { document.getElementById('rg-error').textContent = m; };
  const user = auth.currentUser;
  if(!user){ mostrarBienvenida(); return; }

  const nombre = document.getElementById('rg-nombre').value.trim();
  if(nombre.length < 2) return err('Escribí tu nombre.');
  const nacimiento = document.getElementById('rg-nacimiento').value;
  const edad = edadDesde(nacimiento);
  if(isNaN(edad)) return err('Indicá tu fecha de nacimiento.');
  if(edad < 18) return err('Partazy es solo para mayores de 18 años. ¡Te esperamos cuando los cumplas!');
  if(edad > 100) return err('Revisá la fecha de nacimiento.');
  const usuario = normalizarUsuario(document.getElementById('rg-usuario').value);
  if(!(await comprobarUsuario(usuario, 'rg-usuario-estado'))) return err('Elegí otro nombre de usuario.');
  if(!document.getElementById('rg-normas').checked) return err('Para usar Partazy tenés que aceptar las normas de la comunidad.');
  const ciudadOk = await validarLugar(document.getElementById('rg-ciudad'));
  if(ciudadOk === null) return err('No encontramos esa ciudad o barrio. Escribila de nuevo y elegí una opción de la lista.');
  err('');

  const tipoCuenta = tipoCuentaElegido('rg-tipo');
  const apodo = tipoCuenta === 'organizacion' ? '' : document.getElementById('rg-apodo').value.trim().slice(0, 40);
  const perfil = {
    nombre,
    usuario,
    apodo,
    tipoCuenta,
    ...camposBusqueda(nombre, usuario, apodo),
    iniciales: inicialesDe(apodo || nombre),
    ciudad: document.getElementById('rg-ciudad').value.trim() || state.ciudadActual || '',
    intereses: interesesElegidos('rg-intereses'),
    foto: state.fotoPerfilNueva || user.photoURL || '',
    createdAt: Date.now()
  };
  try{
    await DataService.crearPerfil(user.uid, perfil, { nacimiento, email: user.email || '', aceptoNormasTs: Date.now() });
    state.perfil = perfil;
    state.cuentaNueva = true;
    await entrarALaApp();
  } catch(e){
    console.error(e);
    err('No pudimos guardar tu perfil. Probá de nuevo.');
  }
}

// Ubica a la persona en la ciudad o barrio de su perfil (si existe). true si funcionó.
async function usarCiudadDelPerfil(){
  const c = (state.perfil?.ciudad || '').trim();
  if(c.length < 3) return false;
  let g = leerPref('geoPerfil');
  if(!g || g.texto !== c){
    const l = await buscarLugares(c, 1);
    if(!l || !l.length) return false;
    g = { texto: c, lat: l[0].lat, lng: l[0].lng, nombre: l[0].ciudad || c };
    guardarPref('geoPerfil', g);
  }
  state.geoFallo = false;
  aplicarUbicacion({ lat: g.lat, lng: g.lng }, false, g.nombre);
  return true;
}
let geoPedida = false;
// Pide la ubicación al navegador (una vez). Sin permiso: no inventa ciudad, muestra todo.
function pedirUbicacion(){
  if(geoPedida) return;
  geoPedida = true;
  if(state.ubicManual){ aplicarUbicacion({ lat: state.ubicManual.lat, lng: state.ubicManual.lng }, true, state.ubicManual.nombre); return; }
  // Sin permiso de ubicación no inventamos una ciudad: mostramos todo y pedimos que elija la suya
  const sinUbicacion = async () => {
    // Si en el perfil puso su ciudad o barrio, usamos esa (aproximada) en vez de mostrar todo el país
    if(await usarCiudadDelPerfil()) return;
    state.geoFallo = true; state.userCoords = null; state.ubicacionReal = false; pintarUbicacion(); renderHome(); renderExplorar();
  };
  if(!navigator.geolocation || navegadorDeApp()){ sinUbicacion(); return; }
  navigator.geolocation.getCurrentPosition(
    pos => { state.geoFallo = false; aplicarUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true); },
    sinUbicacion,
    { timeout: 6000, maximumAge: 10 * 60 * 1000 }
  );
}

// Carga los eventos y se queda escuchando cambios para que el feed esté siempre al día
function cargarEventosEnVivo(){
  if(state.unsubEventos){ state.unsubEventos(); state.unsubEventos = null; }
  return new Promise(resolve => {
    let primera = true;
    const fallback = async () => { try{ resolve(await DataService.listEventos()); } catch(e){ console.warn('eventos', e); resolve([]); } };
    try{
      state.unsubEventos = DataService.escucharEventos(lista => {
        state.hayMasEventos = lista.length >= (state.limiteEventos || LIMITE_INICIAL);
        if(primera){ primera = false; resolve(lista); return; }
        state.eventos = lista;
        refrescarFeed();
      }, e => { console.warn('eventos en vivo', e); if(primera){ primera = false; fallback(); } });
    } catch(e){ primera = false; fallback(); }
  });
}
let _tFeed;
// Las barras de arriba de cada pantalla toman fondo recién cuando bajás (así no queda una franja ancha arriba).
document.querySelectorAll('.screen').forEach(sc => sc.addEventListener('scroll', () => {
  const y = sc.scrollTop, on = sc.classList.contains('con-scroll');
  if(!on && y > 28) sc.classList.add('con-scroll'); else if(on && y < 4) sc.classList.remove('con-scroll');
}, { passive: true }));
// Repinta inicio/explorar cuando llegan cambios en vivo, sin perder el scroll.
function refrescarFeed(){
  clearTimeout(_tFeed);
  _tFeed = setTimeout(() => {
    if(NAV.actual === 'home'){
      const scrolls = [...document.querySelectorAll('#pantalla-home .fila-scroll')].map(el => [el.id, el.scrollLeft]);
      renderHome();
      scrolls.forEach(([id, x]) => { const el = document.getElementById(id); if(el) el.scrollLeft = x; });
      state._feedSucio = true; // explorar se repinta al entrar
    } else if(NAV.actual === 'explorar'){ renderExplorar(); state._feedSucio = true; }
    else state._feedSucio = true;
    renderTicker();
  }, 400);
}

// Arranque con sesión: carga perfil, eventos, red social y abre el link compartido si había.
async function entrarALaApp(){
  mostrarLoader('CARGANDO EVENTOS...');
  if(state.perfil.suspendido){ mostrarSuspendido(); return; }
  // Todo a la vez (antes iba una consulta atrás de la otra y se sumaban las esperas)
  const [privado, esAdmin, verificacion, eventos] = await Promise.all([
    DataService.getPrivado(state.uid),
    DataService.esAdmin(state.uid).catch(() => false),
    esOrganizacion(state.perfil) ? DataService.getVerificacion(state.uid).catch(() => null) : Promise.resolve(state.verificacion),
    cargarEventosEnVivo()
  ]);
  state.privado = privado; state.esAdmin = esAdmin; state.verificacion = verificacion; state.eventos = eventos;
  setNav(true);
  renderHome();
  renderExplorar();
  renderPerfilVista();
  ir('home');
  ocultarLoader();
  pedirUbicacion();
  iniciarSocial();
  latido();
  setTimeout(migrarFotosPropias, 4000);
  renderCtaAmigos();
  pintarMailContacto();
  registrarSW();
  pintarBotonAvisos();
  pintarBotonInstalar();
  document.querySelectorAll('.anio-actual').forEach(el => el.textContent = new Date().getFullYear());
  // Perfiles creados antes de existir la búsqueda: se completan solos
  if(!state.perfil.nombreBusqueda){
    const extra = camposBusqueda(state.perfil.nombre, state.perfil.usuario, state.perfil.apodo);
    Object.assign(state.perfil, extra);
    DataService.savePerfil(state.uid, extra).catch(e => console.warn('busqueda', e));
  }
  // Si llegó por un link compartido, lo abrimos
  let ruta = state.rutaPendiente;
  try{ ruta = ruta || sessionStorage.getItem('partazy_ruta'); sessionStorage.removeItem('partazy_ruta'); } catch(e){}
  state.rutaPendiente = null;
  if(ruta) abrirRuta(ruta);
  // El tutorial sale solo a quien recién se registra. Los demás lo tienen en Ayuda / Más opciones.
  if(state.cuentaNueva && !tutorialVisto()) setTimeout(abrirTutorial, ruta ? 1500 : 500);
  else setTimeout(revisarParaCalificar, 4000);
  setTimeout(limpiarEventosViejos, 9000);
  state.cuentaNueva = false;
}

// =========================================================
//  MODO INVITADO: se puede mirar sin cuenta; para interactuar hay que registrarse
// =========================================================
const MOTIVOS_PANTALLA = {
  crear: 'Para publicar tu fiesta o tu previa necesitás una cuenta.',
  chats: 'Para chatear necesitás una cuenta.', chat: 'Para chatear necesitás una cuenta.',
  perfil: 'Creá tu perfil para que te encuentren tus amigos.',
  amigos: 'Para sumar amigos y ver a dónde van necesitás una cuenta.',
  notificaciones: 'Con una cuenta te avisamos cuando tus amigos van a una fiesta.',
  ticket: 'Para tener tus entradas necesitás una cuenta.', usuario: 'Para ver perfiles necesitás una cuenta.'
};
// Arranque sin sesión: se puede mirar; a los segundos ofrece registrarse.
async function entrarComoInvitado(){
  state.invitado = true;
  document.body.classList.add('modo-invitado');
  mostrarLoader('CARGANDO EVENTOS...');
  state.eventos = await cargarEventosEnVivo();
  setNav(true);
  renderHome();
  renderExplorar();
  let ruta = state.rutaPendiente;
  state.rutaPendiente = null;
  const m = String(ruta || '').match(/^#\/evento\//);
  ir('home');
  ocultarLoader();
  pedirUbicacion();
  registrarSW();
  pintarBotonInstalar();
  document.querySelectorAll('.anio-actual').forEach(el => el.textContent = new Date().getFullYear());
  if(m) abrirRuta(ruta);
  else if(ruta){ try{ sessionStorage.setItem('partazy_ruta', ruta); } catch(e){} }
  // A los pocos segundos, la invitación a registrarse (se puede cerrar)
  clearTimeout(state._tCuenta);
  state._tCuenta = setTimeout(() => { if(state.invitado && !document.querySelector('.hoja-bg.show, .modal-bg.show, .tuto-bg.show')) pedirCuenta(ruta && !m ? 'Para ver este perfil necesitás una cuenta.' : null); }, m ? 3500 : 1500);
}
// Deja el modo invitado al iniciar sesión.
function salirDeInvitado(){
  if(!state.invitado) return;
  state.invitado = false;
  clearTimeout(state._tCuenta);
  document.body.classList.remove('modo-invitado');
  document.getElementById('hoja-cuenta').classList.remove('show');
}
// Ventana "Sumate / Necesitás una cuenta" (con el motivo).
function pedirCuenta(motivo){
  const t = document.getElementById('cuenta-titulo'), x = document.getElementById('cuenta-texto');
  t.textContent = motivo ? 'Necesitás una cuenta' : 'Sumate a la noche';
  x.textContent = motivo ? motivo + ' Es gratis y tarda un minuto.' : 'Creá tu cuenta gratis para confirmar a fiestas, armar previas, chatear y ver a dónde van tus amigos.';
  const h = document.getElementById('hoja-cuenta');
  if(h.classList.contains('show')) return;
  h.classList.add('show');
  abrirModalHist();
}
// Cierra la ventana de pedir cuenta.
function cerrarPedirCuenta(){
  const h = document.getElementById('hoja-cuenta');
  if(!h.classList.contains('show')) return;
  h.classList.remove('show');
  soltarModalHist();
}
// Va a la pantalla de ingreso y recuerda el evento que estaba mirando.
function irALogin(modo){
  cerrarPedirCuenta();
  // Si estaba mirando un evento, al entrar lo volvemos a abrir
  if(/^#\/(evento|u)\//.test(location.hash)){ try{ sessionStorage.setItem('partazy_ruta', location.hash); } catch(e){} }
  setNav(false);
  setTimeout(() => { setModoAuth(modo === 'crear' ? 'crear' : 'ingresar'); ir('bienvenida'); }, 60);
}
// Vuelve de la pantalla de ingreso a la app sin cuenta.
function seguirMirando(){
  if(!state.invitado) return;
  setNav(true);
  ir('home');
}
// Mientras mira sin cuenta, todo lo que sea interactuar pide registrarse
(function(){
  const LIBRES_CONT = '#pantalla-bienvenida, #pantalla-registro, #pantalla-ayuda, #pantalla-privacidad, #pantalla-terminos, .tuto-bg, .modal-bg, .mapa-bg, .hoja-bg, .pie-legal, .nav-pie, .leaflet-container, #toast, .barra-invitado';
  const LIBRES = [
    '[data-nav="home"]', '[data-nav="explorar"]', '.nav-logo', '.logo',
    '#chips-home .chip', '#chips-explorar .chip', '.buscador', '.buscador-mini', '.btn-buscar-mini', '#nav-toggle', '.nav-marca', '#input-buscar', '#seg-eventos', '#vista-lista', '#vista-mapa', '.ubic-btn',
    '.seccion-titulo span', '[aria-label="Actualizar eventos"]', '.tarjeta', '.tarjeta-h', '.btn-vista',
    '[aria-label="Volver"]', '#btn-compartir-evento', '[onclick*="abrirReferencias"]', '[onclick*="abrirTutorial"]', '[onclick*="abrirAyuda"]', 'a[target="_blank"]', '.hero-img', '[data-vista]', '[data-idioma]'
  ].join(',');
  const INTERACTIVO = 'a, button, input, select, textarea, label, summary, [onclick], [role="button"], [tabindex], [data-usuario], [data-ticket], [data-id], [data-ev], [data-votar], .chip, .tarjeta, .tarjeta-h, .switch';
  const MOTIVOS_EL = [
    ['#btn-accion-detalle', 'Para confirmar tu lugar en este evento necesitás una cuenta.'],
    ['[data-nav="crear"], .nav-crear, [onclick*="ir(\'crear\')"]', MOTIVOS_PANTALLA.crear],
    ['[data-nav="chats"]', MOTIVOS_PANTALLA.chats],
    ['[data-nav="perfil"]', MOTIVOS_PANTALLA.perfil],
    ['#btn-repost, #btn-enviar-amigos', 'Para compartir con tus amigos necesitás una cuenta.'],
    ['[data-usuario]', MOTIVOS_PANTALLA.usuario],
    ['[data-votar]', 'Para votar cómo está el evento necesitás una cuenta.'],
    ['#seg-personas', 'Para buscar gente necesitás una cuenta.']
  ];
  document.addEventListener('click', e => {
    if(!state.invitado) return;
    const t = e.target;
    if(!(t instanceof Element) || t.closest(LIBRES_CONT)) return;
    const el = t.closest(INTERACTIVO);
    if(!el || el.matches(LIBRES)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const m = MOTIVOS_EL.find(([sel]) => el.matches(sel));
    pedirCuenta(m ? m[1] : null);
  }, true);
})();

// =========================================================
//  CALIFICACIONES: la joda y quien organiza. Solo quienes fueron, después del evento.
//  Las organizaciones acumulan su nota; las personas no tienen nota en su perfil.
// =========================================================
const CALIF_DESDE = 3 * HORA, CALIF_HASTA = 15 * 24 * HORA;
const ETIQUETA_NOTA = ['', 'Muy mala', 'Floja', 'Buena', 'Muy buena', '¡Increíble!'];
// Promedio con una decimal y coma: "4,6".
function notaTxt(suma, n){ return n ? (Math.round(suma / n * 10) / 10).toFixed(1).replace('.', ',') : '—'; }
// Texto de la nota de una organización: "★ 4,6 · 32 calificaciones".
function califOrgTxt(u, corto){
  const n = u?.califN || 0;
  if(!esOrganizacion(u) || !n) return '';
  const t = `<span class="nota-org">★ ${notaTxt(u.califSuma || 0, n)}</span>`;
  return corto ? ` · ${t} (${n})` : `${t} · ${n} ${n === 1 ? 'calificación' : 'calificaciones'}`;
}
// "La organización" (boliches) o "El anfitrión" (personas).
function etiquetaAnfitrion(ev, org){ return org ? 'La organización' : 'El anfitrión'; }
// ¿Puedo calificar este evento? (fui, ya pasó, menos de 15 días, no lo organicé).
function puedeCalificar(ev, estado){
  const t = Date.now();
  return !!state.uid && !state.invitado && ev.creador !== state.uid && (estado === 'confirmado' || estado === 'aprobado')
    && !esCancelado(ev) && t >= ev.fechaTs + CALIF_DESDE && t <= ev.fechaTs + CALIF_HASTA;
}
// Fila de 5 estrellas tocables.
function estrellasHTML(nombre){
  return `<div class="estrellas" data-estrellas="${nombre}" role="radiogroup">${[1, 2, 3, 4, 5].map(i =>
    `<button type="button" data-estrella="${i}" role="radio" aria-checked="false" aria-label="${i} de 5">★</button>`).join('')}</div>`;
}
// Las dos filas de estrellas: la joda y quien organiza.
function filasCalifHTML(ev, org){
  return `<div class="calif-fila"><span>🎉 La joda<br><small class="valor-txt" style="color:var(--gris); font-weight:600; font-size:11px;">Música, gente, ambiente</small></span>${estrellasHTML('joda')}</div>
    <div class="calif-fila"><span>${org ? '🎪' : '🏠'} ${etiquetaAnfitrion(ev, org)}<br><small class="valor-txt" style="color:var(--gris); font-weight:600; font-size:11px;">Trato, orden, lo que prometió</small></span>${estrellasHTML('anfitrion')}</div>`;
}
// Bloque con los promedios del evento.
function resumenCalifHTML(ev, org){
  const n = ev.califN || 0;
  if(!n) return '';
  return `<h3 class="titulo-bloque">Calificaciones</h3><div class="calif-res">
    <div class="caja"><b><i>★</i>${notaTxt(ev.califJoda || 0, n)}</b><span>La joda</span></div>
    <div class="caja"><b><i>★</i>${notaTxt(ev.califAnf || 0, n)}</b><span>${etiquetaAnfitrion(ev, org)}</span></div>
    <small>${n} ${n === 1 ? 'calificación' : 'calificaciones'} de gente que fue</small></div>`;
}
// ¿El evento lo organiza una cuenta de organización?
async function esOrgCreador(ev){
  if(ev.deOrganizacion) return true;
  const u = state.invitado ? null : await getUsuario(ev.creador).catch(() => null);
  return esOrganizacion(u);
}
// Bloque de calificaciones del detalle: promedios + formulario o "Ya calificaste".
async function pintarCalificacion(ev, estado, tok){
  const b = document.getElementById('bloque-calif');
  if(!b) return;
  const org = await esOrgCreador(ev);
  if(tok !== state.tok) return;
  let html = resumenCalifHTML(ev, org);
  if(puedeCalificar(ev, estado)){
    let mia = null;
    try{ mia = await DataService.getCalificacion(ev.id, state.uid); } catch(e){ console.warn('calif', e); }
    if(tok !== state.tok) return;
    html += mia
      ? `<div class="calif-hecha">✓ Ya calificaste: la joda ★${mia.joda} · ${etiquetaAnfitrion(ev, org).toLowerCase()} ★${mia.anfitrion}</div>`
      : `<div class="calif-form" data-calif-root ${html ? 'style="margin-top:14px;"' : ''}><h3 class="titulo-bloque" style="margin:0;">¿Cómo estuvo?</h3>
          <div class="ayuda">Solo califican quienes fueron. Es anónimo: nadie ve qué pusiste.</div>
          ${filasCalifHTML(ev, org)}
          <button class="btn btn-primario" data-enviar-calif="${esc(ev.id)}">Enviar calificación</button></div>`;
  }
  b.innerHTML = html;
  b.style.display = html ? '' : 'none';
  // Nota de la organización en la fila de quien organiza (si todavía no estaba en caché)
  if(org && !state.invitado){
    const u = await getUsuario(ev.creador).catch(() => null);
    const el = document.querySelector(`[data-org-nota="${ev.creador}"]`);
    if(u && el && tok === state.tok) el.innerHTML = califOrgTxt(u, true);
  }
}
// Recuerda en este dispositivo que ya se calificó (o se salteó) un evento.
function marcarCalif(id){
  try{ const m = JSON.parse(localStorage.getItem('partazy_calif') || '{}'); m[id] = 1; localStorage.setItem('partazy_calif', JSON.stringify(m)); } catch(e){}
}
// Guarda la calificación y actualiza los promedios en pantalla.
async function enviarCalificacion(id, btn){
  const root = btn.closest('[data-calif-root]');
  const joda = +(root?.querySelector('[data-estrellas="joda"]')?.dataset.valor || 0);
  const anf = +(root?.querySelector('[data-estrellas="anfitrion"]')?.dataset.valor || 0);
  if(!joda || !anf){ toast('Tocá las estrellas de las dos filas'); return; }
  const ev = await eventoPorId(id);
  if(!ev) return;
  btn.disabled = true; btn.textContent = 'Enviando...';
  try{
    const org = await esOrgCreador(ev);
    await DataService.calificar(ev, state.uid, joda, anf, org);
    marcarCalif(id);
    Object.assign(ev, { califN: (ev.califN || 0) + 1, califJoda: (ev.califJoda || 0) + joda, califAnf: (ev.califAnf || 0) + anf });
    const u = state.usuarios[ev.creador];
    if(org && u) Object.assign(u, { califN: (u.califN || 0) + 1, califSuma: (u.califSuma || 0) + anf });
    toast('¡Gracias por calificar! ⭐');
    if(document.getElementById('hoja-vista').classList.contains('show') && root.closest('#hoja-vista')) cerrarHoja();
    if(NAV.actual === 'detalle' && NAV.clave === 'detalle:' + id) renderDetalle(id);
  } catch(e){
    console.error(e);
    btn.disabled = false; btn.textContent = 'Enviar calificación';
    toast('No se pudo enviar. ¿Ya lo calificaste?');
  }
}
// Al entrar: si fuiste a algo que ya terminó y no lo calificaste, te lo pregunta (una vez)
async function revisarParaCalificar(){
  if(state.invitado || !state.uid) return;
  let hechas = {};
  try{ hechas = JSON.parse(localStorage.getItem('partazy_calif') || '{}'); } catch(e){}
  let asis = [];
  try{ asis = (await DataService.listAsistenciasDe(state.uid)).filter(a => (a.estado === 'confirmado' || a.estado === 'aprobado') && !hechas[a.eventId]); } catch(e){ return; }
  for(const a of asis){
    const ev = await eventoPorId(a.eventId).catch(() => null);
    if(!ev){ marcarCalif(a.eventId); continue; }
    if(Date.now() > ev.fechaTs + CALIF_HASTA || ev.creador === state.uid || esCancelado(ev)){ marcarCalif(ev.id); continue; }
    if(!puedeCalificar(ev, a.estado)) continue;
    const mia = await DataService.getCalificacion(ev.id, state.uid).catch(() => null);
    if(mia){ marcarCalif(ev.id); continue; }
    if(document.querySelector('.hoja-bg.show, .modal-bg.show, .tuto-bg.show')) return;
    const org = await esOrgCreador(ev);
    abrirHoja(`<div data-calif-root><div class="calif-hoja calif-form">
      <div class="titulo-prev" style="padding:0; margin-bottom:8px;">¿Cómo estuvo?</div>
      <h3>${esc(ev.nombre)}</h3>
      <div class="sub">${esc(fechaCorta(ev.fechaTs))} · ${esc(lugarPublico(ev))} · Es anónimo</div>
      ${filasCalifHTML(ev, org)}
    </div>
    <div class="acciones"><button class="btn btn-secundario" onclick="marcarCalif('${esc(ev.id)}'); cerrarHoja();">Ahora no</button><button class="btn btn-primario" data-enviar-calif="${esc(ev.id)}">Enviar</button></div></div>`);
    return;
  }
}

// =========================================================
//  EXPORTAR LISTA DE ANOTADOS (solo quien organiza)
// =========================================================
const ESTADO_LISTA = { confirmado: 'Confirmado', aprobado: 'Aprobado', solicitado: 'Solicitud pendiente', 'en-espera': 'Lista de espera', rechazado: 'Rechazado' };
// Arma las filas de la lista de anotados para exportar.
async function filasLista(id){
  const ev = await eventoActual(id);
  const lista = (await DataService.listarAsistentes(id)).filter(a => a.estado !== 'rechazado');
  await Promise.all(lista.map(a => getUsuario(a.uid).catch(() => null)));
  const orden = { confirmado: 0, aprobado: 0, 'en-espera': 1, solicitado: 2 };
  lista.sort((a, b) => (orden[a.estado] ?? 3) - (orden[b.estado] ?? 3) || String(a.nombre).localeCompare(String(b.nombre)));
  const filas = lista.map((a, i) => {
    const u = state.usuarios[a.uid];
    return [String(i + 1), a.nombre || nombreVisible(u), u?.usuario ? '@' + u.usuario : '', ESTADO_LISTA[a.estado] || a.estado,
      a.ticket && ev.conQR ? a.ticket : '', a.checkinTs ? 'Sí' : '', a.uid === state.uid ? 'Organizador' : ''];
  });
  return { ev, filas, cab: ['#', 'Nombre', 'Usuario', 'Estado', 'Código', 'Ingresó', 'Nota'] };
}
// Nombre del archivo descargado: partazy-nombre-del-evento-fecha.ext
function nombreArchivo(ev, ext){
  return ('partazy-' + normalizar(ev.nombre || 'evento').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + fechaInput(ev.fechaTs) + '.' + ext);
}
// Descarga un archivo generado en el navegador.
function descargarBlob(blob, nombre){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
// Carga la librería de PDF solo cuando hace falta.
function cargarJsPDF(){
  if(window.jspdf) return Promise.resolve();
  if(cargarJsPDF._p) return cargarJsPDF._p;
  cargarJsPDF._p = new Promise((ok, mal) => {
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    js.onload = () => ok(); js.onerror = () => { cargarJsPDF._p = null; mal(new Error('jspdf')); };
    document.head.appendChild(js);
  });
  return cargarJsPDF._p;
}
// Descarga la lista de anotados en CSV (Excel) o PDF.
async function exportarLista(id, fmt, btn){
  const txt0 = btn?.textContent;
  if(btn){ btn.disabled = true; btn.textContent = 'Preparando...'; }
  try{
    const { ev, filas, cab } = await filasLista(id);
    if(ev.creador !== state.uid) return;
    if(fmt === 'csv'){
      // Separado por ";" y con BOM: Excel en español lo abre directo con acentos
      const celda = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const lineas = [[`${ev.nombre} · ${fmtFecha(ev.fechaTs)} hs`], [], cab, ...filas].map(f => f.map(celda).join(';'));
      descargarBlob(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nombreArchivo(ev, 'csv'));
    } else {
      await cargarJsPDF();
      const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 40;
      const cols = [26, 170, 110, 110, 70, 50]; // #, nombre, usuario, estado, código, ingresó
      const limpio = t => String(t ?? '').replace(/[^\u0000-ÿ]/g, '');
      let y = m;
      const encabezado = () => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(limpio(ev.nombre), m, y); y += 18;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
        doc.text(limpio(`${fmtFecha(ev.fechaTs)} hs · ${ev.lugar || ''}`), m, y); y += 14;
        const ok = filas.filter(f => f[3] === 'Confirmado' || f[3] === 'Aprobado').length;
        doc.text(limpio(`${ok} confirmados · lista generada por PARTAZY el ${new Date().toLocaleString('es-AR')}`), m, y); y += 22;
        doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        let x = m; cab.slice(0, 6).forEach((c, i) => { doc.text(c, x, y); x += cols[i]; });
        y += 6; doc.setDrawColor(200); doc.line(m, y, W - m, y); y += 14; doc.setFont('helvetica', 'normal');
      };
      encabezado();
      filas.forEach((f, n) => {
        if(y > H - m){ doc.addPage(); y = m; encabezado(); }
        if(n % 2 === 0){ doc.setFillColor(245, 240, 238); doc.rect(m - 4, y - 10, W - 2 * m + 8, 15, 'F'); }
        let x = m;
        f.slice(0, 6).forEach((c, i) => { doc.text(doc.splitTextToSize(limpio(c), cols[i] - 6)[0] || '', x, y); x += cols[i]; });
        y += 15;
      });
      if(!filas.length){ doc.text('Todavía no hay nadie anotado.', m, y); }
      doc.save(nombreArchivo(ev, 'pdf'));
    }
    toast('Lista descargada ✓');
  } catch(e){
    console.error(e);
    toast('No se pudo descargar la lista');
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = txt0; }
  }
}

// =========================================================
//  ENTRADAS VENDIDAS EN OTRA PÁGINA: "Ya compré, avisar que voy"
// =========================================================
async function yaCompreEntrada(id){
  const ev = await eventoActual(id);
  if(!ev) return;
  const dom = linkWeb(ev.linkEntradas, true)?.texto || 'la otra página';
  const ok = await confirmar('¿Ya tenés tu entrada?', `Si ya la compraste en ${dom}, te anotamos en Partazy: entrás al grupo del evento y tus amigos ven que vas. La entrada válida es la que te dio ${dom}.`, 'Sí, avisar que voy');
  if(!ok) return;
  accionDetalle(ev, null, false, false, true);
}

// ---------- Menú ☰ del perfil ----------
function abrirMenuPerfil(){
  document.getElementById('menu-perfil').classList.add('show');
  abrirModalHist();
}
// Cierra el menú ☰ del perfil.
function cerrarMenuPerfil(){
  const m = document.getElementById('menu-perfil');
  if(!m.classList.contains('show')) return;
  m.classList.remove('show');
  soltarModalHist();
}
// Al elegir una opción: primero se cierra el menú y después se hace lo elegido
document.getElementById('menu-perfil').addEventListener('click', e => {
  const b = e.target.closest('button');
  if(!b || !b.onclick) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const fn = b.onclick;
  cerrarMenuPerfil();
  setTimeout(() => fn.call(b, e), 120);
}, true);

// ---------- Barra lateral de la compu: se achica y se agranda (se recuerda) ----------
function alternarNav(forzar){
  const ph = document.getElementById('app');
  const mini = typeof forzar === 'boolean' ? forzar : !ph.classList.contains('nav-mini');
  ph.classList.toggle('nav-mini', mini);
  const t = document.getElementById('nav-toggle');
  if(t){ const l = mini ? 'Agrandar el menú' : 'Achicar el menú'; t.setAttribute('aria-label', l); t.title = l; }
  try{ localStorage.setItem('partazy_navMini', mini ? '1' : '0'); } catch(e){}
}
(function(){
  // Cada ícono muestra su nombre al pasar el mouse (útil con el menú achicado)
  document.querySelectorAll('.navbar .nav-item').forEach(b => { const t = b.textContent.replace(/\s+/g, ' ').trim(); if(t && !b.title) b.title = t === 'Crear' ? 'Crear evento' : t; });
  let mini = false; try{ mini = localStorage.getItem('partazy_navMini') === '1'; } catch(e){}
  if(mini) alternarNav(true);
})();

// Lleva a Explorar con el buscador listo para escribir.
function irABuscar(){
  ir('explorar');
  if(typeof modoExplorar === 'function' && state.modoExplorar === 'personas') modoExplorar('eventos');
  setTimeout(() => { const i = document.getElementById('input-buscar'); if(i) i.focus(); }, 80);
}
(function(){
  const pant = document.getElementById('pantalla-home');
  const top = pant && pant.querySelector('.topbar');
  const grande = pant && pant.querySelector('.buscador');
  if(!top || !grande) return;
  const revisar = () => { top.classList.toggle('compacta', grande.getBoundingClientRect().bottom < top.getBoundingClientRect().bottom + 4); };
  pant.addEventListener('scroll', revisar, { passive: true });
  window.addEventListener('resize', revisar);
})();

// "Ya no voy" / retirar solicitud / salir de la lista de espera.
async function salirDelEvento(id, estado){
  const ev = await eventoActual(id);
  if(!ev) return;
  const lugar = estado === 'confirmado' || estado === 'aprobado';
  const [titulo, texto, ok] = estado === 'solicitado' ? ['Retirar solicitud', `Le retiramos tu pedido para ir a ${ev.nombre}.`, 'Retirar']
    : estado === 'en-espera' ? ['Salir de la lista de espera', `Dejás tu lugar en la lista de espera de ${ev.nombre}.`, 'Salir de la lista']
    : ['¿Ya no vas?', `Liberás tu lugar en ${ev.nombre} para que lo use otra persona y salís del grupo del evento.` + (ev.precio > 0 ? ' Si ya pagaste, la devolución la coordinás directamente con el organizador.' : ''), 'Liberar mi lugar'];
  if(!(await confirmar(titulo, texto, ok))) return;
  try{
    await DataService.salirDeEvento(id, state.uid, estado);
    if(lugar){
      const e = eventoEnCache(id); if(e) e.confirmadosCount = Math.max(0, (e.confirmadosCount || 1) - 1);
      state.misPlanes.delete(id); sincronizarPlanes();
    }
    toast(lugar ? 'Listo, liberaste tu lugar' : estado === 'solicitado' ? 'Solicitud retirada' : 'Saliste de la lista de espera');
    renderPerfilVista(); renderHome();
    if(NAV.actual === 'ticket') abrirDetalle(id); else renderDetalle(id);
  } catch(e){
    console.error(e);
    toast('No se pudo. Probá de nuevo.');
  }
}

// Más eventos: amplía la escucha de a 100
async function cargarMasEventos(btn){
  if(btn){ btn.disabled = true; btn.textContent = 'Cargando...'; }
  state.limiteEventos = (state.limiteEventos || LIMITE_INICIAL) + 100;
  state.eventos = await cargarEventosEnVivo();
  renderHome(); renderExplorar();
  if(btn){ btn.disabled = false; btn.textContent = 'Cargar más eventos'; }
}
// Muestra "Cargar más eventos" si hay más de los cargados.
function pintarBotonMas(){ const m = document.getElementById('explorar-mas'); if(m) m.style.display = state.hayMasEventos ? '' : 'none'; }

// Limpieza: quien organiza borra sola sus eventos de hace más de 30 días (una vez por día)
async function limpiarEventosViejos(){
  if(!state.uid || state.invitado) return;
  const clave = 'partazy_limpieza_' + state.uid;
  try{ if(Date.now() - Number(localStorage.getItem(clave) || 0) < 864e5) return; localStorage.setItem(clave, String(Date.now())); } catch(e){}
  try{
    const viejos = (await DataService.eventosDe(state.uid)).filter(e => e.fechaTs < Date.now() - 30 * 864e5).slice(0, 20);
    for(const e of viejos){ try{ await DataService.eliminarEvento(e.id, state.uid); } catch(err){ console.warn('limpieza', e.id, err); } }
  } catch(e){ console.warn('limpieza', e); }
}

// Cierra sesión y recarga la página.
async function cerrarSesion(){
  const ok = await confirmar('Cerrar sesión', 'Vas a salir de tu cuenta. Podés volver a entrar cuando quieras con el mismo método.', 'Cerrar sesión');
  if(!ok) return;
  await auth.signOut();
  location.reload();
}

// =========================================================
//  IDENTIDAD: foto de perfil, @usuario y apodo
// =========================================================
const RE_USUARIO = /^[a-z0-9._]{3,20}$/;
// Nombre a mostrar: el apodo si tiene, si no el nombre.
function nombreVisible(u){ return u?.apodo || u?.nombre || 'Usuario'; }
// Limpia un @usuario: minúsculas, sin espacios ni símbolos raros.
function normalizarUsuario(v){ return normalizar(v).replace(/^@+/, '').replace(/\s+/g, '').replace(/[^a-z0-9._]/g, '').slice(0, 20); }
// Propone un @usuario a partir del nombre.
function sugerirUsuario(nombre){
  let base = normalizarUsuario(String(nombre || '').trim().split(/\s+/).slice(0, 2).join('.')).slice(0, 16);
  if(base.length < 3) base = (base + 'party').slice(0, 8);
  return base;
}
// ¿La foto es una URL https o una imagen JPEG embebida?
function fotoValida(f){ return typeof f === 'string' && (/^https:\/\//.test(f) || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f)); }

// Comprueba si un @usuario está libre (o ya es mío) y lo muestra debajo del campo
async function comprobarUsuario(v, estadoId){
  const el = document.getElementById(estadoId);
  el.classList.remove('ok', 'mal');
  if(!RE_USUARIO.test(v)){
    el.textContent = 'Entre 3 y 20 caracteres: letras, números, punto o guion bajo.';
    el.classList.add('mal');
    return false;
  }
  if(v === state.perfil?.usuario){ el.textContent = 'Es tu nombre de usuario actual.'; el.classList.add('ok'); return true; }
  el.textContent = 'Comprobando...';
  let libre = false;
  try{ libre = await DataService.usuarioDisponible(v, state.uid); } catch(e){ console.warn('usuario', e); }
  if(document.getElementById(estadoId) !== el) return libre;
  el.textContent = libre ? `@${v} está disponible ✓` : `@${v} ya está en uso. Probá con otro.`;
  el.classList.add(libre ? 'ok' : 'mal');
  return libre;
}
// Mientras se escribe el @usuario, avisa si está libre.
function vigilarUsuario(inputId, estadoId){
  const input = document.getElementById(inputId);
  let deb;
  input.addEventListener('input', () => {
    const limpio = normalizarUsuario(input.value);
    if(limpio !== input.value) input.value = limpio;
    clearTimeout(deb);
    deb = setTimeout(() => comprobarUsuario(limpio, estadoId), 350);
  });
}

// Muestra la foto elegida dentro del círculo
function pintarFotoPerfil(contId, foto, iniciales){
  const el = document.getElementById(contId);
  el.innerHTML = fotoValida(foto) ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer">` : esc(iniciales || '+');
}

// Elige, recorta, revisa (filtro) y comprime la foto de perfil.
async function elegirFotoPerfil(input, contId, estadoId){
  const file = input.files[0];
  input.value = '';
  if(!file) return;
  const estado = document.getElementById(estadoId);
  estado.classList.remove('ok', 'mal');
  estado.textContent = 'Revisando la foto... (la primera vez tarda unos segundos)';
  try{
    const foto = await prepararFoto(file, 320, true);
    state.fotoPerfilNueva = foto;
    pintarFotoPerfil(contId, foto);
    estado.textContent = 'Foto lista ✓ Tocá para cambiarla.';
    estado.classList.add('ok');
  } catch(e){
    estado.textContent = e.message || 'No pudimos usar esa foto.';
    estado.classList.add('mal');
  }
}

// =========================================================
//  FILTRO DE FOTOS: detecta desnudez y contenido sexual
//  Modelo MobileNetV2 de nsfwjs, ejecutado con TensorFlow.js en el navegador.
//  Se descarga solo la primera vez que alguien sube una foto (desde jsDelivr).
//  Nota: es una barrera en la app; la revisión en el servidor (Cloud Vision)
//  requiere el plan Blaze. Las denuncias cubren lo que se escape.
// =========================================================
const FiltroFotos = {
  URL_TFJS:   'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
  URL_MODELO: 'https://cdn.jsdelivr.net/npm/nsfwjs@4.4.0/dist/models/mobilenet_v2/model.min.js',
  URL_PESOS:  'https://cdn.jsdelivr.net/npm/nsfwjs@4.4.0/dist/models/mobilenet_v2/group1-shard1of1.min.js',
  _modelo: null,
  _cargando: null,

  // Carga un script externo una sola vez.
  cargarScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo descargar ' + src));
      document.head.appendChild(s);
    });
  },

  // Carga (una vez) el modelo de IA que detecta desnudez.
  modelo(){
    if(this._modelo) return Promise.resolve(this._modelo);
    if(!this._cargando){
      this._cargando = (async () => {
        if(!window.tf) await this.cargarScript(this.URL_TFJS);
        // Estos archivos dejan el modelo en variables globales: las tomamos y las limpiamos
        await this.cargarScript(this.URL_MODELO);
        const json = window.model; try{ delete window.model; } catch(e){ window.model = undefined; }
        await this.cargarScript(this.URL_PESOS);
        const b64 = window.group1_shard1of1; try{ delete window.group1_shard1of1; } catch(e){ window.group1_shard1of1 = undefined; }
        const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        const m = await tf.loadLayersModel(tf.io.fromMemory({
          modelTopology: json.modelTopology,
          weightSpecs: json.weightsManifest[0].weights,
          weightData: bin
        }));
        this._modelo = m;
        return m;
      })().catch(e => { this._cargando = null; throw e; });
    }
    return this._cargando;
  },

  // Devuelve probabilidades 0..1 por categoría
  async analizar(canvas224){
    const m = await this.modelo();
    const salida = tf.tidy(() => m.predict(tf.browser.fromPixels(canvas224).toFloat().div(255).reshape([1, 224, 224, 3])));
    const d = await salida.data();
    salida.dispose();
    return { dibujo: d[0], hentai: d[1], neutral: d[2], porno: d[3], sexy: d[4] };
  },

  // Criterio del filtro: se frena si es porno/hentai ≥ 50% o "sexy" ≥ 80%.
  esInapropiada(r){ return (r.porno + r.hentai) >= 0.5 || r.sexy >= 0.8; }
};

// Lee un archivo de imagen y lo dibuja (opcionalmente recortado cuadrado).
function leerImagen(file){
  return new Promise((resolve, reject) => {
    if(!file || !file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen'));
    if(file.size > 8 * 1024 * 1024) return reject(new Error('La imagen supera 8 MB'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer esa imagen')); };
    img.src = url;
  });
}

// Dibuja la imagen en un canvas. "recortar" = centrada y cuadrada (para fotos de perfil)
function dibujarImagen(img, ancho, alto, recortar){
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const ctx = c.getContext('2d');
  if(recortar){
    const lado = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, ancho, alto);
  } else {
    ctx.drawImage(img, 0, 0, ancho, alto);
  }
  return c;
}

// Pasa la imagen por el filtro; frena si detecta contenido sexual.
async function verificarFoto(img){
  let r;
  try{ r = await FiltroFotos.analizar(dibujarImagen(img, 224, 224, false)); }
  catch(e){
    console.warn('filtro de fotos', e);
    throw new Error('No pudimos revisar la foto. Revisá tu conexión y probá de nuevo.');
  }
  if(FiltroFotos.esInapropiada(r)) throw new Error('Esta foto no cumple las normas de la comunidad (desnudez o contenido sexual). Elegí otra.');
}

// Lee, revisa y comprime una foto. Perfil: 320px cuadrada (~25 KB). Evento: 800px de ancho.
// Miniatura liviana (~20-30 KB) para tarjetas y listas. La foto grande se baja solo al abrir el evento.
const LIMITE_MINI = 34000;
// Achica una imagen para la tarjeta (menos peso, menos datos).
function miniaturaDe(dataUrl, ancho = 440){
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, ancho / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      for(const q of [0.6, 0.5, 0.4, 0.3, 0.22]){
        const d = c.toDataURL('image/jpeg', q);
        if(d.length <= LIMITE_MINI) return ok(d);
      }
      mal(new Error('No se pudo achicar la foto'));
    };
    img.onerror = () => mal(new Error('No se pudo leer la foto'));
    img.src = dataUrl;
  });
}
const fotosGrandes = new Map(); // caché de la sesión: no se vuelve a bajar
// Foto grande de un evento (con caché en memoria).
async function fotoGrandeDe(ev){
  if(!ev?.fotoGrande) return null;
  if(fotosGrandes.has(ev.id)) return fotosGrandes.get(ev.id);
  try{
    const f = await DataService.getFotoGrande(ev.id);
    if(f) fotosGrandes.set(ev.id, f);
    return f;
  } catch(e){ return null; }
}
// Eventos viejos con la foto pesada adentro: su creador los pasa al formato nuevo (una sola vez)
async function migrarFotosPropias(){
  const propios = state.eventos.filter(e => e.creador === state.uid && !e.fotoGrande && typeof e.imagen === 'string' && e.imagen.length > LIMITE_MINI + 20000 && e.imagen.startsWith('data:image'));
  for(const ev of propios){
    try{
      const mini = await miniaturaDe(ev.imagen);
      await DataService.separarFoto(ev.id, ev.imagen, mini);
      fotosGrandes.set(ev.id, ev.imagen);
      ev.imagen = mini; ev.fotoGrande = true;
    } catch(e){ console.warn('migrar foto', ev.id, e); }
  }
  if(propios.length){ renderHome(); renderExplorar(); }
}

// Redimensiona y comprime una foto hasta que entre en el límite de tamaño.
async function prepararFoto(file, maxLado, cuadrada){
  const img = await leerImagen(file);
  await verificarFoto(img);
  let ancho, alto;
  if(cuadrada){ ancho = alto = Math.min(maxLado, Math.min(img.width, img.height)); }
  else { const k = Math.min(1, maxLado / img.width); ancho = Math.round(img.width * k); alto = Math.round(img.height * k); }
  const c = dibujarImagen(img, ancho, alto, cuadrada);
  const limite = cuadrada ? 60000 : 700000;
  for(const q of [0.75, 0.6, 0.45, 0.3]){
    const data = c.toDataURL('image/jpeg', q);
    if(data.length <= limite) return data;
  }
  throw new Error('La imagen es demasiado pesada');
}

// =========================================================
//  NORMAS DE LA COMUNIDAD
// =========================================================
const NORMAS = `• Sin desnudez ni contenido sexual en fotos, eventos o mensajes.
• Nada que involucre a menores de edad: Partazy es solo para mayores de 18.
• Sin violencia, discriminación, acoso ni amenazas.
• Prohibida la venta de drogas o cualquier actividad ilegal.
• Los eventos tienen que ser reales y con información correcta.
• Respetá a los anfitriones, a los lugares y al resto de la comunidad.

Todo lo que se denuncia lo revisa el equipo de moderación. El contenido que no cumpla las normas se elimina y la cuenta puede ser suspendida.`;
// Muestra las normas de la comunidad.
function verNormas(){ confirmar('Normas de la comunidad', NORMAS, 'Entendido'); }

// =========================================================
//  DENUNCIAS
// =========================================================
const UMBRAL_DENUNCIAS = 3; // con 3 denuncias, el contenido se oculta hasta que se revise
const MOTIVOS_DENUNCIA = {
  sexual: 'Desnudez o contenido sexual',
  menores: 'Involucra a menores de edad',
  violencia: 'Violencia o contenido sensible',
  odio: 'Discriminación u odio',
  acoso: 'Acoso o amenazas',
  drogas: 'Venta de drogas o actividad ilegal',
  estafa: 'Estafa o evento falso',
  suplantacion: 'Se hace pasar por otra persona',
  spam: 'Spam',
  otro: 'Otro motivo'
};

// ¿Se muestra este evento? (no bloqueado y sin demasiadas denuncias).
function eventoVisible(ev){
  if(!ev) return false;
  if(ev.creador === state.uid || state.esAdmin) return true;
  if(state.bloqueados.has(ev.creador)) return false;
  return (ev.denuncias || 0) < UMBRAL_DENUNCIAS;
}
// Todos los eventos cargados que se pueden mostrar.
function eventosVisibles(){ return state.eventos.filter(eventoVisible); }

// Abre el formulario de denuncia. obj: { tipo, objetoId, autor, titulo, extra }
function abrirDenuncia(obj){
  const bg = document.getElementById('modal-denuncia');
  document.getElementById('den-sub').textContent = obj.titulo || '';
  document.getElementById('den-motivos').innerHTML = Object.entries(MOTIVOS_DENUNCIA).map(([k, v]) =>
    `<label class="motivo"><input type="radio" name="den-motivo" value="${k}"> ${esc(v)}</label>`).join('');
  document.getElementById('den-detalle').value = '';
  const err = document.getElementById('den-error');
  err.textContent = '';
  const ok = document.getElementById('den-ok'), cancel = document.getElementById('den-cancelar');
  ok.disabled = false;
  const cerrar = () => { bg.classList.remove('show'); ok.onclick = cancel.onclick = null; };
  cancel.onclick = cerrar;
  ok.onclick = async () => {
    const motivo = document.querySelector('input[name="den-motivo"]:checked')?.value;
    if(!motivo){ err.textContent = 'Elegí un motivo.'; return; }
    ok.disabled = true;
    try{
      await DataService.denunciar({
        tipo: obj.tipo, objetoId: obj.objetoId, autor: obj.autor || '',
        motivo, detalle: document.getElementById('den-detalle').value.trim().slice(0, 500),
        ...(obj.extra || {})
      }, state.uid);
      cerrar();
      toast('Gracias por avisar. Lo vamos a revisar.');
      if((obj.tipo === 'usuario' || obj.tipo === 'mensaje') && obj.autor && !state.bloqueados.has(obj.autor)){
        setTimeout(() => bloquearUsuario(obj.autor, '¿Querés bloquear también a esta persona?'), 400);
      }
    } catch(e){
      console.warn('denuncia', e);
      err.textContent = 'No se pudo enviar. Si ya lo habías denunciado, ya lo estamos revisando.';
      ok.disabled = false;
    }
  };
  bg.classList.add('show');
}

// Abre el formulario para denunciar un evento.
function denunciarEvento(ev){
  abrirDenuncia({ tipo: 'evento', objetoId: ev.id, autor: ev.creador, titulo: ev.nombre, extra: { objetoNombre: String(ev.nombre).slice(0, 80) } });
}
// Abre el formulario para denunciar a una persona.
async function denunciarUsuario(uid){
  const u = await getUsuario(uid);
  abrirDenuncia({ tipo: 'usuario', objetoId: uid, autor: uid, titulo: nombreVisible(u), extra: { objetoNombre: nombreVisible(u).slice(0, 80) } });
}
// Denuncia un mensaje de chat.
async function denunciarMensaje(m, ambito, chatId){
  const ok = await confirmar('Denunciar mensaje', `"${String(m.texto || m.eventoNombre || '').slice(0, 140)}"`, 'Denunciar');
  if(!ok) return;
  const autor = m.de || m.uid;
  const u = await getUsuario(autor);
  abrirDenuncia({
    tipo: 'mensaje', objetoId: m.id, autor, titulo: 'Mensaje de ' + nombreVisible(u),
    extra: { objetoNombre: nombreVisible(u).slice(0, 80), texto: String(m.texto || m.eventoNombre || '').slice(0, 500), ambito, chatId }
  });
}

// =========================================================
//  BLOQUEOS
// =========================================================
async function bloquearUsuario(uid, pregunta){
  const u = await getUsuario(uid);
  const ok = await confirmar(pregunta || `Bloquear a ${nombreVisible(u)}`,
    'No va a poder mandarte solicitudes ni mensajes, y dejás de ver sus eventos. Si eran amigos, la amistad se elimina. Podés desbloquearla cuando quieras.',
    'Bloquear');
  if(!ok) return;
  try{
    await DataService.bloquear(state.uid, uid, amistad(uid)?.id || null);
    toast('Persona bloqueada');
  } catch(e){
    console.error(e);
    toast('No se pudo bloquear');
  }
}
// Quita el bloqueo a una persona.
async function desbloquearUsuario(uid){
  try{ await DataService.desbloquear(state.uid, uid); toast('Persona desbloqueada'); }
  catch(e){ console.error(e); toast('No se pudo desbloquear'); }
}
// Repinta todo después de bloquear/desbloquear.
function refrescarTrasBloqueo(){
  renderHome(); renderExplorar();
  const p = pantallaActual();
  if(p === 'amigos'){ renderAmigos(); renderResultadosPersonas(); }
  if(p === 'chats') renderChats();
  if(p === 'usuario' && state.usuarioActual) renderUsuario(state.usuarioActual);
}

// =========================================================
//  PANEL DE MODERACIÓN (solo administradores)
// =========================================================
function abrirModeracion(){
  if(!state.esAdmin) return;
  ir('moderacion');
  renderModeracion();
  renderConsultas();
}

// Agrupa las denuncias por contenido denunciado (panel de moderación).
function gruposDeReportes(){
  const grupos = new Map();
  for(const r of state.reportes){
    const k = r.tipo + '|' + r.objetoId;
    if(!grupos.has(k)) grupos.set(k, { clave: k, tipo: r.tipo, objetoId: r.objetoId, autor: r.autor, nombre: r.objetoNombre, texto: r.texto, reportes: [] });
    grupos.get(k).reportes.push(r);
  }
  return [...grupos.values()].sort((a, b) => b.reportes.length - a.reportes.length);
}

// Pinta el panel de moderación (denuncias y verificaciones).
async function renderModeracion(){
  const cont = document.getElementById('lista-reportes');
  const grupos = gruposDeReportes();
  setBadge('badge-moderacion', grupos.length + state.verifPendientes.length);
  if(pantallaActual() !== 'moderacion') return;
  renderVerificacionesAdmin();
  if(!grupos.length){ cont.innerHTML = emptyState('No hay denuncias pendientes. 🎉'); return; }
  const tok = state.tok;
  const autores = grupos.map(g => g.autor).filter(Boolean);
  await Promise.all(autores.map(getUsuario));
  if(tok !== state.tok) return;
  const TIPOS = { evento: 'Evento', usuario: 'Perfil', mensaje: 'Mensaje' };
  cont.innerHTML = grupos.map(g => {
    const conteo = {};
    g.reportes.forEach(r => { conteo[r.motivo] = (conteo[r.motivo] || 0) + 1; });
    const detalles = g.reportes.map(r => r.detalle).filter(Boolean);
    const autor = state.usuarios[g.autor];
    const suspendido = !!autor?.suspendido;
    const b = (accion, txt, clase) => `<button class="btn ${clase || 'btn-secundario'} btn-mini" data-mod="${accion}" data-grupo="${esc(g.clave)}">${txt}</button>`;
    let acciones = '';
    if(g.tipo === 'evento') acciones = `<button class="btn btn-secundario btn-mini" data-abrir="${esc(g.objetoId)}">Ver</button>${b('quitar-foto-evento', 'Quitar foto')}${b('eliminar-evento', 'Eliminar evento', 'btn-outline')}`;
    if(g.tipo === 'usuario') acciones = `<button class="btn btn-secundario btn-mini" data-usuario="${esc(g.objetoId)}">Ver perfil</button>${b('quitar-foto-usuario', 'Quitar foto')}`;
    if(g.tipo === 'mensaje') acciones = g.autor ? `<button class="btn btn-secundario btn-mini" data-usuario="${esc(g.autor)}">Ver autor</button>` : '';
    if(g.autor) acciones += suspendido ? b('reactivar', 'Reactivar cuenta') : b('suspender', 'Suspender cuenta', 'btn-outline');
    acciones += b('desestimar', 'Desestimar', 'btn-primario');
    return `<div class="reporte">
      <div class="cab"><span class="tipo">${TIPOS[g.tipo] || g.tipo}</span><span>${g.reportes.length} ${g.reportes.length === 1 ? 'denuncia' : 'denuncias'}</span></div>
      <div class="obj">${esc(g.nombre || 'Sin nombre')}</div>
      ${g.autor && g.tipo !== 'usuario' ? `<div class="cab"><span>Autor: ${esc(nombreVisible(autor))}${autor?.usuario ? ' (@' + esc(autor.usuario) + ')' : ''}${suspendido ? ' · SUSPENDIDO' : ''}</span></div>` : ''}
      ${g.texto ? `<div class="cita">${esc(g.texto)}</div>` : ''}
      <div class="tags" style="margin-top:0;">${Object.entries(conteo).map(([m, n]) => `<span class="tag no">${esc(MOTIVOS_DENUNCIA[m] || m)}${n > 1 ? ' ×' + n : ''}</span>`).join('')}</div>
      ${detalles.length ? `<div class="cita">${detalles.map(d => '“' + esc(d) + '”').join('<br>')}</div>` : ''}
      <div class="acciones-r">${acciones}</div>
    </div>`;
  }).join('');
}

// Aplica la decisión de moderación (borrar, suspender, descartar...).
async function accionModeracion(btn){
  const g = gruposDeReportes().find(x => x.clave === btn.dataset.grupo);
  if(!g) return;
  const accion = btn.dataset.mod;
  const textos = {
    'quitar-foto-evento': ['Quitar foto del evento', 'Se reemplaza por la portada de Partazy.'],
    'eliminar-evento': ['Eliminar evento', 'Se borra para siempre, para todos. No se puede deshacer.'],
    'quitar-foto-usuario': ['Quitar foto de perfil', 'La persona queda con sus iniciales.'],
    'suspender': ['Suspender cuenta', 'La persona no va a poder usar Partazy hasta que la reactives.'],
    'reactivar': ['Reactivar cuenta', 'La persona vuelve a poder usar Partazy.'],
    'desestimar': ['Desestimar denuncias', 'No se toma ninguna medida y el contenido vuelve a mostrarse.']
  };
  const [titulo, texto] = textos[accion] || ['Confirmar', ''];
  if(!(await confirmar(titulo, texto, 'Confirmar'))) return;
  btn.disabled = true;
  try{
    if(accion === 'quitar-foto-evento'){ await DataService.adminActualizarEvento(g.objetoId, { imagen: '', fotoGrande: false, denuncias: 0 }); DataService.borrarFotoGrande(g.objetoId).catch(() => {}); fotosGrandes.delete(g.objetoId); }
    if(accion === 'eliminar-evento'){ await DataService.adminEliminarEvento(g.objetoId); state.eventos = state.eventos.filter(e => e.id !== g.objetoId); }
    if(accion === 'quitar-foto-usuario') await DataService.adminActualizarUsuario(g.objetoId, { foto: '', denuncias: 0 });
    if(accion === 'suspender' || accion === 'reactivar'){
      await DataService.adminActualizarUsuario(g.autor, { suspendido: accion === 'suspender' });
      delete state.usuarios[g.autor];
    }
    if(accion === 'desestimar'){
      if(g.tipo === 'evento') await DataService.adminActualizarEvento(g.objetoId, { denuncias: 0 });
      if(g.tipo === 'usuario') await DataService.adminActualizarUsuario(g.objetoId, { denuncias: 0 });
    }
    // Reactivar no cierra las denuncias (por si se quiere tomar otra medida)
    if(accion !== 'reactivar') await DataService.resolverReportes(g.reportes.map(r => r.id), accion, state.uid);
    toast('Listo');
    renderModeracion();
  } catch(e){
    console.error(e);
    toast('No se pudo completar. Puede que ese contenido ya no exista.');
    btn.disabled = false;
  }
}

// Pantalla para cuentas suspendidas.
function mostrarSuspendido(){
  ir('suspendido');
  document.getElementById('app').classList.add('sin-nav');
  ocultarLoader();
}

// =========================================================
//  NOTIFICACIONES
//  notificaciones/{destinatario}/items/{id}: las crea quien hace la acción
//  (el plan gratuito no tiene funciones en el servidor). Solo el destinatario las lee.
// =========================================================
const TIPOS_NOTIF = {
  amistad_solicitud:      { icono: '👋', texto: n => `${n.deNombre} te mandó una solicitud de amistad`, ir: () => abrirAmigos() },
  amistad_aceptada:       { icono: '🤝', texto: n => `${n.deNombre} aceptó tu solicitud de amistad`, ir: n => abrirUsuario(n.de) },
  evento_solicitud:       { icono: '🔐', texto: n => `${n.deNombre} pidió unirse a ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  evento_aprobada:        { icono: '✅', texto: n => `Te aprobaron en ${n.objetoNombre}. Ya podés ver la dirección y tu entrada.`, ir: n => abrirDetalle(n.objetoId) },
  evento_rechazada:       { icono: '❌', texto: n => `Tu solicitud para ${n.objetoNombre} no fue aceptada`, ir: n => abrirDetalle(n.objetoId) },
  evento_cancelado:       { icono: '🚫', texto: n => `Se canceló ${n.objetoNombre}${n.texto ? ': ' + n.texto : ''}`, ir: n => abrirDetalle(n.objetoId) },
  evento_confirmacion:    { icono: '🎟️', texto: n => `${n.deNombre} confirmó asistencia a ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  verificacion_aprobada:  { icono: '✔️', texto: () => '¡Tu organización fue verificada! Tu perfil y tus eventos ya muestran la insignia ✓.', ir: () => ir('perfil') },
  mensaje_solicitud:      { icono: '✉️', texto: n => `${n.deNombre} te mandó una solicitud de mensaje`, ir: n => abrirDM(n.de) },
  mensaje_aceptado:       { icono: '💬', texto: n => `${n.deNombre} aceptó tu solicitud de mensaje`, ir: n => abrirDM(n.de) },
  amigo_evento:           { icono: '🎉', texto: n => `${n.deNombre} publicó ${n.objetoNombre}. ¿Vas?`, ir: n => abrirDetalle(n.objetoId) },
  evento_compartido:      { icono: '🔁', texto: n => `${n.deNombre} compartió ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  mencion:                { icono: '👉', texto: n => `${n.deNombre} te mencionó en ${n.objetoNombre}${n.texto ? ': ' + n.texto : ''}`, ir: n => abrirDetalle(n.objetoId) },
  nuevo_evento:           { icono: '📣', texto: n => `${n.deNombre} publicó una fecha nueva: ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  acreditacion_solicitud: { icono: '📰', texto: n => `${n.deNombre}${n.texto ? ' (' + n.texto + ')' : ''} pidió acreditación de prensa para ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  acreditacion_aprobada:  { icono: '✅', texto: n => `Aprobaron tu acreditación de prensa para ${n.objetoNombre}`, ir: n => abrirDetalle(n.objetoId) },
  acreditacion_rechazada: { icono: '📰', texto: n => `Tu acreditación de prensa para ${n.objetoNombre} no fue aprobada`, ir: n => abrirDetalle(n.objetoId) },
  verificacion_rechazada: { icono: 'ℹ️', texto: n => `No pudimos verificar tu organización${n.texto ? ': ' + n.texto : ''}. Podés volver a pedirlo.`, ir: () => abrirVerificacion() }
};

// Cómo se agrupan en la pantalla de notificaciones (en este orden)
const GRUPOS_NOTIF = [['solicitudes', 'Solicitudes'], ['amigos', 'Amigos'], ['seguidos', 'Seguidos'], ['eventos', 'Tus eventos']];
const GRUPO_NOTIF = {
  amistad_solicitud: 'solicitudes', evento_solicitud: 'solicitudes', mensaje_solicitud: 'solicitudes', acreditacion_solicitud: 'solicitudes',
  amigo_evento: 'amigos', evento_compartido: 'amigos', mencion: 'amigos', amistad_aceptada: 'amigos', mensaje_aceptado: 'amigos',
  nuevo_evento: 'seguidos',
  evento_aprobada: 'eventos', evento_rechazada: 'eventos', evento_cancelado: 'eventos', evento_confirmacion: 'eventos',
  acreditacion_aprobada: 'eventos', acreditacion_rechazada: 'eventos', verificacion_aprobada: 'eventos', verificacion_rechazada: 'eventos'
};
// Avisar a otra persona. Nunca frena la acción principal: si falla, solo queda en la consola.
async function notificar(destUid, tipo, datos = {}){
  if(!destUid || destUid === state.uid || !state.perfil) return;
  try{
    await DataService.crearNotificacion(destUid, {
      tipo, de: state.uid,
      deNombre: nombreVisible(state.perfil).slice(0, 60),
      objetoId: String(datos.objetoId || ''),
      objetoNombre: String(datos.objetoNombre || '').slice(0, 80),
      texto: String(datos.texto || '').slice(0, 200),
      leida: false, ts: Date.now()
    });
  } catch(e){ console.warn('notificación', tipo, e); }
}

// Numerito de notificaciones sin leer.
function actualizarBadgeNotif(){
  setBadge('badge-notif', state.notificaciones.filter(n => !n.leida).length);
}

// Abre la pantalla de notificaciones (y las marca como leídas).
function abrirNotificaciones(){
  state.notifResaltadas = new Set();
  state.filtroNotif = 'todas';
  ir('notificaciones', { abrir: abrirNotificaciones });
  renderNotificaciones(true);
}

// ¿Dos fechas caen el mismo día?
function esMismoDia(a, b){ return new Date(a).toDateString() === new Date(b).toDateString(); }

// Pinta notificaciones agrupadas (Solicitudes, Amigos, Seguidos, Tus eventos) + recordatorios.
async function renderNotificaciones(marcarLeidas){
  const cont = document.getElementById('lista-notificaciones');
  const tok = state.tok;
  // Las no leídas se resaltan mientras la pantalla está abierta, aunque ya se marquen como leídas
  state.notificaciones.filter(n => !n.leida).forEach(n => state.notifResaltadas.add(n.id));

  // Recordatorios: eventos con entrada que empiezan en las próximas 24 h (se calculan, no se guardan)
  let recordatorios = [];
  try{
    const ahora = Date.now();
    recordatorios = (await proximasEntradas()).filter(e => !esCancelado(e) && e.fechaTs > ahora - 3 * HORA && e.fechaTs - ahora < 24 * HORA);
  } catch(e){ console.warn('recordatorios', e); }
  await Promise.all([...new Set(state.notificaciones.map(n => n.de))].map(getUsuario));
  if(tok !== state.tok) return;

  const htmlRec = recordatorios.map(e => `
    <div class="notif recordatorio" data-abrir="${esc(e.id)}" role="button" tabindex="0">
      <div class="ico">⏰</div>
      <div class="cuerpo">${esMismoDia(e.fechaTs, Date.now()) ? 'Hoy' : 'Mañana'}: <b>${esc(e.nombre)}</b> a las ${esc(horaCorta(e.fechaTs))} hs
        <span class="cuando">Tu entrada está en "Mis entradas"</span></div>
    </div>`).join('');
  const htmlDe = n => {
    const t = TIPOS_NOTIF[n.tipo];
    const u = state.usuarios[n.de];
    const ico = u && fotoValida(u.foto) && (n.tipo.startsWith('amistad') || GRUPO_NOTIF[n.tipo] === 'amigos') ? avatarHTML(u) : t.icono;
    return `<div class="notif ${state.notifResaltadas.has(n.id) ? 'nueva' : ''}" data-notif="${esc(n.id)}" role="button" tabindex="0">
      <div class="ico">${ico}</div>
      <div class="cuerpo">${esc(t.texto(n))}<span class="cuando">${esc(hace(n.ts))}</span></div>
    </div>`;
  };
  const validas = state.notificaciones.filter(n => TIPOS_NOTIF[n.tipo] && !state.bloqueados.has(n.de)).sort((a, b) => b.ts - a.ts);
  const porGrupo = {};
  validas.forEach(n => (porGrupo[GRUPO_NOTIF[n.tipo] || 'eventos'] = porGrupo[GRUPO_NOTIF[n.tipo] || 'eventos'] || []).push(n));
  if(recordatorios.length) porGrupo.eventos = porGrupo.eventos || [];
  const filtro = state.filtroNotif || 'todas';
  // Chips: Todas · Solicitudes · Amigos · Seguidos · Tus eventos (con cuántas nuevas hay)
  const nuevas = g => (porGrupo[g] || []).filter(n => state.notifResaltadas.has(n.id)).length;
  document.getElementById('chips-notif').innerHTML = [['todas', 'Todas'], ...GRUPOS_NOTIF.filter(([g]) => porGrupo[g])]
    .map(([g, nombre]) => `<div class="chip ${filtro === g ? 'activo' : ''}" role="button" tabindex="0" onclick="state.filtroNotif='${g}'; renderNotificaciones(false)">${nombre}${g !== 'todas' && nuevas(g) ? `<span class="n">${nuevas(g)}</span>` : ''}</div>`).join('');
  document.getElementById('chips-notif').style.display = Object.keys(porGrupo).length > 1 ? '' : 'none';
  const seccion = g => {
    const lista = porGrupo[g] || [];
    const extra = g === 'eventos' ? htmlRec : '';
    if(!lista.length && !extra) return '';
    const titulo = GRUPOS_NOTIF.find(x => x[0] === g)[1];
    return `<div class="grupo-notif">${titulo}${nuevas(g) ? `<span class="n">${nuevas(g)} ${nuevas(g) === 1 ? 'nueva' : 'nuevas'}</span>` : ''}</div>` + extra + lista.map(htmlDe).join('');
  };
  const html = filtro === 'todas' ? GRUPOS_NOTIF.map(([g]) => seccion(g)).join('') : seccion(filtro);
  cont.innerHTML = html ||
    emptyState('No tenés notificaciones todavía. Acá vas a ver solicitudes, lo que publican tus amigos, las fechas de quienes seguís y novedades de tus eventos.');

  if(marcarLeidas){
    const ids = state.notificaciones.filter(n => !n.leida).map(n => n.id);
    if(ids.length) DataService.marcarNotificacionesLeidas(state.uid, ids).catch(e => console.warn('leídas', e));
  }
}

// Lleva a lo que corresponde al tocar una notificación.
function abrirNotificacion(id){
  const n = state.notificaciones.find(x => x.id === id);
  const t = n && TIPOS_NOTIF[n.tipo];
  if(t) t.ir(n);
}

// =========================================================
//  CUENTAS DE ORGANIZACIÓN Y VERIFICACIÓN
// =========================================================
const RUBROS = ['Boliche', 'Bar', 'Productora', 'Centro de estudiantes', 'DJ / Artista', 'Salón de fiestas', 'Otro'];
const SVG_CHECK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
// Tilde verde ✓ de cuenta verificada.
function insignia(u){ return u?.verificado ? `<span class="ins-verif" title="Cuenta verificada" aria-label="Cuenta verificada">${SVG_CHECK}</span>` : ''; }
// ¿Es una cuenta de organización (boliche, productora...)?
function esOrganizacion(u){ return u?.tipoCuenta === 'organizacion'; }

// Selector Persona / Organizador (registro y edición de perfil)
function elegirTipoCuenta(contId, tipo){
  const cont = document.getElementById(contId);
  cont.querySelectorAll('[data-tipo-cuenta]').forEach(op => op.classList.toggle('activo', op.dataset.tipoCuenta === tipo));
  const pref = contId.split('-')[0]; // "rg" o "ep"
  const org = tipo === 'organizacion';
  const label = document.querySelector(`label[for="${pref}-nombre"]`);
  if(label) label.textContent = org ? 'Nombre de la organización' : (pref === 'rg' ? 'Nombre y apellido' : 'Nombre');
  const apodo = document.getElementById(pref + '-apodo');
  if(apodo) apodo.closest('.campo').style.display = org ? 'none' : '';
  const bloqueOrg = document.getElementById(pref + '-org');
  if(bloqueOrg) bloqueOrg.style.display = org ? 'flex' : 'none';
  const ints = document.getElementById(pref + '-intereses');
  if(ints) renderSelectorIntereses(pref + '-intereses', interesesElegidos(pref + '-intereses'), org);
  const nom = document.getElementById(pref + '-nombre'); if(nom) nom.maxLength = org ? 40 : 60;
  const ayuda = document.getElementById(pref + '-tipo-ayuda');
  if(ayuda) ayuda.textContent = org
    ? 'Para boliches, bares, productoras, centros de estudiantes y DJs. Después podés pedir la verificación ✓ desde tu perfil.'
    : 'Para salir, conocer gente y asistir o armar previas.';
}
// Lee si se eligió Persona u Organizador.
function tipoCuentaElegido(contId){
  return document.querySelector(`#${contId} [data-tipo-cuenta].activo`)?.dataset.tipoCuenta || 'persona';
}

// Tarjeta del perfil para pedir la insignia ✓ o ver el estado.
function renderTarjetaVerificacion(){
  const cont = document.getElementById('perfil-verificacion');
  if(!cont) return;
  const p = state.perfil;
  if(!esOrganizacion(p)){
    // Acceso visible para quienes organizan: pasar a cuenta de organizador
    cont.innerHTML = `<div class="tarjeta-verif">
      <b>🎪 ¿Organizás eventos?</b>
      <span>Si sos boliche, bar, productora, centro de estudiantes o DJ, pasá a cuenta de organizador: vas a poder dar entradas con QR y pedir la insignia de verificado ✓.</span>
      <button class="btn btn-secundario" onclick="pasarAOrganizador()">Pasar a cuenta de organizador</button>
    </div>`;
    return;
  }
  const v = state.verificacion;
  let html;
  if(p.verificado){
    html = `<b style="color:var(--verde);">✓ Organización verificada</b><span>Tu perfil y tus eventos muestran la insignia de verificado.</span>`;
  } else if(v?.estado === 'pendiente'){
    html = `<b>⏳ Verificación en revisión</b><span>Recibimos tu solicitud el ${esc(fmtFecha(v.ts).split(' · ')[0])}. Te avisamos con una notificación cuando esté lista.</span>
      <button class="btn btn-secundario btn-mini" onclick="abrirVerificacion()">Ver o corregir mis datos</button>`;
  } else if(v?.estado === 'rechazada'){
    html = `<b>No pudimos verificar tu organización</b><span>${esc(v.motivoRechazo || 'Revisá los datos y volvé a intentarlo.')}</span>
      <button class="btn btn-primario" onclick="abrirVerificacion()">Volver a pedir la verificación</button>`;
  } else {
    html = `<b>Verificá tu organización</b><span>La insignia ✓ muestra que tu organización es real y les da más confianza a quienes van a tus eventos.</span>
      <button class="btn btn-primario" onclick="abrirVerificacion()">Pedir verificación</button>`;
  }
  cont.innerHTML = `<div class="tarjeta-verif">${html}</div>`;
}

// Abre la edición del perfil con "Organizador" ya elegido
function pasarAOrganizador(){
  editarPerfil();
  elegirTipoCuenta('ep-tipo', 'organizacion');
  document.getElementById('pantalla-perfil').scrollTop = 0;
  toast('Completá el nombre de la organización y tocá "Guardar cambios"');
}

// Abre el formulario de verificación.
function abrirVerificacion(){
  ir('verificacion');
  const v = state.verificacion || {};
  const p = state.perfil || {};
  const set = (id, val) => { document.getElementById(id).value = val || ''; };
  set('vf-nombre', v.nombreOrg || p.nombre);
  set('vf-rubro', v.rubro || '');
  set('vf-instagram', v.instagram);
  set('vf-web', v.web);
  set('vf-telefono', v.telefono);
  set('vf-email', v.emailContacto || state.email);
  set('vf-direccion', v.direccion || p.ciudad);
  set('vf-cuit', v.cuit);
  set('vf-comentario', v.comentario);
  document.getElementById('vf-error').textContent = '';
  const yaVerificada = !!p.verificado;
  document.getElementById('verif-form').style.display = yaVerificada ? 'none' : 'flex';
  document.getElementById('verif-estado').innerHTML = yaVerificada
    ? `<div class="tarjeta-verif"><b>✓ Tu organización ya está verificada</b></div>`
    : (v.estado === 'rechazada' ? `<div class="tarjeta-verif"><b>Motivo del rechazo anterior</b><span>${esc(v.motivoRechazo || 'Sin detalle')}</span></div>` : '');
}

// Valida y manda el pedido de verificación.
async function enviarVerificacion(){
  const val = id => document.getElementById(id).value.trim();
  const err = m => { document.getElementById('vf-error').textContent = m; };
  const datos = {
    nombreOrg: val('vf-nombre').slice(0, 80),
    rubro: val('vf-rubro'),
    instagram: val('vf-instagram').slice(0, 100),
    web: val('vf-web').slice(0, 150),
    telefono: val('vf-telefono').slice(0, 30),
    emailContacto: val('vf-email').slice(0, 100),
    direccion: val('vf-direccion').slice(0, 150),
    cuit: val('vf-cuit').slice(0, 20),
    comentario: val('vf-comentario').slice(0, 500)
  };
  if(datos.nombreOrg.length < 2) return err('Escribí el nombre de la organización.');
  if(!RUBROS.includes(datos.rubro)) return err('Elegí el rubro.');
  if(!datos.instagram && !datos.web) return err('Agregá tu Instagram o tu página web, así podemos comprobar que la organización es real.');
  if(datos.telefono.replace(/\D/g, '').length < 6) return err('Escribí un teléfono de contacto.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.emailContacto)) return err('Escribí un email de contacto válido.');
  err('');
  const btn = document.getElementById('btn-enviar-verif');
  btn.disabled = true;
  try{
    await DataService.pedirVerificacion(state.uid, datos);
    state.verificacion = { ...datos, uid: state.uid, estado: 'pendiente', ts: Date.now() };
    toast('Solicitud enviada. Te avisamos cuando esté revisada.');
    ir('perfil');
    renderTarjetaVerificacion();
  } catch(e){
    console.error(e);
    err('No se pudo enviar. Probá de nuevo.');
  } finally {
    btn.disabled = false;
  }
}

// ---------- Panel de moderación: pedidos de verificación ----------
async function renderVerificacionesAdmin(){
  const cont = document.getElementById('lista-verificaciones');
  const titulo = document.getElementById('titulo-verificaciones');
  if(!cont) return;
  const lista = state.verifPendientes.slice().sort((a, b) => a.ts - b.ts);
  titulo.style.display = lista.length ? '' : 'none';
  if(!lista.length){ cont.innerHTML = ''; return; }
  await Promise.all(lista.map(v => getUsuario(v.uid)));
  const fila = (k, v) => v ? `<div><span style="color:var(--gris);">${k}:</span> ${esc(v)}</div>` : '';
  cont.innerHTML = lista.map(v => {
    const u = state.usuarios[v.uid];
    return `<div class="reporte">
      <div class="cab"><span class="tipo">Verificación · ${esc(v.rubro)}</span><span>${esc(hace(v.ts))}</span></div>
      <div class="obj">${esc(v.nombreOrg)}</div>
      <div class="cab"><span>Cuenta: ${esc(nombreVisible(u))}${u?.usuario ? ' (@' + esc(u.usuario) + ')' : ''}</span></div>
      <div class="cita">
        ${fila('Instagram', v.instagram)}${fila('Web', v.web)}${fila('Teléfono', v.telefono)}${fila('Email', v.emailContacto)}
        ${fila('Dirección', v.direccion)}${fila('CUIT', v.cuit)}${fila('Comentario', v.comentario)}
      </div>
      <div class="acciones-r">
        <button class="btn btn-secundario btn-mini" data-usuario="${esc(v.uid)}">Ver perfil</button>
        <button class="btn btn-outline btn-mini" data-verif="rechazar" data-uid="${esc(v.uid)}">Rechazar</button>
        <button class="btn btn-primario btn-mini" data-verif="aprobar" data-uid="${esc(v.uid)}">Aprobar ✓</button>
      </div>
    </div>`;
  }).join('');
}

// Admins: aprueba o rechaza una verificación.
async function accionVerificacion(btn){
  const uid = btn.dataset.uid;
  const v = state.verifPendientes.find(x => x.uid === uid);
  if(!v) return;
  const aprobar = btn.dataset.verif === 'aprobar';
  let motivo = '';
  if(aprobar){
    if(!(await confirmar('Aprobar verificación', `${v.nombreOrg} va a mostrar la insignia ✓ en su perfil y en todos sus eventos.`, 'Aprobar'))) return;
  } else {
    motivo = await pedirTexto('Rechazar verificación', 'Contale a la organización por qué no se aprobó, así puede corregirlo.', 'Motivo (ej: no pudimos comprobar el Instagram)', 'Rechazar');
    if(motivo === null) return;
  }
  btn.disabled = true;
  try{
    await DataService.resolverVerificacion(uid, aprobar, motivo, state.uid);
    if(aprobar) state.eventos.forEach(e => { if(e.creador === uid) e.verificado = true; });
    if(state.usuarios[uid]) state.usuarios[uid].verificado = aprobar || state.usuarios[uid].verificado;
    notificar(uid, aprobar ? 'verificacion_aprobada' : 'verificacion_rechazada', { texto: motivo });
    toast(aprobar ? 'Organización verificada' : 'Verificación rechazada');
  } catch(e){
    console.error(e);
    toast('No se pudo completar');
    btn.disabled = false;
  }
}

// =========================================================
//  ENLACES EXTERNOS (Instagram, web, mapas, venta de entradas)
// =========================================================
function linkInstagram(v){
  const h = String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? { url: 'https://instagram.com/' + h, texto: '@' + h } : null;
}
// Valida un link (solo http/https) y devuelve URL + dominio para mostrar.
function linkWeb(v, soloHttps){
  const s = String(v || '').trim();
  if(!s) return null;
  try{
    const x = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s);
    if(x.protocol !== 'https:' && (soloHttps || x.protocol !== 'http:')) return null;
    return { url: x.href, texto: x.hostname.replace(/^www\./, '') };
  } catch(e){ return null; }
}
// Link de Google Maps con indicaciones para llegar a una dirección.
function urlMaps(lugar, ciudad){
  const l = String(lugar || '');
  const q = l + (ciudad && !normalizar(l).includes(normalizar(ciudad)) ? ', ' + ciudad : '') + (/argentina/i.test(l) ? '' : ', Argentina');
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
}
// Link que abre en otra pestaña.
function aExterno(url, texto){
  return `<a class="link-ext" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(texto)} ↗</a>`;
}
// Abre un link externo en otra pestaña.
function abrirExterno(url){ window.open(url, '_blank', 'noopener'); }

// =========================================================
//  EVENTOS: line-up, cupo, clasificación
// =========================================================
function lineupItems(texto){
  return String(texto || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20).map(l => {
    const m = l.match(/^(\d{1,2}[:.]\d{2})\s*[-–·]?\s*(.+)$/);
    return m ? { hora: m[1].replace('.', ':'), nombre: m[2] } : { hora: '', nombre: l };
  });
}
// "Últimas entradas" desde el 85 % del cupo; "Agotado" al llenarse
function estadoCupo(ev){
  if(esCancelado(ev)) return null;
  const cupo = ev.confirmadosCount || 0, cap = Math.max(1, ev.capacidad || 1);
  if(cupo >= cap) return { clase: 'agotado', texto: 'Agotado' };
  if(cupo / cap >= 0.85) return { clase: 'ultimas', texto: 'Últimas entradas' };
  return null;
}
// "ATP (todo público)" o "+18 años".
function clasificacion(ev){ return Number(ev.edadMinima) === 0 ? 'ATP (todo público)' : `+${ev.edadMinima ?? 18} años`; }
// Fecha y horario, con hora de cierre si hay.
function horarioEvento(ev){ return fmtFecha(ev.fechaTs) + (ev.horaFin ? ` a ${ev.horaFin}` : '') + ' hs'; }

// =========================================================
//  ORGANIZACIONES: página pública y seguidores
// =========================================================
async function estoySiguiendo(orgUid){
  if(state.sigo[orgUid] === undefined) state.sigo[orgUid] = await DataService.siguiendo(orgUid, state.uid);
  return state.sigo[orgUid];
}
// Botón Seguir / Siguiendo de una organización.
async function alternarSeguir(btn){
  const org = btn.dataset.seguir;
  const sigo = await estoySiguiendo(org);
  btn.disabled = true;
  try{
    if(sigo) await DataService.dejarDeSeguir(org, state.uid);
    else await DataService.seguir(org, state.uid);
    state.sigo[org] = !sigo;
    if(state.usuarios[org]) state.usuarios[org].seguidores = Math.max(0, (state.usuarios[org].seguidores || 0) + (sigo ? -1 : 1));
    toast(sigo ? 'Dejaste de seguir' : 'Ahora seguís esta organización: te avisamos cuando publique fechas nuevas');
    renderUsuario(org);
  } catch(e){
    console.error(e);
    toast('No se pudo completar');
    btn.disabled = false;
  }
}
// Al publicar una fecha, la organización avisa a sus seguidores
async function avisarSeguidores(eventoId, nombre){
  try{
    const fans = await DataService.listarFans(state.uid);
    await Promise.all(fans.map(uid => notificar(uid, 'nuevo_evento', { objetoId: eventoId, objetoNombre: nombre })));
    return fans;
  } catch(e){ console.warn('avisar seguidores', e); return []; }
}
// Abre mi página pública (organizaciones).
function verMiPagina(){
  state.usuarioActual = state.uid;
  ir('usuario', { clave: 'usuario:yo', abrir: verMiPagina });
  renderUsuario(state.uid);
}

// Bloques de la página de una organización (se insertan en el perfil público)
function bloquesOrganizacion(u){
  const ig = linkInstagram(u.instagram), web = linkWeb(u.web);
  const filas = [
    u.direccionPublica ? `<div class="info-fila"><span>📍</span><div><b>${esc(u.direccionPublica)}</b>${aExterno(urlMaps(u.direccionPublica), 'Cómo llegar')}</div></div>` : '',
    u.horarios ? `<div class="info-fila"><span>🕒</span><div>${esc(u.horarios)}</div></div>` : '',
    ig ? `<div class="info-fila"><span>📸</span><div>${aExterno(ig.url, ig.texto)}</div></div>` : '',
    web ? `<div class="info-fila"><span>🌐</span><div>${aExterno(web.url, web.texto)}</div></div>` : ''
  ].join('');
  const faq = (Array.isArray(u.faq) ? u.faq : []).filter(x => x && x.p && x.r);
  return `
    ${u.bio ? `<div style="padding:0 20px 18px;"><p class="texto-desc">${esc(u.bio)}</p></div>` : ''}
    ${filas ? `<div class="subtitulo"><h3 class="titulo-bloque">Info útil</h3></div><div class="info-util">${filas}</div>` : ''}
    ${faq.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Preguntas frecuentes</h3></div>
      <div class="lista-faq">${faq.map(x => `<details class="faq"><summary>${esc(x.p)}</summary><p>${esc(x.r)}</p></details>`).join('')}</div>` : ''}`;
}

// Edición de la info de organización (5 preguntas frecuentes como máximo)
const MAX_FAQ = 5;
// Llena los campos extra de organización al editar el perfil.
function pintarCamposOrg(p){
  document.getElementById('ep-bio').value = p.bio || '';
  document.getElementById('ep-dir-pub').value = p.direccionPublica || '';
  document.getElementById('ep-horarios').value = p.horarios || '';
  document.getElementById('ep-instagram').value = p.instagram || '';
  document.getElementById('ep-web').value = p.web || '';
  const faq = Array.isArray(p.faq) ? p.faq : [];
  for(let i = 0; i < MAX_FAQ; i++){
    document.getElementById('ep-faq-p' + i).value = faq[i]?.p || '';
    document.getElementById('ep-faq-r' + i).value = faq[i]?.r || '';
  }
}
// Lee los campos extra de organización del formulario.
function leerCamposOrg(){
  const v = id => document.getElementById(id).value.trim();
  const faq = [];
  for(let i = 0; i < MAX_FAQ; i++){
    const p = v('ep-faq-p' + i).slice(0, 120), r = v('ep-faq-r' + i).slice(0, 400);
    if(p && r) faq.push({ p, r });
  }
  return {
    bio: v('ep-bio').slice(0, 300),
    direccionPublica: v('ep-dir-pub').slice(0, 150),
    horarios: v('ep-horarios').slice(0, 200),
    instagram: v('ep-instagram').slice(0, 60),
    web: v('ep-web').slice(0, 150),
    faq
  };
}

// =========================================================
//  CONTROL DE PUERTA (solo quien organiza)
//  Cada código se valida una sola vez: el ingreso se guarda con una transacción.
// =========================================================
const URL_ESCANER = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
const Puerta = { ev: null, asistentes: [], escaner: null };

// Pantalla de control de puerta (escanear QR o buscar por nombre).
async function abrirPuerta(ev){
  Puerta.ev = ev;
  ir('puerta', { clave: 'puerta:' + ev.id, abrir: () => abrirPuerta(ev) });
  document.getElementById('puerta-evento').textContent = `${ev.nombre} · ${horarioEvento(ev)}`;
  document.getElementById('puerta-resultado').innerHTML = '';
  document.getElementById('puerta-codigo').value = '';
  document.getElementById('btn-escanear').style.display = ev.conQR ? '' : 'none';
  document.getElementById('puerta-campo-codigo').style.display = ev.conQR ? '' : 'none';
  document.getElementById('puerta-ayuda').textContent = ev.conQR
    ? 'Escaneá el QR de cada entrada o escribí el código. Cada código se valida una sola vez.'
    : 'Este evento no usa QR: buscá a la persona en la lista y marcá su ingreso.';
  await cargarPuerta();
}
// Carga la lista de anotados para el control de puerta.
async function cargarPuerta(){
  try{
    Puerta.asistentes = (await DataService.listarAsistentes(Puerta.ev.id))
      .filter(a => a.estado === 'confirmado' || a.estado === 'aprobado')
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    renderPuerta();
  } catch(e){
    console.warn('puerta', e);
    document.getElementById('puerta-lista').innerHTML = emptyState('No se pudo cargar la lista.');
  }
}
// Pinta la lista de la puerta con quién ya ingresó.
function renderPuerta(){
  const total = Puerta.asistentes.length, adentro = Puerta.asistentes.filter(a => a.checkinTs).length;
  document.getElementById('puerta-contador').innerHTML = `<b>${adentro}</b><span>de ${total} ingresaron</span>`;
  document.getElementById('puerta-lista').innerHTML = total ? Puerta.asistentes.map(a => `
    <div class="solicitud">
      <div class="avatar">${esc(inicialesDe(a.nombre))}</div>
      <div class="nom">${esc(a.nombre)}<small>${a.checkinTs ? '✓ Ingresó ' + esc(horaCorta(a.checkinTs)) : 'Todavía no ingresó'}${Puerta.ev.conQR && a.ticket ? ' · ' + esc(a.ticket) : ''}</small></div>
      ${a.checkinTs ? '<span class="tag si">Adentro</span>' : `<button class="btn btn-secundario btn-mini" data-checkin="${esc(a.uid)}">Marcar ingreso</button>`}
    </div>`).join('') : emptyState('Todavía no hay confirmados.');
}
// Cartel de resultado al validar (puede pasar / ya ingresó / no válido).
function resultadoPuerta(tipo, texto){
  const el = document.getElementById('puerta-resultado');
  el.className = 'puerta-resultado ' + tipo;
  el.textContent = texto;
}
// Valida un código de entrada escaneado o tipeado.
async function validarCodigo(texto){
  let t = String(texto || '').trim(), eventoId = Puerta.ev.id;
  const m = t.match(/^PARTAZY\|([^|]+)\|(.+)$/);
  if(m){ eventoId = m[1]; t = m[2]; }
  if(!t) return resultadoPuerta('mal', 'Escribí un código.');
  if(eventoId !== Puerta.ev.id) return resultadoPuerta('mal', '✗ Esta entrada es de otro evento.');
  const a = Puerta.asistentes.find(x => String(x.ticket || '').toUpperCase() === t.toUpperCase());
  if(!a) return resultadoPuerta('mal', '✗ Código no válido: no corresponde a ninguna entrada de este evento.');
  await registrarIngreso(a);
}
// Marca que la persona ingresó (una sola vez).
async function registrarIngreso(a){
  if(a.checkinTs) return resultadoPuerta('aviso', `⚠ ${a.nombre} ya ingresó a las ${horaCorta(a.checkinTs)}. Cada código se valida una sola vez.`);
  try{
    a.checkinTs = await DataService.registrarIngreso(Puerta.ev.id, a.uid);
    resultadoPuerta('ok', `✓ Puede pasar: ${a.nombre}`);
    if(navigator.vibrate) navigator.vibrate(90);
  } catch(e){
    if(e.message === 'YA_INGRESO'){
      await cargarPuerta();
      const b = Puerta.asistentes.find(x => x.uid === a.uid);
      return resultadoPuerta('aviso', `⚠ ${a.nombre} ya ingresó${b?.checkinTs ? ' a las ' + horaCorta(b.checkinTs) : ''}. Cada código se valida una sola vez.`);
    }
    console.error(e);
    resultadoPuerta('mal', 'No se pudo registrar el ingreso. Probá de nuevo.');
  }
  renderPuerta();
}
// Prende o apaga la cámara para escanear QR.
async function alternarEscaner(){
  if(Puerta.escaner){ await detenerEscaner(); return; }
  const cam = document.getElementById('puerta-camara');
  try{
    if(!window.Html5Qrcode) await FiltroFotos.cargarScript(URL_ESCANER);
    cam.style.display = 'block';
    Puerta.escaner = new Html5Qrcode('puerta-camara');
    let ultimo = '', ultimoTs = 0;
    await Puerta.escaner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, texto => {
      const ahora = Date.now();
      if(texto === ultimo && ahora - ultimoTs < 3000) return; // el mismo QR frente a la cámara
      ultimo = texto; ultimoTs = ahora;
      validarCodigo(texto);
    });
    document.getElementById('btn-escanear').textContent = 'Detener cámara';
  } catch(e){
    console.warn('cámara', e);
    Puerta.escaner = null;
    cam.style.display = 'none';
    resultadoPuerta('mal', 'No pudimos usar la cámara. Revisá los permisos del navegador o escribí el código a mano.');
  }
}
// Apaga la cámara del escáner.
async function detenerEscaner(){
  try{ if(Puerta.escaner){ await Puerta.escaner.stop(); Puerta.escaner.clear(); } } catch(e){}
  Puerta.escaner = null;
  const cam = document.getElementById('puerta-camara');
  if(cam) cam.style.display = 'none';
  const b = document.getElementById('btn-escanear');
  if(b) b.textContent = '📷 Escanear QR';
}

// =========================================================
//  ACREDITACIONES DE PRENSA (eventos de organizaciones, hasta 24 h antes)
// =========================================================
const ROLES_PRENSA = ['Periodista', 'Fotografía', 'Video', 'Streaming / redes', 'Otro'];
// ¿Todavía se puede pedir acreditación de prensa? (hasta 24 h antes).
function acreditacionAbierta(ev){ return ev.fechaTs - Date.now() > 24 * HORA; }

// Bloque de prensa del detalle (pedir o ver pedidos).
function bloquePrensaHTML(ev, esCreador, miAcred){
  if(!ev.deOrganizacion || esCancelado(ev)) return '';
  if(esCreador) return `<div class="bloque">
      <h3 class="titulo-bloque">📰 Prensa</h3>
      <div class="lista-solicitudes" id="lista-prensa"><div class="empty-state">Cargando...</div></div>
    </div>`;
  let cuerpo;
  if(miAcred?.estado === 'aprobada') cuerpo = `<div class="aviso"><b>✓ Acreditación aprobada</b><span>Estás en la lista de prensa como ${esc(miAcred.medio)}. Presentate en la puerta con tu DNI.</span></div>`;
  else if(miAcred?.estado === 'pendiente') cuerpo = `<div class="aviso"><b>⏳ Acreditación en revisión</b><span>Te avisamos con una notificación cuando la organización responda.</span></div>`;
  else if(miAcred?.estado === 'rechazada') cuerpo = `<div class="aviso aviso-rojo"><b>Acreditación no aprobada</b><span>Esta vez la organización no pudo aprobar tu acreditación.</span></div>`;
  else if(!acreditacionAbierta(ev)) cuerpo = `<span style="font-size:12.5px; color:var(--gris);">Las acreditaciones de prensa cierran 24 h antes del evento.</span>`;
  else cuerpo = `<button class="btn btn-secundario" id="btn-acreditacion">📰 Pedir acreditación de prensa</button>
      <span style="display:block; font-size:11.5px; color:var(--gris); margin-top:8px;">Hasta 24 h antes. La aprobación depende de la organización.</span>`;
  return `<div class="bloque">${cuerpo}</div>`;
}

// Formulario de pedido de acreditación.
function pedirAcreditacion(ev){
  const bg = document.getElementById('modal-acred');
  const err = document.getElementById('ac-error');
  ['ac-medio', 'ac-link', 'ac-comentario'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('ac-rol').value = '';
  document.getElementById('ac-sub').textContent = ev.nombre;
  err.textContent = '';
  const ok = document.getElementById('ac-ok'), cancel = document.getElementById('ac-cancelar');
  ok.disabled = false;
  const cerrar = () => { bg.classList.remove('show'); ok.onclick = cancel.onclick = null; };
  cancel.onclick = cerrar;
  ok.onclick = async () => {
    const v = id => document.getElementById(id).value.trim();
    const datos = { medio: v('ac-medio').slice(0, 80), rol: v('ac-rol'), link: v('ac-link').slice(0, 200), comentario: v('ac-comentario').slice(0, 300) };
    if(datos.medio.length < 2) return err.textContent = 'Escribí el nombre del medio.';
    if(!ROLES_PRENSA.includes(datos.rol)) return err.textContent = 'Elegí tu rol.';
    ok.disabled = true;
    try{
      await DataService.pedirAcreditacion(ev.id, state.uid, { ...datos, nombre: nombreVisible(state.perfil).slice(0, 60) });
      notificar(ev.creador, 'acreditacion_solicitud', { objetoId: ev.id, objetoNombre: ev.nombre, texto: datos.medio });
      cerrar();
      toast('Pedido enviado. Te avisamos cuando respondan.');
      renderDetalle(ev.id);
    } catch(e){
      console.error(e);
      err.textContent = 'No se pudo enviar. Revisá que falten más de 24 h para el evento.';
      ok.disabled = false;
    }
  };
  bg.classList.add('show');
}

// Lista de pedidos de prensa para quien organiza.
async function cargarPrensa(ev, tok){
  try{
    const lista = await DataService.listarAcreditaciones(ev.id);
    const cont = document.getElementById('lista-prensa');
    if(!cont || tok !== state.tok) return;
    const pend = lista.filter(a => a.estado === 'pendiente'), apro = lista.filter(a => a.estado === 'aprobada');
    const fila = (a, botones) => `<div class="solicitud">
        <div class="avatar">${esc(inicialesDe(a.nombre))}</div>
        <div class="nom">${esc(a.nombre)} · ${esc(a.medio)}<small>${esc(a.rol)}${a.link ? ' · ' + esc(a.link) : ''}${a.comentario ? ' · “' + esc(a.comentario) + '”' : ''}</small></div>
        ${botones}
      </div>`;
    cont.innerHTML = (pend.length || apro.length) ? `
      ${pend.map(a => fila(a, `<button class="btn btn-secundario btn-mini" data-acred="rechazar" data-uid="${esc(a.uid)}" data-evento="${esc(ev.id)}">Rechazar</button>
        <button class="btn btn-primario btn-mini" data-acred="aprobar" data-uid="${esc(a.uid)}" data-evento="${esc(ev.id)}">Aprobar</button>`)).join('')}
      ${apro.length ? `<div style="font-size:12px; color:var(--gris); margin:8px 0 4px;">Acreditados (${apro.length})</div>${apro.map(a => fila(a, '<span class="tag si">Acreditado</span>')).join('')}` : ''}`
      : emptyState('Todavía no hay pedidos de acreditación.');
  } catch(e){
    console.warn('prensa', e);
    const cont = document.getElementById('lista-prensa');
    if(cont) cont.innerHTML = emptyState('No se pudo cargar.');
  }
}

// Aprueba o rechaza un pedido de prensa (y avisa).
async function responderAcreditacion(btn){
  const aprobar = btn.dataset.acred === 'aprobar', uid = btn.dataset.uid, evId = btn.dataset.evento;
  btn.closest('.solicitud').querySelectorAll('button').forEach(b => b.disabled = true);
  try{
    await DataService.responderAcreditacion(evId, uid, aprobar);
    notificar(uid, aprobar ? 'acreditacion_aprobada' : 'acreditacion_rechazada', { objetoId: evId, objetoNombre: eventoEnCache(evId)?.nombre || 'el evento' });
    toast(aprobar ? 'Acreditación aprobada' : 'Acreditación rechazada');
    renderDetalle(evId);
  } catch(e){
    console.error(e);
    toast('No se pudo responder');
    btn.closest('.solicitud').querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// =========================================================
//  ELIMINAR CUENTA
// =========================================================
function pedirClave(){
  return new Promise(resolve => {
    const bg = document.getElementById('modal-bg');
    const ok = document.getElementById('modal-ok'), cancel = document.getElementById('modal-cancelar');
    const input = document.getElementById('modal-clave');
    document.getElementById('modal-titulo').textContent = 'Confirmá tu contraseña';
    document.getElementById('modal-texto').textContent = 'Por seguridad, escribí tu contraseña para eliminar la cuenta.';
    input.value = ''; input.style.display = 'block';
    ok.textContent = 'Confirmar';
    bg.classList.add('show');
    input.focus();
    const done = v => { bg.classList.remove('show'); input.style.display = 'none'; ok.onclick = cancel.onclick = null; resolve(v); };
    ok.onclick = () => done(input.value);
    cancel.onclick = () => done(null);
  });
}
// Pide volver a iniciar sesión antes de acciones delicadas (borrar cuenta).
async function reautenticar(){
  const u = auth.currentUser;
  const proveedores = (u.providerData || []).map(p => p.providerId);
  if(proveedores.includes('google.com')){
    await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
  } else if(proveedores.includes('facebook.com')){
    await u.reauthenticateWithPopup(new firebase.auth.FacebookAuthProvider());
  } else if(proveedores.includes('password')){
    const clave = await pedirClave();
    if(!clave) throw new Error('CANCELADO');
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, clave));
  }
}
// Borra la cuenta y los datos personales.
async function eliminarCuenta(){
  const activos = state.eventos.filter(e => e.creador === state.uid && !esCancelado(e) && (e.confirmadosCount || 0) > 1);
  if(activos.length){
    await confirmar('Primero cancelá tus eventos', `Organizás ${activos.length === 1 ? 'un evento' : activos.length + ' eventos'} con gente confirmada (${activos.map(e => e.nombre).join(', ')}). Cancelalos para que les llegue el aviso y después eliminá la cuenta.`, 'Entendido');
    return;
  }
  if(!(await confirmar('Eliminar mi cuenta', 'Se borran para siempre tu perfil, tu @usuario, tu foto, tu fecha de nacimiento, tus amistades, tus bloqueos, tus notificaciones y tus eventos sin otros confirmados. No se puede deshacer.', 'Continuar'))) return;
  const confirma = await pedirTexto('Última confirmación', 'Escribí ELIMINAR para borrar tu cuenta.', 'ELIMINAR', 'Eliminar para siempre');
  if((confirma || '').trim().toUpperCase() !== 'ELIMINAR'){ if(confirma !== null) toast('No se eliminó: tenías que escribir ELIMINAR'); return; }
  try{
    await reautenticar();
    mostrarLoader('BORRANDO TU CUENTA...');
    const propios = state.eventos.filter(e => e.creador === state.uid && (e.confirmadosCount || 0) <= 1).map(e => e.id);
    await DataService.eliminarDatosDeCuenta(state.uid, state.perfil.usuario || '', state.amistades.map(f => f.id), [...state.bloqueados], propios);
    await auth.currentUser.delete();
    location.reload();
  } catch(e){
    console.error(e);
    ocultarLoader();
    if(e.message === 'CANCELADO') return;
    toast(e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' ? 'Contraseña incorrecta' : 'No se pudo eliminar la cuenta. Cerrá sesión, volvé a entrar y probá de nuevo.');
  }
}

// =========================================================
//  AYUDA (preguntas frecuentes) Y PRIVACIDAD
// =========================================================
const AYUDA = [
  ['Entradas y asistencia', [
    ['¿Cómo consigo mi entrada?', 'Entrá al evento y tocá "Confirmar asistencia" o "Reservar entrada". Tu entrada queda en "Mis entradas" (el ícono del ticket arriba en Inicio, o desde tu perfil).'],
    ['¿Tengo que imprimir la entrada?', 'No. La mostrás en el celular al llegar. Tené la batería cargada.'],
    ['¿Todas las entradas tienen QR?', 'No. Los eventos de organizaciones (boliches, productoras, bares) pueden usar entradas con QR. En previas y eventos de personas quedás en la lista y das tu nombre en la puerta.'],
    ['¿Puedo compartir una captura de mi QR?', 'No te lo recomendamos: cada código se valida una sola vez. Si otra persona lo usa primero, el tuyo deja de servir.'],
    ['El evento tiene un botón "Comprar en…", ¿qué es?', 'Algunas organizaciones venden sus entradas en otra plataforma (por ejemplo Alpogo o Passline). La compra se hace ahí, con las condiciones de esa plataforma.'],
    ['¿Qué pasa si el evento se llena?', 'Podés anotarte en la lista de espera desde el mismo evento.']
  ]],
  ['Colores y etiquetas', [
    ['¿Qué significan los puntos de colores?', 'Verde: hay lugar. Amarillo: se está llenando o quedan pocos lugares. Rojo: lleno o cancelado. Gris: ya terminó. Si el punto late, el evento está pasando ahora. Tocá "Colores" arriba para ver la referencia completa.'],
    ['¿Quién decide el ambiente de un evento en vivo?', 'Las personas que están anotadas votan cómo está (Tranqui, Se pone bueno o Explotado) mientras el evento está pasando. Se muestra lo que vota la mayoría en las últimas 3 horas.']
  ]],
  ['Pagos y devoluciones', [
    ['¿Cómo pago una entrada?', 'El pago se hace directamente a quien organiza, como indica el evento en "Cómo se paga" (por ejemplo, transferencia a un alias). Partazy no cobra el dinero de las entradas ni comisiones.'],
    ['¿Puedo pedir que me devuelvan la plata?', 'Las devoluciones se coordinan directamente con quien organiza el evento: Partazy no cobra ni devuelve dinero. Estamos trabajando en un sistema seguro para devoluciones de dinero.'],
    ['¿Qué pasa si cancelan el evento?', 'Te llega una notificación con el motivo, y el evento queda marcado como cancelado. Si pagaste, coordiná la devolución con quien organiza.']
  ]],
  ['Previas privadas', [
    ['¿Cómo funcionan?', 'Pedís unirte desde el evento y quien organiza aprueba o rechaza. Cuando te aprueban, recibís una notificación y recién ahí ves la dirección exacta.']
  ]],
  ['Edad y seguridad', [
    ['¿Hay edad mínima?', 'Partazy es para mayores de 18 años. Cada evento indica su clasificación (ATP o +18). Llevá tu DNI: el lugar puede pedirlo.'],
    ['¿Qué hago si veo algo inapropiado?', 'Tocá "Denunciar" en el evento, el perfil o el mensaje. Lo revisa el equipo de moderación. También podés bloquear a una persona desde su perfil.']
  ]],
  ['Organizadores y prensa', [
    ['Tengo un boliche, bar o productora, ¿cómo publico?', 'En tu perfil tocá "Pasar a cuenta de organizador". Vas a tener tu página pública, entradas con QR, control de puerta y podés pedir la insignia de verificado ✓.'],
    ['¿Cómo controlo el ingreso?', 'En tu evento, tocá "Control de puerta": escaneás el QR de cada entrada o escribís el código. Cada código se valida una sola vez.'],
    ['¿Cómo pido una acreditación de prensa?', 'Entrá al evento de una organización y tocá "Pedir acreditación de prensa", hasta 24 h antes. La aprobación depende de la organización.']
  ]],
  ['Tu cuenta', [
    ['¿Cómo borro mi cuenta y mis datos?', 'En tu perfil, tocá "Eliminar mi cuenta". Se borran tu perfil y tus datos personales para siempre.']
  ]]
];

// Pinta las preguntas frecuentes.
function renderAyuda(){
  document.getElementById('lista-ayuda').innerHTML = AYUDA.map(([seccion, preguntas]) => `
    <div class="subtitulo"><h3 class="titulo-bloque">${esc(seccion)}</h3></div>
    <div class="lista-faq">${preguntas.map(([p, r]) => `<details class="faq"><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}</div>`).join('');
}
// Abre Ayuda (con el nombre precargado en el formulario de contacto si hay sesión).
function abrirAyuda(){ renderAyuda(); prepararContacto(); ir('ayuda'); }
// Precarga el nombre en el formulario de contacto (el mail lo escribe cada uno) y muestra WhatsApp si está configurado.
function prepararContacto(){
  const n = document.getElementById('ct-nombre');
  if(n && !n.value && state.perfil) n.value = state.perfil.nombre || '';
  const wa = document.getElementById('ct-whatsapp');
  if(wa && WHATSAPP_CONTACTO){ wa.href = 'https://wa.me/' + WHATSAPP_CONTACTO + '?text=' + encodeURIComponent('Hola Partazy! Tengo una consulta: '); wa.style.display = ''; }
}
// Valida y manda la consulta del formulario de contacto.
async function enviarConsulta(){
  const v = id => document.getElementById(id).value.trim();
  const nombre = v('ct-nombre'), email = v('ct-email'), motivo = v('ct-motivo'), mensaje = v('ct-mensaje');
  if(nombre.length < 2){ toast('Escribí tu nombre'); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Revisá tu correo electrónico'); return; }
  if(mensaje.length < 5){ toast('Contanos un poco más en el mensaje'); return; }
  const btn = document.getElementById('ct-enviar');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try{
    await DataService.enviarConsulta({ nombre: nombre.slice(0, 60), email: email.slice(0, 100), motivo, mensaje: mensaje.slice(0, 1000), uid: state.uid || '', ts: Date.now() });
    document.getElementById('ct-mensaje').value = '';
    toast('¡Gracias! Te respondemos al mail a la brevedad');
  } catch(e){
    console.error(e);
    toast('No se pudo enviar. Escribinos a ' + MAIL_CONTACTO);
  } finally { btn.disabled = false; btn.textContent = 'Enviar'; }
}
// Admins: pinta las consultas recibidas en el panel de moderación.
async function renderConsultas(){
  const cont = document.getElementById('lista-consultas');
  if(!cont) return;
  let lista = [];
  try{ lista = await DataService.listarConsultas(); } catch(e){ console.warn('consultas', e); }
  const MOT = { consulta: 'Consulta', problema: 'Algo no funciona', organizacion: 'Boliche / productora', cuenta: 'Cuenta', denuncia: 'Denuncia', sugerencia: 'Sugerencia' };
  // Responder abre Gmail con la cuenta de Partazy (no con el mail personal del admin)
  const responder = c => `https://mail.google.com/mail/?authuser=${encodeURIComponent(MAIL_CONTACTO)}&view=cm&fs=1&to=${encodeURIComponent(c.email)}&su=${encodeURIComponent('Tu consulta en Partazy')}`;
  cont.innerHTML = lista.length ? lista.map(c => `<div class="reporte consulta">
      <div class="cab"><span class="tipo">${esc(MOT[c.motivo] || c.motivo)}</span><span>${esc(hace(c.ts))}</span></div>
      <div class="obj">${esc(c.nombre)} · ${esc(c.email)}</div>
      <div class="cita">${esc(c.mensaje)}</div>
      <div class="acciones-r"><a class="btn btn-primario btn-mini" href="${esc(responder(c))}" target="_blank" rel="noopener noreferrer">Responder desde ${esc(MAIL_CONTACTO)}</a><button class="btn btn-secundario btn-mini" data-borrar-consulta="${esc(c.id)}">Listo, borrar</button></div>
    </div>`).join('') : emptyState('No hay consultas nuevas.');
  cont.querySelectorAll('[data-borrar-consulta]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try{ await DataService.borrarConsulta(b.dataset.borrarConsulta); renderConsultas(); } catch(e){ toast('No se pudo borrar'); b.disabled = false; }
  });
}
// Abre la política de privacidad.
function abrirPrivacidad(){ ir('privacidad'); }
// Abre los términos y condiciones.
function abrirTerminos(){ pintarMailContacto(); ir('terminos'); }
// Mail de contacto de Partazy: cambiar SOLO acá
const MAIL_CONTACTO = 'partazycontacto@gmail.com';
// WhatsApp de contacto: número con código de país, sin "+" ni espacios (ej. '5493511234567'). Vacío = no se muestra el botón.
const WHATSAPP_CONTACTO = '';
// Pone el mail de contacto en todos los lugares marcados.
function pintarMailContacto(){
  document.querySelectorAll('.mail-contacto').forEach(el => {
    el.innerHTML = MAIL_CONTACTO ? `<a href="mailto:${esc(MAIL_CONTACTO)}">${esc(MAIL_CONTACTO)}</a>` : '(próximamente)';
  });
}
// Volver desde Términos/Privacidad al lugar correcto.
function volverLegal(){ if(state.invitado) return volver('home'); ir(state.perfil ? 'perfil' : 'bienvenida'); }

// Etiqueta de cupo ("Últimos lugares", "Lleno"...).
// Cuenta una vista única del evento (no cuenta al organizador ni a quien mira sin cuenta).
function contarVista(ev){
  if(!state.uid || state.invitado || ev.creador === state.uid) return;
  const clave = 'partazy_vista_' + ev.id;
  try{ if(localStorage.getItem(clave)) return; localStorage.setItem(clave, '1'); } catch(e){}
  DataService.registrarVista(ev.id, state.uid).then(nueva => { const c = eventoEnCache(ev.id); if(nueva && c) c.vistasCount = (c.vistasCount || 0) + 1; }).catch(e => console.warn('vista', e));
}
// Estadísticas para quien organiza: alcance y conversión.
function estadisticasHTML(ev){
  const vistas = ev.vistasCount || 0, anot = Math.max(0, (ev.confirmadosCount || 0) - 1), comp = ev.repostsCount || 0;
  const conv = vistas ? Math.min(100, Math.round(anot / vistas * 100)) : 0;
  const caja = (n, t, s) => `<div class="stat"><b>${n}</b><span>${t}</span>${s ? `<small>${s}</small>` : ''}</div>`;
  return `<div class="bloque"><h3 class="titulo-bloque">📊 Estadísticas</h3>
    <div class="stats-grid">${caja(vistas, vistas === 1 ? 'persona lo vio' : 'personas lo vieron', 'vistas únicas')}${caja(anot, ev.privacidad === 'privada' ? 'aprobados' : 'anotados', 'sin contarte')}${caja(conv + '%', 'se anotaron', 'de los que lo vieron')}${caja(comp, comp === 1 ? 'lo compartió' : 'lo compartieron', 'con sus amigos')}</div>
    <div class="ayuda" style="margin-top:10px;">Solo vos ves esto. Cuentan las personas con cuenta (cada una una sola vez).</div></div>`;
}
// ¿Ya cerró la inscripción? (el organizador puede poner "anotate hasta el...")
function inscripcionCerrada(ev){ return typeof ev?.inscripcionHasta === 'number' && Date.now() > ev.inscripcionHasta; }
// "Quedan 3 días" / "Cierra hoy a las 23:59" / "Cerró el 23/11"
function textoInscripcion(ev){
  if(typeof ev?.inscripcionHasta !== 'number') return '';
  const d = new Date(ev.inscripcionHasta), falta = ev.inscripcionHasta - Date.now();
  const dia = `${d.getDate()}/${d.getMonth() + 1}`, hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if(falta <= 0) return `Cerró el ${dia}`;
  if(falta < 24 * HORA) return `Cierra hoy a las ${hora}`;
  const dias = Math.ceil(falta / (24 * HORA));
  return `Hasta el ${dia} · ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`}`;
}
// Saca el alias o CBU/CVU del texto de pago ("transferencia a: juli.mp.cumple" → "juli.mp.cumple").
function datoPago(t){
  const s = String(t || '');
  const cbu = s.match(/\b\d{22}\b/); if(cbu) return cbu[0];
  const alias = s.match(/\b[a-zA-Z0-9-]{2,}(?:\.[a-zA-Z0-9-]{2,}){1,3}\b/); 
  return alias && !/^(www|https?)\b/i.test(alias[0]) && !/\.(com|ar|net|org)$/i.test(alias[0]) ? alias[0] : '';
}
// Copia el alias al portapapeles.
async function copiarDatoPago(btn, dato){
  try{ await navigator.clipboard.writeText(dato); toast('Copiado: ' + dato + ' ✓'); }
  catch(e){ toast(dato); }
  if(btn){ btn.classList.add('copiado'); setTimeout(() => btn.classList.remove('copiado'), 1500); }
}
// Íconos de la lista de detalles del evento.
const II = {
  reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cuando: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  donde: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  edad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/></svg>',
  gente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>'
};
// Color de la barra de lugares: verde (hay lugar), amarillo (se llena), rojo (casi lleno).
function nivelCupo(cupo, cap){ const r = cupo / Math.max(1, cap); return r >= 0.85 ? 'nivel-rojo' : r >= 0.5 ? 'nivel-amarillo' : 'nivel-verde'; }
function pillCupoHTML(ev){ const c = estadoCupo(ev); return c ? `<span class="pill-cupo ${c.clase}">${c.texto}</span>` : ''; }

// =========================================================
//  AMIGOS, PERFILES, CHATS Y COMPARTIR
// =========================================================
const ICO_REPOST = '<svg class="ico-repost" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>';
// Id de un par de personas, siempre ordenado (a_b).
function parId(a, b){ return [a, b].sort().join('_'); }
// Del id de un par, el uid de la otra persona.
function otroDe(pid){ return pid.split('_').find(u => u !== state.uid); }
// Link para compartir algo de la app (#/evento/..., #/u/...).
function urlApp(ruta){ return location.origin + location.pathname + '#/' + ruta; }
// Hora "23:30".
function horaCorta(ts){
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
// Hora o día corto para la lista de chats.
function cuandoChat(ts){
  const d = new Date(ts), h = new Date();
  const mismoDia = d.toDateString() === h.toDateString();
  return mismoDia ? horaCorta(ts) : `${d.getDate()} ${MESES[d.getMonth()]}`;
}
// Foto de perfil o iniciales (oculta fotos denunciadas).
function avatarHTML(u){
  const esMio = u === state.perfil || u?.uid === state.uid;
  const oculta = !esMio && (u?.denuncias || 0) >= UMBRAL_DENUNCIAS; // foto denunciada: se oculta hasta revisarla
  if(fotoValida(u?.foto) && !oculta) return `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">`;
  return esc(u?.iniciales || inicialesDe(u?.nombre));
}
// Campos para buscar por nombre, apodo o @usuario
function camposBusqueda(nombre, usuario, apodo){
  const n = normalizar(nombre).trim().replace(/\s+/g, ' ');
  const extra = normalizar(apodo || '').trim().split(/\s+/).concat(usuario ? [usuario] : []);
  return { nombreBusqueda: n, palabras: [...new Set(n.split(' ').concat(extra).filter(Boolean))].slice(0, 10) };
}
// Nombre de la pantalla que se está viendo.
function pantallaActual(){ return (document.querySelector('.screen.activa')?.id || '').replace('pantalla-', ''); }

// ---------- Usuarios (con caché en memoria) ----------
// Trae datos frescos (para ver quién está en línea)
async function refrescarUsuarios(uids){
  const lista = [...new Set((uids || []).filter(Boolean))].slice(0, 60);
  await Promise.all(lista.map(async uid => {
    try{ const p = await DataService.getPerfil(uid); if(p) state.usuarios[uid] = { uid, ...p }; } catch(e){}
  }));
}
// Estado "En línea" / "Activo hace..." de una persona (si lo comparte).
function estadoLinea(u){
  if(!u || u.ocultarEnLinea || !u.ultimaConexion) return null;
  const d = Date.now() - u.ultimaConexion;
  if(d < 4 * 60e3) return { on: true, txt: 'En línea' };
  if(d < 60 * 60e3) return { on: false, txt: `Activo hace ${Math.max(1, Math.round(d / 60e3))} min` };
  if(d < 24 * 36e5) return { on: false, txt: `Activo hace ${Math.round(d / 36e5)} h` };
  return null;
}
// Para el chat y el perfil: si no hay actividad reciente, "Desconectado" (salvo que la persona lo oculte)
function estadoLineaChat(u){
  if(!u || u.ocultarEnLinea) return null;
  return estadoLinea(u) || { on: false, off: true, txt: 'Desconectado' };
}
// Texto de estado en línea para el perfil.
function lineaEstadoHTML(u){
  if(u?.uid === state.uid) return '';
  const e = estadoLineaChat(u);
  return e ? `<div class="linea-estado ${e.on ? 'on' : ''} ${e.off ? 'off' : ''}">${e.on ? '● ' : e.off ? '○ ' : ''}${esc(e.txt)}</div>` : '';
}
// Puntito verde de "en línea" sobre el avatar.
function puntoLinea(u){ return estadoLinea(u)?.on ? '<span class="punto-linea" title="En línea"></span>' : ''; }
// Latido: mientras la app está abierta, cada 2 minutos y medio
function latido(){
  if(!state.uid || !state.perfil || state.perfil.suspendido || state.perfil.ocultarEnLinea) return;
  if(document.visibilityState !== 'visible') return;
  const ahora = Date.now();
  if(ahora - (state._ultimoLatido || 0) < 60e3) return;
  state._ultimoLatido = ahora;
  DataService.savePerfil(state.uid, { ultimaConexion: ahora }).catch(e => console.warn('latido', e));
}
setInterval(latido, 150e3);
document.addEventListener('visibilitychange', latido);
document.addEventListener('visibilitychange', () => { if(state.dmActual && document.visibilityState === 'visible') marcarDMVisto(state.dmActual.pid, state.dmMsgs); });
setInterval(() => {
  const p = typeof pantallaActual === 'function' ? pantallaActual() : '';
  if(!state.uid || !['amigos', 'chats', 'chat'].includes(p)) return;
  const uids = p === 'chat' ? [state.dmActual?.uid] : (p === 'chats' ? state.dms.map(d => otroDe(d.id)) : amigosUids());
  refrescarUsuarios(uids).then(() => {
    const q = pantallaActual();
    if(q === 'amigos') renderAmigos(); else if(q === 'chats') renderChats(); else if(q === 'chat') pintarTopChat();
  });
}, 60e3);

// Perfil de una persona (con caché en memoria).
async function getUsuario(uid){
  if(state.usuarios[uid]) return state.usuarios[uid];
  try{
    const p = await DataService.getPerfil(uid);
    if(p) state.usuarios[uid] = { uid, ...p };
  } catch(e){ console.warn('usuario', uid, e); }
  return state.usuarios[uid] || null;
}

// ---------- Relaciones ----------
function amistad(uid){ return state.amistades.find(f => f.id === parId(state.uid, uid)) || null; }
// Uids de mis amigos (amistades aceptadas).
function amigosUids(){ return state.amistades.filter(f => f.estado === 'aceptada').map(f => otroDe(f.id)); }
// Solicitudes de amistad que me mandaron.
function solicitudesRecibidas(){ return state.amistades.filter(f => f.estado === 'pendiente' && f.para === state.uid); }
// Solicitudes de amistad que mandé.
function solicitudesEnviadas(){ return state.amistades.filter(f => f.estado === 'pendiente' && f.de === state.uid); }
// ¿El chat tiene mensajes nuevos para mí?
function noLeido(d){ return !!d.ultimoTs && d.ultimoDe !== state.uid && (d.vistoPor?.[state.uid] || 0) < d.ultimoTs; }

// Pone un numerito (badge) en un ícono.
function setBadge(id, n){
  const b = document.getElementById(id);
  if(!b) return;
  b.textContent = n > 9 ? '9+' : String(n);
  b.classList.toggle('on', n > 0);
  const lado = document.getElementById(id + '-side');
  if(lado){ lado.textContent = b.textContent; lado.classList.toggle('on', n > 0); }
}
// Actualiza todos los numeritos (amigos, chats, notificaciones).
function actualizarBadges(){
  setBadge('badge-amigos', solicitudesRecibidas().length);
  setBadge('badge-chats', state.dms.filter(noLeido).length);
  const sa = document.getElementById('stat-amigos');
  if(sa) sa.textContent = amigosUids().length;
}

// Escucha en tiempo real solicitudes de amistad y conversaciones
function iniciarSocial(){
  if(state.socialUnsubs.length) return;
  state.socialUnsubs.push(DataService.escucharNotificaciones(state.uid, lista => {
    state.notificaciones = lista;
    actualizarBadgeNotif();
    avisarNotifNuevas(lista);
    if(pantallaActual() === 'notificaciones') renderNotificaciones(true);
  }, e => console.warn('notificaciones', e)));
  state.socialUnsubs.push(DataService.escucharBloqueos(state.uid, lista => {
    state.bloqueados = new Set(lista);
    refrescarTrasBloqueo();
  }, e => console.warn('bloqueos', e)));
  if(state.esAdmin){
    document.getElementById('btn-moderacion').style.display = '';
    state.socialUnsubs.push(DataService.escucharReportes(lista => {
      state.reportes = lista;
      renderModeracion();
    }, e => console.warn('reportes', e)));
    state.socialUnsubs.push(DataService.escucharVerificacionesPendientes(lista => {
      state.verifPendientes = lista;
      renderModeracion();
    }, e => console.warn('verificaciones', e)));
  }
  state.socialUnsubs.push(DataService.escucharAmistades(state.uid, lista => {
    state.amistades = lista;
    actualizarBadges();
    renderCtaAmigos();
    programarRed();
    const p = pantallaActual();
    if(p === 'amigos'){ renderAmigos(); renderResultadosPersonas(); }
    if(p === 'explorar' && state.modoExplorar === 'personas') renderGente();
    if(p === 'usuario' && state.usuarioActual) renderUsuario(state.usuarioActual);
  }, e => console.warn('amistades', e)));
  state.socialUnsubs.push(DataService.escucharDMs(state.uid, lista => {
    state.dms = lista;
    actualizarBadges();
    avisarDMsNuevos(lista);
    if(pantallaActual() === 'chat' && state.dmActual){ pintarTopChat(); pintarEstadoDM(); if(state.dmMsgs?.length) renderDM(state.dmMsgs); marcarDMVisto(state.dmActual.pid, state.dmMsgs); }
    if(pantallaActual() === 'chats') renderChats();
  }, e => console.warn('chats', e)));
}

// Fila de una persona (avatar, nombre, botones).
function personaHTML(u, acciones, sub){
  if(!u) return '';
  return `<div class="persona">
      <div class="avatar" data-usuario="${esc(u.uid)}">${avatarHTML(u)}${puntoLinea(u)}</div>
      <div class="txt" data-usuario="${esc(u.uid)}" role="button" tabindex="0"><h5>${esc(nombreVisible(u))}${insignia(u)}</h5><span>${esc(sub ?? (estadoLinea(u)?.on ? 'En línea' : (u.usuario ? '@' + u.usuario + (u.ciudad ? ' · ' + u.ciudad : '') : (u.ciudad ?? ''))))}</span></div>
      <div class="acciones-p">${acciones || ''}</div>
    </div>`;
}

// Botón según la relación: Agregar / Pendiente / Aceptar / Amigos.
function botonRelacion(uid){
  const f = amistad(uid);
  if(!f) return `<button class="btn btn-primario btn-mini" data-amigo-accion="pedir" data-uid="${esc(uid)}">Agregar</button>`;
  if(f.estado === 'aceptada') return `<button class="btn btn-secundario btn-mini" data-dm="${esc(uid)}">Mensaje</button>`;
  if(f.para === state.uid) return `<button class="btn btn-primario btn-mini" data-amigo-accion="aceptar" data-par="${esc(f.id)}">Aceptar</button>`;
  return `<button class="btn btn-secundario btn-mini" data-amigo-accion="cancelar" data-par="${esc(f.id)}">Enviada ✓</button>`;
}

// ---------- Pantalla Amigos ----------
function abrirAmigos(enfocar, texto){
  // Cada vez que se entra, el buscador arranca vacío (salvo que venga una búsqueda)
  clearTimeout(_debPersonas);
  const inp = document.getElementById('input-buscar-personas');
  inp.value = typeof texto === 'string' ? texto : '';
  state.resultadosPersonas = null;
  state.busquedaPersonas = '';
  ir('amigos', { abrir: () => abrirAmigos() });
  renderAmigos();
  renderResultadosPersonas();
  if(inp.value) inp.dispatchEvent(new Event('input'));
  if(enfocar === true) setTimeout(() => inp.focus(), 80);
  refrescarUsuarios(amigosUids()).then(() => { if(pantallaActual() === 'amigos') renderAmigos(); });
}

// Invitar a alguien que todavía no usa Partazy (WhatsApp, Instagram, etc.)
async function invitarAmigos(){
  const link = location.origin + (state.uid ? '/#/u/' + state.uid : '');
  const texto = `Sumate a PARTAZY 🎉 la app de fiestas, previas y boliches. Agregame: ${link}`;
  if(navigator.share){
    try{ await navigator.share({ title: 'PARTAZY', text: texto }); return; } catch(e){ if(e && e.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
}

// Invitación en el inicio a sumar amigos (si tenés pocos).
function renderCtaAmigos(){
  const el = document.getElementById('home-amigos-cta');
  if(!el) return;
  const n = amigosUids().length;
  pintarFilaAmigos();
  el.innerHTML = n >= 3 ? '' : `<div class="cta-amigos">
      <div class="ico">👥</div>
      <div><b>${n ? 'Sumá más amigos' : 'Encontrá a tus amigos'}</b><span>Mirá a qué fiestas van y armen el plan juntos.</span></div>
      <div class="acc"><button class="btn btn-primario btn-mini" onclick="explorarPersonas()">Buscar</button><button class="btn btn-secundario btn-mini" onclick="invitarAmigos()">Invitar</button></div>
    </div>`;
}

// Fila "Tus amigos" en el inicio: a dónde va cada uno (como historias). Tocar → su perfil.
function pintarFilaAmigos(){
  const el = document.getElementById('home-amigos-fila');
  if(!el) return;
  const todos = amigosUids().filter(u => !state.bloqueados.has(u));
  const faltan = todos.filter(u => !state.usuarios[u]).slice(0, 30);
  if(faltan.length && !pintarFilaAmigos._cargando){   // traemos los perfiles que falten y repintamos
    pintarFilaAmigos._cargando = true;
    Promise.all(faltan.map(u => getUsuario(u).catch(() => null))).finally(() => { pintarFilaAmigos._cargando = false; if(faltan.some(u => state.usuarios[u])) pintarFilaAmigos(); });
  }
  const amigos = todos.filter(u => state.usuarios[u]);
  if(state.invitado || !amigos.length){ el.innerHTML = ''; el.style.display = 'none'; return; }
  const plan = u => {
    const ev = (state.red.planes[u]?.eventos || []).map(eventoEnCache).filter(e => e && !esCancelado(e) && e.fechaTs > Date.now() - 6 * HORA).sort((a, b) => a.fechaTs - b.fechaTs)[0];
    return ev ? { txt: ev.nombre, ev } : null;
  };
  const datos = amigos.map(u => ({ u, p: plan(u), on: !!estadoLinea(state.usuarios[u])?.on }))
    .sort((a, b) => (!!b.p - !!a.p) || (b.on - a.on)).slice(0, 20);
  el.style.display = '';
  el.innerHTML = `<div class="seccion-titulo"><h2>Tus amigos</h2><span onclick="abrirAmigos()">Ver todos</span></div>
    <div class="fila-amigos">${datos.map(({ u, p, on }) => `<button class="amigo-burbuja${p ? ' con-plan' : ''}" ${p ? `data-abrir="${esc(p.ev.id)}"` : `data-usuario="${esc(u)}"`} aria-label="${esc(nombreVisible(state.usuarios[u]))}">
      <span class="ab-foto">${avatarMini(state.usuarios[u])}${on ? '<i class="ab-on"></i>' : ''}</span>
      <b>${esc(nombreCorto(state.usuarios[u]))}</b><small>${p ? '🎉 ' + esc(p.txt) : on ? 'En línea' : '—'}</small></button>`).join('')}</div>`;
}
// Personas en el buscador de Explorar
let _debExplorarPersonas;
// Buscador de personas en Explorar.
function buscarPersonasExplorar(q){
  clearTimeout(_debExplorarPersonas);
  const cont = document.getElementById('explorar-personas');
  const t = normalizar(q || '').trim();
  if(t.length < 2){ cont.innerHTML = ''; return; }
  _debExplorarPersonas = setTimeout(async () => {
    let res = [];
    try{ res = (await DataService.buscarPersonas(t)).filter(u => u.uid !== state.uid && !state.bloqueados.has(u.uid)); } catch(e){ console.warn('personas', e); }
    if(normalizar(document.getElementById('input-buscar').value).trim() !== t) return;
    res.forEach(u => { state.usuarios[u.uid] = { ...(state.usuarios[u.uid] || {}), ...u }; });
    cont.innerHTML = res.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Personas</h3></div>
      <div class="lista-simple" style="min-height:0; padding:0 0 10px;">${res.slice(0, 3).map(u => personaHTML(u, botonRelacion(u.uid))).join('')}</div>
      ${res.length > 3 ? `<div style="padding:0 20px 14px;"><button class="btn btn-secundario btn-mini" onclick="verMasGente(${esc(JSON.stringify(q))})">Ver ${res.length - 3} más</button></div>` : ''}
      <div class="subtitulo"><h3 class="titulo-bloque">Eventos</h3></div>` : '';
  }, 300);
}

// Pantalla Amigos: solicitudes, amigos y buscador.
async function renderAmigos(){
  const tok = state.tok;
  const rec = solicitudesRecibidas(), env = solicitudesEnviadas(), amigos = amigosUids();
  await Promise.all([...rec.map(f => f.de), ...env.map(f => f.para), ...amigos].map(getUsuario));
  if(tok !== state.tok) return;

  document.getElementById('bloque-recibidas').innerHTML = rec.length ? `
    <div class="subtitulo"><h3 class="titulo-bloque">Solicitudes de amistad (${rec.length})</h3></div>
    <div class="lista-simple" style="min-height:0; padding-bottom:12px;">${rec.map(f => personaHTML(state.usuarios[f.de],
      `<button class="btn btn-secundario btn-mini" data-amigo-accion="rechazar" data-par="${esc(f.id)}">Rechazar</button>
       <button class="btn btn-primario btn-mini" data-amigo-accion="aceptar" data-par="${esc(f.id)}">Aceptar</button>`)).join('')}</div>` : '';

  document.getElementById('titulo-mis-amigos').textContent = `Mis amigos (${amigos.length})`;
  const lista = amigos.map(uid => state.usuarios[uid]).filter(Boolean).sort((a,b) => nombreVisible(a).localeCompare(nombreVisible(b)));
  document.getElementById('lista-amigos').innerHTML = lista.length
    ? lista.map(u => personaHTML(u, `<button class="btn btn-secundario btn-mini" data-dm="${esc(u.uid)}">Mensaje</button>`)).join('')
    : emptyState('Todavía no tenés amigos en Partazy. Buscalos por nombre arriba o compartiles el link de tu perfil.');

  const bloq = [...state.bloqueados];
  await Promise.all(bloq.map(getUsuario));
  if(tok !== state.tok) return;
  document.getElementById('bloque-bloqueados').innerHTML = bloq.length ? `
    <div class="subtitulo"><h3 class="titulo-bloque">Personas bloqueadas</h3></div>
    <div class="lista-simple" style="padding-bottom:24px;">${bloq.map(uid => personaHTML(state.usuarios[uid] || { uid, nombre: 'Usuario' },
      `<button class="btn btn-secundario btn-mini" data-desbloquear="${esc(uid)}">Desbloquear</button>`, 'Bloqueada')).join('')}</div>` : '';

  document.getElementById('bloque-enviadas').innerHTML = env.length ? `
    <div class="subtitulo"><h3 class="titulo-bloque">Solicitudes enviadas</h3></div>
    <div class="lista-simple" style="padding-bottom:24px;">${env.map(f => personaHTML(state.usuarios[f.para],
      `<button class="btn btn-secundario btn-mini" data-amigo-accion="cancelar" data-par="${esc(f.id)}">Cancelar</button>`, 'Esperando respuesta')).join('')}</div>` : '';
}

// Búsqueda de personas por nombre
let _debPersonas;
// Busca personas (con espera mientras se escribe).
async function buscarPersonas(q){
  const n = normalizar(q).trim().replace(/\s+/g, ' ');
  state.busquedaPersonas = n;
  if(n.length < 2){ state.resultadosPersonas = null; renderResultadosPersonas(); return; }
  document.getElementById('resultados-personas').innerHTML = emptyState('Buscando...');
  try{
    const res = (await DataService.buscarPersonas(n)).filter(u => u.uid !== state.uid && !state.bloqueados.has(u.uid) && !u.suspendido);
    if(state.busquedaPersonas !== n) return; // llegó una búsqueda más nueva
    res.forEach(u => { state.usuarios[u.uid] = u; });
    state.resultadosPersonas = res;
  } catch(e){
    console.error(e);
    state.resultadosPersonas = [];
  }
  renderResultadosPersonas();
}
// Pinta los resultados de búsqueda de personas.
function renderResultadosPersonas(){
  const cont = document.getElementById('resultados-personas');
  const res = state.resultadosPersonas;
  if(!res){ cont.innerHTML = ''; return; }
  cont.innerHTML = res.length
    ? res.map(u => personaHTML(u, botonRelacion(u.uid))).join('')
    : emptyState('No encontramos a nadie con ese nombre. Probá con el nombre o el apellido completo, o compartile el link de tu perfil.');
}

// Pedir / aceptar / rechazar / cancelar / eliminar amistad.
async function accionAmistad(btn){
  const accion = btn.dataset.amigoAccion;
  if(accion === 'eliminar'){
    const ok = await confirmar('Eliminar de amigos', 'Van a dejar de ser amigos en Partazy y no van a poder mandarse mensajes.', 'Eliminar');
    if(!ok) return;
  }
  btn.disabled = true;
  try{
    if(accion === 'pedir'){
      await DataService.pedirAmistad(state.uid, btn.dataset.uid);
      toast('Solicitud enviada');
      notificar(btn.dataset.uid, 'amistad_solicitud');
    }
    else if(accion === 'aceptar'){
      const sol = state.amistades.find(x => x.id === btn.dataset.par);
      await DataService.aceptarAmistad(btn.dataset.par);
      toast('¡Ahora son amigos!');
      if(sol) notificar(sol.de, 'amistad_aceptada');
    }
    else if(accion === 'rechazar'){ await DataService.borrarAmistad(btn.dataset.par); toast('Solicitud rechazada'); }
    else if(accion === 'cancelar'){ await DataService.borrarAmistad(btn.dataset.par); toast('Solicitud cancelada'); }
    else if(accion === 'eliminar'){ await DataService.borrarAmistad(btn.dataset.par); toast('Ya no son amigos'); }
  } catch(e){
    console.error(e);
    toast(accion === 'pedir' ? 'No se pudo enviar. Puede que esa persona ya te haya mandado una solicitud.' : 'No se pudo completar');
    btn.disabled = false;
  }
  // La lista se actualiza sola con el listener en tiempo real
}

// ---------- Perfil de otra persona ----------
function abrirUsuario(uid){
  if(!uid) return;
  if(uid === state.uid){ ir('perfil'); return; }
  state.usuarioActual = uid;
  ir('usuario', { clave: 'usuario:' + uid, abrir: () => abrirUsuario(uid) });
  fijarRuta('u/' + uid);
  renderUsuario(uid);
}

// Perfil de otra persona (o página pública de una organización).
async function renderUsuario(uid){
  const tok = state.tok;
  const cont = document.getElementById('usuario-contenido');
  if(!state.usuarios[uid]) cont.innerHTML = '<div class="empty-state" style="padding-top:60px;">Cargando...</div>';
  const u = await getUsuario(uid);
  if(tok !== state.tok) return;
  if(!u){ cont.innerHTML = emptyState('No encontramos a esta persona.'); return; }

  const f = amistad(uid);
  const bloqueado = state.bloqueados.has(uid);
  const esYo = uid === state.uid;
  const org = esOrganizacion(u);
  const sigo = org && !esYo ? await estoySiguiendo(uid) : false;
  if(tok !== state.tok) return;
  let acciones;
  if(esYo) acciones = `<button class="btn btn-secundario" onclick="ir('perfil')">Volver a mi perfil</button>`;
  else if(bloqueado) acciones = `<button class="btn btn-secundario" data-desbloquear="${esc(uid)}">Desbloquear</button>`;
  else if(!f) acciones = `<button class="btn ${org ? 'btn-secundario' : 'btn-primario'}" data-amigo-accion="pedir" data-uid="${esc(uid)}">Agregar a amigos</button>`;
  else if(f.estado === 'aceptada') acciones = `
      <button class="btn btn-primario" data-dm="${esc(uid)}">Enviar mensaje</button>
      <button class="btn btn-secundario" data-amigo-accion="eliminar" data-par="${esc(f.id)}">Eliminar de amigos</button>`;
  else if(f.para === state.uid) acciones = `
      <button class="btn btn-primario" data-amigo-accion="aceptar" data-par="${esc(f.id)}">Aceptar solicitud</button>
      <button class="btn btn-secundario" data-amigo-accion="rechazar" data-par="${esc(f.id)}">Rechazar</button>`;
  else acciones = `<button class="btn btn-secundario" data-amigo-accion="cancelar" data-par="${esc(f.id)}">Cancelar solicitud enviada</button>`;
  if(!esYo && !bloqueado && f?.estado !== 'aceptada' && (u.mensajesDe !== 'amigos' || dmDoc(parId(state.uid, uid))))
    acciones += `<button class="btn btn-secundario" data-dm="${esc(uid)}">💬 Enviar mensaje</button>`;

  const intereses = Array.isArray(u.intereses) ? u.intereses : [];
  const organiza = bloqueado ? [] : state.eventos.filter(e => e.creador === uid && eventoVisible(e));
  cont.innerHTML = `
    <div class="perfil-header">
      <div class="avatar-grande">${avatarHTML(u)}</div>
      <h2>${esc(nombreVisible(u))}${insignia(u)}</h2>
      ${u.usuario ? `<div class="handle">@${esc(u.usuario)}</div>` : ''}
      ${esOrganizacion(u) ? `<div class="tags" style="justify-content:center; margin-top:8px;"><span class="tag">🎪 Organizador de eventos</span>${(u.califN || 0) ? `<span class="tag">${califOrgTxt(u)}</span>` : ''}${u.ocultarSeguidores && !esYo ? '' : `<span class="tag">${u.seguidores || 0} ${(u.seguidores || 0) === 1 ? 'seguidor' : 'seguidores'}</span>`}</div>` : ''}
      <div class="ubic">${esc([u.apodo ? u.nombre : '', u.ciudad].filter(Boolean).join(' · '))}</div>
      ${lineaEstadoHTML(u)}
      ${!org && !bloqueado ? '<div id="perfil-amigos-resumen" class="amigos-resumen"></div>' : ''}
      ${!org && u.bio && !bloqueado ? `<p class="bio">${esc(u.bio)}</p>` : ''}
      ${bloqueado ? '<div class="tags" style="justify-content:center; margin-top:10px;"><span class="tag no">Bloqueaste a esta persona</span></div>' : ''}
      ${f?.estado === 'aceptada' ? '<div class="tags" style="justify-content:center; margin-top:10px;"><span class="tag si">✓ Amigos</span></div>' : ''}
    </div>
    <div style="padding:0 20px 22px; display:flex; flex-direction:column; gap:10px;">
      ${org && !esYo && !bloqueado ? `<button class="btn ${sigo ? 'btn-secundario' : 'btn-primario'}" data-seguir="${esc(uid)}">${sigo ? 'Siguiendo ✓' : 'Seguir'}</button>` : ''}
      ${acciones}
      ${esYo ? '' : `<div class="acciones-evento">
        ${bloqueado ? '' : `<button class="btn btn-secundario" data-bloquear="${esc(uid)}">Bloquear</button>`}
        <button class="btn btn-secundario" data-denunciar-usuario="${esc(uid)}">🚩 Denunciar</button>
      </div>`}
    </div>
    ${org && !bloqueado ? bloquesOrganizacion(u) : ''}
    <div id="perfil-amigos-lista"></div>
    ${intereses.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Intereses</h3></div>
      <div class="interes-pills">${intereses.map(i => `<span class="chip activo">${esc(i)}</span>`).join('')}</div>` : ''}
    ${(() => {
      const comp = (state.red.planes[uid]?.compartidos || []).map(eventoEnCache).filter(e => e && eventoVisible(e) && !esCancelado(e));
      return !bloqueado && comp.length ? `<div class="subtitulo"><h3 class="titulo-bloque">${ICO_REPOST}Compartió</h3></div>
        <div class="lista-vertical" style="min-height:0; padding-bottom:18px;">${comp.slice(0, 6).map(e => tarjetaHorizontalHTML(e)).join('')}</div>` : '';
    })()}
    <div class="subtitulo"><h3 class="titulo-bloque">${org ? 'Agenda · próximas fechas' : 'Organizando'}</h3></div>
    <div class="lista-simple" style="padding-bottom:24px;">${organiza.length ? organiza.map(e => `
      <div class="item-simple" role="button" tabindex="0" data-abrir="${esc(e.id)}">
        <div class="foto-mini" style="background-image:${cssFoto(e)}"></div>
        <div class="txt"><h5>${esc(e.nombre)}</h5><span>${esc(fmtFecha(e.fechaTs))} hs</span></div>
      </div>`).join('') : emptyState('No está organizando eventos próximos.')}</div>`;
  if(!bloqueado && !org && !u.ocultarAmigos) cargarAmigosDePerfil(uid, tok);   // después de pintar (si ya está en caché se completa al toque)
  else if(!bloqueado && !org && u.ocultarAmigos){ const r = document.getElementById('perfil-amigos-resumen'); if(r) r.innerHTML = '<span class="link-amigos" style="cursor:default;">🔒 Lista de amigos privada</span>'; }
}

// Amigos de otra persona: cuántos son, cuántos en común y quiénes.
state.amigosDeCache = {};
async function cargarAmigosDePerfil(uid, tok){
  let lista = state.amigosDeCache[uid];
  if(!lista){
    try{ lista = await DataService.amigosDe(uid); } catch(e){ console.warn('amigos de', e); return; }
    state.amigosDeCache[uid] = lista;
  }
  if(tok !== state.tok) return;
  lista = lista.filter(x => !state.bloqueados.has(x));
  const mios = new Set(amigosUids()), comun = lista.filter(x => mios.has(x));
  const res = document.getElementById('perfil-amigos-resumen'), cont = document.getElementById('perfil-amigos-lista');
  if(!res || !cont) return;
  res.innerHTML = `<button class="link-amigos" onclick="document.getElementById('perfil-amigos-lista').scrollIntoView({behavior:'smooth', block:'start'})"><b>${lista.length}</b> ${lista.length === 1 ? 'amigo' : 'amigos'}${comun.length ? ` · <b>${comun.length}</b> en común` : ''}</button>`;
  if(!lista.length){ cont.innerHTML = ''; return; }
  const orden = [...comun, ...lista.filter(x => !mios.has(x))].slice(0, 60);
  await Promise.all(orden.map(x => getUsuario(x).catch(() => null)));
  if(tok !== state.tok) return;
  cont.innerHTML = `<div class="subtitulo"><h3 class="titulo-bloque">Amigos · ${lista.length}</h3></div>
    <div class="grilla-amigos">${orden.map(x => { const v = state.usuarios[x]; if(!v) return '';
      return `<button class="amigo-mini" data-usuario="${esc(x)}" title="${esc(nombreVisible(v))}">${avatarMini(v)}<span>${esc(nombreVisible(v))}</span>${mios.has(x) ? '<small>en común</small>' : ''}</button>`; }).join('')}</div>`;
}

// ---------- Bandeja de chats ----------
function abrirChats(){
  ir('chats', { abrir: abrirChats });
  renderChats();
}

// Lista de chats (y solicitudes de mensaje).
async function renderChats(){
  const tok = state.tok;
  const cont = document.getElementById('lista-chats');
  const todas = state.dms.filter(d => d.ultimoTs && !state.bloqueados.has(otroDe(d.id))).sort((a,b) => b.ultimoTs - a.ultimoTs);
  const solicitudes = todas.filter(esSolicitudRecibida);
  const lista = todas.filter(d => !esSolicitudRecibida(d) && !(d.estado === 'rechazado' && d.solicitante !== state.uid && !esAmigo(otroDe(d.id))));
  const verSol = state.verSolicitudesDM && solicitudes.length;
  const cabecera = solicitudes.length ? `<div class="solicitudes-dm" role="button" tabindex="0" onclick="state.verSolicitudesDM=!state.verSolicitudesDM; renderChats();">
      <div class="ico">✉️</div><div style="flex:1;"><b>Solicitudes de mensajes (${solicitudes.length})</b><span>${verSol ? 'Tocá para volver a tus chats' : 'Personas que no son tus amigos quieren escribirte'}</span></div><span class="ir" style="color:var(--gris); font-size:20px;">${verSol ? '×' : '›'}</span></div>` : '';
  if(!lista.length && !solicitudes.length){
    cont.innerHTML = amigosUids().length
      ? emptyState('Todavía no tenés conversaciones. Tocá el lápiz para escribirle a un amigo, o mandale una fiesta desde el detalle de un evento.')
      : `<div class="empty-cta">Para chatear, primero agregá amigos.<button class="btn btn-primario btn-mini" onclick="abrirAmigos()">Buscar amigos</button></div>`;
    return;
  }
  const mostrar = verSol ? solicitudes : lista;
  await Promise.all(mostrar.map(d => getUsuario(otroDe(d.id))));
  if(tok !== state.tok) return;
  cont.innerHTML = cabecera + (mostrar.length ? mostrar.map(d => {
    const otro = otroDe(d.id);
    const u = state.usuarios[otro] || { uid: otro, nombre: 'Usuario' };
    const nl = noLeido(d), escribe = estaEscribiendo(d, otro);
    const est = estadoDM(otro, d);
    const tag = est === 'enviada' ? '<span class="tag-solicitud">Pendiente</span>' : est === 'recibida' ? '<span class="tag-solicitud">Solicitud</span>' : '';
    const prev = escribe ? 'escribiendo…' : (d.ultimoDe === state.uid ? 'Vos: ' : '') + (d.ultimoMsg || '');
    return `<div class="persona ${nl ? 'noleido' : ''}" data-chat="${esc(otro)}" role="button" tabindex="0">
      <div class="avatar">${avatarHTML(u)}${puntoLinea(u)}</div>
      <div class="txt"><h5>${esc(nombreVisible(u))}${insignia(u)}${tag}</h5><span class="${escribe ? 'escribe' : ''}">${esc(prev)}</span></div>
      <div class="meta-chat">${esc(cuandoChat(d.ultimoTs))}${nl ? '<span class="punto-noleido"></span>' : ''}</div>
    </div>`;
  }).join('') : emptyState('No tenés conversaciones todavía.'));
}

// Elegir un amigo para empezar a chatear.
async function nuevoChat(){
  if(!amigosUids().length){ abrirAmigos(); toast('Primero agregá amigos para chatear'); return; }
  const elegidos = await elegirAmigos('Nuevo mensaje', 'Elegí a quién escribirle.', false);
  if(elegidos.length) abrirDM(elegidos[0]);
}

// ---------- Conversación ----------
async function pintarTopChat(){
  const uid = state.dmActual?.uid;
  if(!uid) return;
  const u = await getUsuario(uid);
  const top = document.getElementById('chat-top-persona');
  if(state.dmActual?.uid !== uid || !top || !u) return;
  const escribe = estaEscribiendo(dmDoc(state.dmActual.pid), uid);
  const e = escribe ? { txt: 'escribiendo…', escribe: true } : estadoLineaChat(u);
  top.innerHTML = `<div class="avatar">${avatarHTML(u)}${puntoLinea(u)}</div><b>${esc(nombreVisible(u))}${insignia(u)}${e ? `<span class="sub ${e.on ? 'on' : ''} ${e.escribe ? 'escribe' : ''}">${esc(e.txt)}</span>` : ''}</b>`;
  document.getElementById('dm-escribiendo').classList.toggle('on', !!escribe);
}
// Datos del chat con un par (si existe).
function dmDoc(pid){ return state.dms.find(d => d.id === pid) || null; }
// Marca la conversación como leída hasta el último mensaje (solo si hace falta)
function marcarDMVisto(pid, msgs){
  const act = state.dmActual;
  if(!act || act.pid !== pid || pantallaActual() !== 'chat' || document.visibilityState === 'hidden') return;
  const d = dmDoc(pid);
  if(d && estadoDM(act.uid, d) === 'rechazada-por-otro') return;
  const ultOtro = [...(msgs || [])].reverse().find(m => m.de !== state.uid);
  const hasta = Math.max(d?.ultimoDe !== state.uid ? (d?.ultimoTs || 0) : 0, ultOtro?.ts || 0);
  if(!hasta || (d?.vistoPor?.[state.uid] || 0) >= hasta) return;
  const marca = Math.max(Date.now(), hasta);
  if(d) d.vistoPor = { ...(d.vistoPor || {}), [state.uid]: marca };
  actualizarBadges();
  DataService.marcarVisto(pid, act.miembros, state.uid, hasta).catch(() => {});
}
// ¿La otra persona está escribiendo ahora?
function estaEscribiendo(d, uid){ return !!d && (d.escribiendo?.[uid] || 0) > Date.now() - 6000 && (d.escribiendo[uid] > (d.ultimoDe === uid ? d.ultimoTs : 0)); }
// ¿Somos amigos?
function esAmigo(uid){ return amistad(uid)?.estado === 'aceptada'; }
// amigos | aceptado | nueva | enviada | recibida | rechazada-por-otro | rechazada-por-mi
function estadoDM(uid, d){
  if(esAmigo(uid)) return 'amigos';
  if(!d) return 'nueva';
  if(d.estado === 'aceptado') return 'aceptado';
  if(d.estado === 'solicitud') return d.solicitante === state.uid ? 'enviada' : 'recibida';
  if(d.estado === 'rechazado') return d.solicitante === state.uid ? 'rechazada-por-otro' : 'rechazada-por-mi';
  return 'nueva';
}
// ¿Este chat es una solicitud de mensaje que me mandaron?
function esSolicitudRecibida(d){ const o = otroDe(d.id); return !esAmigo(o) && d.estado === 'solicitud' && d.solicitante !== state.uid; }
// Barra de "solicitud de mensaje" (aceptar/rechazar) o aviso de pendiente.
async function pintarEstadoDM(){
  const act = state.dmActual;
  if(!act) return;
  const d = dmDoc(act.pid), est = estadoDM(act.uid, d);
  const u = await getUsuario(act.uid);
  if(state.dmActual?.pid !== act.pid) return;
  const nom = esc(nombreCorto(u));
  const aviso = document.getElementById('dm-aviso'), caja = document.getElementById('dm-caja'), rap = document.getElementById('dm-rapidos');
  let html = '', bloq = false;
  if(est === 'nueva' && u?.mensajesDe === 'amigos'){ html = `<div class="dm-aviso"><b>🔒 ${nom} solo recibe mensajes de amigos</b>Mandale una solicitud de amistad desde su perfil.</div>`; bloq = true; }
  else if(est === 'nueva') html = `<div class="dm-aviso"><b>✉️ Solicitud de mensaje</b>No son amigos todavía: tu primer mensaje le llega a ${nom} como solicitud, y lo ve cuando la acepte.</div>`;
  else if(est === 'enviada') html = `<div class="dm-aviso"><b>⏳ Esperando que ${nom} acepte</b>Podés seguir escribiendo; le llega todo junto cuando acepte tu solicitud.</div>`;
  else if(est === 'recibida'){ html = `<div class="dm-aviso"><b>✉️ ${nom} quiere mandarte un mensaje</b>No son amigos. Si aceptás, pueden chatear. Si rechazás, no le avisamos y no te puede escribir más.
      <div class="fila"><button class="btn btn-secundario" data-sol-dm="rechazar">Rechazar</button><button class="btn btn-primario" data-sol-dm="aceptar">Aceptar</button></div>
      <div class="fila"><button class="btn btn-secundario" data-bloquear="${esc(act.uid)}">Bloquear</button><button class="btn btn-secundario" data-usuario="${esc(act.uid)}">Ver perfil</button></div></div>`; bloq = true; }
  else if(est === 'rechazada-por-otro'){ html = `<div class="dm-aviso"><b>No podés enviar más mensajes</b>${nom} no aceptó la solicitud de mensaje.</div>`; bloq = true; }
  else if(est === 'rechazada-por-mi'){ html = `<div class="dm-aviso"><b>Rechazaste esta solicitud</b>${nom} no te puede escribir.<div class="fila"><button class="btn btn-primario" data-sol-dm="aceptar">Aceptar ahora</button></div></div>`; bloq = true; }
  aviso.innerHTML = html;
  caja.classList.toggle('bloqueado', bloq); rap.style.display = bloq ? 'none' : '';
  document.getElementById('dm-input').disabled = bloq;
  aviso.querySelectorAll('[data-sol-dm]').forEach(b => b.onclick = () => responderSolicitudMensaje(b.dataset.solDm === 'aceptar', b));
}
// Acepta o rechaza una solicitud de mensaje.
async function responderSolicitudMensaje(aceptar, btn){
  const act = state.dmActual;
  if(!act) return;
  if(btn) btn.disabled = true;
  try{
    await DataService.responderSolicitudDM(act.pid, act.miembros, state.uid, aceptar);
    const d = dmDoc(act.pid); if(d) d.estado = aceptar ? 'aceptado' : 'rechazado';
    if(aceptar){ notificar(act.uid, 'mensaje_aceptado'); toast('¡Listo! Ya pueden chatear'); }
    else toast('Solicitud rechazada');
    pintarEstadoDM();
    if(!aceptar) volver(abrirChats);
  } catch(e){ console.error(e); toast('No se pudo responder'); if(btn) btn.disabled = false; }
}
// Abre el chat privado con alguien.
async function abrirDM(uid){
  if(!uid || uid === state.uid) return;
  if(state.bloqueados.has(uid)){ toast('Bloqueaste a esta persona'); return; }
  const pid = parId(state.uid, uid);
  state.dmActual = { pid, uid, miembros: pid.split('_') };
  state.dmMsgs = []; state.dmIds = null;
  document.getElementById('dm-aviso').innerHTML = '';
  document.getElementById('dm-escribiendo').classList.remove('on');
  pintarEstadoDM();
  ir('chat', { clave: 'chat:' + uid, abrir: () => abrirDM(uid) });

  const top = document.getElementById('chat-top-persona');
  top.dataset.usuario = uid;
  top.innerHTML = '';
  document.getElementById('dm-mensajes').innerHTML = emptyState('Cargando...');
  pintarTopChat();
  refrescarUsuarios([uid]).then(pintarTopChat);

  if(state.dmUnsub) state.dmUnsub();
  state.dmUnsub = DataService.escucharMensajesDM(pid, msgs => {
    if(state.dmActual?.pid !== pid) return;
    state.dmMsgs = msgs;
    renderDM(msgs);
    // Marca "visto" solo si hay algo nuevo del otro (ahorra escrituras)
    marcarDMVisto(pid, msgs);
  }, e => {
    console.warn('dm', e);
    document.getElementById('dm-mensajes').innerHTML = emptyState('No se pudo cargar la conversación.');
  });
}

// ¿El mensaje es solo emojis? (se muestran grandes).
function soloEmoji(t){ return !!t && t.length <= 8 && /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(t) && !/^[\d#*\s]+$/.test(t); }
// Separador de día en el chat: "Hoy", "Ayer", fecha.
function etiquetaDia(ts){
  const d = new Date(ts), h = new Date(), ay = new Date(Date.now() - 864e5);
  if(d.toDateString() === h.toDateString()) return 'Hoy';
  if(d.toDateString() === ay.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}
// Burbuja de un mensaje privado (texto o evento compartido).
function mensajeDMHTML(m, extra){
  const propio = m.de === state.uid;
  let cuerpo = m.texto ? esc(m.texto) : '';
  if(m.tipo === 'evento' && m.eventoId){
    const ev = eventoEnCache(m.eventoId);
    const detalle = [m.eventoFechaTs ? fmtFecha(m.eventoFechaTs) : '', m.eventoLugar || ''].filter(Boolean).join(' · ');
    cuerpo += `<div class="msj-evento" data-abrir="${esc(m.eventoId)}" role="button" tabindex="0">
        <div class="foto-mini" style="background-image:${ev ? cssFoto(ev) : cssUrl('')}"></div>
        <div><b>${esc(m.eventoNombre || 'Evento')}</b><span>${esc(detalle)}</span></div>
      </div>`;
  }
  if(!propio) state.msgsVistos[m.id] = { ...m, _ambito: 'dm', _chat: state.dmActual?.pid };
  const e = extra || {};
  const check = propio ? `<span class="check ${e.visto ? 'visto' : ''}" title="${e.visto ? 'Visto' : 'Enviado'}">${e.visto ? '✓✓' : '✓'}</span>` : '';
  const clases = ['msj', propio ? 'propio' : '', e.seguido ? 'seguido' : '', e.nuevo ? 'nuevo' : '', m.tipo !== 'evento' && soloEmoji(m.texto) ? 'solo-emoji' : ''].join(' ');
  return `<div class="${clases}" ${propio ? '' : `data-msg="${esc(m.id)}" title="Tocá para denunciar"`}>${cuerpo}<span class="hora">${esc(horaCorta(m.ts))}${check}</span></div>`;
}

// Pinta la conversación privada.
function renderDM(msgs){
  const cont = document.getElementById('dm-mensajes');
  const pantalla = document.getElementById('pantalla-chat');
  const act = state.dmActual;
  if(!act) return;
  const cerca = pantalla.scrollHeight - pantalla.scrollTop - pantalla.clientHeight < 160;
  const primera = !state.dmIds;
  const vistos = state.dmIds || new Set();
  state.dmLlegada = state.dmLlegada || {};
  const ahoraR = Date.now();
  if(!primera) msgs.forEach(m => { if(!vistos.has(m.id)) state.dmLlegada[m.id] = ahoraR; });
  const d = dmDoc(act.pid), vistoOtro = d?.vistoPor?.[act.uid] || 0;
  if(!msgs.length){
    cont.innerHTML = emptyState(esAmigo(act.uid) ? 'Escribí el primer mensaje. También podés mandarle una fiesta desde el detalle de cualquier evento.' : 'Escribí tu primer mensaje.');
    state.dmIds = new Set(); return;
  }
  const ultimoPropio = [...msgs].reverse().find(m => m.de === state.uid);
  let html = '', diaAnt = '', prev = null;
  msgs.forEach(m => {
    const dia = etiquetaDia(m.ts);
    if(dia !== diaAnt){ html += `<div class="dia-sep">${esc(dia)}</div>`; diaAnt = dia; prev = null; }
    const seguido = prev && prev.de === m.de && m.ts - prev.ts < 3 * 60e3;
    html += mensajeDMHTML(m, { seguido, nuevo: ahoraR - (state.dmLlegada[m.id] || 0) < 450, visto: m.de === state.uid && vistoOtro >= m.ts });
    prev = m;
  });
  if(ultimoPropio && msgs[msgs.length - 1].de === state.uid){
    const visto = vistoOtro >= ultimoPropio.ts;
    html += `<div class="visto-txt ${visto ? 'si' : ''}">${visto ? 'Visto ' + esc(cuandoChat(vistoOtro)) : 'Enviado'}</div>`;
  }
  cont.innerHTML = html;
  state.dmIds = new Set(msgs.map(m => m.id));
  if(primera || cerca || msgs[msgs.length - 1].de === state.uid) { if(pantalla.scrollTo) pantalla.scrollTo({ top: pantalla.scrollHeight, behavior: primera ? 'auto' : 'smooth' }); else pantalla.scrollTop = pantalla.scrollHeight; }
}

// Manda el texto escrito (o una respuesta rápida).
async function enviarDMTexto(textoRapido){
  const input = document.getElementById('dm-input');
  const texto = (typeof textoRapido === 'string' ? textoRapido : input.value).trim();
  if(!texto || !state.dmActual || input.disabled) return;
  if(typeof textoRapido !== 'string') input.value = '';
  const { pid, miembros, uid } = state.dmActual;
  const est = estadoDM(uid, dmDoc(pid));
  const extra = est === 'nueva' ? { estado: 'solicitud', solicitante: state.uid } : {};
  const btn = document.getElementById('dm-enviar');
  btn.classList.remove('vuela'); void btn.offsetWidth; btn.classList.add('vuela');
  try{
    await DataService.enviarDM(pid, miembros, state.uid, { de: state.uid, tipo: 'texto', texto, ts: Date.now() }, texto.slice(0, 100), extra);
    if(est === 'nueva'){
      state.dms = state.dms.filter(d => d.id !== pid).concat([{ id: pid, miembros, estado: 'solicitud', solicitante: state.uid, ultimoTs: Date.now(), ultimoDe: state.uid, ultimoMsg: texto.slice(0, 100) }]);
      notificar(uid, 'mensaje_solicitud');
      pintarEstadoDM();
    }
  } catch(e){
    console.error(e);
    toast('No se pudo enviar');
    if(typeof textoRapido !== 'string') input.value = texto;
  }
}
// "escribiendo…": avisa como mucho cada 2,5 segundos mientras tipeás
let _ultEscribe = 0;
// Avisa al otro que estoy escribiendo (como mucho cada pocos segundos).
function avisarQueEscribo(){
  const act = state.dmActual;
  if(!act || Date.now() - _ultEscribe < 2500) return;
  const est = estadoDM(act.uid, dmDoc(act.pid));
  if(!['amigos', 'aceptado', 'enviada'].includes(est) || !dmDoc(act.pid)) return;
  _ultEscribe = Date.now();
  DataService.marcarEscribiendo(act.pid, act.miembros, state.uid).catch(() => {});
}
setInterval(() => { if(state.dmActual && pantallaActual() === 'chat') pintarTopChat(); }, 2000);

// ---------- Elegir amigos (hoja) ----------
function elegirAmigos(titulo, sub, multiple){
  return new Promise(async resolve => {
    const bg = document.getElementById('hoja-amigos');
    const lista = document.getElementById('hoja-lista');
    const ok = document.getElementById('hoja-ok');
    const cancel = document.getElementById('hoja-cancelar');
    document.getElementById('hoja-titulo').textContent = titulo;
    document.getElementById('hoja-sub').textContent = sub || '';

    const uids = amigosUids();
    try{ await Promise.all(uids.map(u => getUsuario(u).catch(() => null))); } catch(e){}
    const amigos = uids.map(u => state.usuarios[u]).filter(Boolean).sort((a,b) => nombreVisible(a).localeCompare(nombreVisible(b)));
    lista.innerHTML = amigos.length ? amigos.map(u => `
      <div class="sel-amigo" role="checkbox" aria-checked="false" tabindex="0" data-sel="${esc(u.uid)}">
        <div class="avatar">${avatarHTML(u)}</div><div class="nom">${esc(nombreVisible(u))}</div><div class="check"></div>
      </div>`).join('') : emptyState('Todavía no tenés amigos.');

    const elegidos = () => [...lista.querySelectorAll('.sel-amigo.on')].map(e => e.dataset.sel);
    const done = v => {
      bg.classList.remove('show');
      lista.onclick = ok.onclick = cancel.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = e => { if(e.key === 'Escape') done([]); };
    ok.style.display = multiple ? '' : 'none';
    ok.disabled = true;
    ok.textContent = 'Enviar';
    lista.onclick = e => {
      const it = e.target.closest('.sel-amigo');
      if(!it) return;
      if(!multiple){ done([it.dataset.sel]); return; }
      it.classList.toggle('on');
      it.setAttribute('aria-checked', it.classList.contains('on'));
      const n = elegidos().length;
      ok.disabled = n === 0;
      ok.textContent = n > 1 ? `Enviar a ${n}` : 'Enviar';
    };
    ok.onclick = () => done(elegidos());
    cancel.onclick = () => done([]);
    document.addEventListener('keydown', onKey);
    bg.classList.add('show');
  });
}

// ---------- Compartir ----------
async function compartirLink(titulo, texto, url){
  if(navigator.share){
    try{ await navigator.share({ title: titulo, text: texto, url }); return; }
    catch(e){ if(e.name === 'AbortError') return; }
  }
  try{
    await navigator.clipboard.writeText(url);
    toast('Link copiado. Pegalo donde quieras.');
  } catch(e){
    await confirmar('Copiá este link', url, 'Listo');
  }
}
// Compartir el link de un evento (menú del celular o copiar).
function compartirEvento(ev){
  compartirLink(ev.nombre, `${ev.nombre} · ${fmtFecha(ev.fechaTs)} hs — mirala en Partazy`, urlApp('evento/' + ev.id));
}
// Compartir el link de mi perfil.
function compartirMiPerfil(){
  compartirLink('Partazy', 'Agregame en Partazy para ver a qué fiestas voy 🔥', urlApp('u/' + state.uid));
}

// Mandar un evento por chat a uno o varios amigos.
async function enviarEventoAAmigos(ev){
  if(!amigosUids().length){
    const ok = await confirmar('Todavía no tenés amigos', 'Agregá amigos en Partazy para mandarles fiestas por chat. Mientras tanto, podés compartir el link por WhatsApp u otra app.', 'Buscar amigos');
    if(ok) abrirAmigos();
    return;
  }
  const uids = await elegirAmigos('Enviar a amigos', ev.nombre, true);
  if(!uids.length) return;
  const msg = {
    de: state.uid, tipo: 'evento', texto: '',
    eventoId: ev.id, eventoNombre: ev.nombre, eventoFechaTs: ev.fechaTs, eventoLugar: lugarPublico(ev),
    ts: Date.now()
  };
  const res = await Promise.allSettled(uids.map(uid => {
    const pid = parId(state.uid, uid);
    return DataService.enviarDM(pid, pid.split('_'), state.uid, msg, '🎉 ' + ev.nombre);
  }));
  const okN = res.filter(r => r.status === 'fulfilled').length;
  if(okN === uids.length) toast(okN === 1 ? 'Enviado' : `Enviado a ${okN} amigos`);
  else toast(okN ? `Enviado a ${okN} de ${uids.length}` : 'No se pudo enviar');
}

// ---------- Links directos (#/evento/ID y #/u/UID) ----------
function fijarRuta(ruta){
  try{ history.replaceState(null, '', ruta ? '#/' + ruta : location.pathname + location.search); } catch(e){}
}
// Abre lo que indica un link #/evento/... o #/u/...
function abrirRuta(hash){
  const m = String(hash || '').match(/^#\/(evento|u)\/([A-Za-z0-9_-]{1,64})$/);
  if(!m) return false;
  if(m[1] === 'evento') abrirDetalle(m[2]);
  else abrirUsuario(m[2]);
  return true;
}
window.addEventListener('hashchange', () => { if(Date.now() - NAV.popTs < 600) return; if(state.perfil || state.invitado) abrirRuta(location.hash); });

// =========================================================
//  NAVEGACIÓN
// =========================================================
// Historial: cada pantalla recuerda de dónde viniste, y el botón "atrás" del celular también funciona
const NAV = { pila: [], actual: null, clave: null, abrir: null, volviendo: false, popTs: 0, modalHist: false, ignorarPop: false };
// Los paneles grandes (tutorial, guía de colores) ocupan un paso del historial: "atrás" los cierra
function abrirModalHist(){ if(NAV.modalHist) return; try{ history.pushState({ partazyModal: 1 }, '', location.href); NAV.modalHist = true; } catch(e){} }
// Saca del historial el paso que agregó un panel al abrirse.
function soltarModalHist(){ if(!NAV.modalHist) return; NAV.modalHist = false; NAV.ignorarPop = true; try{ history.back(); } catch(e){ NAV.ignorarPop = false; } }
const SIN_HISTORIAL = ['bienvenida', 'registro', 'suspendido', 'confirmacion', 'crear'];
// Botón Volver: usa el historial del navegador (o un destino por defecto).
function volver(fallback){
  if(NAV.pila.length){
    const antes = NAV.pila.length;
    try{ history.back(); } catch(e){}
    // Por si el navegador no avisa (raro): volvemos igual
    setTimeout(() => { if(NAV.pila.length === antes) volverManual(); }, 450);
    return;
  }
  if(typeof fallback === 'function') fallback(); else ir(fallback || 'home');
}
// Vuelve a la pantalla anterior sin el historial del navegador.
function volverManual(){
  const prev = NAV.pila.pop();
  if(!prev) return false;
  NAV.volviendo = true;
  try{ prev(); } finally { NAV.volviendo = false; }
  return true;
}
// Cierra la ventana o panel que esté abierto (para el "atrás" del celular).
function cerrarModalAbierto(){
  const abierto = document.querySelector('.tuto-bg.show, .modal-bg.show, .mapa-bg.show, .hoja-bg.show');
  if(!abierto) return false;
  if(abierto.id === 'tutorial') cerrarTutorial();
  else if(abierto.id === 'modal-mapa') cerrarMapa();
  else if(abierto.id === 'modal-rango') cerrarRango();
  else if(abierto.id === 'hoja-vista') cerrarHoja(false);
  else if(abierto.id === 'hoja-cuenta') cerrarPedirCuenta();
  else if(abierto.id === 'menu-perfil') cerrarMenuPerfil();
  else if(abierto.id === 'modal-referencias') cerrarReferencias();
  else {
    const cancelar = [...abierto.querySelectorAll('button')].find(b => /cancelar|cerrar/i.test(b.id + ' ' + b.textContent));
    if(cancelar) cancelar.click(); else abierto.classList.remove('show');
  }
  return true;
}
window.addEventListener('popstate', () => {
  NAV.popTs = Date.now();
  if(NAV.ignorarPop){ NAV.ignorarPop = false; return; }
  if(NAV.modalHist){ NAV.modalHist = false; cerrarModalAbierto(); return; }
  if(cerrarModalAbierto()){ try{ history.pushState({ partazy: 1 }, '', location.href); } catch(e){} return; }
  volverManual();
});

const PANTALLAS_INVITADO = ['home', 'explorar', 'detalle', 'ayuda', 'privacidad', 'terminos', 'bienvenida', 'registro'];
// Cambia de pantalla. En modo invitado, las pantallas que piden cuenta abren el aviso.
function ir(nombre, opts){
  if(state.invitado && !PANTALLAS_INVITADO.includes(nombre)){ pedirCuenta(MOTIVOS_PANTALLA[nombre]); return; }
  const clave = opts?.clave || nombre;
  if(!NAV.volviendo && NAV.actual && NAV.clave !== clave && !SIN_HISTORIAL.includes(NAV.actual)){
    NAV.pila.push(NAV.abrir || (n => () => ir(n))(NAV.actual));
    if(NAV.pila.length > 60) NAV.pila.shift();
    try{ history.pushState({ partazy: NAV.pila.length }, '', location.href); } catch(e){}
  }
  if(NAV.actual === 'perfil' && nombre !== 'perfil' && document.getElementById('form-perfil')?.style.display === 'flex') cancelarEdicionPerfil();
  NAV.actual = nombre; NAV.clave = clave; NAV.abrir = opts?.abrir || null;
  state.tok++;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('activa'));
  const destino = document.getElementById('pantalla-' + nombre);
  if(nombre === 'crear' && state.editandoId && !state.abriendoEdicion) resetFormularioCrear();
  if(nombre !== 'chat'){ state.dmActual = null; }
  if(destino){
    destino.classList.add('activa'); destino.scrollTop = 0;
    destino.classList.remove('entrando'); void destino.offsetWidth; destino.classList.add('entrando');
    clearTimeout(destino._tEntrada); destino._tEntrada = setTimeout(() => destino.classList.remove('entrando'), 1100);
  }
  document.querySelectorAll('.nav-item').forEach(n => { n.classList.remove('activo'); n.removeAttribute('aria-current'); });
  const navMap = {home:'home', explorar:'explorar', crear:'crear', ticket:'perfil', perfil:'perfil', detalle:'explorar', confirmacion:'crear',
                  chats:'chats', chat:'chats', amigos:'perfil', usuario:'perfil', moderacion:'perfil', notificaciones:'home', verificacion:'perfil', puerta:'explorar', ayuda:'perfil', privacidad:'perfil', bienvenida:null, registro:null, suspendido:null};
  const activo = document.querySelector('[data-nav="'+ (navMap[nombre] || nombre) +'"]');
  if(activo){ activo.classList.add('activo'); activo.setAttribute('aria-current','page'); }
  if((nombre === 'home' || nombre === 'explorar') && state._feedSucio){ state._feedSucio = false; renderHome(); renderExplorar(); }
  if(nombre === 'explorar' && state.vistaExplorar === 'mapa') setTimeout(() => pintarMapaEventos(), 80);
  const esc = document.querySelector('[data-nav-esc="' + nombre + '"]');
  if(esc && window.matchMedia && matchMedia('(min-width:900px)').matches){
    if(activo){ activo.classList.remove('activo'); activo.removeAttribute('aria-current'); }
    esc.classList.add('activo'); esc.setAttribute('aria-current', 'page');
  }
  if(nombre !== 'ticket' && state.chatUnsub){ state.chatUnsub(); state.chatUnsub = null; }
  if(nombre !== 'puerta' && typeof Puerta !== 'undefined' && Puerta.escaner) detenerEscaner();
  if(nombre !== 'chat' && state.dmUnsub){ state.dmUnsub(); state.dmUnsub = null; state.dmActual = null; }
  // Sin barra inferior en el ingreso y dentro de una conversación
  document.getElementById('app').classList.toggle('sin-nav', ['bienvenida','registro','chat','suspendido'].includes(nombre));
  // El link de la barra de direcciones solo apunta a eventos o perfiles
  if(nombre !== 'detalle' && nombre !== 'usuario') fijarRuta('');
}

// Eventos a los que voy (confirmado o aprobado) que todavía no pasaron.
async function proximasEntradas(){
  const asis = (await DataService.listAsistenciasDe(state.uid))
    .filter(a => a.estado === 'confirmado' || a.estado === 'aprobado');
  const evs = (await Promise.all(asis.map(a => eventoPorId(a.eventId)))).filter(Boolean);
  const desde = Date.now() - 6 * HORA;
  return evs.filter(e => e.fechaTs >= desde).sort((a,b) => a.fechaTs - b.fechaTs);
}

// Mis entradas: abre la única o muestra la lista.
async function irAMisEntradas(){
  ir('ticket', { clave: 'ticket', abrir: irAMisEntradas });
  const tok = state.tok;
  const cont = document.getElementById('ticket-contenido');
  cont.innerHTML = '<div class="empty-state" style="padding-top:60px;">Cargando...</div>';
  try{
    const prox = await proximasEntradas();
    if(tok !== state.tok) return;
    if(prox.length === 1) return abrirTicket(prox[0].id);
    if(prox.length > 1){
      cont.innerHTML = `<div style="padding:10px 20px 14px;"><h2 style="font-family:var(--font-display); text-transform:uppercase; font-size:26px;">Mis entradas</h2>
        <p style="color:var(--gris); font-size:13px; margin-top:2px;">Tenés ${prox.length} eventos. Tocá uno para ver tu entrada y el grupo.</p></div>
        <div class="lista-entradas">${prox.map(e => `
          <div class="entrada-mini" role="button" tabindex="0" data-ticket="${esc(e.id)}">
            <div class="foto-mini" style="background-image:${cssFoto(e)}"></div>
            <div class="txt"><h5>${esc(e.nombre)}</h5><span>${esc(fmtFecha(e.fechaTs))} hs · ${esc(lugarPublico(e))}</span>${e.creador === state.uid ? '<span class="badge-org">Organizás</span>' : ''}${esCancelado(e) ? '<span style="color:var(--peligro); font-weight:700;">Cancelado</span>' : ''}</div>
            <div class="ir">Ver<br>entrada</div>
          </div>`).join('')}</div>`;
      return;
    }
    cont.innerHTML = emptyState('Todavía no tenés entradas para próximos eventos. Confirmá tu asistencia a uno desde Explorar.');
  } catch(e){
    console.error(e);
    if(tok === state.tok) cont.innerHTML = emptyState('No pudimos cargar tus entradas.');
  }
}

// Delegación: un solo listener para todas las tarjetas y botones dinámicos
document.addEventListener('click', e => {
  const estrella = e.target.closest('[data-estrella]');
  if(estrella){
    const g = estrella.parentElement, v = +estrella.dataset.estrella;
    g.dataset.valor = v;
    g.querySelectorAll('[data-estrella]').forEach(x => { const on = +x.dataset.estrella <= v; x.classList.toggle('on', on); x.setAttribute('aria-checked', +x.dataset.estrella === v); });
    const et = g.closest('.calif-fila')?.querySelector('.valor-txt'); if(et) et.textContent = ETIQUETA_NOTA[v];
    return;
  }
  const ed = e.target.closest('[data-editar]');
  if(ed){ e.stopPropagation(); (async () => { const ev = await eventoActual(ed.dataset.editar); if(ev) editarEvento(ev); })(); return; }
  const exp = e.target.closest('[data-exportar]');
  if(exp){ const [id, fmt] = exp.dataset.exportar.split('|'); exportarLista(id, fmt, exp); return; }
  const edN = e.target.closest('[data-editar-nota]');
  if(edN){ e.stopPropagation(); editarNotaCompartido(edN.dataset.editarNota); return; }
  const boN = e.target.closest('[data-borrar-nota]');
  if(boN){ e.stopPropagation(); borrarNotaCompartido(boN.dataset.borrarNota); return; }
  const sal = e.target.closest('[data-salir]');
  if(sal){ const [id, est] = sal.dataset.salir.split('|'); salirDelEvento(id, est); return; }
  const yc = e.target.closest('[data-ya-compre]');
  if(yc){ yaCompreEntrada(yc.dataset.yaCompre); return; }
  const envCal = e.target.closest('[data-enviar-calif]');
  if(envCal){ enviarCalificacion(envCal.dataset.enviarCalif, envCal); return; }
  const vista = e.target.closest('[data-vista]');
  if(vista){ e.preventDefault(); abrirVistaRapida(vista.dataset.vista); return; }
  const accionA = e.target.closest('[data-amigo-accion]');
  if(accionA){ accionAmistad(accionA); return; }
  const dm = e.target.closest('[data-dm]');
  if(dm){ abrirDM(dm.dataset.dm); return; }
  const chat = e.target.closest('[data-chat]');
  if(chat){ abrirDM(chat.dataset.chat); return; }
  const usuario = e.target.closest('[data-usuario]');
  if(usuario){ abrirUsuario(usuario.dataset.usuario); return; }
  const interes = e.target.closest('[data-interes]');
  if(interes){
    interes.classList.toggle('activo');
    interes.setAttribute('aria-pressed', interes.classList.contains('activo'));
    return;
  }
  const abrir = e.target.closest('[data-abrir]');
  if(abrir){ abrirDetalle(abrir.dataset.abrir); return; }
  const ticket = e.target.closest('[data-ticket]');
  if(ticket){ abrirTicket(ticket.dataset.ticket); return; }
  const sol = e.target.closest('[data-solicitud]');
  if(sol){ responderSolicitud(sol.dataset.evento, sol.dataset.solicitud, sol.dataset.accion === 'aprobar', sol); return; }
  const seg = e.target.closest('[data-seguir]');
  if(seg){ alternarSeguir(seg); return; }
  const chk = e.target.closest('[data-checkin]');
  if(chk){ const a = Puerta.asistentes.find(x => x.uid === chk.dataset.checkin); if(a) registrarIngreso(a); return; }
  const acr = e.target.closest('[data-acred]');
  if(acr){ responderAcreditacion(acr); return; }
  const notif = e.target.closest('[data-notif]');
  if(notif){ abrirNotificacion(notif.dataset.notif); return; }
  const tc = e.target.closest('[data-tipo-cuenta]');
  if(tc){ elegirTipoCuenta(tc.parentElement.id, tc.dataset.tipoCuenta); return; }
  const verif = e.target.closest('[data-verif]');
  if(verif){ accionVerificacion(verif); return; }
  const mod = e.target.closest('[data-mod]');
  if(mod){ accionModeracion(mod); return; }
  const bloq = e.target.closest('[data-bloquear]');
  if(bloq){ bloquearUsuario(bloq.dataset.bloquear); return; }
  const desb = e.target.closest('[data-desbloquear]');
  if(desb){ desbloquearUsuario(desb.dataset.desbloquear); return; }
  const denU = e.target.closest('[data-denunciar-usuario]');
  if(denU){ denunciarUsuario(denU.dataset.denunciarUsuario); return; }
  const msg = e.target.closest('[data-msg]');
  if(msg){ const m = state.msgsVistos[msg.dataset.msg]; if(m) denunciarMensaje(m, m._ambito, m._chat); }
});
// Teclado: Enter / Espacio activan elementos con rol de botón o switch
document.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button],[role=switch],[role=checkbox]') && e.target.tagName !== 'BUTTON'){
    e.preventDefault(); e.target.click();
  }
});
// Hace usables con teclado los elementos con onclick (role, tabindex, Enter).
function hacerAccesibles(){
  document.querySelectorAll('.chip[onclick], .icon-btn[onclick], .buscador[onclick], .seccion-titulo span[onclick], .toggle-tipo .op').forEach(el => {
    el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0');
  });
}

// =========================================================
//  TARJETAS
// =========================================================
const svgLock = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const AMBIENTES = ['verde','amarillo','rojo'];
const AVISO_DEVOLUCIONES = 'Estamos trabajando en un sistema seguro para devoluciones de dinero.';

// =========================================================
//  PORTADAS PREDISEÑADAS (eventos sin foto)
// =========================================================
const ESTILO_PORTADA = {
  techno:      { c1:'#120A24', c2:'#2B0F4C', ac:'#8B5CF6', pat:'grid',     mot:'onda',   w:'TECHNO' },
  electronica: { c1:'#071A2B', c2:'#0F3B5C', ac:'#22D3EE', pat:'circulos', mot:'onda',   w:'ELECTRO' },
  house:       { c1:'#2A0B2E', c2:'#C2410C', ac:'#F59E0B', pat:'sol',      mot:'sol',    w:'HOUSE' },
  cachengue:   { c1:'#2B0A05', c2:'#C2410C', ac:'#F26A1B', pat:'rayas',    mot:'llama',  w:'CACHENGUE' },
  cuarteto:    { c1:'#2A0A0A', c2:'#B91C1C', ac:'#FACC15', pat:'zigzag',   mot:'notas',  w:'CUARTETO' },
  reggaeton:   { c1:'#1A0A1E', c2:'#9D174D', ac:'#F472B6', pat:'rayas',    mot:'llama',  w:'REGGAETÓN' },
  cumbia:      { c1:'#052421', c2:'#0F766E', ac:'#4CB944', pat:'ondas',    mot:'notas',  w:'CUMBIA' },
  trap:        { c1:'#0B0B0F', c2:'#27272A', ac:'#A3E635', pat:'grid',     mot:'rayo',   w:'TRAP' },
  rock:        { c1:'#0A0A0A', c2:'#450A0A', ac:'#EF4444', pat:'rayas',    mot:'rayo',   w:'ROCK' },
  pop:         { c1:'#2E1065', c2:'#DB2777', ac:'#FDE68A', pat:'puntos',   mot:'brillo', w:'POP' },
  variado:     { c1:'#141214', c2:'#3B1C0A', ac:'#F26A1B', pat:'rayas',    mot:'copas',  w:'PARTY' },
  universitaria:{ c1:'#0B1E3F', c2:'#1D4ED8', ac:'#FACC15', pat:'puntos',  mot:'birrete', w:'UNI' }
};
const OCASION_PORTADA = {
  egresados:    { c1:'#0B1533', c2:'#1E3A8A', ac:'#FBBF24', pat:'confeti', mot:'birrete', w:'EGRESADOS' },
  universitaria:{ c1:'#0B1E3F', c2:'#1D4ED8', ac:'#FACC15', pat:'puntos',  mot:'birrete', w:'UNI' },
  cumple:       { c1:'#3B0764', c2:'#BE185D', ac:'#FDE047', pat:'confeti', mot:'globos',  w:'CUMPLE' },
  tematica:     { c1:'#1E1B4B', c2:'#6D28D9', ac:'#F0ABFC', pat:'circulos',mot:'mascara', w:'TEMÁTICA' },
  after:        { c1:'#0C0A09', c2:'#7C2D12', ac:'#FDBA74', pat:'sol',     mot:'sol',     w:'AFTER' },
  pena:         { c1:'#2A1406', c2:'#9A3412', ac:'#FCD34D', pat:'guarda',  mot:'guitarra',w:'PEÑA' },
  musical:      { c1:'#0A0F2C', c2:'#4338CA', ac:'#A5B4FC', pat:'circulos',mot:'microfono',w:'EN VIVO' },
  gastronomico: { c1:'#1C1A0B', c2:'#3F6212', ac:'#FDE68A', pat:'puntos',  mot:'plato',   w:'GASTRO' },
  charla:       { c1:'#0B1220', c2:'#1E3A5F', ac:'#7DD3FC', pat:'grid',    mot:'charla',  w:'CHARLA' },
  taller:       { c1:'#1A1206', c2:'#78350F', ac:'#FCD34D', pat:'puntos',  mot:'brillo',  w:'TALLER' },
  cultural:     { c1:'#1E0B24', c2:'#86198F', ac:'#F0ABFC', pat:'circulos',mot:'mascara', w:'CULTURA' },
  deportivo:    { c1:'#06210F', c2:'#15803D', ac:'#BEF264', pat:'rayas',   mot:'pelota',  w:'DEPORTE' },
  feria:        { c1:'#2A1006', c2:'#C2410C', ac:'#FDE68A', pat:'confeti', mot:'toldo',   w:'FERIA' }
};
// Número estable a partir de un texto (para variar las portadas).
function hashTxt(t){ let h = 7; for(const ch of String(t)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
// Fondo de la portada dibujada según el estilo.
function patronSVG(tipo, ac, seed){
  const r = n => ((seed = (seed * 1103515245 + 12345) >>> 0) % n);
  let g = '';
  if(tipo === 'grid'){ for(let i = 0; i <= 800; i += 50) g += `<line x1="${i}" y1="0" x2="${i}" y2="500"/>`; for(let j = 0; j <= 500; j += 50) g += `<line x1="0" y1="${j}" x2="800" y2="${j}"/>`;
    return `<g stroke="${ac}" stroke-opacity=".13" stroke-width="1">${g}</g>`; }
  if(tipo === 'rayas'){ for(let i = -500; i < 900; i += 46) g += `<line x1="${i}" y1="500" x2="${i + 500}" y2="0"/>`;
    return `<g stroke="${ac}" stroke-opacity=".12" stroke-width="14">${g}</g>`; }
  if(tipo === 'circulos'){ for(let k = 1; k < 9; k++) g += `<circle cx="640" cy="120" r="${k * 55}"/>`;
    return `<g fill="none" stroke="${ac}" stroke-opacity=".16" stroke-width="2">${g}</g>`; }
  if(tipo === 'puntos'){ for(let x = 20; x < 800; x += 40) for(let y = 20; y < 500; y += 40) g += `<circle cx="${x}" cy="${y}" r="2.6"/>`;
    return `<g fill="${ac}" fill-opacity=".22">${g}</g>`; }
  if(tipo === 'ondas'){ for(let y = 40; y < 520; y += 44) g += `<path d="M0 ${y} q50 -22 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0"/>`;
    return `<g fill="none" stroke="${ac}" stroke-opacity=".18" stroke-width="3">${g}</g>`; }
  if(tipo === 'zigzag'){ for(let y = 30; y < 520; y += 48){ let d = `M0 ${y}`; for(let x = 0; x <= 800; x += 40) d += ` L${x + 20} ${y - 16} L${x + 40} ${y}`; g += `<path d="${d}"/>`; }
    return `<g fill="none" stroke="${ac}" stroke-opacity=".16" stroke-width="3">${g}</g>`; }
  if(tipo === 'guarda'){ // guarda pampa: rombos y escalones
    for(const y of [70, 430]){ let d = ''; for(let x = 0; x < 800; x += 60) d += `M${x} ${y}l30 -26l30 26l-30 26z`; g += `<path d="${d}"/>`; }
    for(let y = 140; y < 400; y += 70) g += `<line x1="0" y1="${y}" x2="800" y2="${y}" stroke-dasharray="18 12"/>`;
    return `<g fill="none" stroke="${ac}" stroke-opacity=".22" stroke-width="3">${g}</g>`; }
  if(tipo === 'sol'){ for(let k = 0; k < 9; k++) g += `<rect x="0" y="${300 + k * 22}" width="800" height="${4 + k}" />`;
    return `<circle cx="600" cy="260" r="170" fill="${ac}" fill-opacity=".28"/><g fill="#000" fill-opacity=".35">${g}</g>`; }
  if(tipo === 'confeti'){ const cs = [ac, '#F26A1B', '#4CB944', '#F4EFEC', '#F472B6'];
    for(let k = 0; k < 70; k++) g += `<rect x="${r(800)}" y="${r(500)}" width="${6 + r(10)}" height="${3 + r(4)}" fill="${cs[k % cs.length]}" transform="rotate(${r(180)} ${r(800)} ${r(500)})"/>`;
    return `<g fill-opacity=".55" opacity=".55">${g}</g>`; }
  return '';
}
// Dibujo de la portada según el tipo (botellas, micrófono, etc.).
function motivoSVG(m, ac){
  const st = `fill="none" stroke="${ac}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"`;
  const t = 'transform="translate(560 120)"';
  switch(m){
    case 'onda': return `<g ${t} ${st}>${[40,90,60,130,80,150,70,110,45].map((h, i) => `<line x1="${i * 22}" y1="${100 - h / 2}" x2="${i * 22}" y2="${100 + h / 2}"/>`).join('')}</g>`;
    case 'sol': return `<g ${t} ${st}><circle cx="90" cy="100" r="46"/>${[0,45,90,135,180,225,270,315].map(a => `<line x1="${90 + Math.cos(a * Math.PI / 180) * 70}" y1="${100 + Math.sin(a * Math.PI / 180) * 70}" x2="${90 + Math.cos(a * Math.PI / 180) * 92}" y2="${100 + Math.sin(a * Math.PI / 180) * 92}"/>`).join('')}</g>`;
    case 'llama': return `<g ${t} ${st}><path d="M90 200c-50 0-80-34-70-82 8-38 42-52 40-96 30 20 58 52 52 92 14-8 20-24 20-40 26 26 38 58 28 86-10 26-36 40-70 40z"/></g>`;
    case 'notas': return `<g ${t} ${st}><path d="M40 170V50l120-26v120"/><circle cx="22" cy="170" r="22"/><circle cx="142" cy="146" r="22"/></g>`;
    case 'rayo': return `<g ${t} ${st}><path d="M110 10 40 120h56l-20 90 76-120H96z"/></g>`;
    case 'brillo': return `<g ${t} ${st}><path d="M90 20c8 50 22 64 70 72-48 8-62 22-70 72-8-50-22-64-70-72 48-8 62-22 70-72z"/></g>`;
    case 'copas': return `<g ${t} ${st}><path d="M40 30h56l-6 60a22 22 0 0 1-44 0zM68 112v60M48 172h40"/><path d="M110 40h56l-6 60a22 22 0 0 1-44 0zM138 122v56M118 178h40"/></g>`;
    case 'birrete': return `<g ${t} ${st}><path d="M10 80 100 40l90 40-90 40z"/><path d="M50 98v44c30 22 70 22 100 0V98"/><path d="M190 80v56"/></g>`;
    case 'globos': return `<g ${t} ${st}><ellipse cx="60" cy="70" rx="36" ry="46"/><ellipse cx="140" cy="60" rx="34" ry="44"/><path d="M60 116c0 30-14 40-10 80M140 104c0 30 14 46 6 90"/></g>`;
    case 'botellas': return `<g transform="translate(440 70)" fill="none" stroke="${ac}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M56 6h20v16h-20z"/><path d="M58 22v78c0 26-38 34-38 70v168c0 8 5 12 12 12h68c7 0 12-4 12-12V170c0-36-38-44-38-70V22"/>
      <circle cx="66" cy="196" r="17"/><path d="M20 240h92M20 300h92"/>
      <path d="M236 0h28v14h-28z"/><path d="M238 14v8h24v-8M240 22v14c0 18-44 28-44 74v186c0 10 2 16 6 22 6 8 14 10 20 4 6 8 18 8 24 0 6 8 18 8 24 0 6 6 14 4 20-4 4-6 6-12 6-22V110c0-46-44-56-44-74V22"/>
      <path d="M196 150h108M196 206h108"/><path d="M220 178c20-8 40 6 60-2"/>
      <path fill="url(#g)" d="M96 222l8-7 8 6 9-6 8 6 9-7 8 6 9-6 8 6 9-6 8 6v120c0 8-4 12-10 14-4 10-16 10-20 2-6 8-18 8-22 0-6 8-18 8-22-2-6-2-10-6-10-14z"/>
      <path d="M96 262c30 10 64 10 94 0"/><path d="M110 238l13-6 6 13-13 6zM150 236l13-4 4 13-13 4z"/></g>`;
    case 'guitarra': return `<g ${t} ${st}><path d="M150 10l30 30-16 16-30-30z"/><path d="M140 44 96 88"/><path d="M104 80c-26-10-52 0-62 26s0 54 26 64 54 0 64-26c6-14 4-30-4-42"/><circle cx="80" cy="128" r="12"/></g>`;
    case 'microfono': return `<g transform="translate(520 110)" ${st}><rect x="20" y="40" width="50" height="90" rx="25"/><path d="M-6 108a51 51 0 0 0 102 0M45 159v34M18 193h54"/>
      <g stroke-width="8"><path d="M150 70V0l46-12v58"/><circle cx="138" cy="72" r="14"/><circle cx="184" cy="48" r="14"/></g>
      <g stroke-width="7" opacity=".75"><path d="M118 150v-44"/><circle cx="108" cy="152" r="11"/><path d="M118 106l20 8"/></g>
      <path d="M96 30c16-18 30-22 44-20" stroke-width="4" stroke-dasharray="4 10" opacity=".7"/></g>`;
    case 'plato': return `<g ${t} ${st}><circle cx="100" cy="110" r="66"/><circle cx="100" cy="110" r="36"/><path d="M8 20v54a16 16 0 0 0 16 16v100M24 20v40M196 20c-14 10-18 28-18 56h18v114"/></g>`;
    case 'charla': return `<g ${t} ${st}><path d="M10 30h170v110H70l-50 40v-40H10z"/><path d="M50 70h90M50 100h60"/></g>`;
    case 'pelota': return `<g ${t} ${st}><circle cx="100" cy="100" r="80"/><path d="m100 50 40 30-15 45H75L60 80z"/></g>`;
    case 'toldo': return `<g ${t} ${st}><path d="M10 70 30 20h140l20 50"/><path d="M10 70c0 18 14 30 30 30s30-12 30-30c0 18 14 30 30 30s30-12 30-30c0 18 14 30 30 30s30-12 30-30"/><path d="M30 100v90h140v-90M80 190v-50h40v50"/></g>`;
    case 'mascara': return `<g ${t} ${st}><path d="M10 60c40-20 70-20 90 0 20-20 50-20 90 0-6 70-40 100-72 80-10-6-18-10-18-10s-8 4-18 10C50 160 16 130 10 60z"/><circle cx="62" cy="88" r="12"/><circle cx="138" cy="88" r="12"/></g>`;
  }
  return '';
}
const _portadas = new Map();
// Portada dibujada (SVG) para eventos sin foto.
function portadaEvento(ev){
  const esPrevia = ev?.ocasion === 'previa' || (ev?.tipo === 'previa' && !OCASION_PORTADA[ev?.ocasion]);
  const base = OCASION_PORTADA[ev?.ocasion] || ESTILO_PORTADA[ev?.categoria] || ESTILO_PORTADA.variado;
  const est = esPrevia ? { ...base, mot: 'botellas' } : base;
  const palabra = esPrevia ? 'PREVIA' : est.w;
  const seed = hashTxt(ev?.id || ev?.nombre || palabra);
  const clave = [est.w, est.mot, palabra, seed % 4].join('|');
  if(_portadas.has(clave)) return _portadas.get(clave);
  const giro = [-8, -5, 6, -11][seed % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
    <defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="500"><stop offset="0" stop-color="${est.c1}"/><stop offset="1" stop-color="${est.c2}"/></linearGradient>
    <radialGradient id="l" cx=".78" cy=".25" r=".7"><stop offset="0" stop-color="${est.ac}" stop-opacity=".45"/><stop offset="1" stop-color="${est.ac}" stop-opacity="0"/></radialGradient></defs>
    <rect width="800" height="500" fill="url(#g)"/><rect width="800" height="500" fill="url(#l)"/>
    ${patronSVG(est.pat, est.ac, seed)}
    <text x="-30" y="340" transform="rotate(${giro} 400 250)" font-family="Arial Black, Impact, Helvetica, sans-serif" font-weight="900" font-size="${palabra.length > 7 ? 150 : 200}" fill="none" stroke="#F4EFEC" stroke-opacity=".2" stroke-width="2.5" letter-spacing="4">${palabra}</text>
    ${motivoSVG(est.mot, est.ac)}
  </svg>`.replace(/\s+/g, ' ');
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27');
  _portadas.set(clave, url);
  return url;
}
// ¿El evento tiene foto real?
function tieneFoto(src){ return typeof src === 'string' && (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(src) || /^https:\/\//.test(src)); }
// Fondo de la portada: la foto si hay, si no el diseño del tipo de evento
function cssFoto(ev, src){
  const f = src !== undefined ? src : ev?.imagen;
  return tieneFoto(f) ? cssUrl(f) : esc(`url("${portadaEvento(ev)}")`);
}

// ---------- Privacidad de las previas cerradas ----------
// Lo que se muestra públicamente del lugar: nunca calle ni número en una previa privada
function pareceDireccion(t){
  t = String(t || '');
  // "Colón 1234", "17 de Agosto 458, Villa Zoila"... pero no "Barrio 20 de Junio" ni "Casa Bamba"
  return /[a-záéíóúñü.]\s+\d{2,5}\s*(,|$|bis\b|piso\b|dpto\b|depto\b|°|º)/i.test(t)
    || /^\s*\d{2,5}\s+[a-záéíóúñ]/i.test(t) && /,/.test(t)
    || /(^|\s)(calle|av\.|avda\.?|avenida|pasaje|pje\.|bv\.|bulevar|boulevard|piso|depto|dpto|departamento|lote|mz\.?)(\s|$)/i.test(t);
}
// Lugar que puede ver cualquiera (en privadas, solo el barrio).
function lugarPublico(ev){
  const t = String(ev?.lugar || '');
  if(ev?.privacidad !== 'privada' || ev.creador === state.uid || !pareceDireccion(t)) return t;
  const partes = t.split(/[,·\-–]/).map(x => x.trim()).filter(x => x && !pareceDireccion(x));
  return partes.length ? partes[partes.length - 1] : 'Zona reservada';
}
// Distancia: en previas privadas, redondeada (no da pistas de la casa)
function textoDistancia(ev, km){
  if(typeof km !== 'number' || isNaN(km)) return null;
  if(ev?.privacidad === 'privada' && ev.creador !== state.uid) return `~${Math.max(1, Math.round(km))} km`;
  return km.toFixed(1) + ' km';
}
// ¿El evento está cancelado?
function esCancelado(ev){ return ev?.estado === 'cancelado'; }
// Estado del evento calculado en el momento (cupo + horario + votos de los que están adentro)
const VOTOS_AMB = {
  tranqui:   { label: 'Tranqui',        clase: 'verde',    emoji: '😌', desc: 'Buena para charlar' },
  bueno:     { label: 'Se pone bueno',  clase: 'amarillo', emoji: '🔥', desc: 'Arrancó la joda' },
  explotado: { label: 'Explotado',      clase: 'rojo',     emoji: '🤯', desc: 'A full, mucha gente' }
};
// Hora estimada de fin del evento.
function finEvento(ev){
  if(ev.horaFin && /^\d{2}:\d{2}$/.test(ev.horaFin)){
    const d = new Date(ev.fechaTs), [h, m] = ev.horaFin.split(':').map(Number);
    const f = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
    return f <= ev.fechaTs ? f + 864e5 : f;
  }
  return ev.fechaTs + 6 * 36e5;
}
// Estado del evento (recién creado, se llena, en vivo, terminó...) según cupo, hora y votos.
function ambienteAuto(ev, votos){
  const ahora = Date.now();
  if(esCancelado(ev)) return { clase: 'rojo', label: 'Cancelado', desc: ev.motivoCancelacion || 'Este evento no se hace' };
  if(ahora > finEvento(ev)) return { clase: 'gris', label: 'Terminó', desc: 'El evento ya pasó' };
  if(ahora >= ev.fechaTs){
    if(votos && votos.top){
      const v = VOTOS_AMB[votos.top];
      return { clase: v.clase, vivo: true, label: 'En vivo · ' + v.label, desc: `${v.desc} · según ${votos.total} ${votos.total === 1 ? 'persona' : 'personas'} adentro` };
    }
    return { clase: 'verde', vivo: true, label: 'En vivo', desc: 'Está pasando ahora' };
  }
  const cupo = ev.confirmadosCount || 0, cap = Math.max(1, ev.capacidad || 1), r = cupo / cap;
  if(cupo >= cap) return { clase: 'rojo', label: 'Lleno', desc: 'No quedan lugares · podés anotarte en la lista de espera' };
  if(r >= 0.85) return { clase: 'amarillo', label: 'Últimos lugares', desc: `Quedan ${cap - cupo} ${cap - cupo === 1 ? 'lugar' : 'lugares'}` };
  if(r >= 0.5) return { clase: 'amarillo', label: 'Se está llenando', desc: `Ya hay ${cupo} de ${cap} anotados` };
  if(ev.createdAt && ahora - ev.createdAt < 864e5) return { clase: 'verde', label: 'Recién creado', desc: 'Se publicó hace menos de un día' };
  return { clase: 'verde', label: 'Hay lugar', desc: `${cupo} de ${cap} anotados` };
}
// Clase de color del estado del evento.
function amb(ev, votos){ const a = ambienteAuto(ev, votos); return a.clase + (a.vivo ? ' amb-vivo' : ''); }
// Cuenta los votos de ambiente de las últimas 3 horas.
function resumenVotos(lista){
  const desde = Date.now() - 3 * 36e5, c = { tranqui: 0, bueno: 0, explotado: 0 };
  lista.filter(v => v.ts >= desde && c[v.voto] !== undefined).forEach(v => c[v.voto]++);
  const total = c.tranqui + c.bueno + c.explotado;
  if(!total) return { total: 0, c };
  const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
  return { total, c, top };
}
// Bloque de estado del evento (y botones para votar si estás adentro).
function bloqueAmbienteHTML(ev, votos, puedeVotar, miVoto){
  const a = ambienteAuto(ev, votos);
  const votar = (a.vivo && puedeVotar) ? `
    <div class="votar-amb">
      <div class="q">${miVoto ? 'Tu voto quedó registrado. Podés cambiarlo:' : '¿Estás ahí? Contale a los demás cómo está:'}</div>
      <div class="ops">${Object.entries(VOTOS_AMB).map(([k, v]) =>
        `<button data-votar="${k}" class="${miVoto === k ? 'elegido' : ''}"><span style="font-size:20px;">${v.emoji}</span>${esc(v.label)}<small>${(n => n + (n === 1 ? ' voto' : ' votos'))(votos?.c ? votos.c[k] : 0)}</small></button>`).join('')}</div>
    </div>` : '';
  return `<div class="ambiente-barra">
      <span class="punto-ambiente amb-${a.clase}${a.vivo ? ' amb-vivo' : ''}" style="width:12px;height:12px;"></span>
      <div class="txt"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span></div>
      <button class="link-ref" onclick="abrirReferencias()">¿Qué significa?</button>
    </div>${votar}`;
}
// Carga los votos en vivo y repinta el bloque de estado.
async function cargarAmbienteVivo(ev, tok, puedeVotar){
  const a = ambienteAuto(ev);
  if(!a.vivo) return;
  const pintar = async () => {
    let lista = [];
    try{ lista = await DataService.listVotos(ev.id); } catch(e){ console.warn('votos', e); }
    if(tok !== state.tok) return;
    const cont = document.getElementById('bloque-ambiente');
    if(!cont) return;
    const mio = lista.find(v => v.uid === state.uid && v.ts >= Date.now() - 3 * 36e5);
    cont.innerHTML = bloqueAmbienteHTML(ev, resumenVotos(lista), puedeVotar, mio?.voto);
    cont.querySelectorAll('[data-votar]').forEach(b => b.onclick = async () => {
      cont.querySelectorAll('[data-votar]').forEach(x => x.disabled = true);
      try{ await DataService.votarAmbiente(ev.id, state.uid, b.dataset.votar); toast('¡Gracias! Voto registrado'); }
      catch(e){ console.error(e); toast('No se pudo registrar el voto'); }
      pintar();
    });
  };
  pintar();
}

// ---------- Referencia de colores ----------
function abrirReferencias(){
  const f = (clase, titulo, texto, vivo) => `<div class="ref-fila"><span class="punto-ambiente amb-${clase}${vivo ? ' amb-vivo' : ''}"></span><div><b>${titulo}</b><span>${texto}</span></div></div>`;
  document.getElementById('ref-contenido').innerHTML = `
    <div class="ref-sub">Antes del evento</div>
    ${f('verde', 'Verde · Hay lugar', 'Podés anotarte tranquilo. "Recién creado" significa que se publicó hace menos de un día.')}
    ${f('amarillo', 'Amarillo · Se está llenando', 'Ya está más de la mitad ocupado. "Últimos lugares": queda menos del 15%.')}
    ${f('rojo', 'Rojo · Lleno o cancelado', 'No quedan lugares (podés sumarte a la lista de espera) o el evento se canceló.')}
    <div class="ref-sub">Mientras pasa</div>
    ${f('verde', 'Punto que late · En vivo', 'El evento está pasando ahora. La gente que está ahí vota cómo está:', true)}
    ${f('verde', '😌 Tranqui', 'Buena para charlar, poca gente.', true)}
    ${f('amarillo', '🔥 Se pone bueno', 'Arrancó la joda.', true)}
    ${f('rojo', '🤯 Explotado', 'A full, mucha gente.', true)}
    <div class="ref-sub">Después</div>
    ${f('gris', 'Gris · Terminó', 'El evento ya pasó.')}
    <div class="ref-sub">Otras marcas</div>
    <div class="ref-fila"><span class="pill-cupo ultimas">Últimas entradas</span><div><span>Quedan muy pocos lugares.</span></div></div>
    <div class="ref-fila"><span class="pill-cupo agotado">Agotado</span><div><span>No hay más lugares.</span></div></div>
    <div class="ref-fila"><span style="font-size:15px;">🔒</span><div><b>Previa privada</b><span>Pedís unirte y quien organiza te aprueba. Ahí ves la dirección.</span></div></div>
    <div class="ref-fila"><span style="color:var(--verde); font-weight:800;">✓</span><div><b>Verificado</b><span>Organización revisada por Partazy.</span></div></div>`;
  document.getElementById('modal-referencias').classList.add('show');
  abrirModalHist();
}
// Cierra la guía de colores.
function cerrarReferencias(){ document.getElementById('modal-referencias').classList.remove('show'); soltarModalHist(); }

// ---------- Tutorial de bienvenida ----------
const LOGO_TUTO = `<div class="tuto-logo-wrap" aria-hidden="true">
  <svg class="tuto-logo" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="grano-tuto"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <clipPath id="marco-tuto"><rect width="64" height="64" rx="15"/></clipPath>
    </defs>
    <rect width="64" height="64" rx="15" fill="#0A0809"/>
    <g clip-path="url(#marco-tuto)"><g transform="skewX(-14) translate(8 0)">
      <rect class="raya r1" x="-12" y="30" width="90" height="9" fill="#F26A1B"/>
      <rect class="raya r2" x="-12" y="41.5" width="90" height="3.5" fill="#F4EFEC"/>
      <rect class="raya r3" x="-12" y="47.5" width="90" height="3" fill="#4CB944"/>
      <path class="trazo" pathLength="100" d="M24 50V14h11a11 11 0 0 1 0 22H24" transform="translate(2.6 2.6)" fill="none" stroke="#F26A1B" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="trazo" pathLength="100" d="M24 50V14h11a11 11 0 0 1 0 22H24" fill="none" stroke="#0A0809" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="trazo" pathLength="100" d="M24 50V14h11a11 11 0 0 1 0 22H24" fill="none" stroke="#F4EFEC" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    </g></g>
    <rect width="64" height="64" rx="15" fill="#fff" filter="url(#grano-tuto)" opacity=".16"/>
  </svg>
  <span class="tuto-chispa c1">✦</span><span class="tuto-chispa c2">✦</span><span class="tuto-chispa c3">✦</span>
</div>`;
// ¿Se está viendo en compu (menú a la izquierda) o en celu (barra abajo)?
function esCompu(){ try{ return window.matchMedia('(min-width:900px)').matches; } catch(e){ return false; } }
// Pasos del tutorial: cada uno con un dibujito de la pantalla real, un título corto y una sola idea.
// Los textos cambian según dónde están los botones (compu o celu).
function pasosTutorial(){
  const nombre = (nombreVisible(state.perfil) || '').split(' ')[0];
  const compu = esCompu();
  const dedo = '<span class="tm-dedo" aria-hidden="true"></span>';
  return [
    { logo: true, t: nombre ? `¡Hola, ${esc(nombre)}!` : '¡Bienvenido/a!',
      p: 'Partazy es para encontrar <b>fiestas, previas y boliches</b>, ver a dónde van tus amigos y anotarte. Son 5 pasos cortitos.' },
    { t: 'Encontrá un plan',
      p: `Arriba en <b>Inicio</b> está lo de esta noche y la semana. Para buscar algo puntual, usá el buscador o tocá un filtro.`,
      dibujo: `<div class="tm tm-buscar">
        <div class="tm-barra"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="tm-tipeo">cachengue</span></div>
        <div class="tm-chips"><i class="on">Hoy</i><i>Cerca tuyo</i><i>Gratis</i><i>Electrónica</i></div></div>` },
    { t: 'Anotate en un toque',
      p: `Abrí cualquier evento y tocá <b>Confirmar asistencia</b> (o <b>Reservar</b> si es pago). Tu entrada queda en <b>Mis entradas</b> 🎟️, ${compu ? 'en el menú de la izquierda' : 'el ícono del ticket arriba'}.`,
      dibujo: `<div class="tm tm-evento">
        <div class="tm-foto"></div>
        <div class="tm-info"><small>FIESTA · SÁB 23:30</small><b>Noche de prueba</b><span><i class="punto-ambiente amb-verde"></i>Hay lugar</span></div>
        <div class="tm-boton">Confirmar asistencia${dedo}</div></div>` },
    { t: 'El punto te dice cómo viene', p: 'Todos los eventos tienen un punto de color:',
      extra: `<div class="tuto-mini">
        <div><span class="punto-ambiente amb-verde"></span><b>Verde</b> hay lugar</div>
        <div><span class="punto-ambiente amb-amarillo"></span><b>Amarillo</b> se está llenando</div>
        <div><span class="punto-ambiente amb-rojo"></span><b>Rojo</b> lleno o cancelado</div>
        <div><span class="punto-ambiente amb-verde amb-vivo"></span><b>Si late</b> está pasando ahora</div></div>` },
    { t: 'Mirá a dónde van tus amigos',
      p: `Agregalos con el ícono de <b>personas</b> ${compu ? '(arriba a la derecha)' : '(arriba)'}. En cada evento vas a ver quién va, y podés <b>compartirlo</b> con un comentario para armar el plan.`,
      dibujo: `<div class="tm tm-amigos">
        <div class="tm-caras"><i>SG</i><i>IP</i><i>MR</i></div>
        <div class="tm-txt"><b>Sofía</b> e <b>Ivo</b> van</div>
        <div class="tm-nota">¡Vamos a esta! 🔥 <span>— Sofía</span></div></div>` },
    { t: 'Armá tu previa o fiesta',
      p: `Tocá el <b>+ naranja</b> ${compu ? '(<b>Crear evento</b>, en el menú de la izquierda)' : 'abajo en el medio'}, completá los datos y listo. Si es privada, elegís quién entra y la dirección solo la ven los aprobados.`,
      dibujo: `<div class="tm tm-crear"><div class="tm-mas">+${dedo}</div><div class="tm-crear-txt"><b>Crear evento</b><span>Previa · Fiesta · Boliche</span></div></div>`,
      pie: `¿Te perdiste? Volvé a ver esto desde <b>Perfil → ☰ → Tutorial</b>.` }
  ];
}
const tuto = { i: 0 };
// Clave para recordar que esta cuenta ya vio el tutorial.
function claveTutorial(){ return 'partazy_tutorial_' + (state.uid || ''); }
// ¿Ya vio el tutorial en este dispositivo?
function tutorialVisto(){ try{ return localStorage.getItem(claveTutorial()) === '1'; } catch(e){ return false; } }
// Abre el tutorial desde el paso 1.
function abrirTutorial(){ tuto.i = 0; pintarTutorial(); document.getElementById('tutorial').classList.add('show'); abrirModalHist(); }
// Cierra el tutorial y lo marca como visto.
function cerrarTutorial(){
  document.getElementById('tutorial').classList.remove('show');
  soltarModalHist();
  try{ localStorage.setItem(claveTutorial(), '1'); } catch(e){}
}
// Avanza o retrocede un paso del tutorial.
function pasoTutorial(d){
  const n = pasosTutorial().length;
  if(tuto.i + d >= n){ cerrarTutorial(); return; }
  tuto.i = Math.max(0, tuto.i + d); pintarTutorial();
}
// Pinta el paso actual del tutorial.
function pintarTutorial(){
  const pasos = pasosTutorial(), p = pasos[tuto.i], ultimo = tuto.i === pasos.length - 1;
  document.getElementById('tuto-paso').textContent = `${tuto.i + 1} / ${pasos.length}`;
  const arriba = p.logo ? LOGO_TUTO : p.dibujo ? p.dibujo : '';
  document.getElementById('tuto-slide').innerHTML = `<div class="tuto-slide">${arriba}<h2>${p.t}</h2><p>${p.p}</p>${p.extra || ''}${p.pie ? `<p class="tuto-nota">${p.pie}</p>` : ''}</div>`;
  document.getElementById('tuto-puntos').innerHTML = pasos.map((_, k) => `<i class="${k === tuto.i ? 'on' : ''}"></i>`).join('');
  document.getElementById('tuto-atras').style.display = tuto.i === 0 ? 'none' : '';
  document.getElementById('tuto-sig').textContent = ultimo ? '¡Empezar!' : 'Siguiente';
}
// Precio para mostrar ("Gratis", "$5.000"...).
function precioTxt(ev){
  if(ev.privacidad === 'privada') return ev.precio > 0 ? 'Invitación · ' + money(ev.precio) : 'Invitación';
  return money(ev.precio);
}

// Tarjetas con poca info: tipo de evento, nombre y distancia (+ fecha corta)
function fechaCorta(ts){
  const d = new Date(ts);
  if(esMismoDia(ts, Date.now())) return 'Hoy · ' + horaCorta(ts);
  if(esMismoDia(ts, Date.now() + 864e5)) return 'Mañana';
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}
// Texto de distancia al evento (si sabemos dónde estás).
function distanciaDe(ev){
  if(!state.userCoords || typeof ev.lat !== 'number') return null;
  return textoDistancia(ev, distanciaKm(state.userCoords.lat, state.userCoords.lng, ev.lat, ev.lng));
}
// Línea de la tarjeta: distancia · fecha (o "Cancelado").
function lineaMetaHTML(ev){
  const dist = distanciaDe(ev);
  const cuando = esCancelado(ev) ? '<span class="cancelado-txt">Cancelado</span>' : `<span>${esc(fechaCorta(ev.fechaTs))}</span>`;
  return `<div class="meta-limpia">${dist ? `<span class="dist">${PIN_MINI}${esc(dist)}</span>` : ''}${cuando}</div>`;
}
const PIN_MINI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
// Tarjeta de evento (vertical) para las filas del inicio.
function tarjetaHTML(ev, _dist, razon){
  const amigos = amigosVanHTML(ev, false);
  const candado = ev.privacidad==='privada' ? `<div class="candado-badge">${svgLock}</div>` : '';
  return `
   <div class="tarjeta" role="button" tabindex="0" data-abrir="${esc(ev.id)}" aria-label="${esc(ev.nombre)}">
     ${candado}
     <div class="foto"><div class="foto-img" style="background-image:${cssFoto(ev)}"></div></div>
     <div class="info">
       <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}<button class="btn-vista" data-vista="${esc(ev.id)}" aria-label="Vista previa de ${esc(ev.nombre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>Vista previa</button></div>
       <h3>${esc(ev.nombre)}</h3>
       ${lineaMetaHTML(ev)}
       ${amigos || (razon && /^[🎧👥📈]/u.test(razon) ? `<div class="razon-tarjeta">${esc(razon)}</div>` : '')}
     </div>
   </div>`;
}

// Tarjeta de evento horizontal (listas).
function tarjetaHorizontalHTML(ev, razon){
  const amigos = amigosVanHTML(ev, false);
  if(!(razon && /^[🎧👥📈]/u.test(razon)) && afinidad(ev).puntos === 2) razon = `🎧 ${afinidad(ev).motivo}`;   // en Explorar también se ve si va con tu música
  const candado = ev.privacidad==='privada' ? ' 🔒' : '';
  return `
   <div class="tarjeta-h" role="button" tabindex="0" data-abrir="${esc(ev.id)}" aria-label="${esc(ev.nombre)}">
     <div class="foto-h"><div class="foto-img" style="background-image:${cssFoto(ev)}"></div></div>
     <div class="info-h">
       <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}${candado}<button class="btn-vista" data-vista="${esc(ev.id)}" aria-label="Vista previa de ${esc(ev.nombre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>Vista previa</button></div>
       <h4>${esc(ev.nombre)}</h4>
       ${lineaMetaHTML(ev)}
       ${amigos || (razon && /^[🎧👥📈]/u.test(razon) ? `<div class="razon-tarjeta">${esc(razon)}</div>` : '')}
     </div>
   </div>`;
}


// ---------- Movimiento: inclinación 3D de las tarjetas (solo mouse) ----------
(function(){
  if(!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('pointermove', e => {
    const t = e.target.closest && e.target.closest('.tarjeta');
    if(!t) return;
    const r = t.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    t.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
    t.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg');
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const t = e.target.closest && e.target.closest('.tarjeta');
    if(t && !t.contains(e.relatedTarget)){ t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); }
  }, { passive: true });
})();

// Marquesina del inicio con lo que pasa de verdad en la app
function renderTicker(){
  const el = document.getElementById('home-ticker');
  if(!el) return;
  const ahora = Date.now(), finSemana = ahora + 7 * 864e5;
  const vivos = (state.eventos || []).filter(e => !esCancelado(e) && e.fechaTs > ahora - 6 * 36e5);
  const hoy = vivos.filter(e => new Date(e.fechaTs).toDateString() === new Date().toDateString()).length;
  const semana = vivos.filter(e => e.fechaTs < finSemana).length;
  const previas = vivos.filter(e => e.tipo === 'previa').length;
  const gratis = vivos.filter(e => !(e.precio > 0)).length;
  const items = [
    `<b>✦</b> ${esc(state.userCoords && state.ciudadActual ? state.ciudadActual : 'La ciudad')} de noche`,
    hoy ? `<i>●</i> ${hoy} ${hoy === 1 ? 'evento' : 'eventos'} hoy` : `<i>●</i> Armá el plan de hoy`,
    `<b>✦</b> ${semana} esta semana`,
    previas ? `<b>✦</b> ${previas} ${previas === 1 ? 'previa' : 'previas'}` : `<b>✦</b> Previas · Fiestas · Boliches`,
    gratis ? `<b>✦</b> ${gratis} gratis` : `<b>✦</b> Partazy`
  ].map(t => `<span>${t}</span>`).join('');
  el.innerHTML = items;
  ajustarVaiven(el);
}




// ---------- Movimiento de ida y vuelta (marquesina y filtros) ----------
function ajustarVaiven(el){
  requestAnimationFrame(() => {
    const cont = el.parentElement;
    if(!cont) return;
    const ancho = cont.clientWidth;
    if(!ancho) return;
    const sobra = el.scrollWidth - ancho + 48;
    // Si el texto no entra, va y vuelve para mostrarlo todo; si entra (pantallas grandes), igual se desliza de un lado al otro
    const d = sobra > 0 ? -sobra : Math.min(-sobra, Math.max(120, ancho * 0.35));
    el.style.setProperty('--dist', d + 'px');
    el.style.setProperty('--dur', Math.max(7, Math.abs(d) / 26).toFixed(1) + 's');
    el.style.animationPlayState = Math.abs(d) > 4 ? 'running' : 'paused';
  });
}
window.addEventListener('resize', () => { const t = document.getElementById('home-ticker'); if(t) ajustarVaiven(t); });
// Cuando la pantalla de inicio se muestra (o cambia de tamaño), se recalcula el recorrido
if(window.ResizeObserver){ const t0 = document.getElementById('home-ticker'); if(t0 && t0.parentElement) new ResizeObserver(() => ajustarVaiven(t0)).observe(t0.parentElement); }
// Los filtros (chips) se asoman solos de vez en cuando para mostrar que hay más opciones
(function(){
  const tocado = new WeakMap();
  ['chips-home', 'chips-explorar'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    ['pointerdown', 'wheel', 'touchstart', 'mouseenter'].forEach(ev => el.addEventListener(ev, () => tocado.set(el, Date.now()), { passive: true }));
  });
  let ida = true;
  setInterval(() => {
    if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ['chips-home', 'chips-explorar'].forEach(id => {
      const el = document.getElementById(id);
      if(!el || !el.offsetParent || el.scrollWidth <= el.clientWidth + 8) return;
      if(Date.now() - (tocado.get(el) || 0) < 12000) return;
      el.scrollTo({ left: ida ? el.scrollWidth : 0, behavior: 'smooth' });
    });
    ida = !ida;
  }, 4500);
})();


// =========================================================
//  IDIOMA: español (original), inglés y portugués (traducción automática de Google)
// =========================================================
function idiomaActual(){ return leerPref('idioma', 'es'); }
// Marca el idioma elegido en los botones ES/EN/PT.
function pintarIdiomas(){
  const l = idiomaActual();
  document.querySelectorAll('[data-idioma]').forEach(b => b.classList.toggle('on', b.dataset.idioma === l));
}
// Cambia el idioma (traducción automática de Google) y recarga.
function cambiarIdioma(l){
  if(l === idiomaActual()) return;
  guardarPref('idioma', l);
  const host = location.hostname, borrar = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  if(l === 'es'){ document.cookie = `googtrans=; ${borrar}`; document.cookie = `googtrans=; ${borrar}; domain=${host}`; document.cookie = `googtrans=; ${borrar}; domain=.${host}`; }
  else { document.cookie = `googtrans=/es/${l}; path=/`; document.cookie = `googtrans=/es/${l}; path=/; domain=${host}`; }
  location.reload();
}
// Carga el traductor de Google solo si se eligió inglés o portugués.
function cargarTraductor(){
  const l = idiomaActual();
  document.documentElement.lang = l === 'es' ? 'es-AR' : l;
  if(l === 'es' || window.google?.translate) return;
  document.cookie = `googtrans=/es/${l}; path=/`;
  window.googleTranslateElementInit = () => {
    try{ new google.translate.TranslateElement({ pageLanguage: 'es', includedLanguages: 'en,pt', autoDisplay: false }, 'gt-oculto'); } catch(e){}
  };
  const sc = document.createElement('script');
  sc.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  sc.onerror = () => toast('No se pudo cargar la traducción. Revisá tu conexión.');
  document.head.appendChild(sc);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-idioma]'); if(b) cambiarIdioma(b.dataset.idioma); });

// =========================================================
//  INSTALAR PARTAZY EN EL CELULAR (y notificaciones en iPhone)
// =========================================================
let _promptInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _promptInstalar = e; pintarBotonInstalar(); });
// ¿La app está instalada (abierta desde el ícono)?
function esStandalone(){ return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
// ¿Es un iPhone o iPad?
function esIOS(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
// ¿Se abrió dentro de Instagram, WhatsApp o Facebook?
function esNavegadorDeApp(){ return /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent); }
// Muestra el botón "Instalar Partazy" si se puede instalar.
function pintarBotonInstalar(){
  const b = document.getElementById('btn-instalar');
  if(!b) return;
  b.style.display = esStandalone() ? 'none' : '';
}
// Instala la app (Android/compu) o explica cómo (iPhone).
async function instalarApp(){
  if(_promptInstalar){ _promptInstalar.prompt(); try{ await _promptInstalar.userChoice; } catch(e){} _promptInstalar = null; pintarBotonInstalar(); return; }
  mostrarComoInstalar();
}
// Instrucciones para agregar a la pantalla de inicio (iPhone / navegadores de apps).
function mostrarComoInstalar(paraAvisos){
  const ios = esIOS(), app = esNavegadorDeApp();
  const pasos = app
    ? `<li>Estás viendo Partazy dentro de otra app (WhatsApp, Instagram...). Tocá los <b>tres puntitos</b> o <b>Compartir</b> y elegí <b>"Abrir en ${ios ? 'Safari' : 'Chrome'}"</b>.</li><li>Después seguí estos mismos pasos desde ahí.</li>`
    : ios
      ? `<li>Tocá el botón <b>Compartir</b> ⬆️ de Safari (abajo o arriba).</li><li>Elegí <b>"Agregar a pantalla de inicio"</b> y tocá <b>Agregar</b>.</li><li>Abrí Partazy desde el ícono nuevo${paraAvisos ? ' y tocá <b>Activar notificaciones</b> en tu perfil' : ''}.</li>`
      : `<li>Tocá los <b>tres puntitos</b> ⋮ del navegador.</li><li>Elegí <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b>.</li><li>Abrí Partazy desde el ícono nuevo.</li>`;
  abrirHoja(`<div class="cuerpo" style="margin-top:0; padding-top:20px;">
    <div class="cat">📲 Partazy en tu celular</div><h3>${paraAvisos ? 'Activá las notificaciones' : 'Instalá Partazy'}</h3>
    <p style="font-size:13px; color:var(--gris); line-height:1.5; margin-bottom:12px;">${paraAvisos && ios ? 'En iPhone las notificaciones solo funcionan con Partazy agregada a la pantalla de inicio.' : 'Queda con su ícono, a pantalla completa y sin la barra del navegador. Es gratis y no ocupa espacio.'}</p>
    <ol style="font-size:13.5px; line-height:1.6; padding-left:20px; color:var(--hueso);">${pasos}</ol></div>
    <div class="acciones" style="margin-top:12px;"><button class="btn btn-primario" onclick="cerrarHoja()">Entendido</button></div>`);
}

// =========================================================
//  AVISOS DEL CELULAR (mensajes nuevos y fiestas nuevas)
//  Funcionan mientras Partazy está abierta, aunque sea en segundo plano.
// =========================================================
const AVISOS = { reg: null, notifIds: null, dmTs: {} };
// ¿El navegador soporta notificaciones del sistema?
function avisosSoportados(){ return 'Notification' in window; }
// Texto y acción del botón de notificaciones según el permiso.
function pintarBotonAvisos(){
  const b = document.getElementById('btn-avisos');
  if(!b) return;
  if(!avisosSoportados()){
    // iPhone (o navegador de WhatsApp/Instagram): se explica cómo activarlas
    if(esIOS() || esNavegadorDeApp()){ b.style.display = ''; b.disabled = false; b.innerHTML = '<span class="mi">🔔</span>Activar notificaciones en este celular'; b.onclick = () => mostrarComoInstalar(true); }
    else b.style.display = 'none';
    return;
  }
  b.onclick = activarAvisos;
  const p = Notification.permission;
  b.innerHTML = p === 'granted' ? '<span class="mi">🔔</span>Notificaciones activadas ✓' : p === 'denied' ? '<span class="mi">🔕</span>Notificaciones bloqueadas (activalas en el navegador)' : '<span class="mi">🔔</span>Activar notificaciones en este celular';
  b.disabled = p !== 'default';
}
// Pide permiso para notificaciones del sistema.
async function activarAvisos(){
  if(!avisosSoportados()){ toast('Tu navegador no permite notificaciones'); return; }
  try{
    const p = await Notification.requestPermission();
    if(p === 'granted'){ toast('¡Listo! Te avisamos de mensajes y fiestas nuevas'); avisoSistema('PARTAZY', 'Las notificaciones quedaron activadas 🎉', null, true); }
    else toast('No se activaron las notificaciones');
  } catch(e){ toast('No se pudieron activar'); }
  pintarBotonAvisos();
}
// Registra el service worker (necesario para los avisos).
function registrarSW(){
  if(!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  navigator.serviceWorker.register('sw.js').then(r => { AVISOS.reg = r; }).catch(e => console.warn('sw', e));
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if(d.tipo === 'abrir' && d.destino) abrirDestinoAviso(d.destino);
  });
}
// Abre lo que corresponde al tocar un aviso del sistema.
function abrirDestinoAviso(dest){
  if(!state.perfil || !dest) return;
  if(dest.startsWith('dm:')) abrirDM(dest.slice(3));
  else if(dest.startsWith('evento:')) abrirDetalle(dest.slice(7));
  else if(dest === 'notificaciones') abrirNotificaciones();
}
// Muestra un aviso del sistema (si la app no está a la vista).
function avisoSistema(titulo, cuerpo, destino, forzar){
  if(!avisosSoportados() || Notification.permission !== 'granted') return;
  if(!forzar && document.visibilityState === 'visible') return;
  const opts = { body: cuerpo, icon: 'icono-180.png', badge: 'favicon-32.png', tag: destino || 'partazy', renotify: true, data: { destino } };
  const reg = AVISOS.reg;
  if(reg && reg.showNotification){ reg.showNotification(titulo, opts).catch(() => {}); return; }
  try{ const n = new Notification(titulo, opts); n.onclick = () => { window.focus(); abrirDestinoAviso(destino); n.close(); }; } catch(e){}
}
// Se llaman desde los listeners en tiempo real
function avisarNotifNuevas(lista){
  const ids = new Set(lista.map(n => n.id));
  if(AVISOS.notifIds){
    lista.filter(n => !AVISOS.notifIds.has(n.id) && !n.leida && !state.bloqueados.has(n.de)).slice(0, 3).forEach(n => {
      const t = TIPOS_NOTIF[n.tipo];
      if(!t) return;
      const destino = n.objetoId && /evento|nuevo_evento|amigo_evento|compartido|acreditacion/.test(n.tipo) ? 'evento:' + n.objetoId : 'notificaciones';
      avisoSistema('PARTAZY', t.texto(n), destino);
      if(document.visibilityState === 'visible' && pantallaActual() !== 'notificaciones') toast(t.icono + ' ' + t.texto(n));
    });
  }
  AVISOS.notifIds = ids;
}
// Avisa mensajes privados nuevos con un aviso del sistema.
function avisarDMsNuevos(lista){
  const primera = !AVISOS._dmListo;
  lista.forEach(d => {
    const antes = AVISOS.dmTs[d.id] || 0;
    AVISOS.dmTs[d.id] = d.ultimoTs || 0;
    if(primera || !d.ultimoTs || d.ultimoTs <= antes || d.ultimoDe === state.uid) return;
    const otro = otroDe(d.id);
    if(state.bloqueados.has(otro)) return;
    if(pantallaActual() === 'chat' && state.dmActual?.uid === otro && document.visibilityState === 'visible') return;
    getUsuario(otro).then(u => {
      const quien = nombreVisible(u) || 'Alguien';
      const sol = esSolicitudRecibida(d);
      avisoSistema(sol ? `✉️ Solicitud de mensaje de ${quien}` : `💬 ${quien}`, d.ultimoMsg || 'Te mandó un mensaje', 'dm:' + otro);
      if(document.visibilityState === 'visible') toast(sol ? `✉️ ${quien} quiere mandarte un mensaje` : `💬 Mensaje nuevo de ${quien}`);
    });
  });
  AVISOS._dmListo = true;
}

// =========================================================
//  RED DE AMIGOS: quién va, sugerencias y compartidos
// =========================================================
// Cada persona guarda en planes/{uid} los eventos públicos a los que va y los que compartió.
// Solo lo leen sus amigos. "red" = cuántos de SUS amigos van a cada evento (anónimo):
// así, leyendo a mis amigos, sé a dónde van los amigos de mis amigos.
state.red = { amigosVan: {}, compartidoPor: {}, fof: {}, notas: {}, planes: {}, listo: false };
state.misCompartidos = [];
state.misNotas = {};          // comentario opcional de cada evento que compartí { eventId: texto }
state.misPlanes = new Set();
let _tRed;
// Vuelve a calcular la red de amigos en un rato (agrupa cambios seguidos).
function programarRed(){ clearTimeout(_tRed); _tRed = setTimeout(cargarRed, 1200); }

// Lee los planes de mis amigos: a dónde van, qué compartieron y amigos de amigos.
async function cargarRed(){
  if(!state.uid) return;
  const amigos = amigosUids().filter(u => !state.bloqueados.has(u)).slice(0, 100);
  const planes = await Promise.all(amigos.map(async u => [u, await DataService.getPlanes(u).catch(() => null)]));
  const amigosVan = {}, compartidoPor = {}, fof = {}, mapa = {}, notas = {};
  for(const [u, pl] of planes){
    if(!pl) continue;
    mapa[u] = pl;
    (pl.eventos || []).forEach(id => (amigosVan[id] = amigosVan[id] || []).push(u));
    (pl.compartidos || []).forEach(id => {
      (compartidoPor[id] = compartidoPor[id] || []).push(u);
      const nota = limpiarNota(pl.notas?.[id]);
      if(nota) (notas[id] = notas[id] || []).push({ uid: u, texto: nota });
    });
    Object.entries(pl.red || {}).forEach(([id, n]) => { fof[id] = (fof[id] || 0) + (Number(n) || 0); });
  }
  // Sacamos lo que ya contamos directo (y a mí mismo) del conteo de amigos de amigos
  Object.keys(fof).forEach(id => {
    const directos = (amigosVan[id] || []).length;
    fof[id] = Math.max(0, fof[id] - directos - (state.misPlanes.has(id) ? Object.keys(mapa).length : 0));
  });
  state.red = { amigosVan, compartidoPor, fof, notas, planes: mapa, listo: true };
  await Promise.all(Object.keys(mapa).map(getUsuario));
  if(typeof renderHome === 'function'){ renderHome(); renderExplorar(); }
  pintarFilaAmigos();
  sincronizarPlanes();
}

let _tPlanes;
// Guarda mis planes en un rato (agrupa cambios seguidos).
function sincronizarPlanes(){ clearTimeout(_tPlanes); _tPlanes = setTimeout(guardarMisPlanes, 800); }
// Guarda a qué eventos públicos voy y qué compartí (lo leen mis amigos).
async function guardarMisPlanes(){
  if(!state.uid || !state.perfil) return;
  try{
    if(!state._planesCargados){
      const mio = await DataService.getPlanes(state.uid).catch(() => null);
      // Se suman a lo que ya haya compartido en esta sesión (si compartió antes de que esto cargue, no se pierde)
      state.misCompartidos = [...new Set([...state.misCompartidos, ...(mio?.compartidos || [])])].slice(0, 60);
      state.misNotas = Object.assign({}, mio?.notas || {}, state.misNotas);
      state._planesCargados = true;
    }
    const ahora = Date.now();
    const entradas = await proximasEntradas();
    state.misPlanes = new Set(entradas.map(e => e.id));
    const vigente = id => { const e = eventoEnCache(id); return e && !esCancelado(e) && e.fechaTs > ahora - 6 * HORA; };
    const eventos = state.perfil.ocultarPlanes ? [] : entradas.filter(e => e.privacidad === 'publica' && vigente(e.id)).map(e => e.id).slice(0, 60);
    state.misCompartidos = state.misCompartidos.filter(vigente);
    const red = {};
    Object.entries(state.red.amigosVan).filter(([id]) => vigente(id))
      .sort((a, b) => b[1].length - a[1].length).slice(0, 150).forEach(([id, l]) => { red[id] = l.length; });
    const compartidos = state.perfil.ocultarPlanes ? [] : state.misCompartidos.slice(0, 60);
    const notas = {};
    compartidos.forEach(id => { const n = limpiarNota(state.misNotas[id]); if(n) notas[id] = n; });
    state.misNotas = notas;
    await DataService.guardarPlanes(state.uid, { eventos, compartidos, notas, red, ts: ahora });
  } catch(e){ console.warn('planes', e); }
}

// =========================================================
//  GUSTOS MUSICALES → "Para vos"
//  Lo que la persona eligió al crear la cuenta (o en su perfil) se usa para recomendarle eventos.
//  Coincidencia exacta del estilo = 2 puntos; estilo parecido (ej. Techno ↔ House) = 1 punto.
// =========================================================
const PARECIDOS = {
  techno: ['electronica', 'house'], house: ['electronica', 'techno'], electronica: ['techno', 'house'],
  cachengue: ['reggaeton', 'cumbia', 'trap'], reggaeton: ['cachengue', 'trap'], trap: ['reggaeton', 'cachengue'],
  cumbia: ['cachengue', 'cuarteto'], cuarteto: ['cumbia', 'cachengue'], rock: ['pop'], pop: ['rock']
};
// Mis gustos, normalizados (techno, reggaeton, previas...).
function misGustos(){ return (state.perfil?.intereses || []).map(normalizar); }
// Cuánto le puede interesar un evento según sus gustos: { puntos, motivo } (motivo = el gusto que coincide).
function afinidad(ev, gustos = misGustos()){
  let mejor = { puntos: 0, motivo: '' };
  const musica = normalizar(ev.musica || '');
  for(const g of gustos){
    let pts = 0;
    if(g === 'previas') pts = ev.tipo === 'previa' ? 2 : 0;
    else if(g === 'universitarias') pts = esUniversitaria(ev) ? 2 : 0;
    else if(g === 'after') pts = ev.ocasion === 'after' ? 2 : 0;
    else if(g === 'penas') pts = ev.ocasion === 'pena' ? 2 : 0;
    else if(g === 'egresados') pts = ev.ocasion === 'egresados' ? 2 : 0;
    else if(g === 'musica en vivo') pts = ev.ocasion === 'musical' ? 2 : 0;
    else if(g === 'gastronomia') pts = ev.ocasion === 'gastronomico' ? 2 : 0;
    else if(g === 'charlas y talleres') pts = ev.ocasion === 'charla' || ev.ocasion === 'taller' ? 2 : 0;
    else if(g === 'arte y cultura') pts = ev.ocasion === 'cultural' ? 2 : 0;
    else if(g === 'deportes') pts = ev.ocasion === 'deportivo' ? 2 : 0;
    else if(g === 'ferias') pts = ev.ocasion === 'feria' ? 2 : 0;
    else if(ev.categoria === g || (musica && musica.includes(g))) pts = 2;
    else if((PARECIDOS[g] || []).includes(ev.categoria)) pts = 1;
    if(pts > mejor.puntos) mejor = { puntos: pts, motivo: (state.perfil.intereses || []).find(i => normalizar(i) === g) || g };
  }
  return mejor;
}
// "Techno y House" (los gustos de la persona, para los títulos).
function gustosTexto(){
  const l = (state.perfil?.intereses || []).slice(0, 3);
  return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];
}
// Eventos para vos: los que más coinciden con tus gustos (y si van amigos, mejor).
function paraVos(){
  const ahora = Date.now(), gustos = misGustos();
  if(!gustos.length) return [];
  return eventosParaVer()
    .filter(e => !esCancelado(e) && e.creador !== state.uid && e.fechaTs > ahora - HORA)
    .map(e => ({ e, a: afinidad(e, gustos) }))
    .filter(x => x.a.puntos > 0)
    .sort((x, y) => y.a.puntos - x.a.puntos || (amigosQueVan(y.e).length - amigosQueVan(x.e).length) || x.e.fechaTs - y.e.fechaTs)
    .slice(0, 10)
    .map(x => ({ e: x.e, razon: `🎧 ${x.a.puntos === 2 ? 'Porque te gusta' : 'Parecido a'} ${x.a.motivo}` }));
}

// Comentario al compartir: opcional, hasta 15 palabras y 100 letras.
const NOTA_MAX_PALABRAS = 15, NOTA_MAX_CARACTERES = 100;
// Deja el comentario dentro del límite (por si llega uno más largo de otro lado).
function limpiarNota(t){
  if(typeof t !== 'string') return '';
  return t.trim().split(/\s+/).filter(Boolean).slice(0, NOTA_MAX_PALABRAS).join(' ').slice(0, NOTA_MAX_CARACTERES);
}
// Amigos que se pueden mencionar con @, filtrados por lo que se va escribiendo (máx. 5).
function amigosParaMencionar(q){
  const b = normalizar(q || '');
  return amigosUids().filter(u => !state.bloqueados.has(u)).map(u => state.usuarios[u]).filter(u => u && u.usuario)
    .filter(u => !b || u.usuario.startsWith(b) || normalizar(nombreVisible(u)).split(/\s+/).some(p => p.startsWith(b)))
    .slice(0, 5);
}
// Carita chiquita (foto o iniciales).
function avatarMini(u){
  return `<i class="av-mini">${u && fotoValida(u.foto) ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : esc(u?.iniciales || inicialesDe(u?.nombre))}</i>`;
}
// Amigos mencionados en un texto (@usuario) → sus uids. Solo cuentan los amigos.
function mencionadosEn(texto){
  const handles = new Set((String(texto || '').match(/@([a-z0-9._]{3,20})/gi) || []).map(h => h.slice(1).toLowerCase()));
  return amigosUids().filter(u => state.usuarios[u]?.usuario && handles.has(state.usuarios[u].usuario.toLowerCase()) && !state.bloqueados.has(u));
}
// Texto del comentario con las @menciones resaltadas (ya escapado).
function textoConMenciones(t){ return esc(t).replace(/(^|\s)@([a-z0-9._]{3,20})/gi, '$1<span class="mencion">@$2</span>'); }
// Burbuja con el comentario de un amigo que compartió el evento.
function notaAmigoHTML(ev, sinMia){
  const n = (state.red.notas?.[ev.id] || []).find(x => !state.bloqueados.has(x.uid));
  if(n) return `<div class="nota-amigo"><span class="nota-txt">${textoConMenciones(n.texto)}</span><span class="nota-quien">— ${esc(nombreCorto(state.usuarios[n.uid]))}</span></div>`;
  const mia = !sinMia && state.misCompartidos?.includes(ev.id) && state.misNotas?.[ev.id];   // en el evento, la mía ya está en su caja
  return mia ? `<div class="nota-amigo nota-propia"><span class="nota-txt">${textoConMenciones(mia)}</span><span class="nota-quien">— Vos</span></div>` : '';
}
// Primer nombre (o apodo).
function nombreCorto(u){ return String(nombreVisible(u) || '').trim().split(/\s+/)[0] || 'Alguien'; }
// Amigos que van a un evento.
function amigosQueVan(ev){
  return (state.red.amigosVan[ev.id] || []).filter(u => !state.bloqueados.has(u) && u !== state.uid);
}
// "Juan, Ivo y 2 amigos más van"
function frasePersonas(uids, verboUno, verboVarios){
  const n = uids.map(u => nombreCorto(state.usuarios[u]));
  if(!n.length) return '';
  if(n.length === 1) return `<b>${esc(n[0])}</b> ${verboUno}`;
  if(n.length === 2) return `<b>${esc(n[0])}</b> y <b>${esc(n[1])}</b> ${verboVarios}`;
  if(n.length === 3) return `<b>${esc(n[0])}</b>, <b>${esc(n[1])}</b> y <b>${esc(n[2])}</b> ${verboVarios}`;
  return `<b>${esc(n[0])}</b>, <b>${esc(n[1])}</b> y ${n.length - 2} amigos más ${verboVarios}`;
}
// Caritas superpuestas de amigos.
function carasHTML(uids){
  return `<span class="caras">${uids.slice(0, 3).map(u => { const x = state.usuarios[u]; return `<i>${x && fotoValida(x.foto) ? `<img src="${esc(x.foto)}" alt="" referrerpolicy="no-referrer">` : esc(x?.iniciales || inicialesDe(x?.nombre))}</i>`; }).join('')}</span>`;
}
// "Juan, Ivo y 2 amigos más van".
function amigosVanHTML(ev, largo){
  const van = amigosQueVan(ev);
  const destino = ev.tipo === 'previa' ? 'a esta previa' : 'a esta fiesta';
  if(van.length) return `<div class="amigos-van">${carasHTML(van)}<span>${frasePersonas(van, largo ? 'va ' + destino : 'va', largo ? 'van ' + destino : 'van')}</span></div>${notaAmigoHTML(ev, largo)}`;
  const comp = (state.red.compartidoPor[ev.id] || []).filter(u => !state.bloqueados.has(u));
  if(comp.length) return `<div class="amigos-van">${carasHTML(comp)}<span>${frasePersonas(comp, 'lo compartió', 'lo compartieron')}</span></div>${notaAmigoHTML(ev, largo)}`;
  if(state.misCompartidos?.includes(ev.id)) return `<div class="amigos-van amigos-van-yo">${ICO_REPOST}<span><b>Lo compartiste vos</b></span></div>${notaAmigoHTML(ev, largo)}`;
  return '';
}

// "Tal vez te interese": amigos que van (x4), compartidos por amigos (x2),
// amigos de amigos (x1), tus gustos (+1.5) y lo que se está moviendo
function sugerencias(){
  const ahora = Date.now();
  const gustos = new Set((state.perfil?.intereses || []).map(normalizar));
  return eventosParaVer()
    .filter(e => !esCancelado(e) && e.creador !== state.uid && e.fechaTs > ahora - HORA && !state.misPlanes.has(e.id))
    .map(e => {
      const van = amigosQueVan(e).length, comp = (state.red.compartidoPor[e.id] || []).length, fof = Math.min(state.red.fof[e.id] || 0, 6);
      const af = afinidad(e, [...gustos]), gusta = af.puntos > 0;
      const mov = Math.min(e.repostsCount || 0, 10) * 0.2 + ((e.confirmadosCount || 0) / Math.max(1, e.capacidad || 1)) * 0.5;
      const score = van * 4 + comp * 2 + fof + af.puntos * 0.9 + mov;
      const razon = van ? null : comp ? 'Lo compartieron tus amigos' : fof ? '👥 Van amigos de tus amigos' : gusta ? `🎧 Porque te gusta ${af.motivo}` : '📈 Se está moviendo';
      return { e, score, razon, social: van + comp + fof };
    })
    .filter(x => x.social > 0 || x.score >= 1.5)
    .sort((a, b) => b.score - a.score || a.e.fechaTs - b.e.fechaTs)
    .slice(0, 8);
}
// Lo que compartieron tus amigos (con quién lo compartió)
function nombresCorto(uids){
  const n = uids.map(u => nombreVisible(state.usuarios[u]).split(' ')[0]);
  return n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} y ${n[1]}` : `${n[0]} y ${n.length - 1} más`;
}
// Eventos que compartieron mis amigos, con quién los compartió.
function compartidosDeAmigos(){
  const ahora = Date.now();
  const todos = Object.assign({}, state.red.compartidoPor || {});
  (state.misCompartidos || []).forEach(id => { if(!todos[id]) todos[id] = []; });   // también lo que compartí yo
  return Object.entries(todos)
    .map(([id, uids]) => ({ e: eventoEnCache(id), uids }))
    .filter(x => x.e && eventoVisible(x.e) && !esCancelado(x.e) && x.e.fechaTs > ahora - HORA)
    .sort((a, b) => b.uids.length - a.uids.length || a.e.fechaTs - b.e.fechaTs)
    .slice(0, 10)
    .map(x => ({ e: x.e, mio: !x.uids.length, razon: x.uids.length ? `${nombresCorto(x.uids)} lo ${x.uids.length === 1 ? 'compartió' : 'compartieron'}` : 'Lo compartiste vos' }));
}
// "Lo compartieron vos y Sofi" / "3 personas lo compartieron".
function textoCompartidoPor(ev){
  const n = ev.repostsCount || 0;
  const amigos = (state.red.compartidoPor?.[ev.id] || []).filter(u => state.usuarios[u]).slice(0, 2);
  const yo = !!state.misCompartidos?.includes(ev.id);
  const quienes = [...(yo ? ['vos'] : []), ...amigos.map(u => nombreVisible(state.usuarios[u]).split(' ')[0])];
  if(!quienes.length) return `${n} ${n === 1 ? 'persona lo compartió' : 'personas lo compartieron'}`;
  const extra = Math.max(0, n - quienes.length);
  if(yo && quienes.length === 1 && !extra) return 'Lo compartiste vos';
  const lista = extra ? quienes.join(', ') + ` y ${extra} ${extra === 1 ? 'persona más' : 'personas más'}`
    : quienes.length === 1 ? quienes[0] : quienes.slice(0, -1).join(', ') + ' y ' + quienes[quienes.length - 1];
  return (quienes.length + extra > 1 ? 'Lo compartieron ' : 'Lo compartió ') + lista;
}
// Lleva a la sección "Compartiste" del perfil.
function verMisCompartidos(){
  ir('perfil');
  setTimeout(() => { const b = document.getElementById('perfil-compartidos-bloque'); if(b && b.scrollIntoView) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
}
// Eventos "En tendencia" (más compartidos y confirmados).
function tendencia(){
  const ahora = Date.now();
  return eventosParaVer()
    .filter(e => !esCancelado(e) && e.fechaTs > ahora - HORA && ((e.repostsCount || 0) > 0 || (e.confirmadosCount || 0) >= 5))
    .sort((a, b) => ((b.repostsCount || 0) * 2 + (b.confirmadosCount || 0)) - ((a.repostsCount || 0) * 2 + (a.confirmadosCount || 0)))
    .slice(0, 6);
}

// Compartir en mi perfil (repost): lo ven mis amigos y suma para "En tendencia"
async function alternarCompartir(ev, btn){
  if(!ev || ev.creador === state.uid) return;
  btn.disabled = true;
  try{
    const ya = await DataService.yaCompartido(ev.id, state.uid);
    const c = eventoEnCache(ev.id);
    if(ya){
      await DataService.dejarDeCompartir(ev.id, state.uid);
      state.misCompartidos = state.misCompartidos.filter(id => id !== ev.id);
      delete state.misNotas[ev.id];
      if(c) c.repostsCount = Math.max(0, (c.repostsCount || 0) - 1);
      toast('Ya no lo compartís');
    } else {
      await Promise.all(amigosUids().slice(0, 100).map(u => getUsuario(u).catch(() => null)));   // para sugerirlos con @
      const nota = await pedirTexto('Compartir con tus amigos', 'Les aparece en su inicio. Si querés, sumá un comentario (es opcional). Escribí @ para mencionar a un amigo y le llega un aviso.',
        'Ej: ¡Vamos a esta, @sofi! 🔥', 'Compartir', { maxPalabras: NOTA_MAX_PALABRAS, maxCaracteres: NOTA_MAX_CARACTERES, cancelarTxt: 'Cancelar', menciones: true });
      if(nota === null){ btn.disabled = false; return; }
      await DataService.compartirEvento(ev.id, state.uid, nombreVisible(state.perfil));
      state.misCompartidos = [ev.id, ...state.misCompartidos.filter(id => id !== ev.id)].slice(0, 60);
      if(limpiarNota(nota)) state.misNotas[ev.id] = limpiarNota(nota); else delete state.misNotas[ev.id];
      if(c) c.repostsCount = (c.repostsCount || 0) + 1;
      toast('Lo compartiste con tus amigos ✓');
      // A los que mencionó les llega "te mencionó"; al resto de los amigos, el aviso común de compartido
      const mencionados = mencionadosEn(state.misNotas[ev.id]);
      mencionados.forEach(u => notificar(u, 'mencion', { objetoId: ev.id, objetoNombre: ev.nombre, texto: state.misNotas[ev.id] }));
      amigosUids().filter(u => !mencionados.includes(u)).slice(0, 100).forEach(u => notificar(u, 'evento_compartido', { objetoId: ev.id, objetoNombre: ev.nombre }));
      if(mencionados.length) toast(`Lo compartiste y le avisamos a ${mencionados.length === 1 ? nombreCorto(state.usuarios[mencionados[0]]) : mencionados.length + ' amigos'} ✓`);
    }
    sincronizarPlanes();
    pintarMisCompartidos();
    renderDetalle(ev.id);
  } catch(e){
    console.error(e);
    toast('No se pudo compartir');
    btn.disabled = false;
  }
}
// Botón "Compartir con mis amigos" / "Compartido ✓".
async function pintarBotonCompartir(ev, tok){
  const btn = document.getElementById('btn-repost');
  if(!btn || state.invitado) return;
  let ya = false;
  try{ ya = await DataService.yaCompartido(ev.id, state.uid); } catch(e){}
  if(tok !== state.tok) return;
  btn.classList.toggle('hecho', ya);
  btn.innerHTML = ICO_REPOST + (ya ? 'Compartido ✓ · tocá para dejar de compartir' : 'Compartir con mis amigos');
  btn.onclick = () => alternarCompartir(ev, btn);
  const caja = document.getElementById('mi-nota-repost');
  if(caja) caja.innerHTML = ya ? miNotaHTML(ev.id) : '';
}
// Mi comentario de un evento que compartí, con botones para editarlo o borrarlo.
function miNotaHTML(id){
  const n = state.misNotas?.[id];
  return `<div class="mi-nota">
    <div class="mi-nota-txt">${n ? `<small>Tu comentario</small>${textoConMenciones(n)}` : '<small>Sin comentario</small>'}</div>
    <div class="mi-nota-acciones">
      <button class="btn-nota" data-editar-nota="${esc(id)}">✏️ ${n ? 'Editar' : 'Agregar comentario'}</button>
      ${n ? `<button class="btn-nota peligro" data-borrar-nota="${esc(id)}">🗑 Borrar</button>` : ''}
    </div></div>`;
}
// Vuelve a pintar todo lo que muestra mis compartidos (detalle, perfil, inicio).
function repintarMisCompartidos(id){
  const caja = document.getElementById('mi-nota-repost');
  if(caja && caja.dataset.ev === id) caja.innerHTML = miNotaHTML(id);
  pintarMisCompartidos();
  if(typeof renderHome === 'function') renderHome();
}
// Cambiar el comentario de algo que ya compartí (y avisar a los que se mencionen por primera vez).
async function editarNotaCompartido(id){
  const ev = eventoEnCache(id);
  await Promise.all(amigosUids().slice(0, 100).map(u => getUsuario(u).catch(() => null)));
  const antes = state.misNotas[id] || '';
  const nota = await pedirTexto(antes ? 'Editar tu comentario' : 'Agregar un comentario', 'Lo ven tus amigos en su inicio. Escribí @ para mencionar a un amigo.',
    'Ej: ¡Vamos a esta, @sofi! 🔥', 'Guardar', { maxPalabras: NOTA_MAX_PALABRAS, maxCaracteres: NOTA_MAX_CARACTERES, cancelarTxt: 'Cancelar', menciones: true, valorInicial: antes });
  if(nota === null) return;
  const limpia = limpiarNota(nota);
  if(limpia) state.misNotas[id] = limpia; else delete state.misNotas[id];
  await guardarMisPlanes();
  const ya = new Set(mencionadosEn(antes));
  mencionadosEn(limpia).filter(u => !ya.has(u)).forEach(u => notificar(u, 'mencion', { objetoId: id, objetoNombre: ev?.nombre || '', texto: limpia }));
  toast(limpia ? 'Comentario guardado ✓' : 'Comentario borrado');
  repintarMisCompartidos(id);
}
// Borrar mi comentario (el evento sigue compartido).
async function borrarNotaCompartido(id){
  if(!(await confirmar('¿Borrar tu comentario?', 'El evento sigue compartido con tus amigos, pero sin el comentario.', 'Borrar'))) return;
  delete state.misNotas[id];
  await guardarMisPlanes();
  toast('Comentario borrado');
  repintarMisCompartidos(id);
}
// Avisa a mis amigos que publiqué un evento.
function avisarAmigosEvento(id, nombre, yaAvisados){
  const ya = new Set(yaAvisados || []);
  amigosUids().filter(u => !ya.has(u)).slice(0, 150).forEach(u => notificar(u, 'amigo_evento', { objetoId: id, objetoNombre: nombre }));
}

// =========================================================
//  HOME
// =========================================================
function filtrarPorChip(eventos, filtro){
  switch(filtro){
    case 'hoy':            return eventos.filter(e => esEstaNoche(e.fechaTs));
    case 'fiestas':        return eventos.filter(e => e.tipo !== 'previa' && OCASIONES_FIESTA.has(e.ocasion || ''));
    case 'previas':        return eventos.filter(e => e.tipo === 'previa' || e.ocasion === 'previa');
    case 'musica':         return eventos.filter(e => e.ocasion === 'musical' || e.ocasion === 'pena');
    case 'gastro':         return eventos.filter(e => e.ocasion === 'gastronomico' || e.ocasion === 'feria');
    case 'charlas':        return eventos.filter(e => e.ocasion === 'charla' || e.ocasion === 'taller');
    case 'cultura':        return eventos.filter(e => e.ocasion === 'cultural');
    case 'deportes':       return eventos.filter(e => e.ocasion === 'deportivo');
    case 'paravos':        return eventos.filter(e => afinidad(e).puntos > 0).sort((a, b) => afinidad(b).puntos - afinidad(a).puntos || a.fechaTs - b.fechaTs);
    case 'electronica':    return eventos.filter(e => ['techno','electronica'].includes(e.categoria));
    case 'cachengue':      return eventos.filter(e => e.categoria==='cachengue');
    case 'house':          return eventos.filter(e => e.categoria==='house');
    case 'universitarias': return eventos.filter(esUniversitaria);
    case 'egresados':      return eventos.filter(e => e.ocasion==='egresados');
    case 'pena':           return eventos.filter(e => e.ocasion==='pena');
    case 'after':          return eventos.filter(e => e.ocasion==='after');
    case 'eventos':        return eventos.filter(e => e.ocasion==='musical' || e.ocasion==='gastronomico');
    case 'privadas':       return eventos.filter(e => e.privacidad==='privada');
    default: return eventos;
  }
}
// Orden: más cerca primero (sin distancia, al final por fecha).
function porDistancia(a, b){ return (a.dist ?? 1e9) - (b.dist ?? 1e9) || a.fechaTs - b.fechaTs; }
// Agrega la distancia a cada evento (si sabemos dónde estás).
function conDistancia(eventos){
  const c = state.userCoords;
  return eventos.map(e => ({ ...e, dist: c && typeof e.lat === 'number' ? distanciaKm(c.lat, c.lng, e.lat, e.lng) : undefined }));
}

// Pinta el inicio: esta noche, sugerencias, compartidos, tendencia, semana, cerca, lo que viene.
function renderHome(){
  renderTicker();
  const cont1 = document.getElementById('lista-esta-noche');
  const cont2 = document.getElementById('lista-cerca');
  const titulo1 = document.getElementById('titulo-fila-1');
  const todosVis = eventosVisibles().filter(e => !esCancelado(e));
  const base = eventosParaVer();
  document.getElementById('home-aviso-rango').innerHTML = avisoRangoHTML(todosVis.length, base.filter(e => !esCancelado(e)).length);

  document.getElementById('home-eyebrow').textContent = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  pintarUbicacion();

  // Agenda: esta semana (sin contar esta noche) y lo que viene después
  const ahora = Date.now(), semana = ahora + 7 * 24 * HORA;
  const futuros = base.filter(e => !esCancelado(e)).sort((a, b) => a.fechaTs - b.fechaTs);
  const deSemana = futuros.filter(e => !esEstaNoche(e.fechaTs) && e.fechaTs < semana);
  const queViene = futuros.filter(e => e.fechaTs >= semana).slice(0, 12);
  document.getElementById('titulo-semana').style.display = deSemana.length ? '' : 'none';
  document.getElementById('lista-semana').style.display = deSemana.length ? '' : 'none';
  const sug = sugerencias(), ten = tendencia();
  const mostrar = (id, on) => { document.getElementById(id).style.display = on ? '' : 'none'; };
  // Para vos (según tus gustos de música) o, si no elegiste, una invitación a elegirlos
  const pv = state.invitado ? [] : paraVos();
  const sinGustos = !state.invitado && state.perfil && !misGustos().length;
  mostrar('titulo-paravos', pv.length || sinGustos); mostrar('lista-paravos', pv.length || sinGustos);
  document.getElementById('sub-paravos').textContent = pv.length ? `Porque te gusta ${gustosTexto()}` : '';
  document.querySelector('#titulo-paravos > span').style.display = pv.length ? '' : 'none';
  document.getElementById('lista-paravos').innerHTML = pv.length ? pv.map(x => tarjetaHTML(x.e, null, x.razon)).join('')
    : sinGustos ? `<div class="cta-gustos"><b>🎧 ¿Qué música te gusta?</b><span>Elegí tus estilos y te mostramos las fiestas que van con vos.</span><button class="btn btn-primario" onclick="elegirGustos()">Elegir mi música</button></div>` : '';
  const chipPV = document.getElementById('chip-paravos');
  if(chipPV) chipPV.style.display = misGustos().length && !state.invitado ? '' : 'none';
  // Esta semana: primero lo que va con tu música (sin perder el orden por fecha entre iguales)
  if(misGustos().length) deSemana.sort((a, b) => (afinidad(b).puntos > 0) - (afinidad(a).puntos > 0) || a.fechaTs - b.fechaTs);
  document.getElementById('lista-semana').innerHTML = deSemana.map(e => tarjetaHTML(e, null, afinidad(e).puntos === 2 ? `🎧 ${afinidad(e).motivo}` : '')).join('');
  // En "Tal vez te interese" no repetimos lo que ya está en "Para vos"
  const enPV = new Set(pv.map(x => x.e.id));
  const sugF = sug.filter(x => !enPV.has(x.e.id) || x.social > 0);   // si tiene motivo social (amigos), se queda
  sug.length = 0; sug.push(...sugF);
  mostrar('titulo-sugeridos', sug.length); mostrar('lista-sugeridos', sug.length);
  document.getElementById('lista-sugeridos').innerHTML = sug.map(x => tarjetaHTML(x.e, null, x.razon)).join('');
  const comp = compartidosDeAmigos();
  mostrar('titulo-compartidos', comp.length); mostrar('lista-compartidos', comp.length);
  const tituloComp = document.querySelector('#titulo-compartidos h2');
  if(tituloComp) tituloComp.textContent = comp.every(x => x.mio) ? 'Lo que compartiste' : comp.some(x => x.mio || (state.misCompartidos || []).includes(x.e.id)) ? 'Compartidos por vos y tus amigos' : 'Compartidos por tus amigos';
  document.getElementById('lista-compartidos').innerHTML = comp.map(x => tarjetaHTML(x.e, null, x.razon)).join('');
  mostrar('titulo-tendencia', ten.length >= 2); mostrar('lista-tendencia', ten.length >= 2);
  document.getElementById('lista-tendencia').innerHTML = ten.map(e => tarjetaHTML(e, null, e.repostsCount ? `${e.repostsCount} ${e.repostsCount === 1 ? 'compartido' : 'compartidos'}` : `${e.confirmadosCount} van`)).join('');
  document.getElementById('titulo-viene').style.display = queViene.length ? '' : 'none';
  document.getElementById('lista-viene').innerHTML = queViene.map(e => tarjetaHorizontalHTML(e)).join('');

  if(!base.length){
    cont1.innerHTML = todosVis.length ? emptyState('No hay eventos en tu rango de distancia.') : emptyCrear('Todavía no hay eventos publicados.');
    cont2.innerHTML = emptyState('Cuando alguien publique un evento cerca tuyo, lo vas a ver acá.');
    return;
  }

  let filtrados;
  if(state.filtroActivoHome === 'cerca'){
    filtrados = conDistancia(base).sort(porDistancia);
    titulo1.textContent = 'Más cerca tuyo 📍';
  } else {
    filtrados = filtrarPorChip(base, state.filtroActivoHome);
    const TIT = { hoy: 'Hoy 🔥', paravos: 'Para vos 🎧', fiestas: 'Fiestas 🪩', previas: 'Previas 🍾', musica: 'Música en vivo 🎤', gastro: 'Gastronomía y ferias 🍽️', charlas: 'Charlas y talleres 💬', cultura: 'Arte y cultura 🎭', deportes: 'Deporte y aire libre ⚽', privadas: 'Privadas abiertas 🔒' };
    titulo1.textContent = TIT[state.filtroActivoHome] || 'Recomendados ✨';
    // Nada esta noche: arriba va lo próximo (así lo recién publicado se ve primero)
    if(state.filtroActivoHome === 'hoy' && !filtrados.length && futuros.length){
      const ocultar = (...ids) => ids.forEach(id => { document.getElementById(id).style.display = 'none'; });
      if(deSemana.length){ filtrados = deSemana; titulo1.textContent = 'Esta semana 🔥'; ocultar('titulo-semana', 'lista-semana'); }
      else { filtrados = queViene; titulo1.textContent = 'Lo que viene 🔥'; ocultar('titulo-viene'); document.getElementById('lista-viene').innerHTML = ''; }
    }
  }
  if(state.filtroActivoHome === 'hoy' && misGustos().length) filtrados = [...filtrados].sort((a, b) => (afinidad(b).puntos > 0) - (afinidad(a).puntos > 0) || a.fechaTs - b.fechaTs);
  cont1.innerHTML = filtrados.length
    ? filtrados.map(e=>tarjetaHTML(e, e.dist!==undefined ? textoDistancia(e, e.dist) : null, afinidad(e).puntos === 2 ? `🎧 ${afinidad(e).motivo}` : '')).join('')
    : emptyState('No hay eventos para este filtro todavía. ¡Creá el primero!');

  const cercanos = conDistancia(base).sort(porDistancia).slice(0,6);
  document.getElementById('titulo-cerca').textContent = !state.userCoords ? 'Próximos eventos' : state.radioKm ? `Cerca tuyo · ${state.radioKm} km` : 'Más cerca tuyo';
  cont2.innerHTML = cercanos.length ? cercanos.map(e=>tarjetaHTML(e, textoDistancia(e, e.dist))).join('') : emptyState(`No hay eventos a menos de ${state.radioKm} km.`);
}

// Filtro (chip) del inicio.
function elegirChipHome(el, filtro){
  document.querySelectorAll('#chips-home .chip').forEach(c=>c.classList.remove('activo'));
  el.classList.add('activo');
  state.filtroActivoHome = filtro;
  renderHome();
}

// =========================================================
//  EXPLORAR
// =========================================================
let _debounceBuscar;
document.getElementById('input-buscar').addEventListener('input', (e)=>{
  clearTimeout(_debounceBuscar);
  if(state.modoExplorar === 'personas'){ buscarGente(e.target.value); return; }
  _debounceBuscar = setTimeout(()=>buscar(e.target.value), 220);
  buscarPersonasExplorar(e.target.value);
});

// Pinta Explorar con búsqueda, filtro y orden.
function renderExplorar(){
  pintarBotonMas();
  const cont = document.getElementById('lista-explorar-cont');
  let eventos = eventosFiltradosExplorar();
  const f = state.filtroActivoExplorar;
  pintarMapaEventos();

  let lista = f==='cerca' ? conDistancia(eventos).sort(porDistancia) : eventos;

  const distTxt = e => state.userCoords && typeof e.lat === 'number' ? textoDistancia(e, distanciaKm(state.userCoords.lat, state.userCoords.lng, e.lat, e.lng)) : null;
  const fuera = eventosVisibles().filter(e => !esCancelado(e)).length - eventosParaVer().filter(e => !esCancelado(e)).length;
  cont.innerHTML = lista.length
    ? lista.map(e=>tarjetaHorizontalHTML(e, distTxt(e))).join('')
    : (state.eventos.length
        ? (fuera > 0 && !state.busqueda ? avisoRangoHTML(fuera, 0) : emptyState('No encontramos eventos con esos filtros. Probá con otra búsqueda.'))
        : emptyCrear('Todavía no hay eventos publicados.'));
}

// Filtro (chip) de Explorar.
function elegirChipExplorar(el, filtro){
  document.querySelectorAll('#chips-explorar .chip').forEach(c=>c.classList.remove('activo'));
  el.classList.add('activo');
  state.filtroActivoExplorar = filtro;
  renderExplorar();
}
// Texto del buscador de eventos.
function buscar(valor){ state.busqueda = valor.trim(); renderExplorar(); }

// Botón actualizar de Explorar.
async function refrescarEventos(){
  try{
    toast('Actualizando...');
    state.eventos = await DataService.listEventos();
    renderHome(); renderExplorar(); renderPerfilVista();
    toast('Al día');
  } catch(e){ console.error(e); toast('No se pudo actualizar'); }
}

// =========================================================
//  DETALLE
// =========================================================
function abrirDetalle(id){
  ir('detalle', { clave: 'detalle:' + id, abrir: () => abrirDetalle(id) });
  fijarRuta('evento/' + id);
  renderDetalle(id);
}

// Pantalla de detalle de un evento (todo lo que se ve y los botones según quién sos).
async function renderDetalle(id){
  const tok = ++state.tok;
  const cont = document.getElementById('detalle-contenido');
  cont.innerHTML = '<div class="empty-state" style="padding-top:100px;">Cargando...</div>';

  try{
    // Siempre leemos el evento fresco: el cupo puede haber cambiado
    const ev = await eventoActual(id);
    if(tok !== state.tok) return;
    if(!ev){ cont.innerHTML = emptyState('No encontramos ese evento.'); return; }
    if(!eventoVisible(ev)){
      cont.innerHTML = `<div style="padding:18px 20px 0;"><button class="icon-btn" onclick="volver('explorar')" aria-label="Volver">‹</button></div>` +
        emptyState(state.bloqueados.has(ev.creador) ? 'Bloqueaste a quien organiza este evento.' : 'Este evento está en revisión por denuncias de la comunidad.');
      return;
    }

    const esCreador = ev.creador === state.uid;
    const esPrivada = ev.privacidad === 'privada';
    const asistencia = state.invitado ? null : await DataService.getAsistencia(id, state.uid);
    const estado = asistencia?.estado || null;
    const adentro = estado === 'aprobado' || estado === 'confirmado';
    const miAcred = (ev.deOrganizacion && !esCreador && !state.invitado) ? await DataService.getAcreditacion(id, state.uid) : null;
    const cupo = ev.confirmadosCount || 0;
    const cap = Math.max(1, ev.capacidad || 1);
    const lleno = cupo >= cap;

    let lugarMostrado = ev.lugar;
    if(esPrivada){
      if(adentro || esCreador){
        const dir = await DataService.getDireccionExacta(id);
        lugarMostrado = dir ? `${dir} (${lugarPublico(ev)})` : ev.lugar;
      } else {
        lugarMostrado = `${lugarPublico(ev)} · 🔒 la dirección la ven solo los invitados aprobados`;
      }
    }
    if(tok !== state.tok) return;

    // Texto y estado del botón principal
    let accionTxt, deshabilitado = false;
    const cancelado = esCancelado(ev);
    const ventaExterna = (!esPrivada && ev.linkEntradas) ? linkWeb(ev.linkEntradas, true) : null;
    if(adentro)                        accionTxt = 'Ver mi entrada';
    else if(cancelado)                { accionTxt = 'Evento cancelado'; deshabilitado = true; }
    else if(estado === 'solicitado')  { accionTxt = 'Solicitud enviada ⏳'; deshabilitado = true; }
    else if(estado === 'rechazado')   { accionTxt = 'Solicitud rechazada'; deshabilitado = true; }
    else if(estado === 'en-espera')   { if(lleno){ accionTxt = 'En lista de espera ⏳'; deshabilitado = true; } else accionTxt = '¡Se liberó un lugar! Confirmar'; }
    else if(esCreador && esPrivada)   { accionTxt = 'Sos el anfitrión'; deshabilitado = true; }
    else if(!esCreador && inscripcionCerrada(ev)) { accionTxt = 'Inscripción cerrada'; deshabilitado = true; }
    else if(esPrivada)                 accionTxt = 'Solicitar unirme';
    else if(ventaExterna && !esCreador) accionTxt = 'Comprar en ' + ventaExterna.texto + ' ↗';
    else if(lleno)                     accionTxt = 'Anotarme en lista de espera';
    else if(ev.precio > 0)             accionTxt = 'Reservar entrada';
    else                               accionTxt = 'Confirmar asistencia';

    const nombreOrg = ev.creadorNombre || ev.organizador;
    const bloqueChat = adentro
      ? `<button class="btn btn-secundario" data-ticket="${esc(ev.id)}">Abrir mi entrada y el grupo del evento</button>`
      : `<div class="chat-bloqueado">
           <div class="candado-grande">${svgLock}</div>
           <div class="txt-bloqueado"><b>Grupo privado del evento</b><span>Se habilita al confirmar tu asistencia. Solo lo ven los confirmados.</span></div>
         </div>`;

    const aviso = cancelado ? `
      <div class="bloque"><div class="aviso aviso-rojo">
        <b>🚫 Este evento fue cancelado</b>
        ${ev.motivoCancelacion ? `<span>Motivo: ${esc(ev.motivoCancelacion)}</span>` : ''}
        ${ev.precio > 0 ? `<span>Si pagaste una entrada, la devolución la coordinás directamente con ${esc(nombreOrg)}. Partazy no cobra ni devuelve dinero.</span><span>${esc(AVISO_DEVOLUCIONES)}</span>` : ''}
      </div></div>` : '';

    const verPago = !esPrivada || adentro || esCreador;
    const bloquePago = ev.precio > 0 ? `
      <div class="bloque">
        <h3 class="titulo-bloque">Pago de la entrada · ${esc(money(ev.precio))}</h3>
        <div class="pago-destacado">
          <div class="pago-monto"><small>Entrada</small><b>${esc(money(ev.precio))}</b></div>
          <div class="pago-como"><small>Cómo pagar</small><b>${esc(verPago ? (ev.pagoInfo || 'El organizador te indica cómo pagar.') : 'Se muestra cuando el anfitrión te aprueba.')}</b></div>
          ${verPago && datoPago(ev.pagoInfo) ? `<button class="btn btn-primario btn-copiar-pago" onclick="copiarDatoPago(this, ${esc(JSON.stringify(datoPago(ev.pagoInfo)))})">📋 Copiar ${/^\d+$/.test(datoPago(ev.pagoInfo)) ? 'CBU / CVU' : 'alias'}: ${esc(datoPago(ev.pagoInfo))}</button>` : ''}
        </div>
        <div class="aviso aviso-pago">
          <span>El pago se hace directamente a ${esc(nombreOrg)}. Partazy no cobra comisiones ni hace devoluciones: cualquier reintegro lo coordinás con el organizador.</span>
          <span>${esc(AVISO_DEVOLUCIONES)}</span>
        </div>
      </div>` : '';

    const bloqueAdmin = esCreador ? `
      <div class="bloque">
        <h3 class="titulo-bloque">Administrar evento</h3>
        ${cancelado ? '' : '<button class="btn btn-primario" id="btn-editar-evento" style="margin-bottom:10px;">✎ Editar evento</button>'}
        <div class="acciones-evento">
          ${cancelado ? '' : '<button class="btn btn-secundario" id="btn-cancelar-evento">Cancelar evento</button>'}
          <button class="btn btn-outline" id="btn-eliminar-evento">Eliminar evento</button>
        </div>
        <div class="ayuda-admin">${cancelado
          ? 'El evento quedó cancelado y los confirmados ven el aviso. Deja de aparecer solo cuando pasa la fecha.'
          : 'Cancelar: el evento queda visible como cancelado y se avisa en el grupo. Eliminar: se borra para siempre (solo si todavía nadie más confirmó).'}</div>
      </div>` : '';

    const panelSolicitudes = (esCreador && esPrivada && !cancelado) ? `
      <div class="bloque">
        <h3 class="titulo-bloque">Solicitudes pendientes</h3>
        <div class="lista-solicitudes" id="lista-solicitudes"><div class="empty-state">Cargando...</div></div>
      </div>` : '';

    const comoLlegar = (!esPrivada || adentro || esCreador) ? aExterno(ev.ubicacionExacta && typeof ev.lat === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${ev.lat},${ev.lng}` : urlMaps(lugarMostrado, ev.ciudad), 'Cómo llegar') : '';
    cont.innerHTML = `
      <div class="detalle-hero"><div class="hero-img ${ev.fotoGrande && !fotosGrandes.has(ev.id) ? 'cargando' : ''}" id="hero-img" style="background-image:${cssFoto(ev, fotosGrandes.get(ev.id) || ev.imagen)}"></div>
        <div class="hero-top">
          <button class="icon-btn" onclick="volver('explorar')" aria-label="Volver">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        </div>
        <div class="hero-bottom">
          <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}${ev.categoria ? ' · ' + esc(etiquetaEstilo(ev.categoria)) : ''}${ev.verificado?' · verificado':''}</div>
          <h1>${esc(ev.nombre)}</h1>
        </div>
      </div>

      <div class="bloque">
        <div class="organizador" data-usuario="${esc(ev.creador)}" role="button" tabindex="0" aria-label="Ver perfil de ${esc(nombreOrg)}">
          <div class="avatar">${state.usuarios[ev.creador] ? avatarHTML(state.usuarios[ev.creador]) : esc(inicialesDe(nombreOrg))}</div>
          <div style="flex:1;">
            <div class="nombre">${esc(nombreOrg)} ${ev.verificado? `<span class="verificado"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span>`:''}</div>
            <div class="rol">${esCreador ? 'Sos el organizador' : (ev.tipo==='fiesta' ? 'Organizador' : 'Anfitrión')}${ev.verificado?' verificado':''}<span class="nota-org-det" data-org-nota="${esc(ev.creador)}">${califOrgTxt(state.usuarios[ev.creador], true)}</span></div>
          </div>
          <span class="ir" aria-hidden="true">›</span>
        </div>
      </div>

      ${aviso}

      ${amigosVanHTML(ev, true) ? `<div class="bloque"><div class="bloque-amigos-van">${amigosVanHTML(ev, true)}</div></div>` : ''}

      ${panelSolicitudes}
      ${esCreador ? `<div class="bloque">
        <h3 class="titulo-bloque">Lista de confirmados</h3>
        ${cancelado ? '' : '<button class="btn btn-primario" id="btn-puerta" style="margin-bottom:12px;">🚪 Control de puerta</button>'}
        <div class="exportar"><button class="btn btn-secundario" data-exportar="${esc(ev.id)}|csv">⬇ Excel (CSV)</button><button class="btn btn-secundario" data-exportar="${esc(ev.id)}|pdf">⬇ PDF</button></div>
        <div class="lista-solicitudes" id="lista-confirmados"><div class="empty-state">Cargando...</div></div>
      </div>` : ''}

      <div class="bloque" id="bloque-calif" style="display:none;"></div>

      <div class="bloque" id="bloque-ambiente">${bloqueAmbienteHTML(ev, null, false)}</div>

      <div class="bloque">
        <h3 class="titulo-bloque">Detalles</h3>
        <div class="info-lista">
          <div class="info-item"><span class="ii-ico">${II.cuando}</span><div class="ii-txt"><small>Cuándo</small><b>${esc(horarioEvento(ev))}</b></div></div>
          <div class="info-item"><span class="ii-ico">${II.donde}</span><div class="ii-txt"><small>Dónde</small><b>${esc(lugarMostrado)}</b></div>${comoLlegar ? `<span class="ii-accion">${comoLlegar}</span>` : ''}</div>
          ${typeof ev.inscripcionHasta === 'number' ? `<div class="info-item${inscripcionCerrada(ev) ? ' insc-cerrada' : ''}"><span class="ii-ico">${II.reloj}</span><div class="ii-txt"><small>Inscripción</small><b>${esc(textoInscripcion(ev))}</b>${inscripcionCerrada(ev) ? '<span class="ii-sub">Ya no se puede anotar gente nueva</span>' : ''}</div></div>` : ''}
          <div class="info-item"><span class="ii-ico">${II.edad}</span><div class="ii-txt"><small>Edad</small><b>${esc(clasificacion(ev))}</b></div></div>
          ${ventaExterna
            ? `<div class="info-item"><span class="ii-ico">${II.gente}</span><div class="ii-txt"><small>Capacidad</small><b>${ev.capacidadDesconocida ? 'Según la venta' : `${cap} personas`}</b><span class="ii-sub cupo-ext">${cupo} ${cupo === 1 ? 'avisó' : 'avisaron'} que van por Partazy · el cupo lo maneja ${esc(ventaExterna.texto)}</span></div></div>`
            : `<div class="info-item"><span class="ii-ico">${II.gente}</span><div class="ii-txt"><small>Lugares</small><b>${cupo} de ${cap} anotados${lleno ? ' · lleno' : ''}</b>${lleno ? '' : `<span class="ii-sub">${cap - cupo === 1 ? 'Queda 1 lugar' : `Quedan ${cap - cupo} lugares`}</span>`}
                <div class="barra-cupo ${nivelCupo(cupo, cap)}" role="img" aria-label="${cupo} de ${cap} lugares ocupados"><div class="fill" style="width:${Math.max(3, Math.min(100, (cupo/cap)*100))}%;"></div></div></div>${pillCupoHTML(ev) ? `<span class="ii-accion">${pillCupoHTML(ev)}</span>` : ''}</div>`}
        </div>
        ${extrasHTML(ev)}
        ${ventaExterna && !esCreador && !estado && !cancelado ? `<button class="btn btn-secundario ya-compre" data-ya-compre="${esc(ev.id)}">✅ Ya compré mi entrada · Avisar que voy</button>` : ''}
        <div class="tags">
          <span class="tag">Dress code: ${esc(ev.dresscode||'Libre')}</span>
          ${ev.tipo !== 'previa' ? `<span class="tag ${ev.listaVip?'si':'no'}">${ev.listaVip? 'Con lista VIP' : 'Sin lista VIP'}</span>` : ''}
          ${ev.tipo === 'previa' ? `<span class="tag ${ev.bebida?'si':'no'}">${ev.bebida? 'Podés llevar bebida' : 'Sin bebida propia'}</span>` : ''}
          ${ev.musica ? `<span class="tag">🎵 ${esc(ev.musica)}</span>` : ''}
        </div>
      </div>

      <div class="bloque">
        <h3 class="titulo-bloque">Sobre el evento</h3>
        <p class="texto-desc">${esc(ev.descripcion||'')}</p>
      </div>

      ${ev.lineup ? `<div class="bloque"><h3 class="titulo-bloque">Line-up</h3><div class="lineup">${lineupItems(ev.lineup).map(x =>
        `<div class="lineup-item"><span class="hora">${esc(x.hora)}</span><b>${esc(x.nombre)}</b></div>`).join('')}</div></div>` : ''}

      ${bloquePago}
      ${esCreador && ev.listaVip ? '<div class="bloque" id="bloque-vip"></div>' : ''}

      ${ev.reglas ? `<div class="bloque"><h3 class="titulo-bloque">Reglas</h3><p class="texto-desc">${esc(ev.reglas)}</p></div>` : ''}

      <div class="bloque">
        <h3 class="titulo-bloque">Compartir</h3>
        ${(!esCreador && !cancelado && ev.privacidad === 'publica') ? `<button class="btn btn-outline btn-repost" id="btn-repost" style="margin-bottom:10px;">${ICO_REPOST}Compartir con mis amigos</button><div id="mi-nota-repost" data-ev="${esc(ev.id)}"></div>` : ''}
        <div class="acciones-evento">
          <button class="btn btn-secundario" id="btn-compartir-evento">Compartir link</button>
          <button class="btn btn-secundario" id="btn-enviar-amigos">Enviar a amigos</button>
        </div>
        ${(ev.repostsCount || 0) > 0 ? `<div class="contador-repost">${ICO_REPOST}${esc(textoCompartidoPor(ev))}</div>` : ''}
      </div>

      ${esCreador ? estadisticasHTML(ev) : ''}
      ${bloquePrensaHTML(ev, esCreador, miAcred)}

      <div class="bloque">${bloqueChat}</div>

      ${bloqueAdmin}

      <div class="bloque bloque-pie-det">
        ${!esCreador && !cancelado && estado && estado !== 'rechazado' && ev.fechaTs > Date.now() - HORA && !asistencia?.checkinTs
          ? `<button class="link-denuncia link-salir" data-salir="${esc(ev.id)}|${esc(estado)}">${estado === 'solicitado' ? '↩ Retirar mi solicitud' : estado === 'en-espera' ? '↩ Salir de la lista de espera' : '↩ Ya no voy · liberar mi lugar'}</button>` : ''}
        ${esCreador ? '' : '<button class="link-denuncia" id="btn-denunciar-evento">🚩 Denunciar este evento</button>'}
      </div>

      <div class="cta-fija">
        <div class="precio-fijo">
          <div class="label">${esPrivada?'Acceso':'Entrada'}</div>
          <div class="num">${esc(precioTxt(ev))}</div>
        </div>
        <button class="btn btn-primario" id="btn-accion-detalle" ${deshabilitado?'disabled':''}>${esc(accionTxt)}</button>
      </div>
    `;

    document.getElementById('btn-accion-detalle').onclick = () => accionDetalle(ev, estado, lleno, adentro);
    document.getElementById('btn-compartir-evento').onclick = () => compartirEvento(ev);
    document.getElementById('btn-enviar-amigos').onclick = () => enviarEventoAAmigos(ev);
    pintarBotonCompartir(ev, tok);
    contarVista(ev);
    if(ev.fotoGrande && !fotosGrandes.has(ev.id)) fotoGrandeDe(ev).then(f => {
      const h = document.getElementById('hero-img');
      if(!f || tok !== state.tok || !h) return;
      const pre = new Image();
      pre.onload = () => { h.style.backgroundImage = cssUrl(f); h.classList.remove('cargando'); };
      pre.src = f;
    });
    const bPuerta = document.getElementById('btn-puerta');
    if(bPuerta) bPuerta.onclick = () => abrirPuerta(ev);
    const bAcred = document.getElementById('btn-acreditacion');
    if(bAcred) bAcred.onclick = () => pedirAcreditacion(ev);
    if(esCreador && ev.deOrganizacion && !cancelado) cargarPrensa(ev, tok);
    const bDen = document.getElementById('btn-denunciar-evento');
    if(bDen) bDen.onclick = () => denunciarEvento(ev);
    if(esCreador && esPrivada && !cancelado) cargarSolicitudes(ev.id, tok);
    if(esCreador) cargarConfirmados(ev, tok);
    if(esCreador && ev.listaVip) DataService.getVip(ev.id).then(l => {
      const b = document.getElementById('bloque-vip');
      if(!b || tok !== state.tok) return;
      b.innerHTML = `<h3 class="titulo-bloque">⭐ Lista VIP (${l.length})</h3>` + (l.length
        ? `<div class="lista-vip">${l.map(n => `<span>${esc(n)}</span>`).join('')}</div>`
        : `<div class="ayuda">Todavía no anotaste a nadie. Tocá "Editar evento" para cargar los nombres.</div>`);
    }).catch(() => {});
    cargarAmbienteVivo(ev, tok, adentro);
    pintarCalificacion(ev, estado, tok);
    if(esCreador){
      const bc = document.getElementById('btn-cancelar-evento');
      if(bc) bc.onclick = () => cancelarEvento(ev);
      const be = document.getElementById('btn-editar-evento');
      if(be) be.onclick = () => editarEvento(ev);
      document.getElementById('btn-eliminar-evento').onclick = () => eliminarEvento(ev);
    }
  } catch(e){
    console.error(e);
    if(tok === state.tok) cont.innerHTML = emptyState('No pudimos cargar el evento. Revisá tu conexión.');
  }
}

// Botón principal del evento: confirmar, pedir unirse, lista de espera, comprar o ver entrada.
async function accionDetalle(ev, estado, lleno, adentro, yaCompro){
  if(adentro){ abrirTicket(ev.id); return; }
  if(esCancelado(ev)) return;
  // En lista de espera y se liberó un lugar: sale de la lista y confirma
  const desdeEspera = estado === 'en-espera' && !lleno;
  if(estado && !desdeEspera) return;
  if(inscripcionCerrada(ev) && ev.creador !== state.uid){ toast('La inscripción para este evento ya cerró'); return; }
  // Venta en otra plataforma: se compra allá (salvo que ya la haya comprado)
  const externa = (!yaCompro && ev.privacidad !== 'privada' && ev.linkEntradas && ev.creador !== state.uid) ? linkWeb(ev.linkEntradas, true) : null;
  if(externa){ abrirExterno(externa.url); return; }

  const edad = edadUsuario();
  if(!isNaN(edad) && ev.edadMinima && edad < ev.edadMinima){
    toast(`Este evento es +${ev.edadMinima}.`); return;
  }

  const btn = document.getElementById('btn-accion-detalle');
  const base = { uid: state.uid, nombre: state.perfil.nombre, ts: Date.now() };

  try{
    if(ev.privacidad === 'privada'){
      if(btn) btn.disabled = true;
      await DataService.crearAsistencia(ev.id, { ...base, estado: 'solicitado' });
      notificar(ev.creador, 'evento_solicitud', { objetoId: ev.id, objetoNombre: ev.nombre });
      toast('Solicitud enviada al anfitrión');
      return renderDetalle(ev.id);
    }

    if(lleno){
      if(btn) btn.disabled = true;
      await DataService.crearAsistencia(ev.id, { ...base, estado: 'en-espera' });
      toast('Te anotamos en la lista de espera');
      return renderDetalle(ev.id);
    }

    if(ev.precio > 0 && !yaCompro){
      const como = ev.pagoInfo ? ` Cómo pagar: ${ev.pagoInfo}.` : '';
      const ok = await confirmar('Reservar entrada', `Entrada: ${money(ev.precio)}.${como} El pago es directo al organizador: Partazy no cobra ni hace devoluciones, el reintegro lo coordinás con el organizador. ${AVISO_DEVOLUCIONES}`, 'Reservar mi lugar');
      if(!ok) return;
    }

    if(btn) btn.disabled = true;
    if(desdeEspera) await DataService.salirDeEvento(ev.id, state.uid, 'en-espera');
    await DataService.confirmarPublico(ev.id, { ...base, estado: 'confirmado', ticket: ticketCode() });
    notificar(ev.creador, 'evento_confirmacion', { objetoId: ev.id, objetoNombre: ev.nombre });
    sumarConfirmadoEnCache(ev.id);
    renderPerfilVista();
    state.misPlanes.add(ev.id); sincronizarPlanes();
    toast('¡Listo! Ya estás confirmado.');
    abrirTicket(ev.id);
  } catch(e){
    console.error(e);
    if(e.message === 'LLENO'){ toast('Se llenó justo. Probá con la lista de espera.'); renderDetalle(ev.id); }
    else toast('No pudimos completar la acción');
    if(btn) btn.disabled = false;
  }
}

// =========================================================
//  CANCELAR / ELIMINAR (solo quien creó el evento)
// =========================================================
async function cancelarEvento(ev){
  const pago = ev.precio > 0;
  const motivo = await pedirTexto('Cancelar evento',
    'Se avisa a los confirmados en el grupo del evento y queda marcado como cancelado.' +
    (pago ? ' Si alguien ya te pagó, la devolución corre por tu cuenta: Partazy no maneja el dinero de las entradas. ' + AVISO_DEVOLUCIONES : ''),
    'Motivo (opcional)', 'Cancelar evento');
  if(motivo === null) return;
  const texto = '🚫 El organizador canceló el evento' + (motivo ? `: ${motivo}` : '.') +
    (pago ? ' Las devoluciones se coordinan directamente con el organizador. ' + AVISO_DEVOLUCIONES : '');
  try{
    await DataService.cancelarEvento(ev.id, motivo, { uid: state.uid, nombre: state.perfil.nombre, texto: texto.slice(0, 500), ts: Date.now() });
    // Aviso a todos los que estaban anotados (confirmados, aprobados, en espera o con solicitud)
    DataService.listarAsistentes(ev.id)
      .then(lista => lista.forEach(a => notificar(a.uid, 'evento_cancelado', { objetoId: ev.id, objetoNombre: ev.nombre, texto: motivo })))
      .catch(e => console.warn('avisar cancelación', e));
    const enCache = eventoEnCache(ev.id);
    if(enCache) Object.assign(enCache, { estado: 'cancelado', motivoCancelacion: motivo });
    toast('Evento cancelado');
    renderHome(); renderExplorar();
    renderDetalle(ev.id);
  } catch(e){
    console.error(e);
    toast('No se pudo cancelar el evento');
  }
}

// Borra el evento al instante y avisa a los anotados.
async function eliminarEvento(ev){
  const otros = Math.max(0, (ev.confirmadosCount || 0) - 1);
  const texto = otros > 0
    ? `Hay ${otros} ${otros === 1 ? 'persona anotada' : 'personas anotadas'}: les avisamos que el evento se suspendió. Se borra al instante y para siempre, no se puede deshacer.` +
      (ev.precio > 0 ? ' Si alguien ya te pagó, la devolución corre por tu cuenta.' : '')
    : 'Se borra al instante y para siempre, y deja de aparecer en la app. No se puede deshacer.';
  const ok = await confirmar('Eliminar evento', texto, 'Eliminar');
  if(!ok) return;
  let anotados = [];
  try{ anotados = (await DataService.listarAsistentes(ev.id)).filter(a => a.uid !== state.uid); } catch(e){ console.warn('anotados', e); }
  try{
    await DataService.eliminarEvento(ev.id, state.uid);
    anotados.forEach(a => notificar(a.uid, 'evento_cancelado', { objetoId: ev.id, objetoNombre: ev.nombre, texto: 'El organizador eliminó el evento' }));
    state.eventos = state.eventos.filter(e => e.id !== ev.id);
    state.misPlanes?.delete?.(ev.id);
    toast('Evento eliminado');
    renderHome(); renderExplorar(); renderPerfilVista();
    ir('home');
  } catch(e){
    console.error(e);
    toast('No se pudo eliminar el evento. Probá de nuevo.');
  }
}

// =========================================================
//  SOLICITUDES (anfitrión de previa privada)
// =========================================================
// Para controlar la puerta: quiénes confirmaron o fueron aprobados
async function cargarConfirmados(ev, tok){
  try{
    const lista = (await DataService.listarAsistentes(ev.id))
      .filter(a => a.estado === 'confirmado' || a.estado === 'aprobado')
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    const cont = document.getElementById('lista-confirmados');
    if(!cont || tok !== state.tok) return;
    cont.innerHTML = lista.length ? `
      <div style="font-size:12px; color:var(--gris); margin-bottom:4px;">${lista.length} ${lista.length === 1 ? 'persona' : 'personas'}${ev.conQR ? ' · con entrada QR' : ' · sin QR: controlá en la puerta con esta lista'}</div>
      ${lista.map(a => `<div class="solicitud">
        <div class="avatar" data-usuario="${esc(a.uid)}">${esc(inicialesDe(a.nombre))}</div>
        <div class="nom" data-usuario="${esc(a.uid)}">${esc(a.nombre)}${a.uid === state.uid ? ' (vos)' : ''}<small>${a.estado === 'aprobado' ? 'Aprobado' : 'Confirmado'}${ev.conQR && a.ticket ? ' · ' + esc(a.ticket) : ''}</small></div>
      </div>`).join('')}` : emptyState('Todavía no hay confirmados.');
  } catch(e){
    console.warn('confirmados', e);
    const cont = document.getElementById('lista-confirmados');
    if(cont) cont.innerHTML = emptyState('No se pudo cargar la lista.');
  }
}

// Pedidos pendientes de una previa privada (para quien organiza).
async function cargarSolicitudes(eventId, tok){
  try{
    const sols = await DataService.listSolicitudes(eventId);
    const cont = document.getElementById('lista-solicitudes');
    if(!cont || tok !== state.tok) return;
    cont.innerHTML = sols.length ? sols.map(s => `
      <div class="solicitud">
        <div class="avatar" data-usuario="${esc(s.uid)}">${esc(inicialesDe(s.nombre))}</div>
        <div class="nom" data-usuario="${esc(s.uid)}">${esc(s.nombre)}<small>Pidió unirse ${esc(hace(s.ts))}</small></div>
        <button class="btn btn-secundario btn-mini" data-solicitud="${esc(s.uid)}" data-evento="${esc(eventId)}" data-accion="rechazar">Rechazar</button>
        <button class="btn btn-primario btn-mini" data-solicitud="${esc(s.uid)}" data-evento="${esc(eventId)}" data-accion="aprobar">Aprobar</button>
      </div>`).join('') : emptyState('No hay solicitudes pendientes.');
  } catch(e){
    console.error(e);
    const cont = document.getElementById('lista-solicitudes');
    if(cont) cont.innerHTML = emptyState('No se pudieron cargar las solicitudes.');
  }
}

// Aprueba o rechaza un pedido y avisa a la persona.
async function responderSolicitud(eventId, attUid, aprobar, btn){
  const fila = btn.closest('.solicitud');
  fila.querySelectorAll('button').forEach(b => b.disabled = true);
  try{
    await DataService.responderSolicitud(eventId, attUid, aprobar, ticketCode());
    notificar(attUid, aprobar ? 'evento_aprobada' : 'evento_rechazada', { objetoId: eventId, objetoNombre: eventoEnCache(eventId)?.nombre || 'el evento' });
    if(aprobar) sumarConfirmadoEnCache(eventId);
    toast(aprobar ? 'Solicitud aprobada' : 'Solicitud rechazada');
    renderDetalle(eventId);
  } catch(e){
    console.error(e);
    toast(e.message === 'LLENO' ? 'El evento ya está lleno' : e.message === 'YA_RESPONDIDA' ? 'Esa solicitud ya fue respondida' : 'No se pudo responder');
    fila.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// =========================================================
//  TICKET + CHAT
// =========================================================
function abrirTicket(id){
  ir('ticket', { clave: 'ticket:' + id, abrir: () => abrirTicket(id) });
  renderTicket(id);
}

// Mi entrada (QR o lista) + grupo del evento.
async function renderTicket(id){
  const tok = ++state.tok;
  const cont = document.getElementById('ticket-contenido');
  cont.innerHTML = '<div class="empty-state" style="padding-top:60px;">Cargando...</div>';

  try{
    const ev = await eventoActual(id);
    const asistencia = ev ? await DataService.getAsistencia(id, state.uid) : null;
    if(tok !== state.tok) return;
    if(!ev){ cont.innerHTML = emptyState('No encontramos ese evento.'); return; }
    if(!asistencia || (asistencia.estado !== 'confirmado' && asistencia.estado !== 'aprobado') || !asistencia.ticket){
      cont.innerHTML = emptyState('Tu asistencia a este evento todavía no está confirmada.');
      return;
    }

    let ubicacion = ev.lugar;
    if(ev.privacidad === 'privada'){
      const dir = await DataService.getDireccionExacta(id);
      if(tok !== state.tok) return;
      ubicacion = dir ? `${dir} (${ev.lugar})` : ev.lugar;
    }

    const ext = (ev.privacidad !== 'privada' && ev.linkEntradas && ev.creador !== state.uid) ? linkWeb(ev.linkEntradas, true) : null;
    cont.innerHTML = `
      <div style="padding:16px 20px 10px; text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--rojo);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h2 style="font-family:var(--font-display); text-transform:uppercase; font-weight:700; font-size:24px;">${ev.conQR ? '¡Asistencia confirmada!' : '¡Estás en la lista!'}</h2>
        <p style="color:var(--gris); font-size:13px; margin-top:4px;">${ext ? `Tu entrada es la que compraste en ${esc(ext.texto)}: llevala a la puerta. Acá tenés el grupo del evento.` : ev.conQR ? 'Mostrá el QR en la puerta para tu check-in' : 'Este evento no usa QR: en la puerta alcanza con tu nombre, el organizador tiene la lista.'}</p>
      </div>
      ${ev.precio > 0 && !esCancelado(ev) && !ext ? `<div style="padding:0 20px 6px;"><div class="aviso">
        <b>💳 Pago: ${esc(money(ev.precio))}</b>
        <span>${esc(ev.pagoInfo || 'El organizador te indica cómo pagar.')}</span>
        <span>El pago es directo al organizador. ${esc(AVISO_DEVOLUCIONES)}</span>
      </div></div>` : ''}

      ${esCancelado(ev) ? `<div style="padding:0 20px;"><div class="aviso aviso-rojo">
        <b>🚫 Este evento fue cancelado</b>
        ${ev.motivoCancelacion ? `<span>Motivo: ${esc(ev.motivoCancelacion)}</span>` : ''}
        ${ev.precio > 0 ? `<span>La devolución de lo que hayas pagado la coordinás directamente con ${esc(ev.creadorNombre || ev.organizador)}.</span><span>${esc(AVISO_DEVOLUCIONES)}</span>` : ''}
      </div></div>` : ''}
      <div class="acciones-ticket" style="margin-top:14px;">
        <button class="btn btn-secundario btn-mini" data-abrir="${esc(ev.id)}">Ver evento</button>
        ${ev.creador === state.uid && !esCancelado(ev) ? `<button class="btn btn-secundario btn-mini" data-editar="${esc(ev.id)}">✏️ Editar</button>` : ''}
        ${state.misPlanes.size > 1 ? `<button class="btn btn-secundario btn-mini" onclick="irAMisEntradas()">Mis entradas (${state.misPlanes.size})</button>` : ''}
      </div>
      <div class="ticket" style="margin-top:16px;">
        <div class="ticket-top">
          <div class="marca">Partazy · ${ext ? 'Voy · entrada en ' + esc(ext.texto) : ev.conQR ? 'Entrada digital' : 'Lista de invitados'}</div>
          <h2>${esc(ev.nombre)}</h2>
          <div class="sub">${esc(ev.creadorNombre || ev.organizador)} · ${esc(ubicacion)}</div>
        </div>
        <div class="perforacion"></div>
        <div class="ticket-bottom">
          ${ev.conQR && !ext ? '<div class="qr-wrap" id="qr-target" aria-label="Código QR de la entrada"></div>' : ''}
          <div class="datos-ticket">
            <div class="fila-t"><span>Asistente</span><b>${esc(state.perfil.nombre)}</b></div>
            <div class="fila-t"><span>Fecha</span><b>${esc(fmtFecha(ev.fechaTs))}</b></div>
            ${ev.conQR ? `<div class="fila-t"><span>Código</span><b>${esc(asistencia.ticket)}</b></div>` : ''}
          </div>
        </div>
      </div>

      <div style="padding:22px 20px 0;">
        <div class="grupo-header">
          <h3 class="titulo-bloque" style="margin-bottom:0;">Grupo del evento</h3>
          <div class="badge-privado">${svgLock} Solo confirmados</div>
        </div>
        <div class="chat-preview" id="chat-mensajes"><div class="empty-state">Cargando mensajes...</div></div>
        <div class="chat-input-mock">
          <input type="text" id="chat-input-texto" maxlength="500" placeholder="Escribir al grupo..." aria-label="Mensaje al grupo">
          <button class="enviar" id="btn-enviar-chat" aria-label="Enviar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
          </button>
        </div>
      </div>

      <div style="padding:22px 20px 0;">
        <button class="btn btn-outline" onclick="ir('home')">Volver al inicio</button>
        ${ev.creador !== state.uid && !esCancelado(ev) && ev.fechaTs > Date.now() - HORA && !asistencia.checkinTs ? `<button class="link-denuncia link-salir" style="margin-top:14px;" data-salir="${esc(ev.id)}|${esc(asistencia.estado)}">↩ Ya no voy · liberar mi lugar</button>` : ''}
      </div>
    `;

    if(ev.conQR && !ext) cargarQR().then(() => {
      const el = document.getElementById('qr-target');
      if(!el) return;
      new QRCode(el, {
        text: `PARTAZY|${ev.id}|${asistencia.ticket}`,
        width: 160, height: 160,
        colorDark: '#0A0809', colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    }).catch(e => console.warn('QR error', e));

    const input = document.getElementById('chat-input-texto');
    input.addEventListener('keydown', e => { if(e.key === 'Enter') enviarMensaje(ev.id); });
    document.getElementById('btn-enviar-chat').addEventListener('click', () => enviarMensaje(ev.id));

    suscribirChat(ev.id);
  } catch(e){
    console.error(e);
    if(tok === state.tok) cont.innerHTML = emptyState('No pudimos cargar tu entrada.');
  }
}

// Escucha en vivo el grupo del evento.
function suscribirChat(eventId){
  if(state.chatUnsub) state.chatUnsub();
  state.chatUnsub = DataService.suscribirMensajes(eventId, msgs => {
    const cont = document.getElementById('chat-mensajes');
    if(!cont) return;
    if(!msgs.length){ cont.innerHTML = emptyState('Sé el primero en escribir en este grupo.'); return; }
    cont.innerHTML = msgs.map(m => {
      const propio = m.uid === state.uid;
      if(state.bloqueados.has(m.uid)) return '';
      if(!propio) state.msgsVistos[m.id] = { ...m, _ambito: 'evento', _chat: eventId };
      return `<div class="msj ${propio ? 'propio' : ''}" ${propio ? '' : `data-msg="${esc(m.id)}" title="Tocá para denunciar"`}>
        <div class="autor" ${propio ? '' : `data-usuario="${esc(m.uid)}"`}>${esc(propio ? 'Vos' : m.nombre)}</div>${esc(m.texto)}
      </div>`;
    }).join('');
  }, err => {
    console.warn('chat', err);
    const cont = document.getElementById('chat-mensajes');
    if(cont) cont.innerHTML = emptyState('No se pudo cargar el chat.');
  });
}

// Manda lo escrito al grupo del evento.
async function enviarMensaje(eventId){
  const input = document.getElementById('chat-input-texto');
  const texto = input.value.trim();
  if(!texto) return;
  input.value = '';
  try{
    await DataService.enviarMensaje(eventId, { uid: state.uid, nombre: state.perfil.nombre, texto, ts: Date.now() });
  } catch(e){
    console.error(e);
    toast('No se pudo enviar');
    input.value = texto;
  }
}

// =========================================================
//  CREAR EVENTO (3 pasos: lo básico → tipo → dónde y detalles)
//  Al editar se ve todo junto (clase .todo en el formulario).
// =========================================================
state.pasoCrear = 1;
// Muestra un paso del formulario de crear.
// Al elegir una sugerencia en "Lugar", guardamos ese punto (como si lo marcaras en el mapa).
function prepararLugarEvento(){
  const inp = document.getElementById('f-lugar');
  if(!inp || inp.dataset.auto) return;
  autocompletarLugar(inp, l => {
    state.ubicacionMapa = { lat: l.lat, lng: l.lng }; state._ubicDeSugerencia = true;
    const me = document.getElementById('mapa-elegido'); if(me) me.textContent = '📍 Ubicado: ' + l.nombre;
  }, true);
  inp.addEventListener('input', () => { if(state._ubicDeSugerencia){ state.ubicacionMapa = null; state._ubicDeSugerencia = false; const me = document.getElementById('mapa-elegido'); if(me) me.textContent = ''; } });
}
function irAPasoCrear(n){
  prepararLugarEvento();
  state.pasoCrear = n;
  const form = document.getElementById('form-crear');
  if(!form) return;
  form.dataset.paso = n;
  document.querySelectorAll('#pasos-barra i').forEach((b, k) => b.classList.toggle('on', k < n));
  if(!state.tipoElegido && !state.editandoId) document.querySelectorAll('#tipos-grid .tipo-op').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  const edit = !!state.editandoId;
  document.getElementById('btn-paso-atras').style.display = !edit && n > 1 ? '' : 'none';
  document.getElementById('btn-paso-sig').style.display = !edit && n < 3 ? '' : 'none';
  document.getElementById('btn-publicar').style.display = edit || n === 3 ? '' : 'none';
  document.getElementById('nav-pasos').style.display = edit ? 'none' : '';
  const intro = document.getElementById('crear-intro'); if(intro) intro.style.display = n === 1 || edit ? '' : 'none';
  pintarResumenPasos();
  const sc = document.getElementById('pantalla-crear'); if(sc && sc.scrollTo) sc.scrollTo({ top: 0 });
}
// Lo que ya completaste, en chiquito arriba (tocás y volvés a ese paso).
function pintarResumenPasos(){
  const el = document.getElementById('resumen-pasos');
  if(!el) return;
  const n = state.pasoCrear, nom = document.getElementById('f-nombre').value.trim(), fe = document.getElementById('f-fecha').value, ho = document.getElementById('f-hora').value;
  const oc = document.getElementById('f-ocasion').value;
  const partes = [];
  if(n > 1 && !state.editandoId){
    const fecha = fe ? fe.split('-').reverse().slice(0, 2).join('/') : '';
    partes.push(`<button type="button" class="res-chip" onclick="irAPasoCrear(1)">✏️ ${esc(nom || 'Sin nombre')}${fecha ? ' · ' + esc(fecha) : ''}${ho ? ' ' + esc(ho) : ''}</button>`);
  }
  if(n > 2 && !state.editandoId && oc) partes.push(`<button type="button" class="res-chip" onclick="irAPasoCrear(2)">${esc(OCASIONES[oc] || 'Tipo')} ✏️</button>`);
  el.innerHTML = partes.join('');
}
// Botones Continuar / Atrás.
function pasoCrear(d){
  const n = state.pasoCrear;
  if(d > 0 && n === 1){
    if(!document.getElementById('f-nombre').value.trim()){ toast('Ponele un nombre al evento'); document.getElementById('f-nombre').focus(); return; }
    if(!document.getElementById('f-fecha').value){ toast('Elegí la fecha'); document.getElementById('f-fecha').focus(); return; }
  }
  if(d > 0 && n === 2 && !state.tipoElegido){ toast('Elegí qué tipo de evento es'); return; }
  irAPasoCrear(Math.max(1, Math.min(3, n + d)));
}
function elegirTipo(tipo){
  state.tipoEventoActivo = tipo;
  const oc = document.getElementById('f-ocasion')?.value;
  if(!oc || oc === 'fiesta' || oc === 'previa') elegirOcasion(tipo === 'previa' ? 'previa' : 'fiesta');
  document.getElementById('op-fiesta').classList.toggle('activo', tipo==='fiesta');
  document.getElementById('op-previa').classList.toggle('activo', tipo==='previa');
  document.getElementById('fila-bebida').style.display     = tipo==='previa' ? 'flex' : 'none';
  document.getElementById('fila-privacidad').style.display = tipo==='previa' ? 'flex' : 'none';
  const previa = tipo === 'previa';
  document.getElementById('campo-estilo').style.display = previa ? 'none' : '';
  document.getElementById('fila-vip').style.display = previa ? 'none' : '';
  document.getElementById('campo-tipos').style.display = previa && state.editandoId ? 'none' : '';   // al editar no se cambia previa ⇄ evento
  if(previa) elegirOcasion('previa');
  else elegirOcasion(document.getElementById('f-ocasion').value === 'previa' ? 'fiesta' : document.getElementById('f-ocasion').value);
  actualizarCampoVip();
  actualizarCamposPrivacidad();
  actualizarFilaQR();
}

// Las entradas con QR son para cuentas de organización (boliches, productoras, etc.)
function actualizarFilaQR(){
  const fila = document.getElementById('fila-qr');
  if(fila) fila.style.display = esOrganizacion(state.perfil) ? 'flex' : 'none';
}

// ¿El formulario está en "Previa privada"?
function esPrivadaEnForm(){
  return state.tipoEventoActivo === 'previa' && document.getElementById('switch-privacidad').classList.contains('on');
}

// Muestra barrio + dirección privada, o lugar a secas, según la privacidad.
function actualizarCamposPrivacidad(){
  const priv = esPrivadaEnForm();
  document.getElementById('campo-direccion').style.display = priv ? 'block' : 'none';
  document.getElementById('label-lugar').textContent = priv ? 'Barrio o zona (público)' : 'Lugar';
  document.getElementById('f-lugar').placeholder = priv ? 'Ej: Nueva Córdoba' : 'Dirección o barrio';
  document.getElementById('ayuda-lugar').textContent = priv
    ? '🔒 Lo ve todo el mundo: poné solo el barrio, sin calle ni número. La dirección exacta va abajo y solo la ven los invitados que apruebes.'
    : '📍 Sé lo más específico posible: calle y número (o nombre del lugar), barrio y ciudad. Mejor todavía: marcalo en el mapa. Así nadie se confunde.';
}

// Al editar y cambiar privada ⇄ pública, acomodamos los campos de lugar
function ajustarLugarPorPrivacidad(){
  if(!state.editandoId) return;
  const lugar = document.getElementById('f-lugar'), dir = document.getElementById('f-direccion');
  if(esPrivadaEnForm()){
    if(pareceDireccion(lugar.value) && !dir.value.trim()){ dir.value = lugar.value; lugar.value = ''; }
    toast('🔒 Privada: arriba solo el barrio; la dirección la ven los que apruebes');
    lugar.focus();
  } else {
    if(dir.value.trim()) lugar.value = dir.value.trim() + (lugar.value.trim() ? ', ' + lugar.value.trim() : '');
    toast('🌍 Pública: la dirección la va a ver todo el mundo');
  }
}
// Prende/apaga un interruptor.
function toggleSwitch(el){
  el.classList.toggle('on');
  el.setAttribute('aria-checked', el.classList.contains('on') ? 'true' : 'false');
}
// Muestra el campo de nombres VIP si la lista está activada.
function actualizarCampoVip(){
  const on = state.tipoEventoActivo !== 'previa' && document.getElementById('switch-vip').classList.contains('on');
  document.getElementById('campo-vip').style.display = on ? 'block' : 'none';
}
// Lee los nombres VIP (uno por renglón).
function leerVip(){
  return document.getElementById('f-vip').value.split('\n').map(x => x.trim().slice(0, 60)).filter(Boolean).slice(0, 300);
}
// Si en "Fiesta / Boliche" escriben "previa" en el nombre, lo pasamos a Previa
function revisarNombrePrevia(){
  const n = document.getElementById('f-nombre').value;
  if(state.tipoEventoActivo === 'fiesta' && /\bprevia\b/i.test(n) && !state.editandoId && state._avisoPrevia !== n.toLowerCase()){
    state._avisoPrevia = n.toLowerCase();
    elegirTipo('previa'); elegirOcasion('previa'); state.tipoElegido = true;
    toast('🍾 Lo marcamos como Previa (lo podés cambiar en el paso 2)');
  }
}
// Interruptor de entrada paga (muestra precio y ayuda de capacidad).
function toggleSwitchPago(el){
  toggleSwitch(el);
  document.getElementById('campo-precio').style.display = el.classList.contains('on') ? 'block' : 'none';
  document.getElementById('ayuda-capacidad').style.display = el.classList.contains('on') ? '' : 'none';
}

// Foto del evento: revisa, comprime y prepara la miniatura.
async function onImagenSeleccionada(input){
  const file = input.files[0];
  if(!file) return;
  const txt = document.getElementById('upload-label-txt');
  const btn = document.getElementById('btn-publicar');
  txt.textContent = 'Revisando la foto... (la primera vez tarda unos segundos)';
  btn.disabled = true;
  try{
    const base64 = await prepararFoto(file, 800, false);
    state.imagenNueva = base64;
    state.imagenMini = await miniaturaDe(base64);
    const preview = document.getElementById('preview-imagen');
    preview.src = base64;
    preview.style.display = 'block';
    txt.textContent = 'Tocá para cambiar la foto';
  } catch(e){
    state.imagenNueva = null; state.imagenMini = null;
    document.getElementById('preview-imagen').style.display = 'none';
    txt.textContent = 'Tocá para subir una foto';
    toast(e.message || 'No pudimos procesar esa imagen');
  } finally {
    btn.disabled = false;
    input.value = '';
  }
}

// Estilo elegido por quien crea el evento (no se adivina)
const ESTILOS = {
  electronica:'Electrónica', techno:'Techno', house:'House', cachengue:'Cachengue', cuarteto:'Cuarteto',
  reggaeton:'Reggaetón', cumbia:'Cumbia', trap:'Trap', rock:'Rock', pop:'Pop', universitaria:'Fiesta universitaria', variado:'Variado'
};
// Nombre del estilo de música.
function etiquetaEstilo(cat){ return ESTILOS[cat] || cat || ''; }
// Tipos de evento (los de "universitaria" y "temática" quedan solo para eventos viejos)
const OCASIONES = { fiesta: 'Fiesta', previa: 'Previa', after: 'After', pena: 'Peña', egresados: 'Egresados', cumple: 'Cumpleaños',
  musical: 'Música en vivo', gastronomico: 'Gastronomía', charla: 'Charla / Seminario', taller: 'Taller / Curso', cultural: 'Arte y cultura',
  deportivo: 'Deporte / Aire libre', feria: 'Feria / Mercado', universitaria: 'Fiesta universitaria', tematica: 'Fiesta temática' };
const TIPOS_NUEVOS = ['fiesta', 'previa', 'after', 'pena', 'egresados', 'cumple', 'musical', 'gastronomico', 'charla', 'taller', 'cultural', 'deportivo', 'feria'];
// Tipos "de joda" (piden estilo de música y lista VIP). El resto son eventos generales (charlas, ferias, etc.).
const OCASIONES_FIESTA = new Set(['', 'fiesta', 'previa', 'after', 'egresados', 'cumple', 'universitaria', 'tematica']);
function esDeFiesta(ev){ return OCASIONES_FIESTA.has(ev?.ocasion || ''); }
const ICONOS_TIPO = {"fiesta": "<circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 6V2M5.5 10.5h13M5.5 15.5h13M12 6c-2 2.2-2.8 4.6-2.8 7s.8 4.8 2.8 7M12 6c2 2.2 2.8 4.6 2.8 7s-.8 4.8-2.8 7\"/>", "previa": "<path d=\"M6.5 2h3v2h-3zM7 4v3c0 1.3-3 2-3 4.5V21h8v-9.5C12 9 9 8.3 9 7V4\"/><path d=\"M13 12.5l1-.8 1 .8 1-.8 1 .8 1-.8 1 .8V21h-6z\"/><path d=\"M13 15.5h6\"/>", "after": "<path d=\"M3 18h18M5 21h14\"/><path d=\"M7 18a5 5 0 0 1 10 0\"/><path d=\"M12 7V4M5.6 10.6 3.8 8.8M18.4 10.6l1.8-1.8\"/>", "pena": "<path d=\"M14 3l4 4-2 2-4-4z\"/><path d=\"M13.5 7.5 9 12\"/><path d=\"M10.5 10.5c-2.5-1-5 0-6 2.5s0 5.5 2.5 6.5 5.5 0 6.5-2.5c.6-1.5.3-3-.5-4.2\"/><circle cx=\"8.5\" cy=\"15.5\" r=\"1.4\"/>", "egresados": "<path d=\"M2 9l10-5 10 5-10 5z\"/><path d=\"M6 11v5c3.5 2.5 8.5 2.5 12 0v-5\"/><path d=\"M22 9v6\"/>", "cumple": "<path d=\"M4 21h16v-8H4z\"/><path d=\"M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1.5 4 0\"/><path d=\"M8 13V9M12 13V9M16 13V9\"/><path d=\"M8 6.5c0-1 .8-1.5.8-2.5M12 6.5c0-1 .8-1.5.8-2.5M16 6.5c0-1 .8-1.5.8-2.5\"/>", "musical": "<rect x=\"6\" y=\"3\" width=\"5\" height=\"10\" rx=\"2.5\"/><path d=\"M3.5 10.5a5 5 0 0 0 10 0M8.5 15.5V20M6 20h5\"/><path d=\"M17 11V4l4-1v6\"/><circle cx=\"16\" cy=\"11.2\" r=\"1.6\"/><circle cx=\"20\" cy=\"9.2\" r=\"1.6\"/>", "gastronomico": "<circle cx=\"12\" cy=\"13\" r=\"6\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/><path d=\"M3 3v6a2 2 0 0 0 2 2v10M5 3v4M21 3c-1.5 1-2 3-2 6h2v12\"/>", "charla": "<path d=\"M4 5h16v10H9l-5 4z\"/><path d=\"M8 9h8M8 12h5\"/>", "taller": "<path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z\"/>", "cultural": "<path d=\"M4 7c5-3 11-3 16 0-1 8-4 12-8 12s-7-4-8-12z\"/><circle cx=\"9\" cy=\"10.5\" r=\"1\"/><circle cx=\"15\" cy=\"10.5\" r=\"1\"/><path d=\"M9 14.5c2 1.5 4 1.5 6 0\"/>", "deportivo": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m12 7 4 3-1.5 4.5h-5L8 10z\"/><path d=\"M12 3v4M21 10l-5 0M17.5 19l-3-4.5M6.5 19l3-4.5M3 10l5 0\"/>", "feria": "<path d=\"M3 9l2-5h14l2 5\"/><path d=\"M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3\"/><path d=\"M5 12v8h14v-8M10 20v-5h4v5\"/>"};
// Nombre del tipo de evento (Fiesta, Previa, Peña...).
function etiquetaTipo(ev){ return OCASIONES[ev.ocasion] || ev.tipoLugar || ''; }
// Clave del ícono según el tipo de evento.
function claveTipo(ev){ return ICONOS_TIPO[ev.ocasion] ? ev.ocasion : (ev.tipo === 'previa' ? 'previa' : 'fiesta'); }
// Ícono SVG del tipo de evento.
function iconoTipo(ev){ return `<svg class="ico-tipo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_TIPO[claveTipo(ev)]}</svg>`; }
// Selector de tipo en el formulario
// Preguntas extra según el tipo de evento (se guardan en ev.extras y se muestran en el detalle).
// tipo: 'text' | 'num' | 'sel' (ops) | 'multi' (ops, se guarda "a, b").
const EXTRAS_TIPO = {
  deportivo: [
    { k: 'deporte', l: '¿Qué deporte o actividad?', ph: 'Ej: fútbol 5, running, vóley, pádel, trekking' },
    { k: 'modalidad', l: 'Modalidad', t: 'sel', ops: ['Recreativo', 'Entrenamiento', 'Torneo / competencia', 'Clase'] },
    { k: 'nivel', l: 'Nivel', t: 'sel', ops: ['Para todos', 'Principiante', 'Intermedio', 'Avanzado'] },
    { k: 'objetivo', l: '¿Cuál es el objetivo?', ph: 'Ej: armar equipo, juntar fondos, preparar una carrera' },
    { k: 'pausas', l: '¿Hay pausas o descansos?', ph: 'Ej: 10 min de hidratación cada hora' },
    { k: 'llevar', l: '¿Qué hay que llevar?', ph: 'Ej: zapatillas, agua, ropa cómoda' }],
  gastronomico: [
    { k: 'menu', l: '¿Qué se va a servir?', ph: 'Ej: menú de 4 pasos, pizzas, degustación de vinos' },
    { k: 'cocina', l: 'Tipo de cocina', ph: 'Ej: italiana, parrilla, vegana, de autor' },
    { k: 'opciones', l: 'Opciones especiales', t: 'multi', ops: ['Vegetariano', 'Vegano', 'Sin TACC', 'Sin lactosa'] },
    { k: 'bebida', l: 'Bebida', t: 'sel', ops: ['Incluida', 'Se paga aparte', 'Traé la tuya'] }],
  charla: [
    { k: 'tema', l: '¿De qué tema?', ph: 'Ej: emprendimiento, ciberseguridad, salud mental' },
    { k: 'quien', l: '¿Quién habla?', ph: 'Nombre y a qué se dedica' },
    { k: 'publico', l: '¿Para quién es?', ph: 'Ej: estudiantes, emprendedores, todo público' },
    { k: 'duracion', l: 'Duración', ph: 'Ej: 1 h 30 min' },
    { k: 'modo', l: 'Formato', t: 'sel', ops: ['Presencial', 'Presencial y online'] },
    { k: 'certificado', l: '¿Hay certificado?', t: 'sel', ops: ['No', 'Sí'] }],
  taller: [
    { k: 'tema', l: '¿Qué se aprende?', ph: 'Ej: cerámica, fotografía, coctelería' },
    { k: 'quien', l: '¿Quién lo da?', ph: 'Nombre del docente o tallerista' },
    { k: 'nivel', l: 'Nivel', t: 'sel', ops: ['Sin experiencia', 'Intermedio', 'Avanzado'] },
    { k: 'materiales', l: 'Materiales', ph: 'Ej: incluidos / traer cuaderno y lápiz' },
    { k: 'duracion', l: 'Duración', ph: 'Ej: 3 encuentros de 2 h' },
    { k: 'certificado', l: '¿Hay certificado?', t: 'sel', ops: ['No', 'Sí'] }],
  cultural: [
    { k: 'disciplina', l: '¿Qué es?', t: 'sel', ops: ['Teatro', 'Muestra / exposición', 'Cine', 'Danza', 'Stand-up', 'Literatura', 'Otro'] },
    { k: 'quien', l: 'Artistas / elenco', ph: 'Quiénes participan' },
    { k: 'duracion', l: 'Duración', ph: 'Ej: 70 min' },
    { k: 'apto', l: 'Apto para', t: 'sel', ops: ['Todo público', 'Mayores de 13', 'Mayores de 18'] }],
  feria: [
    { k: 'rubros', l: '¿Qué se va a encontrar?', ph: 'Ej: ropa, diseño, comida, plantas' },
    { k: 'puestos', l: 'Cantidad de puestos', t: 'num', ph: 'Ej: 40' },
    { k: 'pagos', l: 'Medios de pago', t: 'multi', ops: ['Efectivo', 'Transferencia', 'Tarjeta', 'Mercado Pago'] },
    { k: 'actividades', l: 'Actividades extra', ph: 'Ej: música en vivo, talleres para chicos' }],
  musical: [
    { k: 'formato', l: 'Formato', t: 'sel', ops: ['Banda en vivo', 'Acústico', 'DJ set', 'Festival', 'Solista'] },
    { k: 'genero', l: '¿Qué género?', ph: 'Ej: rock nacional, jazz, cumbia' }],
  pena: [
    { k: 'genero', l: '¿Qué música?', ph: 'Ej: folklore, chacarera, zamba' },
    { k: 'comida', l: '¿Hay comida?', ph: 'Ej: empanadas y locro' }],
  egresados: [
    { k: 'institucion', l: '¿De qué colegio o facultad?', ph: 'Ej: Colegio Nacional de Monserrat' },
    { k: 'promo', l: 'Promoción', ph: 'Ej: Promo 2026' },
    { k: 'anotarse', l: '¿Cómo se anotan?', ph: 'Ej: hablale a cualquier egresado y te anotamos' }],
  cumple: [
    { k: 'quien', l: '¿Quién cumple?', ph: 'Nombre del cumpleañero' },
    { k: 'regalo', l: 'Regalo / vaquita', ph: 'Ej: vaquita de $5.000 al alias juli.cumple' }]
};
// Dibuja las preguntas del tipo elegido (conserva lo que ya estaba escrito).
function renderCamposTipo(k, valores){
  const cont = document.getElementById('campos-tipo');
  if(!cont) return;
  const ant = valores || leerExtras();
  const campos = EXTRAS_TIPO[k] || [];
  if(!campos.length){ cont.innerHTML = ''; cont.style.display = 'none'; return; }
  cont.style.display = '';
  const id = c => 'fx-' + c.k;
  cont.innerHTML = `<div class="campos-tipo-tit">${iconoTipo({ ocasion: k })}Sobre ${esc((OCASIONES[k] || 'el evento').toLowerCase())}</div>` + campos.map(c => {
    const v = ant[c.k] || '';
    if(c.t === 'sel') return `<div class="campo"><label for="${id(c)}">${esc(c.l)}</label><select id="${id(c)}" data-extra="${c.k}"><option value="">Sin especificar</option>${c.ops.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    if(c.t === 'multi'){ const sel = v.split(',').map(x => x.trim());
      return `<div class="campo"><label>${esc(c.l)}</label><div class="multi-ops" data-extra="${c.k}" data-multi="1">${c.ops.map(o => `<button type="button" class="chip${sel.includes(o) ? ' activo' : ''}" onclick="this.classList.toggle('activo')">${esc(o)}</button>`).join('')}</div></div>`; }
    return `<div class="campo"><label for="${id(c)}">${esc(c.l)}</label><input type="${c.t === 'num' ? 'number' : 'text'}" id="${id(c)}" data-extra="${c.k}" maxlength="120" placeholder="${esc(c.ph || '')}" value="${esc(v)}"></div>`;
  }).join('');
}
// Lee las respuestas extra del formulario (solo las que tienen algo).
function leerExtras(){
  const out = {};
  document.querySelectorAll('#campos-tipo [data-extra]').forEach(el => {
    const v = el.dataset.multi ? [...el.querySelectorAll('.chip.activo')].map(b => b.textContent).join(', ') : String(el.value || '').trim();
    if(v) out[el.dataset.extra] = v.slice(0, 120);
  });
  return out;
}
// Bloque "Lo que tenés que saber" en el detalle del evento.
function extrasHTML(ev){
  const campos = EXTRAS_TIPO[ev.ocasion] || [], x = ev.extras || {};
  const filas = campos.filter(c => x[c.k]).map(c => `<div class="extra-fila"><small>${esc(c.l.replace(/^¿/, '').replace(/\?$/, ''))}</small><b>${esc(x[c.k])}</b></div>`);
  return filas.length ? `<div class="extras-lista">${filas.join('')}</div>` : '';
}
function elegirOcasion(k){
  document.getElementById('f-ocasion').value = OCASIONES[k] ? k : '';
  document.querySelectorAll('#tipos-grid .tipo-op').forEach(b => { const on = b.dataset.ocasion === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  // La música siempre es opcional; la lista VIP y el dress code solo donde tienen sentido
  const previa = state.tipoEventoActivo === 'previa';
  const vis = (id, on) => { const el = document.getElementById(id); if(el) el.style.display = on ? '' : 'none'; };
  const sinMusica = ['charla', 'taller'].includes(k);
  vis('campo-estilo', !previa && !sinMusica);
  vis('campo-musica', !sinMusica);
  vis('fila-vip', !previa && OCASIONES_FIESTA.has(k || ''));
  vis('campo-dresscode', !['deportivo', 'feria', 'charla', 'taller'].includes(k));
  const ll = document.getElementById('label-lineup'), tl = document.getElementById('f-lineup');
  const crono = { charla: 'Cronograma', taller: 'Cronograma', deportivo: 'Cronograma', feria: 'Horarios y actividades', cultural: 'Programa', gastronomico: 'Pasos o momentos' }[k];
  if(ll) ll.textContent = (crono || 'Line-up') + ' (opcional)';
  if(tl) tl.placeholder = crono ? 'Un renglón por momento. Podés poner la hora:\n18:00 Apertura\n18:30 Primera parte' : 'Un artista por renglón. Podés poner la hora:\n23:30 DJ Invitado\n01:00 Banda principal';
  const lm = document.querySelector('label[for="f-musica"]'); if(lm) lm.textContent = 'Música (opcional)';
  renderCamposTipo(k);
  actualizarCampoVip && document.getElementById('switch-vip') && actualizarCampoVip();
}
// Elegir el tipo en el paso 2 (Previa también está acá). Pasa solo al paso siguiente.
function elegirTipoDesdeGrilla(k){
  if(k === 'previa') elegirTipo('previa');
  else { if(state.tipoEventoActivo === 'previa') elegirTipo('fiesta'); elegirOcasion(k); }
  state.tipoElegido = true;
  if(!state.editandoId && state.pasoCrear === 2) setTimeout(() => { if(state.pasoCrear === 2) irAPasoCrear(3); }, 280);
}
// Tocar "Previa" en los tipos lleva a la sección Previa (arriba)
function irAPrevia(){
  elegirTipo('previa');
  const op = document.getElementById('op-previa');
  if(op && op.scrollIntoView) op.scrollIntoView({behavior:'smooth', block:'center'});
  toast('🍾 Te llevamos a Previa');
}
// ¿Es una fiesta universitaria (eventos viejos)?
function esUniversitaria(e){ return e.ocasion === 'universitaria' || e.categoria === 'universitaria'; }

// Valida el formulario y crea el evento (o guarda la edición). Muestra la vista previa antes.
async function publicarEvento(){
  const val = id => document.getElementById(id).value.trim();
  const tipo = state.tipoEventoActivo;
  const privada = esPrivadaEnForm();

  const nombre = val('f-nombre');
  if(!nombre){ toast('Ponele un nombre al evento'); return; }

  const lugar = val('f-lugar');
  const direccion = val('f-direccion');
  if(!lugar){ toast(privada ? 'Indicá el barrio o zona' : 'Indicá el lugar'); return; }
  if(privada && !direccion){ toast('Indicá la dirección exacta (solo la ven los aprobados)'); return; }
  if(privada && pareceDireccion(lugar)){
    await confirmar('Ojo con la dirección', 'En una previa privada, "Barrio o zona" lo ve todo el mundo: poné solo el barrio (por ejemplo "Nueva Córdoba"). La calle y el número van en "Dirección exacta", que solo ven los invitados que apruebes.', 'Entendido');
    document.getElementById('f-lugar').focus();
    return;
  }

  const fechaStr = val('f-fecha');
  const horaStr  = val('f-hora') || '22:00';
  if(!fechaStr){ toast('Elegí una fecha'); return; }
  const [y,m,d] = fechaStr.split('-').map(Number);
  const [hh,mm] = horaStr.split(':').map(Number);
  const fechaTs = new Date(y, m-1, d, hh, mm, 0, 0).getTime();
  const evEdit = state.editandoId ? state.editandoEv : null;
  if(isNaN(fechaTs) || (fechaTs < Date.now() - 60000 && !(evEdit && fechaTs === evEdit.fechaTs))){ toast('La fecha ya pasó'); return; }

  // Fecha límite para anotarse (opcional): tiene que ser antes del evento
  let inscripcionHasta = null;
  const inscF = val('f-insc-fecha');
  if(inscF){
    const [iy, im, id] = inscF.split('-').map(Number), [ih, imi] = (val('f-insc-hora') || '23:59').split(':').map(Number);
    inscripcionHasta = new Date(iy, im - 1, id, ih, imi, 0, 0).getTime();
    if(isNaN(inscripcionHasta) || inscripcionHasta > fechaTs){ toast('La fecha límite para anotarse tiene que ser antes del evento'); return; }
  }
  const capStr = val('f-capacidad');
  const sinTope = !capStr && document.getElementById('switch-pago').classList.contains('on') && !!val('f-link-entradas');
  const capacidad = sinTope ? 20000 : parseInt(capStr, 10);
  if(!sinTope && (!capacidad || capacidad < 2 || capacidad > 20000)){ toast(document.getElementById('switch-pago').classList.contains('on') ? 'Capacidad entre 2 y 20.000 (si vendés por otra página y no sabés el tope, poné el link y dejala vacía)' : 'Capacidad entre 2 y 20.000 personas'); return; }
  if(evEdit && capacidad < (evEdit.confirmadosCount || 0)){ toast(`Ya hay ${evEdit.confirmadosCount} confirmados: la capacidad no puede ser menor`); return; }

  const edadStr = val('f-edad');
  const edadMinima = edadStr === '' ? 18 : parseInt(edadStr, 10);
  if(isNaN(edadMinima) || edadMinima < 0 || edadMinima > 99){ toast('Edad mínima inválida'); return; }

  const pago = document.getElementById('switch-pago').classList.contains('on');
  const precio = pago ? parseInt(val('f-precio'), 10) : 0;
  if(pago && (!precio || precio < 1)){ toast('Ingresá un precio válido'); return; }
  const pagoInfo = pago ? val('f-pago-info') : '';
  const horaFin = val('f-hora-fin');
  if(horaFin && !/^\d{2}:\d{2}$/.test(horaFin)){ toast('Hora de cierre inválida'); return; }
  const lineup = val('f-lineup').slice(0, 600);
  const linkTexto = pago ? val('f-link-entradas') : '';
  const linkVenta = linkTexto ? linkWeb(linkTexto, true) : null;
  if(linkTexto && !linkVenta){ toast('El link de venta tiene que ser una dirección https://'); return; }

  // El estilo de música es opcional (y en una previa no se pide)
  const sinMusica = ['charla', 'taller'].includes(val('f-ocasion'));
  const estilo = tipo === 'previa' || sinMusica || !ESTILOS[val('f-estilo')] ? '' : val('f-estilo');
  const musica = sinMusica ? '' : (val('f-musica') || ESTILOS[estilo] || '').slice(0, 80);
  const conVip = tipo !== 'previa' && document.getElementById('switch-vip').classList.contains('on');
  const vip = conVip ? leerVip() : [];
  const reglas = val('f-reglas');
  // Dirección poco precisa: avisamos antes de publicar (se puede seguir igual)
  const dirVisible = privada ? direccion : lugar;
  if(!state.ubicacionMapa && !/\d/.test(dirVisible) && !(evEdit && dirVisible === (privada ? state._dirIni : state._lugarIni))){
    const seguir = await confirmar('¿La dirección está completa?',
      `"${dirVisible}" puede confundir. Para que nadie se pierda, poné calle y número (o el nombre exacto del lugar), barrio y ciudad, o marcalo en el mapa.`, 'Publicar igual');
    if(!seguir){ document.getElementById(privada ? 'f-direccion' : 'f-lugar').focus(); return; }
  }
  const coords = state.ubicacionMapa || await ubicarLugar(lugar);
  const jitter = () => (Math.random() - 0.5) * (privada ? 0.008 : 0.004); // previa privada: ~±450 m, nunca marca la casa
  const exacta = !!state.ubicacionMapa && !privada;  // en previas privadas el pin público siempre es aproximado
  if(evEdit) return guardarEdicion(evEdit, {
    nombre, lugar, direccion: privada ? direccion : null, fechaTs, hora: horaStr, horaFin, capacidad, capacidadDesconocida: sinTope, edadMinima,
    precio, pagoInfo, linkEntradas: linkVenta ? linkVenta.url.slice(0, 300) : '', lineup,
    categoria: estilo, musica, dresscode: val('f-dresscode') || 'Libre', ocasion: OCASIONES[val('f-ocasion')] ? val('f-ocasion') : '', vip,
    bebida: tipo === 'previa' && document.getElementById('switch-bebida').classList.contains('on'),
    tipo, privacidad: privada ? 'privada' : 'publica',
    listaVip: conVip, inscripcionHasta, extras: leerExtras(),
    imagen: state.imagenMini || state.imagenNueva || '', imagenGrande: state.imagenMini ? state.imagenNueva : null,
    descripcion: val('f-descripcion') || 'Evento creado desde Partazy.',
    reglas: reglas || 'Respetar el lugar y a los demás asistentes.'
  });
  // (la vista previa avisa si no hay foto)
  const nuevoId = nuevoEventoId();

  const nuevo = {
    nombre, creador: state.uid, creadorNombre: state.perfil.nombre,
    organizador: state.perfil.nombre, verificado: !!state.perfil.verificado,
    categoria: estilo, tipoLugar: tipo==='previa' ? 'Previa' : 'Fiesta', tipo, ocasion: OCASIONES[val('f-ocasion')] ? val('f-ocasion') : '',
    privacidad: privada ? 'privada' : 'publica',
    fechaTs, hora: horaStr,
    lugar, lat: exacta ? coords.lat : coords.lat + jitter(), lng: exacta ? coords.lng : coords.lng + jitter(), ubicacionExacta: exacta,
    ciudad: (coords.ciudad || ciudadReferencia() || '').slice(0, 60),
    precio, pagoInfo, estado: 'publicado',
    horaFin, lineup, linkEntradas: linkVenta ? linkVenta.url.slice(0, 300) : '',
    deOrganizacion: esOrganizacion(state.perfil),
    conQR: esOrganizacion(state.perfil) && document.getElementById('switch-qr').classList.contains('on'),
    capacidad, capacidadDesconocida: sinTope, confirmadosCount: 1, edadMinima, vistasCount: 0,
    ...(inscripcionHasta ? { inscripcionHasta } : {}),
    ...(Object.keys(leerExtras()).length ? { extras: leerExtras() } : {}),
    dresscode: val('f-dresscode') || 'Libre', musica,
    bebida: tipo === 'previa' && document.getElementById('switch-bebida').classList.contains('on'),
    listaVip: conVip,
    ambiente:'verde', ambienteLabel:'Recién creado', ambienteDesc:'Todavía no hay reportes de ambiente',
    imagen: state.imagenMini || state.imagenNueva || '', fotoGrande: !!state.imagenMini,
    descripcion: val('f-descripcion') || 'Evento creado desde Partazy.',
    reglas: reglas || 'Respetar el lugar y a los demás asistentes.',
    createdAt: Date.now()
  };
  if(!(await mostrarVistaPrevia(nuevo))) return;

  const btn = document.getElementById('btn-publicar');
  btn.disabled = true; btn.textContent = 'Publicando...';

  try{
    if(state.imagenMini) fotosGrandes.set(nuevoId, state.imagenNueva);
    state.vipPendiente = conVip ? vip : null;
    await DataService.crearEvento(nuevoId, nuevo, privada ? direccion : null, state.imagenMini ? state.imagenNueva : null, {
      uid: state.uid, nombre: state.perfil.nombre, estado: 'confirmado', ts: Date.now(), ticket: ticketCode()
    });
    state.eventos.push({ id: nuevoId, ...nuevo });
    state.eventos.sort((a,b) => a.fechaTs - b.fechaTs);
    state.ultimoCreado = nuevoId;
    if(esOrganizacion(state.perfil) && !privada) avisarSeguidores(nuevoId, nombre).then(fans => avisarAmigosEvento(nuevoId, nombre, fans));
    else avisarAmigosEvento(nuevoId, nombre);
    state.misPlanes.add(nuevoId);

    resetFormularioCrear();
    renderHome(); renderExplorar(); renderPerfilVista();
    ir('confirmacion');
  } catch(e){
    console.error(e);
    toast('No se pudo publicar el evento');
  } finally {
    btn.disabled = false; btn.textContent = 'Publicar evento';
  }
}

// Deja el formulario de Crear vacío.
function resetFormularioCrear(){
  ['f-nombre','f-lugar','f-direccion','f-fecha','f-hora','f-capacidad','f-edad','f-dresscode','f-estilo','f-musica','f-descripcion','f-reglas','f-precio','f-pago-info','f-hora-fin','f-lineup','f-link-entradas','f-ocasion','f-vip','f-insc-fecha','f-insc-hora'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value='';
  });
  const setSwitch = (id, on) => { const el = document.getElementById(id); el.classList.toggle('on', on); el.setAttribute('aria-checked', on ? 'true' : 'false'); };
  setSwitch('switch-pago', false); setSwitch('switch-vip', false); setSwitch('switch-qr', true);
  setSwitch('switch-bebida', true); setSwitch('switch-privacidad', true);
  document.getElementById('campo-precio').style.display = 'none';
  document.getElementById('ayuda-capacidad').style.display = 'none';
  document.getElementById('preview-imagen').style.display = 'none';
  document.getElementById('f-imagen').value = '';
  document.getElementById('upload-label-txt').textContent = 'Tocá para subir una foto';
  state.imagenNueva = null; state.imagenMini = null;
  state.ubicacionMapa = null;
  const me = document.getElementById('mapa-elegido'); if(me) me.textContent = '';
  state.editandoId = null; state.editandoEv = null;
  modoEdicionUI(false);
  elegirTipo('fiesta');
  document.querySelectorAll('#tipos-grid .tipo-op').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  state.tipoElegido = false;
  irAPasoCrear(1);
}





// =========================================================
//  VISTA PREVIA: rápida (desde las tarjetas) y antes de publicar
// =========================================================
function filasEventoHTML(ev){
  const a = ambienteAuto(ev), dist = distanciaDe(ev);
  const f = (i, t, sub) => `<div class="fila"><span class="i">${i}</span><div>${t}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  return [
    f('📅', esc(horarioEvento(ev))),
    f('📍', esc(lugarPublico(ev)) + (ev.privacidad === 'privada' ? ' · 🔒 dirección al aprobar' : ''), dist ? `a ${esc(dist)} de vos` : ''),
    ev.musica || ev.categoria ? f('🎵', esc(ev.musica || etiquetaEstilo(ev.categoria))) : '',
    f('🎟️', esc(precioTxt(ev)), ev.pagoInfo && ev.precio > 0 ? esc(ev.pagoInfo) : ''),
    f(`<span class="punto-ambiente amb-${a.clase}${a.vivo ? ' amb-vivo' : ''}" style="display:inline-block; width:10px; height:10px;"></span>`, esc(a.label), esc(a.desc)),
    ev.edadMinima !== undefined ? f('🔞', esc(clasificacion(ev)), ev.dresscode && ev.dresscode !== 'Libre' ? 'Dress code: ' + esc(ev.dresscode) : '') : '',
    ev.tipo !== 'previa' && ev.listaVip ? f('⭐', 'Con lista VIP') : '',
    ev.tipo === 'previa' && ev.bebida ? f('🍾', 'Cada uno lleva su bebida') : ''
  ].join('');
}
// Abre la hoja de abajo con el contenido dado.
function abrirHoja(html){
  document.getElementById('hoja-contenido').innerHTML = html;
  document.getElementById('hoja-vista').classList.add('show');
  abrirModalHist();
}
// Cierra la hoja de abajo (y responde a la vista previa si estaba esperando).
function cerrarHoja(resultado){
  document.getElementById('hoja-vista').classList.remove('show');
  soltarModalHist();
  if(state._resolverPrevia){ const r = state._resolverPrevia; state._resolverPrevia = null; r(!!resultado); }
}
// Vista previa rápida de un evento desde la tarjeta.
function abrirVistaRapida(id){
  const ev = eventoEnCache(id);
  if(!ev) return abrirDetalle(id);
  abrirHoja(`
    <div class="portada" style="background-image:${cssFoto(ev, fotosGrandes.get(ev.id) || ev.imagen)}"><button class="icon-btn cerrar" onclick="cerrarHoja()" aria-label="Cerrar">✕</button></div>
    <div class="cuerpo"><div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}</div><h3>${esc(ev.nombre)}</h3>
      <div class="filas">${filasEventoHTML(ev)}</div>${amigosVanHTML(ev, true)}</div>
    <div class="acciones"><button class="btn btn-secundario" onclick="cerrarHoja()">Cerrar</button><button class="btn btn-primario" onclick="cerrarHoja(); setTimeout(() => abrirDetalle('${esc(ev.id)}'), 90)">Ver evento</button></div>`);
}
// Antes de publicar: así se va a ver. Devuelve true si confirma.
function mostrarVistaPrevia(ev){
  return new Promise(resolve => {
    state._resolverPrevia = resolve;
    const prev = { ...ev, id: 'vista-previa' };
    abrirHoja(`
      <div class="titulo-prev">Así se va a ver tu publicación</div>
      <div class="muestra">${tarjetaHTML(prev)}</div>
      ${ev.imagen ? '' : '<div class="tip">📸 No subiste foto: usamos una portada según el tipo de evento. Una foto real del lugar o de una edición anterior genera más confianza y más confirmaciones.</div>'}
      <div class="cuerpo" style="margin-top:0;"><div class="cat">${iconoTipo(prev)}${esc(etiquetaTipo(prev))}</div><h3>${esc(prev.nombre)}</h3><div class="filas">${filasEventoHTML(prev)}</div></div>
      <div class="acciones"><button class="btn btn-secundario" onclick="cerrarHoja(false)">Seguir editando</button><button class="btn btn-primario" id="btn-confirmar-publicar" onclick="cerrarHoja(true)">Publicar</button></div>`);
  });
}

// =========================================================
//  EXPLORAR PERSONAS (buscar gente y mandar solicitudes)
// =========================================================
state.modoExplorar = 'eventos';
// Explorar: modo Eventos o Personas.
function modoExplorar(m, enfocar){
  state.modoExplorar = m;
  const pant = document.getElementById('pantalla-explorar');
  pant.classList.toggle('modo-personas', m === 'personas');
  document.getElementById('seg-explorar').classList.toggle('personas', m === 'personas');
  document.getElementById('seg-eventos').classList.toggle('on', m !== 'personas');
  document.getElementById('seg-personas').classList.toggle('on', m === 'personas');
  const inp = document.getElementById('input-buscar');
  inp.placeholder = m === 'personas' ? 'Buscar gente o @usuario...' : 'Buscar fiestas, previas, boliches...';
  inp.value = ''; state.busqueda = ''; state.gente = null;
  document.getElementById('explorar-personas').innerHTML = '';
  if(m === 'personas'){ renderGente(); cargarSugerenciasGente(); }
  else { renderExplorar(); if(state.vistaExplorar === 'mapa') pintarMapaEventos(true); }
  if(enfocar) setTimeout(() => inp.focus(), 80);
}
// Abre Explorar en modo Personas.
function explorarPersonas(){ ir('explorar'); modoExplorar('personas', true); }
// Busca más gente con un texto.
function verMasGente(q){ modoExplorar('personas'); const inp = document.getElementById('input-buscar'); inp.value = q; buscarGente(q); }
let _debGente;
// Busca gente mientras se escribe (con espera).
function buscarGente(q){
  clearTimeout(_debGente);
  const t = normalizar(q || '').trim();
  state.textoGente = t;
  if(t.length < 2){ state.gente = null; renderGente(); return; }
  document.getElementById('explorar-gente').innerHTML = '<div class="empty-state">Buscando...</div>';
  _debGente = setTimeout(async () => {
    let res = [];
    try{ res = (await DataService.buscarPersonas(t)).filter(u => u.uid !== state.uid && !state.bloqueados.has(u.uid)); } catch(e){ console.warn('gente', e); }
    if(state.textoGente !== t) return;
    res.forEach(u => { state.usuarios[u.uid] = { ...(state.usuarios[u.uid] || {}), ...u }; });
    state.gente = res; renderGente();
  }, 300);
}
// Personas sugeridas (misma ciudad, organizaciones).
async function cargarSugerenciasGente(){
  try{
    const [cerca, orgs] = await Promise.all([
      state.perfil?.ciudad ? DataService.personasDeCiudad(state.perfil.ciudad) : Promise.resolve([]),
      DataService.organizaciones()
    ]);
    const filtrar = l => l.filter(u => u.uid !== state.uid && !state.bloqueados.has(u.uid) && !esAmigo(u.uid));
    state.sugGente = { cerca: filtrar(cerca).filter(u => !esOrganizacion(u)).slice(0, 12), orgs: filtrar(orgs).slice(0, 12) };
    [...state.sugGente.cerca, ...state.sugGente.orgs].forEach(u => { state.usuarios[u.uid] = { ...(state.usuarios[u.uid] || {}), ...u }; });
  } catch(e){ console.warn('sugerencias gente', e); state.sugGente = { cerca: [], orgs: [] }; }
  if(state.modoExplorar === 'personas' && pantallaActual() === 'explorar') renderGente();
}
// Pinta resultados o sugerencias de personas.
function renderGente(){
  const cont = document.getElementById('explorar-gente');
  if(!cont) return;
  const lista = l => l.map(u => personaHTML(u, botonRelacion(u.uid))).join('');
  const invitar = `<div class="fila-botones"><button class="btn btn-secundario" onclick="invitarAmigos()">📨 Invitar amigos a Partazy</button></div>`;
  if(state.gente){
    cont.innerHTML = state.gente.length
      ? `<div class="subtitulo"><h3 class="titulo-bloque">Resultados</h3></div>${lista(state.gente)}`
      : `<div class="empty-state">No encontramos a nadie con ese nombre. Probá con el nombre, el apellido o el @usuario, o invitalo a Partazy.</div>${invitar}`;
    return;
  }
  const recibidas = solicitudesRecibidas().map(f => state.usuarios[otroDe(f.id)]).filter(Boolean);
  const sug = state.sugGente;
  cont.innerHTML = `
    ${recibidas.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Te quieren agregar (${recibidas.length})</h3></div>${lista(recibidas)}` : ''}
    <div class="gente-vacio">Buscá por nombre, apellido o @usuario y mandá la solicitud de amistad. También podés escribirle a alguien sin ser amigos: le llega como solicitud de mensaje.</div>
    ${invitar}
    ${sug ? `
      ${sug.cerca.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Gente de ${esc(state.perfil?.ciudad || 'tu zona')}</h3></div>${lista(sug.cerca)}` : ''}
      ${sug.orgs.length ? `<div class="subtitulo"><h3 class="titulo-bloque">Boliches y productoras</h3></div>${lista(sug.orgs)}` : ''}
    ` : '<div class="empty-state">Cargando sugerencias...</div>'}
    <div style="height:20px;"></div>`;
  if(recibidas.length < solicitudesRecibidas().length) Promise.all(solicitudesRecibidas().map(f => getUsuario(otroDe(f.id)))).then(() => { if(state.modoExplorar === 'personas' && !state.gente) renderGente(); });
}

// =========================================================
//  UBICACIÓN Y RANGO DE DISTANCIA
// =========================================================
const RANGOS = [5, 10, 25, 50, 100, 0]; // 0 = todos
// Lee una preferencia guardada en este dispositivo.
function leerPref(k, def){ try{ const v = localStorage.getItem('partazy_' + k); return v === null ? def : JSON.parse(v); } catch(e){ return def; } }
// Guarda una preferencia en este dispositivo.
function guardarPref(k, v){ try{ localStorage.setItem('partazy_' + k, JSON.stringify(v)); } catch(e){} }
state.radioKm = leerPref('radioKm', 50);
state.ciudadActual = leerPref('ciudad', '');
state.ubicManual = leerPref('ubicManual', null);  // { lat, lng, nombre } si la eligió a mano
// "50 km" o "Todos".
function textoRango(){ return state.radioKm ? state.radioKm + ' km' : 'Todos'; }
// Pone la ciudad y el rango en los botones de ubicación.
function pintarUbicacion(){
  const nombre = state.userCoords ? (state.ciudadActual || 'Tu zona') : (state.geoFallo ? 'Elegí tu ciudad' : 'Ubicando...');
  document.querySelectorAll('.txt-ubic').forEach(el => el.textContent = nombre);
  document.querySelectorAll('.txt-rango').forEach(el => el.textContent = textoRango());
}
// Eventos dentro del rango elegido (si no hay ubicación real, se muestran todos)
function enRango(eventos){
  if(!state.radioKm || !state.userCoords) return eventos;
  const c = state.userCoords;
  return eventos.filter(e => typeof e.lat !== 'number' || distanciaKm(c.lat, c.lng, e.lat, e.lng) <= state.radioKm);
}
// Eventos visibles dentro del rango de distancia elegido.
function eventosParaVer(){ return enRango(eventosVisibles()); }
// Ciudad o barrio a partir de coordenadas (OpenStreetMap).
async function nombreDeLugar(lat, lng){
  try{
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=es&lat=${lat}&lon=${lng}`);
    const d = await r.json(), a = d.address || {};
    return a.city || a.town || a.village || a.suburb || a.county || a.state_district || '';
  } catch(e){ return ''; }
}
// Sugerencias de barrios de Córdoba (solo si estás en Córdoba).
function pintarBarrios(){
  const dl = document.getElementById('lista-barrios');
  if(dl) dl.innerHTML = cercaDeCordoba() ? Object.keys(BARRIOS).map(b => `<option value="${esc(b)}">`).join('') : '';
}
// Usa una ubicación (GPS o elegida) y repinta todo.
function aplicarUbicacion(coords, real, nombre){
  state.userCoords = coords; state.ubicacionReal = real; state.geoFallo = false;
  pintarBarrios();
  if(nombre){ state.ciudadActual = nombre; guardarPref('ciudad', nombre); }
  pintarUbicacion(); renderHome(); renderExplorar(); pintarMapaEventos();
  if(real && !nombre && !state.ubicManual) nombreDeLugar(coords.lat, coords.lng).then(n => { if(n){ state.ciudadActual = n; guardarPref('ciudad', n); pintarUbicacion(); pintarTextoRango(); } });
}
// Ventana para elegir ciudad y distancia.
function abrirRango(){
  pintarTextoRango();
  document.getElementById('rango-ops').innerHTML = RANGOS.map(r =>
    `<div class="chip ${state.radioKm === r ? 'activo' : ''}" role="button" tabindex="0" data-rango="${r}">${r ? r + ' km' : 'Todos'}</div>`).join('');
  document.getElementById('rango-ops').querySelectorAll('[data-rango]').forEach(c => c.onclick = () => elegirRango(+c.dataset.rango));
  document.getElementById('rango-estado').textContent = '';
  autocompletarLugar(document.getElementById('rango-ciudad'), usarLugarElegido);
  document.getElementById('modal-rango').classList.add('show');
  abrirModalHist();
}
// Texto de la ventana de distancia.
function pintarTextoRango(){
  const el = document.getElementById('rango-ubic-txt');
  if(!el) return;
  el.textContent = state.userCoords
    ? `Estás viendo eventos desde ${state.ciudadActual || 'tu ubicación'}${state.ubicacionReal ? '' : ' (aproximada)'}. Elegí hasta qué distancia:`
    : 'Todavía no sabemos dónde estás. Activá la ubicación o escribí tu ciudad.';
}
// Cierra la ventana de distancia.
function cerrarRango(){ document.getElementById('modal-rango').classList.remove('show'); soltarModalHist(); }
// Elige la distancia máxima (o Todos).
function elegirRango(km){
  state.radioKm = km; guardarPref('radioKm', km);
  document.querySelectorAll('#rango-ops .chip').forEach(c => c.classList.toggle('activo', +c.dataset.rango === km));
  pintarUbicacion(); renderHome(); renderExplorar(); pintarMapaEventos(true);
}
// ¿Estamos adentro del navegador de Instagram / Facebook / TikTok? (ahí no se puede compartir la ubicación)
function navegadorDeApp(){ return /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\//i.test(navigator.userAgent || ''); }
function esIphone(){ return /iPhone|iPad|iPod/i.test(navigator.userAgent || ''); }
// Explica, en simple, por qué no se pudo obtener la ubicación y cómo arreglarlo.
function mensajeErrorUbicacion(err){
  if(navegadorDeApp()) return 'Estás dentro de Instagram (o de otra app), y ahí no se puede compartir la ubicación. Tocá <b>⋯</b> arriba a la derecha → <b>"Abrir en el navegador"</b>, o escribí tu ciudad en el campo de arriba.';
  if(err && err.code === 1) return esIphone()
    ? 'La ubicación está bloqueada para esta página. En el iPhone: <b>Ajustes → Privacidad y seguridad → Localización → Sitios web de Safari → "Al usar la app"</b>. Después, en Safari tocá <b>aA</b> → <b>Configuración del sitio web</b> → <b>Ubicación: Permitir</b>. O escribí tu ciudad en el campo de arriba.'
    : 'La ubicación está bloqueada para esta página. Tocá el <b>candado</b> al lado de la dirección → <b>Permisos</b> → <b>Ubicación: Permitir</b>, y probá de nuevo. O escribí tu ciudad en el campo de arriba.';
  if(err && err.code === 2) return 'Tu celu no encontró la ubicación. Fijate que la <b>ubicación del teléfono esté activada</b>, o escribí tu ciudad en el campo de arriba.';
  return 'Tardó demasiado en encontrar tu ubicación. Probá de nuevo en un lugar con mejor señal, o escribí tu ciudad en el campo de arriba.';
}
// Pide la ubicación con un segundo intento más tolerante (sin GPS fino, más tiempo).
function pedirPosicion(ok, mal){
  navigator.geolocation.getCurrentPosition(ok, e => {
    if(e && e.code === 1) return mal(e);   // si está bloqueada, reintentar no sirve
    navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 });
  }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 5 * 60 * 1000 });
}
// Vuelve a pedir la ubicación del GPS.
function usarMiUbicacion(){
  const est = document.getElementById('rango-estado');
  if(navegadorDeApp()){ est.innerHTML = mensajeErrorUbicacion(); return; }
  if(!navigator.geolocation){ est.textContent = 'Este navegador no comparte la ubicación. Escribí tu ciudad en el campo de arriba.'; return; }
  est.textContent = 'Buscando tu ubicación... (si te pregunta, tocá "Permitir")';
  pedirPosicion(pos => {
    state.ubicManual = null; guardarPref('ubicManual', null);
    state.ciudadActual = ''; aplicarUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
    est.textContent = '✓ Listo, usamos tu ubicación actual.'; pintarTextoRango();
  }, e => { est.innerHTML = mensajeErrorUbicacion(e); });
}
// Busca lugares reales de Argentina (OpenStreetMap). Devuelve [{ nombre, detalle, lat, lng }].
// Si no hay internet o falla el servicio, devuelve null (no es lo mismo que "no existe").
async function buscarLugares(q, limite = 5, cerca){
  try{
    const u = cerca ? (state.userCoords || leerPref('geoPerfil')) : null;
    const caja = u && typeof u.lat === 'number' ? `&viewbox=${u.lng - 0.45},${u.lat + 0.45},${u.lng + 0.45},${u.lat - 0.45}&bounded=1` : '';
    const ref = cerca ? ciudadReferencia() : '';
    const qq = ref && !normalizar(q).includes(normalizar(ref)) && !q.includes(',') ? `${q}, ${ref}` : q;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limite}&countrycodes=ar&addressdetails=1&accept-language=es${caja}&q=${encodeURIComponent(qq)}`);
    const lista = await r.json();
    const vistos = new Set();
    return (lista || []).map(x => {
      const a = x.address || {};
      const barrio = a.suburb || a.neighbourhood || a.quarter || '';
      const ciudad = a.city || a.town || a.village || a.municipality || '';
      const prov = (a.state || '').replace(/^Provincia (de )?/i, '');
      const calle = a.road ? `${a.road}${a.house_number ? ' ' + a.house_number : ''}` : '';
      const lugarN = x.name && x.name !== a.road && x.name !== ciudad && x.name !== barrio ? x.name : '';
      const nombre = cerca && (calle || lugarN) ? [lugarN, calle, barrio, ciudad].filter(Boolean).join(', ')
        : barrio && ciudad && barrio !== ciudad ? `${barrio}, ${ciudad}` : (ciudad || barrio || x.name || '');
      return { nombre, detalle: prov, lat: parseFloat(x.lat), lng: parseFloat(x.lon), ciudad: ciudad || barrio || x.name || '' };
    }).filter(l => l.nombre && !vistos.has(l.nombre) && vistos.add(l.nombre));
  } catch(e){ return null; }
}
// Agrega sugerencias de lugares reales a un campo de texto. Al elegir una, guarda el lugar en el campo.
function autocompletarLugar(input, alElegir, cerca){
  if(!input || input.dataset.auto) return;
  input.dataset.auto = '1';
  input.removeAttribute('list');
  input.setAttribute('autocomplete', 'off');
  const caja = document.createElement('div');
  caja.className = 'sug-lugares'; caja.setAttribute('role', 'listbox'); caja.style.display = 'none';
  (input.closest('.rango-ciudad') || input).insertAdjacentElement('afterend', caja);
  let t, pedido = 0;
  input.addEventListener('input', () => {
    input.dataset.ok = '';   // si escribe de nuevo, el lugar elegido deja de valer
    clearTimeout(t);
    const q = input.value.trim();
    if(q.length < 3){ caja.style.display = 'none'; return; }
    t = setTimeout(async () => {
      const yo = ++pedido;
      const lista = await buscarLugares(q, 5, cerca);
      if(yo !== pedido) return;
      if(!lista){ caja.style.display = 'none'; return; }
      caja.innerHTML = lista.length
        ? lista.map((l, i) => `<button type="button" class="sug-lugar" role="option" data-i="${i}"><b>${esc(l.nombre)}</b>${l.detalle ? `<small>${esc(l.detalle)}</small>` : ''}</button>`).join('')
        : '<div class="sug-vacio">No encontramos ese lugar. Probá con otro nombre (ej. "Villa María" o "Nueva Córdoba, Córdoba").</div>';
      caja.style.display = 'block';
      caja.querySelectorAll('[data-i]').forEach(b => b.onmousedown = e => {
        e.preventDefault();
        const l = lista[+b.dataset.i];
        input.value = l.nombre; input.dataset.ok = '1'; input.dataset.lat = l.lat; input.dataset.lng = l.lng;
        caja.style.display = 'none';
        if(alElegir) alElegir(l);
      });
    }, 450);
  });
  input.addEventListener('blur', () => setTimeout(() => { caja.style.display = 'none'; }, 150));
}
// Revisa que una ciudad o barrio exista antes de guardarla. Devuelve el nombre a guardar, o null si no existe.
async function validarLugar(input, original){
  const v = (input.value || '').trim();
  if(!v || input.dataset.ok === '1' || v === (original || '')) return v;
  const lista = await buscarLugares(v, 1);
  if(lista === null) return v;              // sin conexión al buscador: no frenamos a la persona
  return lista.length ? v : null;
}

// Busca una ciudad de Argentina y la usa como ubicación.
async function buscarCiudadRango(){
  const inp = document.getElementById('rango-ciudad');
  const q = inp.value.trim();
  const est = document.getElementById('rango-estado');
  if(q.length < 3){ est.textContent = 'Escribí al menos 3 letras.'; return; }
  if(inp.dataset.ok === '1' && inp.dataset.lat){ usarLugarElegido({ nombre: q, lat: +inp.dataset.lat, lng: +inp.dataset.lng }); return; }
  est.textContent = 'Buscando...';
  try{
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ar&addressdetails=1&accept-language=es&q=${encodeURIComponent(q)}`);
    const [x] = await r.json();
    if(!x){ est.textContent = 'No encontramos ese lugar. Probá con otro nombre.'; return; }
    const a = x.address || {}, nombre = a.city || a.town || a.village || a.suburb || x.name || q;
    const coords = { lat: parseFloat(x.lat), lng: parseFloat(x.lon) };
    state.ubicManual = { ...coords, nombre }; guardarPref('ubicManual', state.ubicManual);
    aplicarUbicacion(coords, true, nombre);
    est.textContent = `✓ Mostrando eventos cerca de ${nombre}.`; pintarTextoRango();
  } catch(e){ est.textContent = 'No se pudo buscar. Probá de nuevo.'; }
}
// Usa un lugar elegido de la lista de sugerencias como ubicación.
function usarLugarElegido(l){
  const coords = { lat: l.lat, lng: l.lng };
  state.ubicManual = { ...coords, nombre: l.nombre }; guardarPref('ubicManual', state.ubicManual);
  aplicarUbicacion(coords, true, l.nombre);
  document.getElementById('rango-estado').textContent = `✓ Mostrando eventos cerca de ${l.nombre}.`; pintarTextoRango();
}
// Aviso si no hay eventos en tu rango (o si no sabemos tu ciudad).
function avisoRangoHTML(total, dentro){
  if(!state.userCoords && state.geoFallo) return `<div class="aviso-rango">📍 No sabemos en qué ciudad estás, así que te mostramos <b>todos los eventos</b>. Activá la ubicación o elegí tu ciudad para ver lo que hay cerca.
    <div class="fila"><button class="btn btn-primario btn-mini" onclick="abrirRango()">Elegir mi ciudad</button></div></div>`;
  if(!state.radioKm || !state.userCoords || !total || dentro) return '';
  const sig = RANGOS.find(r => r > state.radioKm && r) ;
  return `<div class="aviso-rango">📍 No hay eventos a menos de <b>${state.radioKm} km</b> de ${esc(state.ciudadActual || 'tu ubicación')} todavía. Hay ${total} ${total === 1 ? 'evento' : 'eventos'} más lejos.
    <div class="fila">${sig ? `<button class="btn btn-secundario btn-mini" onclick="elegirRango(${sig})">Ampliar a ${sig} km</button>` : ''}<button class="btn btn-primario btn-mini" onclick="elegirRango(0)">Ver todos</button><button class="btn btn-secundario btn-mini" onclick="verMapaEventos()">Ver mapa</button></div></div>`;
}

// =========================================================
//  MAPA DE EVENTOS (Explorar)
// =========================================================
const MAPA_EV = { mapa: null, capa: null };
// Explorar en lista o en mapa.
function cambiarVistaExplorar(v){
  state.vistaExplorar = v;
  document.getElementById('pantalla-explorar').classList.toggle('modo-mapa', v === 'mapa');
  document.getElementById('vista-lista').classList.toggle('on', v !== 'mapa');
  document.getElementById('vista-mapa').classList.toggle('on', v === 'mapa');
  if(v === 'mapa') pintarMapaEventos(true);
}
// Abre Explorar en el mapa.
function verMapaEventos(){ ir('explorar'); cambiarVistaExplorar('mapa'); }
// Eventos de Explorar con búsqueda y filtro aplicados.
function eventosFiltradosExplorar(){
  let eventos = eventosParaVer();
  const f = state.filtroActivoExplorar;
  if(f==='fiestas') eventos = eventos.filter(e=>e.tipo==='fiesta');
  if(f==='previas-publicas') eventos = eventos.filter(e=>e.tipo==='previa' && e.privacidad==='publica');
  if(f==='previas-privadas') eventos = eventos.filter(e=>e.privacidad==='privada');
  if(f==='gratis') eventos = eventos.filter(e=>!(e.precio > 0) && e.privacidad!=='privada');
  if(f==='universitarias') eventos = eventos.filter(esUniversitaria);
  if(['egresados', 'pena', 'after', 'cumple', 'musical', 'gastronomico'].includes(f)) eventos = eventos.filter(e=>e.ocasion===f);
  if(state.busqueda){
    const q = normalizar(state.busqueda);
    eventos = eventos.filter(e =>
      normalizar(e.nombre).includes(q) || normalizar(etiquetaEstilo(e.categoria)).includes(q) ||
      normalizar(lugarPublico(e)).includes(q)  || normalizar(e.musica).includes(q) || normalizar(etiquetaTipo(e)).includes(q));
  }
  return eventos;
}
// Pinta los eventos en el mapa (solo si cambiaron).
async function pintarMapaEventos(encuadrar){
  if(state.vistaExplorar !== 'mapa' || pantallaActual() !== 'explorar') return;
  try{ await cargarLeaflet(); } catch(e){ document.getElementById('mapa-contador').textContent = 'No se pudo cargar el mapa'; return; }
  const centro = state.userCoords || { lat: -34.6, lng: -63.6 };
  if(!MAPA_EV.mapa){
    MAPA_EV.mapa = L.map('explorar-mapa-lienzo', { zoomControl: true }).setView([centro.lat, centro.lng], state.userCoords ? 12 : 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'tiles-oscuros',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(MAPA_EV.mapa);
    MAPA_EV.mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    MAPA_EV.capa = L.layerGroup().addTo(MAPA_EV.mapa);
  }
  setTimeout(() => MAPA_EV.mapa.invalidateSize(), 50);
  const eventos = eventosFiltradosExplorar().filter(e => typeof e.lat === 'number');
  // Solo se redibuja si algo cambió (así no se cierra la tarjeta que estás mirando)
  const firma = JSON.stringify([centro.lat, centro.lng, state.radioKm, eventos.map(e => [e.id, e.lat, e.lng, ambienteAuto(e).clase, e.nombre, e.imagen?.length])]);
  if(firma === MAPA_EV.firma){ if(encuadrar) encuadrarMapa(eventos, centro); return; }
  MAPA_EV.firma = firma;
  const capa = MAPA_EV.capa; capa.clearLayers();
  const puntos = [];
  if(state.userCoords){
    L.marker([centro.lat, centro.lng], { icon: L.divIcon({ className: '', html: '<div class="pin-yo"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(capa);
    if(state.radioKm) L.circle([centro.lat, centro.lng], { radius: state.radioKm * 1000, color: '#F26A1B', weight: 1.5, fillColor: '#F26A1B', fillOpacity: .06, dashArray: '6 6' }).addTo(capa);
  }
  eventos.forEach(e => {
    const a = ambienteAuto(e);
    const privada = e.privacidad === 'privada' && e.creador !== state.uid;
    const m = privada
      ? L.circle([e.lat, e.lng], { radius: 650, color: '#E8B411', weight: 1.5, dashArray: '4 6', fillColor: '#E8B411', fillOpacity: .12 }).addTo(capa)
      : L.marker([e.lat, e.lng], { icon: L.divIcon({ className: '', html: `<div class="pin-evento ${a.clase}"></div>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] }) }).addTo(capa);
    const dist = state.userCoords ? ` · ${textoDistancia(e, distanciaKm(centro.lat, centro.lng, e.lat, e.lng))}` : '';
    m.bindPopup(`<div class="popup-ev" data-abrir="${esc(e.id)}"><div class="f" style="background-image:${cssFoto(e)}"></div>
      <div class="c">${esc(etiquetaEstilo(e.categoria))} · ${esc(etiquetaTipo(e))}${e.privacidad === 'privada' ? ' · 🔒 zona aproximada' : ''}</div><b>${esc(e.nombre)}</b>
      <span>${esc(fmtFecha(e.fechaTs))}${esc(dist)} · ${esc(precioTxt(e))}</span>
      <button class="btn btn-primario">Ver evento</button></div>`);
    puntos.push([e.lat, e.lng]);
  });
  document.getElementById('mapa-contador').textContent = `${eventos.length} ${eventos.length === 1 ? 'evento' : 'eventos'}${state.radioKm && state.userCoords ? ' a menos de ' + state.radioKm + ' km' : ''}`;
  if(encuadrar) encuadrarMapa(eventos, centro);
}
// Ajusta el mapa para que se vean todos los eventos.
function encuadrarMapa(eventos, centro){
  const puntos = eventos.map(e => [e.lat, e.lng]);
  if(state.radioKm && state.userCoords) MAPA_EV.mapa.fitBounds(L.latLng(centro.lat, centro.lng).toBounds(state.radioKm * 2000), { padding: [10, 10] });
  else if(puntos.length) MAPA_EV.mapa.fitBounds(L.latLngBounds(puntos.concat(state.userCoords ? [[centro.lat, centro.lng]] : [])), { padding: [40, 40], maxZoom: 14 });
}

// =========================================================
//  MAPA: elegir la ubicación del evento tocando el mapa
// =========================================================
const MAPA = { mapa: null, pin: null, punto: null, dir: null, cargando: null, tRev: null };
// Carga la librería de mapas solo cuando hace falta.
// Carga la librería del QR recién cuando se abre una entrada con QR.
let _cargandoQR = null;
function cargarQR(){
  if(window.QRCode) return Promise.resolve();
  if(_cargandoQR) return _cargandoQR;
  _cargandoQR = new Promise((ok, mal) => {
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    js.onload = () => ok(); js.onerror = () => { _cargandoQR = null; mal(new Error('No se pudo cargar el QR')); };
    document.head.appendChild(js);
  });
  return _cargandoQR;
}
function cargarLeaflet(){
  if(window.L) return Promise.resolve();
  if(MAPA.cargando) return MAPA.cargando;
  MAPA.cargando = new Promise((ok, mal) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = () => ok(); js.onerror = () => { MAPA.cargando = null; mal(new Error('No se pudo cargar el mapa')); };
    document.head.appendChild(js);
  });
  return MAPA.cargando;
}
// Mapa para elegir dónde es el evento.
async function abrirMapa(){
  document.getElementById('modal-mapa').classList.add('show');
  abrirModalHist();
  document.getElementById('mapa-resultados').innerHTML = '';
  try{ await cargarLeaflet(); }
  catch(e){ document.getElementById('mapa-dir').textContent = 'No se pudo cargar el mapa. Revisá tu conexión y probá de nuevo.'; return; }
  const inicio = state.ubicacionMapa || state.userCoords || { lat: -34.6, lng: -63.6 };
  if(!MAPA.mapa){
    MAPA.mapa = L.map('mapa-lienzo', { zoomControl: true, attributionControl: true }).setView([inicio.lat, inicio.lng], (state.ubicacionMapa || state.userCoords) ? 15 : 5);
    // OpenStreetMap: gratis y sin clave. Lo oscurecemos con CSS para que combine con la app.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, className: 'tiles-oscuros',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(MAPA.mapa);
    MAPA.mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    const icono = L.divIcon({ className: '', html: '<div class="pin-partazy"></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
    MAPA.pin = L.marker([inicio.lat, inicio.lng], { draggable: true, icon: icono }).addTo(MAPA.mapa);
    MAPA.pin.on('dragend', () => { const p = MAPA.pin.getLatLng(); marcarPunto(p.lat, p.lng); });
    MAPA.mapa.on('click', ev => marcarPunto(ev.latlng.lat, ev.latlng.lng));
    document.getElementById('mapa-buscar').addEventListener('keydown', ev => { if(ev.key === 'Enter') buscarEnMapa(); });
  } else {
    MAPA.mapa.setView([inicio.lat, inicio.lng], 15);
    MAPA.pin.setLatLng([inicio.lat, inicio.lng]);
  }
  setTimeout(() => MAPA.mapa.invalidateSize(), 60);
  if(state.ubicacionMapa) marcarPunto(inicio.lat, inicio.lng, true);
}
// Cierra el mapa para elegir lugar.
function cerrarMapa(){ document.getElementById('modal-mapa').classList.remove('show'); soltarModalHist(); }
// Pone el pin en el mapa y busca la dirección de ese punto.
function marcarPunto(lat, lng, centrar){
  MAPA.punto = { lat, lng };
  MAPA.pin.setLatLng([lat, lng]);
  if(centrar) MAPA.mapa.setView([lat, lng], Math.max(MAPA.mapa.getZoom(), 16));
  document.getElementById('mapa-confirmar').disabled = false;
  document.getElementById('mapa-dir').innerHTML = 'Buscando la dirección...';
  clearTimeout(MAPA.tRev);
  MAPA.tRev = setTimeout(async () => {
    try{
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=es&lat=${lat}&lon=${lng}`);
      const d = await r.json();
      if(MAPA.punto?.lat !== lat) return;
      MAPA.dir = partesDireccion(d);
    } catch(e){ MAPA.dir = { corta: '', barrio: '', completa: '' }; }
    const dir = MAPA.dir;
    document.getElementById('mapa-dir').innerHTML = dir.corta
      ? `<b>${esc(dir.corta)}</b><small>${esc(dir.completa)}</small>`
      : 'Punto marcado (sin dirección exacta). Podés escribirla a mano después.';
  }, 650);
}
// Separa una dirección de OpenStreetMap en calle, barrio y ciudad.
function partesDireccion(d){
  const a = d?.address || {};
  const calle = [a.road || a.pedestrian || a.footway || '', a.house_number || ''].filter(Boolean).join(' ');
  const barrio = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
  const ciudad = a.city || a.town || a.village || '';
  const nombre = d?.name && d.name !== a.road ? d.name : '';
  const corta = [nombre, calle, barrio].filter(Boolean).join(', ');
  return { corta: corta.slice(0, 120), barrio: barrio || ciudad, completa: [calle, barrio, ciudad].filter(Boolean).join(', ').slice(0, 200), calle };
}
// Busca una dirección cerca de donde estás (cualquier ciudad de Argentina).
async function buscarEnMapa(){
  const q = document.getElementById('mapa-buscar').value.trim();
  const cont = document.getElementById('mapa-resultados');
  if(q.length < 3){ cont.innerHTML = ''; return; }
  cont.innerHTML = '<div class="ayuda" style="padding:4px 2px 10px;">Buscando...</div>';
  try{
    // Busca cerca de donde estás (o de donde está el mapa), en cualquier ciudad de Argentina
    const c = MAPA.mapa ? MAPA.mapa.getCenter() : (state.userCoords ? { lat: state.userCoords.lat, lng: state.userCoords.lng } : null);
    const caja = c ? `&viewbox=${c.lng - 0.5},${c.lat + 0.5},${c.lng + 0.5},${c.lat - 0.5}` : '';
    const url = qq => `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ar&accept-language=es${caja}&q=${encodeURIComponent(qq)}`;
    const ciudad = state.ciudadActual && !q.includes(',') && !normalizar(q).includes(normalizar(state.ciudadActual)) ? ', ' + state.ciudadActual : '';
    let lista = await (await fetch(url(q + ciudad))).json();
    if(!lista.length && ciudad) lista = await (await fetch(url(q))).json();
    MAPA.resultados = lista;
    cont.innerHTML = lista.length ? lista.map((x, i) => `<button data-res="${i}">${esc(x.display_name)}</button>`).join('')
      : '<div class="ayuda" style="padding:4px 2px 10px;">No encontramos esa dirección. Probá con calle y número, o tocá el mapa.</div>';
    cont.querySelectorAll('[data-res]').forEach(b => b.onclick = () => {
      const x = MAPA.resultados[+b.dataset.res];
      cont.innerHTML = '';
      marcarPunto(parseFloat(x.lat), parseFloat(x.lon), true);
    });
  } catch(e){ cont.innerHTML = '<div class="ayuda" style="padding:4px 2px 10px;">No se pudo buscar. Probá de nuevo.</div>'; }
}
// Centra el mapa en mi ubicación.
function mapaMiUbicacion(){
  if(!navigator.geolocation){ toast('Tu navegador no comparte la ubicación'); return; }
  navigator.geolocation.getCurrentPosition(
    p => marcarPunto(p.coords.latitude, p.coords.longitude, true),
    () => toast('No pudimos obtener tu ubicación'), { timeout: 8000 });
}
// Usa el punto elegido como lugar del evento.
function confirmarMapa(){
  if(!MAPA.punto) return;
  state.ubicacionMapa = { ...MAPA.punto };
  const dir = MAPA.dir || {};
  const privada = esPrivadaEnForm();
  if(privada){
    if(dir.completa) document.getElementById('f-direccion').value = dir.completa;
    const campoZona = document.getElementById('f-lugar');
    if(dir.barrio && !pareceDireccion(dir.barrio)) campoZona.value = dir.barrio;
    else if(pareceDireccion(campoZona.value)) campoZona.value = '';
  } else if(dir.corta){
    document.getElementById('f-lugar').value = dir.corta;
  }
  document.getElementById('mapa-elegido').textContent = privada
    ? '✓ Ubicación marcada. El público solo ve la zona; la dirección exacta, los aprobados.'
    : '✓ Ubicación marcada en el mapa';
  cerrarMapa();
}

// =========================================================
//  EDITAR EVENTO (reusa el formulario de Crear)
// =========================================================
function modoEdicionUI(on){
  const set = (id, fn) => { const el = document.getElementById(id); if(el) fn(el); };
  set('crear-titulo', el => el.textContent = on ? 'Editar evento' : 'Crear');
  set('crear-intro', el => el.textContent = on
    ? 'Cambiá lo que necesites. Si modificás la fecha, el horario o el lugar, avisamos en el grupo del evento.'
    : 'Fiestas, previas, recitales, charlas, ferias, talleres, partidos… cualquier evento donde vaya gente.');
  set('crear-tipo', el => el.style.display = 'none');
  set('form-crear', el => el.classList.toggle('todo', on));
  set('btn-publicar', el => el.textContent = on ? 'Guardar cambios' : 'Publicar evento');
  if(on){
    // Las entradas QR no se cambian con gente ya anotada (la privacidad de una previa sí)
    set('fila-qr', el => el.style.display = 'none');
  }
}

// Fecha en formato del campo de fecha (AAAA-MM-DD).
function fechaInput(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Abre el formulario de Crear con los datos del evento para editarlo.
async function editarEvento(ev){
  if(!ev || ev.creador !== state.uid || esCancelado(ev)) return;
  resetFormularioCrear();
  state.editandoId = ev.id; state.editandoEv = ev;
  const setv = (id, v) => { const el = document.getElementById(id); if(el) el.value = v == null ? '' : v; };
  const setSwitch = (id, on) => { const el = document.getElementById(id); if(!el) return; el.classList.toggle('on', !!on); el.setAttribute('aria-checked', on ? 'true' : 'false'); };
  const esPrevia = ev.tipo === 'previa' || ev.ocasion === 'previa';
  elegirTipo(esPrevia ? 'previa' : 'fiesta');
  setSwitch('switch-privacidad', ev.privacidad === 'privada');
  actualizarCamposPrivacidad();
  setv('f-nombre', ev.nombre); setv('f-lugar', ev.lugar);
  state._lugarIni = ev.lugar; state._dirIni = null;
  setv('f-fecha', fechaInput(ev.fechaTs)); setv('f-hora', ev.hora); setv('f-hora-fin', ev.horaFin);
  if(typeof ev.inscripcionHasta === 'number'){ const di = new Date(ev.inscripcionHasta); setv('f-insc-fecha', fechaInput(ev.inscripcionHasta)); setv('f-insc-hora', `${String(di.getHours()).padStart(2, '0')}:${String(di.getMinutes()).padStart(2, '0')}`); }
  setv('f-capacidad', ev.capacidadDesconocida ? '' : ev.capacidad); setv('f-edad', ev.edadMinima);
  setv('f-dresscode', ev.dresscode === 'Libre' ? '' : ev.dresscode);
  setv('f-estilo', ESTILOS[ev.categoria] ? (ev.categoria === 'universitaria' ? 'variado' : ev.categoria) : '');
  elegirOcasion(esPrevia ? 'previa' : (ev.ocasion || 'fiesta'));
  setv('f-musica', ev.musica === ESTILOS[ev.categoria] ? '' : ev.musica);
  setv('f-descripcion', ev.descripcion === 'Evento creado desde Partazy.' ? '' : ev.descripcion);
  setv('f-reglas', ev.reglas === 'Respetar el lugar y a los demás asistentes.' ? '' : ev.reglas);
  setv('f-lineup', ev.lineup);
  const pago = (ev.precio || 0) > 0;
  setSwitch('switch-pago', pago);
  document.getElementById('campo-precio').style.display = pago ? 'block' : 'none';
  document.getElementById('ayuda-capacidad').style.display = pago ? '' : 'none';
  setv('f-precio', pago ? ev.precio : ''); setv('f-pago-info', ev.pagoInfo); setv('f-link-entradas', ev.linkEntradas);
  setSwitch('switch-vip', ev.listaVip); setSwitch('switch-bebida', ev.bebida);
  state.vipOriginal = [];
  document.getElementById('f-vip').value = '';
  if(ev.listaVip) DataService.getVip(ev.id).then(l => { if(state.editandoId === ev.id){ state.vipOriginal = l; document.getElementById('f-vip').value = l.join('\n'); } }).catch(() => {});
  actualizarCampoVip();
  state.imagenMini = null;
  if(ev.imagen){
    state.imagenNueva = ev.imagen;
    const prev = document.getElementById('preview-imagen');
    prev.src = imgSafe(ev.imagen); prev.style.display = 'block';
    document.getElementById('upload-label-txt').textContent = 'Tocá para cambiar la foto';
  }
  modoEdicionUI(true);
  state.tipoElegido = true;
  renderCamposTipo(esPrevia ? 'previa' : (ev.ocasion || 'fiesta'), ev.extras || {});
  irAPasoCrear(3);
  state.abriendoEdicion = true;
  try{ ir('crear'); } finally { state.abriendoEdicion = false; }
  if(ev.privacidad === 'privada'){
    const dir = await DataService.getDireccionExacta(ev.id);
    if(state.editandoId === ev.id && dir){ setv('f-direccion', dir); state._dirIni = dir; }
  }
}

// Sale de Crear (o de la edición).
function cerrarCrear(){
  if(state.editandoId){
    const id = state.editandoId;
    resetFormularioCrear();
    volver(() => abrirDetalle(id));
  } else volver('home');
}

// Guarda los cambios de un evento (incluido privada ⇄ pública) y avisa en el grupo.
async function guardarEdicion(ev, d){
  const cambiaPriv = d.privacidad !== (ev.privacidad || 'publica');
  // Para pasarla a pública no puede haber solicitudes sin responder
  if(cambiaPriv && d.privacidad === 'publica'){
    let pend = 0;
    try{ pend = (await DataService.listarAsistentes(ev.id)).filter(a => a.estado === 'solicitado').length; } catch(e){}
    if(pend){
      await confirmar('Tenés solicitudes sin responder', `Hay ${pend} ${pend === 1 ? 'persona esperando' : 'personas esperando'} que la apruebes. Aceptalas o rechazalas desde el evento y después pasala a pública.`, 'Entendido');
      return;
    }
  }
  const cambios = {
    tipo: d.tipo, tipoLugar: d.tipo === 'previa' ? 'Previa' : 'Fiesta', privacidad: d.privacidad,
    nombre: d.nombre, lugar: d.lugar, fechaTs: d.fechaTs, hora: d.hora, horaFin: d.horaFin,
    capacidad: d.capacidad, capacidadDesconocida: d.capacidadDesconocida, edadMinima: d.edadMinima, precio: d.precio, pagoInfo: d.pagoInfo,
    linkEntradas: d.linkEntradas, lineup: d.lineup, categoria: d.categoria, musica: d.musica, ocasion: d.ocasion,
    dresscode: d.dresscode, bebida: d.bebida, listaVip: d.listaVip, imagen: d.imagen, ...(d.imagenGrande ? { fotoGrande: true } : {}),
    descripcion: d.descripcion, reglas: d.reglas, editadoTs: Date.now(),
  };
  if(Object.keys(d.extras || {}).length || ev.extras) cambios.extras = d.extras || {};
  // Fecha límite: se guarda, se cambia o se borra (solo si cambió)
  if(d.inscripcionHasta) cambios.inscripcionHasta = d.inscripcionHasta;
  else if(typeof ev.inscripcionHasta === 'number') cambios.inscripcionHasta = firebase.firestore.FieldValue.delete();
  const privadaAhora = d.privacidad === 'privada';
  if(state.ubicacionMapa){
    const exacta = !privadaAhora, j = () => exacta ? 0 : (Math.random() - 0.5) * 0.008;
    cambios.lat = state.ubicacionMapa.lat + j(); cambios.lng = state.ubicacionMapa.lng + j(); cambios.ubicacionExacta = exacta;
  } else if(cambiaPriv && privadaAhora){
    // Pasa a privada: el pin público nunca marca la casa
    const base = typeof ev.lat === 'number' ? { lat: ev.lat, lng: ev.lng } : await ubicarLugar(d.lugar), j = () => (Math.random() - 0.5) * 0.008;
    cambios.lat = base.lat + j(); cambios.lng = base.lng + j(); cambios.ubicacionExacta = false;
  } else if(d.lugar !== ev.lugar){
    const c = await ubicarLugar(d.lugar), j = () => (Math.random() - 0.5) * 0.004;
    cambios.lat = c.lat + j(); cambios.lng = c.lng + j(); cambios.ubicacionExacta = false;
  }
  // Solo lo que cambió de verdad
  Object.keys(cambios).forEach(k => { if(k !== 'editadoTs' && JSON.stringify(cambios[k]) === JSON.stringify(ev[k])) delete cambios[k]; });
  const vipCambio = d.listaVip && JSON.stringify(d.vip) !== JSON.stringify(state.vipOriginal || []);
  const quedoIgual = Object.keys(cambios).length === 1 && !vipCambio;
  const dirCambio = d.direccion && privadaAhora;
  if(quedoIgual && !dirCambio){ toast('No cambiaste nada'); return; }
  if(vipCambio && Object.keys(cambios).length === 1 && !dirCambio){
    try{ await DataService.guardarVip(ev.id, d.vip); state.vipOriginal = d.vip; toast('Lista VIP guardada'); resetFormularioCrear(); volver(() => abrirDetalle(ev.id)); }
    catch(e){ toast('No se pudo guardar la lista VIP'); }
    return;
  }

  const claves = [];
  if('fechaTs' in cambios || 'hora' in cambios) claves.push(`fecha y hora: ${fmtFecha(d.fechaTs)}`);
  if('horaFin' in cambios && d.horaFin) claves.push(`cierre: ${d.horaFin} hs`);
  if('lugar' in cambios && !(cambiaPriv && privadaAhora)) claves.push(`lugar: ${d.lugar}`);
  if(cambiaPriv) claves.push(privadaAhora ? 'ahora es privada (la dirección la ven solo los aprobados)' : 'ahora es pública');
  const mensaje = claves.length ? {
    uid: state.uid, nombre: (state.perfil.nombre || '').slice(0, 60),
    texto: ('📢 El organizador actualizó el evento — ' + claves.join(' · ')).slice(0, 500), ts: Date.now()
  } : null;

  const btn = document.getElementById('btn-publicar');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try{
    if(d.imagenGrande) fotosGrandes.set(ev.id, d.imagenGrande);
    await DataService.editarEvento(ev.id, cambios, dirCambio ? d.direccion : null, mensaje, d.imagenGrande);
    if(d.listaVip) DataService.guardarVip(ev.id, d.vip).catch(e => console.warn('vip', e));
    const enLista = state.eventos.find(e => e.id === ev.id);
    if(enLista) Object.assign(enLista, cambios);
    state.eventos.sort((a,b) => a.fechaTs - b.fechaTs);
    resetFormularioCrear();
    renderHome(); renderExplorar(); renderPerfilVista();
    toast(mensaje ? 'Cambios guardados · avisamos en el grupo' : 'Cambios guardados');
    volver(() => abrirDetalle(ev.id));
  } catch(e){
    console.error(e);
    toast('No se pudieron guardar los cambios');
  } finally {
    btn.disabled = false; btn.textContent = state.editandoId ? 'Guardar cambios' : 'Publicar evento';
  }
}

// =========================================================
//  PERFIL
// =========================================================
async function renderPerfilVista(){
  if(!state.perfil) return;
  document.getElementById('perfil-avatar').innerHTML = avatarHTML(state.perfil);
  document.getElementById('perfil-nombre').innerHTML = esc(nombreVisible(state.perfil)) + insignia(state.perfil);
  actualizarFilaQR();
  renderTarjetaVerificacion();
  document.getElementById('btn-mi-pagina').style.display = esOrganizacion(state.perfil) ? '' : 'none';
  document.getElementById('perfil-handle').textContent = state.perfil.usuario ? '@' + state.perfil.usuario : '';
  document.getElementById('perfil-aviso').innerHTML = state.perfil.usuario ? '' :
    `<button class="btn btn-primario" style="margin-bottom:16px;" onclick="editarPerfil()">Elegí tu @usuario para que te encuentren</button>`;
  const edad = edadUsuario();
  document.getElementById('perfil-ubic').textContent = [isNaN(edad) || state.perfil.ocultarEdad ? null : `${edad} años`, state.perfil.ciudad].filter(Boolean).join(' · ');
  // El mail no se muestra en el perfil (está en ☰ → Mis datos, que solo ves vos)
  const pc = document.getElementById('perfil-calif');
  const txtCalif = esOrganizacion(state.perfil) ? (califOrgTxt(state.perfil) || 'Todavía sin calificaciones · te califican quienes van a tus eventos') : '';
  pc.innerHTML = txtCalif; pc.style.display = txtCalif ? '' : 'none';
  const bioEl = document.getElementById('perfil-bio');
  bioEl.textContent = state.perfil.bio || ''; bioEl.style.display = state.perfil.bio && !esOrganizacion(state.perfil) ? '' : 'none';
  document.getElementById('stat-organizados').textContent = state.eventos.filter(e => e.creador === state.uid).length;
  const intereses = state.perfil.intereses || [];
  document.getElementById('perfil-intereses').innerHTML = intereses.length
    ? intereses.map(i => `<span class="chip activo">${esc(i)}</span>`).join('')
    : emptyState('Todavía no elegiste intereses. Tocá el lápiz para agregarlos.');

  const cont = document.getElementById('perfil-proximos');
  try{
    const prox = await proximasEntradas();
    document.getElementById('stat-eventos').textContent = prox.length;
    cont.innerHTML = prox.length ? prox.map(e => e.creador === state.uid ? `
      <div class="item-simple" role="button" tabindex="0" data-abrir="${esc(e.id)}">
        <div class="foto-mini" style="background-image:${cssFoto(e)}"></div>
        <div class="txt"><h5>${esc(e.nombre)}<span class="badge-org">ORGANIZÁS</span></h5><span>${esc(fmtFecha(e.fechaTs))} hs</span></div>
        ${esCancelado(e) ? '' : `<button class="btn-editar-mini" data-editar="${esc(e.id)}">✏️ Editar</button>`}
      </div>` : `
      <div class="item-simple" role="button" tabindex="0" data-ticket="${esc(e.id)}">
        <div class="foto-mini" style="background-image:${cssFoto(e)}"></div>
        <div class="txt"><h5>${esc(e.nombre)}</h5><span>${esc(fmtFecha(e.fechaTs))} hs</span></div>
      </div>`).join('') : emptyState('Todavía no confirmaste ningún evento.');
  } catch(e){
    console.warn('perfil eventos', e);
    cont.innerHTML = emptyState('No pudimos cargar tus eventos.');
  }
  pintarMisCompartidos();
  const pm = document.getElementById('punto-menu');
  if(pm) pm.style.display = (document.getElementById('badge-moderacion')?.textContent || '').trim() && document.getElementById('btn-moderacion').style.display !== 'none' ? '' : 'none';
}
// Sección "Compartiste" del perfil.
function pintarMisCompartidos(){
  const b = document.getElementById('perfil-compartidos-bloque');
  if(!b) return;
  const lista = (state.misCompartidos || []).map(eventoEnCache).filter(e => e && !esCancelado(e));
  document.getElementById('ico-compartiste').innerHTML = ICO_REPOST;
  b.style.display = lista.length ? '' : 'none';
  document.getElementById('perfil-compartidos').innerHTML = lista.map(e => `
    <div class="item-simple" role="button" tabindex="0" data-abrir="${esc(e.id)}">
      <div class="foto-mini" style="background-image:${cssFoto(e)}"></div>
      <div class="txt"><h5>${esc(e.nombre)}</h5><span>${esc(fmtFecha(e.fechaTs))} hs · lo ven tus amigos</span>${state.misNotas?.[e.id] ? `<span class="nota-mia">${textoConMenciones(state.misNotas[e.id])}</span>` : ''}
        <span class="mi-nota-acciones"><button class="btn-nota" data-editar-nota="${esc(e.id)}">✏️ ${state.misNotas?.[e.id] ? 'Editar' : 'Comentar'}</button>${state.misNotas?.[e.id] ? `<button class="btn-nota peligro" data-borrar-nota="${esc(e.id)}">🗑 Borrar</button>` : ''}</span></div>
    </div>`).join('');
}

// Lleva a elegir los gustos de música (editor del perfil, en la parte de intereses).
function elegirGustos(){
  ir('perfil'); editarPerfil();
  state.desdeGustos = true;   // al guardar, vuelve al inicio con las recomendaciones
  setTimeout(() => { const el = document.querySelector('#ep-intereses [data-grupo="musica"]'); if(el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
}
// "Mis datos": lo que la persona cargó al crear la cuenta. Solo lo ve ella (nunca la contraseña).
function abrirMisDatos(){
  cerrarMenuPerfil && cerrarMenuPerfil();
  const p = state.perfil || {}, pr = state.privado || {};
  const nac = pr.nacimiento ? pr.nacimiento.split('-').reverse().join('/') : '—';
  const alta = p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const login = auth?.currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email y contraseña';
  const fila = (t, v) => `<div class="dato-fila"><small>${t}</small><b>${esc(v || '—')}</b></div>`;
  document.getElementById('hoja-contenido').innerHTML = `<div class="mis-datos">
    <div class="agarre"></div>
    <h3>Mis datos</h3>
    <p class="ayuda">🔒 Solo vos ves esta información. Los demás ven tu nombre, @usuario, foto, ciudad y gustos.</p>
    ${fila(esOrganizacion(p) ? 'Nombre de la organización' : 'Nombre y apellido', p.nombre)}
    ${p.apodo ? fila('Apodo', p.apodo) : ''}
    ${fila('Usuario', p.usuario ? '@' + p.usuario : '')}
    ${fila('Email', state.email || pr.email)}
    ${fila('Fecha de nacimiento', nac)}
    ${fila('Ciudad o barrio', p.ciudad)}
    ${fila('Tipo de cuenta', esOrganizacion(p) ? 'Organización' : 'Persona')}
    ${fila('Cómo entrás', login)}
    ${fila('Cuenta creada', alta)}
    <div class="fila-botones" style="padding:0; margin-top:14px;"><button class="btn btn-secundario" onclick="cerrarHoja(); editarPerfil();">✏️ Editar mis datos</button><button class="btn btn-primario" onclick="cerrarHoja()">Listo</button></div>
  </div>`;
  document.getElementById('hoja-vista').classList.add('show');
  abrirModalHist && abrirModalHist();
}
// Abre el formulario de edición del perfil.
function editarPerfil(){
  document.getElementById('vista-perfil').style.display = 'none';
  document.getElementById('form-perfil').style.display = 'flex';
  document.getElementById('ep-nombre').value = state.perfil.nombre || '';
  state.fotoPerfilNueva = null;
  state.quitarFoto = false;
  pintarFotoPerfil('ep-foto', state.perfil.foto, state.perfil.iniciales);
  document.getElementById('ep-foto-estado').textContent = 'Tocá el círculo para cambiar tu foto';
  document.getElementById('ep-foto-estado').classList.remove('ok', 'mal');
  document.getElementById('ep-usuario').value = state.perfil.usuario || sugerirUsuario(state.perfil.nombre);
  comprobarUsuario(document.getElementById('ep-usuario').value, 'ep-usuario-estado');
  document.getElementById('ep-apodo').value = state.perfil.apodo || '';
  elegirTipoCuenta('ep-tipo', state.perfil.tipoCuenta || 'persona');
  pintarCamposOrg(state.perfil);
  document.getElementById('ep-bio').value = state.perfil.bio || '';
  const sw = (id, on) => { const el = document.getElementById(id); el.classList.toggle('on', on); el.setAttribute('aria-checked', on ? 'true' : 'false'); };
  sw('ep-amigos', !state.perfil.ocultarAmigos); sw('ep-seguidores', !state.perfil.ocultarSeguidores);
  sw('ep-edad', !state.perfil.ocultarEdad); sw('ep-enlinea', !state.perfil.ocultarEnLinea); sw('ep-planes', !state.perfil.ocultarPlanes); sw('ep-mensajes', state.perfil.mensajesDe !== 'amigos');
  document.getElementById('ep-ciudad').value = state.perfil.ciudad || '';
  autocompletarLugar(document.getElementById('ep-ciudad'));
  renderSelectorIntereses('ep-intereses', state.perfil.intereses || []);
}

// Sale de la edición del perfil sin guardar.
function cancelarEdicionPerfil(){
  state.desdeGustos = false;
  document.getElementById('vista-perfil').style.display = 'block';
  document.getElementById('form-perfil').style.display = 'none';
}

// Valida y guarda el perfil.
async function guardarPerfil(){
  const nombre = document.getElementById('ep-nombre').value.trim();
  if(nombre.length < 2){ toast('Escribí tu nombre'); return; }
  const ciudadVal = await validarLugar(document.getElementById('ep-ciudad'), state.perfil.ciudad);
  if(ciudadVal === null){ toast('No encontramos esa ciudad o barrio. Elegí una opción de la lista.'); document.getElementById('ep-ciudad').focus(); return; }
  const ciudad = ciudadVal || state.perfil.ciudad;
  const usuario = normalizarUsuario(document.getElementById('ep-usuario').value);
  if(!(await comprobarUsuario(usuario, 'ep-usuario-estado'))){ toast('Elegí otro nombre de usuario'); return; }
  const tipoCuenta = tipoCuentaElegido('ep-tipo');
  const apodo = tipoCuenta === 'organizacion' ? '' : document.getElementById('ep-apodo').value.trim().slice(0, 40);
  const cambios = { nombre, usuario, apodo, tipoCuenta, ...camposBusqueda(nombre, usuario, apodo), ciudad,
    intereses: interesesElegidos('ep-intereses'), iniciales: inicialesDe(apodo || nombre),
    bio: document.getElementById('ep-bio').value.trim().slice(0, 300),
    ocultarEdad: !document.getElementById('ep-edad').classList.contains('on'),
    ocultarEnLinea: !document.getElementById('ep-enlinea').classList.contains('on'),
    ocultarPlanes: !document.getElementById('ep-planes').classList.contains('on'),
    ocultarAmigos: !document.getElementById('ep-amigos').classList.contains('on'),
    ocultarSeguidores: !document.getElementById('ep-seguidores').classList.contains('on'),
    mensajesDe: document.getElementById('ep-mensajes').classList.contains('on') ? 'todos' : 'amigos' };
  if(cambios.ocultarEnLinea) cambios.ultimaConexion = 0;
  if(tipoCuenta === 'organizacion') Object.assign(cambios, leerCamposOrg());
  if(state.fotoPerfilNueva) cambios.foto = state.fotoPerfilNueva;
  else if(state.quitarFoto) cambios.foto = '';

  try{
    await DataService.actualizarPerfil(state.uid, cambios, state.perfil.usuario || '');
    state.fotoPerfilNueva = null;
    Object.assign(state.perfil, cambios);
    const desdeGustos = state.desdeGustos;
    cancelarEdicionPerfil();
    renderPerfilVista();
    renderHome();          // el cartel "¿Qué música te gusta?" se va y aparece "Para vos"
    sincronizarPlanes();
    if(desdeGustos && misGustos().length){ ir('home'); toast('¡Listo! Ya te mostramos fiestas para vos 🎧'); }
    else toast('Perfil actualizado');
  } catch(e){
    console.error(e);
    toast('No se pudo guardar');
  }
}

// =========================================================
//  INIT
// =========================================================
async function init(){
  mostrarLoader('CONECTANDO...');

  if(!FIREBASE_OK){
    document.getElementById('loader-txt').innerHTML =
      'No se pudo cargar Firebase.<br><small>Si estás en una vista previa, abrí la app desde su link publicado.<br>Si ya está publicada, revisá tu conexión o un bloqueador de anuncios.</small>';
    document.querySelector('.loader .spinner').style.display = 'none';
    return;
  }

  if(firebaseConfig.projectId === 'TU_PROYECTO'){
    document.getElementById('loader-txt').innerHTML = 'Falta configurar Firebase.<br>Editá <b>firebaseConfig</b> en el HTML.';
    document.querySelector('.loader .spinner').style.display = 'none';
    return;
  }

  pintarMailContacto();
  pintarIdiomas();
  cargarTraductor();
  pintarMailContacto();
  // Datos estáticos de la UI
  pintarBarrios();
  hacerAccesibles();
  elegirTipo('fiesta');
  document.getElementById('f-fecha').min = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  document.getElementById('btn-ver-mi-evento').addEventListener('click', () => state.ultimoCreado ? abrirDetalle(state.ultimoCreado) : ir('explorar'));

  // Botones de ingreso y registro
  setModoAuth('ingresar');
  const btnGoogle = document.getElementById('btn-google');
  btnGoogle.addEventListener('click', () => conBoton(btnGoogle, ingresarConGoogle));
  const btnFb = document.getElementById('btn-facebook');
  if(LOGIN_FACEBOOK && firebase.auth.FacebookAuthProvider){ btnFb.style.display = ''; btnFb.addEventListener('click', () => conBoton(btnFb, ingresarConFacebook)); }
  const btnPrincipal = document.getElementById('btn-auth-principal');
  btnPrincipal.addEventListener('click', () => conBoton(btnPrincipal, ingresarConEmail));
  document.getElementById('auth-pass').addEventListener('keydown', e => { if(e.key === 'Enter') btnPrincipal.click(); });
  document.getElementById('btn-auth-alternar').addEventListener('click', () => setModoAuth(modoAuth === 'crear' ? 'ingresar' : 'crear'));
  document.getElementById('btn-auth-olvide').addEventListener('click', olvideContrasena);
  const btnRegistro = document.getElementById('btn-registro');
  btnRegistro.addEventListener('click', () => conBoton(btnRegistro, completarRegistro));
  document.getElementById('btn-registro-salir').addEventListener('click', async () => { await auth.signOut(); location.reload(); });

  // Perfil: foto, @usuario y normas
  document.getElementById('rg-foto-input').addEventListener('change', e => elegirFotoPerfil(e.target, 'rg-foto', 'rg-foto-estado'));
  document.getElementById('ep-foto-input').addEventListener('change', e => { state.quitarFoto = false; elegirFotoPerfil(e.target, 'ep-foto', 'ep-foto-estado'); });
  document.getElementById('ep-foto-quitar').addEventListener('click', () => {
    state.fotoPerfilNueva = null; state.quitarFoto = true;
    pintarFotoPerfil('ep-foto', '', state.perfil?.iniciales);
    document.getElementById('ep-foto-estado').textContent = 'Se va a quitar al guardar';
  });
  vigilarUsuario('rg-usuario', 'rg-usuario-estado');
  document.getElementById('btn-enviar-verif').addEventListener('click', enviarVerificacion);
  document.getElementById('btn-escanear').addEventListener('click', alternarEscaner);
  document.getElementById('btn-validar').addEventListener('click', () => validarCodigo(document.getElementById('puerta-codigo').value));
  document.getElementById('puerta-codigo').addEventListener('keydown', e => { if(e.key === 'Enter') validarCodigo(e.target.value); });
  vigilarUsuario('ep-usuario', 'ep-usuario-estado');
  document.getElementById('btn-ver-normas').addEventListener('click', verNormas);

  // Amigos y mensajes
  document.getElementById('dm-enviar').addEventListener('click', () => enviarDMTexto());
  document.getElementById('dm-input').addEventListener('keydown', e => { if(e.key === 'Enter') enviarDMTexto(); });
  document.getElementById('dm-input').addEventListener('input', avisarQueEscribo);
  document.getElementById('tipos-grid').addEventListener('click', e => { const b = e.target.closest('[data-ocasion]'); if(!b) return; elegirTipoDesdeGrilla(b.dataset.ocasion); });
  irAPasoCrear(1);
  document.getElementById('f-nombre').addEventListener('input', () => { clearTimeout(state._tNombre); state._tNombre = setTimeout(revisarNombrePrevia, 600); });
  document.getElementById('dm-rapidos').addEventListener('click', e => { const b = e.target.closest('[data-rapido]'); if(b) enviarDMTexto(b.dataset.rapido); });
  document.getElementById('dm-rapidos').addEventListener('wheel', e => { if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){ e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  document.getElementById('input-buscar-personas').addEventListener('input', e => {
    clearTimeout(_debPersonas);
    _debPersonas = setTimeout(() => buscarPersonas(e.target.value), 300);
  });

  // Resultado de un ingreso con Google por redirección (si el popup estaba bloqueado)
  auth.getRedirectResult().catch(e => errorAuth(mensajeAuth(e)));

  // Toda la entrada a la app pasa por acá
  auth.onAuthStateChanged(async user => {
    try{
      // Las sesiones anónimas de la versión de prueba ya no se usan
      if(user && user.isAnonymous){ await auth.signOut(); return; }
      if(!user){
        state.uid = null; state.perfil = null; state.privado = null;
        await entrarComoInvitado();
        return;
      }
      salirDeInvitado();
      state.uid = user.uid;
      state.email = user.email || '';
      mostrarLoader('CARGANDO TU PERFIL...');
      const perfil = await DataService.getPerfil(user.uid);
      if(!perfil){ mostrarRegistro(user); return; }
      state.perfil = perfil;
      await entrarALaApp();
    } catch(e){
      console.error('Init error:', e);
      mostrarLoader();
      document.querySelector('.loader .spinner').style.display = 'none';
      document.getElementById('loader-txt').innerHTML =
        'Error de conexión.<br><small>' + esc(e.message || 'Intentá de nuevo') + '</small><br><br><button class="btn btn-primario btn-mini" onclick="location.reload()">Reintentar</button>';
    }
  });
}

init();
