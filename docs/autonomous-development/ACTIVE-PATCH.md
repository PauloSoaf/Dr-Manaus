# DR-MANAUS | Active Patch Tracker

- **Patch:** `TRANS-01` — Transição Contínua de Altitude da Terra, Eliminação de Chão Preto e Desvanecimento Atmosférico (`specs/dr-manaus-cosmic-night-specs/04-EARTH-ALTITUDE-TRANSITION.md`)
- **Status:** IMPLEMENTED & VALIDATED LOCALLY (1.773/1.773 testes gerais, 638/638 regressões permanentes, 0 erros TypeScript, build Vite aprovado)
- **Branch:** `feat/universe-map`
- **SHA:** A ser gerado no commit
- **Atualizado:** 2026-11-13T12:32:00-04:00

## Mudanças do Patch

### 1. `src/world/providers/EarthTransitionController.ts`:
- Refinamento das 4 bandas contínuas de altitude:
  - `0 - 8 km`: Representação local 1.0, planeta 0.0, domínio local, atmosfera 1.0.
  - `8 - 15 km`: Crossfade suave entre superfície local e globo planetário (`OVERLAP_SAFE`). No ponto médio (11,5 km), o domínio de apresentação transiciona para `planetary`.
  - `15 - 60 km`: Domínio planetário dominante (`PLANET_DOMINANT`), representação local desanexada com segurança.
  - `60 km+`: Domínio orbital (`PLANET_ONLY`), globo 1.0.
  - `100 km`: Linha de Kármán — atenuação atmosférica atinge o vácuo espacial absoluto ($0.0$).
- Garantia formal de invariante: `localWeight + planetWeight >= 0.99` em qualquer altitude de 0m a 400.000m, eliminando lacunas de representação e o "chão preto" transitório.
- Reforço do portão de prontidão (`targetCoverageReady`): a representação local nunca é desativada antes que a cobertura planetária/regional confirme readiness, garantindo transição contínua sem depender de frames vazios.
- Histerese estável de propriedade da superfície (`groundOwner`): transição para `planet` aos 15 km e retorno para `local` aos 13 km, eliminando qualquer oscilação em vôo nivelado.

### 2. `tests/earth-altitude-transition.test.ts` (7 Novos Testes):
- `T_EARTH_TRANS_01_LOCAL_BAND_0_TO_8KM`: Condições de solo e baixa altitude mantendo exclusivamente a malha local.
- `T_EARTH_TRANS_02_CROSSFADE_BAND_8_TO_15KM`: Crossfade de pesos complementares sem gap em 11,5 km.
- `T_EARTH_TRANS_03_PLANETARY_DOMINANT_15_TO_60KM`: Predomínio do globo com atenuação atmosférica gradual.
- `T_EARTH_TRANS_04_ORBITAL_BAND_ABOVE_60KM`: Domínio orbital e transição para vácuo no Kármán line.
- `T_EARTH_TRANS_05_NO_BLACK_GROUND_INVARIANT`: Varredura em 22 amostras de altitude (0 a 400 km) comprovando cobertura ininterrupta.
- `T_EARTH_TRANS_06_READINESS_GATE_PRESERVES_FALLBACK`: Retenção do fallback local quando tiles planetários ainda não estão prontos.
- `T_EARTH_TRANS_07_GROUND_OWNER_HYSTERESIS`: Prevenção de oscilação rápida de renderizador na faixa 13-15 km.
