# Press Release: Logloop — Continuous loop of personal logs in the terminal.

**PARA DIVULGAÇÃO IMEDIATA**
**Data:** 24 de Abril, 2026
**Local:** São Paulo, SP

## Resumo
Chavito anuncia a versão **v1 do Logloop**, introduzindo o **Commit Linking**. Esta atualização transforma o log de desenvolvimento em um mapa de rastreabilidade total, vinculando cada pensamento, decisão e nota técnica diretamente ao estado do código (Git HEAD). Com o Logloop, a narrativa do projeto deixa de ser um arquivo isolado para se tornar uma camada de contexto sobre o sistema de controle de versão.

## O Problema
Mesmo com commits bem escritos, o Git foca na mutação do estado do código. O contexto humano — o "porquê" de uma refatoração ou a lógica por trás de um workaround — frequentemente se perde no vácuo entre o terminal e o editor de texto. Ferramentas de documentação tradicionais falham por estarem desconectadas do fluxo de commit, resultando em logs obsoletos e falta de contexto histórico.

## A Solução
O Logloop v1 introduz o **Loop Contínuo de Contexto**. A ferramenta é desenhada para permanecer aberta em um terminal dedicado, servindo como uma "caixa preta" de decisões que mantém o histórico recente sempre visível. Ao capturar uma entrada, a ferramenta identifica automaticamente o **commit hash** e a **branch** atual, persistindo essas informações no `logloop.md`. Por padrão, o Logloop não realiza commits automaticamente, garantindo controle total do desenvolvedor. Através da flag `--commit` ou configuração via `.loglooprc`, é possível registrar o log e realizar o commit simultaneamente.

## Citação do Líder
"Git mostra o que mudou; Logloop mostra o porquê," diz o arquiteto líder. "Com o Commit Linking, fechamos o ciclo de feedback da documentação. Agora, cada nota no seu log tem uma âncora imutável no tempo e no código."

## Experiência do Usuário
O fluxo principal é o **terminal aberto**. Ao rodar `logloop`, o desenvolvedor entra em um loop interativo onde cada nova nota é exibida instantaneamente sobre o histórico recente, criando um fluxo contínuo de consciência do projeto. Para registros rápidos, o modo comando único (`logloop "mensagem"`) continua disponível. Usuários podem usar `logloop --commit` para registrar o log e realizar o commit do código em um único passo atômico.

## Citação do Cliente
"A possibilidade de ver o hash do commit ao lado da minha explicação técnica no `logloop.md` mudou meu processo de debugging. Não preciso mais adivinhar qual era minha intenção naquele commit de três dias atrás," afirma um desenvolvedor sênior :).

## Chamada para Ação
Instale agora com `npm install -g logloop` e recupere o contexto dos seus projetos.

---

# Frequently Asked Questions (FAQ)

## Perguntas Externas (Consumidor)

**1. O que acontece se eu usar o Logloop em um diretório que não é um repositório Git?**
A ferramenta funcionará normalmente, mas definirá os campos `commit` e `branch` como `null` no log, emitindo um aviso ao usuário.

**2. Posso configurar o comportamento de commit?**
Sim. O commit automático é desativado por padrão, mas você pode habilitá-lo globalmente no arquivo `.loglooprc` ou usar a flag `--commit` em execuções individuais.

**3. Como funciona a flag `--commit`?**
Ela automatiza o fluxo: registra sua nota no log, executa `git add .` e cria um commit cujo comentário referencia o hash do log, criando um vínculo direto entre o log e o commit.

**4. O Logloop captura meu humor ou emoções?**

Opcionalmente, sim. Você pode habilitar o `moodTracking` para adicionar contexto emocional aos seus logs. Esta funcionalidade utiliza heurísticas leves (normalização de texto, palavras-chave e fuzzy matching para lidar com typos) para sugerir um humor com base na mensagem, mas também permite override manual via flag `--mood`.

O usuário tem controle total sobre essas heurísticas: é possível ajustar, expandir ou customizar o vocabulário utilizado para classificação, tornando o sistema adaptado ao seu próprio estilo de escrita.

Todos os dados e configurações são armazenados localmente no ambiente do usuário (ex: `.loglooprc` e arquivos auxiliares), sem envio para serviços externos. O recurso é desabilitado por padrão para preservar a privacidade e evitar coleta de dados sensíveis sem consentimento explícito.

## Perguntas Internas (Stakeholders)

**1. Por que mudar o arquivo padrão para `logloop.md`?**
Para reforçar o branding da suíte e manter a consistência visual com o nome da ferramenta.

**2. Qual o impacto da execução de comandos Git no tempo de resposta da CLI?**
Mínimo. Usamos comandos leves (`rev-parse`, `branch --show-current`) que executam em milissegundos.

**3. Meus logs são privados?**
Por padrão, o Logloop salva no repositório (`storage: repo`). Para manter seus logs 100% privados em repositórios públicos, use `storage: local` para salvar em uma pasta oculta na sua máquina (`~/.logloop/`).

**4. Como vejo o histórico de múltiplos projetos?**
Use o comando `logloop list` para ver um índice de todos os projetos que possuem logs privados na sua máquina, com contagem de notas e data de atualização.

**5. Qual o roadmap para integrações futuras?**
A v2 focará em inteligência de contexto (Heurísticas Avançadas) para reduzir falsos positivos, além de links bidirecionais automáticos e UUIDs para indexação profunda.