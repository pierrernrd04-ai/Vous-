// Point d'entrée : rendu, menus, profil, salon multijoueur, cycle des parties.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MAPS, getMap } from './maps.js';
import { World, buildEnvironment } from './world.js';
import { Effects } from './effects.js';
import { WEAPONS, CLASSES, getWeapon, weaponStats } from './weapons.js';
import { buildWeaponModel } from './models.js';
import { DIFFICULTIES, botName, botWeapon } from './bots.js';
import { Match } from './game.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { ViewModel } from './viewmodel.js';
import { Net } from './net.js';
import { audio } from './audio.js';
import { store, isTouchDevice, rand } from './util.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const touch = isTouchDevice();
document.body.classList.toggle('is-touch', touch);

// ─────────────────────────────────────────────── réglages et profil

const settings = Object.assign({ sens: 1, fov: 80, volume: 0.8, quality: 'auto', autoFire: true, aimAssist: true, invertY: false, showFps: false }, store.get('po-settings', {}));
const profile = Object.assign({ name: `Opérateur${Math.floor(rand(1000, 9999))}`, xp: 0, kills: 0, deaths: 0, matches: 0, wins: 0, loadout: { primary: 'vk12', secondary: 'mamba' } }, store.get('po-profile', {}));
const saveSettings = () => store.set('po-settings', settings);
const saveProfile = () => store.set('po-profile', profile);

const levelOf = (xp) => Math.floor(Math.sqrt(xp / 250)) + 1;
const levelBase = (l) => 250 * (l - 1) * (l - 1);

function qualityPreset() {
  const name = settings.quality === 'auto' ? (touch ? 'medium' : 'high') : settings.quality;
  const dpr = window.devicePixelRatio || 1;
  const presets = {
    low: { pixelRatio: Math.min(dpr, 1) * 0.8, shadows: false, shadowSize: 0, bloom: false, aniso: 1, pointLights: 0, particles: 300, dynamicLights: false, msaa: 0 },
    medium: { pixelRatio: Math.min(dpr, touch ? 1.25 : 1.5), shadows: false, shadowSize: 0, bloom: true, aniso: 2, pointLights: 3, particles: 650, dynamicLights: true, msaa: 0 },
    high: { pixelRatio: Math.min(dpr, 1.75), shadows: true, shadowSize: 2048, bloom: true, aniso: 8, pointLights: 6, particles: 1200, dynamicLights: true, msaa: 4 },
  };
  return { name, ...presets[name] };
}

// ─────────────────────────────────────────────── rendu

const canvas = $('gl');
let quality = qualityPreset();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.name === 'high', powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
let composer, renderPass, bloomPass;

function setupRenderer() {
  quality = qualityPreset();
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = quality.shadows;
  if (composer) composer.dispose();
  const rt = new THREE.WebGLRenderTarget(innerWidth * quality.pixelRatio, innerHeight * quality.pixelRatio, { type: THREE.HalfFloatType, samples: quality.msaa });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(quality.pixelRatio);
  renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.55, 0.82);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}
setupRenderer();

function render(scene, camera, bloom, withViewModel) {
  if (quality.bloom) {
    renderPass.scene = scene; renderPass.camera = camera;
    bloomPass.strength = bloom;
    composer.render();
  } else renderer.render(scene, camera);
  if (withViewModel) {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(vm.scene, vm.camera);
    renderer.autoClear = true;
  }
}

// ─────────────────────────────────────────────── scènes de menu

class MenuScene {
  constructor() { this.mapId = null; this.t = rand(0, 100); }
  load(mapId) {
    if (mapId === this.mapId) return;
    this.dispose();
    this.mapId = mapId;
    const map = getMap(mapId);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(map.theme.fog, map.theme.fogDensity * 0.8);
    this.world = new World(map, { ...quality, shadows: quality.shadows });
    this.scene.add(this.world.group);
    this.env = buildEnvironment(renderer, this.world, this.scene);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
    this.effects = new Effects(this.scene, quality);
    this.effects.setWeather(map.theme, this.camera);
    this.bloom = map.theme.bloom;
    renderer.toneMappingExposure = map.theme.exposure || 1;
  }
  update(dt) {
    this.t += dt * 0.05;
    const rx = this.world.W * 0.36, rz = this.world.D * 0.36;
    this.camera.position.set(Math.cos(this.t) * rx, 11 + Math.sin(this.t * 2.3) * 2, Math.sin(this.t) * rz);
    this.camera.lookAt(0, 2, 0);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.effects.update(dt, this.camera.position.toArray());
    this.world.update(this.t * 20);
  }
  dispose() {
    if (!this.world) return;
    this.world.dispose();
    this.env.dispose();
    this.world = null;
  }
}

class ArmoryScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0f15');
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    this.camera.position.set(0, 0.42, 3.5);
    this.camera.lookAt(0, 0.02, 0);
    // Studio : environnement réfléchissant + éclairage trois points
    const pm = new THREE.PMREMGenerator(renderer);
    const studio = new THREE.Scene();
    const panel = (color, k, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
    };
    panel('#ffffff', 3, 0, 6, 2, 8, 3);
    panel('#ffd9b0', 2, 5, 2, 3, 3, 4);
    panel('#19e6ff', 2, -5, 1, -3, 3, 4);
    panel('#ff8a1a', 1.2, 0, -1, -6, 6, 2);
    this.env = pm.fromScene(studio, 0.03).texture;
    pm.dispose();
    this.scene.environment = this.env;
    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2018, 2.4));
    const key = new THREE.DirectionalLight(0xfff0dd, 4.5);
    key.position.set(2, 3, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x19e6ff, 2.4);
    rim.position.set(-3, 1.5, -2.5); this.scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.35, metalness: 0.8 }));
    floor.position.y = -0.3; this.scene.add(floor);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.006, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff8a1a').multiplyScalar(2.5), toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.275; this.scene.add(ring);
    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.t = 0;
  }
  show(w) {
    this.holder.clear();
    const m = buildWeaponModel(w);
    const s = w.model.pistol ? 2.8 : 0.95 / Math.max(0.6, w.model.len);
    m.group.scale.setScalar(s);
    m.group.rotation.y = Math.PI / 2;
    const box = new THREE.Box3().setFromObject(m.group);
    const c = box.getCenter(new THREE.Vector3());
    m.group.position.sub(c);
    this.holder.add(m.group);
  }
  update(dt) {
    this.t += dt;
    this.holder.rotation.y = Math.sin(this.t * 0.5) * 0.45 + 0.25;
    this.holder.position.y = 0.08 + Math.sin(this.t * 1.2) * 0.02;
    // Décaler l'arme vers le centre visible (entre la liste et la fiche)
    this.camera.aspect = innerWidth / innerHeight;
    // Arme affichée dans la zone libre au-dessus de la fiche (colonne de droite)
    const narrow = innerWidth < 900;
    this.camera.setViewOffset(innerWidth, innerHeight, -innerWidth * (narrow ? 0.25 : 0.21), innerHeight * (narrow ? 0.2 : 0.22), innerWidth, innerHeight);
    this.camera.updateProjectionMatrix();
  }
}

// ─────────────────────────────────────────────── état global

const hud = new HUD();
const input = new Input(canvas, settings);
const vm = new ViewModel();
const menuScene = new MenuScene();
const armoryScene = new ArmoryScene();
const net = new Net();
let match = null;
let screen = 'boot';
let lastSolo = null;
let lobby = null;      // état du salon (hôte et client)
let myNetId = 'h';
audio.setVolume(settings.volume);

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  screen = id;
  if (id === 'menu') refreshMenu();
  if (id === 'armory') refreshArmory();
}

document.addEventListener('click', (e) => {
  audio.unlock();
  const go = e.target.closest('[data-go]');
  if (go) { audio.ui(); show(go.dataset.go); }
});
document.addEventListener('pointerover', (e) => { if (e.target.closest && e.target.closest('.nav-btn, .cta, .map-card')) audio.ui('hover'); });

// ─────────────────────────────────────────────── menu principal

const nameInput = $('pcName');
nameInput.addEventListener('change', () => {
  profile.name = nameInput.value.trim().replace(/[^\p{L}\p{N} _\-.]/gu, '').slice(0, 16) || profile.name;
  nameInput.value = profile.name;
  saveProfile();
});

function refreshMenu() {
  nameInput.value = profile.name;
  const lvl = levelOf(profile.xp);
  $('pcRank').textContent = lvl;
  $('pcXp').style.width = `${((profile.xp - levelBase(lvl)) / (levelBase(lvl + 1) - levelBase(lvl))) * 100}%`;
  const kd = profile.deaths ? (profile.kills / profile.deaths).toFixed(2) : profile.kills;
  $('pcStats').textContent = `NIVEAU ${lvl} · ${profile.matches} PARTIES · ${profile.wins} VICTOIRES · RATIO ${kd}`;
  $('pcLoadout').innerHTML = `<b>${esc(getWeapon(profile.loadout.primary).name)}</b>${esc(getWeapon(profile.loadout.secondary).name)}`;
}

// ─────────────────────────────────────────────── sélecteurs

function segmented(el, options, value, onChange) {
  el.innerHTML = '';
  for (const [val, label] of options) {
    const b = document.createElement('button');
    b.textContent = label;
    b.classList.toggle('on', val === value);
    b.onclick = () => { for (const x of el.children) x.classList.remove('on'); b.classList.add('on'); onChange(val); audio.ui(); };
    el.appendChild(b);
  }
}

function mapCards(el, value, onChange) {
  el.innerHTML = '';
  for (const m of MAPS) {
    const t = m.theme;
    const b = document.createElement('button');
    b.className = 'map-card';
    b.classList.toggle('on', m.id === value);
    const ground = t.mats.ground.color;
    const sil = Array.from({ length: 7 }, (_, i) => {
      const h = 18 + ((i * 37 + m.id.length * 13) % 40);
      return `<i style="left:${i * 14 + 2}%;width:${8 + (i % 3) * 4}%;height:${h}%"></i>`;
    }).join('');
    b.innerHTML = `<div class="sky" style="background:linear-gradient(180deg, ${t.skyTop}, ${t.skyBottom} 62%, ${ground} 62%)">${sil}</div><b>${esc(m.name)}</b><small>${esc(m.tagline)}</small>`;
    b.onclick = () => { for (const x of el.children) x.classList.remove('on'); b.classList.add('on'); onChange(m.id); audio.ui(); };
    el.appendChild(b);
  }
}

const solo = Object.assign({ map: 'cryo', mode: 'tdm', diff: 1, size: 5 }, store.get('po-solo', {}));
function buildSolo() {
  mapCards($('soloMaps'), solo.map, (v) => { solo.map = v; menuScene.load(v); store.set('po-solo', solo); });
  segmented($('soloMode'), [['tdm', 'Match à mort par équipe'], ['ffa', 'Mêlée générale']], solo.mode, (v) => { solo.mode = v; buildSoloSize(); store.set('po-solo', solo); });
  segmented($('soloDiff'), DIFFICULTIES.map((d, i) => [i, d.name]), solo.diff, (v) => { solo.diff = v; store.set('po-solo', solo); });
  buildSoloSize();
}
function buildSoloSize() {
  const ffa = solo.mode === 'ffa';
  $('soloSizeLabel').textContent = ffa ? 'Nombre de joueurs' : 'Taille des équipes';
  const opts = ffa ? [[6, '6'], [8, '8'], [10, '10']] : [[3, '3 c. 3'], [4, '4 c. 4'], [5, '5 c. 5'], [6, '6 c. 6']];
  if (!opts.some(([v]) => v === solo.size)) solo.size = opts[1][0];
  segmented($('soloSize'), opts, solo.size, (v) => { solo.size = v; store.set('po-solo', solo); });
}
buildSolo();

$('soloStart').onclick = () => {
  audio.unlock();
  const humans = [{ id: 'h', name: profile.name, weapon: profile.loadout.primary }];
  lastSolo = { ...solo };
  startMatch(makeConfig(solo), buildRoster(humans, solo), 'h', null);
};

function makeConfig(o) {
  const limits = { 3: 25, 4: 35, 5: 40, 6: 50 };
  return {
    map: o.map, mode: o.mode, diff: o.diff,
    scoreLimit: o.mode === 'ffa' ? 20 : limits[o.size] || 40,
    timeLimit: 480,
  };
}

function buildRoster(humans, o) {
  const roster = [];
  let bi = Math.floor(rand(0, 20));
  if (o.mode === 'ffa') {
    humans.forEach((h, i) => roster.push({ ...h, team: i }));
    for (let i = humans.length; i < o.size; i++) roster.push({ id: `b${i}`, name: botName(bi++), team: i, isBot: true, weapon: botWeapon() });
    return roster;
  }
  const count = [0, 0];
  humans.forEach((h, i) => {
    const team = o.coop !== false ? 0 : i % 2;
    count[team]++;
    roster.push({ ...h, team });
  });
  for (const team of [0, 1]) {
    for (let i = count[team]; i < Math.max(o.size, count[team]); i++) roster.push({ id: `b${team}_${i}`, name: botName(bi++), team, isBot: true, weapon: botWeapon() });
  }
  return roster;
}

// ─────────────────────────────────────────────── armurerie

let armSlot = 'primary';
let armClass = 'ar';
let armSel = profile.loadout.primary;

for (const b of document.querySelectorAll('.slot')) {
  b.onclick = () => {
    armSlot = b.dataset.slot;
    for (const x of document.querySelectorAll('.slot')) x.classList.toggle('on', x === b);
    armSel = profile.loadout[armSlot];
    armClass = getWeapon(armSel).cls;
    refreshArmory();
    audio.ui();
  };
}

function refreshArmory() {
  const classes = Object.keys(CLASSES).filter((c) => (armSlot === 'secondary') === (c === 'pistol'));
  if (!classes.includes(armClass)) armClass = classes[0];
  const tabs = $('armTabs');
  tabs.innerHTML = '';
  for (const c of classes) {
    const b = document.createElement('button');
    b.textContent = CLASSES[c];
    b.classList.toggle('on', c === armClass);
    b.onclick = () => { armClass = c; refreshArmory(); audio.ui(); };
    tabs.appendChild(b);
  }
  const list = $('armList');
  list.innerHTML = '';
  for (const w of WEAPONS.filter((x) => x.cls === armClass)) {
    const b = document.createElement('button');
    b.className = 'witem';
    b.classList.toggle('on', w.id === armSel);
    b.classList.toggle('equipped', w.id === profile.loadout[armSlot]);
    b.innerHTML = `<b>${esc(w.name)}</b><small>${w.mode === 'burst' ? 'RAFALE' : w.mode === 'auto' ? 'AUTO' : w.mode === 'bolt' ? 'VERROU' : w.mode === 'pump' ? 'POMPE' : 'SEMI-AUTO'}</small>`;
    b.onclick = () => { armSel = w.id; refreshArmory(); audio.ui(); };
    list.appendChild(b);
  }
  if (getWeapon(armSel).cls !== armClass) armSel = WEAPONS.find((x) => x.cls === armClass).id;
  const w = getWeapon(armSel);
  $('armClass').textContent = CLASSES[w.cls];
  $('armName').textContent = w.name;
  $('armDesc').textContent = w.desc;
  const st = weaponStats(w);
  $('armStats').innerHTML = ['Dégâts', 'Cadence', 'Portée', 'Précision', 'Mobilité']
    .map((k) => `<div class="stat"><span>${k}</span><div class="bar"><i style="width:${Math.max(4, Math.min(100, st[k]))}%"></i></div></div>`).join('');
  $('armFacts').innerHTML = `<span>Chargeur <b>${w.mag}</b></span><span>Cadence <b>${w.rpm} c/min</b></span>` +
    `<span>Dégâts <b>${w.damage[0]}${w.pellets > 1 ? ` × ${w.pellets}` : ''}</b></span><span>Rechargement <b>${w.reload.toFixed(1)} s</b></span>`;
  const equipped = profile.loadout[armSlot] === w.id;
  $('armEquip').textContent = equipped ? 'ÉQUIPÉE' : 'ÉQUIPER';
  $('armEquip').disabled = equipped;
  armoryScene.show(w);
}

$('armEquip').onclick = () => {
  profile.loadout[armSlot] = armSel;
  saveProfile();
  audio.ui();
  refreshArmory();
};

// ─────────────────────────────────────────────── paramètres

let settingsReturn = 'menu';
function bindSetting(id, key, fmt = (v) => v) {
  const el = $(id), out = $(`${id}V`);
  const isCheck = el.type === 'checkbox';
  if (isCheck) el.checked = settings[key]; else el.value = settings[key];
  if (out) out.textContent = fmt(settings[key]);
  el.addEventListener('input', () => {
    settings[key] = isCheck ? el.checked : el.tagName === 'SELECT' ? el.value : Number(el.value);
    if (out) out.textContent = fmt(settings[key]);
    if (key === 'volume') audio.setVolume(settings.volume);
    if (key === 'showFps') $('fps').hidden = !settings.showFps;
    saveSettings();
  });
}
bindSetting('setSens', 'sens', (v) => Number(v).toFixed(2));
bindSetting('setFov', 'fov', (v) => `${v}°`);
bindSetting('setVol', 'volume', (v) => `${Math.round(v * 100)}%`);
bindSetting('setQuality', 'quality');
bindSetting('setAuto', 'autoFire');
bindSetting('setAssist', 'aimAssist');
bindSetting('setInvert', 'invertY');
bindSetting('setFps', 'showFps');
$('fps').hidden = !settings.showFps;
$('setBack').onclick = () => { audio.ui(); show(settingsReturn); };
for (const b of document.querySelectorAll('[data-go="settings"]')) b.addEventListener('click', () => { settingsReturn = 'menu'; });

// ─────────────────────────────────────────────── multijoueur

const mpErr = (msg) => { const e = $('mpError'); e.hidden = !msg; e.textContent = msg || ''; };

$('mpCreate').onclick = async () => {
  audio.unlock();
  if (!net.available) { mpErr('Module réseau non chargé. Vérifie ta connexion.'); return; }
  mpErr('');
  $('mpCreate').disabled = true;
  $('mpCreate').textContent = 'CRÉATION…';
  try {
    const code = await net.createRoom(netHandlers);
    myNetId = 'h';
    lobby = { host: true, code, nextId: 1, players: [{ id: 'h', name: profile.name, peer: null, weapon: profile.loadout.primary }], cfg: { map: solo.map, mode: 'tdm', diff: 1, size: 5, coop: true } };
    renderLobby();
  } catch (err) {
    mpErr(err.message);
  } finally {
    $('mpCreate').disabled = false;
    $('mpCreate').textContent = 'CRÉER UN SALON';
  }
};

$('mpJoin').onclick = async () => {
  audio.unlock();
  const code = $('mpCode').value.trim().toUpperCase();
  if (code.length !== 5) { mpErr('Le code fait 5 caractères.'); return; }
  if (!net.available) { mpErr('Module réseau non chargé. Vérifie ta connexion.'); return; }
  mpErr('');
  $('mpJoin').disabled = true;
  $('mpJoin').textContent = '…';
  try {
    await net.joinRoom(code, netHandlers);
    lobby = { host: false, code, players: [], cfg: null };
    net.send({ t: 'hello', name: profile.name, weapon: profile.loadout.primary });
    renderLobby();
  } catch (err) {
    mpErr(err.message);
    net.close();
  } finally {
    $('mpJoin').disabled = false;
    $('mpJoin').textContent = 'REJOINDRE';
  }
};

$('mpBack').onclick = (e) => {
  if (lobby) { e.stopPropagation(); leaveLobby(); }
};

function leaveLobby() {
  net.close();
  lobby = null;
  $('mpHome').hidden = false;
  $('mpLobby').hidden = true;
  show('menu');
}

$('lobbyShare').onclick = async () => {
  const text = `Rejoins mon salon Protocole Ombre avec le code ${lobby.code}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Protocole Ombre', text, url: location.href });
    else { await navigator.clipboard.writeText(lobby.code); $('lobbyShare').textContent = 'Copié !'; }
  } catch { /* partage annulé */ }
};

function renderLobby() {
  if (!lobby) return;
  $('mpHome').hidden = true;
  $('mpLobby').hidden = false;
  $('lobbyCode').textContent = lobby.code;
  $('lobbyPlayers').innerHTML = lobby.players.map((p) => `<li>${esc(p.name)}<small>${p.id === 'h' ? 'HÔTE' : ''}${p.id === myNetId ? ' (toi)' : ''}</small></li>`).join('');
  $('lobbyHostOpts').hidden = !lobby.host;
  $('lobbyWait').hidden = lobby.host;
  if (lobby.host) {
    const c = lobby.cfg;
    const upd = () => broadcastLobby();
    mapCards($('mpMaps'), c.map, (v) => { c.map = v; menuScene.load(v); upd(); });
    segmented($('mpMode'), [['tdm', 'Équipes'], ['ffa', 'Mêlée']], c.mode, (v) => { c.mode = v; if (v === 'ffa' && c.size < 6) c.size = 8; if (v === 'tdm' && c.size > 6) c.size = 5; renderLobby(); upd(); });
    segmented($('mpDiff'), DIFFICULTIES.map((d, i) => [i, d.name]), c.diff, (v) => { c.diff = v; upd(); });
    const sizes = c.mode === 'ffa' ? [[6, '6'], [8, '8'], [10, '10']] : [[3, '3c3'], [4, '4c4'], [5, '5c5'], [6, '6c6']];
    segmented($('mpSize'), sizes, c.size, (v) => { c.size = v; upd(); });
    segmented($('mpCoop'), [[true, 'Ensemble vs bots'], [false, 'Les uns contre les autres']], c.coop, (v) => { c.coop = v; upd(); });
  } else if (lobby.cfg) {
    const c = lobby.cfg;
    $('lobbyCfg').textContent = `· ${getMap(c.map).name} · ${c.mode === 'ffa' ? 'Mêlée générale' : 'Match à mort par équipe'} · bots ${DIFFICULTIES[c.diff].name}`;
  }
}

function broadcastLobby() {
  if (!lobby || !lobby.host) return;
  net.broadcast({ t: 'lobby', players: lobby.players.map(({ id, name }) => ({ id, name })), cfg: lobby.cfg });
  $('lobbyPlayers').innerHTML = lobby.players.map((p) => `<li>${esc(p.name)}<small>${p.id === 'h' ? 'HÔTE (toi)' : ''}</small></li>`).join('');
}

$('lobbyStart').onclick = () => {
  audio.unlock();
  const c = lobby.cfg;
  const humans = lobby.players.map((p) => ({ id: p.id, name: p.name, peer: p.peer, weapon: p.weapon }));
  const roster = buildRoster(humans, c);
  const cfg = makeConfig(c);
  net.broadcast({ t: 'start', cfg, roster: roster.map(({ peer, ...r }) => r) });
  startMatch(cfg, roster, 'h', net);
};

const netHandlers = {
  onJoin(peerId) { /* attente du « hello » */ },
  onLeave(peerId) {
    if (!lobby) return;
    const p = lobby.players.find((x) => x.peer === peerId);
    lobby.players = lobby.players.filter((x) => x.peer !== peerId);
    if (match) match.playerLeft(peerId);
    else if (p) { renderLobby(); broadcastLobby(); }
  },
  onHostLost() {
    if (match) { quitMatch(); }
    lobby = null;
    $('mpHome').hidden = false; $('mpLobby').hidden = true;
    show('mp');
    mpErr('Connexion à l\'hôte perdue.');
  },
  onError(msg) { if (!match) mpErr(msg); },
  onData(from, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (lobby && lobby.host) {
      if (msg.t === 'hello') {
        if (match) { net.sendTo(from, { t: 'busy' }); return; }
        if (lobby.players.length >= 12) { net.sendTo(from, { t: 'full' }); return; }
        const id = `p${lobby.nextId++}`;
        const name = String(msg.name || 'Opérateur').replace(/[^\p{L}\p{N} _\-.]/gu, '').slice(0, 16) || 'Opérateur';
        const weapon = getWeapon(msg.weapon).id;
        lobby.players.push({ id, name, peer: from, weapon });
        net.sendTo(from, { t: 'welcome', id });
        renderLobby();
        broadcastLobby();
        return;
      }
      if (match) match.onMessage(from, msg);
      return;
    }
    // Client
    switch (msg.t) {
      case 'welcome': myNetId = msg.id; renderLobby(); return;
      case 'lobby': if (lobby) { lobby.players = msg.players; lobby.cfg = msg.cfg; if (!match) { renderLobby(); menuScene.load(msg.cfg.map); } } return;
      case 'busy': mpErr('Une partie est déjà en cours dans ce salon. Réessaie à la fin.'); net.close(); lobby = null; $('mpHome').hidden = false; $('mpLobby').hidden = true; return;
      case 'full': mpErr('Salon complet.'); net.close(); lobby = null; $('mpHome').hidden = false; $('mpLobby').hidden = true; return;
      case 'start': {
        const me = msg.roster.find((r) => r.id === myNetId);
        if (!me) return;
        startMatch(msg.cfg, msg.roster, myNetId, net);
        return;
      }
      default: if (match) match.onMessage(from, msg);
    }
  },
};

// ─────────────────────────────────────────────── cycle d'une partie

function startMatch(cfg, roster, localId, netRef) {
  if (match) { match.dispose(); match = null; }
  setupRenderer();
  menuScene.dispose(); menuScene.mapId = null;
  const me = roster.find((r) => r.id === localId);
  const theme = getMap(cfg.map).theme;
  renderer.toneMappingExposure = theme.exposure || 1;
  match = new Match({
    renderer, quality, cfg, roster, localId, net: netRef, hud, input, vm, settings,
    localTeam: me.team, loadout: profile.loadout,
    onEnd: endMatch, onPause: pauseMatch,
  });
  hud.setup(match);
  hud.show(true);
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  screen = 'game';
  document.body.classList.add('in-game');
  input.onPause = pauseMatch;
  input.setEnabled(true);
  if (touch) {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().then(() => window.screen.orientation?.lock?.('landscape')).catch(() => {});
  } else input.requestLock();
}

function pauseMatch() {
  if (!match || match.ended || screen === 'pause') return;
  input.setEnabled(false);
  input.releaseLock();
  match.paused = true;
  show('pause');
}

$('pauseResume').onclick = () => {
  if (!match) return;
  for (const s of document.querySelectorAll('.screen')) s.hidden = true;
  screen = 'game';
  match.paused = false;
  input.setEnabled(true);
  input.requestLock();
};
$('pauseSettings').onclick = () => { settingsReturn = 'pause'; show('settings'); };
$('pauseQuit').onclick = () => {
  quitMatch();
  if (lobby) { lobby = null; net.close(); $('mpHome').hidden = false; $('mpLobby').hidden = true; }
  show('menu');
};

function quitMatch() {
  if (!match) return;
  input.setEnabled(false);
  input.releaseLock();
  match.dispose();
  match = null;
  hud.show(false);
  document.body.classList.remove('in-game');
  setupRenderer();
  menuScene.load(lobby && lobby.cfg ? lobby.cfg.map : solo.map);
}

function endMatch(res) {
  const lvlBefore = levelOf(profile.xp);
  const xp = Math.max(0, res.me.score) + (res.win ? 500 : res.draw ? 300 : 150) + res.me.kills * 10;
  profile.xp += xp; profile.kills += res.me.kills; profile.deaths += res.me.deaths; profile.matches++;
  if (res.win) profile.wins++;
  saveProfile();
  quitMatch();
  const lvl = levelOf(profile.xp);
  const title = $('resTitle');
  title.textContent = res.draw ? 'ÉGALITÉ' : res.win ? 'VICTOIRE' : 'DÉFAITE';
  title.className = res.draw ? '' : res.win ? 'win' : 'lose';
  $('resSub').textContent = res.ffa
    ? `${res.map} · Mêlée générale`
    : `${res.map} · ${res.teamScore[res.myTeam]} – ${res.teamScore[1 - res.myTeam]}`;
  $('resXpText').textContent = `+${xp} XP${lvl > lvlBefore ? ` · NIVEAU ${lvl} ATTEINT !` : ` · NIVEAU ${lvl}`}`;
  $('resXp').style.width = '0%';
  requestAnimationFrame(() => { $('resXp').style.width = `${((profile.xp - levelBase(lvl)) / (levelBase(lvl + 1) - levelBase(lvl))) * 100}%`; });
  const rows = res.table.map((r) => `<tr class="${r.isLocal ? 'me' : ''} ${res.ffa ? '' : r.ally ? 'ally' : 'foe'}"><td>${esc(r.name)}${r.isBot ? ' <small>BOT</small>' : ''}</td><td>${r.score}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.deaths ? (r.kills / r.deaths).toFixed(2) : r.kills}</td></tr>`).join('');
  $('resTable').innerHTML = `<table><tr><th>Joueur</th><th>Score</th><th>Élim.</th><th>Morts</th><th>Ratio</th></tr>${rows}</table>`;
  $('resAgain').textContent = lobby ? 'RETOUR AU SALON' : 'REJOUER';
  show('results');
}

$('resAgain').onclick = () => {
  if (lobby) { show('mp'); renderLobby(); return; }
  if (lastSolo) startMatch(makeConfig(lastSolo), buildRoster([{ id: 'h', name: profile.name, weapon: profile.loadout.primary }], lastSolo), 'h', null);
};
$('resMenu').onclick = () => { if (lobby) leaveLobby(); else show('menu'); };

// ─────────────────────────────────────────────── boucle

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  if (match) match.resize(innerWidth, innerHeight);
});

let last = performance.now();
let fpsAcc = 0, fpsN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (settings.showFps) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsAcc)} i/s`; fpsAcc = 0; fpsN = 0; }
  }
  if (match) {
    match.update(dt);
    if (match) render(match.scene, match.camera, match.map.theme.bloom, true);
    return;
  }
  if (screen === 'armory') {
    armoryScene.update(dt);
    render(armoryScene.scene, armoryScene.camera, 0.5, false);
    return;
  }
  if (menuScene.world) {
    menuScene.update(dt);
    render(menuScene.scene, menuScene.camera, menuScene.bloom, false);
  }
}

// ─────────────────────────────────────────────── démarrage

async function boot() {
  const step = (p, text) => { $('bootFill').style.width = `${p}%`; $('bootText').textContent = text; };
  step(20, 'Chargement du moteur…');
  await new Promise((r) => setTimeout(r, 30));
  step(55, 'Génération de la carte…');
  await new Promise((r) => setTimeout(r, 30));
  menuScene.load(solo.map);
  step(90, 'Préparation de l\'arsenal…');
  await new Promise((r) => setTimeout(r, 30));
  armoryScene.show(getWeapon(profile.loadout.primary));
  // Précompilation des shaders du menu
  renderer.compile(menuScene.scene, menuScene.camera);
  step(100, 'Prêt');
  requestAnimationFrame(frame);
  setTimeout(() => show('menu'), 200);
}

// Accès de débogage (console du navigateur)
window.__po = { get match() { return match; }, settings, profile, armoryScene, THREE };

boot().catch((err) => {
  console.error(err);
  $('bootText').textContent = `Erreur au démarrage : ${err.message}. Ton appareil gère-t-il WebGL 2 ?`;
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
