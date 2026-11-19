# 20. Persistência de Estado Cósmico e Serialização Binária Compacta

## 1. Contexto no Dr-Manaus
Em um universo dinâmico onde o jogador pode demolir quarteirões em Manaus, salvar colônias alienígenas, catalogar espécimes biológicos com o scanner, enfraquecer o escudo do Leviatã Astral e viajar entre galáxias, o estado do jogo não pode ser reiniciado a cada sessão ou transição de sistema solar:
- Prédios destruídos e reconstruídos devem persistir com segurança.
- A reputação com cada facção extraterrestre deve ser preservada.
- O catálogo de espécies descobertas deve ser contínuo.
- O savegame precisa ser compacto, rápido para salvar (sem travar o frame) e suportar versionamento transparente (`version: 1`, `version: 2`) com compatibilidade regressiva.

---

## 2. Repositórios GitHub de Referência
1. **[jakearchibald/idb](https://github.com/jakearchibald/idb)**
   - *Descrição:* Wrapper leve baseado em Promises para a API nativa do `IndexedDB` do navegador, eliminando o código verboso de callbacks e transações.
   - *Aplicabilidade no Dr-Manaus:* Armazenamento robusto e estruturado de saves com capacidade de armazenar dezenas de megabytes sem esgotar o limite restrito de 5 MB do `localStorage`.
2. **[pieroxy/lz-string](https://github.com/pieroxy/lz-string)**
   - *Descrição:* Algoritmo de compressão de strings e dados JSON baseado em LZ para armazenamento ultracompacto em `localStorage` ou transferência de rede.
   - *Aplicabilidade no Dr-Manaus:* Compressão do dicionário de identificadores de destruição (`destroyed: Set<string>`) e telemetria de titãs.
3. **[protobufjs/protobuf.js](https://github.com/protobufjs/protobuf.js)**
   - *Descrição:* Implementação completa e de alto desempenho de Protocol Buffers (Protobuf) em JavaScript e TypeScript.
   - *Aplicabilidade no Dr-Manaus:* Serialização binária compacta que reduz o tamanho dos saves em mais de 80% comparado a JSON textual bruto.

---

## 3. Jogos de Referência de Persistência de Mundo
1. **[The Elder Scrolls V: Skyrim / Fallout 4](https://bethesda.net/) (Bethesda Game Studios)**
   - *Referência Técnica:* A referência máxima em persistência de estado de mundo: cada item movido, cadáver derrotado e porta destrancada recebe um identificador único de referência (FormID) que grava seu estado delta sem precisar salvar o cenário estático inteiro.
2. **[No Man's Sky](https://www.nomanssky.com/) (Hello Games)**
   - *Referência Técnica:* Persistência híbrida procedural: o universo é infinito gerado por sementes matemáticas determinísticas, enquanto os arquivos de save registram apenas os deltas de modificação do jogador (terrenos escavados, bases construídas e espécies descobertas).
3. **[Elden Ring](https://en.bandainamcoent.eu/elden-ring/elden-ring) (FromSoftware)**
   - *Referência Técnica:* Salvamento em tempo real contínuo sem menu de salvar: cada morte de chefe, coleta de item ou avanço em quest grava imediatamente no disco em background através de transações atômicas seguras contra desligamentos súbitos.

---

## 4. Documentações de Bibliotecas e Especificações
1. **[W3C IndexedDB API 3.0 Specification](https://www.w3.org/TR/IndexedDB-3/)**
   - Especificação técnica para banco de dados transacional no cliente web, abordando controle de transações concorrentes (`readwrite`), índices de busca e tolerância a falhas.
2. **[Protocol Buffers Encoding Specification (Google)](https://protobuf.dev/programming-guides/encoding/)**
   - Manual da codificação binária compacta em base-128 varints, campos com tag-chave e vetores compactados para transferência e persistência eficiente.

---

## 5. Estratégia de Implementação no Dr-Manaus
- **Arquitetura Delta no `SaveManager.ts`:** O `SaveManager` salva apenas as modificações ativas:
  ```typescript
  interface SaveData {
    version: number;
    player: { position: [number, number, number]; size: number };
    speciesCatalog: string[];
    factions: Record<string, number>;
    titans: Record<string, TitanSaveRecord>;
    destroyedProps: string[];
  }
  ```
- **Gravação Assíncrona e Versionamento Resiliente:** A serialização é feita em background por um *debounced timer* de 2 segundos após alterações ou em marcos importantes de missão, validando o número de versão na deserialização para aplicar migrações automáticas de esquemas antigos sem corromper o progresso do usuário.
