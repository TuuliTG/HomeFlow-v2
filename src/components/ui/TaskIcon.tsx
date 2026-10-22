import type { TaskIconName } from '@/lib/taskIcons';

/** Each icon's emoji, shown as the device draws it. */
const emojis: Record<TaskIconName, string> = {
  bed: '🛏️',
  clothes: '👕',
  laundry: '🧺',
  dishes: '🍽️',
  table: '🍴',
  cooking: '🍳',
  vacuum: '🧹',
  cleaning: '🧽',
  bath: '🛁',
  toilet: '🚽',
  window: '🪟',
  trash: '🗑️',
  recycling: '♻️',
  toys: '🧸',
  shoes: '👟',
  plants: '🪴',
  garden: '🌱',
  leaves: '🍂',
  snow: '❄️',
  pet: '🐾',
  dog: '🐕',
  cat: '🐈',
  shopping: '🛒',
  groceries: '🥕',
  car: '🚗',
  tools: '🛠️',
  baby: '🍼',
  medicine: '💊',
  homework: '📚',
  school: '🎒',
  reading: '📖',
  music: '🎵',
  sport: '⚽',
  gift: '🎁',
  mail: '📬',
  calendar: '📅',
  phone: '📞',
  bills: '🧾',
};

/** A task's own icon, as an emoji. Decorative: the task's title, or the icon's name beside it, says it in words. */
export function TaskIcon({ name, className = '' }: { name: TaskIconName; className?: string }) {
  return (
    <span aria-hidden="true" className={`leading-none ${className}`}>
      {emojis[name]}
    </span>
  );
}
