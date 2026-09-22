# Humanoide e destruição

- Personagem: altura de aproximadamente 2,07 m, rosto e mãos contornados, cotovelos e joelhos articulados. A pele cósmica continua compartilhada em um material; corpo e detalhes usam dois draws.
- Destruição: cidade real, chunks procedurais, árvores, landmarks, construções do Largo e aeroporto. IDs persistem entre níveis de detalhe; geometria agrupada é alterada sem criar um objeto por fragmento.
- Terreno: crateras com fundo visível e colisão correspondente, incluindo mira e teleporte. Reconstrução restaura terreno e estruturas próximas. O terreno deformado não se auto-regenera ao continuar destruindo; a restauração só ocorre pelo poder do jogador.
- Orçamento e preservação: até 2.048 crateras registradas e 1.024 ativas simultâneas na vizinhança local (span de 512 m a 4.096 m), com raio máximo de 640 m e profundidade máxima de 180 m em malha única compartilhada. Se o orçamento global de 2.048 for atingido, a limpeza prioriza exclusivamente crateras remotas fora do campo de atuação do jogador.
- Validação: `npm test`, `npm run build`, `npm run test:browser`. Para testar com a GPU disponível, defina `DR_BROWSER_GPU=1`; o padrão do smoke test usa SwiftShader. Não há garantia de 60 FPS em toda configuração de hardware.

## Postura heroica e câmera de voo

- No pairar (hover), as mãos se encontram atrás da lombar com ombros alinhados (referência *Parade Rest*), mantendo o tronco ereto em qualquer ângulo de guinada sem inclinação parasita parado.
- Em alta velocidade (supersônico e mega mode), a câmera acompanha o deslocamento do jogador com rig estável baseado nos princípios de Spring Arm e Cinemachine, sem acúmulo de atraso espacial e mantendo o herói perfeitamente enquadrado.

## Supressão urbana e cidade real (zero prédios fantasmas)

- Em toda a malha urbana de Manaus abrangida pela cidade real, chunks procedurais recebem supressão imediata de malhas e colisores na criação (`visible = false`), eliminando o pop-in de construções fantasmas vazadas sobre avenidas e crateras.

## Floresta, trânsito e novos poderes

- Fora da área urbana, os chunks geram floresta densa em terra firme. Copas distantes usam um único draw, com até 6.400 instâncias; rios ficam livres.
- Carros recebem dano dos poderes e pisadas. Crateras fazem os veículos perderem apoio e caírem; destroços ficam até 25 segundos no pool existente.
- **L** liga/desliga o laser contínuo. A malha é reutilizada e o dano é limitado a dez atualizações por segundo; abrir o menu suspende o disparo.
- **G** alterna aproximadamente 2 m, 15 m, 46 m, 200 m, 500 m e 1 km. O contato dos pés destrói estruturas e árvores, atinge carros e deforma o solo, respeitando o orçamento de colapsos.
- Os núcleos claros do vídeo cósmico são suprimidos; somente as estrelas procedurais pequenas produzem pontos brancos.

## Correções de mira gigante e horizonte

- Os disparos saem da mão, à frente do corpo; o braço aponta para a mira. O traçado da câmera começa além do personagem e um segundo traçado da mão impede atravessar paredes.
- Laser e pulso escalam em largura, alcance e dano. A onda Q cresce com a altura e consulta os prédios carregados além do limite de colisores de movimento.
- Demolições excedentes entram numa fila limitada e terminam ao longo dos quadros, em vez de perder os alvos após os primeiros 16 colapsos.
- O horizonte usa até nove prédios pequenos por bloco, separados e com cinzas variados; as formas são calculadas uma vez e continuam no mesmo draw instanciado.

## Laser visível e crateras gigantes

- Laser contínuo com núcleo claro, halo pulsante, foco luminoso e anel animado no impacto. Os efeitos são reutilizados e somem ao desligar ou pausar.
- A malha de crateras amplia sua cobertura de 512 m até 4.096 m conforme os impactos gigantes, mantendo a mesma quantidade de vértices e a colisão correspondente.
- Exemplo: personagem de 200 m produz cratera de aproximadamente 147 m de diâmetro com o laser. Com 1 km, os pulsos podem abrir crateras com mais de 1 km de diâmetro.
