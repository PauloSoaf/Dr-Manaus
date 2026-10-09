import type { UniversalTransitState } from '../world/travel/UniversalTravelController';
import { formatDistance, formatDuration, formatGalaxyName } from './format';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function hypercruiseTelemetry(s:UniversalTransitState):string {
  const p=s.plan;
  return `<b>HYPERCRUISE · ${s.phase.toUpperCase()}</b>`
    +`<span>DOMÍNIO<i>${p.domain.toUpperCase()} · TRANSIT</i></span>`
    +`<span>ORIGEM<i>${formatGalaxyName(p.origin.address.galaxyId)} / ${escape(p.origin.address.systemId??'—')}</i></span>`
    +`<span>DESTINO DA VIAGEM<i>${escape(p.requestedTarget.displayName)}</i></span>`
    +`<span>PROGRESSO<i>${(s.progress*100).toFixed(1)}%</i></span><progress max="1" value="${s.progress}"></progress>`
    +`<span>DISTÂNCIA REAL<i>${formatDistance(p.logicalDistanceM)}</i></span>`
    +`<span>PERCORRIDA / RESTANTE<i>${formatDistance(s.distanceTravelledM)} / ${formatDistance(s.distanceRemainingM)}</i></span>`
    +`<span>VELOCIDADE EFETIVA<i>${(s.effectiveSpeedMps/299792458).toPrecision(4)} c</i></span>`
    +`<span>ETA<i>${s.phase==='coasting'?'PARADO EM TRÂNSITO':formatDuration(s.etaS)}</i></span>`
    +`<span>DESTINO<i>${s.preparationError?escape(s.preparationError):s.prepared?'PRONTO':'SINCRONIZANDO DESTINO'}</i></span>`
    +`<small>X desacelera · P retoma · M mapa</small>`;
}
