/**
 * The income streams the paycheck planner can start periods from, pure:
 * payers detected in history, and receivables the workspace declared.
 *
 * A declared receivable from a detected payer, due near one of its projected
 * paydays, is that payday: it replaces the projection (its amount and date
 * win) instead of counting the salary twice. One due far from any payday is
 * extra money from that payer and starts no period. Receivables from anyone
 * else form declared streams of their own.
 */
import type { PaycheckStream } from '../../contracts';
import { type ForecastEvent, type RecurringIncome, sameParty } from './forecast.engine';
import type { PlanPayday } from './paycheck-planner';
import { projectPaydays, scheduleOf } from './paycheck-schedule';

export interface DetectedInput {
  income: RecurringIncome;
  /** The payer's paydays in history, `YYYY-MM-DD`. */
  paydays: string[];
}

export interface AssembledStream {
  stream: Omit<PaycheckStream, 'selected'>;
  paydays: PlanPayday[];
  /** The latest payday in history; null for a declared stream. */
  lastDate: string | null;
  /** What it brings per month, to pick the main one. */
  monthly: number;
}

const DAYS_PER_MONTH = 365.25 / 12;

export function assembleStreams(
  detected: DetectedInput[],
  declared: ForecastEvent[],
  today: string,
  horizonEnd: string,
): { streams: AssembledStream[]; extras: PlanPayday[] } {
  const streams = detected.map(({ income, paydays }) => {
    const schedule = scheduleOf(income, paydays);
    const id = `detected:${streamKey(income.label)}`;
    const projected = projectPaydays(schedule, income.lastDate, today, horizonEnd);
    const perMonth =
      schedule.cadence === 'monthly'
        ? 1
        : schedule.cadence === 'semimonthly'
          ? 2
          : DAYS_PER_MONTH / income.intervalDays;
    return {
      stream: {
        id,
        label: income.label,
        kind: 'detected' as const,
        amount: income.amount,
        cadence: schedule.cadence,
        nextDate: projected[0]?.date ?? null,
      },
      paydays: projected.map(payday => ({
        date: payday.date,
        amount: income.amount,
        label: income.label,
        streamId: id,
        sourceId: `${id}:${payday.date}`,
        isLate: payday.isLate,
      })),
      lastDate: income.lastDate,
      monthly: income.amount * perMonth,
      wobble: Math.max(3, income.intervalDays * 0.25),
    };
  });

  const extras: PlanPayday[] = [];
  const declaredStreams = new Map<string, AssembledStream>();
  for (const receivable of declared) {
    const payday = declaredPayday(receivable, null);
    const owner = streams.find(candidate => sameParty(candidate.stream.label, receivable.label));
    if (owner) {
      const near = owner.paydays.findIndex(
        projected =>
          projected.sourceId.startsWith('detected:') &&
          Math.abs(daysBetween(projected.date, receivable.date)) <= owner.wobble,
      );
      if (near >= 0) owner.paydays[near] = { ...payday, streamId: owner.stream.id };
      else extras.push(payday);
      continue;
    }
    const id = `declared:${streamKey(receivable.label)}`;
    const stream = declaredStreams.get(id) ?? {
      stream: {
        id,
        label: receivable.label,
        kind: 'declared' as const,
        amount: receivable.amount,
        cadence: 'other' as const,
        nextDate: receivable.date,
      },
      paydays: [],
      lastDate: null,
      monthly: 0,
    };
    stream.paydays.push({ ...payday, streamId: id });
    declaredStreams.set(id, stream);
  }
  const all = [...streams.map(({ wobble: _wobble, ...rest }) => rest), ...declaredStreams.values()];
  for (const item of all) {
    item.paydays.sort((a, b) => a.date.localeCompare(b.date));
    item.stream.nextDate = item.paydays[0]?.date ?? null;
  }
  return { streams: all, extras };
}

/**
 * The streams that start the periods: the ones asked for, or by default the
 * detected payer bringing the most per month; with none detected, declared
 * payers with more than one receivable ahead (a repeating one, not a one-off).
 */
export function chooseStreams(
  streams: AssembledStream[],
  requested: readonly string[] | undefined,
): Set<string> {
  if (requested) {
    return new Set(requested.filter(id => streams.some(item => item.stream.id === id)));
  }
  const detected = streams.filter(item => item.stream.kind === 'detected');
  if (detected.length > 0) {
    const main = detected.reduce((best, item) => (item.monthly > best.monthly ? item : best));
    return new Set([main.stream.id]);
  }
  return new Set(streams.filter(item => item.paydays.length > 1).map(item => item.stream.id));
}

function declaredPayday(receivable: ForecastEvent, streamId: string | null): PlanPayday {
  return {
    date: receivable.date,
    amount: receivable.amount,
    label: receivable.label,
    streamId,
    sourceId: receivable.sourceId,
    isLate: receivable.isOverdue === true,
  };
}

/** A short stable id for a payer name: names may hold commas, which split a query list. */
export function streamKey(label: string): string {
  let hash = 0x811c9dc5;
  for (const char of label.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
