import type { UniversalTransitState } from '../world/travel/UniversalTravelController';
import { formatDistance, formatDuration, formatGalaxyName } from './format';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function effectiveHypercruiseSpeed(speedMps:number):string {
  const c=speedMps/299792458;
  if(!Number.isFinite(c))return '—';
  if(c>=1e9)return `${(speedMps/9.4607304725808e15).toLocaleString('pt-BR',{maximumFractionDigits:2})} ly/s`;
  if(c>=1e6)return `${(c/1e6).toFixed(2)} Mc`;
  if(c>=1e3)return `${(c/1e3).toFixed(2)} kc`;
  return `${c.toFixed(2)} c`;
}
export function hypercruiseTelemetry(s:UniversalTransitState,selectedTarget?:string):string {
  const p=s.plan;
  return `<b>HYPERCRUISE · ${s.phase.toUpperCase()}</b>`
    +`<span>DOMÍNIO<i>${p.domain.toUpperCase()} · TRANSIT</i></span>`
    +`<span>ORIGEM<i>${formatGalaxyName(p.origin.address.galaxyId)} / ${escape(p.origin.address.systemId??'—')}</i></span>`
    +`<span>DESTINO DA VIAGEM<i>${escape(p.requestedTarget.displayName)}</i></span>`
    +(selectedTarget?`<span>ALVO SELECIONADO<i>${escape(selectedTarget)}</i></span>`:'')
    +`<span>PROGRESSO<i>${(s.progress*100).toFixed(1)}%</i></span><progress max="1" value="${s.progress}"></progress>`
    +`<span>DISTÂNCIA REAL<i>${formatDistance(p.logicalDistanceM)}</i></span>`
    +`<span>PERCORRIDA / RESTANTE<i>${formatDistance(s.distanceTravelledM)} / ${formatDistance(s.distanceRemainingM)}</i></span>`
    +`<span>VELOCIDADE EFETIVA<i>${effectiveHypercruiseSpeed(s.effectiveSpeedMps)}</i></span>`
    +`<span>ETA<i>${s.phase==='coasting'?'PARADO EM TRÂNSITO':formatDuration(s.etaS)}</i></span>`
    +`<span>DESTINO<i>${s.preparationError?escape(s.preparationError):s.prepared?'PRONTO':'SINCRONIZANDO DESTINO'}</i></span>`
    +`<small>X desacelera · P retoma · M mapa</small>`;
}
