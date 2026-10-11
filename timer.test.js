import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TRAINING, createTimeline, totalDuration, validateTraining, formatTime } from './timer.js';
test('treino aprovado: pausa longa substitui descanso final e não há descanso após conclusão', () => {
  const timeline = createTimeline(DEFAULT_TRAINING);
  assert.equal(totalDuration(DEFAULT_TRAINING), 2205);
  assert.equal(timeline.filter(t => t.type === 'work').length, 32);
  assert.equal(timeline.filter(t => t.type === 'rest').length, 28);
  assert.equal(timeline.filter(t => t.type === 'recovery').length, 3);
  assert.equal(timeline.at(-1).type, 'work');
  const firstRecovery = timeline.findIndex(t => t.type === 'recovery');
  assert.equal(timeline[firstRecovery - 1].round, 8);
  assert.equal(timeline[firstRecovery + 1].series, 2);
});
test('descanso e preparação zero produzem exercícios consecutivos', () => {
  const training = { ...DEFAULT_TRAINING, preparation: 0, rest: 0, recovery: 0, work: 3, rounds: 2, series: 2 };
  assert.deepEqual(createTimeline(training).map(step => step.type), ['work', 'work', 'work', 'work']);
  assert.equal(totalDuration(training), 12);
});
test('tempos inválidos são rejeitados e relógio arredonda segundos restantes', () => {
  assert.equal(validateTraining(DEFAULT_TRAINING), null);
  for (const change of [{ work: 0 }, { rounds: 0 }, { series: 100 }, { rest: -1 }, { work: 1.5 }, { name: ' ' }]) assert.ok(validateTraining({ ...DEFAULT_TRAINING, ...change }));
  assert.equal(formatTime(39.1), '00:40');
  assert.equal(formatTime(2205), '36:45');
});
