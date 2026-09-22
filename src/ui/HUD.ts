import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import { LANDMARKS, worldToLatLon } from '../world/geodata/geodata';
import type { Settings, SaveManager } from '../core/SaveManager';
import type { QualityPreset } from '../core/config';
import type { TimeKind, WeatherKind } from '../core/types';
import { CityMap } from './CityMap';
import { icon, POWERS } from './icons';
export interface HUDHooks { power:(name:string)=>void; travel:(id:string,debug?:boolean)=>void; settings:(settings:Settings)=>void; pause:(open:boolean)=>void; debug:(option:string,value:boolean|number)=>void; reset:()=>void; stress:()=>void }
export interface HUDState { position:Vector3; origin:Vector3; velocity:Vector3; yaw:number; state:string; size:number; selected:string; temporal:boolean; title:string; objective:string; hint:string; destination:Vector3; remaining:number; stage:number; time:string; weather:string; fps:number; backend:string; speedMode:string; megaMode:boolean; spaceFactor:number; district:string; debug:Record<string,string|number> }
const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
/** A labelled slider with a live readout; `format` turns the raw value into what the player reads. */
const slider=(id:string,label:string,min:number,max:number,step:number,note='')=>
  `<label class="slider-row"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"/><b id="${id}-value">—</b></label>${note?`<p class="field-note">${note}</p>`:''}`;
const toggle=(id:string,label:string,note='')=>
  `<label class="toggle-label">${label}<input id="${id}" type="checkbox"/></label>${note?`<p class="field-note">${note}</p>`:''}`;
const choice=(id:string,label:string,options:readonly (readonly [string,string])[])=>
  `<label>${label}<select id="${id}">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></label>`;
const PAUSE_TABS=[['audio','Áudio'],['video','Vídeo'],['world','Mundo'],['controls','Controles'],['progress','Progresso']] as const;
const CONTROLS: readonly (readonly [string,string])[]=[
  ['F5','Câmera: atrás / ombro / primeira pessoa / frente / olhar para trás'],['X','Alternar energia / combate'],
  ['Clique (combate)','Sequência: jab / direto / uppercut'],['Botão direito (combate)','Sequência: chute frontal / lateral / circular'],
  ['Espaço (solo)','Pulo duplo / parkour'],['Shift (solo)','Correr'],['B / V + B (solo)','Super / mega corrida'],
  ['W A S D','Mover'],['Mouse','Olhar ao redor'],['F','Alternar voo'],['Espaço','Subir'],
  ['Ctrl','Descer'],['Shift','Voo rápido'],['B (segurar)','Super velocidade'],['V','Armar mega velocidade'],
  ['L','Ligar / desligar laser continuo'],['Clique / 1','Emitir energia'],['E','Teleportar à mira'],['Q','Onda de choque'],['R','Reconstruir matéria'],
  ['G','Alternar tamanho até 1 km'],['C','Criar ecos temporários'],['T','Percepção temporal'],
  ['M','Mapa e destinos'],['H','Controles'],['Esc','Menu de pausa'],['F3','Métricas e debug'],
];
export class HUD {
  private mini:CityMap;private map:CityMap;private elapsed=0;private mapElapsed=0;private toastTimer=0;private lastPlace='';private temp=new Vector3();
  private openPanel='';private pauseTab='audio';private lastFps=0;private lastBackend='\u2014';debugOpen=false;
  constructor(private save:SaveManager,private hooks:HUDHooks){
    const root=document.createElement('div');root.id='hud';root.innerHTML=`
      <div class="screen-shade"></div><header class="topbar"><a class="brand" aria-label="DR Manaus"><span class="brand-sigil"><i></i></span><span><b>DR MANAUS</b><small>AMAZÔNIA · MUNDO ABERTO</small></span></a>
      <div class="compass"><div class="compass-labels"><span>SO</span><span>O</span><strong id="heading">N</strong><span>NE</span><span>L</span></div><div class="compass-ticks"></div><i class="compass-needle"></i></div>
      <div class="top-actions"><div class="world-clock">${icon('sun',18)}<span id="world-time">17:42</span><i></i><span id="world-weather">CÉU LIMPO</span></div><button class="icon-button" data-tab-open="controls" title="Controles (H)" aria-label="Abrir controles">${icon('help')}</button><button class="icon-button" data-tab-open="video" title="Menu de pausa (Esc)" aria-label="Abrir menu de pausa">${icon('settings')}</button></div></header>
      <section class="mission"><div class="eyebrow"><span class="tiny-diamond"></span><span id="mission-type">CAPÍTULO 01</span></div><h1 id="mission-title">O Despertar</h1><div class="mission-rule"></div><p id="mission-objective">Decole do Teatro Amazonas</p><span class="mission-distance" id="mission-distance">Sua história começa aqui</span></section>
      <div class="crosshair"><i></i><i></i><i></i><i></i><b></b></div>
      <div id="objective-marker" class="objective-marker" hidden><span>◇</span><small></small></div>
      <div class="welcome" id="welcome"><span>VOCÊ É A ENERGIA DESTA CIDADE.</span><p>O horizonte é só o começo.</p></div>
      <div class="toast" id="toast" role="status"></div>
      <div class="location"><span class="eyebrow">MANAUS · <b id="district">AMAZONAS</b></span><h2 id="place-name">Teatro Amazonas</h2><p id="coordinates">3.1303° S &nbsp; 60.0234° O</p><div class="location-line"><i></i><span id="location-state">CENTRO HISTÓRICO</span></div></div>
      <footer class="power-dock"><div class="power-caption"><span>MANIPULAÇÃO CÓSMICA</span><i></i><span id="power-current">EMISSÃO DE ENERGIA</span></div><div class="power-buttons">${POWERS.map(([id,label,key],i)=>`<button class="power ${i===0?'active':''}" data-power="${id}" title="${label} (${key})" aria-label="${label}">${icon(id)}<kbd>${key}</kbd><span>${label}</span></button>`).join('')}</div><div class="control-hint" id="control-hint"><kbd>F</kbd> levitar <i></i><kbd>W A S D</kbd> mover <i></i><span>clique na cena para controlar a câmera</span></div></footer>
      <aside class="mini-cluster"><div class="space-band" id="space-band" hidden>${icon('flight',11)}<span id="space-label">ALTA ATMOSFERA</span><i></i></div><div class="flight-modes" id="flight-modes"><b data-mode="normal">NORMAL</b><b data-mode="fast">RÁPIDO</b><b data-mode="super">SUPER</b><b data-mode="mega">MEGA</b></div><div class="flight-readout">${icon('flight',17)}<span id="flight-state">EM SOLO</span><b id="speed">0</b><small>km/h</small></div><button class="minimap-button" data-panel="map" aria-label="Abrir mapa da cidade"><canvas id="minimap"></canvas><span class="map-caption">${icon('map',13)} EXPLORAR MANAUS <kbd>M</kbd></span></button><div class="mini-status"><i></i><span id="render-state">MUNDO CONECTADO</span><span id="altitude">38 m</span></div></aside>
      <div id="panel-backdrop" class="panel-backdrop" hidden></div>
      <section class="panel pause-panel" id="pause-panel" hidden><div class="pause-layout">
        <nav class="pause-nav"><span class="eyebrow">JOGO PAUSADO</span><h2>DR Manaus</h2>
          <button class="pause-tab resume" id="resume-game">${icon('flight',15)} Retomar</button>
          ${PAUSE_TABS.map(([id,label])=>`<button class="pause-tab" data-tab="${id}">${label}</button>`).join('')}
          <div class="build-stamp">DR MANAUS <span>EXPERIMENTAL / 0.1</span></div></nav>
        <div class="pause-content">
          <div class="pause-section" data-section="audio"><span class="eyebrow">MIXAGEM</span><h3>Áudio</h3>
            ${toggle('sound','Som ligado','Desliga tudo sem perder os níveis abaixo.')}
            ${slider('vol-master','Volume geral',0,100,1)}
            ${slider('vol-ambience','Paisagem sonora',0,100,1,'O rio, o vento e a chuva ao seu redor.')}
            ${slider('vol-effects','Efeitos',0,100,1,'Poderes, impactos e destruição.')}
          </div>
          <div class="pause-section" data-section="video" hidden><span class="eyebrow">DESEMPENHO</span><h3>Vídeo</h3>
            ${choice('quality','Qualidade gráfica',[['Low','Baixa'],['Medium','Média'],['High','Alta'],['Ultra','Ultra']])}
            ${toggle('dynamic','Resolução dinâmica','Ajusta resolução e densidade conforme o desempenho.')}
            ${toggle('shadows','Sombras','Desligar recupera bastante quadro em máquinas modestas.')}
            ${slider('fov','Campo de visão',50,95,1,'Aumenta sozinho com a velocidade.')}
            <div class="section-line"></div><div class="pause-readout" id="video-readout"></div>
          </div>
          <div class="pause-section" data-section="world" hidden><span class="eyebrow">AMAZÔNIA</span><h3>Mundo</h3>
            ${choice('time','Hora do dia',[['Morning','Amanhecer'],['Noon','Meio-dia'],['Golden Hour','Hora dourada'],['Night','Noite']])}
            ${toggle('day-cycle','Ciclo de iluminação')}
            ${choice('weather','Clima',[['clear','Céu limpo'],['cloudy','Nublado'],['rain','Chuva amazônica'],['storm','Temporal']])}
          </div>
          <div class="pause-section" data-section="controls" hidden><span class="eyebrow">NÃO HÁ LIMITES</span><h3>Controles</h3>
            ${slider('sensitivity','Sensibilidade do mouse',20,300,5)}
            ${toggle('invert-y','Inverter eixo vertical')}
            <div class="section-line"></div>
            <div class="help-grid">${CONTROLS.map(([key,label])=>`<div><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div>
            <p class="field-note">Clique na cena para capturar o mouse. Esc abre este menu e libera o cursor.</p>
          </div>
          <div class="pause-section" data-section="progress" hidden><span class="eyebrow">O DESPERTAR</span><h3>Progresso</h3>
            <div class="pause-readout" id="progress-readout"></div>
            <button class="text-button" id="stress-run">Iniciar rota de stress</button>
            <p class="field-note">Sobrevoa Arena, Ponta Negra, Ponte e Centro medindo o desempenho.</p>
            <div class="section-line"></div>
            <button class="text-button danger" id="reset-save">Recomeçar O Despertar</button>
            <p class="field-note">Apaga as descobertas e o progresso salvos neste navegador.</p>
          </div>
        </div></div></section>
      <section class="panel map-panel" id="map-panel" hidden><div class="panel-header"><div><span class="eyebrow">03° S · 60° O</span><h2>Uma cidade. Infinitas possibilidades.</h2></div><button class="icon-button close-panel" aria-label="Fechar mapa">${icon('close')}</button></div><div class="map-layout"><div class="map-visual"><canvas id="city-map"></canvas><div class="map-scale">━━━━━━ <span>5 km</span></div><span class="map-credit">Dados viários © OpenStreetMap contributors · Geografia estilizada</span></div><div class="map-destinations"><span class="eyebrow">PONTOS DE INTERESSE</span><div id="landmark-list"></div><p>Descubra um lugar voando até ele para liberar a translocação.</p></div></div></section>
      <section class="debug-panel" id="debug-panel" hidden><div class="eyebrow">DIAGNÓSTICO · F3</div><div id="debug-metrics"></div><div class="debug-controls"><select id="debug-travel"><option value="">Teleportar para…</option>${LANDMARKS.map(l=>`<option value="${l.id}">${l.shortName}</option>`).join('')}</select>${[['bounds','Limites de chunks'],['lod','Cores de LOD'],['hlod','HLOD'],['geo','Marcos geográficos'],['roads','Cores de via'],['wireframe','Wireframe'],['culling','Frustum de câmera']].map(([id,label])=>`<label><input type="checkbox" data-debug="${id}"/>${label}</label>`).join('')}<label>Velocidade <input type="range" min="0.25" max="3" step="0.25" value="1" id="flight-speed"/></label><button class="text-button" id="stress-run">Iniciar rota de stress</button></div></section>
      <div class="loading-tag" id="loading-tag"><span class="spinner"></span>Despertando sobre a Amazônia…</div>`;
    document.querySelector('#app')!.append(root);
    this.mini=new CityMap($('#minimap'),false);this.map=new CityMap($('#city-map'),true);
    root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button=>button.onclick=()=>this.togglePanel(button.dataset.panel!));
    root.querySelectorAll<HTMLButtonElement>('.close-panel').forEach(button=>button.onclick=()=>this.togglePanel(''));
    $('#panel-backdrop').onclick=()=>this.togglePanel('');
    root.querySelectorAll<HTMLButtonElement>('[data-power]').forEach(button=>button.onclick=()=>hooks.power(button.dataset.power!));
    root.querySelectorAll<HTMLButtonElement>('[data-tab-open]').forEach(button=>button.onclick=()=>this.openPause(button.dataset.tabOpen!));
    root.querySelectorAll<HTMLButtonElement>('.pause-tab[data-tab]').forEach(button=>button.onclick=()=>this.selectTab(button.dataset.tab!));
    $('#resume-game').onclick=()=>this.togglePanel('');
    this.fillSettings();
    // Sliders report while dragging, so volume and sensitivity can be judged by ear and by feel.
    for (const id of ['vol-master','vol-ambience','vol-effects','fov','sensitivity']) $('#'+id).oninput=()=>this.pushSettings();
    for (const id of ['quality','time','weather','dynamic','sound','day-cycle','shadows','invert-y']) $('#'+id).onchange=()=>this.pushSettings();
    $('#reset-save').onclick=hooks.reset;$('#stress-run').onclick=()=>{this.togglePanel('');hooks.stress();};
    $('#debug-travel').onchange=()=>{const select=$<HTMLSelectElement>('#debug-travel');if(select.value)hooks.travel(select.value,true);select.value='';};
    root.querySelectorAll<HTMLInputElement>('[data-debug]').forEach(input=>input.onchange=()=>hooks.debug(input.dataset.debug!,input.checked));
    $('#flight-speed').oninput=()=>hooks.debug('speed',Number($<HTMLInputElement>('#flight-speed').value));
    $('#city-map').onclick=(event)=>{const id=this.map.hit(event.clientX,event.clientY);if(id)this.travel(id);};
    this.refreshDestinations();
  }
  get panelOpen(){return !!this.openPanel;}
  ready(){ $('#loading-tag').hidden=true; }
  togglePanel(panel:string){
    this.openPanel=this.openPanel===panel?'':panel;
    ['map','pause'].forEach(id=>$('#'+id+'-panel').hidden=this.openPanel!==id);
    $('#panel-backdrop').hidden=!this.openPanel;
    document.body.classList.toggle('paused',this.openPanel==='pause');
    this.hooks.pause(!!this.openPanel);
    if(panel==='map')this.refreshDestinations();
    if(this.openPanel==='pause')this.refreshPause();
  }
  /** Esc anywhere: close whatever is open, or open the pause menu when nothing is. */
  togglePause(){this.togglePanel(this.openPanel?this.openPanel:'pause');}
  openPause(tab:string){if(this.openPanel!=='pause')this.togglePanel('pause');this.selectTab(tab);}
  private selectTab(tab:string){
    this.pauseTab=tab;
    document.querySelectorAll<HTMLElement>('.pause-section').forEach(section=>section.hidden=section.dataset.section!==tab);
    document.querySelectorAll<HTMLElement>('.pause-tab[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
    this.refreshPause();
  }
  /** Reads every control back out of the form; one place, so nothing can drift out of sync. */
  private readSettings():Settings{
    const number=(id:string)=>Number($<HTMLInputElement>('#'+id).value);
    return {
      quality:$<HTMLSelectElement>('#quality').value as QualityPreset,
      time:$<HTMLSelectElement>('#time').value as TimeKind,
      weather:$<HTMLSelectElement>('#weather').value as WeatherKind,
      dynamicResolution:$<HTMLInputElement>('#dynamic').checked,
      sound:$<HTMLInputElement>('#sound').checked,
      dayCycle:$<HTMLInputElement>('#day-cycle').checked,
      shadows:$<HTMLInputElement>('#shadows').checked,
      invertY:$<HTMLInputElement>('#invert-y').checked,
      masterVolume:number('vol-master')/100,
      ambienceVolume:number('vol-ambience')/100,
      effectsVolume:number('vol-effects')/100,
      fov:number('fov'),
      sensitivity:number('sensitivity')/100,
    };
  }
  private pushSettings(){this.hooks.settings(this.readSettings());this.refreshPause();}
  private fillSettings(){
    const s=this.save.data.settings;
    $<HTMLSelectElement>('#quality').value=s.quality;$<HTMLSelectElement>('#time').value=s.time;$<HTMLSelectElement>('#weather').value=s.weather;
    $<HTMLInputElement>('#dynamic').checked=s.dynamicResolution;$<HTMLInputElement>('#sound').checked=s.sound;
    $<HTMLInputElement>('#day-cycle').checked=s.dayCycle;$<HTMLInputElement>('#shadows').checked=s.shadows;
    $<HTMLInputElement>('#invert-y').checked=s.invertY;
    $<HTMLInputElement>('#vol-master').value=String(Math.round(s.masterVolume*100));
    $<HTMLInputElement>('#vol-ambience').value=String(Math.round(s.ambienceVolume*100));
    $<HTMLInputElement>('#vol-effects').value=String(Math.round(s.effectsVolume*100));
    $<HTMLInputElement>('#fov').value=String(Math.round(s.fov));
    $<HTMLInputElement>('#sensitivity').value=String(Math.round(s.sensitivity*100));
    this.refreshPause();
  }
  /** Keeps the slider readouts and the two summary blocks in step with the form. */
  private refreshPause(){
    const percent=(id:string)=>$('#'+id+'-value').textContent=$<HTMLInputElement>('#'+id).value+'%';
    percent('vol-master');percent('vol-ambience');percent('vol-effects');percent('sensitivity');
    $('#fov-value').textContent=$<HTMLInputElement>('#fov').value+'\u00b0';
    const muted=!$<HTMLInputElement>('#sound').checked;
    document.querySelectorAll<HTMLElement>('.pause-section[data-section="audio"] .slider-row')
      .forEach(row=>row.classList.toggle('disabled',muted));
    if(this.pauseTab==='video'){
      $('#video-readout').innerHTML=`<div><span>Quadros por segundo</span><b>${this.lastFps}</b></div><div><span>Renderizador</span><b>${this.lastBackend}</b></div>`;
    }
    if(this.pauseTab==='progress'){
      const found=this.save.data.discovered.length;
      $('#progress-readout').innerHTML=`<div><span>Lugares descobertos</span><b>${found} / ${LANDMARKS.length}</b></div><div><span>Miss\u00f5es conclu\u00eddas</span><b>${this.save.data.completed.length}</b></div>`;
    }
  }
  toggleDebug(){this.debugOpen=!this.debugOpen;$('#debug-panel').hidden=!this.debugOpen;if(this.debugOpen&&document.pointerLockElement)void document.exitPointerLock();}
  notify(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');this.toastTimer=4;}
  private travel(id:string){if(!this.save.data.discovered.includes(id)){this.notify('Voe até este lugar para descobrir sua assinatura.');return;}this.togglePanel('');this.hooks.travel(id);}
  refreshDestinations(){const list=$('#landmark-list');list.innerHTML=LANDMARKS.map(l=>`<button class="destination ${this.save.data.discovered.includes(l.id)?'discovered':''}" data-id="${l.id}"><span>${icon('pin',16)}${l.shortName}</span><small>${this.save.data.discovered.includes(l.id)?'TRANSLOCAR ↗':'NÃO DESCOBERTO'}</small></button>`).join('');list.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.onclick=()=>this.travel(button.dataset.id!));}
  update(dt:number,state:HUDState,camera:PerspectiveCamera){
    this.lastFps=state.fps;this.lastBackend=state.backend;
    // The video tab shows a live frame rate, which is the whole point of reading it while paused.
    if(this.openPanel==='pause'&&this.pauseTab==='video'){this.elapsed+=dt;if(this.elapsed>.4){this.elapsed=0;this.refreshPause();}}
    this.elapsed+=dt;this.mapElapsed+=dt;this.toastTimer-=dt;if(this.toastTimer<=0)$('#toast').classList.remove('visible');
    if(this.elapsed<.1)return;this.elapsed=0;
    $('#welcome').classList.toggle('faded',performance.now()>16000||state.velocity.length()>2);
    const nearest=LANDMARKS.reduce((best,l)=>Math.hypot(l.x-state.position.x,l.z-state.position.z)<Math.hypot(best.x-state.position.x,best.z-state.position.z)?l:best,LANDMARKS[0]);
    const near=Math.hypot(nearest.x-state.position.x,nearest.z-state.position.z)<Math.max(400,nearest.radius*2);
    const place=near?nearest.name:'Sobre a Amazônia';if(this.lastPlace!==place){$('#place-name').textContent=place;this.lastPlace=place;}
    $('#location-state').textContent=state.temporal?'PERCEPÇÃO TEMPORAL':state.size>12?'MAGNITUDE COLOSSAL':state.size>2?'MAGNITUDE GIGANTE':near?'ASSINATURA LOCALIZADA':'EXPLORAÇÃO LIVRE';
    $('#district').textContent=state.district;
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
    $('#power-current').textContent=state.selected==='punch'?'COMBATE · SOCO':state.selected==='kick'?'COMBATE · CHUTE':POWERS.find(p=>p[0]===state.selected)?.[1].toUpperCase()??'EMISSÃO';
    document.body.classList.toggle('temporal',state.temporal);document.body.classList.toggle('supersonic',state.velocity.length()>300);
    const marker=$('#objective-marker');this.temp.copy(state.destination).sub(state.origin).project(camera);marker.hidden=state.stage===0||state.stage===4&&state.remaining===0||this.temp.z>1||Math.abs(this.temp.x)>.85||Math.abs(this.temp.y)>.7;
    if(!marker.hidden){marker.style.left=`${(this.temp.x*.5+.5)*100}%`;marker.style.top=`${(-this.temp.y*.5+.5)*100}%`;marker.querySelector('small')!.textContent=distance>1000?(distance/1000).toFixed(1)+' km':Math.round(distance)+' m';}
    if(this.debugOpen)$('#debug-metrics').innerHTML=Object.entries(state.debug).map(([key,value])=>`<div><span>${key}</span><b>${value}</b></div>`).join('');
    if(this.mapElapsed>.3){this.mapElapsed=0;this.mini.draw(state.position,state.yaw,this.save.data.discovered,state.stage>0?state.destination:undefined);if(this.openPanel==='map')this.map.draw(state.position,state.yaw,this.save.data.discovered,state.destination);}
  }
}
