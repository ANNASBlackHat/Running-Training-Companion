import { TEMPLATE_NORWEGIAN_4X4, TEMPLATE_400M } from '@/domain/templates';
import type { Session, Workout } from '@/domain/types';
import { findWorkout, replaceItem, useWorkoutStore } from '../workouts';
import { sessionsForWorkout, useSessionStore } from '../sessions';
import { useSettingsStore } from '../settings';

beforeEach(() => {
  useWorkoutStore.setState({ workouts: [] });
  useSessionStore.setState({ sessions: [] });
  useSettingsStore.setState({ voiceEnabled: true, beepsEnabled: true });
});

describe('workout store', () => {
  it('always exposes the built-in templates (section 8)', () => {
    const state = useWorkoutStore.getState();
    expect(state.templates).toHaveLength(2);
    expect(state.templates.map((t) => t.name)).toEqual([
      'Norwegian 4x4',
      '400 m repeats',
    ]);
    expect(state.templates.every((t) => t.isTemplate)).toBe(true);
  });

  it('matches the MVP scope definition of Norwegian 4x4', () => {
    const t = findWorkout(useWorkoutStore.getState(), TEMPLATE_NORWEGIAN_4X4.id)!;
    const repeat = t.items.find((i) => i.kind === 'repeat');
    expect(repeat).toBeDefined();
    expect(repeat!.kind === 'repeat' && repeat!.count).toBe(4);

    const segs = repeat!.kind === 'repeat' ? repeat!.segments : [];
    expect(segs.map((s) => [s.type, s.length])).toEqual([
      ['run', { kind: 'time', seconds: 240 }],
      ['rest', { kind: 'time', seconds: 180 }],
    ]);

    expect(t.items[0].kind === 'segment' && t.items[0].segment.type).toBe('warmup');
    expect(t.items[2].kind === 'segment' && t.items[2].segment.type).toBe('cooldown');
  });

  it('saves and updates a workout', () => {
    const { saveWorkout } = useWorkoutStore.getState();
    const w: Workout = { id: 'w1', name: 'Mine', isTemplate: false, items: [] };

    saveWorkout(w);
    expect(useWorkoutStore.getState().workouts).toHaveLength(1);

    saveWorkout({ ...w, name: 'Renamed' });
    expect(useWorkoutStore.getState().workouts).toHaveLength(1);
    expect(useWorkoutStore.getState().workouts[0].name).toBe('Renamed');
  });

  it('deletes a workout', () => {
    const { saveWorkout, deleteWorkout } = useWorkoutStore.getState();
    saveWorkout({ id: 'w1', name: 'Mine', isTemplate: false, items: [] });
    deleteWorkout('w1');
    expect(useWorkoutStore.getState().workouts).toHaveLength(0);
  });

  it('creates a copy when a template is edited (US-4)', () => {
    const id = useWorkoutStore.getState().createFromTemplate(TEMPLATE_400M.id)!;
    expect(id).toBeTruthy();

    const copy = findWorkout(useWorkoutStore.getState(), id)!;
    expect(copy.isTemplate).toBe(false);
    expect(copy.name).toBe('400 m repeats copy');
    expect(copy.items).toHaveLength(TEMPLATE_400M.items.length);

    // The built-in is untouched, so it stays restorable.
    const original = findWorkout(useWorkoutStore.getState(), TEMPLATE_400M.id)!;
    expect(original.isTemplate).toBe(true);
    expect(original.name).toBe('400 m repeats');
  });

  it('does not let an edited copy mutate the built-in template', () => {
    const id = useWorkoutStore.getState().createFromTemplate(TEMPLATE_400M.id)!;
    const copy = findWorkout(useWorkoutStore.getState(), id)!;
    const first = copy.items[0];
    if (first.kind === 'segment') {
      first.segment.length = { kind: 'time', seconds: 999 };
    }

    const original = findWorkout(useWorkoutStore.getState(), TEMPLATE_400M.id)!;
    expect(JSON.stringify(original)).toEqual(JSON.stringify(TEMPLATE_400M));
  });

  it('returns null for an unknown template id', () => {
    expect(useWorkoutStore.getState().createFromTemplate('nope')).toBeNull();
  });
});

describe('session store', () => {
  const session = (id: string, startedAt: number, workoutId = 'w1'): Session => ({
    id,
    workoutId,
    workoutSnapshot: TEMPLATE_NORWEGIAN_4X4,
    startedAt,
    endedAt: startedAt + 1000,
    results: [],
    totals: { durationSec: 1000, distanceM: 2000, avgPaceSecPerKm: 500 },
    track: [],
  });

  it('stores sessions newest first', () => {
    const { saveSession } = useSessionStore.getState();
    saveSession(session('a', 1000));
    saveSession(session('c', 3000));
    saveSession(session('b', 2000));

    expect(useSessionStore.getState().sessions.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('replaces a session saved twice with the same id', () => {
    const { saveSession } = useSessionStore.getState();
    saveSession(session('a', 1000));
    saveSession({ ...session('a', 1000), totals: { durationSec: 5, distanceM: 5, avgPaceSecPerKm: null } });

    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(useSessionStore.getState().sessions[0].totals.durationSec).toBe(5);
  });

  it('finds and deletes a session', () => {
    const { saveSession, deleteSession } = useSessionStore.getState();
    saveSession(session('a', 1000));
    expect(useSessionStore.getState().getSession('a')).toBeDefined();

    deleteSession('a');
    expect(useSessionStore.getState().getSession('a')).toBeUndefined();
  });

  it('filters sessions by workout (US-18 groundwork)', () => {
    const { saveSession } = useSessionStore.getState();
    saveSession(session('a', 1000, 'w1'));
    saveSession(session('b', 2000, 'w2'));

    expect(sessionsForWorkout(useSessionStore.getState().sessions, 'w1').map((s) => s.id)).toEqual(['a']);
  });
});

describe('settings store (US-12)', () => {
  it('defaults both cues on', () => {
    const s = useSettingsStore.getState();
    expect(s.voiceEnabled).toBe(true);
    expect(s.beepsEnabled).toBe(true);
  });

  it('toggles voice and beeps independently', () => {
    useSettingsStore.getState().setVoiceEnabled(false);
    expect(useSettingsStore.getState().voiceEnabled).toBe(false);
    expect(useSettingsStore.getState().beepsEnabled).toBe(true);

    useSettingsStore.getState().setBeepsEnabled(false);
    expect(useSettingsStore.getState().beepsEnabled).toBe(false);
  });
});

describe('builder helper', () => {
  it('replaces one item without mutating the original array', () => {
    const items = [
      { kind: 'segment' as const, segment: { id: 'a', type: 'run' as const, length: { kind: 'time' as const, seconds: 60 } } },
    ];
    const next = replaceItem(items, 0, {
      kind: 'segment',
      segment: { id: 'b', type: 'rest', length: { kind: 'time', seconds: 90 } },
    });

    expect(next[0].kind === 'segment' && next[0].segment.id).toBe('b');
    expect(items[0].kind === 'segment' && items[0].segment.id).toBe('a');
  });
});
