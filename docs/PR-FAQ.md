# Press Release: Logloop — Continuous loop of personal logs in the terminal.

**PARA DIVULGAÇÃO IMEDIATA**
**Data:** 24 de Abril, 2026
**Local:** São Paulo, SP

## Resumo
Chavito anuncia a versão **v1 do Logloop**, introduzindo o **Commit Linking**. Esta atualização transforma o log de desenvolvimento em um mapa de rastreabilidade total, vinculando cada pensamento, decisão e nota técnica diretamente ao estado do código (Git HEAD). Com o Logloop, a narrativa do projeto deixa de ser um arquivo isolado para se tornar uma camada de contexto sobre o sistema de controle de versão.

## O Problema
Mesmo com commits bem escritos, o Git foca na mutação do estado do código. O contexto humano — o "porquê" de uma refatoração ou a lógica por trás de um workaround — frequentemente se perde no vácuo entre o terminal e o editor de texto. Ferramentas de documentação tradicionais falham por estarem desconectadas do fluxo de commit, resultando em logs obsoletos e falta de contexto histórico.

## A Solução
O Logloop v1 unifica o registro histórico ao Git. Ao capturar uma entrada, a ferramenta identifica automaticamente o **commit hash** e a **branch** atual, persistindo essas informações no `logloop.md`, garantindo controle total do desenvolvedor. Através da flag `--commit` ou configuração via `.loglooprc`, é possível registrar o log e realizar o commit simultaneamente, garantindo que o "porquê" esteja sempre a um commit de distância.

## Citação do Líder
"Git mostra o que mudou; Logloop mostra o porquê," diz o arquiteto líder. "Com o Commit Linking, fechamos o ciclo de feedback da documentação. Agora, cada nota no seu log tem uma âncora imutável no tempo e no código."

## Experiência do Usuário
O fluxo é intuitivo. Ao rodar `logloop`, o desenvolvedor registra sua nota e a ferramenta anexa metadados do Git automaticamente. Usuários podem usar `logloop --commit` para registrar o log e realizar o commit do código em um único passo atômico. O comportamento padrão (commit automático) pode ser configurado via `.loglooprc`.

## Citação do Cliente
"A possibilidade de ver o hash do commit ao lado da minha explicação técnica no `logloop.md` mudou meu processo de debugging. Não preciso mais adivinhar qual era minha intenção naquele commit de três dias atrás," afirma um desenvolvedor sênior :).

## Chamada para Ação
Instale agora com `npm install -g logloop` e recupere o contexto dos seus projetos.

---

# Frequently Asked Questions (FAQ)

## Perguntas Externas (Consumidor)

**1. O que acontece se eu usar o Logloop em um diretório que não é um repositório Git?**
A ferramenta funcionará normalmente, mas definirá os campos `commit` e `branch` as `null` no log, emitindo um aviso ao usuário.

**2. Posso configurar o comportamento de commit?**
Sim. O commit automático é desativado por padrão, mas você pode habilitá-lo globalmente no arquivo `.loglooprc` ou usar a flag `--commit` em execuções individuais.

**3. Como funciona a flag `--commit`?**
Ela automatiza o fluxo: registra sua nota no log, executa `git add .` e cria um commit cujo comentário referencia o hash do log, criando um vínculo direto entre o log e o commit.

**4. O Logloop captura meu humor ou emoções?**
Opcionalmente, sim. Você pode habilitar o `moodTracking` para adicionar contexto emocional aos seus logs. Esta funcionalidade utiliza o **Logloop Brain** — um motor local que utiliza heurísticas, fuzzy matching e análise de sentimento. O recurso é desabilitado por padrão.

**5. Como funciona a auto-classificação? Meus dados são enviados para uma API de IA?**
Não. A privacidade é um pilar do Logloop. Toda a classificação ocorre localmente no seu terminal usando o pipeline de inferência do `fuse.js`. Seus dados nunca saem da sua máquina para fins de "inteligência".

**6. Posso customizar ou treinar as heurísticas?**
Sim. O Logloop utiliza um "Cérebro Local-First" armazenado em `~/.logloop/memory.json`. Cada vez que você corrige uma classificação via `/as` ou `/feel`, a ferramenta aprende sua preferência. Esse arquivo é seu: você pode editá-lo, versioná-lo ou compartilhá-lo.

**7. Como funciona o motor de inferência por trás da classificação?**
O sistema utiliza o que chamamos de **"3 Camadas de Verdade"**:
*   **Memória (Verdade Pessoal)**: Prioridade total. O sistema consulta suas correções históricas.
*   **Fuzzy (Verdade Estatística)**: Busca similaridades léxicas para lidar com typos e variações.
*   **Heurística (Verdade Léxica)**: Regras determinísticas baseadas em verbos e dicionários curados.
Os resultados são combinados em um **Score de Confiança Ponderado** para garantir precisão sem falsos positivos.

## Perguntas Internas (Stakeholders)

**1. Por que mudar o arquivo padrão para `logloop.md`?**
Para reforçar o branding da suíte e manter a consistência visual com o nome da ferramenta.

**2. Qual o impacto da execução de comandos Git no tempo de resposta da CLI?**
Mínimo. Usamos comandos leves (`rev-parse`, `branch --show-current`) que executam em milissegundos.

**3. Qual o roadmap para integrações futuras?**
A v2 focará em links bidirecionais automáticos e UUIDs para cada entrada de log, facilitando a indexação e busca.