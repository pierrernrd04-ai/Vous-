/* Après 13h — modules supplémentaires : générateurs de quiz, jeux d'arcade, réflexes, logique, zen.
   Chargé après le script principal : utilise $, esc, rnd, shuffle, norm, addPts, markBlk, winScreen,
   confetti, later, cleanup, S, save, GAMES, GAMEFN, GSEC, CATS, DEFIS, RIDDLES, MYST, VF, QUIZ, WORDS. */
"use strict";
(function(){
const W=window;
/* ---------- fusion du contenu ---------- */
if(W.MORE_RIDDLES)RIDDLES.push(...W.MORE_RIDDLES.filter(r=>r&&r[0]&&r[1]&&r[1].length));
if(W.MORE_MYST)MYST.push(...W.MORE_MYST);
if(W.MORE_VF)VF.push(...W.MORE_VF);
if(W.QUIZ_MORE)QUIZ.push(...W.QUIZ_MORE);
if(W.MORE_WORDS){const have=new Set(WORDS);W.MORE_WORDS.forEach(w=>{if(/^[A-Z]{4,10}$/.test(w)&&!have.has(w)){WORDS.push(w);have.add(w)}})}
Object.assign(CATS,{creer:"Créer",apprendre:"Apprendre",soin:"Prendre soin de moi"});
if(W.MORE_DEFIS){const ids=new Set(DEFIS.map(d=>d.id));W.MORE_DEFIS.forEach(d=>{if(d&&!ids.has(d.id)&&CATS[d.c]){DEFIS.push(d);ids.add(d.id)}})}
const g0=GAMES.find(g=>g.id==="enigmes");if(g0)g0.d=RIDDLES.length+" devinettes, charades et pièges de logique.";
const g1=GAMES.find(g=>g.id==="mystere");if(g1)g1.d=MYST.length+" situations bizarres, casse-têtes et combles.";
const g2=GAMES.find(g=>g.id==="vraifaux");if(g2)g2.d=VF.length+" faits étonnants. Démêle le vrai du faux.";
const g3=GAMES.find(g=>g.id==="quiz");if(g3)g3.d=QUIZ.length+" questions de culture générale.";
Object.assign(GSEC,{culture:"Quiz par thème",langues:"Mots et langues",calc:"Calcul et chiffres",arcade:"Arcade",reflexe:"Mémoire et réflexes",zen:"Zen et créatif"});
GAMES.forEach(g=>{if(g.id==="quiz"||g.id==="vraifaux")g.s="culture";if(["pendu","anagrammes"].includes(g.id))g.s="langues";if(g.id==="calcul"||g.id==="suites")g.s="calc";if(["couleurs","memory","bulles"].includes(g.id))g.s="reflexe";if(g.id==="c4")g.s="arcade"});

/* ---------- styles des nouveaux jeux ---------- */
const st=document.createElement("style");st.textContent=`
.bigq{font-size:4.2rem;text-align:center;line-height:1.1;padding:6px 0}
.bigq.txt{font-family:var(--f-display);font-weight:800;font-size:2.2rem;letter-spacing:-.02em}
.cv{display:block;width:100%;max-width:440px;margin:0 auto;border-radius:16px;background:var(--surface2);border:1px solid var(--line);touch-action:none}
.dpad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,52px);gap:8px;justify-content:center}
.dpad button{border-radius:14px;background:var(--surface);border:1.5px solid var(--line);font-size:1.3rem;font-weight:700;transition:transform .1s}
.dpad button:active{transform:scale(.9);background:var(--accent-soft)}
.dpad .u{grid-column:2}.dpad .l{grid-column:1;grid-row:2}.dpad .d{grid-column:2;grid-row:2}.dpad .r{grid-column:3;grid-row:2}
.ws{display:grid;gap:2px;width:100%;max-width:420px;margin:0 auto;user-select:none;-webkit-user-select:none}
.ws button{aspect-ratio:1;border-radius:6px;font-family:var(--f-mono);font-weight:700;font-size:clamp(.8rem,3.6vw,1.05rem);background:var(--surface);border:1px solid var(--line);padding:0;transition:background .2s,color .2s}
.ws button.a{background:var(--spark);color:var(--spark-ink);border-color:var(--spark)}
.ws button.f{background:var(--accent-soft);color:var(--accent)}
.wl{display:flex;flex-wrap:wrap;gap:6px 12px;font-family:var(--f-mono);font-weight:700;font-size:.9rem}
.wl s{color:var(--muted)}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:320px;margin:0 auto;width:100%}
.grid3 button{aspect-ratio:1;border-radius:16px;background:var(--surface);border:1.5px solid var(--line);font-family:var(--f-display);font-weight:800;font-size:2.6rem}
.grid3 button .x{color:var(--spark)}.grid3 button .o{color:var(--accent)}
.grid3 button span{display:inline-block;animation:pop .35s var(--spring) both}
.sticks{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:90px;padding:10px}
.sticks i{width:10px;height:72px;border-radius:5px;background:linear-gradient(var(--spark) 0 14px,var(--p3) 14px);animation:pop .3s var(--spring) both}
.sticks i.gone{animation:burst .3s forwards}
.nums{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.nums button{min-width:64px;min-height:56px;padding:0 12px;border-radius:14px;background:var(--surface);border:1.5px solid var(--line);font-family:var(--f-mono);font-weight:700;font-size:1.3rem;animation:pop .3s var(--spring) both}
.nums button.sel{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ops{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ops button{min-height:52px;border-radius:14px;background:var(--surface2);border:1.5px solid var(--line);font-family:var(--f-mono);font-weight:700;font-size:1.4rem}
.ops button.sel{background:var(--spark);color:var(--spark-ink);border-color:var(--spark)}
.target{font-family:var(--f-display);font-weight:800;font-size:3rem;text-align:center;color:var(--spark)}
.sch{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:400px;margin:0 auto;width:100%}
.sch button{aspect-ratio:1;border-radius:10px;background:var(--surface);border:1.5px solid var(--line);font-family:var(--f-mono);font-weight:700;font-size:1.3rem;transition:background .2s,color .2s}
.sch button.ok{background:var(--accent-soft);color:var(--muted)}
.odd{display:grid;gap:6px;max-width:400px;margin:0 auto;width:100%}
.odd button{aspect-ratio:1;border-radius:10px;animation:pop .25s var(--spring) both}
.stroop{font-family:var(--f-display);font-weight:800;font-size:3.4rem;text-align:center;padding:16px 0;letter-spacing:-.02em}
.cbtn{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cbtn button{min-height:58px;border-radius:14px;font-weight:800;font-size:1.05rem;background:var(--surface);border:1.5px solid var(--line)}
.digits{font-family:var(--f-mono);font-weight:700;font-size:3.4rem;text-align:center;letter-spacing:.15em;min-height:80px}
.pos{display:grid;gap:8px;max-width:360px;margin:0 auto;width:100%}
.pos button{aspect-ratio:1;border-radius:12px;background:var(--surface);border:1.5px solid var(--line);transition:background .2s}
.pos button.lit{background:var(--p4);border-color:var(--p4)}
.pos button.ok{background:var(--accent);border-color:var(--accent)}
.pos button.ko{background:var(--bad)}
.chrono{font-family:var(--f-mono);font-weight:700;font-size:3.6rem;text-align:center;font-variant-numeric:tabular-nums}
.react{display:grid;place-items:center;height:min(50vh,380px);border-radius:20px;font-family:var(--f-display);font-weight:800;font-size:1.8rem;text-align:center;padding:16px;user-select:none;transition:background .15s}
.react.wait{background:var(--spark);color:var(--spark-ink)}.react.go{background:var(--ok);color:var(--surface)}.react.idle{background:var(--surface2);color:var(--ink);border:1px solid var(--line)}
.tk{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;max-width:380px;margin:0 auto;width:100%}
.tk button{aspect-ratio:1;border-radius:10px;background:var(--surface);border:1.5px solid var(--line);font-family:var(--f-mono);font-weight:800;font-size:1.4rem;transition:background .2s}
.tk button.v0{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.tk button.v1{background:var(--p3);color:var(--ink);border-color:var(--p3)}
.tk button.g{box-shadow:inset 0 0 0 3px var(--ink)}
.tk button.e{outline:3px solid var(--bad);outline-offset:-3px}
.ng{display:grid;gap:2px;width:100%;max-width:440px;margin:0 auto;user-select:none;-webkit-user-select:none}
.ng .cl{font-family:var(--f-mono);font-size:.68rem;color:var(--muted);display:flex;align-items:flex-end;justify-content:center;line-height:1.05;text-align:center;padding:2px}
.ng .rl{font-family:var(--f-mono);font-size:.72rem;color:var(--muted);display:flex;align-items:center;justify-content:flex-end;padding-right:4px;white-space:nowrap}
.ng .cl.ok,.ng .rl.ok{color:var(--ok);font-weight:700}
.ng button{aspect-ratio:1;border-radius:4px;background:var(--surface);border:1px solid var(--line);padding:0;font-size:.8rem;color:var(--muted)}
.ng button.on{background:var(--ink);border-color:var(--ink)}
.sea{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-width:400px;margin:0 auto;width:100%}
.sea button{aspect-ratio:1;border-radius:8px;background:color-mix(in srgb,var(--p4) 22%,var(--surface));border:1px solid var(--line);font-size:1.1rem;padding:0}
.sea button.m{background:var(--surface2);color:var(--muted)}
.sea button.h{background:var(--spark);color:var(--spark-ink);animation:bump .4s var(--spring)}
.sea button.s{background:var(--bad);color:var(--surface)}
.palette{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.palette button{width:36px;height:36px;border-radius:50%;border:3px solid var(--surface);box-shadow:0 0 0 1.5px var(--line)}
.palette button.sel{box-shadow:0 0 0 3px var(--ink)}
.pfc{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pfc button{min-height:84px;border-radius:18px;background:var(--surface);border:1.5px solid var(--line);font-size:2.6rem;transition:transform .15s}
.pfc button:active{transform:scale(.9)}
.duel{display:flex;justify-content:center;gap:30px;font-size:4rem;min-height:90px}
.duel span{animation:pop .4s var(--spring) both}
.bac{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}
.bac label{font-size:.85rem;font-weight:700;color:var(--muted)}
.letter{font-family:var(--f-display);font-weight:800;font-size:4rem;text-align:center;color:var(--accent);line-height:1}
.pbar{height:8px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);overflow:hidden}
.pbar i{display:block;height:100%;background:var(--accent);width:0;transition:width 1s linear}
.journal{width:100%;min-height:180px;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);font:inherit;color:var(--ink);resize:vertical}
.gfilter{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);padding-block:6px}
`;document.head.appendChild(st);

/* ---------- outils ---------- */
const pick=a=>a[rnd(a.length)];
function wr(pool,a,k){k=k||3;const out=[],seen=new Set([String(a)]);for(const v of shuffle(pool)){const s=String(v);if(!seen.has(s)){seen.add(s);out.push(v);if(out.length===k)break}}return out}
const flag=iso=>iso.toUpperCase().replace(/./g,c=>String.fromCodePoint(127397+c.charCodeAt(0)));
const has=(a,n)=>Array.isArray(a)&&a.length>=(n||6);
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const eq=(a,b)=>norm(a)===norm(b);
function bump(id){const e=$(id);if(e){e.classList.remove("bump");void e.offsetWidth;e.classList.add("bump")}}

/* ---------- moteur QCM ---------- */
function qcm(el,o){const n=o.n||10,pts=o.pts||3;
  const play=()=>{let i=0,good=0;const seen=new Set();
    const show=()=>{let q,t=0;do{q=o.gen();t++}while(q&&seen.has(q.q+(q.big||""))&&t<25);if(!q){end();return}seen.add(q.q+(q.big||""));
      const opts=shuffle([q.a,...q.w]);
      el.innerHTML=`<div class="hud"><span>Question <b>${i+1}</b>/${n}</span><span>Bonnes <b id="qg">${good}</b></span></div>${q.big?`<div class="bigq pop${q.bigTxt?" txt":""}">${esc(q.big)}</div>`:""}<p class="riddle pop">${esc(q.q)}</p><div class="opts">${opts.map((v,k)=>`<button class="opt" style="animation-delay:${80+k*60}ms">${esc(v)}</button>`).join("")}</div><div id="qx"></div>`;
      el.querySelectorAll(".opt").forEach((b,k)=>b.onclick=()=>{const ok=String(opts[k])===String(q.a);if(ok){good++;bump("#qg")}
        el.querySelectorAll(".opt").forEach((x,j)=>{x.disabled=true;if(String(opts[j])===String(q.a))x.classList.add("right")});if(!ok)b.classList.add("wrong");
        if(q.x){$("#qx").innerHTML=`<div class="fb ${ok?"ok":"info"}">${esc(q.x)}</div><button class="btn soft block" id="qn" style="margin-top:10px">${i<n-1?"Suivante":"Voir le score"}</button>`;$("#qn").onclick=nx}
        else later(nx,ok?850:1600)})};
    const nx=()=>{i++;i<n?show():end()};
    const end=()=>{markBlk();if(good)addPts(good*pts,o.label);winScreen(el,{medal:good+"/"+n,title:good>=n*.8?"Excellent":good>=n/2?"Bien joué":"À retenter",text:"Les questions sont tirées au hasard à chaque partie.",again:"Nouvelle partie",onAgain:play})};
    show()};play()}

/* ---------- moteur réponse tapée ---------- */
function typed(el,o){const n=o.n||10,pts=o.pts||4;
  const play=()=>{let i=0,good=0;
    const show=()=>{const q=o.gen();let tries=0,done=false;
      el.innerHTML=`<div class="hud"><span>Question <b>${i+1}</b>/${n}</span><span>Bonnes <b id="tg">${good}</b></span></div>${q.big?`<div class="bigq txt pop">${esc(q.big)}</div>`:""}<p class="riddle pop">${esc(q.q)}</p>
      <form id="tf" class="stack"><input class="field mono" id="ti" autocomplete="off" autocapitalize="off" ${q.num?'inputmode="decimal"':""} placeholder="${esc(q.ph||"Ta réponse")}" style="text-align:center;font-size:1.4rem"><div class="row"><button class="btn">Valider</button><button type="button" class="btn ghost" id="ts">Solution</button></div></form><div id="tfb"></div>`;
      const fin=(ok)=>{done=true;if(ok){good++;bump("#tg")}$("#tfb").innerHTML+=`<button class="btn soft block" id="tn" style="margin-top:10px">${i<n-1?"Suivante":"Voir le score"}</button>`;$("#tn").onclick=()=>{i++;i<n?show():end()};$("#tn").focus()};
      $("#tf").onsubmit=e=>{e.preventDefault();if(done)return;const v=$("#ti").value.trim();if(!v)return;
        if(o.check?o.check(v,q):(q.num?Math.abs(parseFloat(v.replace(/\s/g,"").replace(",","."))-q.a)<0.006:[q.a,...(q.alt||[])].some(a=>eq(a,v)))){$("#tfb").innerHTML=`<div class="fb ok">Exact${q.x?" : "+esc(q.x):"."}</div>`;fin(true)}
        else{tries++;const f=$("#ti");f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake");$("#tfb").innerHTML=`<div class="fb bad">Non.${tries>=2&&q.hint?" Indice : "+esc(q.hint):" Réessaie."}</div>`}};
      $("#ts").onclick=()=>{if(done)return;$("#tfb").innerHTML=`<div class="fb info">Réponse : <b>${esc(q.show||q.a)}</b>${q.x?". "+esc(q.x):""}</div>`;fin(false)}};
    const end=()=>{markBlk();if(good)addPts(good*pts,o.label);winScreen(el,{medal:good+"/"+n,title:good>=n*.8?"Excellent":good>=n/2?"Bien joué":"À retenter",text:"Nouvelles questions à chaque partie.",again:"Nouvelle partie",onAgain:play})};
    show()};play()}

const MOD=[];
const add=(m)=>{MOD.push(m)};

/* ================= QUIZ PAR THÈME ================= */
if(W.QUIZ_THEMES){const glyph={sport:"⚽",cinema:"🎬",musique:"♫",sciences:"⚗",histoire:"⌛",france:"FR",monde:"◍",cuisine:"🍳",nature:"🌿",espace:"☄",art:"✎",techno:"⚙"};
  Object.entries(W.QUIZ_THEMES).forEach(([k,v])=>{if(!v||!has(v.items,8))return;
    add({id:"q-"+k,s:"culture",g:glyph[k]||"Q",t:v.t,d:v.items.length+" questions. 10 tirées au hasard à chaque partie.",dur:"5 min",
      run:el=>{const order=shuffle(v.items);let p=0;qcm(el,{label:"Quiz "+v.t,gen:()=>{const it=order[p++%order.length];return{q:it[0],a:it[1][0],w:it[1].slice(1)}}})}})})}

/* ================= GÉOGRAPHIE ================= */
const CT=(W.COUNTRIES||[]).filter(c=>c&&c.length>=5);
if(has(CT,20)){
  add({id:"capitales",s:"culture",g:"★",t:"Capitales du monde",d:CT.length+" pays, dans les deux sens.",dur:"5 min",run:el=>qcm(el,{label:"Capitales",gen:()=>{const c=pick(CT);const same=CT.filter(x=>x[3]===c[3]);
    return Math.random()<.6?{q:"Quelle est la capitale : "+c[1]+" ?",a:c[2],w:wr((same.length>4?same:CT).map(x=>x[2]),c[2])}:{q:c[2]+" est la capitale de quel pays ?",a:c[1],w:wr((same.length>4?same:CT).map(x=>x[1]),c[1])}}})});
  add({id:"drapeaux",s:"culture",g:"⚑",t:"Drapeaux",d:"Reconnais le pays à son drapeau.",dur:"5 min",run:el=>qcm(el,{label:"Drapeaux",gen:()=>{const c=pick(CT);const same=CT.filter(x=>x[3]===c[3]);return{big:flag(c[0]),q:"À quel pays appartient ce drapeau ?",a:c[1],w:wr((same.length>4?same:CT).map(x=>x[1]),c[1])}}})});
  add({id:"continents",s:"culture",g:"◐",t:"Pays et continents",d:"Sur quel continent se trouve ce pays ?",dur:"3 min",run:el=>qcm(el,{label:"Continents",gen:()=>{const c=pick(CT);return{q:"Sur quel continent se trouve : "+c[1]+" ?",a:c[3],w:wr(["Europe","Afrique","Asie","Amérique du Nord","Amérique du Sud","Océanie"],c[3])}}})});
  add({id:"monnaies",s:"culture",g:"¤",t:"Monnaies du monde",d:"Quelle monnaie utilise-t-on dans ce pays ?",dur:"5 min",run:el=>qcm(el,{label:"Monnaies",gen:()=>{const c=pick(CT);return{q:"Quelle est la monnaie : "+c[1]+" ?",a:cap(c[4]),w:wr([...new Set(CT.map(x=>cap(x[4])))],cap(c[4]))}}})});
}
const DP=(W.DEPTS||[]).filter(d=>d&&d.length>=3);
if(has(DP,50)){
  add({id:"departements",s:"culture",g:"38",t:"Départements",d:"Numéros et noms des "+DP.length+" départements.",dur:"5 min",run:el=>qcm(el,{label:"Départements",gen:()=>{const d=pick(DP);return Math.random()<.5?{big:d[0],bigTxt:1,q:"Quel département porte ce numéro ?",a:d[1],w:wr(DP.map(x=>x[1]),d[1])}:{q:"Quel est le numéro du département : "+d[1]+" ?",a:d[0],w:wr(DP.map(x=>x[0]),d[0])}}})});
  add({id:"prefectures",s:"culture",g:"⌂",t:"Préfectures",d:"Retrouve la préfecture de chaque département.",dur:"5 min",run:el=>qcm(el,{label:"Préfectures",gen:()=>{const d=pick(DP);return Math.random()<.6?{q:"Quelle est la préfecture du département : "+d[1]+" ("+d[0]+") ?",a:d[2],w:wr(DP.map(x=>x[2]),d[2])}:{q:d[2]+" est la préfecture de quel département ?",a:d[1],w:wr(DP.map(x=>x[1]),d[1])}}})});
}
if(has(W.GENTILES))add({id:"gentiles",s:"culture",g:"👥",t:"Habitants",d:"Comment s'appellent les habitants de… ?",dur:"5 min",run:el=>qcm(el,{label:"Habitants",gen:()=>{const g=pick(W.GENTILES);return{q:"Comment appelle-t-on les habitants de "+g[0]+" ?",a:g[1],w:wr(W.GENTILES.map(x=>x[1]),g[1])}}})});

/* ================= CULTURE (tables) ================= */
if(has(W.ELEMENTS))add({id:"elements",s:"culture",g:"Fe",t:"Éléments chimiques",d:"Symboles et noms du tableau périodique.",dur:"5 min",run:el=>qcm(el,{label:"Éléments",gen:()=>{const e=pick(W.ELEMENTS);return Math.random()<.5?{big:e[0],bigTxt:1,q:"Quel élément a pour symbole "+e[0]+" ?",a:e[1],w:wr(W.ELEMENTS.map(x=>x[1]),e[1])}:{q:"Quel est le symbole : "+e[1]+" ?",a:e[0],w:wr(W.ELEMENTS.map(x=>x[0]),e[0])}}})});
if(has(W.INVENTIONS))add({id:"inventions",s:"culture",g:"💡",t:"Inventeurs",d:"Qui a inventé ou découvert quoi ?",dur:"5 min",run:el=>qcm(el,{label:"Inventeurs",gen:()=>{const e=pick(W.INVENTIONS);return{q:"À qui doit-on : "+e[0].charAt(0).toLowerCase()+e[0].slice(1)+" ?",a:e[1],w:wr(W.INVENTIONS.map(x=>x[1]),e[1])}}})});
if(has(W.BOOKS))add({id:"livres",s:"culture",g:"📖",t:"Livres et auteurs",d:W.BOOKS.length+" livres célèbres.",dur:"5 min",run:el=>qcm(el,{label:"Livres",gen:()=>{const b=pick(W.BOOKS);return{q:"Qui a écrit « "+b[0]+" » ?",a:b[1],w:wr(W.BOOKS.map(x=>x[1]),b[1])}}})});
if(has(W.SONGS))add({id:"chansons",s:"culture",g:"🎤",t:"Chansons françaises",d:"Qui chante quoi ?",dur:"5 min",run:el=>qcm(el,{label:"Chansons",gen:()=>{const b=pick(W.SONGS);return{q:"Qui chante « "+b[0]+" » ?",a:b[1],w:wr(W.SONGS.map(x=>x[1]),b[1])}}})});
if(has(W.FILMS))add({id:"films",s:"culture",g:"🎞",t:"Films et réalisateurs",d:"Qui a réalisé ce film ?",dur:"5 min",run:el=>qcm(el,{label:"Films",gen:()=>{const b=pick(W.FILMS);return{q:"Qui a réalisé « "+b[0]+" » ?",a:b[1],w:wr(W.FILMS.map(x=>x[1]),b[1])}}})});
if(has(W.DATES))add({id:"dates",s:"culture",g:"1789",t:"Dates de l'Histoire",d:W.DATES.length+" événements à dater.",dur:"5 min",run:el=>qcm(el,{label:"Dates",gen:()=>{const d=pick(W.DATES);const y=d[1];const w=new Set();const span=y<1000?100:y<1800?40:12;let t=0;while(w.size<3&&t<50){t++;const v=y+(rnd(2)?1:-1)*(1+rnd(span));if(v!==y&&v<=2025)w.add(v)}return{q:"En quelle année : "+d[0].charAt(0).toLowerCase()+d[0].slice(1)+" ?",a:String(y),w:[...w].map(String)}}})});

/* ================= MOTS ET LANGUES ================= */
if(has(W.EN))add({id:"anglais",s:"langues",g:"EN",t:"Anglais",d:W.EN.length+" mots du quotidien, dans les deux sens.",dur:"5 min",run:el=>qcm(el,{label:"Anglais",gen:()=>{const p=pick(W.EN);return Math.random()<.5?{q:"Comment dit-on « "+p[0]+" » en anglais ?",a:p[1],w:wr(W.EN.map(x=>x[1]),p[1])}:{q:"Que veut dire « "+p[1]+" » ?",a:p[0],w:wr(W.EN.map(x=>x[0]),p[0])}}})});
if(has(W.ES))add({id:"espagnol",s:"langues",g:"ES",t:"Espagnol",d:W.ES.length+" mots du quotidien, dans les deux sens.",dur:"5 min",run:el=>qcm(el,{label:"Espagnol",gen:()=>{const p=pick(W.ES);return Math.random()<.5?{q:"Comment dit-on « "+p[0]+" » en espagnol ?",a:p[1],w:wr(W.ES.map(x=>x[1]),p[1])}:{q:"Que veut dire « "+p[1]+" » ?",a:p[0],w:wr(W.ES.map(x=>x[0]),p[0])}}})});
if(has(W.EN))add({id:"ecrire-en",s:"langues",g:"Aa",t:"Écris en anglais",d:"Tape la traduction toi-même, sans choix.",dur:"5 min",run:el=>typed(el,{label:"Anglais écrit",gen:()=>{const p=pick(W.EN);return{q:"Traduis en anglais : « "+p[0]+" »",a:p[1],hint:"ça commence par « "+p[1].slice(0,2)+" »"}}})});
if(has(W.SYN))add({id:"synonymes",s:"langues",g:"≈",t:"Synonymes",d:"Trouve le mot qui veut dire la même chose.",dur:"5 min",run:el=>qcm(el,{label:"Synonymes",gen:()=>{const p=pick(W.SYN);return{big:p[0],bigTxt:1,q:"Quel est le synonyme de ce mot ?",a:p[1],w:wr(W.SYN.map(x=>x[1]),p[1])}}})});
if(has(W.ANT))add({id:"contraires",s:"langues",g:"↔",t:"Contraires",d:"Trouve le mot qui dit l'inverse.",dur:"5 min",run:el=>qcm(el,{label:"Contraires",gen:()=>{const p=pick(W.ANT);return{big:p[0],bigTxt:1,q:"Quel est le contraire de ce mot ?",a:p[1],w:wr(W.ANT.map(x=>x[1]),p[1])}}})});
if(has(W.EXPR))add({id:"expressions",s:"langues",g:"« »",t:"Expressions",d:"Complète l'expression et découvre son sens.",dur:"5 min",run:el=>qcm(el,{label:"Expressions",gen:()=>{const p=pick(W.EXPR);return{q:"Complète : « "+p[0]+" »",a:p[1],w:wr(W.EXPR.map(x=>x[1]),p[1]),x:cap(p[0].replace("___",p[1]))+" : "+p[2]+"."}}})});
if(has(W.PROV))add({id:"proverbes",s:"langues",g:"…",t:"Proverbes",d:"Retrouve la fin du proverbe.",dur:"5 min",run:el=>qcm(el,{label:"Proverbes",gen:()=>{const p=pick(W.PROV);return{q:"« "+p[0]+"… »",a:p[1],w:wr(W.PROV.map(x=>x[1]),p[1])}}})});
if(has(W.ORTHO))add({id:"orthographe",s:"langues",g:"✓",t:"Orthographe",d:"Lequel est bien écrit ?",dur:"5 min",run:el=>qcm(el,{label:"Orthographe",gen:()=>{const p=pick(W.ORTHO);return{q:"Quel mot est bien écrit ?",a:p[0],w:p[1].slice(0,3)}}})});
if(has(W.CONJ))add({id:"conjugaison",s:"langues",g:"je/tu",t:"Conjugaison",d:"Choisis la bonne forme du verbe.",dur:"5 min",run:el=>qcm(el,{label:"Conjugaison",gen:()=>{const p=pick(W.CONJ);return{q:p[0],a:p[1],w:p[2].slice(0,3)}}})});
if(has(W.BABY))add({id:"petits",s:"langues",g:"🐣",t:"Petits des animaux",d:"Le petit de la chèvre ? Du cerf ?",dur:"3 min",run:el=>qcm(el,{label:"Petits des animaux",gen:()=>{const p=pick(W.BABY);return{q:"Comment s'appelle le petit : "+p[0]+" ?",a:p[1],w:wr(W.BABY.map(x=>x[1]),p[1])}}})});
if(has(W.CRIS))add({id:"cris",s:"langues",g:"🐾",t:"Cris des animaux",d:"Le cerf brame, et le corbeau ?",dur:"3 min",run:el=>qcm(el,{label:"Cris des animaux",gen:()=>{const p=pick(W.CRIS);return{q:"Que fait cet animal : "+p[0]+" ?",a:p[1],w:wr(W.CRIS.map(x=>x[1]),p[1])}}})});
const GR=W.GROUPS&&Object.entries(W.GROUPS).filter(([k,v])=>has(v,6));
if(GR&&GR.length>=4){
  add({id:"intrus",s:"langues",g:"≠",t:"L'intrus",d:"Trois mots vont ensemble. Lequel n'a rien à faire là ?",dur:"5 min",run:el=>qcm(el,{label:"Intrus",gen:()=>{const [a,b]=shuffle(GR);const three=shuffle(a[1]).slice(0,3);const odd=pick(b[1]);return{q:"Quel est l'intrus ?",a:odd,w:three,x:"Les autres sont dans la catégorie « "+a[0]+" »."}}})});
  add({id:"petitbac",s:"langues",g:"A…",t:"Petit bac",d:"Une lettre, six catégories, 3 minutes.",dur:"3 min",run:petitBac});
}
add({id:"manquantes",s:"langues",g:"C_O",t:"Lettres manquantes",d:"Complète le mot à trous.",dur:"5 min",run:el=>typed(el,{label:"Lettres manquantes",gen:()=>{const w=pick(WORDS.filter(x=>x.length>=5&&x.length<=9));const hide=new Set(shuffle([...Array(w.length).keys()].slice(1)).slice(0,Math.ceil(w.length*.45)));return{big:w.split("").map((c,i)=>hide.has(i)?"_":c).join(" "),q:"Quel est ce mot ?",a:w,hint:"il a "+w.length+" lettres et se termine par "+w.slice(-2)}}})});
add({id:"motsmeles",s:"langues",g:"⌗",t:"Mots mêlés",d:"Retrouve 8 mots cachés dans la grille.",dur:"10–15 min",run:motsMeles});

/* ================= CALCUL ================= */
const r=(a,b)=>a+rnd(b-a+1);
function roman(n){const m=[[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];let s="";for(const [v,c] of m)while(n>=v){s+=c;n-=v}return s}
add({id:"romains",s:"calc",g:"XIV",t:"Chiffres romains",d:"Traduis dans les deux sens.",dur:"5 min",run:el=>typed(el,{label:"Chiffres romains",gen:()=>{const n=Math.random()<.3?r(1,40):Math.random()<.6?r(40,400):r(1000,2030);return Math.random()<.5?{big:roman(n),q:"Quel nombre est écrit ici ?",a:n,num:1,hint:"I=1, V=5, X=10, L=50, C=100, D=500, M=1000"}:{big:String(n),q:"Écris ce nombre en chiffres romains.",a:roman(n),hint:"I=1, V=5, X=10, L=50, C=100, D=500, M=1000"}}})});
add({id:"pourcentages",s:"calc",g:"%",t:"Pourcentages",d:"Soldes, remises, augmentations.",dur:"5 min",run:el=>typed(el,{label:"Pourcentages",gen:()=>{const p=pick([10,20,25,50,5,15,30,40,75]);const b=pick([20,40,60,80,100,120,150,200,240,300,500]);const t=rnd(3);
  if(t===0)return{q:"Combien font "+p+" % de "+b+" ?",a:b*p/100,num:1};
  if(t===1)return{q:"Un article à "+b+" € est soldé à −"+p+" %. Quel est son nouveau prix (en €) ?",a:b*(100-p)/100,num:1,hint:"calcule d'abord la remise : "+p+" % de "+b};
  return{q:"Un loyer de "+b*5+" € augmente de "+p+" %. Combien paie-t-on maintenant (en €) ?",a:b*5*(100+p)/100,num:1}}})});
add({id:"monnaie",s:"calc",g:"€",t:"Rendu de monnaie",d:"Combien doit-on te rendre ?",dur:"5 min",run:el=>typed(el,{label:"Rendu de monnaie",gen:()=>{const price=r(105,4890)/100;const bill=[5,10,20,50].find(b=>b>price)||100;const rest=Math.round((bill-price)*100)/100;return{q:"Tu paies "+price.toFixed(2).replace(".",",")+" € avec un billet de "+bill+" €. Combien te rend-on (en €) ?",a:rest,num:1,show:rest.toFixed(2).replace(".",",")+" €"}}})});
add({id:"durees",s:"calc",g:"⏱",t:"Heures et durées",d:"Calcule des heures d'arrivée et des durées.",dur:"5 min",run:el=>typed(el,{label:"Heures",gen:()=>{const h=r(6,20),m=r(0,59),dh=r(0,4),dm=r(5,59);const t=h*60+m+dh*60+dm;const H=Math.floor(t/60)%24,M=t%60;const f=(a,b)=>a+"h"+String(b).padStart(2,"0");
  if(Math.random()<.5)return{q:"Il est "+f(h,m)+". Quelle heure sera-t-il dans "+(dh?dh+" h ":"")+dm+" min ?",a:f(H,M),ph:"ex. 16h05",check:(v)=>{const x=v.replace(/\s/g,"").replace(/[:.]/,"h").match(/^(\d{1,2})h?(\d{2})?$/);return x&&+x[1]===H&&+(x[2]||0)===M}};
  return{q:"Un film commence à "+f(h,m)+" et finit à "+f(H,M)+". Combien de minutes dure-t-il ?",a:dh*60+dm,num:1}}})});
add({id:"conversions",s:"calc",g:"km",t:"Conversions",d:"Mètres, litres, grammes, minutes…",dur:"5 min",run:el=>typed(el,{label:"Conversions",gen:()=>{const L=[["km","m",1000],["m","cm",100],["kg","g",1000],["L","cL",100],["L","mL",1000],["h","min",60],["min","s",60],["jour","h",24],["m²","cm²",10000],["t","kg",1000]];const [a,b,k]=pick(L);const v=pick([1,2,3,5,0.5,1.5,2.5,4,7,12]);
  return Math.random()<.6?{q:String(v).replace(".",",")+" "+a+" = combien de "+b+" ?",a:v*k,num:1}:{q:(v*k)+" "+b+" = combien de "+a+" ?",a:v,num:1}}})});
add({id:"chaine",s:"calc",g:"→",t:"Calcul en chaîne",d:"Une suite d'opérations de tête.",dur:"5 min",run:el=>typed(el,{label:"Calcul en chaîne",n:8,pts:5,gen:()=>{let v=r(2,12);const steps=[];for(let i=0;i<4;i++){const o=rnd(4);if(o===0){const x=r(2,15);v+=x;steps.push("+"+x)}else if(o===1&&v>5){const x=r(1,v-1);v-=x;steps.push("−"+x)}else if(o===2&&v<60){const x=r(2,4);v*=x;steps.push("×"+x)}else if(v%2===0){v/=2;steps.push("÷2")}else{v+=10;steps.push("+10")}}return{q:"Pars du nombre affiché, puis : "+steps.join(", puis ")+". Résultat ?",big:String(eval0(steps,v)),a:v,num:1}}})});
function eval0(steps,end){let v=end;for(const s of [...steps].reverse()){const o=s[0],x=s.slice(1)==="2"&&o==="÷"?2:+s.slice(1);v=o==="+"?v-x:o==="−"?v+x:o==="×"?v/x:v*2}return v}
add({id:"tables",s:"calc",g:"7×8",t:"Tables express",d:"20 multiplications le plus vite possible.",dur:"2 min",run:tablesExpress});
add({id:"compte",s:"calc",g:"=",t:"Le bon compte",d:"Combine les nombres pour atteindre la cible.",dur:"5–15 min",run:bonCompte});
add({id:"devine",s:"calc",g:"?",t:"Nombre mystère",d:"Trouve le nombre entre 1 et 1000 : plus ou moins.",dur:"3 min",run:nombreMystere});

/* ================= ARCADE ================= */
add({id:"serpent",s:"arcade",g:"∿",t:"Serpent",d:"Mange, grandis, ne te mords pas la queue.",dur:"3–10 min",run:serpent});
add({id:"briques",s:"arcade",g:"▤",t:"Casse-briques",d:"Renvoie la balle, détruis tous les blocs.",dur:"5–10 min",run:briques});
add({id:"pong",s:"arcade",g:"▮•",t:"Raquettes",d:"Premier à 5 points contre l'ordinateur.",dur:"3–5 min",run:raquettes});
add({id:"labyrinthe",s:"arcade",g:"⌘",t:"Labyrinthe",d:"Des labyrinthes de plus en plus grands.",dur:"5–20 min",run:labyrinthe});
add({id:"morpion",s:"arcade",g:"✕○",t:"Morpion",d:"Aligne 3 symboles avant l'ordinateur.",dur:"2 min",run:morpion});
add({id:"allumettes",s:"arcade",g:"|||",t:"Allumettes",d:"Celui qui prend la dernière a perdu.",dur:"3 min",run:allumettes});
add({id:"navires",s:"arcade",g:"⚓",t:"Chasse aux navires",d:"Coule la flotte cachée en un minimum de tirs.",dur:"5–10 min",run:navires});
add({id:"pfc",s:"arcade",g:"✊✋",t:"Pierre, feuille, ciseaux",d:"L'ordinateur apprend ta façon de jouer.",dur:"2 min",run:pfc});

/* ================= LOGIQUE ================= */
add({id:"binaire",s:"tete",g:"01",t:"Binaire",d:"Grille 6×6 : autant de 0 que de 1, jamais 3 à la suite.",dur:"10–20 min",run:binaire});
add({id:"logimage",s:"tete",g:"▦",t:"Logimage",d:"Noircis les cases grâce aux chiffres et révèle le motif.",dur:"10–30 min",run:logimage});

/* ================= MÉMOIRE ET RÉFLEXES ================= */
add({id:"schulte",s:"reflexe",g:"1→25",t:"Table de Schulte",d:"Touche les nombres de 1 à 25 dans l'ordre, vite.",dur:"1 min",run:schulte});
add({id:"teinte",s:"reflexe",g:"▣",t:"La teinte différente",d:"Trouve la case un peu plus claire. 60 secondes.",dur:"1 min",run:teinte});
add({id:"stroop",s:"reflexe",g:"Rouge",t:"Couleur ou mot ?",d:"Donne la couleur de l'encre, pas le mot écrit.",dur:"30 s",run:stroop});
add({id:"chiffres",s:"reflexe",g:"4 7 2",t:"Mémoire des chiffres",d:"Retiens une suite de chiffres de plus en plus longue.",dur:"3 min",run:memChiffres});
add({id:"positions",s:"reflexe",g:"⁘",t:"Mémoire des cases",d:"Retiens les cases qui s'allument.",dur:"3 min",run:memPositions});
add({id:"chrono",s:"reflexe",g:"10,00",t:"Chrono parfait",d:"Arrête le chrono pile à 10 secondes, à l'aveugle.",dur:"2 min",run:chrono});
add({id:"reflexe",s:"reflexe",g:"⚡",t:"Réflexe",d:"Touche l'écran dès qu'il passe au vert.",dur:"1 min",run:reflexe});
add({id:"frappe",s:"reflexe",g:"⌨",t:"Frappe rapide",d:"Tape un maximum de mots en 60 secondes.",dur:"1 min",run:frappe});

/* ================= ZEN ET CRÉATIF ================= */
add({id:"coherence",s:"zen",g:"♡",t:"Cohérence cardiaque",d:"5 minutes, 6 respirations par minute. Calme l'envie et l'anxiété.",dur:"5 min",run:coherence});
add({id:"scan",s:"zen",g:"◌",t:"Scan du corps",d:"6 minutes de relaxation guidée, de la tête aux pieds.",dur:"6 min",run:scanCorps});
add({id:"ardoise",s:"zen",g:"✎",t:"Ardoise",d:"Dessine librement, avec un thème si tu veux.",dur:"10–30 min",run:ardoise});
add({id:"journal",s:"zen",g:"¶",t:"Journal",d:"Écris ce que tu ressens. Une question différente à chaque fois.",dur:"10 min",run:journal});

/* enregistrement */
MOD.forEach(m=>{if(GAMEFN[m.id])return;GAMES.push({id:m.id,s:m.s,g:m.g,t:m.t,d:m.d,dur:m.dur,n:1});GAMEFN[m.id]=m.run});

/* ========================================================== */
/* ================= IMPLÉMENTATIONS ========================= */
/* ========================================================== */
function petitBac(el){
  const play=()=>{const L=pick("ABCDEFGHIJLMNOPRSTV".split(""));const cats=shuffle(GR).slice(0,6);const end=Date.now()+180000;let iv;
    el.innerHTML=`<div class="hud"><span>Temps <b id="bt">3:00</b></span><span>Lettre</span></div><div class="letter pop">${L}</div><div class="pbar"><i id="bp" style="width:100%"></i></div>
    <form id="bf" class="bac">${cats.map(([c],i)=>`<label for="b${i}">${esc(c)}</label><input class="field" id="b${i}" autocomplete="off" placeholder="${L}…">`).join("")}<button class="btn">J'ai fini</button></form>`;
    const fin=()=>{clearInterval(iv);let ok=0;const res=cats.map(([c,words],i)=>{const v=($("#b"+i)||{}).value||"";const good=v.trim()&&norm(v)[0]===L.toLowerCase();if(good)ok++;const ex=words.filter(w=>norm(w)[0]===L.toLowerCase()).slice(0,3);return`<div class="it"><span><b>${esc(c)}</b> : ${esc(v.trim()||"—")} ${good?"✓":""}<br><span class="small muted">${ex.length?"Exemples : "+esc(ex.join(", ")):"Aucun exemple dans ma liste."}</span></span></div>`});
      markBlk();if(ok)addPts(ok*4,"Petit bac");el.innerHTML=`<h2>${ok} / 6 avec la lettre ${L}</h2><p class="muted small">Je vérifie seulement la première lettre : sois honnête avec toi-même.</p><div class="list">${res.join("")}</div><button class="btn block" id="bn">Nouvelle lettre</button>`;$("#bn").onclick=play;if(ok>=4)confetti(80)};
    $("#bf").onsubmit=e=>{e.preventDefault();fin()};
    iv=setInterval(()=>{const l=Math.max(0,end-Date.now());const t=$("#bt");if(!t){clearInterval(iv);return}t.textContent=Math.floor(l/60000)+":"+String(Math.floor(l/1000)%60).padStart(2,"0");$("#bp").style.width=(l/1800)+"%";if(!l)fin()},500);cleanup=()=>clearInterval(iv)};
  play()}

function motsMeles(el){
  const N=10,DIR=[[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
  const play=()=>{const g=Array(N*N).fill("");const words=[];const pool=shuffle(WORDS.filter(w=>w.length>=4&&w.length<=8));
    for(const w of pool){if(words.length>=8)break;for(let t=0;t<60;t++){const [dr,dc]=pick(DIR.slice(0,words.length<4?4:8));const r0=rnd(N),c0=rnd(N);const cells=[];let ok=true;
      for(let k=0;k<w.length;k++){const rr=r0+dr*k,cc=c0+dc*k;if(rr<0||rr>=N||cc<0||cc>=N){ok=false;break}const i=rr*N+cc;if(g[i]&&g[i]!==w[k]){ok=false;break}cells.push(i)}
      if(ok){cells.forEach((i,k)=>g[i]=w[k]);words.push({w,cells});break}}}
    const AL="EEEAAISSNRTULOCDMP";for(let i=0;i<N*N;i++)if(!g[i])g[i]=pick(AL.split(""));
    const found=new Set(),foundCells=new Set();let start=-1;
    const draw=()=>{el.innerHTML=`<p class="muted small">Touche la première lettre d'un mot, puis la dernière. Les mots peuvent être à l'envers ou en diagonale.</p>
      <div class="ws" style="grid-template-columns:repeat(${N},1fr)">${g.map((c,i)=>`<button data-i="${i}" class="${i===start?"a":foundCells.has(i)?"f":""}">${c}</button>`).join("")}</div>
      <div class="wl">${words.map(o=>found.has(o.w)?`<s>${o.w}</s>`:`<span>${o.w}</span>`).join("")}</div>`;
      el.querySelectorAll(".ws button").forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(start<0){start=i;draw();return}
        const hit=words.find(o=>!found.has(o.w)&&((o.cells[0]===start&&o.cells[o.cells.length-1]===i)||(o.cells[0]===i&&o.cells[o.cells.length-1]===start)));start=-1;
        if(hit){found.add(hit.w);hit.cells.forEach(c=>foundCells.add(c));addPts(3,"Mot trouvé");if(found.size===words.length){addPts(15,"Mots mêlés");winScreen(el,{medal:"⌗",title:"Grille terminée",text:"Les "+words.length+" mots sont trouvés.",again:"Nouvelle grille",onAgain:play});return}}
        draw()})};
    draw()};play()}

function tablesExpress(el){
  const play=()=>{let i=0,t0=Date.now(),cur,err=0;
    el.innerHTML=`<div class="hud"><span><b id="ti2">1</b>/20</span><span>Erreurs <b id="te">0</b></span></div><div class="calc-q" id="tq"></div><input class="field mono" id="tin" inputmode="numeric" autocomplete="off" style="text-align:center;font-size:1.6rem" aria-label="Réponse">`;
    const nq=()=>{const a=r(2,10),b=r(2,10);cur=[a+" × "+b,a*b];const q=$("#tq");q.textContent=cur[0];q.classList.remove("pop");void q.offsetWidth;q.classList.add("pop");$("#tin").value="";$("#tin").focus()};
    $("#tin").oninput=()=>{const v=$("#tin").value.trim();if(v===String(cur[1])){i++;if(i===20){const s=((Date.now()-t0)/1000).toFixed(1);const best=S.best.tables||999;const rec=+s<best;if(rec)S.best.tables=+s;addPts(Math.max(8,30-Math.floor(+s/4)-err*2),"Tables express");winScreen(el,{medal:s+" s",title:"20 multiplications en "+s+" s",text:(rec?"Nouveau record ! ":"Record : "+best+" s. ")+err+" erreur"+(err>1?"s":"")+".",onAgain:play});return}$("#ti2").textContent=i+1;nq()}
      else if(v.length>=String(cur[1]).length&&v!==String(cur[1]).slice(0,v.length)){err++;$("#te").textContent=err;const f=$("#tin");f.classList.remove("shake");void f.offsetWidth;f.classList.add("shake");f.value=""}};
    nq()};play()}

function bonCompte(el){
  const play=()=>{const base=[1,2,3,4,5,6,7,8,9,10,1,2,3,4,5,6,7,8,9,10,25,50,75,100];let picks,target,sol;
    for(let t=0;t<500;t++){picks=shuffle(base).slice(0,5);let items=picks.map(v=>({v,s:String(v)}));const steps=[];
      for(let k=0;k<3+rnd(2)&&items.length>1;k++){const [A,B]=shuffle(items).slice(0,2);const ops=["+","−","×","÷"].filter(o=>o!=="−"||A.v>B.v).filter(o=>o!=="÷"||(B.v>1&&A.v%B.v===0)).filter(o=>o!=="×"||(A.v>1&&B.v>1));const o=pick(ops);const v=o==="+"?A.v+B.v:o==="−"?A.v-B.v:o==="×"?A.v*B.v:A.v/B.v;steps.push(A.v+" "+o+" "+B.v+" = "+v);items=items.filter(x=>x!==A&&x!==B);items.push({v})}
      const last=items[items.length-1].v;if(last>=40&&last<=400&&!picks.includes(last)){target=last;sol=steps;break}}
    let nums=picks.map((v,i)=>({v,id:i})),nid=10,sel=null,op=null;const hist=[];let usedSol=false;
    const draw=(msg)=>{el.innerHTML=`<p class="muted small">Choisis un nombre, une opération, puis un autre nombre. Le résultat remplace les deux. Atteins la cible.</p><div class="target pop">${target}</div>
      <div class="nums">${nums.map(n=>`<button data-id="${n.id}" class="${sel===n.id?"sel":""}">${n.v}</button>`).join("")}</div>
      <div class="ops">${["+","−","×","÷"].map(o=>`<button data-o="${o}" class="${op===o?"sel":""}">${o}</button>`).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn ghost sm" id="bu">Annuler</button><button class="btn ghost sm" id="br">Recommencer</button><button class="btn ghost sm" id="bs">Une solution</button></div>
      <div class="hist">${hist.map(h=>`<div>${esc(h.txt)}</div>`).join("")}</div><div id="bm">${msg||""}</div>`;
      el.querySelectorAll(".nums button").forEach(b=>b.onclick=()=>{const id=+b.dataset.id;if(sel===null||op===null){sel=id;op=null;draw();return}if(id===sel)return;
        const A=nums.find(n=>n.id===sel),B=nums.find(n=>n.id===id);let v=null;if(op==="+")v=A.v+B.v;else if(op==="×")v=A.v*B.v;else if(op==="−")v=A.v-B.v;else if(B.v&&A.v%B.v===0)v=A.v/B.v;
        if(v===null||v<=0){sel=null;op=null;draw(`<div class="fb bad">Impossible : pas de nombres négatifs, nuls ou à virgule.</div>`);return}
        hist.push({txt:A.v+" "+op+" "+B.v+" = "+v,prev:nums.map(n=>({...n}))});nums=nums.filter(n=>n!==A&&n!==B);nums.push({v,id:nid++});sel=null;op=null;
        if(v===target){if(!usedSol)addPts(30,"Le bon compte");winScreen(el,{medal:String(target),title:"Compte est bon !",text:hist.length+" opération"+(hist.length>1?"s":"")+".",again:"Nouvelle cible",onAgain:play});return}draw()});
      el.querySelectorAll(".ops button").forEach(b=>b.onclick=()=>{if(sel===null)return;op=b.dataset.o;draw()});
      $("#bu").onclick=()=>{const h=hist.pop();if(h)nums=h.prev;sel=null;op=null;draw()};
      $("#br").onclick=()=>{if(hist.length)nums=hist[0].prev;hist.length=0;sel=null;op=null;draw()};
      $("#bs").onclick=()=>{usedSol=true;draw(`<div class="fb info">Une solution : ${esc(sol.join(" ; "))}</div>`)}};
    draw()};play()}

function nombreMystere(el){
  const play=()=>{const n=r(1,1000);let lo=1,hi=1000,tries=0;
    const draw=(msg)=>{el.innerHTML=`<p class="muted">J'ai choisi un nombre entre 1 et 1000. Tu as 10 essais.</p><div class="hud"><span>Essai <b>${tries+1}</b>/10</span><span>Entre <b>${lo}</b> et <b>${hi}</b></span></div>
      <form id="nf" class="row"><input class="field mono" id="ni" inputmode="numeric" autocomplete="off" style="flex:1;min-width:0;text-align:center;font-size:1.5rem"><button class="btn">Tester</button></form><div id="nm">${msg||""}</div>`;$("#ni").focus();
      $("#nf").onsubmit=e=>{e.preventDefault();const v=parseInt($("#ni").value,10);if(isNaN(v))return;tries++;
        if(v===n){addPts(Math.max(5,32-tries*3),"Nombre mystère");winScreen(el,{medal:String(n),title:"Trouvé en "+tries+" essai"+(tries>1?"s":""),text:tries<=7?"Méthode parfaite.":"Astuce : vise toujours le milieu de l'intervalle.",onAgain:play});return}
        if(v<n)lo=Math.max(lo,v+1);else hi=Math.min(hi,v-1);
        if(tries>=10){draw(`<div class="fb bad">Perdu, c'était ${n}.</div><button class="btn block" id="nn" style="margin-top:10px">Rejouer</button>`);$("#nn").onclick=play;return}
        draw(`<div class="fb info">${v} : c'est <b>${v<n?"plus":"moins"}</b>.</div>`)}};
    draw()};play()}

/* ---- outils canvas ---- */
function mkCanvas(el,ratio){const cv=document.createElement("canvas");cv.className="cv";el.appendChild(cv);const w=Math.min(el.clientWidth||360,440);const h=Math.round(w*ratio);const d=devicePixelRatio||1;cv.width=w*d;cv.height=h*d;cv.style.height=h+"px";const ctx=cv.getContext("2d");ctx.scale(d,d);return{cv,ctx,w,h}}
function dpad(el,fn){const d=document.createElement("div");d.className="dpad";d.innerHTML=`<button class="u" data-d="u" aria-label="Haut">▲</button><button class="l" data-d="l" aria-label="Gauche">◀</button><button class="d" data-d="d" aria-label="Bas">▼</button><button class="r" data-d="r" aria-label="Droite">▶</button>`;el.appendChild(d);d.querySelectorAll("button").forEach(b=>b.addEventListener("pointerdown",e=>{e.preventDefault();fn(b.dataset.d)}))}
function swipe(target,fn){let x0,y0;target.addEventListener("pointerdown",e=>{x0=e.clientX;y0=e.clientY});target.addEventListener("pointerup",e=>{if(x0==null)return;const dx=e.clientX-x0,dy=e.clientY-y0;if(Math.max(Math.abs(dx),Math.abs(dy))>18)fn(Math.abs(dx)>Math.abs(dy)?(dx>0?"r":"l"):(dy>0?"d":"u"));x0=null})}
function keys(fn){const h=e=>{const m={ArrowUp:"u",ArrowDown:"d",ArrowLeft:"l",ArrowRight:"r"}[e.key];if(m){e.preventDefault();fn(m)}};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h)}

function serpent(el){
  const play=()=>{if(cleanup){cleanup();cleanup=null}el.innerHTML=`<div class="hud"><span>Score <b id="ss">0</b></span><span>Record <b>${S.best.serpent||0}</b></span></div>`;
    const N=17,{ctx,w}=mkCanvas(el,1),c=w/N;let sn=[{x:8,y:8},{x:7,y:8},{x:6,y:8}],dir={x:1,y:0},next=dir,food=null,score=0,alive=true,tm;
    const place=()=>{do{food={x:rnd(N),y:rnd(N)}}while(sn.some(p=>p.x===food.x&&p.y===food.y))};place();
    const setD=d=>{const v={u:{x:0,y:-1},d:{x:0,y:1},l:{x:-1,y:0},r:{x:1,y:0}}[d];if(v.x!==-dir.x||v.y!==-dir.y)next=v};
    const draw=()=>{ctx.clearRect(0,0,w,w);ctx.fillStyle=css("--spark");ctx.beginPath();ctx.arc(food.x*c+c/2,food.y*c+c/2,c*.38,0,7);ctx.fill();sn.forEach((p,i)=>{ctx.fillStyle=i?css("--accent"):css("--ink");ctx.beginPath();ctx.roundRect?ctx.roundRect(p.x*c+1,p.y*c+1,c-2,c-2,c*.3):ctx.rect(p.x*c+1,p.y*c+1,c-2,c-2);ctx.fill()})};
    const step=()=>{if(!alive)return;dir=next;const h={x:sn[0].x+dir.x,y:sn[0].y+dir.y};
      if(h.x<0||h.y<0||h.x>=N||h.y>=N||sn.some(p=>p.x===h.x&&p.y===h.y)){alive=false;const rec=score>(S.best.serpent||0);if(rec)S.best.serpent=score;markBlk();addPts(Math.min(25,3+score),"Serpent");later(()=>winScreen(el,{medal:String(score),title:score+" pomme"+(score>1?"s":""),text:rec?"Nouveau record !":"Record : "+S.best.serpent,onAgain:play}),500);return}
      sn.unshift(h);if(h.x===food.x&&h.y===food.y){score++;$("#ss").textContent=score;bump("#ss");place()}else sn.pop();draw();tm=setTimeout(step,Math.max(70,160-score*4))};
    draw();dpad(el,setD);swipe(el.querySelector("canvas"),setD);const unk=keys(setD);tm=setTimeout(step,500);cleanup=()=>{clearTimeout(tm);unk();alive=false}};
  play()}

function briques(el){
  const play=()=>{if(cleanup){cleanup();cleanup=null}el.innerHTML=`<div class="hud"><span>Score <b id="bks">0</b></span><span>Vies <b id="bkv">3</b></span></div>`;
    const {cv,ctx,w,h}=mkCanvas(el,1.3);const cols=8,rows=6,bw=w/cols,bh=18,top=40;let bricks=[];for(let rr=0;rr<rows;rr++)for(let cc=0;cc<cols;cc++)bricks.push({x:cc*bw,y:top+rr*(bh+4),a:true,c:["--p2","--p3","--p1","--p4","--p2","--p3"][rr]});
    let px=w/2,pw=Math.max(60,w*.2),ball={x:w/2,y:h-60,vx:2.6,vy:-3.6},lives=3,score=0,raf,run=true,stuck=true;const PH=h-24;
    const move=e=>{const rc=cv.getBoundingClientRect();px=Math.max(pw/2,Math.min(w-pw/2,(e.clientX-rc.left)));if(stuck)ball.x=px};
    cv.addEventListener("pointermove",move);cv.addEventListener("pointerdown",e=>{move(e);stuck=false});
    const loop=()=>{if(!run)return;if(!stuck){ball.x+=ball.vx;ball.y+=ball.vy}else{ball.y=PH-10}
      if(ball.x<6||ball.x>w-6)ball.vx*=-1;if(ball.y<6)ball.vy=Math.abs(ball.vy);
      if(ball.y>PH-8&&ball.y<PH+4&&Math.abs(ball.x-px)<pw/2+6&&ball.vy>0){const k=(ball.x-px)/(pw/2);const sp=Math.hypot(ball.vx,ball.vy);ball.vx=sp*k*.8;ball.vy=-Math.sqrt(Math.max(4,sp*sp-ball.vx*ball.vx))}
      for(const b of bricks)if(b.a&&ball.x>b.x&&ball.x<b.x+bw&&ball.y>b.y&&ball.y<b.y+bh){b.a=false;ball.vy*=-1;score++;$("#bks").textContent=score;const sp=Math.min(7,Math.hypot(ball.vx,ball.vy)*1.015);const an=Math.atan2(ball.vy,ball.vx);ball.vx=Math.cos(an)*sp;ball.vy=Math.sin(an)*sp;break}
      if(ball.y>h+10){lives--;$("#bkv").textContent=lives;bump("#bkv");stuck=true;ball={x:px,y:PH-10,vx:2.6*(rnd(2)?1:-1),vy:-3.6};if(!lives)return over(false)}
      if(bricks.every(b=>!b.a))return over(true);
      ctx.clearRect(0,0,w,h);bricks.forEach(b=>{if(!b.a)return;ctx.fillStyle=css(b.c);ctx.fillRect(b.x+2,b.y,bw-4,bh)});ctx.fillStyle=css("--ink");ctx.fillRect(px-pw/2,PH,pw,10);ctx.fillStyle=css("--spark");ctx.beginPath();ctx.arc(ball.x,ball.y,6,0,7);ctx.fill();
      if(stuck){ctx.fillStyle=css("--muted");ctx.font="600 14px sans-serif";ctx.textAlign="center";ctx.fillText("Touche pour lancer",w/2,h/2)}
      raf=requestAnimationFrame(loop)};
    const over=win=>{run=false;markBlk();addPts(Math.min(35,4+Math.floor(score/2)+(win?15:0)),"Casse-briques");winScreen(el,{medal:String(score),title:win?"Tous les blocs détruits":score+" blocs détruits",text:win?"Magnifique.":"Glisse le doigt pour bouger la raquette.",onAgain:play})};
    raf=requestAnimationFrame(loop);cleanup=()=>{run=false;cancelAnimationFrame(raf)}};
  play()}

function raquettes(el){
  const play=()=>{if(cleanup){cleanup();cleanup=null}el.innerHTML=`<div class="hud"><span>Toi <b id="pp">0</b></span><span>Ordi <b id="pa">0</b></span></div>`;
    const {cv,ctx,w,h}=mkCanvas(el,1.35);let px=w/2,ax=w/2,pw=Math.max(60,w*.22),ball,sp=0,sa=0,raf,run=true,wait=40;
    const serve=d=>{ball={x:w/2,y:h/2,vx:(Math.random()*2-1)*2.5,vy:d*4}};serve(1);
    cv.addEventListener("pointermove",e=>{const rc=cv.getBoundingClientRect();px=Math.max(pw/2,Math.min(w-pw/2,e.clientX-rc.left))});cv.addEventListener("pointerdown",e=>{const rc=cv.getBoundingClientRect();px=Math.max(pw/2,Math.min(w-pw/2,e.clientX-rc.left))});
    const loop=()=>{if(!run)return;if(wait>0)wait--;else{ball.x+=ball.vx;ball.y+=ball.vy}
      const aiSp=2.6+Math.min(2,(sp+sa)*.2);ax+=Math.max(-aiSp,Math.min(aiSp,ball.x-ax));ax=Math.max(pw/2,Math.min(w-pw/2,ax));
      if(ball.x<6||ball.x>w-6)ball.vx*=-1;
      if(ball.vy>0&&ball.y>h-30&&ball.y<h-16&&Math.abs(ball.x-px)<pw/2+6){ball.vy=-Math.min(9,Math.abs(ball.vy)*1.06);ball.vx=(ball.x-px)/(pw/2)*4.5}
      if(ball.vy<0&&ball.y<30&&ball.y>16&&Math.abs(ball.x-ax)<pw/2+6){ball.vy=Math.min(9,Math.abs(ball.vy)*1.06);ball.vx=(ball.x-ax)/(pw/2)*4.5}
      if(ball.y<-10){sp++;$("#pp").textContent=sp;bump("#pp");serve(1);wait=50}if(ball.y>h+10){sa++;$("#pa").textContent=sa;bump("#pa");serve(-1);wait=50}
      if(sp>=5||sa>=5){run=false;markBlk();addPts(sp>=5?25:6,"Raquettes");winScreen(el,{medal:sp+"–"+sa,title:sp>=5?"Victoire !":"L'ordinateur gagne",text:"Le premier à 5 points gagne.",onAgain:play});return}
      ctx.clearRect(0,0,w,h);ctx.strokeStyle=css("--line");ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle=css("--accent");ctx.fillRect(px-pw/2,h-26,pw,10);ctx.fillStyle=css("--p3");ctx.fillRect(ax-pw/2,16,pw,10);ctx.fillStyle=css("--spark");ctx.beginPath();ctx.arc(ball.x,ball.y,7,0,7);ctx.fill();raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);cleanup=()=>{run=false;cancelAnimationFrame(raf)}};
  play()}

function labyrinthe(el){let lvl=1;
  const play=()=>{if(cleanup){cleanup();cleanup=null}const N=6+lvl*2;el.innerHTML=`<div class="hud"><span>Niveau <b>${lvl}</b></span><span>${N}×${N}</span></div>`;
    const wall=Array(N*N).fill(15),seen=new Set([0]),stk=[0];const D=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
    while(stk.length){const cur=stk[stk.length-1],x=cur%N,y=Math.floor(cur/N);const nb=shuffle(D).filter(([dx,dy])=>{const X=x+dx,Y=y+dy;return X>=0&&Y>=0&&X<N&&Y<N&&!seen.has(Y*N+X)});if(!nb.length){stk.pop();continue}const [dx,dy,b,ob]=nb[0];const n=(y+dy)*N+x+dx;wall[cur]&=~b;wall[n]&=~ob;seen.add(n);stk.push(n)}
    const {ctx,w}=mkCanvas(el,1),c=w/N;let p={x:0,y:0};const trail=new Set(["0,0"]);const t0=Date.now();
    const draw=()=>{ctx.clearRect(0,0,w,w);ctx.fillStyle=css("--accent-soft");trail.forEach(s=>{const [x,y]=s.split(",").map(Number);ctx.fillRect(x*c,y*c,c,c)});ctx.fillStyle=css("--ok");ctx.fillRect((N-1)*c+c*.2,(N-1)*c+c*.2,c*.6,c*.6);
      ctx.strokeStyle=css("--ink");ctx.lineWidth=2;ctx.lineCap="round";ctx.beginPath();for(let i=0;i<N*N;i++){const x=i%N*c,y=Math.floor(i/N)*c;if(wall[i]&1){ctx.moveTo(x,y);ctx.lineTo(x+c,y)}if(wall[i]&2){ctx.moveTo(x+c,y);ctx.lineTo(x+c,y+c)}if(wall[i]&4){ctx.moveTo(x,y+c);ctx.lineTo(x+c,y+c)}if(wall[i]&8){ctx.moveTo(x,y);ctx.lineTo(x,y+c)}}ctx.stroke();
      ctx.fillStyle=css("--spark");ctx.beginPath();ctx.arc(p.x*c+c/2,p.y*c+c/2,c*.32,0,7);ctx.fill()};
    const mv=d=>{const [dx,dy,b]={u:[0,-1,1],r:[1,0,2],d:[0,1,4],l:[-1,0,8]}[d];if(wall[p.y*N+p.x]&b)return;p={x:p.x+dx,y:p.y+dy};trail.add(p.x+","+p.y);draw();
      if(p.x===N-1&&p.y===N-1){const s=Math.round((Date.now()-t0)/1000);markBlk();addPts(8+lvl*3,"Labyrinthe");winScreen(el,{medal:"Niv. "+lvl,title:"Sorti en "+s+" s",text:"Le suivant sera plus grand.",again:"Niveau suivant",onAgain:()=>{lvl++;play()}});return}};
    draw();dpad(el,mv);swipe(el.querySelector("canvas"),mv);const unk=keys(mv);cleanup=unk};
  play()}

function morpion(el){const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win=(b,p)=>L.find(l=>l.every(i=>b[i]===p));
  const mm=(b,me)=>{if(win(b,"o"))return 10;if(win(b,"x"))return -10;if(b.every(Boolean))return 0;const sc=[];b.forEach((v,i)=>{if(!v){b[i]=me;sc.push(mm(b,me==="o"?"x":"o"));b[i]=""}});return me==="o"?Math.max(...sc):Math.min(...sc)};
  let wins=0;
  const play=()=>{const b=Array(9).fill("");let over=false,busy=false;
    const draw=(msg,wl)=>{el.innerHTML=`<div class="hud"><span>Tu joues <b style="color:var(--spark)">✕</b></span><span>Victoires <b>${wins}</b></span></div><div class="grid3">${b.map((v,i)=>`<button data-i="${i}" style="${wl&&wl.includes(i)?"background:var(--accent-soft)":""}">${v?`<span class="${v}">${v==="x"?"✕":"○"}</span>`:""}</button>`).join("")}</div><div id="mo">${msg||""}</div>`;
      el.querySelectorAll(".grid3 button").forEach(x=>x.onclick=()=>{const i=+x.dataset.i;if(over||busy||b[i])return;b[i]="x";let w=win(b,"x");if(w)return end("Gagné !",w,true);if(b.every(Boolean))return end("Match nul.");busy=true;draw();
        later(()=>{const free=b.map((v,i)=>v?-1:i).filter(i=>i>=0);let mv;if(Math.random()<.22)mv=pick(free);else{let best=-99;for(const i of free){b[i]="o";const s=mm(b,"x");b[i]="";if(s>best){best=s;mv=i}}}b[mv]="o";busy=false;w=win(b,"o");if(w)return end("L'ordinateur gagne.",w);if(b.every(Boolean))return end("Match nul.");draw()},450)})};
    const end=(t,wl,won)=>{over=true;if(won){wins++;markBlk();addPts(12,"Morpion");confetti(70)}else addPts(t.includes("nul")?4:1,"Morpion");draw(`<div class="fb ${won?"ok":"info"}">${t}</div><button class="btn block" id="mn" style="margin-top:10px">Rejouer</button>`,wl);$("#mn").onclick=play};
    draw()};play()}

function allumettes(el){
  const play=()=>{let n=21,turn="toi",log="";
    const draw=(msg)=>{el.innerHTML=`<p class="muted small">À tour de rôle, prends 1, 2 ou 3 allumettes. Celui qui prend la dernière a perdu.</p><div class="hud"><span>Restantes <b>${n}</b></span><span>${turn==="toi"?"À toi":"L'ordinateur joue…"}</span></div>
      <div class="sticks">${Array(n).fill("<i></i>").join("")}</div><div class="row" style="justify-content:center">${[1,2,3].map(k=>`<button class="btn ${k<=n&&turn==="toi"?"":"ghost"}" data-k="${k}" ${k>n||turn!=="toi"?"disabled":""}>Prendre ${k}</button>`).join("")}</div><div id="am">${msg||log}</div>`;
      el.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>take(+b.dataset.k,"toi"))};
    const take=(k,who)=>{n-=k;log=`<div class="fb info">${who==="toi"?"Tu prends":"L'ordinateur prend"} ${k}.</div>`;
      if(n<=0){const won=who!=="toi";markBlk();addPts(won?20:3,"Allumettes");if(won)winScreen(el,{medal:"|||",title:"Gagné !",text:"L'ordinateur a pris la dernière. Astuce : laisse-lui toujours 1, 5, 9, 13 ou 17 allumettes.",onAgain:play});else{draw(`<div class="fb bad">Tu as pris la dernière. Perdu.</div><button class="btn block" id="an" style="margin-top:10px">Rejouer</button>`);$("#an").onclick=play}return}
      if(who==="toi"){turn="ordi";draw();later(()=>{let k2=(n-1)%4;if(k2===0||Math.random()<.25)k2=1+rnd(Math.min(3,n));turn="toi";take(Math.min(k2,n),"ordi")},800)}else draw()};
    draw()};play()}

function navires(el){
  const play=()=>{const N=8,ships=[4,3,3,2,2].map((len,id)=>({len,id,cells:[]}));const occ=new Map();
    for(const s of ships){for(let t=0;t<200;t++){const hz=rnd(2),r0=rnd(N),c0=rnd(N);const cells=[];for(let k=0;k<s.len;k++){const rr=r0+(hz?0:k),cc=c0+(hz?k:0);if(rr>=N||cc>=N||occ.has(rr*N+cc)){cells.length=0;break}cells.push(rr*N+cc)}if(cells.length===s.len){s.cells=cells;cells.forEach(i=>occ.set(i,s));break}}}
    const shot=new Set();let shots=0;
    const sunk=s=>s.cells.every(i=>shot.has(i));
    const draw=(msg)=>{el.innerHTML=`<div class="hud"><span>Tirs <b>${shots}</b></span><span>Coulés <b>${ships.filter(sunk).length}</b>/5</span></div>
      <div class="sea">${[...Array(N*N).keys()].map(i=>{const s=occ.get(i);const cl=!shot.has(i)?"":s?(sunk(s)?"s":"h"):"m";return`<button data-i="${i}" class="${cl}" aria-label="Case ${i+1}">${!shot.has(i)?"":s?"✹":"·"}</button>`}).join("")}</div>
      <p class="small muted" style="text-align:center">Flotte : ${ships.map(s=>`<span style="${sunk(s)?"text-decoration:line-through":""}">${"■".repeat(s.len)}</span>`).join(" ")}</p><div id="nm">${msg||""}</div>`;
      el.querySelectorAll(".sea button").forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(shot.has(i))return;shot.add(i);shots++;const s=occ.get(i);let m="";if(s){m=sunk(s)?`<div class="fb ok">Coulé ! (${s.len} cases)</div>`:`<div class="fb ok">Touché !</div>`}
        if(ships.every(sunk)){markBlk();addPts(Math.max(10,60-(shots-17)),"Chasse aux navires");winScreen(el,{medal:shots+" tirs",title:"Flotte coulée",text:"Le minimum possible est 14 tirs.",onAgain:play});return}draw(m)})};
    draw()};play()}

function pfc(el){const E={p:"✊",f:"✋",c:"✌️"},BEAT={p:"c",f:"p",c:"f"},N={p:"Pierre",f:"Feuille",c:"Ciseaux"};
  const play=()=>{let me=0,ai=0;const hist=[];
    const draw=(duel,msg)=>{el.innerHTML=`<div class="hud"><span>Toi <b id="pm">${me}</b></span><span>Premier à 5</span><span>Ordi <b id="pa2">${ai}</b></span></div><div class="duel">${duel||""}</div><div class="pfc">${["p","f","c"].map(k=>`<button data-k="${k}" aria-label="${N[k]}">${E[k]}</button>`).join("")}</div><div id="pmsg">${msg||""}</div>`;
      el.querySelectorAll(".pfc button").forEach(b=>b.onclick=()=>{const k=b.dataset.k;let guess;const last=hist.slice(-6);if(last.length>=3&&Math.random()<.65){const cnt={p:0,f:0,c:0};last.forEach(x=>cnt[x]++);const fav=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];guess=Object.keys(BEAT).find(x=>BEAT[x]===fav)}else guess=pick(["p","f","c"]);hist.push(k);
        let m;if(k===guess)m="Égalité.";else if(BEAT[k]===guess){me++;m="Point pour toi."}else{ai++;m="Point pour l'ordinateur."}
        if(me>=5||ai>=5){markBlk();addPts(me>=5?15:3,"Pierre, feuille, ciseaux");winScreen(el,{medal:me+"–"+ai,title:me>=5?"Victoire !":"L'ordinateur gagne",text:"Il essaie de deviner tes habitudes. Sois imprévisible.",onAgain:play});return}
        draw(`<span>${E[k]}</span><span style="animation-delay:.12s">${E[guess]}</span>`,`<div class="fb info">${m}</div>`)})};
    draw()};play()}

function binaire(el){const N=6;
  const okLine=a=>{for(let i=0;i+2<a.length;i++)if(a[i]!==""&&a[i]===a[i+1]&&a[i]===a[i+2])return false;const z=a.filter(v=>v===0).length,o=a.filter(v=>v===1).length;return z<=N/2&&o<=N/2};
  const row=(g,r)=>g.slice(r*N,r*N+N),col=(g,c)=>[...Array(N)].map((_,r)=>g[r*N+c]);
  const gen=()=>{const g=Array(N*N).fill("");const fill=i=>{if(i===N*N){for(let a=0;a<N;a++)for(let b=a+1;b<N;b++){if(row(g,a).join()===row(g,b).join()||col(g,a).join()===col(g,b).join())return false}return true}
      for(const v of shuffle([0,1])){g[i]=v;if(okLine(row(g,Math.floor(i/N)))&&okLine(col(g,i%N))&&fill(i+1))return true}g[i]="";return false};fill(0);return g};
  const play=()=>{const sol=gen();const giv=new Set(shuffle([...Array(N*N).keys()]).slice(0,15));const g=sol.map((v,i)=>giv.has(i)?v:"");
    const errs=()=>{const bad=new Set();for(let k=0;k<N;k++){[row(g,k),col(g,k)].forEach((a,t)=>{if(!okLine(a))for(let j=0;j<N;j++)bad.add(t?j*N+k:k*N+j)})}return bad};
    const draw=()=>{const bad=errs();el.innerHTML=`<p class="muted small">Remplis avec 0 et 1. Chaque ligne et colonne contient trois 0 et trois 1, jamais trois chiffres identiques à la suite, et deux lignes ne sont jamais identiques.</p>
      <div class="tk">${g.map((v,i)=>`<button data-i="${i}" class="${v===""?"":"v"+v}${giv.has(i)?" g":""}${bad.has(i)&&!giv.has(i)?" e":""}">${v}</button>`).join("")}</div><div class="row" style="justify-content:center"><button class="btn ghost sm" id="bn2">Nouvelle grille</button></div>`;
      el.querySelectorAll(".tk button").forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(giv.has(i))return;g[i]=g[i]===""?0:g[i]===0?1:"";
        if(g.every(v=>v!=="")&&!errs().size){let uniq=true;for(let a=0;a<N;a++)for(let c=a+1;c<N;c++)if(row(g,a).join()===row(g,c).join()||col(g,a).join()===col(g,c).join())uniq=false;if(uniq){markBlk();addPts(35,"Binaire");winScreen(el,{medal:"01",title:"Grille résolue",text:"Logique implacable.",again:"Nouvelle grille",onAgain:play});return}}draw()});
      $("#bn2").onclick=play};
    draw()};play()}

function logimage(el){
  const menu=()=>{el.innerHTML=`<p class="muted">Les chiffres indiquent les blocs de cases noires dans chaque ligne et colonne, dans l'ordre. Noircis les bonnes cases. Mode croix : marque les cases sûres d'être vides.</p><div class="stack"><button class="btn soft block" data-n="5">Facile · 5×5 · +20 pts</button><button class="btn soft block" data-n="8">Moyen · 8×8 · +40 pts</button><button class="btn soft block" data-n="10">Difficile · 10×10 · +60 pts</button></div>`;
    el.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>play(+b.dataset.n))};
  const clues=a=>{const o=[];let k=0;a.forEach(v=>{if(v)k++;else if(k){o.push(k);k=0}});if(k)o.push(k);return o.length?o:[0]};
  const play=n=>{const sol=Array(n*n).fill(0).map(()=>Math.random()<.58?1:0);const R=[...Array(n)].map((_,r)=>clues(sol.slice(r*n,r*n+n))),C=[...Array(n)].map((_,c)=>clues([...Array(n)].map((_,r)=>sol[r*n+c])));
    const g=Array(n*n).fill(0);let mode=1;
    const draw=()=>{const gr=[...Array(n)].map((_,r)=>clues(g.slice(r*n,r*n+n).map(v=>v===1?1:0)).join()===R[r].join()),gc=[...Array(n)].map((_,c)=>clues([...Array(n)].map((_,r)=>g[r*n+c]===1?1:0)).join()===C[c].join());
      el.innerHTML=`<div class="hud"><span>${n}×${n}</span><div class="toggle"><button data-m="1" aria-pressed="${mode===1}">Noircir</button><button data-m="2" aria-pressed="${mode===2}">Croix</button></div></div>
      <div class="ng" style="grid-template-columns:auto repeat(${n},1fr)"><div></div>${C.map((c,i)=>`<div class="cl${gc[i]?" ok":""}">${c.join("<br>")}</div>`).join("")}
      ${[...Array(n)].map((_,r)=>`<div class="rl${gr[r]?" ok":""}">${R[r].join(" ")}</div>`+[...Array(n)].map((_,c)=>{const i=r*n+c;return`<button data-i="${i}" class="${g[i]===1?"on":""}">${g[i]===2?"✕":""}</button>`}).join("")).join("")}</div>
      <div class="row" style="justify-content:center"><button class="btn ghost sm" id="lm">Autre taille</button></div>`;
      el.querySelectorAll(".toggle button").forEach(b=>b.onclick=()=>{mode=+b.dataset.m;draw()});
      el.querySelectorAll(".ng button").forEach(b=>b.onclick=()=>{const i=+b.dataset.i;g[i]=g[i]===mode?0:mode;
        if(gr.length&&[...Array(n)].every((_,r)=>clues(g.slice(r*n,r*n+n).map(v=>v===1?1:0)).join()===R[r].join())&&[...Array(n)].every((_,c)=>clues([...Array(n)].map((_,r2)=>g[r2*n+c]===1?1:0)).join()===C[c].join())){markBlk();addPts(n===5?20:n===8?40:60,"Logimage");winScreen(el,{medal:"▦",title:"Logimage résolu",text:n+"×"+n+" terminé.",again:"Nouvelle grille",onAgain:()=>play(n)});return}draw()});
      $("#lm").onclick=menu};
    draw()};
  menu()}

function schulte(el){
  const play=()=>{const nums=shuffle([...Array(25).keys()].map(i=>i+1));let next=1,t0=null,iv;
    el.innerHTML=`<div class="hud"><span>Prochain <b id="sn">1</b></span><span>Temps <b id="st">0,0</b> s</span></div><div class="sch">${nums.map(v=>`<button data-v="${v}">${v}</button>`).join("")}</div>`;
    el.querySelectorAll(".sch button").forEach(b=>b.onclick=()=>{const v=+b.dataset.v;if(v!==next){b.classList.remove("shake");void b.offsetWidth;b.classList.add("shake");return}if(next===1){t0=Date.now();iv=setInterval(()=>{const e=$("#st");if(e)e.textContent=((Date.now()-t0)/1000).toFixed(1).replace(".",",")},100);cleanup=()=>clearInterval(iv)}
      b.classList.add("ok");next++;$("#sn").textContent=Math.min(next,25);
      if(next>25){clearInterval(iv);const s=+((Date.now()-t0)/1000).toFixed(1);const best=S.best.schulte||999;if(s<best)S.best.schulte=s;markBlk();addPts(Math.max(6,30-Math.floor(s/2)),"Schulte");winScreen(el,{medal:String(s).replace(".",",")+" s",title:"1 à 25 en "+String(s).replace(".",",")+" s",text:s<best?"Nouveau record !":"Record : "+String(best).replace(".",",")+" s",onAgain:play})}})};
  play()}

function teinte(el){
  const play=()=>{let score=0;const end=Date.now()+60000;let iv;
    const round=()=>{const n=Math.min(8,2+Math.floor(score/3));const h=rnd(360),s=45+rnd(30),l=40+rnd(20);const d=Math.max(3,24-score);const odd=rnd(n*n);
      el.innerHTML=`<div class="hud"><span>Score <b id="ts2">${score}</b></span><span>Temps <b id="tt">${Math.ceil((end-Date.now())/1000)}</b> s</span></div><div class="odd" style="grid-template-columns:repeat(${n},1fr)">${[...Array(n*n)].map((_,i)=>`<button data-i="${i}" style="background:hsl(${h} ${s}% ${i===odd?l+d:l}%);animation-delay:${i*8}ms" aria-label="Case ${i+1}"></button>`).join("")}</div>`;
      el.querySelectorAll(".odd button").forEach(b=>b.onclick=()=>{if(+b.dataset.i===odd){score++;round()}else{b.classList.add("shake")}})};
    round();iv=setInterval(()=>{const l=Math.max(0,Math.ceil((end-Date.now())/1000));const t=$("#tt");if(t)t.textContent=l;if(!l){clearInterval(iv);const best=S.best.teinte||0;if(score>best)S.best.teinte=score;markBlk();addPts(Math.min(25,3+score),"Teinte");winScreen(el,{medal:String(score),title:score+" teintes trouvées",text:score>best?"Nouveau record !":"Record : "+best,onAgain:play})}},250);cleanup=()=>clearInterval(iv)};
  play()}

function stroop(el){const COL=[["Rouge","--p2"],["Bleu","--p4"],["Vert","--ok"],["Jaune","--p3"]];
  const play=()=>{let score=0,err=0;const end=Date.now()+30000;let iv,ans;
    el.innerHTML=`<div class="hud"><span>Score <b id="sc">0</b></span><span>Temps <b id="sct">30</b> s</span></div><p class="muted small" style="text-align:center">De quelle <b>couleur</b> est écrit le mot ?</p><div class="stroop" id="sw"></div><div class="cbtn">${COL.map(([n],i)=>`<button data-i="${i}">${n}</button>`).join("")}</div>`;
    const nq=()=>{const w=rnd(4);let c=rnd(4);if(Math.random()<.75)while(c===w)c=rnd(4);ans=c;const e=$("#sw");e.textContent=COL[w][0].toUpperCase();e.style.color=css(COL[c][1]);e.classList.remove("pop");void e.offsetWidth;e.classList.add("pop")};
    el.querySelectorAll(".cbtn button").forEach(b=>b.onclick=()=>{if(+b.dataset.i===ans){score++;$("#sc").textContent=score}else{err++;const e=$("#sw");e.classList.remove("shake");void e.offsetWidth;e.classList.add("shake")}nq()});
    nq();iv=setInterval(()=>{const l=Math.max(0,Math.ceil((end-Date.now())/1000));const t=$("#sct");if(t)t.textContent=l;if(!l){clearInterval(iv);const net=Math.max(0,score-err);markBlk();addPts(Math.min(20,3+Math.floor(net/2)),"Couleur ou mot");winScreen(el,{medal:String(net),title:score+" bonnes réponses",text:err+" erreur"+(err>1?"s":"")+". Le cerveau lit plus vite qu'il ne voit les couleurs.",onAgain:play})}},250);cleanup=()=>clearInterval(iv)};
  play()}

function memChiffres(el){
  const play=()=>{let len=3;
    const round=()=>{const seq=[...Array(len)].map(()=>rnd(10)).join("");el.innerHTML=`<div class="hud"><span>Longueur <b>${len}</b></span><span>Record <b>${S.best.chiffres||0}</b></span></div><div class="digits pop" id="dg">${seq}</div><p class="muted small" style="text-align:center">Mémorise…</p>`;
      later(()=>{el.innerHTML=`<div class="hud"><span>Longueur <b>${len}</b></span><span></span></div><div class="digits">?</div><form id="df" class="row"><input class="field mono" id="di" inputmode="numeric" autocomplete="off" style="flex:1;min-width:0;text-align:center;font-size:1.6rem"><button class="btn">OK</button></form>`;$("#di").focus();
        $("#df").onsubmit=e=>{e.preventDefault();if($("#di").value.trim()===seq){len++;addPts(2,"Chiffre retenu");round()}else{const got=len-1;if(got>(S.best.chiffres||0))S.best.chiffres=got;markBlk();addPts(Math.min(25,got*2),"Mémoire des chiffres");winScreen(el,{medal:String(got),title:got+" chiffres retenus",text:"C'était "+seq+". La moyenne des adultes tourne autour de 7.",onAgain:play})}}},700+len*550)};
    round()};play()}

function memPositions(el){
  const play=()=>{let k=3;
    const round=()=>{const n=k<=5?4:5;const cells=new Set(shuffle([...Array(n*n).keys()]).slice(0,k));const hit=new Set();let input=false,lost=false;
      el.innerHTML=`<div class="hud"><span>Cases <b>${k}</b></span><span id="pst">Regarde…</span></div><div class="pos" style="grid-template-columns:repeat(${n},1fr)">${[...Array(n*n)].map((_,i)=>`<button data-i="${i}" class="${cells.has(i)?"lit":""}" aria-label="Case ${i+1}"></button>`).join("")}</div>`;
      const bs=[...el.querySelectorAll(".pos button")];
      later(()=>{bs.forEach(b=>b.classList.remove("lit"));input=true;$("#pst").textContent="À toi"},1200+k*120);
      bs.forEach(b=>b.onclick=()=>{if(!input||lost)return;const i=+b.dataset.i;if(hit.has(i))return;if(cells.has(i)){hit.add(i);b.classList.add("ok");if(hit.size===k){addPts(2,"Cases retenues");k++;later(round,600)}}
        else{lost=true;b.classList.add("ko");cells.forEach(c=>bs[c].classList.add("lit"));const got=k-1;markBlk();addPts(Math.min(25,got*2),"Mémoire des cases");later(()=>winScreen(el,{medal:String(got),title:got+" cases retenues",text:"Record : "+Math.max(got,S.best.positions||0),onAgain:play}),900);if(got>(S.best.positions||0))S.best.positions=got}})};
    round()};play()}

function chrono(el){
  const play=()=>{let tries=[],t0=null,iv,running=false;
    const draw=(msg)=>{el.innerHTML=`<p class="muted small">Lance le chrono et arrête-le pile à 10,00 secondes. Il devient invisible après 3 secondes. 3 essais.</p><div class="chrono" id="cd">0,00</div><button class="btn block spark" id="cb">${running?"Stop":"Lancer"}</button><div class="hist">${tries.map((t,i)=>`<div><span>Essai ${i+1}</span><b>${t.toFixed(2).replace(".",",")} s</b></div>`).join("")}</div><div>${msg||""}</div>`;
      $("#cb").onclick=()=>{if(!running){running=true;t0=performance.now();draw();iv=setInterval(()=>{const e=(performance.now()-t0)/1000;const d=$("#cd");if(d)d.textContent=e<3?e.toFixed(2).replace(".",","):"?,??"},30);cleanup=()=>clearInterval(iv)}
        else{clearInterval(iv);running=false;const e=(performance.now()-t0)/1000;tries.push(e);if(tries.length===3){const best=tries.reduce((a,b)=>Math.abs(b-10)<Math.abs(a-10)?b:a);const gap=Math.abs(best-10);markBlk();addPts(gap<.05?25:gap<.2?15:gap<.5?8:3,"Chrono parfait");winScreen(el,{medal:best.toFixed(2).replace(".",","),title:"Écart : "+gap.toFixed(2).replace(".",",")+" s",text:gap<.1?"Une horloge suisse.":"Compte dans ta tête : « un crocodile, deux crocodiles… »",onAgain:play});return}draw()}}};
    draw()};play()}

function reflexe(el){
  const play=()=>{const res=[];let state="idle",t0,tm;
    const draw=()=>{el.innerHTML=`<div class="hud"><span>Essai <b>${Math.min(res.length+1,5)}</b>/5</span><span>${res.length?"Dernier : "+res[res.length-1]+" ms":""}</span></div><div class="react ${state==="go"?"go":state==="wait"?"wait":"idle"}" id="rz">${state==="go"?"Touche !":state==="wait"?"Attends le vert…":"Touche pour commencer"}</div>`;
      $("#rz").onpointerdown=e=>{e.preventDefault();if(state==="idle"){state="wait";draw();tm=later(()=>{state="go";t0=performance.now();draw()},1200+rnd(2800))}
        else if(state==="wait"){clearTimeout(tm);state="idle";draw();toast("Trop tôt ! On recommence cet essai.")}
        else if(state==="go"){res.push(Math.round(performance.now()-t0));state="idle";if(res.length===5){const avg=Math.round(res.reduce((a,b)=>a+b)/5);const best=S.best.reflexe||9999;if(avg<best)S.best.reflexe=avg;markBlk();addPts(avg<260?20:avg<330?12:6,"Réflexe");winScreen(el,{medal:avg+" ms",title:"Moyenne : "+avg+" ms",text:(avg<best?"Nouveau record ! ":"")+"La moyenne humaine tourne autour de 250 ms.",onAgain:play});return}draw()}}};
    draw()};play()}

function frappe(el){
  const play=()=>{let n=0,cur,end=null,iv;const pool=WORDS.filter(w=>w.length<=8);
    el.innerHTML=`<div class="hud"><span>Mots <b id="fn">0</b></span><span>Temps <b id="ft">60</b> s</span></div><div class="bigq txt pop" id="fw"></div><input class="field mono" id="fi" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="text-align:center;font-size:1.4rem" placeholder="Tape le mot ici">`;
    const nq=()=>{cur=pick(pool).toLowerCase();const w=$("#fw");w.textContent=cur;w.classList.remove("pop");void w.offsetWidth;w.classList.add("pop");$("#fi").value=""};
    $("#fi").oninput=()=>{if(!end){end=Date.now()+60000;iv=setInterval(()=>{const l=Math.max(0,Math.ceil((end-Date.now())/1000));const t=$("#ft");if(t)t.textContent=l;if(!l){clearInterval(iv);const best=S.best.frappe||0;if(n>best)S.best.frappe=n;markBlk();addPts(Math.min(25,3+Math.floor(n/2)),"Frappe rapide");winScreen(el,{medal:String(n),title:n+" mots en 60 s",text:n>best?"Nouveau record !":"Record : "+best,onAgain:play})}},250);cleanup=()=>clearInterval(iv)}
      if(norm($("#fi").value)===norm(cur)){n++;$("#fn").textContent=n;nq()}};
    nq();$("#fi").focus()};play()}

/* ---- zen ---- */
function breather(el,{title,total,cycle,text,pts,label}){
  el.innerHTML=`<p class="muted">${text}</p><div class="breath"><div class="ring"></div><div class="rip"></div><div class="rip"></div><div class="orb" id="zorb"></div><div class="lbl" id="zl">Prêt</div></div><div class="pbar"><i id="zp"></i></div><p class="mono" style="text-align:center" id="zr"></p><button class="btn block" id="zgo">Commencer</button>`;
  $("#zgo").onclick=()=>{$("#zgo").hidden=true;const t0=Date.now();let i=0,tm,iv;const orb=$("#zorb");
    const nx=()=>{const [nm,ms,sc]=cycle[i%cycle.length];$("#zl").textContent=nm;orb.style.transitionDuration=ms+"ms";orb.style.transform="scale("+sc+")";i++;tm=setTimeout(nx,ms)};nx();
    iv=setInterval(()=>{const e=Date.now()-t0,l=Math.max(0,total-e);const z=$("#zr");if(!z)return;z.textContent=Math.floor(l/60000)+":"+String(Math.floor(l/1000)%60).padStart(2,"0");$("#zp").style.width=(e/total*100)+"%";if(!l){clearInterval(iv);clearTimeout(tm);markBlk();addPts(pts,label);winScreen(el,{medal:"♡",title:"Séance terminée",text:"Ton rythme cardiaque s'est calé sur ta respiration. Bois un grand verre d'eau.",again:"Recommencer",onAgain:()=>breather(el,{title,total,cycle,text,pts,label})})}},250);
    cleanup=()=>{clearInterval(iv);clearTimeout(tm)}}}
function coherence(el){breather(el,{total:300000,cycle:[["Inspire",5000,1],["Expire",5000,.45]],text:"Inspire 5 secondes quand la bulle grossit, expire 5 secondes quand elle diminue. 5 minutes suffisent pour faire baisser le stress pendant plusieurs heures.",pts:20,label:"Cohérence cardiaque"})}
function scanCorps(el){const P=["Installe-toi confortablement, assis ou allongé. Ferme les yeux si tu veux.","Respire lentement. Sens l'air entrer par le nez et ressortir.","Porte ton attention sur ton front et ta mâchoire. Desserre les dents.","Descends vers les épaules. Laisse-les tomber, loin des oreilles.","Sens tes bras, lourds, jusqu'au bout des doigts.","Observe ta poitrine qui se soulève et redescend, sans rien forcer.","Ton ventre : s'il est noué, souffle doucement dessus en expirant.","Si l'envie est là, repère où elle se loge dans ton corps. Observe-la sans la juger.","Descends vers les hanches, les cuisses, les genoux.","Sens le poids de tes jambes et le contact de tes pieds avec le sol.","Respire dans tout ton corps, de la tête aux pieds.","Ouvre doucement les yeux. Étire-toi. Tu viens de passer 6 minutes avec toi-même."];
  el.innerHTML=`<p class="muted">Lis chaque consigne et suis-la. Elle change toutes les 30 secondes.</p><div class="pbar"><i id="sp"></i></div><p class="story" id="sx" style="min-height:6em">Appuie sur commencer quand tu es prêt.</p><button class="btn block" id="sgo2">Commencer</button>`;
  $("#sgo2").onclick=()=>{$("#sgo2").hidden=true;let i=0;const show=()=>{const x=$("#sx");if(!x)return;x.textContent=P[i];x.classList.remove("pop");void x.offsetWidth;x.classList.add("pop");$("#sp").style.width=((i+1)/P.length*100)+"%"};show();
    const iv=setInterval(()=>{i++;if(i>=P.length){clearInterval(iv);markBlk();addPts(20,"Scan du corps");winScreen(el,{medal:"◌",title:"Relaxation terminée",text:"Garde ce calme pour ton prochain bloc.",again:"Recommencer",onAgain:()=>scanCorps(el)});return}show()},30000);cleanup=()=>clearInterval(iv)}}
function ardoise(el){const THEMES=["un phare au bord de la mer","ta maison de rêve","un animal imaginaire","ton plat préféré","un paysage de montagne","toi dans un an, en pleine forme","une fusée","un arbre en automne","une ville du futur","ton animal préféré","un robot cuisinier","une île déserte","un bateau pirate","un dragon gentil","le lever de soleil","une tasse de chocolat chaud","un vélo","ta chanson préférée en image","un monstre rigolo","une forêt enchantée"];
  const cols=["--ink","--spark","--p3","--ok","--p1","--p4","--muted"];let col=cols[0],size=4;
  el.innerHTML=`<div class="fb info">Thème du jour : <b id="ath">${esc(pick(THEMES))}</b></div>`;const {cv,ctx,w,h}=mkCanvas(el,1.15);
  const bar=document.createElement("div");bar.className="stack";bar.innerHTML=`<div class="palette">${cols.map((c,i)=>`<button data-c="${c}" class="${i?"":"sel"}" style="background:var(${c})" aria-label="Couleur ${i+1}"></button>`).join("")}</div><div class="row" style="justify-content:center"><button class="btn ghost sm" data-s="3">Fin</button><button class="btn ghost sm" data-s="8">Moyen</button><button class="btn ghost sm" data-s="18">Épais</button><button class="btn ghost sm" id="aclr">Effacer</button><button class="btn ghost sm" id="anew">Autre thème</button></div><button class="btn block" id="adone">J'ai fini mon dessin · +15</button>`;el.appendChild(bar);
  let down=false,lx,ly;const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  cv.addEventListener("pointerdown",e=>{down=true;[lx,ly]=pos(e);cv.setPointerCapture(e.pointerId)});cv.addEventListener("pointermove",e=>{if(!down)return;const [x,y]=pos(e);ctx.strokeStyle=css(col);ctx.lineWidth=size;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();lx=x;ly=y});["pointerup","pointercancel"].forEach(t=>cv.addEventListener(t,()=>down=false));
  bar.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{col=b.dataset.c;bar.querySelectorAll("[data-c]").forEach(x=>x.classList.toggle("sel",x===b))});
  bar.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>size=+b.dataset.s);
  $("#aclr").onclick=()=>ctx.clearRect(0,0,w,h);$("#anew").onclick=()=>{$("#ath").textContent=pick(THEMES)};
  $("#adone").onclick=()=>{markBlk();addPts(15,"Dessin");confetti(80);$("#adone").disabled=true;$("#adone").textContent="Bravo ! Recommence quand tu veux."}}
function journal(el){const Q=["Qu'est-ce qui t'a donné envie de boire aujourd'hui ? Décris la situation.","Écris 3 choses qui se sont bien passées aujourd'hui, même petites.","À quoi ressemblerait ta vie dans un an sans alcool ?","Qu'est-ce que tu as gagné depuis que tu essaies d'arrêter ?","Écris une lettre à la personne que tu étais il y a un an.","Qu'est-ce qui te rend fier de toi cette semaine ?","Quelles sont les 3 situations où l'envie est la plus forte ? Que peux-tu faire à la place ?","Décris un après-midi parfait, sans alcool, de 13 h à 17 h.","De quoi as-tu besoin, là, maintenant ? Faim, repos, parler à quelqu'un, bouger ?","Qui pourrait t'aider ? Comment lui demander ?","Qu'est-ce que l'alcool t'a fait perdre ?","Écris ce que tu dirais à un ami qui veut arrêter de boire.","Quel projet voudrais-tu lancer avec l'argent et le temps récupérés ?","Comment as-tu dormi ces derniers jours ? Qu'est-ce qui a changé ?","Écris ce que tu ressens dans ton corps en ce moment."];
  const q=pick(Q);el.innerHTML=`<p class="eyebrow">Question du moment</p><p class="story pop">${esc(q)}</p><textarea class="journal" id="jt" placeholder="Écris librement. Personne d'autre ne lit."></textarea><div class="row"><button class="btn" id="js">Enregistrer</button><button class="btn ghost" id="jn">Autre question</button></div><div id="jm"></div>`;
  $("#jn").onclick=()=>journal(el);
  $("#js").onclick=()=>{const t=$("#jt").value.trim();if(t.length<10){$("#jm").innerHTML=`<div class="fb bad">Écris au moins une phrase.</div>`;return}S.journal=S.journal||[];S.journal.push({t:Date.now(),q,txt:t});if(S.journal.length>400)S.journal=S.journal.slice(-400);save();markBlk();addPts(t.length>=150?20:10,"Journal");$("#jm").innerHTML=`<div class="fb ok">Enregistré. Tu peux relire tes écrits dans l'onglet Moi.</div>`;$("#js").disabled=true}}
})();
