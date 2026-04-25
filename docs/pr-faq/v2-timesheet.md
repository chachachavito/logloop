# Press Release: Logloop Timesheet — Automatic reports from real work

**PARA DIVULGAÇÃO IMEDIATA**  
**Data:** 25 de Abril, 2026  
**Local:** São Paulo, SP  

---

## Resumo

Desenvolvedores odeiam preencher timesheets.

O Logloop resolve isso transformando o trabalho real em **relatórios automáticos por dia e projeto**. Em vez de reconstruir manualmente o que foi feito, o Logloop captura o contexto enquanto você trabalha e gera um timesheet completo — sem interromper o fluxo.

---

## O Problema

Ferramentas tradicionais de time tracking como Toggl ou Clockify exigem disciplina manual.

Na prática:
- você esquece de iniciar/parar o timer  
- perde contexto do que fez  
- gera relatórios vagos (“3h desenvolvimento”)  
- precisa reconstruir o dia no final  

Isso resulta em:
- relatórios imprecisos  
- perda de tempo  
- dificuldade para justificar horas  

---

## A Solução

O Logloop transforma o fluxo de desenvolvimento em um sistema automático de timesheet.

Durante o trabalho:

```bash
logloop start client-auth
logloop note "fixing JWT refresh bug"
logloop stop
```

O sistema captura:
- tempo real de trabalho  
- contexto das atividades  
- agrupamento por projeto  

E gera relatórios estruturados automaticamente:

```bash
logloop report --today
```

---

## Antes vs Depois

### Antes

```txt
3h - desenvolvimento
```

→ sem contexto  
→ difícil justificar  
→ baixa percepção de valor  

---

### Depois

```txt
2026-04-25

Client GOV-SP (Dengue Campaign)
Tempo: 3h20

- Ajuste de criativos (formatos digitais)
- Correção de inconsistência de layout
- Preparação de assets para aprovação
```

→ contexto claro  
→ fácil de compartilhar  
→ valor percebido alto  

---

## Experiência do Usuário

O fluxo acontece junto com o trabalho:

```bash
logloop start project-x
logloop note "implementing auth"
logloop stop
```

Sem abrir outra ferramenta.  
Sem lembrar de ligar/desligar timer manualmente.  
Sem reconstruir o dia depois.

---

## Citação do Líder

"Você não deveria precisar lembrar o que fez. O seu trabalho já sabe — o Logloop só organiza isso."

---

## Citação do Cliente

"Eu parei de perder tempo preenchendo timesheet. Agora eu só exporto o dia e mando pro cliente."

---

## Chamada para Ação

```bash
npm install -g logloop
```

Pare de preencher timesheets. Deixe o seu trabalho gerar eles automaticamente.

---

# Frequently Asked Questions (FAQ)

## Perguntas Externas

### Como isso é diferente de Toggl ou Clockify?

Essas ferramentas exigem tracking manual.

O Logloop captura o trabalho em tempo real e gera relatórios automaticamente com contexto.

---

### Isso substitui Jira?

Não.

Jira gerencia tarefas e times. O Logloop reconstrói o seu dia de trabalho.

---

### Posso usar isso para cobrança de clientes?

Sim.

Os relatórios são claros, organizados por dia e projeto, e aumentam a confiança do cliente.

---

### O Logloop rastreia minha atividade automaticamente?

Não.

Ele só registra o que você explicitamente loga, mantendo controle e privacidade.

---

### O que acontece se eu esquecer de parar uma sessão?

Você pode ajustar manualmente. Futuramente, o sistema pode sugerir pausas por inatividade.

---

### Isso funciona com Git?

Sim.

Diferente do Git, que registra código, o Logloop registra contexto e tempo.

---

## Positioning (internal)

This is NOT:
- a traditional time tracker  
- a manual timesheet tool  

This IS:
- automatic timesheet generation  
- a context-driven reporting system  
- a byproduct of real work, not manual tracking  