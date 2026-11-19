# 18. UI/HUD Diegético, Responsivo e de Baixa Sobrecarga na Web

## 1. Contexto no Dr-Manaus
Interfaces de usuário (UI/HUD) em jogos de navegador representam uma fonte silenciosa de engasgos (*jank*): operações frequentes de leitura/escrita no DOM forçam recálculos de estilo e layout síncronos (*layout thrashing*). No Dr-Manaus, o HUD fornece uma quantidade maciça de telemetria em tempo real:
- Velocidade escalar (m/s e Mach), altitude sobre o elipsoide, nome do distrito urbano ou corpo celestial orbitado.
- Barra de vida e escudo do chefe em órbita profunda.
- Indicador de dobra e velocidade hiperluminal ($c$).
- Prompts contextuais e retículo de scanner taxonômico.
O HUD precisa atualizar a 60 Hz com custo de CPU inferior a 0.2 ms por quadro.

---

## 2. Repositórios GitHub de Referência
1. **[mrdoob/stats.js](https://github.com/mrdoob/stats.js)**
   - *Descrição:* O monitor de FPS e memória mais leve do ecossistema WebGL/Three.js. Utiliza nós DOM reutilizados estritamente e buffers pré-formatados sem recriação de tags.
   - *Aplicabilidade no Dr-Manaus:* Filosofia de atualização de elementos textuais in-place sem alocação de strings repetidas no painel de depuração F3.
2. **[pmndrs/leva](https://github.com/pmndrs/leva)**
   - *Descrição:* Biblioteca de painéis de controle e interface gráfica moderna para Three.js com reatividade limpa e isolamento de renderização de componentes.
   - *Aplicabilidade no Dr-Manaus:* Inspiração para os menus de pausa, seleção de poderes e ajustes gráficos de qualidade.

---

## 3. Jogos de Referência de Interface Diegética
1. **[Dead Space / Dead Space Remake](https://www.ea.com/games/dead-space)** (Motive Studio / EA)
   - *Referência Técnica:* A obra-prima da interface diegética na história dos videogames: a vida do protagonista é um indicador luminoso na coluna do traje, o inventário é uma projeção holográfica no espaço 3D e não há barras fixas 2D na tela, mantendo a imersão total.
2. **[Tom Clancy's The Division](https://www.ubisoft.com/en-gb/game/the-division)** (Massive Entertainment)
   - *Referência Técnica:* Interface holográfica de realidade aumentada (AR) projetada diretamente ao lado do ombro do agente, com linhas de guia traçadas no asfalto e mapas topográficos 3D projetados sobre o chão.
3. **[Cyberpunk 2077](https://www.cyberpunk.net/) (CD Projekt Red)**
   - *Referência Técnica:* HUD justificado como interface cibernética neural nos olhos de V, com efeitos visuais de distorção holográfica e minimapa integrado com GPS preditivo de trânsito.
4. **[Metroid Prime](https://www.nintendo.com/store/products/metroid-prime-remastered-switch/) (Retro Studios)**
   - *Referência Técnica:* HUD diegético projetado na curvatura interna do visor do capacete de Samus, com scanner taxonômico de espécies e anomalias que analisa o ambiente e preenche o banco de dados.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[Google Developers - Avoid Large, Complex Layouts and Layout Thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)**
   - Guia crucial de engenharia web explicando como separar leituras do DOM (`offsetWidth`, `getBoundingClientRect`) de escritas (`textContent`, `style.transform`) para evitar recalcular a árvore de renderização do navegador repetidamente no loop de animação.
2. **[MDN CSS Containment Specification](https://developer.mozilla.org/en-US/docs/Web/CSS/contain)**
   - Documentação da propriedade CSS `contain: strict` e `contain: content`, que isola os nós do HUD do restante do documento HTML, impedindo que animações de interface invalidem a tela do WebGPU canvas.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Isolamento de Layout com CSS `contain: layout style`:** A camada de interface do Dr-Manaus (`HUD.ts`) utiliza nós pré-criados e atualiza exclusivamente `textContent` e `style.transform` sem jamais injetar ou remover nós HTML dinâmicos durante o gameplay ativo.
- **Transição de Domínio Diegética:** O HUD alterna automaticamente entre o modo local urbano (Manaus), o modo orbital planetário (curvatura e satélites) e o modo interestelar (rotas de dobra e bússola cósmica), adaptando as dicas de controle na barra inferior conforme o contexto.
