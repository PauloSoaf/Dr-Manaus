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
- **Validação Automatizada:** Novos testes `T_RIVER_MULTI_SEGMENT_NO_CROSS_CONNECTIONS` (em `tests/earth-orbital-rivers.test.ts`) e `T_PLANET_MAP_MULTI_SEGMENT_RIVERS_PRESERVED` (em `tests/earth-map-3d.test.ts`) validam que todos os afluentes são extraídos e que o comprimento de cada segmento respeita o teto físico de arco geodésico, sem saltos transcontinentais.

### P1.2 — Falha de Inicialização do WebGL com Fallback Funcional Garantido
- **Defeito Identificado na Auditoria:** O `PlanetMap3DRenderer` definia `mode = 'gpu-3d'` prematuramente ao obter o contexto, antes de confirmar a instanciação com sucesso do `WebGLRenderer`. Se o construtor falhasse (ex: perda de contexto, contexto incompleto em headless, ou exceção), a exceção era engolida em silêncio e o renderer ficava em estado quebrado, sem fallback funcional.
- **Solução Arquitetural:**
  - O construtor do `PlanetMap3DRenderer` agora só define `this.mode = 'gpu-3d'` e aloca cena, câmera e meshes após a criação bem-sucedida do `WebGLRenderer`.
  - Caso o contexto WebGL não exista ou a instanciação lance qualquer exceção, o renderer entra em `this.mode = '2d-fallback'`, define `this.renderer = null`, `this.scene = null`, e adquire com segurança o contexto 2D (`this.fallbackCtx = canvas.getContext('2d')`).
  - Implementado renderizador 2D completo e esteticamente polido no método `draw()` para o modo fallback: desenha o fundo espacial, o disco da Terra com antialiasing, amostragem continental precisa (`isLandAt`), projeção esférica dos rios com recorte de hemisfério traseiro, marcador dourado de Manaus, marcador do jogador e banner de diagnóstico (`MODO: 2D FALLBACK (WebGL indisponível)`).
- **Validação Automatizada:** Adicionados testes `T_PLANET_MAP_WEBGL_UNAVAILABLE_FALLBACK_2D` e `T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK` em `tests/earth-map-3d.test.ts`.

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
    - `T_PLANET_MAP_WEBGL_CONSTRUCTOR_THROW_FALLBACK`: valida fallback quando o construtor lança exceção.
    - `T_PLANET_MAP_MULTI_SEGMENT_RIVERS_PRESERVED`: valida preservação de múltiplos segmentos de rios.
    - `T_PLANET_MAP_RESIZE_HANDLING`: valida atualização do aspect ratio da câmera e redimensionamento do renderer.
    - `T_PLANET_MAP_FOCUS_COORDINATES_CONSISTENCY`: valida alinhamento do yaw/pitch com as coordenadas canônicas de Manaus.

### P2.3 — Teste End-to-End (E2E) do Fluxo Completo de Pouso e Decolagem Solar
- **Defeito Identificado na Auditoria:** Os testes existentes validavam partes isoladas (intenção de pouso estática ou `handoffTo('sun')` direto), mas não comprovavam que o acionamento real da tecla `KeyF` conduz o personagem por todo o fluxo integrado via controladores reais do jogo.
- **Solução Arquitetural:**
  - Atualizado `tests/helpers/celestial-impact.ts` para prover suporte real a consumo de teclas (`input.consume`), vinculação de física de superfície (`bindSurfacePhysics`), e avanço de loop (`gameStep`).
  - Criado o teste de integração E2E `T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE` em `tests/sun-approach.test.ts`:
    1. **Voo Interplanetário:** O jogador se aproxima do Sol em voo livre espacial (altitude 20.000 km, dentro do limite de captura de 30.000 km).
    2. **Comando Real do Usuário:** O input `KeyF` é registrado e consumido por `game.updateTravelDomain(dt)`.
    3. **Intenção Ativa:** `game.requestLanding()` valida o candidato e ativa `landingIntent` com alvo `'sun'` em fase `'capture'`.
    4. **Aproximação e Portão de Retorno:** A descida atinge altitude de captura $\le 7.000$ m, disparando a transição `returned` no `TravelDomain`.
    5. **Handoff e Superfície da Fotosfera:** `finishSurfaceReturn('sun')` e `bindSurfacePhysics()` executam a passagem de bastão real:
       - Referencial do jogador: `sun/local-enu`
       - Domínio de física: `sun`
       - Distrito: `FOTOSFERA`
       - Gravidade do jogador: `PHOTOSPHERE_GAMEPLAY_GRAVITY_MPS2` (9,80665 m/s², empuxo de gameplay)
       - Coordenadas de superfície finitas e sem colapso.
    6. **Movimentação Local:** O personagem caminha no plano da fotosfera (+100m Leste, +50m Sul), permanecendo no referencial local da estrela.
    7. **Decolagem e Retorno ao Espaço:** Subida vertical em alta velocidade (> 2.000 m/s, altitude > 7.000 m), disparando a transição `departed` e restaurando o domínio `interplanetary`.

---

## 2. Resultados das Validações e Gates de Qualidade

Todos os comandos foram executados localmente no ambiente real do repositório:

| Gate de Verificação | Comando | Resultado | Detalhes |
| :--- | :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` | **PASS (0 erros)** | TypeScript estrito sem emissão |
| **Testes de Regressão** | `npm run test:regression` | **PASS (635/635)** | Todos os 635 testes de regressão aprovados |
| **Fidelidade de Crateras** | `npm run check:impact-fidelity` | **PASS (24/24)** | 24 configurações medidas, erro de profundidade < 0.22m (tolerância: 4.0m) |
| **Suíte Completa de Testes** | `npm test` | **PASS (1.424/1.424)** | **1.424 testes executados, 1.424 aprovados, 0 falhas** |
| **Build de Produção** | `npm run build` | **PASS** | Bundle de produção gerado via Vite em 2.26s |

---

## 3. Arquivos Modificados no P0.2

1. [`src/world/planet/EarthRiverLayer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/EarthRiverLayer.ts):
   - Adicionada função canônica `getRiverLines` para extrair todos os segmentos e afluentes sem misturar cursos de água.
2. [`src/world/planet/EarthContinentalRiverRenderer.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/EarthContinentalRiverRenderer.ts):
   - Substituída interpolação linear por interpolação geodésica esférica SLERP (`subdivideGreatCircle`).
   - Renderização independente de todos os segmentos de rios no buffer `LineSegments`.
   - Ajuste de contraste e cores por tier orbital (LOD0: `#59d1ff`, LOD1: `#38bdf8`, LOD2: `#2eaee6`).
3. [`src/ui/map/PlanetMap3DRenderer.ts`](file:///c:/Projetos/Dr-Manaus/src/ui/map/PlanetMap3DRenderer.ts):
   - Inicialização estrita: `mode = 'gpu-3d'` somente após `WebGLRenderer` instanciado com sucesso.
   - Fallback 2D utilizável e robusto em caso de falha de contexto WebGL com diagnóstico visual.
   - Renderização de todos os segmentos independentes na textura equiretangular e nas linhas 3D.
4. [`tests/earth-map-3d.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/earth-map-3d.test.ts):
   - Adicionados testes para falhas de WebGL, fallback 2D, rios multisegmentados, resize de canvas e orientação canônica de Manaus.
5. [`tests/earth-orbital-rivers.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/earth-orbital-rivers.test.ts):
   - Adicionado teste `T_RIVER_MULTI_SEGMENT_NO_CROSS_CONNECTIONS` para verificar continuidade e ausência de ligações espúrias.
6. [`tests/helpers/celestial-impact.ts`](file:///c:/Projetos/Dr-Manaus/tests/helpers/celestial-impact.ts):
   - Atualizado `impactFixture` com consumo de teclas real, vinculações completas de física de superfície e método `gameStep`.
7. [`tests/sun-approach.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/sun-approach.test.ts):
   - Atualizado `T_SUN_EXPLICIT_F_LANDING_INTENT` para exercitar comando real `'KeyF'`.
   - Adicionado teste de integração completo `T_SUN_FULL_E2E_LANDING_AND_TAKEOFF_CYCLE`.

---

## 4. Estado de Bloqueio e Próximos Passos

- Conforme diretriz do projeto: **U4 (galáxias procedurais) e BH0–BH2 continuam estritamente bloqueados**.
- Nenhuma validação visual automatizada no navegador foi inventada; as avaliações no navegador permanecem sob prerrogativa exclusiva do operador humano.
- O checkpoint P0.2 está **concluído com sucesso**.
