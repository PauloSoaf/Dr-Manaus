# Humanoide e destruição

- Personagem: altura de aproximadamente 2,07 m, rosto e mãos contornados, cotovelos e joelhos articulados. A pele cósmica continua compartilhada em um material; corpo e detalhes usam dois draws.
- Destruição: cidade real, chunks procedurais, árvores, landmarks, construções do Largo e aeroporto. IDs persistem entre níveis de detalhe; geometria agrupada é alterada sem criar um objeto por fragmento.
- Terreno: crateras com fundo visível e colisão correspondente, incluindo mira e teleporte. Reconstrução restaura terreno e estruturas próximas.
- Orçamento: até 256 crateras registradas / 32 próximas, raio máximo de 640 m, profundidade máxima de 180 m e uma malha de solo compartilhada. Os registros de crateras mais antigos são substituídos quando o limite é atingido. O impacto de voo deforma o solo no máximo uma vez a cada 120 ms. Escombros continuam em pools limitados.
- Validação: `npm test`, `npm run build`, `npm run test:browser`. Para testar com a GPU disponível, defina `DR_BROWSER_GPU=1`; o padrão do smoke test usa SwiftShader. Não há garantia de 60 FPS em toda configuração de hardware.

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
