import { describe, expect, it } from 'vitest';

import {
  addTypedLabel,
  customLabelChoices,
  labelNames,
  type TaskLabels,
  toggleCustomLabel,
  toggleLabel,
} from '@/features/tasks/taskLabelChoices';
import { CUSTOM_LABEL_MAX_LENGTH } from '@/lib/taskLabels';
import { en } from '@/locales/en';
import { fi } from '@/locales/fi';

const none: TaskLabels = { labels: [], customLabels: [] };

describe('toggleLabel', () => {
  it("ticks a ready-made label in the app's order, and unticks it", () => {
    const chosen = toggleLabel(toggleLabel(none, 'pets'), 'kitchen');
    expect(chosen.labels).toEqual(['kitchen', 'pets']);
    expect(toggleLabel(chosen, 'kitchen').labels).toEqual(['pets']);
  });
});

describe('toggleCustomLabel', () => {
  it('ticks an own label, and unticks it ignoring case', () => {
    const chosen = toggleCustomLabel(none, 'Sauna');
    expect(chosen.customLabels).toEqual(['Sauna']);
    expect(toggleCustomLabel(chosen, 'sauna').customLabels).toEqual([]);
  });
});

describe('addTypedLabel', () => {
  it('adds a new own label without spaces around it, cut to the longest allowed', () => {
    expect(addTypedLabel(none, '  Sauna ', { known: [], t: en }).customLabels).toEqual(['Sauna']);
    const long = addTypedLabel(none, 'a'.repeat(40), { known: [], t: en }).customLabels[0];
    expect(long).toHaveLength(CUSTOM_LABEL_MAX_LENGTH);
  });

  it("picks the ready-made label with that name in the user's language", () => {
    expect(addTypedLabel(none, 'kitchen', { known: [], t: en })).toEqual({
      labels: ['kitchen'],
      customLabels: [],
    });
    expect(addTypedLabel(none, 'keittiö', { known: [], t: fi }).labels).toEqual(['kitchen']);
  });

  it("spells a known own label as the household does, and doesn't add one twice", () => {
    const chosen = addTypedLabel(none, 'SAUNA', { known: ['Sauna'], t: en });
    expect(chosen.customLabels).toEqual(['Sauna']);
    expect(addTypedLabel(chosen, 'sauna', { known: ['Sauna'], t: en })).toBe(chosen);
  });

  it('changes nothing for an empty name or when the task has as many labels as it can', () => {
    expect(addTypedLabel(none, '   ', { known: [], t: en })).toBe(none);
    const full: TaskLabels = {
      labels: ['kitchen', 'cooking', 'cleaning', 'laundry', 'tidying'],
      customLabels: ['A', 'B', 'C', 'D', 'E'],
    };
    expect(addTypedLabel(full, 'Sauna', { known: [], t: en })).toBe(full);
  });
});

describe('customLabelChoices', () => {
  it("offers the household's labels, then new ones on the task, each once", () => {
    const chosen = { labels: [], customLabels: ['sauna', 'Boat'] };
    expect(customLabelChoices(['Sauna', 'Evenings'], chosen)).toEqual([
      'Sauna',
      'Evenings',
      'Boat',
    ]);
  });
});

describe('labelNames', () => {
  it("names the ready-made labels in the user's language, then the own ones", () => {
    const chosen = { labels: ['garden' as const], customLabels: ['Sauna'] };
    expect(labelNames(chosen, en)).toEqual(['Garden and yard', 'Sauna']);
    expect(labelNames(chosen, fi)).toEqual(['Piha ja puutarha', 'Sauna']);
  });
});
