import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskForm } from '@/features/tasks/TaskForm';
import { useAddTask } from '@/features/tasks/useTasks';
import { useLoggedInUser } from '@/lib/auth';

export function CreateTaskPage() {
  const user = useLoggedInUser();
  const addTask = useAddTask(user.id);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="New task"
        description="Adding a task is meta work, and it counts."
      />
      <TaskForm
        submitLabel="Create task"
        isSaving={addTask.isPending}
        onSave={async (task) => {
          await addTask.mutateAsync(task);
          await navigate(paths.tasks);
        }}
      />
    </>
  );
}
