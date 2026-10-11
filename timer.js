export const DEFAULT_TRAINING = { id: 'initial', name: 'HIIT · 40 / 20', work: 40, rest: 20, rounds: 8, series: 4, recovery: 120, preparation: 5 };

export function createTimeline(training) {
  const steps = [];
  if (training.preparation > 0) steps.push({ type: 'prepare', duration: training.preparation, round: 1, series: 1 });
  for (let series = 1; series <= training.series; series++) {
    for (let round = 1; round <= training.rounds; round++) {
      steps.push({ type: 'work', duration: training.work, round, series });
      if (round < training.rounds && training.rest > 0) steps.push({ type: 'rest', duration: training.rest, round, series });
    }
    if (series < training.series && training.recovery > 0) steps.push({ type: 'recovery', duration: training.recovery, round: training.rounds, series });
  }
  return steps;
}

export function totalDuration(training) { return createTimeline(training).reduce((total, step) => total + step.duration, 0); }
export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function validateTraining(training) {
  if (!training.name?.trim()) return 'Dê um nome ao treino.';
  for (const key of ['work', 'rest', 'recovery', 'preparation', 'rounds', 'series']) {
    if (!Number.isInteger(training[key])) return 'Use apenas números inteiros.';
    const minimum = ['work', 'rounds', 'series'].includes(key) ? 1 : 0;
    const maximum = ['rounds', 'series'].includes(key) ? 99 : 3599;
    if (training[key] < minimum || training[key] > maximum) return `Os tempos devem estar entre 0 e 3599 segundos; exercício, rounds e séries precisam ser maiores que zero. Rounds e séries vão até 99.`;
  }
  return null;
}
