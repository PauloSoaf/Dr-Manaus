# Humanoide e destruição

- Personagem: altura de aproximadamente 2,07 m, rosto e mãos contornados, cotovelos e joelhos articulados. A pele cósmica continua compartilhada em um material; corpo e detalhes usam dois draws.
- Destruição: cidade real, chunks procedurais, árvores, landmarks, construções do Largo e aeroporto. IDs persistem entre níveis de detalhe; geometria agrupada é alterada sem criar um objeto por fragmento.
- Terreno: crateras com fundo visível e colisão correspondente, incluindo mira e teleporte. Reconstrução restaura terreno e estruturas próximas.
- Orçamento: até 256 crateras registradas / 32 próximas, raio máximo de 35 m, profundidade máxima de 20 m e uma malha de solo compartilhada. Os registros de crateras mais antigos são substituídos quando o limite é atingido. O impacto de voo deforma o solo no máximo uma vez a cada 120 ms. Escombros continuam em pools limitados.
- Validação: `npm test`, `npm run build`, `npm run test:browser`. Para testar com a GPU disponível, defina `DR_BROWSER_GPU=1`; o padrão do smoke test usa SwiftShader. Não há garantia de 60 FPS em toda configuração de hardware.
