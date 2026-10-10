# DR Manaus — NO-RUSH ENGINEERING MANUAL
# Earth / Atmosphere / Orbit Visual Hardening
Repository: `PauloSoaf/Dr-Manaus`
Branch: `feat/universe-map`
HEAD auditado: `6c4ed0c3560768013498d9d17ee1e0572be67c86`
ESTE DOCUMENTO SUBSTITUI QUALQUER INSTRUÇÃO DE CONTINUAR FEATURE DEVELOPMENT.
Objetivo exclusivo desta rodada:
`Manaus -> céu -> alta atmosfera -> órbita -> Terra visível` sem buracos, tela bege, stars leak ou handoff falso.
Pare mapa universal, teleporte infinito, Via Láctea, Andrômeda, Grande Atrator, observable universe e novos black-hole effects até os gates deste documento ficarem verdes.


# 1. COMPORTAMENTO OBRIGATÓRIO DO AGENTE

- [ ] Leia este arquivo inteiro antes de editar.
- [ ] Comece mostrando `git status`, `git log --oneline --decorate -30` e `git rev-parse HEAD`.
- [ ] Se o HEAD mudou, faça diff desde `6c4ed0c` antes de seguir.
- [ ] Reproduza cada bug antes de alterar código.
- [ ] Instrumente o runtime antes de formular causa definitiva.
- [ ] Escreva um teste que falhe pela causa real antes da correção quando isso for viável.
- [ ] Faça uma alteração pequena por responsabilidade.
- [ ] Rode targeted tests após cada alteração.
- [ ] Rode `npm test`.
- [ ] Rode `npm run build`.
- [ ] Para qualquer mudança visual, rode `npm run test:browser`.
- [ ] Abra e examine os screenshots; exit code verde não é prova visual.
- [ ] Não use 'DONE', 'COMPLETE' ou 'GREEN' sem evidência de runtime/browser.
- [ ] Não avance roadmap com regression visual aberta.
- [ ] Não altere 5 subsistemas de uma vez para tentar 'resolver por tentativa'.
- [ ] Não use timeout arbitrário como substituto de readiness.
- [ ] Não aumente budget ou maxTiles para esconder bug de lógica.
- [ ] Não mude camera.far sem medir distância real e provar clipping.
- [ ] Não desligue Earth globe para passar screenshot.
- [ ] Não ligue `curvedManaus` só para 'ver se melhora'.
- [ ] Não reintroduza fake Earth shell como solução permanente.
- [ ] Não faça mapa/teleporte/cosmologia nesta sessão de hardening.


# 2. BUGS REPORTADOS PELO USUÁRIO

BUG A — Terra invisível em órbita:
- screenshot mostra aproximadamente 236,3 km de altitude;
- stars aparecem;
- Terra praticamente não aparece;
- antes ela aparecia;
- nessa altitude a Terra deveria ocupar grande parte do campo de visão se a câmera estiver nadir/oblique.
BUG B — céu branco/bege na cidade:
- HUD mostra `CÉU LIMPO`;
- horário 17:42 / Golden Hour;
- maior parte da tela fica bege/branca;
- apenas o topo fica azul;
- stars aparecem no topo;
- aparência sugere cloud slab, horizon tint excessivo, star leakage ou geometria atravessando a câmera.


# 3. ARQUIVOS QUE DEVEM SER LIDOS ANTES DE QUALQUER PATCH

- [ ] Leia `src/game/Game.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/providers/EarthProvider.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/providers/EarthTransitionController.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/planet/EarthGlobe.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/rendering/Atmosphere.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/rendering/SpaceLayer.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/rendering/domains/RenderDomains.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/rendering/RendererManager.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/core/config.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/runtime/UniverseRuntime.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/spatial/ManausFrameAdapter.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/providers/MoonProvider.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/planet/MoonGlobe.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/streaming/GlobalStreamingScheduler.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `src/world/streaming/TileDemand.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `scripts/browser-test.mjs` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `tests/earth-globe.test.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `tests/universe-runtime.test.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `tests/travel-domain.test.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `tests/moon.test.ts` no HEAD atual; não confie em cópia antiga.
- [ ] Leia `tests/reference-frames.test.ts` no HEAD atual; não confie em cópia antiga.


# 4. REFERÊNCIAS TÉCNICAS EXTERNAS

### Three.js WebGPURenderer
URL: https://threejs.org/docs/pages/WebGPURenderer.html
Por que ler: logarithmicDepthBuffer, backend WebGPU/WebGL2

### Three.js WebGPU manual
URL: https://threejs.org/manual/pages/webgpurenderer
Por que ler: arquitetura moderna do renderer

### Three.js TSL
URL: https://threejs.org/tsl/
Por que ler: caminho moderno para node shaders

### Three.js Layers
URL: https://threejs.org/docs/pages/Layers.html
Por que ler: objeto só renderiza se camera e object compartilham layer

### Three.js Object3D
URL: https://threejs.org/docs/pages/Object3D.html
Por que ler: renderOrder, layers, frustum, transforms

### Three.js Material
URL: https://threejs.org/docs/pages/Material.html
Por que ler: transparent, depthWrite, depthTest

### Three.js PerspectiveCamera
URL: https://threejs.org/docs/pages/PerspectiveCamera.html
Por que ler: near/far e projeção

### Three.js WebGPU Earth example
URL: https://threejs.org/examples/webgpu_tsl_earth.html
Por que ler: referência TSL/Earth

### Playwright visual comparisons
URL: https://playwright.dev/docs/test-snapshots
Por que ler: visual regression

### Playwright trace viewer
URL: https://playwright.dev/docs/trace-viewer
Por que ler: inspeção de artifacts/diffs


# 5. FATOS IMPORTANTES DAS DOCS

- [ ] `Layers`: visibility exige interseção entre layer mask da câmera e do objeto.
- [ ] `Material.transparent=true`: objeto segue regras do pipeline transparente.
- [ ] `depthWrite=false`: o material não escreve depth.
- [ ] `renderOrder`: não elimina a separação entre filas opaque/transparent.
- [ ] `WebGPURenderer` suporta `logarithmicDepthBuffer` e fallback WebGL2.
- [ ] TSL é o caminho moderno e backend-agnostic para shaders no WebGPURenderer.
- [ ] Playwright suporta screenshot comparison; baselines precisam de ambiente consistente.


# 6. ESTADO ATUAL RELEVANTE DO RENDERER

`RendererManager.ts` usa:
```ts
new WebGPURenderer({
  antialias: true,
  alpha: false,
  logarithmicDepthBuffer: true,
  forceWebGL: new URLSearchParams(location.search).has('webgl')
})
```
Camera inicial:
```ts
new PerspectiveCamera(58, 1, .15, LOCAL_FAR_M)
```
`RenderDomains.ts`: LOCAL_LAYER=0, PLANET_LAYER=1.
`RenderDomains.active=true` habilita PLANET_LAYER.
`setRange()` usa piso planetário de 50.000 km.
Conclusão operacional:
não assuma que o bug é far plane; em ~236 km o far configurado deveria ser suficiente.
Meça primeiro.


# 7. CAUSA PROVÁVEL A SER PROVADA — EARTH READINESS

`EarthTransitionController.ts` consulta:
```ts
const targetCoverageReady = earth.isCoverageReady(requiredLod);
```
`EarthProvider.ts` delega para:
```ts
return this.globe.hasLevel(requiredLod);
```
`EarthGlobe.hasLevel()` retorna true quando existe QUALQUER tile com level suficiente.
Isso não prova que a região que a câmera precisa esteja ativa.
Invariante violado provável:
`EXISTE ALGUM TILE != VIEW COVERAGE READY`.
Não trate isso como causa confirmada até capturar telemetry no frame com Terra ausente.


# 8. NOVO CONTRATO DE READINESS

Projete um estado explícito semelhante a:
```ts
interface EarthCoverageReadiness {
  requestedKeys: readonly string[];
  requiredKeys: readonly string[];
  activeRequiredKeys: readonly string[];
  missingRequiredKeys: readonly string[];
  coverageRatio: number;
  coarseFallbackReady: boolean;
  viewCoverageReady: boolean;
  targetLod: number;
}
```
Não precisa copiar nomes.
Precisa provar a cobertura da view atual.
Regras:
- `plan()` registra bounded current demand set;
- `activate()` registra active key;
- `deactivate()` remove active key;
- stale plan/generation não pode manter readiness true;
- loaded-but-not-active não conta como rendered coverage;
- unrelated far-side tile não pode tornar ready;
- active ancestor pode ser aceito como fallback se cobrir o target.


# 9. HANDOFF NÃO PODE SER BOOLEANO DISFARÇADO

Hoje Game reduz weights a:
```ts
const localGround = state.localWeight > 0.01 && isEarth;
flatTerrain.visible = localGround;
atmosphere.planetaryView = !localGround;
space.planetaryView = !localGround;
```
Defina estados/invariantes equivalentes a:
LOCAL_ONLY
REQUESTING_PLANET
OVERLAP_SAFE
PLANET_DOMINANT
PLANET_ONLY
RETURNING_LOCAL
Regra absoluta:
`old representation stays until new representation is ready`.
Regra de continuidade:
`LOCAL_GROUND_READY || PLANET_GROUND_READY` deve ser true em todo frame de subida/descida terrestre.


# 10. COARSE EARTH FALLBACK

- [ ] Considere um fallback coarse body-fixed sempre disponível em altitude planetária.
- [ ] Não reintroduza a esfera fake centrada na câmera.
- [ ] Pode ser cube-sphere low LOD, pinned low-level tile set ou ellipsoid macro.
- [ ] Fallback deve usar Earth frame real.
- [ ] Fallback deve ter land/ocean macro suficiente para a Terra nunca sumir.
- [ ] Fallback não pode duplicar indefinidamente geometry.
- [ ] Fallback não pode z-fight com tiles finos; defina ownership/morph/depth strategy.
- [ ] Não construa um novo sistema enorme se pinned coarse ancestors resolverem.


# 11. DEBUG TELEMETRY OBRIGATÓRIA PARA EARTH

- [ ] Expose/log `Earth group visible`.
- [ ] Expose/log `Earth atmosphere visible`.
- [ ] Expose/log `Earth tile count`.
- [ ] Expose/log `Earth triangle count`.
- [ ] Expose/log `Earth planned demand count`.
- [ ] Expose/log `Earth required demand count`.
- [ ] Expose/log `Earth active required count`.
- [ ] Expose/log `Earth missing required count`.
- [ ] Expose/log `Earth coverage ratio`.
- [ ] Expose/log `Earth viewCoverageReady`.
- [ ] Expose/log `Earth coarseFallbackReady`.
- [ ] Expose/log `Earth transition phase`.
- [ ] Expose/log `Earth localWeight`.
- [ ] Expose/log `Earth planetWeight`.
- [ ] Expose/log `Earth provider altitude`.
- [ ] Expose/log `Universe telemetry altitude`.
- [ ] Expose/log `Universe dominantBody`.
- [ ] Expose/log `Universe current frame`.
- [ ] Expose/log `Earth provider playerFrameId`.
- [ ] Expose/log `Camera layer mask`.
- [ ] Expose/log `Planet layer enabled`.
- [ ] Expose/log `Camera near`.
- [ ] Expose/log `Camera far`.
- [ ] Expose/log `Distance camera->Earth centre`.
- [ ] Expose/log `Central-ray alignment toward Earth`.
- [ ] Expose/log `Scheduler queued`.
- [ ] Expose/log `Scheduler active`.
- [ ] Expose/log `Scheduler generation`.


# 12. BUG OBJETIVO NO SKY — CLOUDS EM `clear`

Em `Atmosphere.ts`, a visibilidade atual é essencialmente:
```ts
this.clouds.visible = !this.planetaryView && this.altitude < SPACE.karman;
```
`weather === 'clear'` não desliga as nuvens.
As nuvens são 72 `SphereGeometry` instanciadas, achatadas e grandes.
Material atual é opaco por default.
Primeiro hotfix semântico aceitável:
```ts
this.clouds.visible =
  !this.planetaryView
  && this.altitude < SPACE.karman
  && this.weather !== 'clear';
```
Depois valide cloudy/rain/storm.
Não implemente volumetric cloud raymarch nesta rodada.


# 13. CLOUD GEOMETRY

Posição vertical atual das clouds é aproximadamente 1000-1540 m.
Escalas podem passar de 1000 m em X.
Riscos:
- câmera dentro/embaixo de ellipsoid opaco;
- tela coberta por slab bege;
- hard silhouettes;
- nenhuma soft alpha edge;
- clear sky ainda com geometry.
Debug obrigatório:
encontre a cloud instance mais próxima da câmera e registre transform/scale.
Se a câmera estiver dentro do bound aproximado, registre explicitamente.


# 14. GOLDEN HOUR

Golden Hour atual usa horizon `#f3c095`.
O dome base mistura horizon->top até `direction.y=0.5`, faixa ampla demais.
Separe:
1. base sky gradient azul;
2. narrow horizon warm band;
3. localized sun glow.
Não faça metade do hemisfério depender de horizon bege.
Golden Hour esperado:
- zenith azul;
- mid-sky azul/cyan;
- faixa quente estreita no horizonte;
- glow concentrado em torno do Sol;
- nenhuma estrela em pleno low-altitude daytime.


# 15. STAR LEAK NO CHÃO

`SpaceLayer` suaviza `factor` ao descer.
`stars.visible` depende de `uVisible`.
`Atmosphere.sky` tem `depthWrite=false`.
Stars são transparent/additive e renderizam depois.
Portanto stars residuais podem aparecer sobre sky diurno.
Adicione semantic guard:
- baixa altitude + daytime => stars forbidden;
- Night => allowed;
- upper atmosphere => fade allowed;
- orbit => allowed.
Não remova smoothing global.
Use hard semantic visibility guard + smooth opacity quando permitido.


# 16. ALTITUDE CANÔNICA

Game atualmente alimenta Atmosphere/Space com `player.position.y`.
Isso é frágil com floating origin, WGS84, Moon e handoffs.
Compare antes de mudar:
- player.position.y;
- universe.telemetry.altitudeM;
- universe.location altitude;
- EarthProvider altitude;
Se divergem, escolha uma fonte canônica BODY-RELATIVE.
Não substitua raw Y por outra métrica sem validar que ela é correta no frame atual.


# 17. LAYERS

- [ ] Logue `camera.layers.mask`.
- [ ] Logue layer mask de um Earth tile ativo.
- [ ] Logue layer mask do Earth atmosphere mesh.
- [ ] Logue layer mask das stars.
- [ ] Use `camera.layers.test(object.layers)` em debug.
- [ ] Não chame `enable(PLANET_LAYER)` todo frame para mascarar lifecycle bug.


# 18. CAMERA / DEPTH

- [ ] Logue `camera.near` e `camera.far` em todos os checkpoints.
- [ ] Calcule distância real até Earth centre.
- [ ] Confirme `far > distance + radius margin` quando olhando a Terra.
- [ ] Não mude near/far sem prova.
- [ ] Preserve logarithmic depth durante o diagnóstico.
- [ ] Não adicione segunda câmera/segundo render direto ao canvas como hotfix.


# 19. WORLD ROOT / FLOATING ORIGIN

- [ ] Mapeie parents de EarthGlobe, Atmosphere, SpaceLayer, Moon e camera.
- [ ] Dump local position e world position de um Earth tile.
- [ ] Dump `worldRoot.position` e `origin`.
- [ ] Confirme que Earth tiles não recebem rebase duas vezes.
- [ ] Confirme que player/camera/sky estão no mesmo render-local convention.
- [ ] Use `updateMatrixWorld(true)` antes de ler world position em debug.


# 20. DIAGNOSTIC DECISION TREE — EARTH

- Q1: `earth.globe.visible` false? -> provider/transition gate.
- Q2: visible true, surface tiles 0? -> scheduler/readiness.
- Q3: tiles >0, camera layer mismatch? -> layers.
- Q4: layer okay, tile positions absurd/non-finite? -> frame/rebase.
- Q5: positions sane, bright debug material still invisible? -> camera/depth/orientation.
- Q6: bright debug material visible but normal material dark? -> shading/sun/material.


# 21. DIAGNOSTIC DECISION TREE — SKY

- Q1: weather clear e clouds.visible true? -> clear-weather semantics bug.
- Q2: hide clouds debug; slab disappears? -> cloud geometry contributor.
- Q3: force stars hidden; top star noise disappears? -> star leakage.
- Q4: switch Golden Hour -> Noon; beige disappears? -> horizon shader contributor.
- Q5: disable fog debug; wash disappears? -> fog contributor.
- Q6: none above? -> inspect Earth/Moon/space geometry crossing camera.


# 22. MOON INTERFERENCE CHECK

- [ ] At 100 m Earth ground, Moon surface provider must not be visible.
- [ ] Assert Moon active surface tiles == 0 at ground.
- [ ] Log Moon globe visibility.
- [ ] Do not assume beige slab is cloud until Moon/Earth atmosphere geometry are ruled out.


# 23. EARTH ATMOSPHERE MESH CHECK

- [ ] Earth atmosphere mesh uses huge physical sphere on PLANET_LAYER.
- [ ] Verify Earth group visibility at ground.
- [ ] Verify atmosphere centre equals Earth centre in current render frame.
- [ ] Verify camera is not erroneously inside a wrongly positioned planet atmosphere sphere.
- [ ] Atmosphere shell alone does not count as Earth surface coverage.


# 24. SPACE SHELL CHECK

- [ ] At ground, `spaceFactorFor` should target zero.
- [ ] Verify `SpaceLayer.shell.visible` after settling at 100 m.
- [ ] Do not let shell remain as a giant camera-centred sky substitute after return from orbit.
- [ ] Stars and shell are separate diagnostics.


# 25. TEST FILE STRATEGY

Prefer adding:
`tests/earth-transition.test.ts`
Keep geometry math assertions in:
`tests/earth-globe.test.ts`
Keep runtime/frame assertions in:
`tests/universe-runtime.test.ts`
Do not weaken existing tests to obtain green.


# 26. UNIT TESTS — EARTH READINESS

- [ ] zero active required tiles -> not ready
- [ ] one unrelated tile -> not ready
- [ ] one far-side level-0 tile -> not ready for current view
- [ ] all required keys active -> ready
- [ ] active ancestor covering required fine tile can satisfy fallback when designed
- [ ] deactivate required key -> readiness updates false
- [ ] activate unrelated key -> readiness unchanged
- [ ] new plan invalidates stale required set
- [ ] scheduler generation change invalidates stale ready
- [ ] required set bounded
- [ ] readiness deterministic
- [ ] readiness does not depend only on numeric LOD


# 27. UNIT TESTS — ATMOSPHERE/SPACE SEMANTICS

- [ ] clear weather -> cloud coverage/visible false at ground
- [ ] cloudy -> cloud allowed
- [ ] rain -> cloud allowed
- [ ] storm -> cloud allowed
- [ ] Noon 100 m -> stars forbidden
- [ ] Morning 100 m -> stars forbidden
- [ ] Golden Hour 100 m -> stars forbidden
- [ ] Night 100 m -> stars allowed
- [ ] Noon orbit -> stars allowed
- [ ] NaN altitude -> safe finite fallback
- [ ] return orbit->ground -> star gate eventually/semantically off


# 28. BROWSER TEST EXTENSION

Use o script existente `scripts/browser-test.mjs`.
Não crie framework paralelo sem necessidade.
Adicione helpers para:
- set altitude deterministically;
- orient camera nadir/horizon/zenith;
- wait Earth coverage condition;
- dump JSON telemetry;
- capture PNG.
Evite `sleep(5000)` como readiness principal.
Use `page.waitForFunction()` com condição factual.


# 29. SCREENSHOT ARTIFACTS OBRIGATÓRIOS

- [ ] Generate `artifacts/earth-100m-clear-golden-horizon.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-100m-clear-noon-zenith.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-5km-clear-golden-horizon.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-15km-clear-golden-horizon.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-30km-clear-golden-horizon.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-60km-clear-noon-nadir.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-120km-clear-noon-nadir.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-236km-clear-noon-nadir.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-236km-clear-noon-horizon.png` plus matching `.json` telemetry.
- [ ] Generate `artifacts/earth-400km-clear-noon-nadir.png` plus matching `.json` telemetry.


# 30. INVARIANT ASSERTS NO BROWSER

- [ ] Earth dominant + local ground hidden => planet surface coverage must be ready.
- [ ] clear + low altitude + daytime => clouds hidden.
- [ ] clear + low altitude + daytime => stars hidden.
- [ ] orbit + nadir + Earth dominant => Earth surface active and visible.
- [ ] all key positions finite.
- [ ] camera far > near.
- [ ] planet layer enabled when Earth tiles expected.
- [ ] no pageerror/console error.


# 31. ASCENT CHECKPOINTS

### Altitude 100 m
- [ ] Set exact test altitude 100 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 1000 m
- [ ] Set exact test altitude 1000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 5000 m
- [ ] Set exact test altitude 5000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 10000 m
- [ ] Set exact test altitude 10000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 15000 m
- [ ] Set exact test altitude 15000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 20000 m
- [ ] Set exact test altitude 20000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 30000 m
- [ ] Set exact test altitude 30000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 60000 m
- [ ] Set exact test altitude 60000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 120000 m
- [ ] Set exact test altitude 120000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 236300 m
- [ ] Set exact test altitude 236300 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.

### Altitude 400000 m
- [ ] Set exact test altitude 400000 m above same Manaus geodetic line.
- [ ] Dump player.position.y.
- [ ] Dump universe telemetry altitude.
- [ ] Dump dominant body.
- [ ] Dump Earth transition state.
- [ ] Dump Earth readiness.
- [ ] Capture nadir.
- [ ] Capture horizon.
- [ ] Capture zenith.


# 32. DESCENT CHECKPOINTS

### Descend through 400000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 236300 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 120000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 60000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 30000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 20000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 15000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 10000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 5000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 1000 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.

### Descend through 100 m
- [ ] Verify old/new representation overlap safely.
- [ ] Verify local sky returns before planetary sky retires if required.
- [ ] Verify stars obey altitude/time semantics.
- [ ] Verify clouds obey weather semantics.
- [ ] Verify no black frame.
- [ ] Verify no beige slab.


# 33. COMMIT POLICY

- [ ] Suggested isolated commit: `test(render): reproduce Earth orbit disappearance`.
- [ ] Suggested isolated commit: `fix(earth): make handoff readiness view/demand aware`.
- [ ] Suggested isolated commit: `fix(atmosphere): disable clear-sky cloud slab`.
- [ ] Suggested isolated commit: `fix(atmosphere): constrain Golden Hour horizon band`.
- [ ] Suggested isolated commit: `fix(space): gate daytime low-altitude stars`.
- [ ] Suggested isolated commit: `test(browser): add Earth ascent visual regression`.
- [ ] Suggested isolated commit: `docs(world): record verified transition evidence`.


# 34. DONE CRITERIA BUG A

- [ ] Bug reproduced at ~236.3 km.
- [ ] Root cause written before/with patch.
- [ ] Readiness no longer equivalent to `has any tile at level`.
- [ ] View-facing/coarse coverage semantics explicit.
- [ ] Earth never disappears during slow streaming.
- [ ] Earth visible at 120 km nadir.
- [ ] Earth visible at 236.3 km nadir.
- [ ] Earth visible at 400 km nadir.
- [ ] Horizon view shows curved limb.
- [ ] Planet layer verified.
- [ ] Camera range verified.
- [ ] No local ground retirement before target ready.
- [ ] Unit tests green.
- [ ] Browser screenshots inspected.


# 35. DONE CRITERIA BUG B

- [ ] `clear` has no giant cloud slab.
- [ ] Cloud visibility semantics explicit.
- [ ] Golden Hour warm band narrow.
- [ ] Zenith remains blue.
- [ ] No stars at low-altitude daytime.
- [ ] Night stars still visible.
- [ ] High-altitude stars still visible.
- [ ] Fog finite/coherent.
- [ ] No camera-inside-cloud artifact in clear.
- [ ] Ground screenshot inspected.
- [ ] Cloudy/rain/storm still coherent.


# 36. PERFORMANCE GATE

- [ ] Run `npm run profile` after functional fix.
- [ ] Compare draw calls ground/orbit.
- [ ] Compare triangle count.
- [ ] Compare geometry count.
- [ ] Compare texture count.
- [ ] Compare scheduler queue.
- [ ] Readiness query must be bounded and cheap.
- [ ] Do not build new Earth geometry every frame.
- [ ] Repeated ground->orbit->ground must not leak geometry.


# 37. STATUS VOCABULARY

Use apenas:
`not-started`
`prototype`
`integrated`
`verified`
`verified` exige test + runtime/browser evidence.
Não use `complete` para algo só porque o arquivo existe.


# 38. PROIBIÇÕES ESPECÍFICAS DE RUSH

- [ ] Não fazer UniversalMap nesta rodada.
- [ ] Não fazer UniversalTeleportService nesta rodada.
- [ ] Não adicionar galaxy renderers.
- [ ] Não adicionar cosmic web.
- [ ] Não adicionar CMB.
- [ ] Não adicionar black-hole lens.
- [ ] Não mudar Sgr A*.
- [ ] Não aumentar stars.
- [ ] Não refatorar Earth+Moon em GenericPlanetProvider.
- [ ] Não criar volumetric clouds completo.
- [ ] Não criar ocean shader antes de Earth visibility ficar estável.
- [ ] Não alterar 20 arquivos sem necessidade.
- [ ] Não atualizar docs para 'complete' antes de screenshots.
- [ ] Não criar dead code renderer que runtime não alcança.
- [ ] Não usar `Math.random()` em visual procedural persistente.
- [ ] Não converter BigInt cósmico absoluto para Number.
- [ ] Não colocar coordenadas galácticas físicas em Three.js.


# 39. ROOT CAUSE REPORT TEMPLATE

Preencha isto antes de considerar o patch final:
```markdown
## Symptom
...
## Reproduction
...
## Direct cause
...
## Contributing causes
...
## Violated invariant
...
## Why tests missed it
...
## Minimal architectural fix
...
## Tests added
...
## Browser evidence
...
## Performance risk
...
```


# 40. FINAL COMMAND GATE

Rode exatamente:
```bash
npm run typecheck
npm test
npm run build
npm run test:browser
npm run profile
```
Se qualquer um falhar:
não avance.
Se todos passarem mas screenshot estiver visualmente errado:
não avance.

# 41. FILE-BY-FILE — `src/game/Game.ts`

- [ ] Read constructor ownership for Atmosphere, SpaceLayer, UniverseRuntime, EarthProvider and MoonProvider.
- [ ] Document scene parent for each render subsystem.
- [ ] Document exact update order inside tick before changing it.
- [ ] Preserve one `renderer.render(scene,camera)` call.
- [ ] Do not add a second direct screen render pass.
- [ ] Inspect the Earth transition block around `earthTransition.update()`.
- [ ] Replace boolean handoff semantics only after structured readiness exists.
- [ ] Keep local ground until planet coverage is factual.
- [ ] Do not make `localGround=false` solely from altitude.
- [ ] Do not make `planetaryView=true` solely from altitude.
- [ ] Expose transition telemetry without heavy allocation.
- [ ] Record `isEarth` each frame in debug.
- [ ] Record `dominantBody` each frame in debug.
- [ ] Record `universe.telemetry.altitudeM`.
- [ ] Record raw `player.position.y` for comparison.
- [ ] Validate which altitude feeds Atmosphere.
- [ ] Validate which altitude feeds SpaceLayer.
- [ ] Do not change travel/map/cosmic logic in Earth hotfix.
- [ ] Preserve floating origin.
- [ ] Verify `worldRoot.position=-origin` interaction with Earth group.
- [ ] Verify camera update occurs before final renderer call.
- [ ] Keep HUD update after render or document if changed.
- [ ] Do not hide rendering errors behind HUD.


# 42. FILE-BY-FILE — `src/world/providers/EarthProvider.ts`

- [ ] Replace `isCoverageReady(requiredLod)` with a view/demand-aware readiness contract.
- [ ] Do not consider any random tile enough.
- [ ] Record last current plan keys.
- [ ] Record bounded required handoff keys.
- [ ] Track active keys.
- [ ] Remove active key during deactivate.
- [ ] Invalidate stale readiness when the plan changes.
- [ ] Invalidate stale readiness when generation changes if relevant.
- [ ] Expose readiness stats to debug.
- [ ] Keep provider bounded by maxTiles.
- [ ] Preserve replan cache.
- [ ] Do not recompute quadtree needlessly every frame.
- [ ] Do not turn `cityOwnsGround` off as a workaround.
- [ ] Keep load pure; no scene mutation in load.
- [ ] Keep scene mutation in activate/deactivate.
- [ ] Preserve deterministic tile generation.
- [ ] Preserve `fog:false` planet material path.
- [ ] Verify current player frame before converting to Manaus frame.
- [ ] Reject/handle unsupported frames explicitly rather than silently fabricating geodetic values.
- [ ] Add tests for unrelated tile not satisfying readiness.
- [ ] Add tests for active ancestor/coarse fallback if implemented.


# 43. FILE-BY-FILE — `src/world/providers/EarthTransitionController.ts`

- [ ] Accept structured readiness instead of only requiredLod boolean.
- [ ] Keep controller pure.
- [ ] Do not access scene graph.
- [ ] Do not load tiles.
- [ ] Do not mutate provider internals.
- [ ] Represent transition phase explicitly if it improves invariants.
- [ ] Guarantee old representation remains while target unavailable.
- [ ] Guarantee return path also prewarms local representation.
- [ ] Clamp every weight.
- [ ] Keep every numeric output finite.
- [ ] Add hysteresis if threshold flutter is reproduced.
- [ ] Do not add arbitrary time delays.
- [ ] Test high altitude + readiness false.
- [ ] Test readiness becomes true after delay.
- [ ] Test readiness becomes false after required eviction.
- [ ] Test descent path.
- [ ] Document every altitude threshold.
- [ ] Consider centralizing transition thresholds with config only after behavior stabilizes.


# 44. FILE-BY-FILE — `src/world/planet/EarthGlobe.ts`

- [ ] Keep outward winding logic.
- [ ] Keep FrontSide; do not switch to DoubleSide to hide a transform bug.
- [ ] Keep material shared across tiles.
- [ ] Keep tiles on PLANET_LAYER.
- [ ] Keep atmosphere mesh on PLANET_LAYER.
- [ ] Expose active keys without reparsing every key each frame if possible.
- [ ] Do not leave `hasLevel()` as the handoff truth.
- [ ] Keep add/remove geometry disposal correct.
- [ ] Do not allocate new material per tile.
- [ ] Keep frustum policy unchanged unless measured.
- [ ] Verify atmosphere centre and surface tile coordinate basis agree.
- [ ] Verify atmosphere radius uses same physical units as surface.
- [ ] If coarse fallback added, create explicit lifecycle.
- [ ] If coarse fallback added, prevent z-fighting with fine tiles.
- [ ] Do not fetch textures from the network.
- [ ] Keep sun uniform normalized.


# 45. FILE-BY-FILE — `src/rendering/Atmosphere.ts`

- [ ] Clear weather must suppress cloud geometry or cloud coverage.
- [ ] Do not show 72 opaque ellipsoids in `clear`.
- [ ] Keep cloudy/rain/storm separately meaningful.
- [ ] Constrain Golden Hour warm horizon to a narrow band.
- [ ] Keep zenith blue.
- [ ] Keep localized sun glow.
- [ ] Do not build volumetric cloud raymarch in this patch.
- [ ] Use canonical body-relative altitude after it is validated.
- [ ] Keep sky centred in the correct render-local frame.
- [ ] Verify camera is not offset from sky centre.
- [ ] Keep planetaryView as an ownership signal, not a readiness source.
- [ ] Do not disable local sky before planet coverage exists.
- [ ] Keep fog finite.
- [ ] Guarantee fog near < fog far.
- [ ] Do not change global exposure to compensate for sky colour.
- [ ] Extract pure weather/visibility helper if that improves testing.
- [ ] Add clear-weather unit tests.
- [ ] Check no new per-frame allocations.


# 46. FILE-BY-FILE — `src/rendering/SpaceLayer.ts`

- [ ] Add a semantic low-altitude daytime star gate.
- [ ] Preserve deterministic seeded star field.
- [ ] Preserve Night ground stars.
- [ ] Preserve orbit stars.
- [ ] Preserve smooth high-atmosphere transition.
- [ ] Do not use `uVisible` alone to decide daytime ground visibility.
- [ ] Verify layer switch to PLANET_LAYER in planetaryView.
- [ ] Verify restoration to layer 0 leaving planetaryView.
- [ ] Keep old fake shell disabled once real Earth is authoritative.
- [ ] Do not re-enable fake Earth shell to hide missing tiles.
- [ ] Verify shell hidden at settled low altitude.
- [ ] Verify star scale stays inside camera far.
- [ ] Verify stars are depth-occluded by opaque Earth.
- [ ] Use canonical altitude if raw player.y diverges.
- [ ] Keep all values finite for NaN fallback.


# 47. FILE-BY-FILE — `src/rendering/domains/RenderDomains.ts`

- [ ] Verify PLANET_LAYER enable state.
- [ ] Verify local layer remains enabled when planet layer enabled.
- [ ] Log current camera layer mask.
- [ ] Log far distance.
- [ ] Do not increase far without measured need.
- [ ] Do not reduce near toward zero.
- [ ] Keep one-camera logarithmic-depth architecture.
- [ ] Do not reintroduce two direct renders to canvas.
- [ ] Guard `setRange` against NaN/Infinity.
- [ ] Document any range policy change.


# 48. FILE-BY-FILE — `src/rendering/RendererManager.ts`

- [ ] Keep WebGPURenderer.
- [ ] Keep WebGL2 fallback.
- [ ] Keep logarithmicDepthBuffer unless a measured renderer bug proves otherwise.
- [ ] Do not switch alpha mode.
- [ ] Do not change toneMapping globally to fix one atmosphere bug.
- [ ] Do not add a second renderer.
- [ ] Keep camera near > 0.
- [ ] Test SwiftShader/WebGL fallback.
- [ ] Manually test WebGPU when available.


# 49. FILE-BY-FILE — `scripts/browser-test.mjs`

- [ ] Add deterministic altitude helper.
- [ ] Add deterministic camera look helper.
- [ ] Add transition telemetry helper.
- [ ] Add Earth coverage wait helper.
- [ ] Add screenshot helper.
- [ ] Add JSON artifact helper.
- [ ] Test clear ground before destructive tests alter the world.
- [ ] Capture 100 m clear Golden Hour.
- [ ] Assert clouds hidden at 100 m clear.
- [ ] Assert stars hidden at 100 m daytime.
- [ ] Move to 236.3 km deterministically.
- [ ] Wait on coverage state, not blind sleep.
- [ ] Orient nadir.
- [ ] Assert Earth visible/readiness.
- [ ] Capture 236.3 km nadir.
- [ ] Capture 236.3 km horizon.
- [ ] Print telemetry on failure.
- [ ] Keep existing city smoke tests.
- [ ] Keep existing destruction tests.
- [ ] Keep existing menu tests.
- [ ] Do not swallow critical new wait failure with `.catch(()=>undefined)`.


# 50. DEBUG API CONTRACT

### `debugEarthTransition`
- Purpose: Return serializable transition/readiness/camera/layer state.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugSetEarthAltitude`
- Purpose: Test-only/dev-only deterministic altitude placement.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugLookNadir`
- Purpose: Orient camera toward current dominant body centre.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugLookHorizon`
- Purpose: Orient camera tangentially to current body.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugLookZenith`
- Purpose: Orient camera away from current body.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugHideClouds`
- Purpose: Temporary diagnostic only.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugHideStars`
- Purpose: Temporary diagnostic only.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.

### `debugForceEarthBright`
- Purpose: Temporary diagnostic unlit/bright surface only.
- Must not leak production-only behavior into save/gameplay.
- Must use current coordinate authority; no arbitrary giant Vector3.


# 51. EARTH 236.3 KM FORENSIC CHECKLIST

- [ ] Player logical altitude ≈236300 m.
- [ ] Universe telemetry altitude ≈236300 m.
- [ ] Dominant body == earth.
- [ ] EarthProvider covers == true.
- [ ] Earth globe group visible == true.
- [ ] Earth surface tile count > 0 after settle.
- [ ] Current plan demand count > 0.
- [ ] Required handoff set > 0.
- [ ] Required active count satisfies readiness.
- [ ] Missing required set empty or below explicit tolerated policy.
- [ ] Camera shares PLANET_LAYER.
- [ ] Earth tile shares PLANET_LAYER.
- [ ] Camera far exceeds Earth view distance.
- [ ] Camera direction actually points nadir for nadir screenshot.
- [ ] Earth centre world position finite.
- [ ] Earth tile world positions finite.
- [ ] No tile centre magnitude unexpectedly ~1e20.
- [ ] Earth atmosphere is not the only active Earth geometry.
- [ ] Local sky retired only after planet ready.
- [ ] Flat terrain retired only after planet ready.
- [ ] Stars remain behind opaque Earth.
- [ ] Renderer reports nonzero Earth triangles.


# 52. GROUND CLEAR FORENSIC CHECKLIST

- [ ] Weather == clear.
- [ ] Time == Golden Hour for reported reproduction.
- [ ] Altitude below 500 m.
- [ ] Atmosphere sky visible.
- [ ] Atmosphere clouds hidden.
- [ ] Space stars hidden.
- [ ] Space shell settled hidden/appropriate.
- [ ] Earth transition in local phase.
- [ ] Flat terrain visible.
- [ ] Planet-only mode false.
- [ ] Fog finite.
- [ ] Fog near < far.
- [ ] Sky centre close to camera/player render-local.
- [ ] No Moon surface visible.
- [ ] No Earth planet atmosphere sphere incorrectly covering camera.
- [ ] Upper sky visibly blue.
- [ ] Warm horizon restricted.
- [ ] No beige object covering majority of viewport.


# 53. CAMERA ORIENTATION SANITY

- `nadir` expected sanity: dot(cameraForward, normalized(toBodyCentre)) > 0.95.
- `zenith` expected sanity: dot(cameraForward, normalized(toBodyCentre)) < -0.95.
- `oblique` expected sanity: dot around 0.5-0.9 depending design.
- `horizon` expected sanity: dot near tangent; do not claim nadir screenshot if not.


# 54. ASCENT/DESCENT SEQUENCE

### Step 01 — altitude 100 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 02 — altitude 1000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 03 — altitude 5000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 04 — altitude 10000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 05 — altitude 15000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 06 — altitude 20000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 07 — altitude 30000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 08 — altitude 60000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 09 — altitude 120000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 10 — altitude 236300 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 11 — altitude 400000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 12 — altitude 236300 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 13 — altitude 120000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 14 — altitude 60000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 15 — altitude 30000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 16 — altitude 20000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 17 — altitude 15000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 18 — altitude 10000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 19 — altitude 5000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 20 — altitude 1000 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.

### Step 21 — altitude 100 m
- [ ] Wait for authoritative state to settle.
- [ ] Record transition phase.
- [ ] Record local ground visibility.
- [ ] Record planet readiness.
- [ ] Record sky/cloud/star visibility.
- [ ] Ensure no representation hole.
- [ ] Capture screenshot for critical steps or telemetry for sampled steps.


# 55. WEATHER SEMANTIC MATRIX

### Weather `clear`
- Cloud expectation: clouds hidden.
- Visibility expectation: normal/high visibility.
- [ ] Test at 100 m.
- [ ] Test at 5 km.
- [ ] Test at 30 km.
- [ ] Test transition to planetaryView.

### Weather `cloudy`
- Cloud expectation: clouds visible.
- Visibility expectation: no precipitation requirement.
- [ ] Test at 100 m.
- [ ] Test at 5 km.
- [ ] Test at 30 km.
- [ ] Test transition to planetaryView.

### Weather `rain`
- Cloud expectation: clouds visible.
- Visibility expectation: rain/fog reduced visibility.
- [ ] Test at 100 m.
- [ ] Test at 5 km.
- [ ] Test at 30 km.
- [ ] Test transition to planetaryView.

### Weather `storm`
- Cloud expectation: dense clouds visible.
- Visibility expectation: storm effects allowed.
- [ ] Test at 100 m.
- [ ] Test at 5 km.
- [ ] Test at 30 km.
- [ ] Test transition to planetaryView.


# 56. TIME-OF-DAY SEMANTIC MATRIX

### Time `Morning`
- Expected: daylight; no ground stars; cool/warm low sun possible.
- [ ] 100 m screenshot.
- [ ] 5 km screenshot.
- [ ] 30 km state check.
- [ ] 120 km state check.

### Time `Noon`
- Expected: bright blue; no ground stars.
- [ ] 100 m screenshot.
- [ ] 5 km screenshot.
- [ ] 30 km state check.
- [ ] 120 km state check.

### Time `Golden Hour`
- Expected: blue upper sky + narrow warm horizon; no ground stars.
- [ ] 100 m screenshot.
- [ ] 5 km screenshot.
- [ ] 30 km state check.
- [ ] 120 km state check.

### Time `Night`
- Expected: dark sky; ground stars allowed.
- [ ] 100 m screenshot.
- [ ] 5 km screenshot.
- [ ] 30 km state check.
- [ ] 120 km state check.


# 57. VISUAL REGRESSION MATRIX — EXHAUSTIVE HIGH-RISK

### VR-0001 · alt=100m · band=ground · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0002 · alt=100m · band=ground · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0003 · alt=100m · band=ground · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0004 · alt=100m · band=ground · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0005 · alt=100m · band=ground · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0006 · alt=100m · band=ground · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0007 · alt=100m · band=ground · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0008 · alt=100m · band=ground · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0009 · alt=100m · band=ground · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0010 · alt=100m · band=ground · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0011 · alt=100m · band=ground · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0012 · alt=100m · band=ground · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0013 · alt=100m · band=ground · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0014 · alt=100m · band=ground · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0015 · alt=100m · band=ground · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0016 · alt=100m · band=ground · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0017 · alt=100m · band=ground · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0018 · alt=100m · band=ground · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0019 · alt=100m · band=ground · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0020 · alt=100m · band=ground · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0021 · alt=100m · band=ground · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0022 · alt=100m · band=ground · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0023 · alt=100m · band=ground · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0024 · alt=100m · band=ground · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0025 · alt=100m · band=ground · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0026 · alt=100m · band=ground · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0027 · alt=100m · band=ground · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0028 · alt=100m · band=ground · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0029 · alt=100m · band=ground · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0030 · alt=100m · band=ground · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0031 · alt=100m · band=ground · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0032 · alt=100m · band=ground · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0033 · alt=100m · band=ground · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0034 · alt=100m · band=ground · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0035 · alt=100m · band=ground · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0036 · alt=100m · band=ground · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0037 · alt=100m · band=ground · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0038 · alt=100m · band=ground · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0039 · alt=100m · band=ground · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0040 · alt=100m · band=ground · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0041 · alt=100m · band=ground · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0042 · alt=100m · band=ground · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0043 · alt=100m · band=ground · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0044 · alt=100m · band=ground · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0045 · alt=100m · band=ground · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0046 · alt=100m · band=ground · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0047 · alt=100m · band=ground · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0048 · alt=100m · band=ground · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0049 · alt=100m · band=ground · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0050 · alt=100m · band=ground · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0051 · alt=100m · band=ground · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0052 · alt=100m · band=ground · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0053 · alt=100m · band=ground · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0054 · alt=100m · band=ground · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0055 · alt=100m · band=ground · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0056 · alt=100m · band=ground · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0057 · alt=100m · band=ground · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0058 · alt=100m · band=ground · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0059 · alt=100m · band=ground · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0060 · alt=100m · band=ground · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0061 · alt=100m · band=ground · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0062 · alt=100m · band=ground · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0063 · alt=100m · band=ground · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0064 · alt=100m · band=ground · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0065 · alt=1000m · band=low · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0066 · alt=1000m · band=low · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0067 · alt=1000m · band=low · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0068 · alt=1000m · band=low · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0069 · alt=1000m · band=low · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0070 · alt=1000m · band=low · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0071 · alt=1000m · band=low · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0072 · alt=1000m · band=low · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0073 · alt=1000m · band=low · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0074 · alt=1000m · band=low · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0075 · alt=1000m · band=low · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0076 · alt=1000m · band=low · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0077 · alt=1000m · band=low · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0078 · alt=1000m · band=low · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0079 · alt=1000m · band=low · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0080 · alt=1000m · band=low · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0081 · alt=1000m · band=low · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0082 · alt=1000m · band=low · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0083 · alt=1000m · band=low · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0084 · alt=1000m · band=low · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0085 · alt=1000m · band=low · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0086 · alt=1000m · band=low · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0087 · alt=1000m · band=low · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0088 · alt=1000m · band=low · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0089 · alt=1000m · band=low · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0090 · alt=1000m · band=low · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0091 · alt=1000m · band=low · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0092 · alt=1000m · band=low · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0093 · alt=1000m · band=low · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0094 · alt=1000m · band=low · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0095 · alt=1000m · band=low · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0096 · alt=1000m · band=low · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0097 · alt=1000m · band=low · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0098 · alt=1000m · band=low · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0099 · alt=1000m · band=low · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0100 · alt=1000m · band=low · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0101 · alt=1000m · band=low · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0102 · alt=1000m · band=low · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0103 · alt=1000m · band=low · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0104 · alt=1000m · band=low · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0105 · alt=1000m · band=low · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0106 · alt=1000m · band=low · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0107 · alt=1000m · band=low · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0108 · alt=1000m · band=low · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0109 · alt=1000m · band=low · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0110 · alt=1000m · band=low · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0111 · alt=1000m · band=low · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0112 · alt=1000m · band=low · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0113 · alt=1000m · band=low · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0114 · alt=1000m · band=low · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0115 · alt=1000m · band=low · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0116 · alt=1000m · band=low · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0117 · alt=1000m · band=low · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0118 · alt=1000m · band=low · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0119 · alt=1000m · band=low · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0120 · alt=1000m · band=low · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0121 · alt=1000m · band=low · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0122 · alt=1000m · band=low · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0123 · alt=1000m · band=low · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0124 · alt=1000m · band=low · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0125 · alt=1000m · band=low · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0126 · alt=1000m · band=low · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0127 · alt=1000m · band=low · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0128 · alt=1000m · band=low · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0129 · alt=5000m · band=low · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0130 · alt=5000m · band=low · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0131 · alt=5000m · band=low · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0132 · alt=5000m · band=low · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0133 · alt=5000m · band=low · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0134 · alt=5000m · band=low · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0135 · alt=5000m · band=low · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0136 · alt=5000m · band=low · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0137 · alt=5000m · band=low · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0138 · alt=5000m · band=low · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0139 · alt=5000m · band=low · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0140 · alt=5000m · band=low · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0141 · alt=5000m · band=low · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0142 · alt=5000m · band=low · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0143 · alt=5000m · band=low · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0144 · alt=5000m · band=low · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0145 · alt=5000m · band=low · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0146 · alt=5000m · band=low · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0147 · alt=5000m · band=low · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0148 · alt=5000m · band=low · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0149 · alt=5000m · band=low · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0150 · alt=5000m · band=low · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0151 · alt=5000m · band=low · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0152 · alt=5000m · band=low · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0153 · alt=5000m · band=low · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0154 · alt=5000m · band=low · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0155 · alt=5000m · band=low · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0156 · alt=5000m · band=low · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0157 · alt=5000m · band=low · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0158 · alt=5000m · band=low · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0159 · alt=5000m · band=low · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0160 · alt=5000m · band=low · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0161 · alt=5000m · band=low · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0162 · alt=5000m · band=low · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0163 · alt=5000m · band=low · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0164 · alt=5000m · band=low · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: stars hidden + clouds hidden.

### VR-0165 · alt=5000m · band=low · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0166 · alt=5000m · band=low · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0167 · alt=5000m · band=low · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0168 · alt=5000m · band=low · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0169 · alt=5000m · band=low · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0170 · alt=5000m · band=low · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0171 · alt=5000m · band=low · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0172 · alt=5000m · band=low · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0173 · alt=5000m · band=low · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0174 · alt=5000m · band=low · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0175 · alt=5000m · band=low · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0176 · alt=5000m · band=low · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0177 · alt=5000m · band=low · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0178 · alt=5000m · band=low · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0179 · alt=5000m · band=low · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0180 · alt=5000m · band=low · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0181 · alt=5000m · band=low · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0182 · alt=5000m · band=low · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0183 · alt=5000m · band=low · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0184 · alt=5000m · band=low · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0185 · alt=5000m · band=low · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0186 · alt=5000m · band=low · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0187 · alt=5000m · band=low · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0188 · alt=5000m · band=low · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0189 · alt=5000m · band=low · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0190 · alt=5000m · band=low · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0191 · alt=5000m · band=low · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0192 · alt=5000m · band=low · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0193 · alt=10000m · band=transition · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0194 · alt=10000m · band=transition · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0195 · alt=10000m · band=transition · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0196 · alt=10000m · band=transition · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0197 · alt=10000m · band=transition · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0198 · alt=10000m · band=transition · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0199 · alt=10000m · band=transition · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0200 · alt=10000m · band=transition · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0201 · alt=10000m · band=transition · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0202 · alt=10000m · band=transition · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0203 · alt=10000m · band=transition · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0204 · alt=10000m · band=transition · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0205 · alt=10000m · band=transition · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0206 · alt=10000m · band=transition · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0207 · alt=10000m · band=transition · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0208 · alt=10000m · band=transition · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0209 · alt=10000m · band=transition · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0210 · alt=10000m · band=transition · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0211 · alt=10000m · band=transition · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0212 · alt=10000m · band=transition · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0213 · alt=10000m · band=transition · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0214 · alt=10000m · band=transition · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0215 · alt=10000m · band=transition · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0216 · alt=10000m · band=transition · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0217 · alt=10000m · band=transition · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0218 · alt=10000m · band=transition · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0219 · alt=10000m · band=transition · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0220 · alt=10000m · band=transition · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0221 · alt=10000m · band=transition · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0222 · alt=10000m · band=transition · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0223 · alt=10000m · band=transition · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0224 · alt=10000m · band=transition · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0225 · alt=10000m · band=transition · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0226 · alt=10000m · band=transition · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0227 · alt=10000m · band=transition · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0228 · alt=10000m · band=transition · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0229 · alt=10000m · band=transition · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0230 · alt=10000m · band=transition · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0231 · alt=10000m · band=transition · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0232 · alt=10000m · band=transition · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0233 · alt=10000m · band=transition · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0234 · alt=10000m · band=transition · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0235 · alt=10000m · band=transition · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0236 · alt=10000m · band=transition · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0237 · alt=10000m · band=transition · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0238 · alt=10000m · band=transition · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0239 · alt=10000m · band=transition · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0240 · alt=10000m · band=transition · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0241 · alt=10000m · band=transition · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0242 · alt=10000m · band=transition · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0243 · alt=10000m · band=transition · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0244 · alt=10000m · band=transition · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0245 · alt=10000m · band=transition · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0246 · alt=10000m · band=transition · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0247 · alt=10000m · band=transition · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0248 · alt=10000m · band=transition · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0249 · alt=10000m · band=transition · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0250 · alt=10000m · band=transition · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0251 · alt=10000m · band=transition · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0252 · alt=10000m · band=transition · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0253 · alt=10000m · band=transition · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0254 · alt=10000m · band=transition · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0255 · alt=10000m · band=transition · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0256 · alt=10000m · band=transition · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `not primary`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0257 · alt=15000m · band=transition · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0258 · alt=15000m · band=transition · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0259 · alt=15000m · band=transition · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0260 · alt=15000m · band=transition · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0261 · alt=15000m · band=transition · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0262 · alt=15000m · band=transition · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0263 · alt=15000m · band=transition · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0264 · alt=15000m · band=transition · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0265 · alt=15000m · band=transition · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0266 · alt=15000m · band=transition · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0267 · alt=15000m · band=transition · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0268 · alt=15000m · band=transition · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0269 · alt=15000m · band=transition · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0270 · alt=15000m · band=transition · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0271 · alt=15000m · band=transition · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0272 · alt=15000m · band=transition · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0273 · alt=15000m · band=transition · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0274 · alt=15000m · band=transition · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0275 · alt=15000m · band=transition · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0276 · alt=15000m · band=transition · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0277 · alt=15000m · band=transition · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0278 · alt=15000m · band=transition · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0279 · alt=15000m · band=transition · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0280 · alt=15000m · band=transition · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0281 · alt=15000m · band=transition · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0282 · alt=15000m · band=transition · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0283 · alt=15000m · band=transition · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0284 · alt=15000m · band=transition · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0285 · alt=15000m · band=transition · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0286 · alt=15000m · band=transition · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0287 · alt=15000m · band=transition · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0288 · alt=15000m · band=transition · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0289 · alt=15000m · band=transition · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0290 · alt=15000m · band=transition · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0291 · alt=15000m · band=transition · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0292 · alt=15000m · band=transition · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0293 · alt=15000m · band=transition · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0294 · alt=15000m · band=transition · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0295 · alt=15000m · band=transition · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0296 · alt=15000m · band=transition · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0297 · alt=15000m · band=transition · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0298 · alt=15000m · band=transition · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0299 · alt=15000m · band=transition · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0300 · alt=15000m · band=transition · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0301 · alt=15000m · band=transition · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0302 · alt=15000m · band=transition · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0303 · alt=15000m · band=transition · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0304 · alt=15000m · band=transition · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0305 · alt=15000m · band=transition · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0306 · alt=15000m · band=transition · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0307 · alt=15000m · band=transition · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0308 · alt=15000m · band=transition · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0309 · alt=15000m · band=transition · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0310 · alt=15000m · band=transition · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0311 · alt=15000m · band=transition · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0312 · alt=15000m · band=transition · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0313 · alt=15000m · band=transition · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0314 · alt=15000m · band=transition · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0315 · alt=15000m · band=transition · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0316 · alt=15000m · band=transition · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0317 · alt=15000m · band=transition · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0318 · alt=15000m · band=transition · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0319 · alt=15000m · band=transition · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0320 · alt=15000m · band=transition · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0321 · alt=20000m · band=transition · time=Morning · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0322 · alt=20000m · band=transition · time=Morning · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0323 · alt=20000m · band=transition · time=Morning · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0324 · alt=20000m · band=transition · time=Morning · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0325 · alt=20000m · band=transition · time=Morning · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0326 · alt=20000m · band=transition · time=Morning · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0327 · alt=20000m · band=transition · time=Morning · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0328 · alt=20000m · band=transition · time=Morning · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0329 · alt=20000m · band=transition · time=Morning · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0330 · alt=20000m · band=transition · time=Morning · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0331 · alt=20000m · band=transition · time=Morning · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0332 · alt=20000m · band=transition · time=Morning · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0333 · alt=20000m · band=transition · time=Morning · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0334 · alt=20000m · band=transition · time=Morning · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0335 · alt=20000m · band=transition · time=Morning · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0336 · alt=20000m · band=transition · time=Morning · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0337 · alt=20000m · band=transition · time=Noon · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0338 · alt=20000m · band=transition · time=Noon · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0339 · alt=20000m · band=transition · time=Noon · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0340 · alt=20000m · band=transition · time=Noon · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0341 · alt=20000m · band=transition · time=Noon · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0342 · alt=20000m · band=transition · time=Noon · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0343 · alt=20000m · band=transition · time=Noon · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0344 · alt=20000m · band=transition · time=Noon · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0345 · alt=20000m · band=transition · time=Noon · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0346 · alt=20000m · band=transition · time=Noon · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0347 · alt=20000m · band=transition · time=Noon · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0348 · alt=20000m · band=transition · time=Noon · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0349 · alt=20000m · band=transition · time=Noon · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0350 · alt=20000m · band=transition · time=Noon · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0351 · alt=20000m · band=transition · time=Noon · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0352 · alt=20000m · band=transition · time=Noon · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0353 · alt=20000m · band=transition · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0354 · alt=20000m · band=transition · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0355 · alt=20000m · band=transition · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0356 · alt=20000m · band=transition · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0357 · alt=20000m · band=transition · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0358 · alt=20000m · band=transition · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0359 · alt=20000m · band=transition · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0360 · alt=20000m · band=transition · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0361 · alt=20000m · band=transition · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0362 · alt=20000m · band=transition · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0363 · alt=20000m · band=transition · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0364 · alt=20000m · band=transition · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0365 · alt=20000m · band=transition · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0366 · alt=20000m · band=transition · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0367 · alt=20000m · band=transition · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0368 · alt=20000m · band=transition · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `forbidden`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0369 · alt=20000m · band=transition · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0370 · alt=20000m · band=transition · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0371 · alt=20000m · band=transition · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0372 · alt=20000m · band=transition · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0373 · alt=20000m · band=transition · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0374 · alt=20000m · band=transition · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0375 · alt=20000m · band=transition · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0376 · alt=20000m · band=transition · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0377 · alt=20000m · band=transition · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0378 · alt=20000m · band=transition · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0379 · alt=20000m · band=transition · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0380 · alt=20000m · band=transition · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0381 · alt=20000m · band=transition · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0382 · alt=20000m · band=transition · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0383 · alt=20000m · band=transition · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0384 · alt=20000m · band=transition · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `weather-dependent visible`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0385 · alt=30000m · band=upper · time=Morning · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0386 · alt=30000m · band=upper · time=Morning · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0387 · alt=30000m · band=upper · time=Morning · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0388 · alt=30000m · band=upper · time=Morning · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0389 · alt=30000m · band=upper · time=Morning · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0390 · alt=30000m · band=upper · time=Morning · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0391 · alt=30000m · band=upper · time=Morning · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0392 · alt=30000m · band=upper · time=Morning · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0393 · alt=30000m · band=upper · time=Morning · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0394 · alt=30000m · band=upper · time=Morning · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0395 · alt=30000m · band=upper · time=Morning · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0396 · alt=30000m · band=upper · time=Morning · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0397 · alt=30000m · band=upper · time=Morning · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0398 · alt=30000m · band=upper · time=Morning · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0399 · alt=30000m · band=upper · time=Morning · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0400 · alt=30000m · band=upper · time=Morning · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0401 · alt=30000m · band=upper · time=Noon · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0402 · alt=30000m · band=upper · time=Noon · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0403 · alt=30000m · band=upper · time=Noon · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0404 · alt=30000m · band=upper · time=Noon · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0405 · alt=30000m · band=upper · time=Noon · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0406 · alt=30000m · band=upper · time=Noon · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0407 · alt=30000m · band=upper · time=Noon · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0408 · alt=30000m · band=upper · time=Noon · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0409 · alt=30000m · band=upper · time=Noon · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0410 · alt=30000m · band=upper · time=Noon · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0411 · alt=30000m · band=upper · time=Noon · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0412 · alt=30000m · band=upper · time=Noon · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0413 · alt=30000m · band=upper · time=Noon · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0414 · alt=30000m · band=upper · time=Noon · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0415 · alt=30000m · band=upper · time=Noon · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0416 · alt=30000m · band=upper · time=Noon · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0417 · alt=30000m · band=upper · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0418 · alt=30000m · band=upper · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0419 · alt=30000m · band=upper · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0420 · alt=30000m · band=upper · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0421 · alt=30000m · band=upper · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0422 · alt=30000m · band=upper · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0423 · alt=30000m · band=upper · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0424 · alt=30000m · band=upper · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0425 · alt=30000m · band=upper · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0426 · alt=30000m · band=upper · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0427 · alt=30000m · band=upper · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0428 · alt=30000m · band=upper · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0429 · alt=30000m · band=upper · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0430 · alt=30000m · band=upper · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0431 · alt=30000m · band=upper · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0432 · alt=30000m · band=upper · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0433 · alt=30000m · band=upper · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0434 · alt=30000m · band=upper · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0435 · alt=30000m · band=upper · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0436 · alt=30000m · band=upper · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0437 · alt=30000m · band=upper · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0438 · alt=30000m · band=upper · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0439 · alt=30000m · band=upper · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0440 · alt=30000m · band=upper · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0441 · alt=30000m · band=upper · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0442 · alt=30000m · band=upper · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0443 · alt=30000m · band=upper · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0444 · alt=30000m · band=upper · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0445 · alt=30000m · band=upper · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0446 · alt=30000m · band=upper · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0447 · alt=30000m · band=upper · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0448 · alt=30000m · band=upper · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0449 · alt=60000m · band=space · time=Morning · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0450 · alt=60000m · band=space · time=Morning · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0451 · alt=60000m · band=space · time=Morning · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0452 · alt=60000m · band=space · time=Morning · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0453 · alt=60000m · band=space · time=Morning · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0454 · alt=60000m · band=space · time=Morning · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0455 · alt=60000m · band=space · time=Morning · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0456 · alt=60000m · band=space · time=Morning · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0457 · alt=60000m · band=space · time=Morning · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0458 · alt=60000m · band=space · time=Morning · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0459 · alt=60000m · band=space · time=Morning · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0460 · alt=60000m · band=space · time=Morning · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0461 · alt=60000m · band=space · time=Morning · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0462 · alt=60000m · band=space · time=Morning · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0463 · alt=60000m · band=space · time=Morning · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0464 · alt=60000m · band=space · time=Morning · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0465 · alt=60000m · band=space · time=Noon · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0466 · alt=60000m · band=space · time=Noon · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0467 · alt=60000m · band=space · time=Noon · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0468 · alt=60000m · band=space · time=Noon · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0469 · alt=60000m · band=space · time=Noon · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0470 · alt=60000m · band=space · time=Noon · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0471 · alt=60000m · band=space · time=Noon · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0472 · alt=60000m · band=space · time=Noon · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0473 · alt=60000m · band=space · time=Noon · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0474 · alt=60000m · band=space · time=Noon · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0475 · alt=60000m · band=space · time=Noon · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0476 · alt=60000m · band=space · time=Noon · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0477 · alt=60000m · band=space · time=Noon · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0478 · alt=60000m · band=space · time=Noon · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0479 · alt=60000m · band=space · time=Noon · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0480 · alt=60000m · band=space · time=Noon · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0481 · alt=60000m · band=space · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0482 · alt=60000m · band=space · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0483 · alt=60000m · band=space · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0484 · alt=60000m · band=space · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0485 · alt=60000m · band=space · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0486 · alt=60000m · band=space · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0487 · alt=60000m · band=space · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0488 · alt=60000m · band=space · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0489 · alt=60000m · band=space · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0490 · alt=60000m · band=space · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0491 · alt=60000m · band=space · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0492 · alt=60000m · band=space · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0493 · alt=60000m · band=space · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0494 · alt=60000m · band=space · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0495 · alt=60000m · band=space · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0496 · alt=60000m · band=space · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0497 · alt=60000m · band=space · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0498 · alt=60000m · band=space · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0499 · alt=60000m · band=space · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0500 · alt=60000m · band=space · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0501 · alt=60000m · band=space · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0502 · alt=60000m · band=space · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0503 · alt=60000m · band=space · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0504 · alt=60000m · band=space · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0505 · alt=60000m · band=space · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0506 · alt=60000m · band=space · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0507 · alt=60000m · band=space · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0508 · alt=60000m · band=space · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0509 · alt=60000m · band=space · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0510 · alt=60000m · band=space · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0511 · alt=60000m · band=space · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0512 · alt=60000m · band=space · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0513 · alt=120000m · band=orbit · time=Morning · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0514 · alt=120000m · band=orbit · time=Morning · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0515 · alt=120000m · band=orbit · time=Morning · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0516 · alt=120000m · band=orbit · time=Morning · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0517 · alt=120000m · band=orbit · time=Morning · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0518 · alt=120000m · band=orbit · time=Morning · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0519 · alt=120000m · band=orbit · time=Morning · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0520 · alt=120000m · band=orbit · time=Morning · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0521 · alt=120000m · band=orbit · time=Morning · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0522 · alt=120000m · band=orbit · time=Morning · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0523 · alt=120000m · band=orbit · time=Morning · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0524 · alt=120000m · band=orbit · time=Morning · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0525 · alt=120000m · band=orbit · time=Morning · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0526 · alt=120000m · band=orbit · time=Morning · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0527 · alt=120000m · band=orbit · time=Morning · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0528 · alt=120000m · band=orbit · time=Morning · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0529 · alt=120000m · band=orbit · time=Noon · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0530 · alt=120000m · band=orbit · time=Noon · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0531 · alt=120000m · band=orbit · time=Noon · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0532 · alt=120000m · band=orbit · time=Noon · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0533 · alt=120000m · band=orbit · time=Noon · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0534 · alt=120000m · band=orbit · time=Noon · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0535 · alt=120000m · band=orbit · time=Noon · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0536 · alt=120000m · band=orbit · time=Noon · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0537 · alt=120000m · band=orbit · time=Noon · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0538 · alt=120000m · band=orbit · time=Noon · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0539 · alt=120000m · band=orbit · time=Noon · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0540 · alt=120000m · band=orbit · time=Noon · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0541 · alt=120000m · band=orbit · time=Noon · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0542 · alt=120000m · band=orbit · time=Noon · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0543 · alt=120000m · band=orbit · time=Noon · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0544 · alt=120000m · band=orbit · time=Noon · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0545 · alt=120000m · band=orbit · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0546 · alt=120000m · band=orbit · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0547 · alt=120000m · band=orbit · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0548 · alt=120000m · band=orbit · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0549 · alt=120000m · band=orbit · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0550 · alt=120000m · band=orbit · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0551 · alt=120000m · band=orbit · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0552 · alt=120000m · band=orbit · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0553 · alt=120000m · band=orbit · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0554 · alt=120000m · band=orbit · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0555 · alt=120000m · band=orbit · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0556 · alt=120000m · band=orbit · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0557 · alt=120000m · band=orbit · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0558 · alt=120000m · band=orbit · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0559 · alt=120000m · band=orbit · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0560 · alt=120000m · band=orbit · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0561 · alt=120000m · band=orbit · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0562 · alt=120000m · band=orbit · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0563 · alt=120000m · band=orbit · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0564 · alt=120000m · band=orbit · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0565 · alt=120000m · band=orbit · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0566 · alt=120000m · band=orbit · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0567 · alt=120000m · band=orbit · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0568 · alt=120000m · band=orbit · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0569 · alt=120000m · band=orbit · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0570 · alt=120000m · band=orbit · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0571 · alt=120000m · band=orbit · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0572 · alt=120000m · band=orbit · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0573 · alt=120000m · band=orbit · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0574 · alt=120000m · band=orbit · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0575 · alt=120000m · band=orbit · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0576 · alt=120000m · band=orbit · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0577 · alt=236300m · band=reported · time=Morning · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0578 · alt=236300m · band=reported · time=Morning · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0579 · alt=236300m · band=reported · time=Morning · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0580 · alt=236300m · band=reported · time=Morning · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0581 · alt=236300m · band=reported · time=Morning · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0582 · alt=236300m · band=reported · time=Morning · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0583 · alt=236300m · band=reported · time=Morning · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0584 · alt=236300m · band=reported · time=Morning · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0585 · alt=236300m · band=reported · time=Morning · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0586 · alt=236300m · band=reported · time=Morning · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0587 · alt=236300m · band=reported · time=Morning · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0588 · alt=236300m · band=reported · time=Morning · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0589 · alt=236300m · band=reported · time=Morning · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0590 · alt=236300m · band=reported · time=Morning · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0591 · alt=236300m · band=reported · time=Morning · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0592 · alt=236300m · band=reported · time=Morning · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0593 · alt=236300m · band=reported · time=Noon · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0594 · alt=236300m · band=reported · time=Noon · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0595 · alt=236300m · band=reported · time=Noon · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0596 · alt=236300m · band=reported · time=Noon · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0597 · alt=236300m · band=reported · time=Noon · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0598 · alt=236300m · band=reported · time=Noon · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0599 · alt=236300m · band=reported · time=Noon · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0600 · alt=236300m · band=reported · time=Noon · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0601 · alt=236300m · band=reported · time=Noon · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0602 · alt=236300m · band=reported · time=Noon · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0603 · alt=236300m · band=reported · time=Noon · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0604 · alt=236300m · band=reported · time=Noon · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0605 · alt=236300m · band=reported · time=Noon · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0606 · alt=236300m · band=reported · time=Noon · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0607 · alt=236300m · band=reported · time=Noon · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0608 · alt=236300m · band=reported · time=Noon · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0609 · alt=236300m · band=reported · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0610 · alt=236300m · band=reported · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0611 · alt=236300m · band=reported · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0612 · alt=236300m · band=reported · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0613 · alt=236300m · band=reported · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0614 · alt=236300m · band=reported · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0615 · alt=236300m · band=reported · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0616 · alt=236300m · band=reported · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0617 · alt=236300m · band=reported · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0618 · alt=236300m · band=reported · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0619 · alt=236300m · band=reported · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0620 · alt=236300m · band=reported · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0621 · alt=236300m · band=reported · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0622 · alt=236300m · band=reported · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0623 · alt=236300m · band=reported · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0624 · alt=236300m · band=reported · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0625 · alt=236300m · band=reported · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0626 · alt=236300m · band=reported · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0627 · alt=236300m · band=reported · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0628 · alt=236300m · band=reported · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0629 · alt=236300m · band=reported · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0630 · alt=236300m · band=reported · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0631 · alt=236300m · band=reported · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0632 · alt=236300m · band=reported · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0633 · alt=236300m · band=reported · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0634 · alt=236300m · band=reported · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0635 · alt=236300m · band=reported · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0636 · alt=236300m · band=reported · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0637 · alt=236300m · band=reported · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0638 · alt=236300m · band=reported · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0639 · alt=236300m · band=reported · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0640 · alt=236300m · band=reported · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0641 · alt=400000m · band=orbit · time=Morning · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0642 · alt=400000m · band=orbit · time=Morning · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0643 · alt=400000m · band=orbit · time=Morning · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0644 · alt=400000m · band=orbit · time=Morning · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0645 · alt=400000m · band=orbit · time=Morning · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0646 · alt=400000m · band=orbit · time=Morning · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0647 · alt=400000m · band=orbit · time=Morning · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0648 · alt=400000m · band=orbit · time=Morning · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0649 · alt=400000m · band=orbit · time=Morning · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0650 · alt=400000m · band=orbit · time=Morning · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0651 · alt=400000m · band=orbit · time=Morning · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0652 · alt=400000m · band=orbit · time=Morning · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0653 · alt=400000m · band=orbit · time=Morning · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0654 · alt=400000m · band=orbit · time=Morning · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0655 · alt=400000m · band=orbit · time=Morning · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0656 · alt=400000m · band=orbit · time=Morning · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0657 · alt=400000m · band=orbit · time=Noon · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0658 · alt=400000m · band=orbit · time=Noon · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0659 · alt=400000m · band=orbit · time=Noon · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0660 · alt=400000m · band=orbit · time=Noon · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0661 · alt=400000m · band=orbit · time=Noon · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0662 · alt=400000m · band=orbit · time=Noon · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0663 · alt=400000m · band=orbit · time=Noon · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0664 · alt=400000m · band=orbit · time=Noon · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0665 · alt=400000m · band=orbit · time=Noon · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0666 · alt=400000m · band=orbit · time=Noon · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0667 · alt=400000m · band=orbit · time=Noon · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0668 · alt=400000m · band=orbit · time=Noon · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0669 · alt=400000m · band=orbit · time=Noon · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0670 · alt=400000m · band=orbit · time=Noon · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0671 · alt=400000m · band=orbit · time=Noon · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0672 · alt=400000m · band=orbit · time=Noon · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0673 · alt=400000m · band=orbit · time=Golden Hour · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0674 · alt=400000m · band=orbit · time=Golden Hour · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0675 · alt=400000m · band=orbit · time=Golden Hour · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0676 · alt=400000m · band=orbit · time=Golden Hour · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0677 · alt=400000m · band=orbit · time=Golden Hour · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0678 · alt=400000m · band=orbit · time=Golden Hour · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0679 · alt=400000m · band=orbit · time=Golden Hour · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0680 · alt=400000m · band=orbit · time=Golden Hour · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0681 · alt=400000m · band=orbit · time=Golden Hour · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0682 · alt=400000m · band=orbit · time=Golden Hour · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0683 · alt=400000m · band=orbit · time=Golden Hour · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0684 · alt=400000m · band=orbit · time=Golden Hour · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0685 · alt=400000m · band=orbit · time=Golden Hour · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0686 · alt=400000m · band=orbit · time=Golden Hour · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0687 · alt=400000m · band=orbit · time=Golden Hour · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0688 · alt=400000m · band=orbit · time=Golden Hour · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0689 · alt=400000m · band=orbit · time=Night · weather=clear · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0690 · alt=400000m · band=orbit · time=Night · weather=clear · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0691 · alt=400000m · band=orbit · time=Night · weather=clear · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0692 · alt=400000m · band=orbit · time=Night · weather=clear · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0693 · alt=400000m · band=orbit · time=Night · weather=cloudy · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0694 · alt=400000m · band=orbit · time=Night · weather=cloudy · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0695 · alt=400000m · band=orbit · time=Night · weather=cloudy · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0696 · alt=400000m · band=orbit · time=Night · weather=cloudy · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0697 · alt=400000m · band=orbit · time=Night · weather=rain · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0698 · alt=400000m · band=orbit · time=Night · weather=rain · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0699 · alt=400000m · band=orbit · time=Night · weather=rain · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0700 · alt=400000m · band=orbit · time=Night · weather=rain · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0701 · alt=400000m · band=orbit · time=Night · weather=storm · view=nadir
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0702 · alt=400000m · band=orbit · time=Night · weather=storm · view=horizon
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.

### VR-0703 · alt=400000m · band=orbit · time=Night · weather=storm · view=zenith
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `transition/prewarm`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] Validate continuity/no pop/no full-screen slab.

### VR-0704 · alt=400000m · band=orbit · time=Night · weather=storm · view=oblique
- Expected stars: `allowed`.
- Expected clouds: `hidden`.
- Expected Earth: `required visible`.
- [ ] Body/frame/altitude finite and authoritative.
- [ ] Camera orientation sanity verified.
- [ ] Camera layers verified.
- [ ] Earth readiness recorded.
- [ ] Sky/cloud/star flags recorded.
- [ ] CRITICAL: Earth cannot be replaced by empty star field.


# 58. SOURCE-OF-TRUTH TABLE TO MAINTAIN

- `Player local pose` -> PlayerController only in local domain.
- `Universe body/frame` -> UniverseRuntime/navigation/telemetry authoritative after validation.
- `Earth tile residency` -> GlobalStreamingScheduler + EarthProvider active set.
- `Earth handoff` -> EarthTransitionController.
- `Local sky` -> Atmosphere.
- `Stars/space background` -> SpaceLayer.
- `Planet depth/layers` -> RenderDomains + camera.
- `Weather clouds` -> Atmosphere weather visual policy.


# 59. ROOT CAUSE TEMPLATE

```markdown
## Symptom
## Exact reproduction
## Observed telemetry
## Direct cause
## Contributing causes
## Violated invariant
## Why previous tests passed
## Why this subsystem owns the fix
## Minimal change
## Regression tests
## Browser evidence
## Performance impact
## Remaining limitation
```


# 60. COMMIT REVIEW QUESTIONS

- [ ] What exact invariant does this commit restore?
- [ ] What exact failing test existed first?
- [ ] Did I create duplicate state?
- [ ] Did I add a magic timeout?
- [ ] Did I increase a budget instead of fixing ownership?
- [ ] Did I modify camera globals unnecessarily?
- [ ] Did I weaken any old assertion?
- [ ] Did I touch map/teleport/cosmic code without direct dependency?
- [ ] Did I add per-frame allocations?
- [ ] Did I preserve deterministic behavior?
- [ ] Did I test descent as well as ascent?
- [ ] Did I inspect the screenshot artifact?
- [ ] Can I explain why the fix belongs in this file?
- [ ] Would this still work if streaming were 10x slower?
- [ ] Would this still work in WebGL fallback?


# 61. STRICT STOP CONDITIONS

- STOP if: Earth still absent at 236.3 km nadir.
- STOP if: Earth appears only after arbitrary sleep.
- STOP if: Clear weather still shows cloud slab.
- STOP if: Daytime ground still shows stars.
- STOP if: Transition can reach localGround=false while planetReady=false.
- STOP if: Any new NaN/Infinity appears.
- STOP if: Browser console gets new errors.
- STOP if: Unit suite regresses.
- STOP if: Build regresses.
- STOP if: Visual screenshot looks wrong despite green tests.
- STOP if: Geometry count grows without bound over repeated ascent/descent.


# 62. FINAL EXECUTION ORDER

1. Confirm HEAD and diff if changed.
2. Reproduce Bug A at 236.3 km.
3. Add Earth telemetry.
4. Write failing readiness test.
5. Implement demand/view-aware Earth readiness.
6. Verify Bug A with screenshots.
7. Reproduce Bug B at ground clear Golden Hour.
8. Use debug cloud/star toggles to isolate contributors.
9. Fix clear cloud semantics.
10. Fix low-altitude daytime star gate.
11. Tune Golden Hour horizon band only after clouds/stars isolated.
12. Add ascent/descent browser coverage.
13. Run typecheck.
14. Run unit suite.
15. Run build.
16. Run browser test.
17. Inspect every critical screenshot.
18. Run profile.
19. Update truthful docs.
20. Stop. Do not continue roadmap automatically.


# 63. FINAL PROMPT INSTRUCTION

Você é o principal graphics/large-world engine engineer deste projeto.
Você NÃO está sendo avaliado por quantidade de features.
Você está sendo avaliado por precisão, invariantes, evidência e ausência de regressão.

Antes de editar, explique:
1. current HEAD;
2. reproduction plan;
3. telemetry plan;
4. first failing test;
5. files you expect to touch;
6. files you explicitly will not touch.

Depois execute em pequenos commits.

Não escreva `complete` antes de:
implementation + integration + test + build + browser verification + screenshot inspection.

Quando esta rodada terminar, PARE e reporte.
Não retome Universal Map, teleport, galaxy, black hole ou cosmology sem nova autorização.

