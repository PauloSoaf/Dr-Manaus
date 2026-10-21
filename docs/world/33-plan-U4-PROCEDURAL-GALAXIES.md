# U4 Technical Architecture Plan — Procedural Galaxies & Scalable Cosmic Architecture

> **Documento de Arquitetura e Planejamento Técnico do Checkpoint U4**  
> **Status:** PLANEJAMENTO TÉCNICO COMPLETO (Implementação estritamente bloqueada aguardando aceite manual do P0.2)  
> **Baseline Auditado:** `b7f4fda0d5fb7b645fc179235fb2d5a9c01fa2b4` (Branch: `feat/universe-map`)  
> **Dependências:** U0 (Target Authority), U1 (Procedural Systems), U2 (Galaxy Runtime), U3 (Hypercruise), P0/P0.1/P0.2 (Planetary & Solar Polish)  
> **Escopo Bloqueado:** **BH0, BH1, BH2 (buracos negros relativísticos e lentes gravitacionais) e U5/U6 permanecem estritamente bloqueados.**

---

## 1. Visão Geral e Objetivos do U4

O checkpoint **U4** expande o universo observável do Dr-Manaus de um catálogo estático restrito (Via Láctea e Andrômeda como entidades isoladas de U2) para uma **rede contínua, infinita e determinística de galáxias procedurais**.

### Metas Fundamentais:
1. **Estrutura Galáctica Plausível:** Modelagem astrofisicamente coerente da Via Láctea e de galáxias arbitrárias (bulbo central esferoidal, barra galáctica, disco fino, disco espesso, braços espirais logarítmicos e halo estelar estendido).
2. **Escala sem Colapso de Desempenho:** Representação de dezenas a centenas de bilhões de estrelas por galáxia sem alocar objetos `THREE.Object3D` ou `THREE.Mesh` individuais por estrela na CPU.
3. **Determinismo Estrito por Coordenadas e Seeds:** Uma posição espacial universal gera sempre a mesma galáxia, a mesma densidade, os mesmos braços espirais e os mesmos sistemas estelares, sem consumo de disco proporcional à quantidade de galáxias geradas (Regra de Ouro: zero armazenamento estático de catálogos volumosos).
4. **Streaming Espacial Hierárquico e LOD Multiescala:** Transição contínua desde a visualização cosmológica distante (impostores volumétricos), passando pela aproximação galáctica (nuvem de pontos GPU e braços com poeira), navegação interestelar regional (setores de 100 anos-luz) até a entrada no sistema estelar ativo (materialização U1).
5. **Integração sem Ruptura:** Preservação estrita da autoridade única de alvo `UniversalNavigationTarget` (U0), do trânsito contínuo por hipercruzeiro (U3), do runtime de sistema local (U1), do globo 3D e rios continentais da Terra (P0.1/P0.2) e da destruição de impacto (D1).

---

## 2. Modelo Matemático da Estrutura Galáctica

Para que a Via Láctea e as galáxias procedurais possuam morfologia visual e densidade estelar verossímeis, adota-se um modelo de densidade tridimensional composto $\rho(r, \theta, z)$:

$$\rho_{\text{total}}(r, \theta, z) = \rho_{\text{bulge}}(r, z) + \rho_{\text{disk}}(r, z) \cdot \left[1 + \Delta_{\text{arms}}(r, \theta)\right] + \rho_{\text{halo}}(r, z)$$

### 2.1 Bulbo Central e Barra ($\rho_{\text{bulge}}$)
Modelado através do perfil elipsoidal de Hernquist / de Vaucouleurs truncado:

$$\rho_{\text{bulge}}(m) = \frac{M_b}{2\pi a b c} \frac{1}{m (1 + m)^3}, \quad \text{onde } m = \sqrt{\left(\frac{x'}{a}\right)^2 + \left(\frac{y'}{b}\right)^2 + \left(\frac{z'}{c}\right)^2}$$

- Para galáxias espirais barradas (como a Via Láctea, tipo SBbc), $a > b$, rotacionado por um ângulo de barra $\phi_{\text{bar}} \approx 27^\circ$ em relação ao eixo Sol–Centro Galáctico.
- Em galáxias elípticas (E0–E7), $a \approx b \ge c$, com perfil dominado puramente pelo componente esferoidal.

### 2.2 Disco Galáctico Fino e Espesso ($\rho_{\text{disk}}$)
O disco estelar segue uma dupla exponencial radial e vertical:

$$\rho_{\text{disk}}(r, z) = \rho_0 \cdot \exp\left(-\frac{r}{h_r}\right) \cdot \operatorname{sech}^2\left(\frac{z}{h_z}\right)$$

- **Escala radial ($h_r$):** $\approx 2.6 \text{ kpc}$ ($\approx 8.500 \text{ ly}$) para a Via Láctea.
- **Escala de altura ($h_z$):** Disco fino ($h_{z1} \approx 300 \text{ ly}$, 90% das estrelas jovens/G-M) e disco espesso ($h_{z2} \approx 1.000 \text{ ly}$, estrelas antigas/população II).

### 2.3 Braços Espirais Logarítmicos ($\Delta_{\text{arms}}$)
A modulação da densidade nos braços espirais é formulada por curvas logarítmicas periódicas com perturbação de densidade de onda de densidade de Lin-Shu:

$$r(\theta) = r_0 \cdot \exp(b \cdot (\theta - \theta_k))$$

$$\Delta_{\text{arms}}(r, \theta) = A_{\text{arm}} \cdot \sum_{k=1}^{N_{\text{arms}}} \cos\left(N_{\text{arms}} \left[ \theta - \frac{\ln(r/r_0)}{\tan(\psi)} - \theta_k \right]\right) \cdot \exp\left(-\frac{r}{R_{\text{arm\_max}}}\right)$$

- $N_{\text{arms}}$: Número de braços (ex: 4 para a Via Láctea: Norma/Outer, Scutum-Centaurus, Sagittarius-Carina, Perseus).
- $\psi$: Ângulo de abertura (pitch angle, tipicamente $11^\circ$ a $14^\circ$).
- $A_{\text{arm}}$: Amplitude do contraste de densidade estelar nos braços ($\approx 0.6$ a $1.2$).
- Esporão local (Orion Spur): modulação secundária local onde o Sistema Solar se encontra a $r \approx 26.000 \text{ ly}$.

### 2.4 Halo Estelar ($\rho_{\text{halo}}$)
Esferoide difuso com perfil potencial gravitacional de NFW / Plummer:

$$\rho_{\text{halo}}(R) = \rho_{h0} \cdot \left[1 + \left(\frac{R}{r_h}\right)^2\right]^{-1.75}, \quad R = \sqrt{r^2 + (z/q)^2}$$

---

## 3. Arquitetura de Renderização Escalável e LOD Multiescala

Instanciar 100 bilhões de estrelas como nós da cena Three.js provocaria colapso imediato de memória (> 8 TB de RAM) e estagnação da GPU. A solução arquitetural para U4 utiliza **computação procedural sob demanda e hierarquia de LOD de 5 níveis**:

```
+------------------------------------------------------------------------------------+
|                                LOD HIERARCHY                                       |
+------------------------------------------------------------------------------------+
| LOD 0: Cosmológico (> 10 Mpc)                                                      |
|   -> Impostores 2D, sprites pontuais integrados, textura de dispersão cromática     |
+------------------------------------------------------------------------------------+
| LOD 1: Campo Extragaláctico (100 kpc - 10 Mpc)                                     |
|   -> Volume Raymarching / Billboards de Fatias Acumuladas + Shader de Poeira        |
+------------------------------------------------------------------------------------+
| LOD 2: Regional Galáctico (1 kly - 100 kpc)                                        |
|   -> GPU Instanced Point Clouds com Buffer Atributos (Pos, Cor Espectral, Brilho)   |
+------------------------------------------------------------------------------------+
| LOD 3: Setores Estelares Locais (100 ly - 1 kly)                                   |
|   -> StarSector.ts com xorshift64 e FNV-1a (Estrelas Individuais Determinísticas)   |
+------------------------------------------------------------------------------------+
| LOD 4: Sistema Planetário Ativo (< 1 ly)                                           |
|   -> ProceduralSystemRuntime (U1) com Corpos Celestes, Órbitas e Malhas Físicas     |
+------------------------------------------------------------------------------------+
```

### 3.1 Nível 0: Cosmológico (> 10 Mpc)
- Galáxias distantes aparecem como pontos de magnitude visual aparente com base na lei do inverso do quadrado da distância:
  $$m_v = M_V + 5 \cdot (\log_{10}(d_{\text{pc}}) - 1)$$
- Impostor pré-rasterizado no `Canvas` da morfologia da galáxia (elíptica ou espiral) para galáxias do Grupo Local e aglomerados próximos.

### 3.2 Nível 1: Galáctico Distante (100 kpc a 10 Mpc)
- Utilização de `GalaxyMorphologyRenderer`:
  - A galáxia é desenhada em uma única draw call via shader customizado Three.js (`RawShaderMaterial`).
  - O shader calcula analiticamente na GPU a integral da linha de visada através da função de densidade $\rho_{\text{total}}(r, \theta, z)$.
  - Inclui absorção de poeira interestelar escura nos planos médios dos braços espirais (zonas de extinção e avermelhamento avermelhado).

### 3.3 Nível 2: Regional e Braços Espirais (1 kly a 100 kpc)
- Quando a câmera ou nave se aproxima de uma galáxia, ativa-se o `GalaxyPointCloudProvider`:
  - Buffer de vértices instanciado em GPU (`THREE.InstancedBufferGeometry` ou `THREE.Points`).
  - 10.000 a 200.000 partículas ativas (ajustável por qualidade).
  - Cada partícula representa um aglomerado estelar ou estrela massiva brilhante (classes O, B, Gigantes Vermelhas).
  - Atributos do vértice: `vec3 a_position`, `vec3 a_color` (Kelvin: 3.000K a 30.000K), `float a_size`, `float a_apparentMag`.

### 3.4 Nível 3: Setor Estelar Canônico (100 ly a 1 kly)
- Totalmente compatível com `StarSector.ts` (já existente no projeto):
  - Tamanho da célula: $100 \text{ ly} \times 100 \text{ ly} \times 100 \text{ ly}$.
  - Coordenadas `bigint` em `UniverseAddress`: `(sx, sy, sz)`.
  - Número de estrelas derivadas da densidade local $\rho_{\text{total}}(\mathbf{x})$.
  - As estrelas desse setor recebem identidades canônicas determinísticas `milky_way/sx,sy,sz/starIndex` ou `galaxy_XXXXX/sx,sy,sz/starIndex`.

### 3.5 Nível 4: Sistema Estelar Materializado (< 1 ly)
- Entrada no sistema estelar ativo:
  - O jogador seleciona ou aproxima-se de uma estrela do setor.
  - Handoff para `ProceduralSystemRuntime` (U1).
  - Geração determinística de planetas rochosos, gigantes gasosos, luas, anéis e efemérides orbitais.

---

## 4. Classificação Morfológica de Hubble e Geração Procedural

Cada galáxia do universo observável é indexada por uma coordenada de célula cosmológica tridimensional:
$$\mathbf{C}_{\text{cosmic}} = (C_x, C_y, C_z) \in \mathbb{Z}^3, \quad \text{Tamanho da Célula} = 2.0 \text{ Mpc}$$

### 4.1 Derivação Determinística da Seed
$$\text{galaxySeed} = \operatorname{FNV-1a}(\text{universeSeed} \oplus C_x \oplus C_y \oplus C_z \oplus \text{galaxyIndex})$$

A partir de `galaxySeed` e um gerador pseudo-aleatório `xorshift64`:
1. **Tipo Morfológico (Sequência de Hubble):**
   - **E0–E7 (Elípticas, ~20%):** Excentricidade $e = 1 - b/a \in [0.0, 0.7]$, sem disco, predomínio de estrelas frias avermelhadas.
   - **S0 (Lenticulares, ~15%):** Disco evidente sem braços espirais definidos.
   - **Sa / Sb / Sc (Espirais Regulares, ~35%):** Bulbo decrescente e braços progressivamente mais abertos com gás e formação estelar jovem (azulada).
   - **SBa / SBb / SBc (Espirais Barradas, ~20%):** Barra central proeminente orientada por ângulo aleatório.
   - **Irr I / Irr II (Irregulares, ~10%):** Distribuição assimétrica com múltiplos centros de densidade estelar.
2. **Propriedades Físicas Dimensionais:**
   - Raio Galáctico: $R_{\text{gal}} \in [8 \text{ kpc}, 60 \text{ kpc}]$.
   - População Estelar Total Estimada: $N_{\text{stars}} \in [10^9, 10^{12}]$.
   - Cor média integrada: derivada da taxa de formação estelar e do tipo morfológico.

---

## 5. Integração com Coordenadas Flutuantes e Trânsito Universal

### 5.1 Prevenção de Tremulação de Ponto Flutuante (Floating Origin)
Ao navegar entre galáxias a distâncias de dezenas a centenas de milhões de anos-luz ($1 \text{ Mly} \approx 9.46 \times 10^{21} \text{ m}$), a precisão de números de ponto flutuante IEEE-754 de 32 bits (`float` padrão em GPU) entra em colapso com erros de até centenas de metros se utilizássemos metros absolutos no motor gráfico.

- **Solução Arquitetural:**
  - A autoridade de posição cósmica em repouso utiliza `UniverseAddress` com `bigint` para setores e `float64` (`number`) para offsets locais.
  - O espaço de renderização Three.js (`RenderSpaceService.ts` e `FloatingOrigin3D.ts`) atua sempre centralizado na câmera local (`cameraRelativePos = worldPos - cameraOrigin`).
  - Cada galáxia renderiza suas partículas no referencial próprio da galáxia, multiplicado pela matriz de translação em relação à origem flutuante atual.

### 5.2 Hipercruzeiro U3 em Galáxias Procedurais
- O sistema de navegação e piloto automático `CosmicCruiseController` e `TravelDomain` de U3 já foi validado para viagens interplanetárias e intergalácticas.
- Em U4:
  - O alvo de navegação universal `UniversalNavigationTarget` (U0) aceita identificadores do tipo:
    - `targetType: 'galaxy'`, `galaxyId: 'milky_way'` | `'andromeda'` | `'galaxy_c12_45_88_0'`.
    - `targetType: 'star'`, `address: galaxy_XXXX/sx,sy,sz/starIdx`.
  - A viagem por hipercruzeiro interestelar e intergaláctico opera suavemente com aceleração contínua, cruzeiro assintótico e desaceleração até o setor de destino, disparando o handoff atômico validado em U3.

---

## 6. Preparação Arquitetural para Buracos Negros (BH0–BH2)

Conforme a diretriz estrita do projeto, **buracos negros funcionais continuam bloqueados para U4**. No entanto, a estrutura de dados de U4 deve acomodar a presença futura dos SMBHs (*Supermassive Black Holes*) centrais sem refatorações destrutivas:

```typescript
export interface GalaxyDescriptor {
  readonly id: string;
  readonly name: string;
  readonly morphology: HubbleMorphology;
  readonly radiusLy: number;
  readonly totalMassSolar: number;
  readonly seed: bigint;
  readonly coordinates: GalaxyCoordinates;
  
  // Slot arquitetural para BH0+ (apenas metadados e escala em U4; física e renderização bloqueadas)
  readonly centralBlackHole?: {
    readonly id: string;
    readonly massSolar: number; // Ex: 4.15e6 para Sgr A*, 1.4e8 para M31
    readonly schwarzschildRadiusM: number; // R_s = 2GM / c^2
  };
}
```

- A massa do buraco negro central nas galáxias procedurais segue a relação empírica de Magorrian:
  $$M_{\text{BH}} \approx 0.0014 \times M_{\text{bulge}}$$
- Em U4, o buraco negro central atua apenas como âncora posicional no centro do setor `(0, 0, 0)` da galáxia, sem física de horizonte, lentes gravitacionais ou saltos de trânsito (que pertencem a BH0, BH1 e BH2).

---

## 7. Orçamentos de Desempenho e Qualidade de Hardware

O sistema procedural galáctico de U4 deve rodar a **60 FPS estáveis** em hardwares modestos (incluindo GPUs integradas Intel Iris Xe e Apple Silicon base).

| Métrica de Desempenho | Perfil Baixo (Low) | Perfil Médio (Medium) | Perfil Alto (High) |
| :--- | :--- | :--- | :--- |
| **Partículas de Estrelas na GPU** | 10.000 | 50.000 | 200.000 |
| **Draw Calls Galácticas por Frame** | $\le 2$ | $\le 4$ | $\le 6$ |
| **Memória VRAM Adicional** | $< 12 \text{ MB}$ | $< 25 \text{ MB}$ | $< 45 \text{ MB}$ |
| **Tempo de Geração por Setor (CPU)** | $< 0.4 \text{ ms}$ | $< 0.8 \text{ ms}$ | $< 1.5 \text{ ms}$ |
| **Custo de Renderização por Frame** | $< 0.8 \text{ ms}$ | $< 1.6 \text{ ms}$ | $< 3.2 \text{ ms}$ |
| **Alocação de Heap por Frame** | 0 bytes (zero GC) | 0 bytes (zero GC) | 0 bytes (zero GC) |

---

## 8. Roteiro de Implementação em Sprints (Fases U4.1 a U4.4)

A execução do U4 será decomposta em 4 etapas estritas:

### Fase U4.1 — Modelo Matemático e Gerador Procedural Determinístico
- Implementar `ProceduralGalaxyGenerator.ts` em `src/world/galaxy/`.
- Equações de densidade analítica tridimensional (bulbo, disco, braços espirais logarítmicos e halo).
- Testes unitários com verificação de invariância de semente, determinismo de coordenadas e classificação de Hubble.

### Fase U4.2 — Shaders e Sistema de Partículas GPU
- Implementar `GalaxyPointCloudProvider.ts` e `GalaxyMorphologyRenderer.ts`.
- Buffer instanciado de partículas com paletas espectrais estelares coerentes (Hertzsprung-Russell).
- Shaders de poeira interestelar com extinção e absorção de luz.
- LOD0 a LOD2 funcionais e integrados.

### Fase U4.3 — Streaming Espacial e Navegação pelo Mapa Universal
- Integração de galáxias procedurais no `GlobalStreamingScheduler.ts`.
- Atualização do `UniversalMapRenderer.ts` para navegação recursiva (Cosmos $\rightarrow$ Galáxia $\rightarrow$ Setor $\rightarrow$ Sistema).
- Seleção e busca de alvos procedurais universais via `UniversalTargetResolver.ts`.

### Fase U4.4 — Integração de Trânsito Contínuo e Hardening
- Validação do hipercruzeiro U3 alcançando estrelas e setores de galáxias procedurais.
- Handoff para o runtime de sistema procedural U1 ao chegar no destino.
- Bateria completa de testes de regressão (manter 100% de aprovação nos 1.424 testes existentes).
- Validação em navegador com Playwright.

---

## 9. Invariantes Críticos e Diretrizes de Proteção

1. **Intocabilidade dos Checkpoints Anteriores:** Nenhuma linha de código referente à cidade de Manaus, à física WGS84 da Terra, aos rios continentais da Terra em órbita, ao pouso solar e fotosfera, ou às crateras destrutíveis D1 pode ser degradada ou alterada.
2. **Zero Dependência Externa Online:** Nenhuma consulta a APIs de galáxias externas via HTTP ou download em tempo de execução; geração 100% autônoma e offline.
3. **Bloqueio de Buracos Negros (BH0–BH2):** Nenhuma tentativa de implementar lentes gravitacionais, distorções relativísticas de espaço-tempo, interiores de buraco negro ou redes de trânsito estelar nesta etapa.
4. **Sem Alucinação de Testes Visuais:** Toda alegação de integridade visual deve ser respaldada por screenshots do Playwright ou por validação manual explícita do operador humano.
