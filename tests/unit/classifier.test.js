const { classifyMessage, classifyMood } = require('../../src/classifier');

describe('Logloop Heuristics - Message Type', () => {
  test('should classify leading verbs as action', () => {
    expect(classifyMessage('organizar os commits').category).toBe('action');
    expect(classifyMessage('investigar o vazamento de memória').category).toBe('action');
    expect(classifyMessage('deploy no ambiente de staging').category).toBe('action');
    expect(classifyMessage('documentando a nova API').category).toBe('action');
  });

  test('should classify decisions correctly', () => {
    expect(classifyMessage('optei por usar postgres em vez de mongo').category).toBe('decision');
    expect(classifyMessage('definimos que o prazo será mantido').category).toBe('decision');
  });

  test('should classify questions correctly', () => {
    expect(classifyMessage('porque isso está lento?').category).toBe('question');
  });

  test('should classify media files and markdown images', () => {
    expect(classifyMessage('screenshot.png').category).toBe('media');
    expect(classifyMessage('![diagrama](./docs/arch.jpg)').category).toBe('media');
    expect(classifyMessage('my-photo.WEBP').category).toBe('media');
  });

  test('should detect noise', () => {
    expect(classifyMessage('ok').category).toBe('noise');
    expect(classifyMessage('feito').category).toBe('noise');
  });

  test('should normalize excessive whitespace', () => {
    const res = classifyMessage('   subir     v1.0   ');
    expect(res.category).toBe('action');
  });
});

describe('Logloop Heuristics - Mood', () => {
  test('should detect happy/excited mood', () => {
    expect(classifyMood('perfeito! funcionou de primeira').category).toBe('happy');
    expect(classifyMood('eita topzera esse novo recurso 🚀').category).toBe('excited');
  });

  test('should detect tired/frustrated mood', () => {
    expect(classifyMood('morto de cansaço, terminando por hoje').category).toBe('tired');
    expect(classifyMood('que lixo, nada funciona nesse projeto 🔥').category).toBe('frustrated');
    expect(classifyMood('estou bloqueado por causa do banco').category).toBe('frustrated');
  });

  test('should detect confused mood', () => {
    expect(classifyMood('uai, o que aconteceu aqui? 🤔').category).toBe('confused');
    expect(classifyMood('wtf, sumiu tudo').category).toBe('confused');
  });

  test('should handle negation correctly', () => {
    expect(classifyMood('nao estou feliz').category).toBe('neutral');
    expect(classifyMood('nao funciona nada').category).toBe('frustrated');
  });
});
