const allowedMoods = ['happy', 'excited', 'neutral', 'focused', 'tired', 'frustrated', 'confused', 'unidentified'];

function classifyMood(message) {
  const msg = message.toLowerCase();
  const emoticons = {
    happy: [':)', ':-)', '^_^', 'uwu', '<3', '♥', ':D', ':-D', ':*', '(^_^)/', '(*^_^*)', 'owo'],
    frustrated: [':(', ':-(', 'T_T', ';_;', 'T^T', ":'(", 'T_T_T', 'Q_Q', 'TT', '>:(', '>.>', '>.<', 'orz', '/_\\', 'angry'],
    confused: [':O', 'O_O', 'D:', 'D_x', 'O.o', '0_0', 'dx', '-_ -||', '???', '¯\\_(ツ)_/¯', '¬_¬', '.-.'],
    neutral: ['|_)', ':/', ':\\', ')_(', ':P', ':-P', 'rolled eyes'],
    tired: ['-_-']
  };

  const dict = {
    happy: ['consegui', 'sucesso', 'funciona', 'top', 'boa', 'feliz', 'eba', 'uau', 'vitoria', 'resolvido', 'yay'],
    excited: ['caramba', 'incrível', 'bora', 'viva', 'animado', 'show', 'espetacular', 'animal', 'hype', 'massa'],
    focused: ['concentrado', 'focado', 'estudando', 'mergulhado', 'deep', 'foco', 'flow', 'imerso', 'produtivo'],
    tired: ['cansado', 'sono', 'exausto', 'parando', 'uufa', 'fadiga', 'moído', 'acabado'],
    frustrated: ['droga', 'erro', 'difícil', 'não funciona', 'merda', 'bug', 'problema', 'inferno', 'saco', 'empacado', 'pqp', 'triste', 'mal', 'ruim', 'péssimo', 'desânimo', 'desanimado', 'foda'],
    confused: ['estranho', 'não entendi', 'confuso', 'por que', 'uai', 'buguei', 'dúvida', 'perdi']
  };

  // 1. Emoticons
  const emoticonMatches = Object.keys(emoticons).filter(mood =>
    emoticons[mood].some(e => msg.includes(e))
  );

  if (emoticonMatches.length === 1) return emoticonMatches[0];
  if (emoticonMatches.length > 1) return 'unidentified';

  // 2. Keywords
  const matches = Object.keys(dict).filter(mood =>
    dict[mood].some(kw => msg.includes(kw))
  );

  return matches.length === 1 ? matches[0] : 'unidentified';
}

function classifyMessage(message) {
  const msg = message.trim();
  if (msg.length < 5 || /^(test|teste|ss)$/i.test(msg)) return 'noise';
  if (msg.includes('?')) return 'question';
  const decisionKeywords = ['decidi', 'decisão', 'vou usar', 'escolhi'];
  if (decisionKeywords.some(kw => msg.toLowerCase().includes(kw))) return 'decision';
  return 'thought';
}

module.exports = {
  allowedMoods,
  classifyMood,
  classifyMessage
};
