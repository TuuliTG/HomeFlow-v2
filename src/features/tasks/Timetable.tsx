import { useDraggable } from '@dnd-kit/core';
import { type ReactNode, useCallback, useState } from 'react';

import {
  atMinutes,
  endOf,
  MINUTES_PER_DAY,
  minutesIntoDay,
  type PlacedBlock,
  placeBlocks,
  type TaskSchedule,
} from '@/features/tasks/schedule';
import { EmptyTimeButton } from '@/features/tasks/EmptyTimeButton';
import type { Slot } from '@/features/tasks/SlotPicker';
import type { Task } from '@/features/tasks/task';
import { typeColours } from '@/features/tasks/typeColours';
import { type DragData, type DropTarget, PX_PER_MINUTE } from '@/features/tasks/useTimetableDrag';
import { fromIsoDate, toIsoDate, today } from '@/lib/dates';
import { useMessages } from '@/lib/i18n/i18n';

/** The timetable opens scrolled to this hour, so the morning shows first. */
const FIRST_HOUR_IN_VIEW = 7;
/** The shortest a block is drawn, so its title stays readable. */
const MIN_BLOCK_MINUTES = 15;
const hours = Array.from({ length: 24 }, (_, hour) => hour);

/** A task in the timetable, with when it is planned. */
export type ScheduledTask = Omit<TaskSchedule, 'taskId'> & { task: Task };

/** Opens a task, from the control that was tapped. */
export type OpenTask = (taskId: string, control: HTMLElement) => void;

/** Opens what to do at a time in the timetable, from the control that was tapped. */
export type PickSlot = (slot: Slot, control: HTMLElement) => void;

interface TimetableProps {
  days: string[];
  scheduled: ScheduledTask[];
  /** The task being dragged, and where it would land. */
  dragged: DragData | null;
  target: DropTarget | null;
  /** Where the scrolling box and each day's column are, for working out where a drop lands. */
  scrollerRef: (element: HTMLElement | null) => void;
  columnRef: (day: string, element: HTMLElement | null) => void;
  onOpen: OpenTask;
  onPickSlot: PickSlot;
}

/** Days side by side, with the hours of the day down the side and the tasks planned in them. */
export function Timetable({
  days,
  scheduled,
  dragged,
  target,
  scrollerRef,
  columnRef,
  onOpen,
  onPickSlot,
}: TimetableProps) {
  const t = useMessages();
  const scrollerAtMorning = useCallback(
    (element: HTMLDivElement | null) => {
      scrollerRef(element);
      // A little above the hour, so its label isn't cut off.
      if (element) element.scrollTop = (FIRST_HOUR_IN_VIEW * 60 - 10) * PX_PER_MINUTE;
    },
    [scrollerRef],
  );
  return (
    <div className="bg-surface shadow-card overflow-hidden rounded-2xl">
      {days.length > 1 && <DayHeadings days={days} />}
      {/* Focusable, so the hours can be scrolled with the keyboard. */}
      <div
        ref={scrollerAtMorning}
        role="region"
        aria-label={t.schedule.timetable}
        tabIndex={0}
        className="focus-visible:outline-brand-600 max-h-[28rem] overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <div className="flex" style={{ height: MINUTES_PER_DAY * PX_PER_MINUTE }}>
          <HourLabels />
          <div
            className="grid flex-1"
            style={{
              gridTemplateColumns: `repeat(${String(days.length)}, minmax(0, 1fr))`,
              backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
              backgroundSize: `100% ${String(60 * PX_PER_MINUTE)}px`,
            }}
          >
            {days.map((day) => (
              <DayColumn
                key={day}
                day={day}
                blocks={placeBlocks(scheduled, day)}
                preview={dragged && target?.day === day ? { ...dragged, target } : null}
                columnRef={(element) => {
                  columnRef(day, element);
                }}
                onOpen={onOpen}
                onPickSlot={onPickSlot}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Each day's weekday and date above its column; screen readers get the date from the column's name. */
function DayHeadings({ days }: { days: string[] }) {
  const t = useMessages();
  const todayDate = today();
  return (
    <div aria-hidden="true" className="border-line flex border-b text-center text-xs">
      <div className="w-10 shrink-0" />
      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${String(days.length)}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const date = fromIsoDate(day);
          return (
            <div
              key={day}
              className={[
                'flex flex-col py-1',
                day === todayDate ? 'text-brand-900 font-bold' : 'text-ink-muted',
              ].join(' ')}
            >
              <span>{t.common.weekday(date)}</span>
              <span className="text-sm">{date.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourLabels() {
  const t = useMessages();
  return (
    <div aria-hidden="true" className="text-ink-muted relative w-10 shrink-0 text-[11px]">
      {hours.slice(1).map((hour) => (
        <span
          key={hour}
          className="absolute right-1 -translate-y-1/2"
          style={{ top: hour * 60 * PX_PER_MINUTE }}
        >
          {t.common.time(atMinutes(today(), hour * 60))}
        </span>
      ))}
    </div>
  );
}

interface DayColumnProps {
  day: string;
  blocks: PlacedBlock<ScheduledTask>[];
  preview: (DragData & { target: DropTarget }) | null;
  columnRef: (element: HTMLElement | null) => void;
  onOpen: OpenTask;
  onPickSlot: PickSlot;
}

function DayColumn({ day, blocks, preview, columnRef, onOpen, onPickSlot }: DayColumnProps) {
  const t = useMessages();
  const [now] = useState(() => new Date());
  const date = t.common.shortDate(fromIsoDate(day));
  return (
    <div ref={columnRef} className="border-line relative border-l">
      <EmptyTimeButton day={day} label={t.schedule.addAt(date)} onPickSlot={onPickSlot} />
      {day === toIsoDate(now) && (
        <div
          aria-hidden="true"
          className="border-now pointer-events-none absolute inset-x-0 z-10 border-t-2"
          style={{ top: minutesIntoDay(now) * PX_PER_MINUTE }}
        />
      )}
      {preview && (
        <Block
          top={preview.target.minutes}
          height={preview.durationMinutes}
          className="border-brand-600 bg-brand-50/70 border-2 border-dashed"
        />
      )}
      <ul aria-label={t.schedule.plannedFor(date)}>
        {blocks.map((block) => (
          <ScheduledBlock key={block.item.task.id} block={block} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

interface BlockProps {
  /** Minutes into the day. */
  top: number;
  /** In minutes. */
  height: number;
  /** Its share of the column's width, side by side with the blocks it overlaps. */
  lane?: number;
  lanes?: number;
  className: string;
  children?: ReactNode;
}

/** A box in a day's column; one without content is only a picture of where a dragged task would go. */
function Block({ top, height, lane = 0, lanes = 1, className, children }: BlockProps) {
  return (
    <div
      aria-hidden={children === undefined || undefined}
      className={`absolute overflow-hidden rounded-md ${className}`}
      style={{
        top: top * PX_PER_MINUTE,
        height: Math.max(height, MIN_BLOCK_MINUTES) * PX_PER_MINUTE - 1,
        left: `calc(${String((lane / lanes) * 100)}% + 1px)`,
        width: `calc(${String(100 / lanes)}% - 2px)`,
      }}
    >
      {children}
    </div>
  );
}

function ScheduledBlock({
  block: { item, top, bottom, lane, lanes },
  onOpen,
}: {
  block: PlacedBlock<ScheduledTask>;
  onOpen: OpenTask;
}) {
  const t = useMessages();
  const { task, durationMinutes } = item;
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task, durationMinutes, startsAt: item.startsAt } satisfies DragData,
  });
  const from = t.common.time(new Date(item.startsAt));
  const to = t.common.time(endOf(item));
  return (
    <li>
      <Block
        top={top}
        height={bottom - top}
        lane={lane}
        lanes={lanes}
        className={isDragging ? 'opacity-40' : ''}
      >
        <button
          ref={setNodeRef}
          type="button"
          {...listeners}
          aria-label={t.schedule.block(task.title, from, to)}
          onClick={(event) => {
            onOpen(task.id, event.currentTarget);
          }}
          className={`flex h-full w-full cursor-grab touch-manipulation flex-col items-start overflow-hidden border-l-4 px-1 text-left text-[11px] leading-tight select-none ${typeColours[task.type]}`}
        >
          <span className="w-full truncate font-semibold">{task.title}</span>
          {bottom - top >= 30 && <span className="w-full truncate">{`${from}–${to}`}</span>}
        </button>
      </Block>
    </li>
  );
}
