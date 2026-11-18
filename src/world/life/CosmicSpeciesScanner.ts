/**
 * CosmicSpeciesScanner.ts
 *
 * Planetary species scanner and taxonomic catalog for Dr-Manaus.
 * Analyzes flora and fauna specimens, provides deterministic taxonomy,
 * scientific nomenclature, diet, temperament, and tracks discoveries in SaveManager.
 */

import { Vector3 } from 'three/webgpu';
import type { PlanetaryBiosphereProfile, DominantFaunaType } from './PlanetaryBiosphere';
import type { FloraArchetype } from './PlanetaryBiomeService';
import type { CreatureEntity } from './AlienFaunaManager';
import type { PlanetTitanState } from './CosmicPlanetTitan';
import type { SaveManager } from '../../core/SaveManager';

export type SpeciesCategory = 'fauna' | 'flora' | 'titan';
export type SpeciesDiet =
  | 'herbivore'
  | 'carnivore'
  | 'omnivore'
  | 'radiotrophic'
  | 'chemotrophic'
  | 'photosynthetic'
  | 'stellar-plasma';
export type SpeciesTemperament = 'passive' | 'skittish' | 'defensive' | 'apex-aggressive' | 'astral-transcendent';

export interface SpeciesProfile {
  readonly speciesId: string;
  readonly commonName: string;
  readonly scientificName: string;
  readonly category: SpeciesCategory;
  readonly originBodyId: string;
  readonly morphology: string;
  readonly diet: SpeciesDiet;
  readonly temperament: SpeciesTemperament;
  readonly threatLevel: number; // 1 to 5
  readonly description: string;
}

export interface SpeciesScanResult {
  readonly profile: SpeciesProfile;
  readonly distanceM: number;
  readonly worldPosition: Vector3;
  readonly isNewDiscovery: boolean;
}

const FAUNA_NAMES: Record<DominantFaunaType, { common: string; binomial: string; diet: SpeciesDiet; temp: SpeciesTemperament; threat: number; desc: string }> = {
  'amphibious-crawlers': {
    common: 'Rastejador Anfíbio Litorâneo',
    binomial: 'Loricatus repens',
    diet: 'omnivore',
    temp: 'passive',
    threat: 1,
    desc: 'Espécime rastejante de carapaça hidrofóbica adaptada a lamas e margens.',
  },
  'chitinous-quadrupeds': {
    common: 'Blindado Terrestre Quitinoso',
    binomial: 'Chitinus quadrupes',
    diet: 'herbivore',
    temp: 'defensive',
    threat: 2,
    desc: 'Herbívoro robusto com placas de blindagem mineral e comportamento de manada.',
  },
  'avian-gliders': {
    common: 'Planador Alado Atmosférico',
    binomial: 'Volans aerius',
    diet: 'omnivore',
    temp: 'skittish',
    threat: 1,
    desc: 'Criatura alada graciosa com membranas que aproveitam correntes térmicas.',
  },
  'serpentine-burrowers': {
    common: 'Serpente Escavadora das Colinas',
    binomial: 'Serpens subterraneus',
    diet: 'chemotrophic',
    temp: 'defensive',
    threat: 3,
    desc: 'Organismo segmentado flexível capaz de transitar por fendas e solos rochosos.',
  },
  'bipedal-predators': {
    common: 'Caçador Bípede das Estepes',
    binomial: 'Velox venator',
    diet: 'carnivore',
    temp: 'apex-aggressive',
    threat: 4,
    desc: 'Predador bípede veloz, de visão binocular aguçada e reflexos predatórios.',
  },
  'none': {
    common: 'Forma Não Identificada',
    binomial: 'Organismus incertae',
    diet: 'herbivore',
    temp: 'passive',
    threat: 1,
    desc: 'Espécime não catalogado.',
  },
};

const FLORA_NAMES: Record<FloraArchetype, { common: string; binomial: string; diet: SpeciesDiet; desc: string }> = {
  'canopy-broadleaf': {
    common: 'Dossel Foliar Gigante',
    binomial: 'Arbor grandifolia',
    diet: 'photosynthetic',
    desc: 'Árvore de tronco maciço com copa densa captadora de luz solar.',
  },
  'alien-conifers': {
    common: 'Espícula Conífera Boreal',
    binomial: 'Pinus acicularis',
    diet: 'photosynthetic',
    desc: 'Vegetação piramidal adaptada a ventos fortes e climas rigorosos.',
  },
  'giant-spore-trees': {
    common: 'Fungo Arbóreo de Esporos',
    binomial: 'Mycota sporifera',
    diet: 'chemotrophic',
    desc: 'Estrutura fúngica monumental que dispersa nuvens de esporos na atmosfera.',
  },
  'bioluminescent-fungi': {
    common: 'Cogumelo Luminoso Neon',
    binomial: 'Lumina mycenis',
    diet: 'chemotrophic',
    desc: 'Fungos com quimioluminescência radiante que iluminam vales noturnos.',
  },
  'crystalline-spires': {
    common: 'Espiral Mineral Cristalina',
    binomial: 'Crystallum spiculum',
    diet: 'radiotrophic',
    desc: 'Estrutura biomineralizada de silício que refrata radiações estelares.',
  },
  'xenoflora-succulents': {
    common: 'Tubérculo Carnoso Xérico',
    binomial: 'Xenocactus succulens',
    diet: 'photosynthetic',
    desc: 'Vegetal fibroso retentor de água e solventes para sobrevivência em aridez.',
  },
  'hydrocarbon-tendrils': {
    common: 'Gavinha de Hidrocarbonetos',
    binomial: 'Cryotendrilla metanica',
    diet: 'chemotrophic',
    desc: 'Zarcilhos criogênicos que absorvem metano e etano condensados.',
  },
  'silicon-monolith-crystals': {
    common: 'Monólito de Silício Fraturado',
    binomial: 'Silicium crystallum grandis',
    diet: 'radiotrophic',
    desc: 'Grandes prismas minerais hexagonais que absorvem fótons de alta energia em desertos de silício.',
  },
  'luminescent-mycelium-bulbs': {
    common: 'Bulbo Micelial Abissal',
    binomial: 'Mycelium abissalis phosphorans',
    diet: 'chemotrophic',
    desc: 'Fungos abissais bioluminescentes que emitem luz verde-esmeralda em depressões planetárias.',
  },
  'obsidian-thermal-vents': {
    common: 'Chaminé Vulcânica de Obsidiana',
    binomial: 'Fumarola vulcanica petrificata',
    diet: 'radiotrophic',
    desc: 'Chaminés minerais geotérmicas ricas em obsidiana que canalizam calor e compostos sulfurosos.',
  },
  'none': {
    common: 'Mineral Inerte',
    binomial: 'Saxum sterile',
    diet: 'chemotrophic',
    desc: 'Composto mineral sem processos vitais.',
  },
};

export class CosmicSpeciesScanner {
  private readonly toTarget = new Vector3();

  constructor(private readonly saveManager?: SaveManager) {}

  /**
   * Scans target entities in front of the player's view vector.
   */
  scanAim(
    rayOrigin: Vector3,
    rayDirection: Vector3,
    creatures?: readonly CreatureEntity[],
    titans?: readonly PlanetTitanState[],
    biosphere?: PlanetaryBiosphereProfile,
    maxRangeM = 75,
    flora?: readonly { archetype: FloraArchetype; position: Vector3 }[],
    activeFrameId?: string,
  ): SpeciesScanResult | null {
    const normRay = rayDirection.clone().normalize();

    // 1. Check local fauna specimens within aim cone
    if (creatures && creatures.length > 0) {
      let bestCreature: CreatureEntity | null = null;
      let bestDistance = maxRangeM;
      let bestDot = 0.92; // At least ~23 degrees within aim cone

      for (const c of creatures) {
        if (!c.active || c.state === 'defeated') continue;

        this.toTarget.subVectors(c.position, rayOrigin);
        const dist = this.toTarget.length();
        if (dist > maxRangeM || dist < 0.5) continue;

        this.toTarget.normalize();
        const dot = normRay.dot(this.toTarget);

        if (dot > bestDot && dist < bestDistance) {
          bestDot = dot;
          bestDistance = dist;
          bestCreature = c;
        }
      }

      if (bestCreature) {
        const bodyId = biosphere?.bodyId ?? 'active_body';
        const profile = CosmicSpeciesScanner.resolveFaunaProfile(bodyId, bestCreature.morphology, biosphere);
        const isNew = this.saveManager ? !this.saveManager.isSpeciesDiscovered(profile.speciesId) : true;
        if (isNew && this.saveManager) {
          this.saveManager.discoverSpecies(profile.speciesId);
        }

        return {
          profile,
          distanceM: bestDistance,
          worldPosition: bestCreature.position.clone(),
          isNewDiscovery: isNew,
        };
      }
    }

    // 2. Check alien flora specimens within aim cone
    if (flora && flora.length > 0) {
      let bestFlora: { archetype: FloraArchetype; position: Vector3 } | null = null;
      let bestDistance = maxRangeM;
      let bestDot = 0.94;

      for (const f of flora) {
        this.toTarget.subVectors(f.position, rayOrigin);
        const dist = this.toTarget.length();
        if (dist > maxRangeM || dist < 0.5) continue;

        this.toTarget.normalize();
        const dot = normRay.dot(this.toTarget);
        if (dot > bestDot && dist < bestDistance) {
          bestDot = dot;
          bestDistance = dist;
          bestFlora = f;
        }
      }

      if (bestFlora) {
        const bodyId = biosphere?.bodyId ?? 'active_body';
        const profile = CosmicSpeciesScanner.resolveFloraProfile(bodyId, bestFlora.archetype, biosphere);
        const isNew = this.saveManager ? !this.saveManager.isSpeciesDiscovered(profile.speciesId) : true;
        if (isNew && this.saveManager) {
          this.saveManager.discoverSpecies(profile.speciesId);
        }

        return {
          profile,
          distanceM: bestDistance,
          worldPosition: bestFlora.position.clone(),
          isNewDiscovery: isNew,
        };
      }
    }

    // 3. Check cosmic titans and astral leviathans in deep space / orbit
    if (titans && titans.length > 0) {
      // System isolation: Do not scan solar titan from outside the solar system
      if (activeFrameId && activeFrameId !== 'solar-system/barycentric') {
        return null;
      }

      for (const t of titans) {
        if (!t.active || t.health <= 0) continue;
        const titanPos = t.renderPosition ?? t.position;
        this.toTarget.subVectors(titanPos, rayOrigin);
        const dist = this.toTarget.length();
        if (dist < 10) continue;
        this.toTarget.normalize();
        const dot = normRay.dot(this.toTarget);

        // Angular radius of the titan: theta = asin(R / dist)
        const angularRadius = Math.asin(Math.min(1.0, t.radiusM / Math.max(1, dist)));
        const cosCone = Math.cos(Math.max(0.04, angularRadius * 1.25));

        // Aim cone valid if dot >= cosCone (pointing at the visible titan body)
        if (dot >= cosCone && dist < 5_000_000_000) {
          const profile = CosmicSpeciesScanner.resolveTitanProfile(t.id, t.name, t.classification);
          const isNew = this.saveManager ? !this.saveManager.isSpeciesDiscovered(profile.speciesId) : true;
          if (isNew && this.saveManager) {
            this.saveManager.discoverSpecies(profile.speciesId);
          }

          return {
            profile,
            distanceM: dist,
            worldPosition: titanPos.clone(),
            isNewDiscovery: isNew,
          };
        }
      }
    }

    return null;
  }

  /**
   * Resolves authoritative profile for a fauna specimen.
   */
  static resolveFaunaProfile(
    bodyId: string,
    morphology: DominantFaunaType,
    biosphere?: PlanetaryBiosphereProfile,
  ): SpeciesProfile {
    const meta = FAUNA_NAMES[morphology] ?? FAUNA_NAMES['none'];
    const bodyPrefix = bodyId.charAt(0).toUpperCase() + bodyId.slice(1);
    const commonName = `${meta.common} de ${bodyPrefix}`;
    const scientificName = `${meta.binomial} var. ${bodyId}`;

    return {
      speciesId: `drm:species:${bodyId}:fauna:${morphology}`,
      commonName,
      scientificName,
      category: 'fauna',
      originBodyId: bodyId,
      morphology,
      diet: meta.diet,
      temperament: meta.temp,
      threatLevel: meta.threat,
      description: `${meta.desc} Bioquímica: ${biosphere?.biochemistry ?? 'carbon-water'}. Nível de radiação tolerada: ${biosphere?.radiationLevel ?? 'negligible'}.`,
    };
  }

  /**
   * Resolves authoritative profile for a planet-sized cosmic titan or astral leviathan.
   */
  static resolveTitanProfile(
    titanId: string,
    titanName: string,
    classification: 'astral-leviathan' | 'void-colossus' | 'stellar-behemoth' = 'astral-leviathan',
  ): SpeciesProfile {
    return {
      speciesId: `drm:species:titan:${titanId}`,
      commonName: titanName,
      scientificName: 'Leviathan astralis cosmicus',
      category: 'titan',
      originBodyId: 'deep_space',
      morphology: classification,
      diet: 'stellar-plasma',
      temperament: 'astral-transcendent',
      threatLevel: 5,
      description: 'Entidade viva colossal de escala planetária (120+ km de raio) composta por um núcleo estelar energético envolto em carapaça biomineral hiper-densa e anéis de poeira estelar.',
    };
  }

  /**
   * Resolves authoritative profile for a flora archetype specimen.
   */
  static resolveFloraProfile(
    bodyId: string,
    archetype: FloraArchetype,
    biosphere?: PlanetaryBiosphereProfile,
  ): SpeciesProfile {
    const meta = FLORA_NAMES[archetype] ?? FLORA_NAMES['none'];
    const bodyPrefix = bodyId.charAt(0).toUpperCase() + bodyId.slice(1);
    const commonName = `${meta.common} de ${bodyPrefix}`;
    const scientificName = `${meta.binomial} var. ${bodyId}`;

    return {
      speciesId: `drm:species:${bodyId}:flora:${archetype}`,
      commonName,
      scientificName,
      category: 'flora',
      originBodyId: bodyId,
      morphology: archetype,
      diet: meta.diet,
      temperament: 'passive',
      threatLevel: 1,
      description: `${meta.desc} Clima de origem: ${biosphere?.description ?? 'Superfície planetária'}.`,
    };
  }
}

