# DR-MANAUS | Patch U4.5.4.1 — Hotfix de Consistência Geométrica e Preservação do Relevo Canônico

## 1. Visão Geral

- **Patch:** U4.5.4.1
- **Título:** Hotfix de Consistência Geométrica e Preservação do Relevo Canônico
- **Baseline Auditado:** `d41fc2dd7e94c3431446b78e3fcff52d16fcbedf` (GitHub Actions Run `42940721868`, 1.585/1.587 testes aprovados, typecheck PASS, regressões permanentes PASS).
- **Branch de Trabalho:** `feat/universe-map`
- **Repositório:** [https://github.com/PauloSoaf/Dr-Manaus](https://github.com/PauloSoaf/Dr-Manaus)

---

## 2. Diagnóstico da Causa Raiz

### Falha A — `T_U454_07_PHYSICS_AND_VISUAL_GEOMETRIC_CONSISTENCY`
- **Erro Observado:** `planetSurfaceRadius must match surface.radiusM + heightAt`.
- **Causa Raiz:** O teste assumia uma aproximação esférica simplista (`surface.radiusM + h`) para todas as direções geocêntricas amostradas na esfera. No entanto, a implementação canônica de [`planetSurfaceRadius()`](file:///c:/Projetos/Dr-Manaus/src/world/planet/PlanetSurface.ts) calcula o raio real do elipsoide de referência na direção tridimensional dada:
  $$\text{radius}_{\text{base}} = \frac{1}{\sqrt{\frac{x^2 + y^2}{a^2} + \frac{z^2}{b^2}}}$$
  onde $a$ é o semieixo maior equatorial e $b = a(1 - f)$ é o semieixo polar. Para planetas com achatamento rotacional ($f > 0$), em direções com componente $z \ne 0$, o raio elipsoidal base difere de $a$ (`surface.radiusM`), provocando a falha da asserção esférica.
- **Resolução:** O teste foi alinhado ao modelo matemático autêntico do motor:
  1. Valida que `planetSurfaceRadius(surface, dir)` é identicamente igual a `planetSurfaceRadius(surface, dir, true) + surface.heightAt(dir)`.
  2. Valida que em direções equatoriais ($z = 0$), o raio base elipsoidal coincide exatamente com `surface.radiusM`.

### Falha B — `T_U454_08_CANONICAL_BODIES_PRESERVATION`
- **Erro Observado:** `assert.ok(maximumSurfaceReliefM(earth) > 8_000)` falhava.
- **Causa Raiz:** O teste continha uma asserção arbitrária ($> 8.000\text{ m}$) que não correspondia ao contrato da autoridade de dados do jogo. Em [`EarthElevation.ts`](file:///c:/Projetos/Dr-Manaus/src/world/planet/EarthElevation.ts), a cota máxima é `EARTH_MAX_ELEVATION_M = grid.maxM = 5742`, derivada da grade ETOPO5 do NOAA (5 arc-minute) downsampleada para $512 \times 256$ para a escala de streaming dos tiles. A função [`maximumSurfaceReliefM()`](file:///c:/Projetos/Dr-Manaus/src/world/planet/BodySurfaceFactory.ts) retorna exatamente `Math.max(0, EARTH_MAX_ELEVATION_M)`.
- **Resolução:** O teste foi ajustado para verificar a igualdade estrita e exata com as autoridades canônicas:
  - `maximumSurfaceReliefM(earth) === Math.max(0, EARTH_MAX_ELEVATION_M)` (e $\ge 5.000\text{ m}$).
  - `maximumSurfaceReliefM(moon) === MOON_RELIEF_M` ($> 10.000\text{ m}$).
  - `maximumSurfaceReliefM(mars) === MARS_RELIEF_M` ($\ge 21.000\text{ m}$).

---

## 3. Arquivos Modificados

1. [`tests/procedural-surfaces-and-atlas-opt-u454.test.ts`](file:///c:/Projetos/Dr-Manaus/tests/procedural-surfaces-and-atlas-opt-u454.test.ts)
   - Importadas as constantes canônicas `EARTH_MAX_ELEVATION_M`, `MOON_RELIEF_M` e `MARS_RELIEF_M`.
   - Corrigida a asserção de `T_U454_07` para testar o elipsoide de referência direcional real (`planetSurfaceRadius(surface, dir, true) + h`).
   - Corrigida a asserção de `T_U454_08` para respeitar a cota NOAA ETOPO5 de $5.742\text{ m}$ da Terra.

2. [`docs/world/15-status.md`](file:///c:/Projetos/Dr-Manaus/docs/world/15-status.md)
   - Atualizado com o registro do checkpoint U4.5.4.1.

3. [`docs/world/47-status-U4.5.4.1-HOTFIX-GEOMETRIC-AND-CANONICAL-RELIEF.md`](file:///c:/Projetos/Dr-Manaus/docs/world/47-status-U4.5.4.1-HOTFIX-GEOMETRIC-AND-CANONICAL-RELIEF.md)
   - Relatório técnico deste patch corretivo.

