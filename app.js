/* Oddball — daily odd one out. Plain JS, no dependencies. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const TEST = LOCAL && params.get('test') === '1';   // test hooks only work on a local server
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ROUNDS = 10;

// ---- tiny SHA-256 (works without a secure context) ----
function sha256(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes=new TextEncoder().encode(str); const l=bytes.length;
  const n=((l+9+63)>>6)<<6; const m=new Uint8Array(n); m.set(bytes); m[l]=0x80;
  const dv=new DataView(m.buffer); dv.setUint32(n-4,l*8); dv.setUint32(n-8,Math.floor(l/0x20000000));
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w=new Uint32Array(64); const r=(x,k)=>(x>>>k)|(x<<(32-k));
  for(let o=0;o<n;o+=64){
    for(let i=0;i<16;i++) w[i]=dv.getUint32(o+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))|0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0;const t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    h=[h[0]+a,h[1]+b,h[2]+c,h[3]+d,h[4]+e,h[5]+f,h[6]+g,h[7]+hh].map(x=>x|0);
  }
  const out=new Uint8Array(32); const od=new DataView(out.buffer); h.forEach((x,i)=>od.setUint32(i*4,x>>>0)); return out;
}
const hex = b => Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
function decode(salt,id,x){
  const enc=Uint8Array.from(atob(x),c=>c.charCodeAt(0)); let key=[]; let i=0;
  while(key.length<enc.length){ key=key.concat(Array.from(sha256(`${salt}|${id}|${i}`))); i++; }
  return new TextDecoder().decode(enc.map((b,j)=>b^key[j]));
}
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---- dates (Europe/London) ----
function londonIso(d=new Date()){
  try{ const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const g=t=>p.find(x=>x.type===t).value; return `${g('year')}-${g('month')}-${g('day')}`; }
  catch(e){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
}
const todayIso = () => (TEST && params.get('today')) ? params.get('today') : londonIso();
const nice = s => { const [y,m,d]=s.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d)); return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m-1]}`; };
const dayNo = (d,epoch) => Math.round((Date.parse(d)-Date.parse(epoch))/864e5)+1;

// ---- state ----
let IDX, P, SEC=[], S, avail=[];
const skey = d => (TEST?'obtest-':'ob-')+d;   // test mode never touches real saves
const load = d => { try{ return JSON.parse(localStorage.getItem(skey(d))||'null'); }catch(e){ return null; } };
function save(){ try{ localStorage.setItem(skey(P.date), JSON.stringify(S)); }catch(e){} }
const score = () => S.picks.reduce((n,p,i)=>n+(p!==null&&p===SEC[i].o?1:0),0);
const answeredCount = () => S.picks.filter(p=>p!==null).length;

function show(id){ ['#game','#results','#empty'].forEach(v=>$(v).hidden = v!==id); window.scrollTo(0,0); }

async function boot(){
  bind();
  IDX = await (await fetch('puzzles/index.json',{cache:'no-cache'})).json();
  const today = todayIso(); bootDay=today;
  avail = IDX.dates.filter(d=>d<=today);
  const want = params.get('date') || today;
  window.__ob = {today, avail, ready:false};
  if(want>today || !IDX.dates.includes(want)){
    $('#puzzleTitle').textContent = nice(want<=today?want:today);
    $('#emptyTitle').textContent = want===today ? 'No Oddball today' : 'No Oddball for that day';
    $('#emptyText').textContent = want===today
      ? (avail.length ? "There's no puzzle for today yet. New puzzles appear each morning, and past days are in the archive." : "The first puzzle hasn't arrived yet. Check back soon.")
      : (want>today ? "That puzzle isn't out yet. No peeking!" : `There's no puzzle for ${nice(want)}. Past puzzles are in the archive.`);
    $('#emptyArchive').hidden = !avail.length;
    show('#empty'); window.__ob.ready=true; window.__ob.empty=true; return;
  }
  P = await (await fetch(`puzzles/${want}.json`,{cache:'no-cache'})).json();
  SEC = P.rounds.map(r=>JSON.parse(decode(P.salt,r.id,r.x)));
  $('#puzzleTitle').innerHTML = `No. ${P.no}<br>${nice(P.date)}`;
  if(P.date!==today && avail.includes(today)){ $('#todayBar').hidden=false; document.body.classList.add('archiveday'); }
  document.title = `Oddball No. ${P.no}`;
  const raw=load(P.date); S = restore(raw);
  if(JSON.stringify(raw)!==JSON.stringify(S)) save();
  if(S.done) showResults(); else renderRound();
  try{ if(sessionStorage.getItem('ob-newday')){ sessionStorage.removeItem('ob-newday'); if(avail.length>1) toast("A new Oddball is out. Yesterday's is in the archive.",4000); } }catch(e){}
  window.__ob.date=P.date; window.__ob.ready=true; window.__ob.state=()=>JSON.parse(JSON.stringify(S));
}

// A save keeps each round's content fingerprint; a pick only counts if that round is unchanged.
function restore(st){
  const fp=P.rounds.map(r=>r.f), n=P.rounds.length;
  const fresh={picks:Array(n).fill(null), idx:0, done:false, fp};
  if(!st || !Array.isArray(st.picks) || st.picks.length!==n || !Array.isArray(st.fp)) return fresh;
  st=JSON.parse(JSON.stringify(st));
  let changed=false;
  st.picks=st.picks.map((p,i)=>{ const ok=st.fp[i]===fp[i] && (p===null || (Number.isInteger(p)&&p>=0&&p<4)); if(!ok&&p!==null) changed=true; return ok?p:null; });
  st.fp=fp;
  if(!Number.isInteger(st.idx) || st.idx<0 || st.idx>=n) st.idx=0;
  if(changed || (st.done && st.picks.includes(null))){ st.done=false; delete st.score; const j=st.picks.indexOf(null); st.idx=j<0?n-1:j; }
  if(!st.done && st.picks.every(p=>p!==null) && st.idx===n-1 && st.picks[n-1]!==null){ /* answered last round, Next not pressed */ }
  return st;
}
function wordSize(t){ const n=t.length, longest=Math.max(...t.split(' ').map(w=>w.length));
  if(n<=7 && longest<=7) return 's1'; if(n<=11 && longest<=9) return 's2'; if(n<=18 && longest<=10) return 's3'; return 's4'; }

function renderDots(){
  const D=$('#dots'); D.innerHTML='';
  for(let i=0;i<P.rounds.length;i++){ const e=document.createElement('i'); const p=S.picks[i];
    if(p!==null) e.className = p===SEC[i].o ? 'ok' : 'no'; else if(i===S.idx) e.className='cur'; D.appendChild(e); }
  $('#scoreLabel').textContent = `${score()} / ${answeredCount()}`;
  $('#roundLabel').textContent = `Round ${S.idx+1} of ${P.rounds.length}`;
}

function renderRound(){
  show('#game');
  const i=S.idx, r=P.rounds[i], sec=SEC[i];
  const G=$('#grid'); G.innerHTML=''; G.classList.remove('answered');
  // one text size per round, so no word stands out just by being longer or shorter
  const ws=r.tiles.filter(t=>!t.img).map(t=>wordSize(t.text)).sort().pop();
  r.tiles.forEach((t,k)=>{
    const b=document.createElement('button'); b.className='tile '+(t.img?'pic':'word'); b.dataset.k=k;
    if(t.img){ b.innerHTML=`<img src="${esc(t.img)}" alt="Picture ${k+1}" width="480" height="480" decoding="async" draggable="false"><span class="cap"></span><span class="tag"></span>`; b.setAttribute('aria-label',`Picture ${k+1}`); }
    else { b.innerHTML=`<span class="w ${ws}">${esc(t.text)}</span><span class="tag"></span>`; }
    b.addEventListener('click',()=>{ if(b.classList.contains('failed')&&S.picks[i]===null&&!b.dataset.manual){ b.dataset.manual='1'; retryImg(b,t.img,true); return; } pick(k); });
    if(t.img){ const im=b.querySelector('img'); im.addEventListener('error',()=>retryImg(b,t.img,false)); im.addEventListener('load',()=>b.classList.remove('failed')); }
    G.appendChild(b);
  });
  $('#prompt').textContent = 'Which is the odd one out?';
  renderDots();
  if(S.picks[i]!==null) reveal(false);
  else { $('#fbText').innerHTML='<span class="hint">Tap the tile that doesn\'t belong.</span>'; $('#nextBtn').disabled=true; }
  preload(i+1);
}
// preload every remaining image of the day, so a dropped connection mid-game doesn't break later rounds
const preloaded={};
function preload(from){ for(let i=from;i<P.rounds.length;i++) P.rounds[i].tiles.forEach(t=>{ if(t.img&&!preloaded[t.img]){ const im=new Image(); im.src=t.img; preloaded[t.img]=im; } }); }
function retryImg(b,src,manual){
  const im=b.querySelector('img'); const tries=Number(b.dataset.tries||0);
  if(!manual && tries>=1){ b.classList.add('failed'); return; }
  b.dataset.tries=tries+1; b.classList.remove('failed'); im.src=src+'?r='+Date.now();
}

function pick(k){
  const i=S.idx; if(S.picks[i]!==null) return;
  S.picks[i]=k; save(); reveal(true);
}
function reveal(fresh){
  const i=S.idx, sec=SEC[i], k=S.picks[i], ok=k===sec.o;
  const G=$('#grid'); G.classList.add('answered');
  G.querySelectorAll('.tile').forEach((b,j)=>{
    b.disabled=true;
    if(sec.l){ const c=b.querySelector('.cap'); if(c) c.textContent=sec.l[j]; b.setAttribute('aria-label',sec.l[j]); }
    if(j===sec.o){ b.classList.add('isodd'); b.querySelector('.tag').textContent='Odd one out'; }
    if(j===k){ b.classList.add('picked'); if(!ok){ b.classList.add('wrong'); b.querySelector('.tag').textContent='Your pick'; } }
  });
  const oddName = sec.l ? sec.l[sec.o] : P.rounds[i].tiles[sec.o].text;
  $('#fbText').innerHTML = ok ? `<b class="ok">Correct!</b><span>${esc(oddName)} is the odd one out.</span>`
                              : `<b class="no">Not this time</b><span>The odd one out was ${esc(oddName)}.</span>`;
  const last = S.picks.every(p=>p!==null);
  const nb=$('#nextBtn'); nb.textContent = last ? 'See results' : 'Next round'; nb.disabled=false;
  renderDots();
  if(fresh && navigator.vibrate) try{ navigator.vibrate(ok?15:[20,40,20]); }catch(e){}
}
function next(){
  const i=S.idx; if(S.picks[i]===null) return;
  let j=S.picks.indexOf(null,i+1); if(j<0) j=S.picks.indexOf(null);
  if(j<0){ S.done=true; S.score=score(); save(); showResults(); return; }
  S.idx=j; save(); renderRound();
}

const VERDICTS=['Tough day!','Tough day!','Tough day!','Not bad','Not bad','Good effort','Good effort','Sharp eye','Excellent','Superb','Perfect!'];
function showResults(){
  show('#results');
  const sc=score(), n=P.rounds.length;
  $('#bigScore').innerHTML=`${sc}<small> / ${n}</small>`;
  $('#verdict').textContent=VERDICTS[Math.round(sc*10/n)];
  const em=S.picks.map((p,i)=>p===SEC[i].o?'🟩':'🟥').join('');
  $('#emojiRow').textContent=em;
  const share=`Oddball No. ${P.no} · ${nice(P.date)}\n${sc}/${n}\n${em}`;
  $('#shareBtn').onclick=async()=>{ try{ if(navigator.share) await navigator.share({text:share}); else { await navigator.clipboard.writeText(share); toast('Copied'); } }catch(e){} };
  const L=$('#explainList'); L.innerHTML='';
  P.rounds.forEach((r,i)=>{
    const sec=SEC[i], p=S.picks[i], ok=p===sec.o;
    const names = sec.l ? sec.l : r.tiles.map(t=>t.text);
    const odd = names[sec.o], others = names.filter((_,j)=>j!==sec.o);
    const thumb = r.tiles[sec.o].img ? `<img class="thumb" src="${esc(r.tiles[sec.o].img)}" alt="" loading="lazy">` : '';
    const li=document.createElement('li');
    li.innerHTML=`<span class="num ${ok?'ok':''}">${i+1}</span>${thumb}<div class="body"><div class="conn">${esc(sec.c)}</div>
      <div class="items">${esc(others.join(', '))}</div>
      <div class="why"><b>Odd one out: ${esc(odd)}.</b> ${esc(sec.w)}</div>${ok||p===null?'':`<div class="yours">You picked ${esc(names[p])}.</div>`}</div>`;
    L.appendChild(li);
  });
}

// ---- sheets ----
function open(id){ closeAll(); $(id).hidden=false; document.documentElement.classList.add('sheet-open'); }
function closeAll(){ document.querySelectorAll('.sheet').forEach(s=>s.hidden=true); document.documentElement.classList.remove('sheet-open'); }
let toastT; function toast(t,ms=1800){ const el=$('#toast'); el.textContent=t; el.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>el.hidden=true,ms); }
function showArchive(){
  const L=$('#archiveList'); L.innerHTML='';
  if(!avail.length) L.innerHTML='<p style="margin:12px">No puzzles yet.</p>';
  [...avail].reverse().forEach(d=>{ const b=document.createElement('button'); b.className='day'; b.dataset.date=d;
    const st=load(d); let tag='';
    if(st && st.done){ tag='Done'; }
    else if(st && st.picks && st.picks.some(x=>x!==null)) tag='In progress';
    if(st && st.done && st.score!==undefined) tag=`${st.score} / 10`;
    b.innerHTML=`<span class="dn">Oddball No. ${dayNo(d,IDX.epoch)} · ${nice(d)}</span> <span>${tag}</span>`;
    b.onclick=()=>goDate(d); L.appendChild(b); });
  open('#archive');
}
function goDate(d){ const u=new URL(location.href); if(d===todayIso()) u.searchParams.delete('date'); else u.searchParams.set('date',d); location.href=u.toString(); }
// 12: if the app is resumed on a new London day (and showing "today"), reload to get the new puzzle
let bootDay=null;
function checkNewDay(){ if(bootDay && !params.get('date') && todayIso()!==bootDay){ try{ sessionStorage.setItem('ob-newday','1'); }catch(e){} location.reload(); } }
function bind(){
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) checkNewDay(); });
  window.addEventListener('pageshow',checkNewDay); window.addEventListener('focus',checkNewDay);
  setInterval(checkNewDay,60000);
  $('#todayBtn').onclick=()=>goDate(todayIso());
  $('#nextBtn').addEventListener('click',next);
  $('#moreBtn').onclick=()=>open('#moreMenu');
  $('#archiveBtn').onclick=showArchive; $('#archiveBtn2').onclick=showArchive; $('#emptyArchive').onclick=showArchive;
  $('#helpBtn').onclick=()=>open('#help');
  $('#creditsBtn').onclick=()=>{ location.href='credits.html'; };
  document.querySelectorAll('.sheet').forEach(s=>s.addEventListener('click',ev=>{ if(ev.target===s||ev.target.closest('.cancel')) closeAll(); }));
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape') closeAll();
    if(document.querySelectorAll('.sheet:not([hidden])').length || $('#game').hidden) return;
    if(ev.target && ev.target.closest && ev.target.closest('button')) return;
    if(['1','2','3','4'].includes(ev.key)){ pick(Number(ev.key)-1); }
    else if(ev.key==='Enter' && !$('#nextBtn').disabled){ next(); ev.preventDefault(); }
  });
}
boot().catch(err=>{ console.error(err); $('#emptyArchive').hidden=!avail.length; $('#emptyTitle').textContent='Something went wrong'; $('#emptyText').textContent='Could not load the puzzle. Please try again.'; show('#empty'); });
})();
