import { app } from '@/locales/en/app';
import { auth } from '@/locales/en/auth';
import { common } from '@/locales/en/common';
import { household } from '@/locales/en/household';
import { news } from '@/locales/en/news';
import { notifications } from '@/locales/en/notifications';
import { rewards } from '@/locales/en/rewards';
import { schedule } from '@/locales/en/schedule';
import { statistics } from '@/locales/en/statistics';
import { taskForm } from '@/locales/en/taskForm';
import { tasks } from '@/locales/en/tasks';

/** English, the source language: every other language has the same texts (ADR 0002). */
export const en = {
  common,
  app,
  auth,
  household,
  notifications,
  tasks,
  taskForm,
  schedule,
  news,
  rewards,
  statistics,
};

export type Messages = typeof en;
