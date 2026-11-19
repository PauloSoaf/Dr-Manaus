# 12. Áudio Espacial 3D e Síntese Sonora Procedural

## 1. Contexto no Dr-Manaus
O universo de Dr-Manaus abrange desde a selva úmida amazônica até o vácuo absoluto do espaço interestelar. Carregar centenas de megabytes de arquivos MP3/WAV externos sobrecarrega a rede e a memória do navegador. A solução adotada é a **Síntese Sonora Procedural 100% nativa via Web Audio API**:
- Ruído marrom contínuo filtrado para o vento e turbulência atmosférica.
- Síntese de reentrada hipersônica com ruído rosa modulado pela pressão dinâmica.
- Zumbido espaciotemporal de dobra (*warp hypercruise*) via osciladores senoidais harmônicos modulados pelo fator de dobra $c$.
- Infrasom ressonante triangular próximo a buracos negros e estrondos tectônicos de fissura planetária.
- Efeito Doppler e atenuação de volume atrelados à densidade atmosférica calculada exponencialmente ($e^{-h / 8500}$).

---

## 2. Repositórios GitHub de Referência
1. **[Tonejs/Tone.js](https://github.com/Tonejs/Tone.js)**
   - *Descrição:* O mais maduro framework de síntese de áudio interativo para o navegador sobre a Web Audio API. Fornece sintetizadores subtrativos, modulação FM/AM, compressores e efeitos de distorção.
   - *Aplicabilidade no Dr-Manaus:* Arquitetura para filtros em cascata e sintetizadores de ruído contínuo no `AudioManager.ts`.
2. **[hoch/WAAX](https://github.com/hoch/WAAX)**
   - *Descrição:* Coleção de blocos de processamento digital de sinais (DSP) em Web Audio para emulação analógica de filtros bi-quadrados, envelopes ADSR e espacialização binaural.
   - *Aplicabilidade no Dr-Manaus:* Síntese procedural de rugidos de titãs cósmicos e zumbido de escudos defletores.
3. **[goldfire/howler.js](https://github.com/goldfire/howler.js)**
   - *Descrição:* Biblioteca leve de áudio para web com suporte robusto a pooling de nós de áudio, desvanecimento de canais e espacialização 3D stereo panner.
   - *Aplicabilidade no Dr-Manaus:* Gerenciamento de ciclo de vida de nós de áudio com garbage collection zero.

---

## 3. Jogos de Referência de Design de Áudio
1. **[Elite Dangerous](https://www.elitedangerous.com/) (Frontier Developments)**
   - *Referência Técnica:* Vencedor de múltiplos prêmios de áudio: melhor representação acústica de espaçonaves da história dos videogames. Destaca-se a compressão dinâmica ao entrar em supercruise, distorção gravitacional perto de estrelas de nêutrons e silenciamento acústico em descompressão.
2. **[Returnal](https://housemarque.com/games/returnal) (Housemarque / Sony Interactive Entertainment)**
   - *Referência Técnica:* Áudio 3D binaural de última geração: localização espacial precisa de cada projétil extraterrestre e pistas sonoras instantâneas para teletransporte e recarga de energia.
3. **[Hellblade: Senua's Sacrifice](https://www.hellblade.com/) (Ninja Theory)**
   - *Referência Técnica:* Uso pioneiro de gravação e síntese binaural para criar vozes e ecos posicionados milimetricamente ao redor da cabeça do jogador com fones de ouvido.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[W3C Web Audio API Specification](https://www.w3.org/TR/webaudio/)**
   - Especificação técnica dos nós `AudioContext`, `BiquadFilterNode`, `PannerNode`, `GainNode` e `AudioBufferSourceNode`, detalhando como agendar alterações paramétricas precisas com `exponentialRampToValueAtTime`.
2. **[MDN Web Audio Spatialization Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics)**
   - Guia de implementação de espacialização 3D, cone de dispersão acústica e atenuação de distância usando `PannerNode` e `AudioListener`.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Mixagem Ambiental Unificada:** A classe `AudioManager.ts` já implementa barramentos separados para `hypersonicBus`, `warpBus` e `blackHoleBus`. A densidade atmosférica controla em tempo real o corte do filtro passa-baixas: no vácuo ($h > 100\text{ km}$), sons ambientes atmosféricos são cortados instantaneamente, preservando apenas as frequências que viajam pelo próprio traje do herói.
- **Sons de Impacto 100% Sintetizados:** Ruptura de planeta (`planet-crack`), buzinas (`car-horn`), gritos (`crowd-gasp`) e comunicação alienígena (`alien-comm`) são gerados puramente com osciladores e envelopes matemáticos sem demandar download de áudio.
