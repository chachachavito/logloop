import { classifyMessage, classifyMood } from '../../src/classifier.js';

describe('Logloop Heuristics - Message Type', () => {
  test('should classify leading verbs as action', async () => {
    expect((await classifyMessage('organizar os commits')).category).toBe('action');
    expect((await classifyMessage('investigar o vazamento de memória')).category).toBe('action');
    expect((await classifyMessage('deploy no ambiente de staging')).category).toBe('action');
    expect((await classifyMessage('documentando a nova API')).category).toBe('action');
  });

  test('should classify decisions correctly', async () => {
    expect((await classifyMessage('optei por usar postgres em vez de mongo')).category).toBe('decision');
    expect((await classifyMessage('definimos que o prazo será mantido')).category).toBe('decision');
  });

  test('should classify questions correctly', async () => {
    expect((await classifyMessage('porque isso está lento?')).category).toBe('question');
  });

  test('should classify media files and markdown images', async () => {
    expect((await classifyMessage('screenshot.png')).category).toBe('media');
    expect((await classifyMessage('![diagrama](./docs/arch.jpg)')).category).toBe('media');
    expect((await classifyMessage('my-photo.WEBP')).category).toBe('media');
  });

  test('should detect noise', async () => {
    expect((await classifyMessage('ok')).category).toBe('noise');
    expect((await classifyMessage('feito')).category).toBe('noise');
  });

  test('should normalize excessive whitespace', async () => {
    const res = await classifyMessage('   subir     v1.0   ');
    expect(res.category).toBe('action');
  });
});

describe('Logloop Heuristics - Mood', () => {
  test('should detect happy/excited mood', async () => {
    expect((await classifyMood('perfeito! funcionou de primeira')).category).toBe('happy');
    expect((await classifyMood('eita topzera esse novo recurso 🚀')).category).toBe('excited');
  });

  test('should detect tired/frustrated mood', async () => {
    expect((await classifyMood('morto de cansaço, terminando por hoje')).category).toBe('tired');
    expect((await classifyMood('que lixo, nada funciona nesse projeto 🔥')).category).toBe('frustrated');
    expect((await classifyMood('estou bloqueado por causa do banco')).category).toBe('frustrated');
  });

  test('should detect confused mood', async () => {
    expect((await classifyMood('uai, o que aconteceu aqui? 🤔')).category).toBe('confused');
    expect((await classifyMood('wtf, sumiu tudo')).category).toBe('confused');
  });

  test('should handle negation correctly', async () => {
    expect((await classifyMood('nao estou feliz')).category).toBe('neutral');
    expect((await classifyMood('nao funciona nada')).category).toBe('frustrated');
  });
});
