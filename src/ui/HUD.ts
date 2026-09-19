import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import { LANDMARKS, worldToLatLon } from '../world/geodata/geodata';
import type { Settings, SaveManager } from '../core/SaveManager';
import type { QualityPreset } from '../core/config';
import type { TimeKind, WeatherKind } from '../core/types';
import { CityMap } from './CityMap';
import { icon, POWERS } from './icons';
export interface HUDHooks { power:(name:string)=>void; travel:(id:string,debug?:boolean)=>void; settings:(settings:Settings)=>void; pause:(open:boolean)=>void; debug:(option:string,value:boolean|number)=>void; reset:()=>void; stress:()=>void }
export interface HUDState { position:Vector3; origin:Vector3; velocity:Vector3; yaw:number; state:string; size:number; selected:string; temporal:boolean; title:string; objective:string; hint:string; destination:Vector3; remaining:number; stage:number; time:string; weather:string; fps:number; backend:string; speedMode:string; megaMode:boolean; spaceFactor:number; debug:Record<string,string|number> }
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
export class HUD {
  private mini:CityMap;private map:CityMap;private elapsed=0;private mapElapsed=0;private toastTimer=0;private lastPlace='';private temp=new Vector3();
  private openPanel='';debugOpen=false;
  constructor(private save:SaveManager,private hooks:HUDHooks){
    const root=document.createElement('div');root.id='hud';root.innerHTML=`
      <div class="screen-shade"></div><header class="topbar"><a class="brand" aria-label="DR Manaus"><span class="brand-sigil"><i></i></span><span><b>DR MANAUS</b><small>AMAZÔNIA · MUNDO ABERTO</small></span></a>
      <div class="compass"><div class="compass-labels"><span>SO</span><span>O</span><strong id="heading">N</strong><span>NE</span><span>L</span></div><div class="compass-ticks"></div><i class="compass-needle"></i></div>
      <div class="top-actions"><div class="world-clock">${icon('sun',18)}<span id="world-time">17:42</span><i></i><span id="world-weather">CÉU LIMPO</span></div><button class="icon-button" data-panel="help" title="Controles (H)" aria-label="Abrir controles">${icon('help')}</button><button class="icon-button" data-panel="settings" title="Configurações" aria-label="Abrir configurações">${icon('settings')}</button></div></header>
      <section class="mission"><div class="eyebrow"><span class="tiny-diamond"></span><span id="mission-type">CAPÍTULO 01</span></div><h1 id="mission-title">O Despertar</h1><div class="mission-rule"></div><p id="mission-objective">Decole do Teatro Amazonas</p><span class="mission-distance" id="mission-distance">Sua história começa aqui</span></section>
      <div class="crosshair"><i></i><i></i><i></i><i></i><b></b></div>
      <div id="objective-marker" class="objective-marker" hidden><span>◇</span><small></small></div>
      <div class="welcome" id="welcome"><span>VOCÊ É A ENERGIA DESTA CIDADE.</span><p>O horizonte é só o começo.</p></div>
      <div class="toast" id="toast" role="status"></div>
      <div class="location"><span class="eyebrow">MANAUS, AMAZONAS</span><h2 id="place-name">Teatro Amazonas</h2><p id="coordinates">3.1303° S &nbsp; 60.0234° O</p><div class="location-line"><i></i><span id="location-state">CENTRO HISTÓRICO</span></div></div>
      <footer class="power-dock"><div class="power-caption"><span>MANIPULAÇÃO CÓSMICA</span><i></i><span id="power-current">EMISSÃO DE ENERGIA</span></div><div class="power-buttons">${POWERS.map(([id,label,key],i)=>`<button class="power ${i===0?'active':''}" data-power="${id}" title="${label} (${key})" aria-label="${label}">${icon(id)}<kbd>${key}</kbd><span>${label}</span></button>`).join('')}</div><div class="control-hint" id="control-hint"><kbd>F</kbd> levitar <i></i><kbd>W A S D</kbd> mover <i></i><span>clique na cena para controlar a câmera</span></div></footer>
      <aside class="mini-cluster"><div class="space-band" id="space-band" hidden>${icon('flight',11)}<span id="space-label">ALTA ATMOSFERA</span><i></i></div><div class="flight-modes" id="flight-modes"><b data-mode="normal">NORMAL</b><b data-mode="fast">RÁPIDO</b><b data-mode="super">SUPER</b><b data-mode="mega">MEGA</b></div><div class="flight-readout">${icon('flight',17)}<span id="flight-state">EM SOLO</span><b id="speed">0</b><small>km/h</small></div><button class="minimap-button" data-panel="map" aria-label="Abrir mapa da cidade"><canvas id="minimap"></canvas><span class="map-caption">${icon('map',13)} EXPLORAR MANAUS <kbd>M</kbd></span></button><div class="mini-status"><i></i><span id="render-state">MUNDO CONECTADO</span><span id="altitude">38 m</span></div></aside>
      <div id="panel-backdrop" class="panel-backdrop" hidden></div>
      <section class="panel settings-panel" id="settings-panel" hidden><div class="panel-header"><div><span class="eyebrow">SEU MUNDO</span><h2>Configurações</h2></div><button class="icon-button close-panel" aria-label="Fechar configurações">${icon('close')}</button></div>
        <label>Qualidade gráfica<select id="quality">${['Low','Medium','High','Ultra'].map(x=>`<option>${x}</option>`).join('')}</select></label>
        <label class="toggle-label">Resolução dinâmica<input id="dynamic" type="checkbox"/></label><p class="field-note">Ajusta a resolução e a densidade local conforme a performance.</p>
        <div class="section-line"></div><label>Hora do dia<select id="time">${[['Morning','Amanhecer'],['Noon','Meio-dia'],['Golden Hour','Hora dourada'],['Night','Noite']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label class="toggle-label">Ciclo de iluminação<input id="day-cycle" type="checkbox"/></label>
        <label>Clima<select id="weather">${[['clear','Céu limpo'],['cloudy','Nublado'],['rain','Chuva amazônica'],['storm','Temporal']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
        <div class="section-line"></div><label class="toggle-label">Paisagem sonora<input id="sound" type="checkbox"/></label><button class="text-button" id="reset-save">Recomeçar O Despertar</button><p class="field-note">Apaga as descobertas e o progresso local.</p><div class="build-stamp">DR MANAUS <span>EXPERIMENTAL / 0.1</span></div>
      </section>
      <section class="panel map-panel" id="map-panel" hidden><div class="panel-header"><div><span class="eyebrow">03° S · 60° O</span><h2>Uma cidade. Infinitas possibilidades.</h2></div><button class="icon-button close-panel" aria-label="Fechar mapa">${icon('close')}</button></div><div class="map-layout"><div class="map-visual"><canvas id="city-map"></canvas><div class="map-scale">━━━━━━ <span>5 km</span></div><span class="map-credit">Dados viários © OpenStreetMap contributors · Geografia estilizada</span></div><div class="map-destinations"><span class="eyebrow">PONTOS DE INTERESSE</span><div id="landmark-list"></div><p>Descubra um lugar voando até ele para liberar a translocação.</p></div></div></section>
      <section class="panel help-panel" id="help-panel" hidden><div class="panel-header"><div><span class="eyebrow">NÃO HÁ LIMITES</span><h2>Controle a matéria.</h2></div><button class="icon-button close-panel" aria-label="Fechar controles">${icon('close')}</button></div><div class="help-grid">${[['W A S D','Mover'],['Mouse','Olhar ao redor'],['F','Alternar voo'],['Espaço','Pular / subir'],['Ctrl','Descer'],['Shift','Correr / acelerar'],['B (segurar)','Voo supersônico'],['Clique / 1','Emitir energia'],['E','Teleportar à mira'],['Q','Onda de choque'],['R','Reconstruir matéria'],['G','Normal / gigante / colossal'],['C','Criar ecos temporários'],['T','Percepção temporal'],['M','Mapa e destinos'],['F3','Métricas e debug']].map(([key,label])=>`<div><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div><p class="field-note">Clique na cena para capturar o mouse. Esc libera o cursor. Arrastar também gira a câmera.</p></section>
      <section class="debug-panel" id="debug-panel" hidden><div class="eyebrow">DIAGNÓSTICO · F3</div><div id="debug-metrics"></div><div class="debug-controls"><select id="debug-travel"><option value="">Teleportar para…</option>${LANDMARKS.map(l=>`<option value="${l.id}">${l.shortName}</option>`).join('')}</select>${[['bounds','Limites de chunks'],['lod','Cores de LOD'],['hlod','HLOD'],['wireframe','Wireframe'],['culling','Frustum de câmera']].map(([id,label])=>`<label><input type="checkbox" data-debug="${id}"/>${label}</label>`).join('')}<label>Velocidade <input type="range" min="0.25" max="3" step="0.25" value="1" id="flight-speed"/></label><button class="text-button" id="stress-run">Iniciar rota de stress</button></div></section>
      <div class="loading-tag" id="loading-tag"><span class="spinner"></span>Despertando sobre a Amazônia…</div>`;
    document.querySelector('#app')!.append(root);
    this.mini=new CityMap($('#minimap'),false);this.map=new CityMap($('#city-map'),true);
    root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button=>button.onclick=()=>this.togglePanel(button.dataset.panel!));
    root.querySelectorAll<HTMLButtonElement>('.close-panel').forEach(button=>button.onclick=()=>this.togglePanel(''));
    $('#panel-backdrop').onclick=()=>this.togglePanel('');
    root.querySelectorAll<HTMLButtonElement>('[data-power]').forEach(button=>button.onclick=()=>hooks.power(button.dataset.power!));
    const s=save.data.settings;$('#quality').setAttribute('value',s.quality);$<HTMLSelectElement>('#quality').value=s.quality;$<HTMLSelectElement>('#time').value=s.time;$<HTMLSelectElement>('#weather').value=s.weather;
    $<HTMLInputElement>('#dynamic').checked=s.dynamicResolution;$<HTMLInputElement>('#sound').checked=s.sound;$<HTMLInputElement>('#day-cycle').checked=s.dayCycle;
    ['quality','time','weather','dynamic','sound','day-cycle'].forEach(id=>$('#'+id).onchange=()=>hooks.settings({quality:$<HTMLSelectElement>('#quality').value as QualityPreset,time:$<HTMLSelectElement>('#time').value as TimeKind,weather:$<HTMLSelectElement>('#weather').value as WeatherKind,dynamicResolution:$<HTMLInputElement>('#dynamic').checked,sound:$<HTMLInputElement>('#sound').checked,dayCycle:$<HTMLInputElement>('#day-cycle').checked}));
    $('#reset-save').onclick=hooks.reset;$('#stress-run').onclick=()=>{this.togglePanel('');hooks.stress();};
    $('#debug-travel').onchange=()=>{const select=$<HTMLSelectElement>('#debug-travel');if(select.value)hooks.travel(select.value,true);select.value='';};
    root.querySelectorAll<HTMLInputElement>('[data-debug]').forEach(input=>input.onchange=()=>hooks.debug(input.dataset.debug!,input.checked));
    $('#flight-speed').oninput=()=>hooks.debug('speed',Number($<HTMLInputElement>('#flight-speed').value));
    $('#city-map').onclick=(event)=>{const id=this.map.hit(event.clientX,event.clientY);if(id)this.travel(id);};
    this.refreshDestinations();
  }
  get panelOpen(){return !!this.openPanel;}
  ready(){ $('#loading-tag').hidden=true; }
  togglePanel(panel:string){this.openPanel=this.openPanel===panel?'':panel;['map','settings','help'].forEach(id=>$('#'+id+'-panel').hidden=this.openPanel!==id);$('#panel-backdrop').hidden=!this.openPanel;this.hooks.pause(!!this.openPanel);if(panel==='map')this.refreshDestinations();}
  toggleDebug(){this.debugOpen=!this.debugOpen;$('#debug-panel').hidden=!this.debugOpen;if(this.debugOpen&&document.pointerLockElement)void document.exitPointerLock();}
  notify(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');this.toastTimer=4;}
  private travel(id:string){if(!this.save.data.discovered.includes(id)){this.notify('Voe até este lugar para descobrir sua assinatura.');return;}this.togglePanel('');this.hooks.travel(id);}
  refreshDestinations(){const list=$('#landmark-list');list.innerHTML=LANDMARKS.map(l=>`<button class="destination ${this.save.data.discovered.includes(l.id)?'discovered':''}" data-id="${l.id}"><span>${icon('pin',16)}${l.shortName}</span><small>${this.save.data.discovered.includes(l.id)?'TRANSLOCAR ↗':'NÃO DESCOBERTO'}</small></button>`).join('');list.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.onclick=()=>this.travel(button.dataset.id!));}
  update(dt:number,state:HUDState,camera:PerspectiveCamera){
    this.elapsed+=dt;this.mapElapsed+=dt;this.toastTimer-=dt;if(this.toastTimer<=0)$('#toast').classList.remove('visible');
    if(this.elapsed<.1)return;this.elapsed=0;
    $('#welcome').classList.toggle('faded',performance.now()>16000||state.velocity.length()>2);
    const nearest=LANDMARKS.reduce((best,l)=>Math.hypot(l.x-state.position.x,l.z-state.position.z)<Math.hypot(best.x-state.position.x,best.z-state.position.z)?l:best,LANDMARKS[0]);
    const near=Math.hypot(nearest.x-state.position.x,nearest.z-state.position.z)<Math.max(400,nearest.radius*2);
    const place=near?nearest.name:'Sobre a Amazônia';if(this.lastPlace!==place){$('#place-name').textContent=place;this.lastPlace=place;}
    $('#location-state').textContent=state.temporal?'PERCEPÇÃO TEMPORAL':state.size>12?'MAGNITUDE COLOSSAL':state.size>2?'MAGNITUDE GIGANTE':near?'ASSINATURA LOCALIZADA':'EXPLORAÇÃO LIVRE';
    const geo=worldToLatLon(state.position.x,state.position.z);$('#coordinates').textContent=`${Math.abs(geo.lat).toFixed(4)}° S   ${Math.abs(geo.lon).toFixed(4)}° O`;
    $('#mission-title').textContent=state.title;$('#mission-objective').textContent=state.objective;$('#mission-type').textContent=state.stage>=4?'EXPLORAÇÃO LIVRE':'CAPÍTULO 01';
    const distance=state.position.distanceTo(state.destination);$('#mission-distance').textContent=state.stage===0?'F para levitar · Espaço para subir':`${distance>1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m'}${state.remaining?' · '+state.remaining+' assinaturas':''}`;
    $('#control-hint').textContent=state.hint;
    for(const badge of document.querySelectorAll<HTMLElement>('#flight-modes b')){const mode=badge.dataset.mode!;badge.classList.toggle('on',mode===state.speedMode);badge.classList.toggle('armed',mode==='mega'&&state.megaMode&&state.speedMode!=='mega');}
    // The orbital band only appears once the atmosphere has actually started to thin.
    const band=$('#space-band');band.hidden=state.spaceFactor<=.02;
    if(!band.hidden)$('#space-label').textContent=state.spaceFactor>.92?'ÓRBITA':state.spaceFactor>.55?'LINHA DE KÁRMÁN':'ALTA ATMOSFERA';
    $('#speed').textContent=Math.round(state.velocity.length()*3.6).toString();$('#altitude').textContent=Math.round(state.position.y)+' m';$('#flight-state').textContent=state.velocity.length()>343?'SUPERSÔNICO':state.state==='Grounded'?'EM SOLO':state.state==='Hover'?'LEVITANDO':'EM VOO';
    $('#world-time').textContent=state.time;$('#world-weather').textContent=({clear:'CÉU LIMPO',cloudy:'NUBLADO',rain:'CHUVA',storm:'TEMPORAL'} as Record<string,string>)[state.weather]??state.weather;
    const directions=['N','NE','L','SE','S','SO','O','NO'];const heading=((state.yaw*180/Math.PI)%360+360)%360;$('#heading').textContent=directions[Math.round(heading/45)%8];
    document.querySelectorAll<HTMLButtonElement>('[data-power]').forEach(button=>button.classList.toggle('active',button.dataset.power===state.selected));
    $('#power-current').textContent=POWERS.find(p=>p[0]===state.selected)?.[1].toUpperCase()??'EMISSÃO';
    document.body.classList.toggle('temporal',state.temporal);document.body.classList.toggle('supersonic',state.velocity.length()>300);
    const marker=$('#objective-marker');this.temp.copy(state.destination).sub(state.origin).project(camera);marker.hidden=state.stage===0||state.stage===4&&state.remaining===0||this.temp.z>1||Math.abs(this.temp.x)>.85||Math.abs(this.temp.y)>.7;
    if(!marker.hidden){marker.style.left=`${(this.temp.x*.5+.5)*100}%`;marker.style.top=`${(-this.temp.y*.5+.5)*100}%`;marker.querySelector('small')!.textContent=distance>1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';}
    if(this.debugOpen)$('#debug-metrics').innerHTML=Object.entries(state.debug).map(([key,value])=>`<div><span>${key}</span><b>${value}</b></div>`).join('');
    if(this.mapElapsed>.3){this.mapElapsed=0;this.mini.draw(state.position,state.yaw,this.save.data.discovered,state.stage>0?state.destination:undefined);if(this.openPanel==='map')this.map.draw(state.position,state.yaw,this.save.data.discovered,state.destination);}
  }
}
