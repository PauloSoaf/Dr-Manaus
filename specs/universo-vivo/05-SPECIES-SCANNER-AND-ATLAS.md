# DR-MANAUS | VIVO-05: Scanner Cósmico de Espécies e Catálogo no Atlas

## 1. Objetivo
Implementar o scanner cósmico de espécies alienígenas (`CosmicSpeciesScanner`), permitindo ao Dr-Manaus apontar e analisar espécimes de flora e fauna, revelando taxonomia, dieta, temperamento e nível de perigo, com integração ao `SaveManager` e ao Atlas Cósmico.

## 2. Modelagem do Scanner
1. **Ray & Cone Aim Sampling**:
   - `scanAim(rayOrigin: Vector3, rayDirection: Vector3, maxRangeM = 60)`:
     - Realiza varredura cônica em direção aos alvos de fauna (`AlienFaunaManager.targets`) e focos de flora (`AlienFloraRenderer`).
     - Seleciona o espécime mais alinhado ao centro da mira angular ($< 15^\circ$) dentro do alcance.

2. **Geração de Perfil Taxonômico Determinístico**:
   - Para cada espécie de fauna ou flora, gera um registro taxonômico estruturado:
     - `speciesId`: e.g. `drm:species:${bodyId}:${morphology}`.
     - `commonName`: nome popular (ex: "Predador Bípede de Titã", "Dossel Esporífero de Eden").
     - `scientificName`: nomenclatura binomial determinística (ex: *Titanus rapax*, *Edena sporealis*).
     - `category`: `'fauna'` ou `'flora'`.
     - `diet`: `'herbivore'` | `'carnivore'` | `'omnivore'` | `'radiotrophic'` | `'chemotrophic'`.
     - `temperament`: `'passive'` | `'skittish'` | `'defensive'` | `'apex-aggressive'`.
     - `threatLevel`: escala de 1 a 5.
     - `description`: descrição biológica detalhada.

3. **Descoberta e Persistência**:
   - Se a espécie for escaneada pela primeira vez:
     - Retorna `isNewDiscovery: true`.
     - Registra em `saveManager.discoverSpecies(speciesId)`.
     - Dispara notificação no HUD: `"NOVA ESPÉCIE DESCOBERTA · [Nome Comum]"`.

