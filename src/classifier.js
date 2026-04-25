const Fuse = require('fuse.js');
const { loadMemory, learn } = require('./memory');

const MESSAGE_CATEGORIES = [
  { name: 'action', patterns: [/^(criando|implementando|refatorando|ajustando|fazendo|resolvendo|preciso|organizar|testar|subir|enviar|build|deploy|setup|clean|task|create|implement|refactor|fix|add|update|making|working|building|testing|commit|push|pull|merge|rebase|branch|stashing|install|npm|deps|dependencies|publish|layout|css|style|component|lint|audit|review|investigar|investigating|debugging|depurando|migrando|migrating|configurando|configuring|monitorando|monitoring|escrevendo|writing|deletando|deleting|removing|removendo|documentando|documenting)\b/i] },
  { name: 'decision', patterns: [/decidi|decisão|vou usar|escolhi|definido|decided|picked|chosen|set to|optei|definimos|concordamos|assumindo|opted|agreed|assumed|selected|selecionado/i] },
  { name: 'question', patterns: [/\?/] },
  { name: 'media', patterns: [/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i, /!\[.*\]\(.*\)/] },
  { name: 'noise', patterns: [/^(test|teste|ss|log|hi|oi|ok|ready|pronto|feito|done)$/i] },
  { name: 'thought', patterns: [] }
];

const MOOD_CATEGORIES = [
  { name: 'happy', patterns: [/\b(consegui|sucesso|funciona|top|boa|feliz|eba|uau|vitoria|resolvido|yay|fixed|solved|win|otimo|excelente|perfeito|maravilha|great|excellent|perfect)\b/i] },
  { name: 'focused', patterns: [/\b(concentrado|focado|estudando|mergulhado|deep|foco|flow|imerso|produtivo|focus|grind|codando|coding)\b/i] },
  { name: 'tired', patterns: [/\b(cansado|sono|exausto|parando|uufa|fadiga|moido|acabado|tired|sleepy|morto|exhausted|beat)\b/i, /done for today/i] },
  { name: 'frustrated', patterns: [/\b(droga|erro|dificil|nao funciona|merda|bug|problema|inferno|saco|empacado|pqp|triste|mal|ruim|pessimo|desanimo|desanimado|foda|shit|error|broken|hard|lixo|travado|bloqueado|garbage|stuck|blocked)\b/i] },
  { name: 'confused', patterns: [/\b(estranho|nao entendi|confuso|por que|uai|buguei|duvida|perdi|confused|weird|why|how|wtf|perdido)\b/i, /\?/] },
  { name: 'excited', patterns: [/\b(caramba|incrivel|bora|viva|animado|show|espetacular|animal|hype|massa|amazing|awesome|lets go|insano|uau|wow|eita|topzera)\b/i, /!!/ ] },
  { name: 'neutral', patterns: [] }
];

const EMOTICONS = {
  happy: [':)', ':-)', '^_^', 'uwu', '<3', '♥', ':D', ':-D', ':*', '(^_^)/', '(*^_^*)', 'owo', '✅'],
  excited: ['🚀', '✨', '🤩'],
  frustrated: [':(', ':-(', 'T_T', ';_;', 'T^T', ":'(", 'T_T_T', 'Q_Q', 'TT', '>:(', '>.>', '>.<', 'orz', '/_\\', 'angry', '❌', '💀'],
  confused: [':O', 'O_O', 'D:', 'D_x', 'O.o', '0_0', 'dx', '-_ -||', '???', '¯\\_(ツ)_/¯', '¬_¬', '.-.', '🤔', '❓'],
  neutral: ['|_)', ':/', ':\\', ')_(', ':P', ':-P', 'rolled eyes', '😐'],
  tired: ['-_-', '😴', '💤']
};

const SENTIMENT_DICT = {
  positive: ['top', 'show', 'boa', 'legal', 'massa', 'incrivel', 'amando', 'conseguindo', 'funciona', 'love', 'great', 'awesome', 'working', 'perfeito', 'otimo', 'viva', 'eba'],
  negative: ['droga', 'merda', 'ruim', 'mal', 'pessimo', 'dificil', 'bug', 'erro', 'saco', 'odio', 'hate', 'bad', 'hard', 'broken', 'lixo', 'inferno', 'pqp', 'foda']
};

function normalize(text) {
  return text.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function analyzeSentiment(text) {
  const norm = normalize(text);
  const words = norm.split(/\s+/);
  const negations = ['nao', 'nunca', 'jamais', 'nem', 'not', 'never', 'no'];
  
  let score = 0.5;
  let isNegated = false;

  words.forEach((word) => {
    if (negations.includes(word)) {
      isNegated = true;
      return;
    }

    let wordScore = 0;
    if (SENTIMENT_DICT.positive.includes(word)) wordScore = 0.1;
    if (SENTIMENT_DICT.negative.includes(word)) wordScore = -0.1;

    if (wordScore !== 0) {
      score += isNegated ? -wordScore : wordScore;
      isNegated = false;
    }
  });

  if (text.includes('!!')) score += 0.05;
  if (text.includes('??')) score -= 0.05;
  return Math.max(0, Math.min(1, score)); 
}

function runPipeline(input, contextMemory, categories, threshold = 0.4) {
  const norm = normalize(input);
  let aliased = norm;
  const allAliases = { ...contextMemory.aliases_static, ...contextMemory.aliases_learned };
  Object.keys(allAliases).forEach(alias => {
    const regex = new RegExp(`\\b${alias}\\b`, 'gi');
    aliased = aliased.replace(regex, allAliases[alias]);
  });

  const match = contextMemory.mappings.find(m => 
    m.normalized === aliased || aliased.includes(m.normalized)
  );
  if (match) {
    return { category: match.category, resolved: match.resolved, confidence: 1.0, metadata: { source: 'memory' } };
  }

  const fuse = new Fuse(categories, {
    keys: ['name', 'patterns'],
    includeScore: true,
    threshold
  });
  const fuzzyResults = fuse.search(aliased);
  const bestFuzzy = fuzzyResults[0];
  const fuzzyScore = bestFuzzy ? (1 - bestFuzzy.score) : 0;

  return {
    category: bestFuzzy ? bestFuzzy.item.name : 'unidentified',
    resolved: fuzzyScore > 0.7 ? (bestFuzzy ? bestFuzzy.item.name : 'unidentified') : 'unidentified',
    confidence: fuzzyScore,
    metadata: { source: 'fuzzy', ...(bestFuzzy ? { fuzzyScore } : {}) }
  };
}

function classifyMessage(text) {
  if (!text) return { category: 'noise', score: 1 };
  
  const normalizedText = text.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalizedText) return { category: 'noise', score: 1 };
  
  const memory = loadMemory().message;
  const res = runPipeline(normalizedText, memory, MESSAGE_CATEGORIES);
  const norm = normalize(normalizedText);
  
  let heuristicScore = 0;
  let heuristicCat = res.category;
  let source = res.metadata.source;

  MESSAGE_CATEGORIES.forEach(cat => {
    if (cat.patterns.some(p => p.test(norm))) {
      heuristicScore = 0.8;
      heuristicCat = cat.name;
      source = 'heuristic';
    }
  });

  const finalConfidence = Math.max(0, Math.min(1, (res.confidence * 0.6) + (heuristicScore * 0.4)));
  const isReliable = finalConfidence >= 0.3; 
  const category = isReliable ? heuristicCat : 'thought';

  return { 
    category, 
    resolved: isReliable ? (res.resolved !== 'unidentified' ? res.resolved : category) : 'thought',
    confidence: finalConfidence || 0.1, 
    metadata: { ...res.metadata, source: isReliable ? source : 'fallback' } 
  };
}

function classifyMood(message) {
  const msg = message.toLowerCase();
  const validMoods = MOOD_CATEGORIES.map(c => c.name);
  
  for (const mood in EMOTICONS) {
    if (EMOTICONS[mood].some(e => msg.includes(e))) {
      const category = validMoods.includes(mood) ? mood : 'neutral';
      return {
        category,
        resolved: category,
        confidence: 1.0,
        metadata: { source: 'emoticon' }
      };
    }
  }

  const memory = loadMemory().mood;
  const res = runPipeline(message, memory, MOOD_CATEGORIES);

  const sentiment = analyzeSentiment(message);
  const sentimentInfluence = (sentiment - 0.5) * 0.4;

  let heuristicScore = 0;
  let heuristicCat = res.category;
  let source = res.metadata.source;
  let heuristicMatch = false;

  const negations = ['nao', 'nunca', 'jamais', 'nem', 'not', 'never', 'no'];

  MOOD_CATEGORIES.forEach(cat => {
    const hasPattern = cat.patterns.some(p => p.test(msg));
    if (hasPattern) {
      const isPositive = ['happy', 'excited'].includes(cat.name);
      const msgWords = msg.split(/\s+/);
      const hasNegationBefore = msgWords.some(w => negations.includes(w));

      if (hasNegationBefore && isPositive) return;

      heuristicScore = 0.8;
      heuristicCat = cat.name;
      source = 'heuristic';
      heuristicMatch = true;
    }
  });

  const effectiveFuzzyConfidence = heuristicMatch ? 0 : res.confidence;
  const finalScore = Math.max(0, Math.min(1, (effectiveFuzzyConfidence * 0.5) + (heuristicScore * 0.4) + sentimentInfluence));
  
  const isReliable = finalScore >= 0.2 && validMoods.includes(heuristicCat);
  const category = isReliable ? heuristicCat : 'neutral';
  
  return {
    category,
    resolved: isReliable ? (res.resolved !== 'unidentified' ? res.resolved : category) : 'neutral',
    confidence: finalScore || 0.1,
    metadata: { ...res.metadata, source: isReliable ? source : 'fallback' }
  };
}

module.exports = {
  classifyMood,
  classifyMessage,
  learn
};
