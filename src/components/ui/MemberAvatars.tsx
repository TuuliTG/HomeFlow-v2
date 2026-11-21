/** One colour per member, by the order they joined. */
const avatarClassNames = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
] as const;

/** The colour of the member who joined `index`-th (from 0). */
function avatarClassName(index: number): string {
  return avatarClassNames[index % avatarClassNames.length] ?? avatarClassNames[0];
}

/** A name's first letter, capitalised; a dot for a member without a name yet. */
function initialOf(name: string | null): string {
  const [first] = Array.from(name?.trim() ?? '');
  return first?.toLocaleUpperCase() ?? '·';
}

interface MemberAvatarsProps {
  /** The members' names, in the order they joined. */
  names: (string | null)[];
  /** How many initials to show before "+N". */
  max?: number;
}

/** The members' initials as overlapping coloured circles, for decoration: the names are said elsewhere. */
export function MemberAvatars({ names, max = 3 }: MemberAvatarsProps) {
  const shown = names.length > max ? names.slice(0, max - 1) : names;
  const more = names.length - shown.length;
  const circleClassName =
    'ring-surface grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ring-2 not-first:-ml-2';
  return (
    <span aria-hidden="true" className="flex">
      {shown.map((name, index) => (
        <span key={index} className={`${circleClassName} ${avatarClassName(index)} text-white`}>
          {initialOf(name)}
        </span>
      ))}
      {more > 0 && (
        <span className={`${circleClassName} bg-brand-100 text-brand-900`}>+{more}</span>
      )}
    </span>
  );
}
