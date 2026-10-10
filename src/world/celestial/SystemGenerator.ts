import { circularOrbitRateRadS, type CelestialBody } from './CelestialBody';
import type { GeneratedStar } from './StarSector';
import type { CelestialBodyProfile } from './CelestialBodyProfile';
export interface ProceduralSystem {
  readonly starId: string;
  readonly star?: GeneratedStar;
  readonly seed: bigint;
  readonly bodies: readonly CelestialBody[];
}
/** Physical stellar radius from L = 4πR²σT⁴, relative to Solar values. */
export function generatedStarRadiusM(star: Pick<GeneratedStar,'luminositySolar'|'temperatureK'>): number {
  return 6.957e8 * Math.sqrt(star.luminositySolar) / (star.temperatureK / 5772) ** 2;
}
export function stellarAlbedo(temperatureK: number): readonly [number,number,number] {
  if (temperatureK < 4000) return [1,.38,.16];
  if (temperatureK < 5200) return [1,.68,.35];
  if (temperatureK < 6500) return [1,.96,.85];
  if (temperatureK < 9000) return [.85,.91,1];
  return [.6,.76,1];
}
/** Legacy mass-only callers remain deterministic; catalog/materialization always supply GeneratedStar. */
export function generateSystem(starId: string, starSeed: bigint, properties: number | GeneratedStar): ProceduralSystem {
  let state = starSeed || 0x9e37_79b9_7f4a_7c15n;
  const nextFloat = () => {
    state ^= (state << 13n) & 0xffff_ffff_ffff_ffffn;
    state ^= state >> 7n;
    state ^= (state << 17n) & 0xffff_ffff_ffff_ffffn;
    state &= 0xffff_ffff_ffff_ffffn;
    return Number(state >> 11n) / 2 ** 53;
  };
  const nextInt = (min:number,max:number) => Math.floor(nextFloat()*(max-min+1))+min;
  const star: GeneratedStar = typeof properties === 'number' ? {
    id:starId, offsetM:[0,0,0], massSolar:properties, temperatureK:5772*Math.pow(properties,.5),
    luminositySolar:Math.pow(properties,3.5), spectralClass:'G',planetCount:nextInt(2,10)
  } : properties;
  const starRadiusM=generatedStarRadiusM(star), starMassKg=1.989e30*star.massSolar;
  const starName='PX-'+starId.split('/').slice(1).join('-').replaceAll(',','·');
  const bodies:CelestialBody[]=[];
  bodies.push({ id:starId,name:starName,equatorialRadiusM:starRadiusM,polarRadiusM:starRadiusM,
    massKg:starMassKg,rotationPeriodS:2.14e6,frameId:starId+'-fixed',
    stellar:{temperatureK:star.temperatureK,luminositySolar:star.luminositySolar,spectralClass:star.spectralClass},
    profile:{bodyClass:'star',hasSolidSurface:false,canLand:false,hasAtmosphere:false,
      supportsVolumeDestruction:false,surfaceKind:'none',visual:{albedo:stellarAlbedo(star.temperatureK),
        solarGlow:{innerScale:2,outerScale:5},labelPriority:10}} });
  let currentOrbitM=Math.max(5e10,starRadiusM*12);
  const solid=(moon:boolean,icy:boolean):CelestialBodyProfile=>({
    bodyClass:moon?(icy?'icy-moon':'rocky-moon'):'rocky',hasSolidSurface:true,canLand:true,
    hasAtmosphere:!moon && nextFloat()>.7,supportsVolumeDestruction:false,surfaceKind:'synthetic-base',
    visual:{albedo:icy?[.65,.78,.86]:[.3+nextFloat()*.45,.2+nextFloat()*.4,.15+nextFloat()*.35],
      minimumVisiblePx:2,labelPriority:moon?4:6} });
  for(let i=0;i<star.planetCount;i++) {
    currentOrbitM+=nextFloat()*1.5e11+2e10;
    const draw=nextFloat(), giant=i>0 && draw>.55, icy=giant && draw>.82;
    const radiusM=giant?(icy?1.8e7+nextFloat()*1.5e7:3e7+nextFloat()*4e7):2e6+nextFloat()*6e6;
    const density=giant?(icy?1600:1300):5500;
    const massKg=4/3*Math.PI*radiusM**3*density;
    const planetId=starId+'_planet_'+i, planetName=starName+' '+String.fromCharCode(98+i);
    const profile:CelestialBodyProfile=giant?{bodyClass:icy?'ice-giant':'gas-giant',hasSolidSurface:false,
      canLand:false,hasAtmosphere:true,supportsVolumeDestruction:false,surfaceKind:'none',
      visual:{albedo:icy?[.18,.55+nextFloat()*.25,.85]:[.7+nextFloat()*.2,.45+nextFloat()*.2,.25+nextFloat()*.2],
        bands:icy?6:12,minimumVisiblePx:2.5,labelPriority:6}}:solid(false,false);
    bodies.push({id:planetId,name:planetName,parentId:starId,equatorialRadiusM:radiusM,polarRadiusM:radiusM,
      massKg,rotationPeriodS:10000+nextFloat()*172800,frameId:planetId+'-fixed',profile,
      orbit:{semiMajorAxisM:currentOrbitM,phaseRad:nextFloat()*Math.PI*2,
        angularRateRadS:circularOrbitRateRadS(currentOrbitM,starMassKg),inclinationRad:(nextFloat()-.5)*.12}});
    const moonCount=giant?nextInt(1,5):nextInt(0,2);
    let moonOrbitM=radiusM*3;
    for(let m=0;m<moonCount;m++) {
      moonOrbitM+=nextFloat()*radiusM*2;
      const moonRadiusM=1e5+nextFloat()*1e6, moonId=planetId+'_moon_'+m;
      bodies.push({id:moonId,name:planetName+' '+['I','II','III','IV','V'][m],parentId:planetId,
        equatorialRadiusM:moonRadiusM,polarRadiusM:moonRadiusM,massKg:4/3*Math.PI*moonRadiusM**3*3000,
        rotationPeriodS:10000+nextFloat()*432000,frameId:moonId+'-fixed',profile:solid(true,icy),
        orbit:{semiMajorAxisM:moonOrbitM,phaseRad:nextFloat()*Math.PI*2,
          angularRateRadS:circularOrbitRateRadS(moonOrbitM,massKg),inclinationRad:(nextFloat()-.5)*.3}});
    }
  }
  return {starId,star,seed:starSeed,bodies};
}
