/* APC66 V5 — Inventaires, module séparé du parc existant. */
(()=>{'use strict';
const $=id=>document.getElementById(id), E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const URL_SUPA='https://deevoohyuvgwixniieje.supabase.co';
const KEY='sb_publishable_Vl8ujkL0YpK4l7u-9hdFeQ_bQhWWX6f';
const EDGE=URL_SUPA+'/functions/v1/apc66-sac-public';
let client, user, area='fleet', vehicles=[], bags=[], bagItems=[], vpspItems=[], checks=[], assignments=[], selectedBag='', selectedVpsp='';
const btn=(label,action,id='',cls='')=>`<button type="button" class="btn ${cls}" data-v5="${action}" data-id="${E(id)}">${E(label)}</button>`;
const formField=(label,name,value='',type='text',extra='')=>`<label>${E(label)}<input name="${name}" type="${type}" value="${E(value)}" ${extra}></label>`;
const itemRow=(it,kind)=>`<tr><td>${E(it.name)}</td><td>${E(it.location||'—')}</td><td>${E(it.expected_qty)}</td><td>${E(it.actual_qty)}</td><td>${E(it.expiry||'—')}</td><td>${btn('Modifier','editItem',it.id)} ${btn('Supprimer','deleteItem',it.id)}</td></tr>`;
function setArea(next){area=next;$('v5fleetarea').hidden=next!=='fleet';$('v5workspace').hidden=next==='fleet';for(const [id,key] of [['v5fleet','fleet'],['v5vpsp','vpsp'],['v5bags','bags']])$(id).classList.toggle('primary',key===next);if(next!=='fleet')render();}
function msg(t){const x=$('v5message');if(x)x.textContent=t;else alert(t)}
async function init(){
 if(!window.supabase){return}
 client=window.supabase.createClient(URL_SUPA,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
 for(const [id,key] of [['v5fleet','fleet'],['v5vpsp','vpsp'],['v5bags','bags']])$(id).onclick=()=>setArea(key);
 const hash=location.hash.match(/^#sac=([0-9a-f-]{36})$/i);
 if(hash){await showPublic(hash[1]);return}
 client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;if(user&&area!=='fleet')reload().catch(err=>msg(err.message));});
 const {data}=await client.auth.getSession();user=data.session?.user||null;
 if(user)await reload();
}
async function reload(){
 if(!user)return;
 const tables=['vehicles','apc_vpsp_items','apc_bags','apc_bag_items','apc_bag_checks','apc_bag_assignments'];
 const res=await Promise.all(tables.map(t=>client.from(t).select('*')));
 const err=res.find(x=>x.error);if(err)throw Error(err.error.message+' — exécutez le script 01_inventaires.sql si nécessaire.');
 [vehicles,vpspItems,bags,bagItems,checks,assignments]=res.map(x=>x.data||[]);
 render();
}
async function mutate(table,action,payload){
 let q=client.from(table);
 const r=action==='delete'?await q.delete().eq('id',payload):action==='insert'?await q.insert(payload):await q.update(payload.values).eq('id',payload.id);
 if(r.error)throw Error(r.error.message);await reload();
}
function render(){if(area==='fleet')return;
 const w=$('v5workspace');if(!w)return;
 let html='<h2>'+(area==='vpsp'?'Inventaire des VPSP':'Inventaire des sacs')+'</h2><p id="v5message" class="v5small">Les données sont enregistrées dans Supabase. Les QR codes des sacs ouvrent un accès public limité aux contrôles.</p>';
 if(area==='vpsp'){
 html+='<div class="v5row"><label>VPSP : <select id="v5vehicle">'+vehicles.map(v=>`<option value="${E(v.id)}" ${selectedVpsp===v.id?'selected':''}>${E(v.name)} (${E(v.plate||'')})</option>`).join('')+'</select></label>'+btn('Ajouter du matériel','addVpsp')+btn('Importer CSV','importVpsp')+btn('Exporter CSV','exportVpsp')+'</div>';
 const vid=selectedVpsp||vehicles[0]?.id;selectedVpsp=vid;
 html+=listItems(vpspItems.filter(x=>x.vehicle_id===vid));
 }else{
 html+='<div class="v5row">'+btn('Créer un sac','addBag')+'<label>Sac : <select id="v5bag">'+bags.map(b=>`<option value="${E(b.id)}" ${selectedBag===b.id?'selected':''}>${E(b.name)} — ${E(b.vehicle_id?(vehicles.find(v=>v.id===b.vehicle_id)?.name||'VPSP'):(b.location||'Local'))}</option>`).join('')+'</select></label></div>';
 const bag=bags.find(b=>b.id===(selectedBag||bags[0]?.id));if(bag){selectedBag=bag.id;
 html+='<div class="v5row">'+btn('Modifier / affecter le sac','editBag',bag.id)+btn('Ajouter du matériel','addBagItem')+btn('Importer CSV','importBag')+btn('Exporter CSV','exportBag')+btn('QR code du sac','qrBag',bag.id)+'</div>';
 html+=listItems(bagItems.filter(x=>x.bag_id===bag.id));
 html+='<h3>Derniers contrôles</h3>'+(checks.filter(x=>x.bag_id===bag.id).sort((a,b)=>b.checked_at.localeCompare(a.checked_at)).slice(0,12).map(x=>`<div class="record"><b>${x.check_type==='avant'?'Avant DPS':'Après DPS'}</b> — ${E(x.dps_name)} — ${E(x.rescuer_name)} <span class="v5small">${new Date(x.checked_at).toLocaleString('fr-FR')}</span><div>${E(x.observations||'')}</div></div>`).join('')||'<p>Aucun contrôle.</p>');
 html+='<h3>Historique des affectations</h3>'+(assignments.filter(x=>x.bag_id===bag.id).sort((a,b)=>b.changed_at.localeCompare(a.changed_at)).slice(0,10).map(x=>`<div class="record">${new Date(x.changed_at).toLocaleString('fr-FR')} — ${E(x.old_location||'VPSP')} → ${E(x.new_location||'VPSP')}</div>`).join('')||'<p>Aucun transfert.</p>');
 }else html+='<p>Crée un premier sac pour commencer.</p>';
 }
 w.innerHTML=html;
 $('v5vehicle')?.addEventListener('change',e=>{selectedVpsp=e.target.value;render()});
 $('v5bag')?.addEventListener('change',e=>{selectedBag=e.target.value;render()});
 w.querySelectorAll('[data-v5]').forEach(b=>b.onclick=()=>handle(b.dataset.v5,b.dataset.id));
}
function listItems(items){return '<div class="v5table"><table><thead><tr><th>Matériel</th><th>Emplacement</th><th>Attendu</th><th>Présent</th><th>Péremption</th><th>Actions</th></tr></thead><tbody>'+items.map(x=>itemRow(x)).join('')+'</tbody></table></div>'+(items.length?'':'<p class="v5notice">Aucun matériel enregistré. Ajoutez une ligne ou importez un CSV.</p>')}
function promptForm(title,fields,cb){
 const w=$('v5workspace');const old=w.querySelector('#v5editor');old?.remove();
 const box=document.createElement('div');box.id='v5editor';box.className='record';box.innerHTML=`<h3>${E(title)}</h3><form id="v5form"><div class="v5form">${fields}</div><div class="v5row"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" id="v5cancel">Annuler</button></div></form>`;
 w.prepend(box);box.querySelector('#v5cancel').onclick=()=>box.remove();box.querySelector('form').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target).entries());try{await cb(o);box.remove()}catch(err){alert(err.message)}};box.scrollIntoView({behavior:'smooth',block:'start'});
}
const int=n=>Math.max(0,Math.floor(Number(n)||0));
function itemFields(x={},isVpsp=false){return formField('Matériel *','name',x.name||'','text','required maxlength="160"')+(isVpsp?formField('Emplacement','location',x.location||''):'')+formField('Quantité attendue','expected_qty',x.expected_qty??1,'number','min="0" required')+formField('Quantité présente','actual_qty',x.actual_qty??1,'number','min="0" required')+formField('Péremption','expiry',x.expiry||'','date')+formField('Observations','notes',x.notes||'');}
function bagFields(b={}){return formField('Nom du sac *','name',b.name||'','text','required maxlength="160"')+formField('Type','bag_type',b.bag_type||'')+'<label>Affectation<select name="vehicle_id"><option value="">Local APC66</option>'+vehicles.map(v=>`<option value="${E(v.id)}" ${b.vehicle_id===v.id?'selected':''}>${E(v.name)}</option>`).join('')+'</select></label>'+formField('Emplacement au local','location',b.location||'Local APC66');}
async function handle(action,id){try{
 const bag=bags.find(b=>b.id===selectedBag);
 if(action==='addVpsp'||action==='addBagItem'||action==='editItem'){
  const vpsp=area==='vpsp',table=vpsp?'apc_vpsp_items':'apc_bag_items',items=vpsp?vpspItems:bagItems;
  const x=items.find(i=>i.id===id)||{};
  promptForm(x.id?'Modifier le matériel':'Ajouter du matériel',itemFields(x,vpsp),async o=>{
   const data={name:o.name.trim(),expected_qty:int(o.expected_qty),actual_qty:int(o.actual_qty),expiry:o.expiry||null,notes:o.notes||''};
   if(vpsp)data.location=o.location||'';
   if(x.id)await mutate(table,'update',{id:x.id,values:data});else await mutate(table,'insert',{...data,...(vpsp?{vehicle_id:selectedVpsp}:{bag_id:selectedBag})});
  });return;
 }
 if(action==='deleteItem'){
  if(!confirm('Supprimer cette ligne de matériel ?'))return;
  await mutate(area==='vpsp'?'apc_vpsp_items':'apc_bag_items','delete',id);return;
 }
 if(action==='addBag'||action==='editBag'){
  const b=bags.find(x=>x.id===id)||{};
  promptForm(b.id?'Modifier le sac':'Créer un sac',bagFields(b),async o=>{
   const data={name:o.name.trim(),bag_type:o.bag_type||'',vehicle_id:o.vehicle_id||null,location:o.vehicle_id?'':(o.location||'Local APC66')};
   if(b.id){await mutate('apc_bags','update',{id:b.id,values:data});if(b.vehicle_id!==data.vehicle_id||b.location!==data.location)await mutate('apc_bag_assignments','insert',{bag_id:b.id,old_vehicle_id:b.vehicle_id,new_vehicle_id:data.vehicle_id,old_location:b.vehicle_id?'VPSP':b.location,new_location:data.vehicle_id?'VPSP':data.location,actor_id:user.id})}
   else await mutate('apc_bags','insert',data);
  });return;
 }
 if(action==='qrBag'){
  const b=bags.find(x=>x.id===id);const url=new URL(location.href);url.hash='sac='+b.public_token;
  promptForm('QR code du sac',`<div style="grid-column:1/-1"><div id="v5qr" style="background:#fff;padding:12px;width:max-content"></div><p class="v5small">Ce lien permet un contrôle sans mot de passe. Ne diffusez le QR code qu'aux personnes concernées.</p><input readonly value="${E(url.href)}" style="width:100%"></div>`,async()=>{});
  const f=$('v5editor');f.querySelector('form').onsubmit=e=>{e.preventDefault();navigator.clipboard?.writeText(url.href).then(()=>alert('Lien copié')).catch(()=>prompt('Copier le lien',url.href))};f.querySelector('button[type=submit]').textContent='Copier le lien';
  if(window.QRCode)new QRCode(f.querySelector('#v5qr'),{text:url.href,width:220,height:220});else f.querySelector('#v5qr').textContent='Bibliothèque QR indisponible';return;
 }
 if(action.startsWith('import')){importCSV(action==='importVpsp'?'apc_vpsp_items':'apc_bag_items');return}
 if(action.startsWith('export')){exportCSV(action==='exportVpsp'?vpspItems.filter(x=>x.vehicle_id===selectedVpsp):bagItems.filter(x=>x.bag_id===selectedBag));return}
 }catch(err){alert('Action impossible : '+err.message)}}
function parseCSV(t){const first=t.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(first.length<2)throw Error('CSV vide');const sep=(first[0].match(/;/g)||[]).length>=(first[0].match(/,/g)||[]).length?';':',';
 function split(line){const a=[];let v='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(c===sep&&!q){a.push(v);v=''}else v+=c}a.push(v);return a}
 const cols=split(first.shift()).map(x=>x.trim().toLowerCase());return first.map(l=>Object.fromEntries(split(l).map((v,i)=>[cols[i],v.trim()])))}
function importCSV(table){const inp=document.createElement('input');inp.type='file';inp.accept='.csv,text/csv';inp.onchange=async()=>{if(!inp.files[0])return;try{const rows=parseCSV(await inp.files[0].text());if(rows.length>500)throw Error('Maximum 500 lignes par import');const data=rows.map(r=>({name:r.materiel||r.matériel||r.nom||r.name||'',expected_qty:int(r.quantite_attendue||r.quantité_attendue||r.expected_qty||1),actual_qty:int(r.quantite_presente||r.quantité_présente||r.actual_qty||1),expiry:r.peremption||r.péremption||r.expiry||null,notes:r.observations||r.notes||'',...(table==='apc_vpsp_items'?{vehicle_id:selectedVpsp,location:r.emplacement||''}:{bag_id:selectedBag})}));if(data.some(x=>!x.name||x.name.length>160))throw Error('Colonne materiel / nom manquante ou trop longue');if(!confirm('Importer '+data.length+' lignes ? Les lignes seront ajoutées, sans écraser les existantes.'))return;for(let i=0;i<data.length;i+=100){const {error}=await client.from(table).insert(data.slice(i,i+100));if(error)throw error}await reload();alert('Import terminé.')}catch(e){alert('Import impossible : '+e.message)}};inp.click()}
function exportCSV(rows){const keys=['name','location','expected_qty','actual_qty','expiry','notes'];const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv='\uFEFF'+keys.join(';')+'\n'+rows.map(r=>keys.map(k=>cell(r[k])).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='APC66-inventaire.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function showPublic(token){
 document.getElementById('loginPanel').hidden=true;document.getElementById('appContent').hidden=true;
 const main=document.querySelector('main');const section=document.createElement('section');section.className='panel';section.style.padding='20px';main.prepend(section);
 section.innerHTML='<h2>APC66 — Contrôle de sac</h2><p>Chargement de la fiche…</p>';
 try{
  const r=await fetch(EDGE+'?token='+encodeURIComponent(token));const data=await r.json();if(!r.ok)throw Error(data.error||'Fiche indisponible');
  const b=data.bag,items=data.items;
  section.innerHTML=`<h2>${E(b.name)}</h2><p>${E(b.bag_type||'Sac de secours')} — ${E(b.location||'Affecté à un VPSP')}</p><h3>Choisir un contrôle</h3><div class="v5row"><button class="btn primary" id="publicBefore">Contrôle avant DPS</button><button class="btn" id="publicAfter">Contrôle après DPS</button></div><div id="publicForm"></div>`;
  function form(type){const target=section.querySelector('#publicForm');target.innerHTML=`<h3>Contrôle ${type==='avant'?'avant':'après'} DPS</h3><form id="publicCheck"><div class="v5form">${formField('Nom du DPS *','dps','','text','required minlength="2" maxlength="160"')}${formField('Nom et prénom du secouriste *','rescuer','','text','required minlength="2" maxlength="160"')}</div><div class="v5table"><table><thead><tr><th>Matériel</th><th>Attendu</th><th>Présent</th><th>État</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td>${E(x.name)}</td><td>${E(x.expected_qty)}</td><td><input type="number" min="0" max="100000" name="qty_${i}" value="${E(x.actual_qty)}" required style="width:90px"></td><td><select name="state_${i}"><option value="conforme">Conforme</option><option value="manquant">Manquant</option><option value="perime">Périmé</option><option value="deteriore">Détérioré</option></select></td></tr>`).join('')}</tbody></table></div><div class="v5form">${formField('Observations','observations','','text','maxlength="1000"')}</div><button class="btn primary" type="submit">Valider le contrôle</button><p class="v5small">L'identité déclarée n'est pas vérifiée. Ce contrôle ne modifie pas directement le stock officiel.</p></form>`;
   target.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=ev.target;const fd=new FormData(f);const payload={token,type,dps_name:fd.get('dps').trim(),rescuer_name:fd.get('rescuer').trim(),observations:fd.get('observations'),results:items.map((x,i)=>({item_id:x.id,actual_qty:Number(fd.get('qty_'+i)),state:fd.get('state_'+i)}))};if(!confirm('Enregistrer ce contrôle '+type+' DPS ?'))return;const button=f.querySelector('button[type=submit]');button.disabled=true;try{const res=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const obj=await res.json();if(!res.ok)throw Error(obj.error||'Enregistrement impossible');target.innerHTML='<p class="v5notice">Contrôle enregistré. Merci.</p>'}catch(err){alert(err.message);button.disabled=false}};
  }
  section.querySelector('#publicBefore').onclick=()=>form('avant');section.querySelector('#publicAfter').onclick=()=>form('apres');
 }catch(err){section.innerHTML='<h2>Fiche du sac indisponible</h2><p>'+E(err.message)+'</p><p class="v5small">Le module public doit être déployé dans Supabase avant de fonctionner.</p>'}
}
window.addEventListener('DOMContentLoaded',()=>init().catch(e=>console.error('Inventaires APC66',e)));
})();
