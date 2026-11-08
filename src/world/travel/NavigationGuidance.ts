import { DEFAULT_UNIVERSE_SEED } from '../galaxy/ProceduralGalaxyDiscovery';
import { isCanonicalGalaxyId } from '../celestial/GalaxyDefinition';
import { peekProceduralGalaxyEntry } from './GalaxyEntryResolver';
import type { TravelCapability } from './UniversalTargetResolver';

export type NavigationReadinessState =
  | 'confirmed'
  | 'pending-validation'
  | 'active-system'
  | 'observational-only'
  | 'unavailable';

export interface NavigationGuidance {
  readonly status: string;
  readonly shortcutHint: string;
  readonly available: boolean;
  readonly readinessState: NavigationReadinessState;
}

export function describeNavigationGuidance(
  capability: TravelCapability,
  kind: string,
  targetGalaxyId?: string,
  currentGalaxyId?: string,
  universeSeed: bigint = DEFAULT_UNIVERSE_SEED,
): NavigationGuidance {
  switch (capability) {
    case 'intergalactic': {
      if (kind === 'galaxy' && targetGalaxyId && !isCanonicalGalaxyId(targetGalaxyId)) {
        const cached = peekProceduralGalaxyEntry(targetGalaxyId, universeSeed);
        if (cached === true) {
          return {
            status: 'Rota intergaláctica pronta (sistema de entrada confirmado)',
            shortcutHint: 'Atalho [P] · Iniciar Hypercruise Intergaláctico em voo espacial seguro',
            available: true,
            readinessState: 'confirmed',
          };
        }
        if (cached === false) {
          return {
            status: 'Indisponível · Nenhum sistema de entrada pousável localizado nesta galáxia',
            shortcutHint: 'Alvo catalogado apenas para observação cosmológica',
            available: false,
            readinessState: 'unavailable',
          };
        }
        return {
          status: 'Elegível para rota intergaláctica (aguardando validação de entrada)',
          shortcutHint: 'Atalho [P] · Validar sistema de entrada e iniciar Hypercruise em voo espacial seguro',
          available: true,
          readinessState: 'pending-validation',
        };
      }
      return {
        status: 'Rota intergaláctica pronta (sistema de entrada confirmado)',
        shortcutHint: 'Atalho [P] · Iniciar Hypercruise Intergaláctico em voo espacial seguro',
        available: true,
        readinessState: 'confirmed',
      };
    }
    case 'interstellar':
      return {
        status: 'Rota interestelar disponível na galáxia ativa',
        shortcutHint: 'Atalho [P] · Iniciar Hypercruise Interestelar em voo espacial seguro',
        available: true,
        readinessState: 'confirmed',
      };
    case 'solar':
    case 'intra-system':
      return {
        status: 'Destino local no sistema planetário ativo',
        shortcutHint: 'Use o piloto automático local / controles de voo no sistema ativo',
        available: true,
        readinessState: 'active-system',
      };
    case 'black-hole-future':
      return {
        status: 'Indisponível · Horizonte de eventos (aproximação extrema bloqueada)',
        shortcutHint: 'Somente telemetria e referência gravitacional',
        available: false,
        readinessState: 'unavailable',
      };
    case 'cosmological-future':
      if (kind === 'galaxy' && targetGalaxyId && targetGalaxyId === currentGalaxyId) {
        return {
          status: 'Você já está nesta galáxia · selecione um sistema estelar interno',
          shortcutHint: 'Use a vista Galáxia ou Sistema para escolher um destino local',
          available: false,
          readinessState: 'active-system',
        };
      }
      if (kind === 'galaxy') {
        const cached =
          targetGalaxyId && !isCanonicalGalaxyId(targetGalaxyId)
            ? peekProceduralGalaxyEntry(targetGalaxyId, universeSeed)
            : undefined;
        if (cached === false) {
          return {
            status: 'Indisponível · Nenhum sistema de entrada pousável localizado nesta galáxia',
            shortcutHint: 'Alvo catalogado apenas para observação cosmológica',
            available: false,
            readinessState: 'unavailable',
          };
        }
        return {
          status: 'Destino cosmológico observacional (além do domínio de conversão direta)',
          shortcutHint: 'Alvo catalogado apenas para observação cosmológica',
          available: false,
          readinessState: 'observational-only',
        };
      }
      return {
        status: 'Destino cosmológico apenas observacional (estrutura de grande escala)',
        shortcutHint: 'Selecione uma galáxia elegível para iniciar viagem intergaláctica',
        available: false,
        readinessState: 'observational-only',
      };
    default:
      return {
        status: 'Indisponível · Alvo sem rota de navegação ativa',
        shortcutHint: 'Selecione outro destino no mapa ou catálogo',
        available: false,
        readinessState: 'unavailable',
      };
  }
}
