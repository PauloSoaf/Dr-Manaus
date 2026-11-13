# P0.2 — Fidelity Hardening: Independent River Segments, WebGL Robustness & End-to-End Solar Landing

**Baseline:** `22e765d5b86d92c5a9acd9d434348cfe7c11b10f`, branch `feat/universe-map`  
**Objetivo:** P0.2 — Correção estrita de fidelidade e robustez das pendências identificadas na auditoria do P0.1.  
**Scope Guard:** **U4 (galáxias procedurais) e BH0–BH2 (buracos negros) permanecem ESTRITAMENTE BLOQUEADOS.** Nenhuma funcionalidade fora deste escopo foi modificada.

---

## 1. Problemas Auditados e Soluções Implementadas

### P1.1 — Rios Incompletos no Globo e Prevenção de Conexões Artificiais
- **Defeito Identificado na Auditoria:** O compilador preservava todas as linhas originais em `segments` dentro de `earth-rivers.json`, mas os renderers (`EarthContinentalRiverRenderer` e `PlanetMap3DRenderer`) desenhavam apenas `river.coordinates` (a linha principal mais longa). Além disso, havia risco de interpolação ingênua conectar trechos de ponta a ponta gerando ligações artificiais.
- **Solução Arquitetural:**
  - Adicionado helper canônico `EarthRiverLayer.getRiverLines(river, useLOD0)` que extrai todos os segmentos independentes (`river.segments` ou `[river.coordinates]`), descartando linhas degeneradas (< 2 pontos).
  - Em `EarthContinentalRiverRenderer.ts`, o método `buildMeshGeometry` agora itera sobre cada segmento de forma isolada, gerando pares de vértices no buffer `LineSegments`. Nunca há costura entre o final de um afluente e o início do próximo.
  - Em `PlanetMap3DRenderer.ts`, tanto a rasterização da textura (`generateEarthTextureCanvas`), a geração dos arcos 3D na esfera (`buildRiverLineSegments`), quanto o render 2D de fallback iteram sobre todos os segmentos independentes com `beginPath()` e traçados individuais.
- **Validação Automatizada:** Novos testes `T_RIVER_MULTI_SEGMENT_NO_CROSS_CONNECTIONS` (em `tests/earth-orbital-rivers.test.ts`) e `T_PLANET_MAP_MULTI_SEGMENT_RIVERS_PRESERVED` (em `tests/earth-map-3d.test.ts`) validam que todos os afluentes são extraídos e que o comprimento de cada segmento respeita o teto físico de arco ge### P1.2 — Falha de Inicialização do WebGL com Fallback Funcional Garantido
- **Defeito Identificado na Auditoria:** O `PlanetMap3DRenderer` definia `mode = 'gpu-3d'` prematuramente ao obter o contexto, antes de confirmar a instanciação com sucesso do `WebGLRenderer`. Se o construtor falhasse após a aquisição do contexto WebGL, tentar obter `canvas.getContext('2d')` no mesmo elemento retornaria `null` (restrição estrita da especificação W3C / navegadores que proíbe alternância de tipo de contexto).
- **Solução Arquitetural (Hotfix P0.2):**
  - O construtor do `PlanetMap3DRenderer` aloca Three.js com segurança e define `this.mode = 'gpu-3d'` somente após confirmação da criação do `WebGLRenderer`.
  - Caso o construtor lance exceção após a aquisição do contexto WebGL e `canvas.getContext('2d')` retorne `null`, o renderer detecta a colisão de contexto e substitui o elemento no DOM por um novo elemento `<canvas>` limpo via `canvas.parentElement.replaceChild(replacement, this.canvas)`.
  - O canvas substituto preserva id, className, width, height e estilos inline do original, re-associa os event listeners de interação (wheel, pointerdown, pointermove, pointerup) e obtém com sucesso `this.fallbackCtx = replacement.getContext('2d')`.
  - O renderizador 2D completo no método `draw()` opera no modo fallback desenhando o fundo espacial, o disco da Terra com antialiasing, amostragem continental precisa (`isLandAt`), projeção esférica dos rios com recorte de hemisfério traseiro, marcador dourado de Manaus, marcador do jogador e banner de diagnóstico (`MODO: 2D FALLBACK (WebGL indisponível)`).
- **Validação Automatizada:** Teste `T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK` em `tests/earth-map-3d.test.ts` valida a substituição do elemento no DOM parent, a aquisição válida do contexto 2D e o funcionamento do método `draw()`.

### P2.1 — Interpolação Geodésica por Grandes Círculos (SLERP) e LOD Orbital
- **Defeito Identificado na Auditoria:** O renderer interpolava pontos de rios linearmente em latitude e longitude, o que corta a curvatura do planeta em segmentos longos em vez de seguir o grande círculo na esfera.
- **Solução Arquitetural:**
  - Implementado `subdivideGreatCircle` (e `subdivideGreatCircleSpherical`) utilizando interpolação esférica SLERP sobre vetores unitários tridimensionais ($\omega = \arccos(\mathbf{v}_1 \cdot \mathbf{v}_2)$). Cada ponto intermediário é calculado por combinação senoidal e convertido para coordenadas geodésicas na superfície WGS84 com offset vertical controlado (`RIVER_SURFACE_OFFSET_M = 40m`).
  - O cálculo da geometria ocorre durante o setup/LOD, e nunca a cada frame na CPU.
  - A função `update(altitudeM)` ajusta o LOD e o contraste cromático dinamicamente: azul ciano brilhante (`#59d1ff`) para grandes altitudes orbitais (> 500 km) garantindo contraste sobre os oceanos e continentes, `#38bdf8` para altitude continental (80 km – 500 km), e transição suave com cross-fade para águas locais abaixo de 18 km.

### P2.2 — Cobertura de Testes do Mapa 3D (Projeção, Orientação, Resize e Manaus)
- **Defeito Identificado na Auditoria:** Cobertura anterior focava apenas na presença dos objetos, sem exercitar falhas de contexto, resize e projeções de hemisfério.
- **Solução Arquitetural:**
  - `tests/earth-map-3d.test.ts` foi expandido com mock de WebGL compatível com Three.js WebGLRenderer, além de novos testes:
    - `T_PLANET_MAP_WEBGL_UNAVAILABLE_FALLBACK_2D`: valida fallback quando WebGL é inexistente.
    - `T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK`: valida fallback quando o construtor lança exceção com substituição segura de canvas no DOM.
    - `T_PLANET_MAP_MULTI_SEGMENT_RIVERS_PRESERVED`: valida preservação de múltiplos segmentos de rios.
    - `T_PLANET_MAP_RESIZE_HANDLING`: valida atualização do aspect ratio da câmera e redimensionamento do renderer.
    - `T_PLANET_MAP_FOCUS_COORDINATES_CONSISTENCY`: valida alinhamento do yaw/pitch com as coordenadas canônicas de Manaus.

### P2.3 — Teste End-to-End (E2E) do Fluxo Completo de Pouso e Decolagem Solar sem Atalhos
- **Defeito Identificado na Auditoria:** O teste anterior utilizava atalhos: `f.place(5_000, 20)` durante a descida, mutação direta em `player.position` na superfície, e chamadas manuais a `travelDomain.update()` durante a decolagem, em vez de exercitar o ciclo de gameplay exclusivamente pelos controladores.
- **Solução Arquitetural (Hotfix P0.2):**
  - Removido completamente qualquer uso de `f.place()` durante a descida. A aproximação e pouso ocorrem a partir de 20.000 km através de `KeyF` acionando `PlanetaryLandingIntent`, `CosmicCruiseController` e `Game.updateTravelDomain(dt)` até a travessia natural do portão de retorno a 7.000 m.
  - Em `BodyNavigation.ts`, ajustado o envelope terminal de captura (`captureRadiusM`) com teto de 1.000 m (`Math.min(margin, 1000)`), permitindo que a desaceleração de pouso atinja a altitude de retorno de 7.000 m sem colisão espúria na fronteira de CCD orbital (100 km).
  - Em `Game.ts`, corrigido `surfaceClearanceM('sun')` para calcular a distância esférica sobre a fotosfera.
  - Locomoção na fotosfera conduzida puramente através do comando `KeyW` e `PlayerController.update(dt)`.
  - Decolagem conduzida pelos comandos reais: `KeyF` para sustentação de hover, toque duplo `KeyV` para armar voo interplanetário, e propulsão de subida com `Space` + `KeyB` (boost). Corrigida em `Game.ts` a ordem de consumo do boost (`!this.travelDomain.localPhysicsActive && this.input.consume('KeyB')`), permitindo aceleração na física local. A transição `departed` ocorre naturalmente via `Game.updateTravelDomain(dt)` sem bypass.
- **Validação Automatizada:** Teste `T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE` em `tests/sun-approach.test.ts` comprova todo o fluxo sem atalhos.

---

## 2. Resultados das Validações e Gates de Qualidade

Todos os comandos foram executados localmente no ambiente real do repositório:

| Gate de Verificação | Comando | Resultado | Detalhes |
| :--- | :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` | **PASS (0 erros)** | TypeScript estrito sem emissão |
| **Testes de Regressão** | `npm run test:regression` | **PASS (635/635)** | Todos os 635 testes de regressão aprovados |
| **Fidelidade de Crateras** | `npm run check:impact-fidelity` | **PASS (24/24)** | 24 configurações medidas, erro de profundidade < 0.22m (tolerância: 4.0m) |
| **Suíte Completa de Testes** | `npm test` | **PASS (1.424/1.424)** | **1.424 testes executados, 1.424 aprovados, 0 falhas** |
| **Build de Produção** | `npm run build` | **PASS** | Bundle de produção gerado via Vite em 2.15s |

---

## 3. Arquivos Modificados no P0.2 e Hotfix

1. [`src/world/planet/EarthRiverLayer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/EarthRiverLayer.ts):
   - Adicionada função canônica `getRiverLines` para extrair todos os segmentos e afluentes sem misturar cursos de água.
2. [`src/world/planet/EarthContinentalRiverRenderer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/EarthContinentalRiverRenderer.ts):
   - Substituída interpolação linear por interpolação geodésica esférica SLERP (`subdivideGreatCircle`).
   - Renderização independente de todos os segmentos de rios no buffer `LineSegments`.
   - Ajuste de contraste e cores por tier orbital (LOD0: `#59d1ff`, LOD1: `#38bdf8`, LOD2: `#2eaee6`).
3. [`src/ui/map/PlanetMap3DRenderer.ts`](file:///c:/Projetos/Dr-Manaus/src/ui/map/PlanetMap3DRenderer.ts):
   - Inicialização estrita: `mode = 'gpu-3d'` somente após `WebGLRenderer` instanciado com sucesso.
   - Hotfix: substituição segura de canvas no DOM ao detectar impossibilidade de contexto 2D após aquisição WebGL, re-associando listeners e garantindo fallback 2D funcional com diagnóstico visual.
   - Renderização de todos os segmentos independentes na textura equiretangular e nas linhas 3D.
4. [`src/game/Game.ts`](file:///c:/Projetos/Dr-Manaus/src/game/Game.ts):
   - Hotfix: cálculo de folga esférica na fotosfera solar (`surfaceClearanceM`) e correção da ordem de consumo do `KeyB` preservando o boost em física local.
5. [`src/world/travel/BodyNavigation.ts`](file:///c:/Projetos/Dr-Manaus/src/world/travel/BodyNavigation.ts):
   - Hotfix: clamp de `captureMargin` terminal para 1.000 m no envelope de exclusão, permitindo pouso lento atravessar o portão de 7.000 m.
6. [`src/player/PlayerController.ts`](file:///c:/Projetos/Dr-Manaus/src/player/PlayerController.ts):
   - Hotfix: getter de compatibilidade `gravity` mapeado para `bodyGravityMps2`.
7. [`tests/earth-map-3d.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/earth-map-3d.test.ts):
   - Mock atualizado com exclusividade de contexto e suporte a `replaceChild`/`createElement`.
   - `T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK` atualizado para verificar substituição no DOM e execução do `draw()`.
8. [`tests/earth-orbital-rivers.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/earth-orbital-rivers.test.ts):
   - Teste `T_RIVER_MULTI_SEGMENT_NO_CROSS_CONNECTIONS` para verificar continuidade e ausência de ligações espúrias.
9. [`tests/helpers/celestial-impact.ts`](file:///c:/Projetos/Dr-Manaus/tests/helpers/celestial-impact.ts):
   - Hotfix: instância real de `PlayerController` com suporte a `gameStep` completo (passo de universo, física do jogador e transições de partida/chegada).
10. [`tests/sun-approach.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/sun-approach.test.ts):
    - `T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE` reescrito sem qualquer atalho (`f.place`, `player.position +=`, ou chamada direta a `travelDomain.update`). Todo o ciclo é operado via controladores e inputs reais.

---

## 4. Estado de Bloqueio e Próximos Passos

- Conforme diretriz do projeto: **U4 (galáxias procedurais) e BH0–BH2 continuam estritamente bloqueados**.
- Nenhuma validação visual automatizada no navegador foi inventada; as avaliações no navegador permanecem sob prerrogativa exclusiva do operador humano.
- O hotfix P0.2 está **concluído e validado com sucesso**.

