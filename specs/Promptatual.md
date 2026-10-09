# Checkpoint atual — U2 Galaxy Runtime / Andromeda — 2026-10-09

Baseline confirmado: `9909091f7bfb14b40c031752df29550deddd1651`, branch `feat/universe-map`.
Os anexos mais recentes aceitam U1 e autorizam exclusivamente U2, documentação, commits e push.
A especificação ativa é [U2-GALAXY-RUNTIME-ANDROMEDA.md](U2-GALAXY-RUNTIME-ANDROMEDA.md).
O relatório de implementação, testes e aceite manual é
[28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md](../docs/world/28-status-U2-GALAXY-RUNTIME-ANDROMEDA.md).

Implementado: galáxia ativa coerente com UniverseAddress, origem local de setores, sessões preparadas
com rollback, backdrop local, galáxia externa e buraco negro central corretos, mapa/HUD/F3 e chegada
explicitamente U2 TEST em Andrômeda. P continua sem viagem intergaláctica; D1 permanece congelado.
**STOP após U2 para aceite manual. U3/U4/BH0 continuam fora deste checkpoint.**

O prompt Solar editado pelo usuário foi preservado integralmente abaixo. Ele descreve um baseline
anterior; suas prioridades antigas e a restrição de Playwright foram substituídas pelo pedido U2
mais recente, que exige o checkpoint de navegador já existente. Não reaplicar patches Solar entregues.

---

# DR MANAUS — SISTEMA SOLAR COMPLETO E VIAGEM PLANETÁRIA EM ESCALA REAL

Você está trabalhando no repositório **Dr-Manaus**, branch:

```text
feat/universe-map
```

Último HEAD auditado externamente antes desta execução:

```text
29c3c57b90e514b6dfc3718a00a29d3a010a82b5
```

Commit:

```text
docs(world): record celestial visual pipeline hardening and test verification
```

---

# REGRA Nº 1 — NÃO CONFIE NESTE HEAD SEM VERIFICAR

Antes de QUALQUER alteração:

```bash
git status
git branch --show-current
git rev-parse HEAD
git log -10 --oneline
```

Se o HEAD atual não for:

```text
29c3c57b90e514b6dfc3718a00a29d3a010a82b5
```

NÃO aplique cegamente esta especificação.

Primeiro:

```text
1. leia o diff dos commits novos;
2. reavalie cada problema mencionado aqui;
3. veja se algum deles já foi resolvido;
4. adapte a implementação ao código real;
5. não duplique classes/sistemas existentes;
6. não reverta melhorias recentes.
```

Esta task deve ser executada **sobre o código atual**, não sobre uma imagem mental antiga do projeto.

---

# REGRA Nº 2 — PRIMEIRO AUDITAR, DEPOIS PROGRAMAR

Não comece criando:

```text
MarsProvider
JupiterProvider
PlanetVisual
```

antes de entender o que já existe.

Primeiro faça uma auditoria completa.

Leia integralmente:

```text
src/game/Game.ts

src/core/config.ts

src/world/runtime/UniverseRuntime.ts
src/world/runtime/ProviderRegistry.ts
src/world/runtime/GlobalStreamingScheduler.ts

src/world/celestial/CelestialBody.ts
src/world/celestial/CelestialSystemRuntime.ts
src/world/celestial/SolarSystem.ts
src/world/celestial/OfflineEphemeris.ts
src/world/celestial/EphemerisProvider.ts

src/world/planet/PlanetBody.ts
src/world/planet/PlanetQuadtree.ts
src/world/planet/EarthGlobe.ts
src/world/planet/MoonGlobe.ts
src/world/planet/MoonSurface.ts

src/world/providers/WorldProvider.ts
src/world/providers/EarthProvider.ts
src/world/providers/MoonProvider.ts
src/world/providers/EarthTransitionController.ts

src/world/spatial/ReferenceFrame.ts
src/world/spatial/ReferenceFrameGraph.ts
src/world/spatial/RenderSpaceService.ts
src/world/spatial/FloatingOrigin3D.ts
src/world/spatial/ManausFrameAdapter.ts

src/world/travel/TravelDomain.ts
src/world/travel/InterplanetaryController.ts

src/rendering/celestial/CelestialPresentationController.ts
src/rendering/celestial/CelestialBodyVisualLayer.ts
src/rendering/celestial/EarthVisual.ts
src/rendering/celestial/MoonVisual.ts
src/rendering/celestial/SunVisual.ts
src/rendering/celestial/math.ts
src/rendering/celestial/types.ts

src/rendering/domains/RenderDomains.ts
src/rendering/SpaceLayer.ts
src/rendering/SpeedVFX.ts
```

Também leia:

```text
docs/world/10-solar-system.md
docs/world/15-status.md

specs/dr-manaus-universe-patch-v2/10-PLANETS-AND-MOONS-ROADMAP.md
specs/dr-manaus-cosmic-night-specs/07-SOLAR-SYSTEM-COMPLETE.md
```

Faça busca global por:

```text
handoffTo(
handoff(
dominantBody(
setStreamingMode(
updateStreaming(
CelestialRenderSample
PlanetBody
PlanetQuadtree
moon/fixed
mars
jupiter
saturn
mercury
venus
uranus
neptune
CELESTIAL_PROXY
```

Antes de editar, escreva uma síntese técnica curta do estado real encontrado.

---

# 1. ESTADO ATUAL QUE DEVE SER CONFIRMADO

Na última auditoria, o código estava assim.

## Modelo lógico do Sistema Solar: já existe

`src/world/celestial/CelestialBody.ts` já contém:

```text
Sol
Mercúrio
Vênus
Terra
Lua
Marte
Júpiter
Saturno
Urano
Netuno
```

com:

```text
raio equatorial
raio polar
massa
rotação
inclinação axial
reference frame
```

NÃO recriar esses dados em outro arquivo.

---

## Efemérides: já existem

`src/world/celestial/OfflineEphemeris.ts` já possui elementos orbitais para:

```text
Mercúrio
Vênus
Terra
Lua
Marte
Júpiter
Saturno
Urano
Netuno
```

As posições lógicas já estão em escala física.

NÃO inventar:

```ts
mars.position.set(...)
```

Não criar posições artísticas.

A fonte lógica deve continuar sendo:

```text
OfflineEphemeris
→ SolarSystem
→ BodyState
```

---

## SolarSystem já é genérico

`SolarSystem.ts` já possui:

```ts
stateOf(bodyId)
positionOf(bodyId)
distanceBetween(a, b)
dominantBody(position)
handoff(bodyId, observer)
registerFrames(...)
```

Preservar essa arquitetura.

O problema atual NÃO é falta de modelo orbital.

O problema é transformar esse modelo em:

```text
visual
travel
handoff
provider
surface/atmosphere
gameplay
```

para todos os corpos.

---

# 2. O QUE AINDA ESTÁ HARDCODED

Na última auditoria:

`CelestialPresentationController.ts` tratava explicitamente apenas:

```text
SUN
MOON
EARTH
```

`CelestialBodyVisualLayer.ts` possuía explicitamente:

```ts
SunVisual
MoonVisual
EarthVisual
```

`Game.ts` registrava apenas:

```ts
EarthProvider
MoonProvider
```

`UniverseRuntime.handoffTo()` possuía tratamento especial apenas para:

```text
earth
moon
```

E `UniverseRuntime.location` tinha inclusive lógica parcial/hardcoded para:

```text
moon
mars
```

incluindo raios escritos diretamente.

Isso precisa ser auditado e generalizado.

---

# 3. OBJETIVO FINAL

Quero que DR Manaus evolua para uma experiência no espírito de jogos de voo superpoderoso planetário como **Megaton Rainfall**, sem copiar assets, código, conteúdo ou identidade visual do jogo.

A referência é apenas a experiência de escala:

```text
Manaus
↓
voo
↓
atmosfera
↓
órbita
↓
espaço interplanetário
↓
planetas reais
↓
aproximação contínua
↓
órbita / atmosfera / superfície quando aplicável
```

Sem telas de loading artificiais entre essas escalas.

O jogador deve poder sair do Teatro Amazonas/Manaus e seguir fisicamente pelo Sistema Solar.

---

# 4. EXPERIÊNCIA DESEJADA

O jogador deve conseguir:

```text
Manaus
→ Terra
→ Lua
→ Mercúrio
→ Vênus
→ Marte
→ Júpiter
→ Saturno
→ Urano
→ Netuno
```

em posições e distâncias lógicas coerentes com o modelo orbital.

Não precisa seguir essa ordem.

Ele deve poder apontar para Marte e simplesmente voar para Marte.

---

# 5. DIFERENCIAR ESCALA LÓGICA E ESCALA DE RENDERIZAÇÃO

Regra fundamental:

```text
WORLD LOGIC
=
metros reais

RENDER
=
camera-relative / render-relative
```

Nunca:

```text
Mars.position = 225e9
```

em um `Object3D`.

Posições astronômicas permanecem em:

```text
Float64
reference frames
SolarSystem
UniverseRuntime
```

O Three.js recebe apenas:

```text
direção
tamanho angular
posição proxy limitada
ou body-relative position quando perto
```

---

# 6. CORRIGIR PRIMEIRO O BUG DO ANALYTIC PROXY

Antes de adicionar planetas, corrigir o problema matemático atual.

Existe:

```ts
CELESTIAL_PROXY_DISTANCE_M = 5_000_000
```

e:

```ts
proxyRadiusM =
  Math.tan(angularRadiusRad) *
  CELESTIAL_PROXY_DISTANCE_M
```

Quando:

```text
angularRadius → π / 2
```

temos:

```text
tan(π/2) → infinito
```

Isso pode gerar um mesh astronomicamente grande.

`angularRadiusRad()` corretamente retorna:

```ts
Math.PI / 2
```

quando o observador está dentro ou sobre o raio do corpo.

Portanto um analytic billboard NÃO pode continuar sendo usado nesse regime.

---

# 7. TRANSFORMAR CELESTIAL_RENDER_SAFE_RADIUS EM CONTRATO REAL

Hoje existe:

```ts
CELESTIAL_RENDER_SAFE_RADIUS_M
```

mas confirme se ele realmente governa alguma decisão.

Implementar helper central, por exemplo:

```ts
export interface CelestialProxyGeometry {
  safe: boolean;
  distanceM: number;
  radiusM: number;
}
```

E:

```ts
export function celestialProxyGeometry(
  angularRadiusRad: number
): CelestialProxyGeometry
```

Deve:

```text
calcular radius
verificar finite
verificar render budget
recusar analytic representation
se radius ultrapassar safe radius
```

Nunca simplesmente fazer:

```ts
Math.min(radius, MAX)
```

porque isso falsificaria o tamanho angular.

A resposta correta é:

```text
proxy não serve mais
→ mudar representação
```

---

# 8. SEPARAR CLASSIFICAÇÃO FÍSICA DE ESTRATÉGIA GRÁFICA

Hoje:

```ts
SolarSystem.handoff()
```

retorna:

```text
celestial
planet
surface
```

Isso é útil fisicamente.

Mas não deve significar automaticamente:

```text
planet
=
ligar quadtree
```

A representação gráfica também deve considerar:

```text
angular size
projected size in pixels
viewport
FOV
coverage readiness
render budget
```

Criar conceito como:

```ts
type BodyRenderMode =
  | 'analytic'
  | 'coarse-globe'
  | 'streamed-globe'
  | 'surface';
```

Separado de:

```ts
BodyHandoffState.mode
```

---

# 9. PROJECTED PIXEL SIZE

Criar helper puro e testável:

```ts
projectedDiameterPx(
  angularRadiusRad,
  verticalFovRad,
  viewportHeightPx
)
```

Usar essa grandeza para decidir representação.

Por exemplo:

```text
poucos pixels
→ analytic

dezenas/centenas de pixels
→ coarse globe

grande na tela
→ streamed globe

horizonte/superfície
→ surface
```

NÃO hardcode estes thresholds sem teste.

Calibre-os a partir do custo real.

---

# 10. CORRIGIR CACHE DOS PROVIDERS AO TROCAR MODO

Auditar:

```ts
EarthProvider.setStreamingMode()
MoonProvider.setStreamingMode()
```

Se:

```text
coarse → surface
```

e o cached plan continuar válido durante `replanIntervalS`, ele pode reutilizar seleção de LOD incorreta.

Ao mudar de modo:

```ts
if (this.streamingMode !== mode) {
  this.streamingMode = mode;
  this.cachedPlan = undefined;
}
```

ou arquitetura equivalente.

Adicionar teste.

---

# 11. NÃO STREAMAR A LUA A 384.000 KM SEM NECESSIDADE

Verifique o comportamento atual.

A Lua vista da Terra possui cerca de meio grau de diâmetro angular.

Se isso resultar em algo da ordem de poucos/dezenas de pixels:

```text
MoonVisual
```

já é suficiente.

Não ligue `MoonProvider` só porque:

```text
handoff.mode === planet
```

Streaming deve entrar quando o renderer realmente precisa de geometria física.

---

# 12. GENERALIZAR VISUAL DOS PLANETAS

Hoje:

```text
EarthVisual
MoonVisual
SunVisual
```

são classes específicas.

Não criar agora:

```text
MercuryVisual
VenusVisual
MarsVisual
JupiterVisual
SaturnVisual
UranusVisual
NeptuneVisual
```

com centenas de linhas duplicadas.

Criar uma arquitetura genérica.

Sugestão:

```text
src/rendering/celestial/

CelestialBodyVisualLayer.ts
CelestialPresentationController.ts

CelestialVisual.ts
PlanetVisual.ts
RockyPlanetVisual.ts
GasGiantVisual.ts
SunVisual.ts

RingVisual.ts

math.ts
types.ts
```

Earth/Moon podem continuar especializados onde necessário.

---

# 13. MANIFEST DE APRESENTAÇÃO

Não contaminar `CelestialBody` físico com detalhes de shader se isso puder ser evitado.

Criar algo como:

```ts
interface CelestialPresentationProfile {
  bodyId: string;

  visualType:
    | 'star'
    | 'rocky'
    | 'terrestrial'
    | 'gas-giant'
    | 'ice-giant'
    | 'moon';

  landable: boolean;

  atmosphere?: {
    enabled: boolean;
    densityClass: ...
    visualThickness: ...
  };

  rings?: {
    enabled: boolean;
    innerRadiusM: number;
    outerRadiusM: number;
  };

  surface?: {
    enabled: boolean;
    generator: ...
  };
}
```

Não inventar valores físicos importantes se já houver fonte no projeto.

---

# 14. PLANETVISUAL GENÉRICO

`PlanetVisual` deve receber:

```ts
CelestialRenderSample
+
CelestialPresentationProfile
```

E desenhar:

```text
esfera/disco analítico
phase lighting
oblateness quando relevante
axial orientation quando visível
atmospheric rim
```

Sempre mantendo:

```text
angular size físico
```

---

# 15. MERCÚRIO

Implementar:

```text
tipo: rocky
atmosfera visual: praticamente nenhuma
superfície: pousável
visual: cinza/craterado
```

Inicialmente pode usar geração procedural determinística.

Não precisa fingir que é topografia real.

Documentar claramente:

```text
procedural approximation
```

---

# 16. VÊNUS

Implementar:

```text
tipo: terrestrial
atmosfera: extremamente densa
cloud layer: obrigatória visualmente
surface: pousável logicamente
```

De longe, Vênus não deve parecer um planeta rochoso limpo.

A representação distante deve ser dominada pela atmosfera/nuvens.

Na aproximação:

```text
space
→ bright cloud globe
→ dense atmosphere
→ surface
```

---

# 17. MARTE — PRIMEIRO NOVO PLANETA COMPLETO

Marte deve ser a vertical slice que prova a generalização.

IMPORTANTE:

`UniverseRuntime.ts` já contém lógica parcial para strings:

```text
mars
solar-system/mars-fixed
```

e cálculo hardcoded de superfície marciana.

AUDITE isso.

Não crie uma segunda implementação de Marte.

Remover hardcodes como:

```ts
3389500
```

quando o raio pode vir de:

```ts
CelestialBody
```

Implementar Marte como primeiro planeta realmente visitável depois da Lua.

Fluxo:

```text
Terra
→ interplanetary
→ Mars distant visual
→ Mars coarse globe
→ Mars streamed globe
→ Mars body-local
→ surface
```

---

# 18. SUPERFÍCIE GENÉRICA DE PLANETA ROCHOSO

`PlanetBody.ts` atualmente possui essencialmente:

```text
EARTH
MOON
```

Não copie manualmente seis estruturas quase iguais.

Criar helper:

```ts
planetBodyFromCelestialBody(...)
```

ou contrato equivalente para corpos sólidos.

Deve usar:

```text
equatorialRadiusM
polarRadiusM
body id
frame
```

Não duplicar raios.

---

# 19. PLANETSURFACEPROVIDER

Depois de Marte funcionar usando Earth/Moon architecture, extrair uma base genérica.

Possível:

```text
PlanetSurfaceProvider
```

Responsabilidades:

```text
PlanetQuadtree
SSE selection
streaming mode
readiness
active tile coverage
body-local placement
render-space placement
surface mesh generation
```

Permitir especializações.

Não sacrificar:

```text
EarthProvider
```

porque Terra tem:

```text
Manaus ownership
WGS84
city coverage
Natural Earth
manausSurfaceAnchor
```

EarthProvider continua especial.

MoonProvider pode migrar gradualmente se realmente simplificar.

---

# 20. PROCEDURAL SURFACE STRATEGIES

Criar estratégias, não providers duplicados.

Exemplo:

```ts
interface PlanetSurfaceGenerator {
  buildTile(
    body,
    address
  ): PlanetTileMesh;
}
```

Implementações:

```text
MoonSurfaceGenerator
MercurySurfaceGenerator
MarsSurfaceGenerator
VenusSurfaceGenerator
```

Tudo determinístico.

---

# 21. GAS GIANTS NÃO TÊM CHÃO FALSO

Para:

```text
Júpiter
Saturno
Urano
Netuno
```

NÃO criar terreno rochoso simplesmente para permitir "pouso".

Isso seria arquiteturalmente errado.

Criar:

```text
GasGiantProvider
```

ou representação equivalente.

Com:

```text
cloud-top envelope
atmospheric layers
visual globe
collision/envelope
```

O jogador pode:

```text
aproximar
orbitar
entrar nas camadas superiores se desejado
```

mas não "pousar numa rua de Júpiter".

---

# 22. JÚPITER

Visual obrigatório:

```text
oblateness
bandas atmosféricas
Great Red Spot estilizado/procedural se possível
rapid rotation
```

Não precisa textura externa.

Pode ser shader procedural.

O importante é ser imediatamente reconhecível.

---

# 23. SATURNO

Anéis são obrigatórios.

Criar arquitetura:

```text
RingVisual
```

e não embedar lógica específica de anéis dentro do shader genérico do planeta.

Ring system deve possuir:

```text
inner radius
outer radius
orientation
opacity profile
```

Os anéis precisam:

```text
inclinar junto com o eixo de Saturno
ocultar/ser ocultados corretamente pelo planeta
```

---

# 24. URANO

Preservar seu tilt extremo.

Não corrigir como se fosse bug.

O `CelestialBody` atual já possui aproximadamente:

```text
97.77°
```

A visualização precisa refletir isso.

---

# 25. NETUNO

Visual:

```text
ice giant
azul profundo
banding atmosférico sutil
```

Sem chão sólido falso.

---

# 26. SOL

Sol continua diferente de planeta.

Não criar:

```text
SunSurfaceProvider
```

nesta etapa.

O jogador pode voar até perto dele, mas:

```text
stellar envelope
```

precisa impedir um handoff absurdo para "solo do Sol".

Se o corpo dominante virar Sol e o jogador se aproximar:

```text
continuar domínio interplanetário/stellar
```

ou criar posteriormente:

```text
stellar domain
```

Nunca fazer:

```text
handoffTo('sun') → local ground
```

---

# 27. GENERALIZAR HANDOFFTO

Hoje auditar:

```ts
UniverseRuntime.handoffTo(bodyId)
```

Ele não pode continuar:

```text
if moon
else if earth
```

para o Sistema Solar completo.

Criar resolução genérica.

Exemplo conceitual:

```ts
handoffTo(bodyId) {
  const body = activeSystem.bodies.find(...);

  if (!body)
    ...

  if (body.id === 'earth')
    targetFrame = MANAUS_FRAME_ID;

  else if (bodyIsLandable(body))
    targetFrame = surfaceFrameFor(body);

  else
    reject local-surface handoff;
}
```

Não hardcode todos os planetas em `if/else`.

---

# 28. BODY SURFACE FRAME

Padronizar frame de superfície.

Hoje há:

```text
solar-system/moon-fixed
moon/fixed
```

e Terra possui:

```text
solar-system/earth-fixed
earth/fixed
earth/manaus/legacy-enu
```

Não começar a criar:

```text
mars/fixed
venus/fixed
mercury/fixed
...
```

sem um contrato.

Decida e documente.

Preferência:

```text
body.frameId
```

continua frame físico principal.

Aliases locais só existem quando necessários por compatibilidade.

---

# 29. GENERALIZAR UNIVERSE LOCATION

Auditar:

```ts
UniverseRuntime.navigationState
UniverseRuntime.location
```

Remover lógica:

```text
if moon
else if mars
else earth
```

Criar:

```ts
bodySurfaceLocation(bodyId, position)
```

que obtém o raio a partir do corpo real.

Idealmente suportar elipsoide.

Nenhum:

```ts
1737400
3389500
```

hardcoded nessa camada.

---

# 30. DOMINANT BODY

`SolarSystem.dominantBody()` já é genérico e baseado em:

```text
μ / r²
```

Preservar.

Isso permite naturalmente:

```text
Earth
→ Sun influence
→ Mars influence
```

Não substituir por:

```text
nearest planet
```

sem justificativa física.

---

# 31. VIAGEM EM ESTILO MEGATON RAINFALL

Existe outro problema importante.

Hoje `InterplanetaryController` tem aproximadamente:

```text
maxRelativeSpeed ≈ 222.222 m/s
```

Isso é cerca de:

```text
222 km/s
```

É enorme para uma nave convencional.

Mas para gameplay de um personagem com poderes cósmicos e um Sistema Solar real, ainda é muito lento para chegar aos planetas externos.

Não resolva reduzindo distâncias.

As distâncias permanecem reais.

---

# 32. CRIAR TRAVEL SPEED DOMAINS

Separar velocidade segura próxima a planetas da velocidade de cruise em espaço profundo.

Por exemplo:

```ts
type CosmicTravelTier =
  | 'orbital'
  | 'interplanetary'
  | 'deep-space';
```

ou aproveitar as abstrações existentes.

A semântica deve ser:

```text
perto de um corpo
→ velocidade limitada para evitar atravessar planeta

espaço profundo
→ velocidade colossal

aproximando corpo destino
→ desaceleração automática de teto
```

---

# 33. NÃO USAR VELOCIDADE ALTA CEGA

Se permitir algo como:

```text
0.01c
0.1c
```

não basta:

```ts
position += velocity * dt
```

e torcer para não atravessar Júpiter em um frame.

Implementar:

```text
continuous body envelope checking
segment/sphere intersection
predictive braking
time-to-contact
```

---

# 34. DISTÂNCIA DE PARADA

Calcular:

```text
stoppingDistance =
v² / (2a)
```

Antes de permitir determinada velocidade.

Se:

```text
distanceToBody
<
stoppingDistance + safetyMargin
```

reduzir teto de velocidade.

Assim:

```text
longe
→ absurdamente rápido

aproximando
→ desacelera progressivamente

perto
→ orbital/local speed
```

Essa é a sensação desejada.

---

# 35. NÃO TELEPORTAR ENTRE PLANETAS

O modo principal precisa ser voo contínuo.

Teleport pode continuar existindo como debug/map feature.

Mas não usar:

```text
loading screen
teleport
position snap
```

como solução para viagem normal.

---

# 36. TARGETING PLANETÁRIO

Voar até Netuno sem HUD seria inviável.

Adicionar targeting leve.

Exemplo:

```text
body target
distance
relative speed
ETA
direction
```

Não criar interface gigante.

Pode integrar ao HUD/F3 inicialmente.

Exemplo:

```text
Target: Mars
Distance: 82.4 million km
Relative speed: 24,000 km/s
ETA: 57 min
```

---

# 37. TARGET LOCK

Permitir escolher:

```text
Mercury
Venus
Earth
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
Sun
```

O targeting NÃO teleporta.

Ele apenas fornece:

```text
direction
distance
relative velocity
stopping-distance warning
```

Opcionalmente pode existir uma assistência de direção.

Não transformar o jogo em autopilot obrigatório.

---

# 38. CELESTIALBODYVISUALLAYER GENÉRICO

Hoje há:

```ts
if sun
else if moon
else if earth
```

Isso não escala.

Refatorar para algo parecido com:

```ts
Map<bodyId, CelestialVisual>
```

Exemplo:

```ts
visuals.set('sun', new SunVisual(...));

for (const body of planets)
  visuals.set(
    body.id,
    visualFactory.create(body)
  );
```

Depois:

```ts
for (const sample of samples) {
  visuals.get(sample.bodyId)?.update(...);
}
```

---

# 39. CELESTIALPRESENTATIONCONTROLLER GENÉRICO

Hoje ele repete:

```text
Earth calculations
Moon calculations
Sun calculations
```

Transformar o fluxo dos planetas em loop:

```ts
for (const body of system.bodies) {
  const state = system.stateOf(body.id);

  compute relative vector;
  compute logical distance;
  compute angular radius;
  compute projected pixel diameter;
  choose render strategy;
  compute phase direction;
  push sample;
}
```

Especial cases apenas quando realmente necessário:

```text
Sun
Earth/Manaus
rings
```

Não fazer um `if` com oito planetas.

---

# 40. ILUMINAÇÃO

Todos os corpos devem usar a mesma fonte:

```text
SolarSystem Sun
```

Para cada planeta:

```text
planetToSun =
sunPosition - planetPosition
```

Não inventar luz individual.

Isso automaticamente produz:

```text
fases
terminator
lado noturno
```

corretamente.

---

# 41. ATMOSPHERE PROFILE

Criar perfil genérico de atmosfera.

Não reutilizar a atmosfera local de Manaus como shader de todos os planetas.

Exemplo:

```ts
AtmosphereProfile
```

com:

```text
none
thin
earth-like
dense
gas-giant
ice-giant
```

Earth continua especializada.

---

# 42. ORDEM DE IMPLEMENTAÇÃO

Não tente fazer tudo num mega commit.

Mas continue a task até estabelecer o Sistema Solar completo visualmente.

Fases:

```text
PHASE 0
corrigir proxy math/cache/current celestial architecture

PHASE 1
PlanetVisual genérico
todos os oito planetas visíveis no céu/espaço

PHASE 2
targeting + distances + generic presentation

PHASE 3
Mars complete vertical slice

PHASE 4
Mercury + Venus surfaces

PHASE 5
Jupiter generic gas giant

PHASE 6
Saturn + ring system

PHASE 7
Uranus + Neptune

PHASE 8
generic handoff/navigation/travel hardening

PHASE 9
performance + tests + cleanup
```

Faça commits temáticos.

---

# 43. NÃO DEIXAR OS PLANETAS COMO BOLINHAS COLORIDAS

Uma primeira representação analítica pode ser simples.

Mas o resultado final desta fase precisa distinguir claramente:

```text
Mercury
Venus
Earth
Mars
Jupiter
Saturn
Uranus
Neptune
```

visualmente.

Não aceitar:

```text
SphereGeometry + cor aleatória
```

como "Sistema Solar completo".

---

# 44. NÃO PRECISA TEXTURA 8K PARA TUDO

Preferir:

```text
procedural shader
banding
noise
phase shading
atmosphere
rings
```

para manter performance.

Se assets externos forem usados:

```text
somente gratuitos/legalmente utilizáveis
```

mas esta task não deve depender da internet para funcionar.

---

# 45. LUA E TERRA NÃO PODEM REGREDIR

Preservar:

```text
Manaus ↔ Earth geometric anchor
EarthVisual
MoonVisual
MoonProvider
EarthProvider
Moon phase
Earth from Moon
celestial crossfade
```

Antes e depois de cada fase rodar regressões.

---

# 46. MANUAS NÃO PODE REGREDIR

Preservar:

```text
FEATURES.curvedManaus === false
```

Não ligar essa flag nesta task.

Não mexer desnecessariamente em:

```text
RealCity
roads
terrain
destruction
NPC
traffic
Largo
```

Sistema Solar não pode quebrar Manaus.

---

# 47. GAS GIANT ENVELOPE

Generalizar colisão interplanetária.

Hoje:

```text
bodyRadius + margin
```

é útil para corpos sólidos.

Para gas giants usar:

```text
referenceAtmosphericRadius
```

ou envelope equivalente.

Não deixar o jogador atravessar até o centro porque não existe surface provider.

---

# 48. PLANET ROTATION

O catálogo já possui:

```text
rotationPeriodS
axialTiltRad
```

Começar a usar isso visualmente.

Não deixar todos os planetas com eixo Y vertical.

Especialmente:

```text
Venus retrograde
Uranus ~98°
```

precisam aparecer corretamente.

---

# 49. ANÉIS E EIXO

Saturn rings:

```text
ring normal
=
planet rotation axis
```

Não alinhar com world XZ.

Mesma arquitetura deve permitir futuramente:

```text
Uranus rings
```

---

# 50. PERFORMANCE

Metas:

Corpos distantes:

```text
1 draw call por corpo quando possível
```

Nenhum quadtree para corpo de:

```text
2 px
10 px
20 px
```

Streaming apenas quando necessário.

Quando em Marte:

```text
Manaus city simulation pausada
Moon surface streaming desligado
Earth full globe streaming desligado
```

Só representações necessárias permanecem.

---

# 51. PROVIDER ACTIVATION

`ProviderRegistry` já existe.

Use.

Não atualizar todos os planetas pesadamente todo frame.

Ideal:

```text
distant bodies
→ celestial visual only

target/nearby planet
→ coarse provider

active planet
→ detailed provider
```

---

# 52. STREAMING BUDGET

Não permitir:

```text
Earth tiles
Moon tiles
Mars tiles
Mercury tiles
Venus tiles
```

todos ativos simultaneamente.

O scheduler deve priorizar:

```text
active/dominant body
target body
time-to-contact
screen-space error
```

---

# 53. PLANET TILE KEYS

Já existe:

```text
kind: planet
bodyId
face
level
x
y
```

Aproveitar.

Isso já é naturalmente multi-planeta.

Não criar:

```text
MarsTileKey
MercuryTileKey
```

---

# 54. TESTE — TODOS OS PLANETAS EXISTEM

Verificar:

```text
SOLAR_SYSTEM_BODIES
```

contém exatamente:

```text
sun
mercury
venus
earth
moon
mars
jupiter
saturn
uranus
neptune
```

e dados físicos finitos.

---

# 55. TESTE — EFEMÉRIDES

Para todos os planetas:

```text
position finite
velocity finite
distance to Sun realista para modelo existente
```

Não duplicar testes que já existem.

Expandir onde necessário.

---

# 56. TESTE — CELESTIAL SAMPLES

Com observador próximo da Terra:

o controller deve produzir samples para:

```text
Sun
Mercury
Venus
Earth quando aplicável
Moon
Mars
Jupiter
Saturn
Uranus
Neptune
```

Cada sample:

```text
finite
bounded
angular radius > 0
```

---

# 57. TESTE — PROXY BUDGET

Para cada planeta em várias distâncias:

```text
proxyDistance <= budget
proxyRadius finite
```

Quando analytic representation seria insegura:

```text
safe === false
```

e o sistema troca representação.

Nunca:

```text
Infinity
NaN
1e22 scale
```

---

# 58. TESTE — PROJECTED ANGULAR SIZE

Para todos os corpos:

```text
logical radius + logical distance
↓
angular radius
↓
projected pixels
```

deve ser consistente.

---

# 59. TESTE — MARS ROUNDTRIP

Simular:

```text
Earth barycentric
→ leave Earth influence
→ approach Mars
→ Mars dominant
→ handoff Mars
→ surface/local body frame
→ depart
→ Earth
```

Sem usar browser.

---

# 60. TESTE — GAS GIANT

Aproximar Júpiter.

Esperado:

```text
dominantBody = jupiter
planet visual cresce
gas giant representation ativa
NÃO cria terrain surface local
NÃO chama rocky surface handoff
```

---

# 61. TESTE — SATURN RINGS

Testar matematicamente:

```text
ring orientation
planet axial tilt
inner/outer radius
```

---

# 62. TESTE — URANUS TILT

Verificar que:

```text
~97.77°
```

não é normalizado acidentalmente para algo próximo de zero.

---

# 63. TESTE — SPEED / STOPPING DISTANCE

Criar cenários:

```text
deep space
high speed
target planet ahead
```

e verificar que:

```text
speed ceiling decreases
before collision envelope
```

Não atravessar planeta entre frames.

---

# 64. TESTE — CONTINUOUS COLLISION

Mover de:

```text
outside planet
```

para uma posição que matematicamente passaria para dentro do planeta em um frame.

O sweep deve detectar interceptação.

Não testar apenas posição final.

---

# 65. TESTE — STREAMING OWNERSHIP

Quando próximo de Marte:

```text
Mars provider active
Earth detailed provider inactive
Moon detailed provider inactive
```

Quando próximo da Terra:

```text
Earth provider active
Mars detailed provider inactive
```

---

# 66. TESTE — GAME ORIGIN

Preservar:

```text
Game.origin
==
UniverseRuntime.floatingOrigin
```

no domínio local terrestre.

Não introduzir outra origem para planetas.

---

# 67. TESTE — REENTRY EARTH

Preservar integralmente testes atuais de:

```text
Manaus anchor
Earth surface
reentry
floating origin
```

---

# 68. NÃO USAR PLAYWRIGHT

Para esta implementação:

```text
NÃO usar Playwright
NÃO pilotar personagem automaticamente
NÃO ficar fazendo screenshots
NÃO tentar validar visual por browser automation
```

Usuário fará smoke visual manual.

Use:

```text
unit tests
integration tests
math tests
scene graph tests
build
typecheck
```

---

# 69. VALIDAÇÃO INCREMENTAL

Depois de cada fase:

```bash
npm run typecheck
```

e testes diretamente relacionados.

No final:

```bash
npm run typecheck
npm test
npm run build
```

Não afirmar que passou se não executou.

---

# 70. MANUAL SMOKE QUE O USUÁRIO FARÁ

O resultado final deve permitir testar manualmente:

```text
1. Spawn em Manaus.

2. Subir até sair da atmosfera.

3. Ver Sol e Lua corretamente.

4. Selecionar Marte como target.

5. Acelerar em deep-space travel.

6. Ver Marte crescer continuamente.

7. Desacelerar automaticamente conforme stopping distance.

8. Entrar no domínio de Marte.

9. Aproximar da superfície.

10. Sair de Marte.

11. Visitar Júpiter.

12. Ver Júpiter como gas giant sem chão falso.

13. Visitar Saturno.

14. Ver anéis corretamente inclinados.

15. Ir até Urano/Netuno.

16. Olhar para trás e ainda ver o restante do Sistema Solar coerentemente.
```

---

# 71. SENSAÇÃO VISUAL DE ESCALA

Queremos sensação de:

```text
"isso é realmente um planeta"
```

e não:

```text
"troquei uma esfera por outra"
```

Ao aproximar:

```text
ponto/disco
↓
planeta visível
↓
curvatura enorme
↓
planeta ocupa a tela
↓
horizonte
↓
atmosfera/superfície
```

Tudo contínuo.

---

# 72. O MAPA NÃO PODE SER UMA ILUSÃO

Não usar:

```text
fake solar system miniature
planetas colocados próximos
distâncias comprimidas
```

A posição lógica continua real.

Somente a representação distante é angular/camera-relative.

---

# 73. GRANDE VELOCIDADE NÃO MUDA A ESCALA DO UNIVERSO

Se Netuno está bilhões de quilômetros distante:

```text
Netuno continua bilhões de km distante
```

É o Dr Manaus que passa a poder viajar muito rápido.

Não o universo que encolhe.

---

# 74. NÃO CRIAR `if body === ...` EM TODA PARTE

Corpos devem ser data-driven sempre que possível.

Aceitável:

```text
Sun special renderer
Earth special provider
Saturn rings
```

Não aceitável:

```ts
if mercury ...
else if venus ...
else if mars ...
else if jupiter ...
```

repetido em:

```text
Game
UniverseRuntime
Renderer
Provider
HUD
```

---

# 75. GAME.TS DEVE FICAR MAIS SIMPLES, NÃO MAIS COMPLEXO

Hoje `Game.ts` já conhece:

```text
EarthProvider
MoonProvider
CelestialController
TravelDomain
```

Não adicione:

```ts
readonly mars
readonly mercury
readonly venus
readonly jupiter
...
```

se uma registry/manager genérica pode possuir os providers.

Objetivo:

```text
Game
→ SolarSystemRuntime/PlanetManager
```

e não:

```text
Game
→ oito planetas manualmente
```

---

# 76. POSSÍVEL NOVA CAMADA

Considere criar:

```text
PlanetarySystemController
```

ou:

```text
SolarSystemPresentationRuntime
```

com responsabilidade por:

```text
planet provider lifecycle
visual profile registry
target body
presentation strategy
near-body provider activation
```

Mas só crie depois da auditoria.

Não criar abstração vazia.

---

# 77. TELEMETRIA F3

Adicionar informação útil:

```text
Dominant body
Target body
Target distance
Relative speed
Stopping distance
Travel tier
Active body provider
Render mode
Projected diameter px
Celestial proxy safe?
Streaming tiles
```

Sem poluir HUD normal.

---

# 78. MAJOR MOONS — DEPOIS DOS 8 PLANETAS

O roadmap existente já menciona:

```text
Phobos
Deimos
Io
Europa
Ganymede
Callisto
Titan
Enceladus
Triton
```

NÃO é necessário bloquear a conclusão dos oito planetas por causa delas.

Mas a arquitetura criada agora deve suportá-las sem reescrita.

Após os oito planetas estarem estáveis, continuar por:

```text
Mars:
Phobos
Deimos

Jupiter:
Io
Europa
Ganymede
Callisto

Saturn:
Titan
Enceladus

Neptune:
Triton
```

---

# 79. NÃO TENTAR IMPLEMENTAR 20 SUPERFÍCIES DE UMA VEZ

Para esta etapa:

```text
todos os planetas
→ modelo visual e viagem

rocky planets principais
→ superfície

gas/ice giants
→ atmosphere/globe/envelope
```

Depois luas podem aprofundar o conteúdo.

---

# 80. CRITÉRIO DE CONCLUSÃO DO SISTEMA SOLAR

Não declarar:

```text
"Sistema Solar implementado"
```

só porque `SOLAR_SYSTEM_BODIES` possui os nomes.

Para considerar esta fase concluída:

```text
Mercury visual ✅
Venus visual ✅
Earth visual ✅
Moon visual ✅
Mars visual ✅
Jupiter visual ✅
Saturn visual + rings ✅
Uranus visual ✅
Neptune visual ✅
Sun visual ✅

travel targeting ✅
deep-space speed scaling ✅
predictive braking ✅
generic body presentation ✅
generic handoff architecture ✅
render-safe coordinates ✅
Earth/Moon regressions green ✅
Manaus regressions green ✅
```

E pelo menos:

```text
Mars surface visitable
```

deve provar a arquitetura multi-planeta.

Idealmente também:

```text
Mercury/Venus rocky landing
```

se a abstração estiver estável.

---

# 81. NÃO SACRIFICAR CORREÇÃO POR VELOCIDADE

Esta task é grande.

Não quero:

```text
20 arquivos novos em 5 minutos
tests antigos verdes
"finished"
```

Antes de cada fase:

```text
audit
design
implementation
targeted tests
diff review
```

Se descobrir que uma abstração existente já resolve o problema:

```text
reutilize
```

Se uma recomendação deste prompt conflitar com o código atual melhorado:

```text
preserve o código melhor
e explique
```

---

# 82. RELATÓRIO FINAL OBRIGATÓRIO

Entregar:

```text
HEAD inicial
HEAD final
```

Depois explicar:

```text
1. O que já existia antes da task.

2. O que foi reutilizado.

3. Quais hardcodes foram removidos.

4. Arquitetura final de CelestialPresentationController.

5. Arquitetura final de CelestialBodyVisualLayer.

6. Como todos os planetas são registrados.

7. Como funciona PlanetVisual.

8. Como rocky planets funcionam.

9. Como gas giants funcionam.

10. Como Saturn rings funcionam.

11. Como funciona generic handoff.

12. Como funciona target selection.

13. Como funciona deep-space speed.

14. Como funciona predictive braking.

15. Maior coordenada enviada a Object3D.position.

16. Como foi corrigido o problema tan(π/2).

17. Como caches são invalidados ao trocar streaming mode.

18. Quais providers ficam ativos perto de cada planeta.

19. Novos testes.

20. Resultado real de:
    npm run typecheck
    npm test
    npm run build

21. Riscos restantes.

22. Próxima etapa recomendada para major moons.
```

---

# 83. INVARIANTE FINAL

A arquitetura final deve obedecer:

```text
REAL SOLAR SYSTEM MODEL
        ↓
Float64 / reference frames
        ↓
SolarSystem
        ↓
body relationship / angular size
        ↓
presentation strategy
        ↓
┌──────────────────────────────┐
│ analytic celestial visual    │
│ coarse planetary visual      │
│ streamed body representation │
│ local surface domain         │
└──────────────────────────────┘
        ↓
camera-relative render
```

Nunca:

```text
astronomical Float32 coordinates
fake planet distances
planet scale hacks
duplicated physics values
```

---

# 84. RESULTADO DE GAMEPLAY QUE QUERO

No final, DR Manaus deve caminhar claramente para isto:

```text
estou no Teatro Amazonas

→ voo para cima

→ Manaus vira cidade

→ cidade vira ponto

→ Terra vira planeta

→ escolho Marte

→ acelero absurdamente

→ Terra fica para trás

→ Sol e planetas mantêm posições coerentes

→ Marte começa como ponto

→ vira disco

→ vira planeta gigantesco

→ desacelero

→ atravesso atmosfera

→ chego à superfície

→ volto ao espaço

→ vou para Júpiter

→ vejo bandas e escala colossal

→ vou para Saturno

→ atravesso visualmente o sistema de anéis

→ sigo para Urano e Netuno
```

Tudo isso sem o universo ser uma maquete comprimida.

A escala lógica deve continuar real.

A performance vem de:

```text
LOD
angular representation
streaming
camera-relative rendering
domain handoff
```

e não de diminuir o universo.