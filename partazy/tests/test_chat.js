// Prueba: Mensajes privados, solicitudes de mensaje, "escribiendo" y no leídos.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const ahora=Date.now();
const perfil=(uid,nombre,usuario,extra)=>{ put('users/'+uid,{nombre,usuario,iniciales:nombre[0],ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:nombre.toLowerCase(),palabras:nombre.toLowerCase().split(' '),...(extra||{})}); put(`users/${uid}/privado/datos`,{nacimiento:'1998-01-01'}); };
perfil('A','Juan Lovotti','juan'); perfil('B','Sofia Gomez','sofi'); perfil('C','Ivo Paz','ivo'); perfil('D','Male Ruiz','male',{mensajesDe:'amigos'});
const abrir=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error(`[${uid}] ERROR JS`,e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let fallas=0; const ok=(c,m)=>{ console.log((c?'✔ ':'✘ ')+m); if(!c) fallas++; };
(async()=>{
  const A=abrir('A'), B=abrir('B'); await sleep(800); A.cerrarTutorial(); B.cerrarTutorial(); await sleep(300);
  const $A=id=>A.document.getElementById(id), $B=id=>B.document.getElementById(id);
  A.abrirUsuario('B'); await sleep(250);
  const btnMsj=A.document.querySelector('#usuario-contenido [data-dm="B"]');
  ok(!!btnMsj && /Enviar mensaje/.test(btnMsj.textContent), 'en el perfil de alguien que no es amigo aparece "Enviar mensaje"');
  btnMsj.click(); await sleep(300);
  ok(/Solicitud de mensaje/.test(txt($A('dm-aviso'))), 'avisa que el primer mensaje llega como solicitud');
  ok(/En línea/.test(txt($A('chat-top-persona'))), 'arriba dice "En línea" (Sofi tiene la app abierta)');
  $A('dm-input').value='Hola! vas a la fiesta del sábado?'; $A('dm-enviar').click(); await sleep(300);
  const dm=store.docs.get('dms/A_B');
  ok(dm && dm.estado==='solicitud' && dm.solicitante==='A', 'se crea como solicitud de mensaje');
  ok([...store.docs.entries()].some(([k,v])=>k.startsWith('notificaciones/B/items/')&&v.tipo==='mensaje_solicitud'), 'a Sofi le llega la notificación de solicitud');
  ok(/Esperando que Sofia acepte/.test(txt($A('dm-aviso'))), 'Juan ve "Esperando que acepte"');
  ok(/Hola! vas a la fiesta/.test(txt($A('dm-mensajes'))) && /Enviado/.test(txt($A('dm-mensajes'))), 'el mensaje se ve con "Enviado"');

  B.abrirChats(); await sleep(300);
  ok(/Solicitudes de mensajes \(1\)/.test(txt($B('lista-chats'))), 'Sofi ve "Solicitudes de mensajes (1)" separado de sus chats');
  B.document.querySelector('.solicitudes-dm').click(); await sleep(200);
  ok(/Juan Lovotti/.test(txt($B('lista-chats'))), 'y adentro está la de Juan');
  B.abrirDM('A'); await sleep(350);
  ok(/Juan quiere mandarte un mensaje/.test(txt($B('dm-aviso'))) && $B('dm-input').disabled, 'Sofi ve Aceptar/Rechazar y todavía no puede responder');
  B.document.querySelector('[data-sol-dm="aceptar"]').click(); await sleep(350);
  ok(store.docs.get('dms/A_B').estado==='aceptado' && !$B('dm-input').disabled, 'al aceptar, pueden chatear');
  ok([...store.docs.entries()].some(([k,v])=>k.startsWith('notificaciones/A/items/')&&v.tipo==='mensaje_aceptado'), 'a Juan le avisa que aceptó');
  await sleep(300);
  ok($A('dm-aviso').textContent.trim()==='' , 'a Juan se le va el cartel de espera');
  ok(/Visto/.test(txt($A('dm-mensajes'))), 'Juan ve "Visto" cuando Sofi lo leyó');

  // escribiendo...
  $B('dm-input').value='sii'; $B('dm-input').dispatchEvent(new B.Event('input')); await sleep(2300);
  ok(/escribiendo/.test(txt($A('chat-top-persona'))) && $A('dm-escribiendo').classList.contains('on'), 'Juan ve "escribiendo…" mientras Sofi tipea');
  $B('dm-enviar').click(); await sleep(400);
  ok(/sii/.test(txt($A('dm-mensajes'))) && !!A.document.querySelector('#dm-mensajes .msj.nuevo'), 'el mensaje nuevo entra con animación');
  B.document.querySelector('[data-rapido="🔥"]').click(); await sleep(400);
  ok(!!A.document.querySelector('#dm-mensajes .msj.solo-emoji'), 'los emojis rápidos se mandan y se ven grandes');
  ok(/Hoy/.test(txt($A('dm-mensajes'))), 'separador de día "Hoy"');

  // Rechazar
  const C=abrir('C'); await sleep(800); C.cerrarTutorial();
  C.abrirDM('B'); await sleep(250); C.document.getElementById('dm-input').value='hola sofi'; C.document.getElementById('dm-enviar').click(); await sleep(300);
  B.abrirDM('C'); await sleep(350);
  B.document.querySelector('[data-sol-dm="rechazar"]').click(); await sleep(400);
  ok(store.docs.get('dms/B_C').estado==='rechazado', 'Sofi puede rechazar');
  await sleep(300); C.abrirDM('B'); await sleep(300);
  ok(C.document.getElementById('dm-input').disabled && /No podés enviar más mensajes/.test(txt(C.document.getElementById('dm-aviso'))), 'Ivo ya no puede escribirle');

  // Solo amigos
  A.abrirDM('D'); await sleep(300);
  ok(/solo recibe mensajes de amigos/.test(txt($A('dm-aviso'))) && $A('dm-input').disabled, 'si alguien solo acepta amigos, no se puede escribir');
  ok(/Desconectado/.test(txt($A('chat-top-persona'))), 'arriba dice "Desconectado" si no tiene actividad');
  console.log(fallas ? '\nFALLAS: '+fallas : '\nTODO OK'); process.exit(fallas?1:0);
})();
