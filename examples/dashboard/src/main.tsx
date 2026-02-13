import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  render,
  Box,
  Text,
  Input,
  Button,
  Select,
  List,
  Menu,
  FocusScope,
  Portal,
  Keybind,
  Spacer,
  Progress,
  ScrollView,
  ToastHost,
  useToast,
  useApp,
} from "@semos-labs/glyph";

// ── Types ──────────────────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "critical";
type Category = "bug" | "feature" | "docs" | "chore";
type Status = "todo" | "in-progress" | "done";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  status: Status;
}

// ── Constants ──────────────────────────────────────────────────

const PRIORITY_LABEL = {
  critical: "!",
  high: "↑",
  medium: "•",
  low: "↓",
} as const;

const STATUS_ICON = {
  todo: "○",
  "in-progress": "◑",
  done: "●",
} as const;

const PRIORITY_ITEMS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

const CATEGORY_ITEMS = [
  { label: "Bug", value: "bug" },
  { label: "Feature", value: "feature" },
  { label: "Docs", value: "docs" },
  { label: "Chore", value: "chore" },
];

const STATUS_ITEMS = [
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in-progress" },
  { label: "Done", value: "done" },
];

const SEED: Task[] = [
  {
    id: 1,
    title: "Fix authentication timeout",
    description:
      "Users report being logged out after 5 minutes of inactivity. The session token refresh logic seems broken.",
    priority: "critical",
    category: "bug",
    status: "in-progress",
  },
  {
    id: 2,
    title: "Add dark mode support",
    description:
      "Implement a theme toggle in the settings page. Store preference in localStorage.",
    priority: "medium",
    category: "feature",
    status: "todo",
  },
  {
    id: 3,
    title: "Write API endpoint documentation",
    description:
      "Document all REST endpoints in /api/v2. Include request/response schemas.",
    priority: "low",
    category: "docs",
    status: "todo",
  },
  {
    id: 4,
    title: "Refactor database connection pool",
    description:
      "Current pool maxes out at 10 connections under load. Add connection health checks.",
    priority: "high",
    category: "chore",
    status: "in-progress",
  },
  {
    id: 5,
    title: "Implement WebSocket notifications",
    description:
      "Real-time push notifications for task assignments and status changes.",
    priority: "medium",
    category: "feature",
    status: "todo",
  },
  {
    id: 6,
    title: "Fix CSS overflow in mobile nav",
    description:
      "The hamburger menu content overflows on screens narrower than 320px.",
    priority: "high",
    category: "bug",
    status: "todo",
  },
  {
    id: 7,
    title: "Add unit tests for auth module",
    description:
      "Cover login, logout, token refresh, password reset, and MFA flows.",
    priority: "medium",
    category: "chore",
    status: "done",
  },
  {
    id: 8,
    title: "Update README with setup guide",
    description:
      "Add prerequisites, environment setup, and quick-start section.",
    priority: "low",
    category: "docs",
    status: "done",
  },
  {
    id: 9,
    title: "Migrate to TypeScript strict mode",
    description:
      "Enable strict: true in tsconfig. Fix all resulting type errors.",
    priority: "low",
    category: "chore",
    status: "done",
  },
  {
    id: 10,
    title: "Add rate limiting to API",
    description:
      "Implement sliding window rate limiting per API key. Use Redis for counting.",
    priority: "high",
    category: "feature",
    status: "in-progress",
  },
  {
    id: 11,
    title: "Optimize image compression pipeline",
    description: "Current pipeline is too slow for large batches. Consider using worker threads.",
    priority: "medium",
    category: "chore",
    status: "todo",
  },
  {
    id: 12,
    title: "Fix memory leak in WebSocket handler",
    description: "Connections not being properly cleaned up on disconnect. Heap grows unbounded.",
    priority: "critical",
    category: "bug",
    status: "todo",
  },
  {
    id: 13,
    title: "Add export to CSV feature",
    description: "Users want to export their task lists to CSV for reporting.",
    priority: "low",
    category: "feature",
    status: "todo",
  },
  {
    id: 14,
    title: "Implement search functionality",
    description: "Full-text search across task titles and descriptions.",
    priority: "high",
    category: "feature",
    status: "todo",
  },
  {
    id: 15,
    title: "Add keyboard shortcuts help modal",
    description: "Show all available shortcuts when user presses ?",
    priority: "low",
    category: "feature",
    status: "done",
  },
  {
    id: 16,
    title: "Fix timezone handling in due dates",
    description: "Tasks created in different timezones show wrong due dates.",
    priority: "high",
    category: "bug",
    status: "in-progress",
  },
  {
    id: 17,
    title: "Add bulk task operations",
    description: "Select multiple tasks and mark done/delete in one action.",
    priority: "medium",
    category: "feature",
    status: "todo",
  },
  {
    id: 18,
    title: "Improve error messages",
    description: "Replace generic errors with actionable messages.",
    priority: "low",
    category: "chore",
    status: "todo",
  },
  {
    id: 19,
    title: "Add task templates",
    description: "Pre-defined templates for common task types.",
    priority: "medium",
    category: "feature",
    status: "todo",
  },
  {
    id: 20,
    title: "Setup CI/CD pipeline",
    description: "Automate testing and deployment with GitHub Actions.",
    priority: "high",
    category: "chore",
    status: "done",
  },
];

let nextId = 21;

// ── Header ─────────────────────────────────────────────────────

function Header({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const progress = total > 0 ? done / total : 0;

  return (
    <Box style={{ flexDirection: "row", alignItems: "center", paddingX: 1 }}>
      <Text style={{ bold: true }}>tasks</Text>
      <Text style={{ dim: true }}> · </Text>
      <Text style={{ dim: true }}>
        {done}/{total}
      </Text>
      <Spacer />
      <Box style={{ width: 16 }}>
        <Progress value={progress} style={{ dim: true }} />
      </Box>
    </Box>
  );
}

// ── Sidebar ────────────────────────────────────────────────────

function Sidebar({
  tasks,
  filter,
  onFilterChange,
}: {
  tasks: Task[];
  filter: string;
  onFilterChange: (filter: string) => void;
}) {
  const counts = useMemo(() => {
    const todo = tasks.filter((t) => t.status === "todo").length;
    const active = tasks.filter((t) => t.status === "in-progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { all: tasks.length, todo, active, done };
  }, [tasks]);

  const menuItems = [
    { label: `all ${counts.all}`, value: "all" },
    { label: `todo ${counts.todo}`, value: "todo" },
    { label: `active ${counts.active}`, value: "in-progress" },
    { label: `done ${counts.done}`, value: "done" },
  ];

  const selectedIndex = menuItems.findIndex((i) => i.value === filter);

  return (
    <Box
      style={{
        flexDirection: "column",
        width: 14,
        flexShrink: 0,
        paddingTop: 1,
      }}
    >
      <Menu
        items={menuItems}
        selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
        onSelectionChange={(i) => {
          const item = menuItems[i];
          if (item) onFilterChange(item.value);
        }}
        highlightColor="white"
        style={{ bg: undefined }}
      />
    </Box>
  );
}

// ── Task list ──────────────────────────────────────────────────

function TaskListView({
  tasks,
  selectedIndex,
  onSelectionChange,
  onSelect,
}: {
  tasks: Task[];
  selectedIndex: number;
  onSelectionChange: (i: number) => void;
  onSelect: (i: number) => void;
}) {
  const [scrollOffset, setScrollOffset] = useState(0);
  // Conservative estimate - actual viewport may be larger but this ensures visibility
  const viewportHeight = 15;

  // Keep selected item visible - scroll only when it goes off-screen
  useEffect(() => {
    setScrollOffset((currentOffset) => {
      // If selected is above visible area, scroll up
      if (selectedIndex < currentOffset) {
        return selectedIndex;
      }
      // If selected is below visible area, scroll down
      if (selectedIndex >= currentOffset + viewportHeight) {
        return selectedIndex - viewportHeight + 1;
      }
      // No change needed
      return currentOffset;
    });
  }, [selectedIndex]);

  if (tasks.length === 0) {
    return (
      <Box
        style={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ dim: true }}>no tasks</Text>
      </Box>
    );
  }

  return (
    <ScrollView
      style={{
        flexGrow: 1,
        flexDirection: "column",
      }}
      scrollOffset={scrollOffset}
      onScroll={setScrollOffset}
      scrollToFocus={false}
      disableKeyboard
    >
      <List
        count={tasks.length}
        selectedIndex={selectedIndex}
        onSelectionChange={onSelectionChange}
        onSelect={onSelect}
        renderItem={({ index, selected, focused }) => {
          const task = tasks[index]!;
          const active = selected && focused;
          const isDone = task.status === "done";

          return (
            <Box
              style={{
                flexDirection: "row",
                paddingX: 1,
                gap: 1,
                bg: active ? "white" : undefined,
              }}
            >
              <Text
                style={{
                  color: active ? "black" : isDone ? "blackBright" : "white",
                  dim: isDone && !active,
                }}
              >
                {STATUS_ICON[task.status]}
              </Text>
              <Text
                style={{
                  flexGrow: 1,
                  color: active ? "black" : undefined,
                  dim: isDone && !active,
                }}
              >
                {task.title}
              </Text>
              <Text
                style={{
                  color: active ? "black" : "blackBright",
                  dim: !active,
                }}
              >
                {PRIORITY_LABEL[task.priority]}
              </Text>
            </Box>
          );
        }}
      />
    </ScrollView>
  );
}

// ── Status bar ─────────────────────────────────────────────────

function StatusBar() {
  return (
    <Box style={{ paddingX: 1, flexDirection: "row" }}>
      <Text style={{ dim: true }}>
        n new · s status · d delete · ↵ edit · tab switch · q quit
      </Text>
    </Box>
  );
}

// ── New task modal ─────────────────────────────────────────────

function NewTaskModal({
  onSubmit,
  onCancel,
}: {
  onSubmit: (task: Omit<Task, "id">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState<string>("feature");

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority: priority as Priority,
      category: category as Category,
      status: "todo",
    });
  }, [title, description, priority, category, onSubmit]);

  return (
    <Portal>
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <FocusScope trap>
          <ScrollView
            style={{
              width: 50,
              height: 16,
              bg: "black",
              padding: 1,
            }}
          >
            <Box style={{ flexDirection: "column", gap: 1 }}>
              <Text style={{ bold: true }}>new task</Text>

              <Box style={{ flexDirection: "column" }}>
                <Text style={{ dim: true }}>title</Text>
                <Input
                  value={title}
                  onChange={setTitle}
                  placeholder="what needs to be done?"
                  style={{ bg: "blackBright", paddingX: 1 }}
                  focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                />
              </Box>

              <Box style={{ flexDirection: "column" }}>
                <Text style={{ dim: true }}>description</Text>
                <Input
                  value={description}
                  onChange={setDescription}
                  placeholder="optional details..."
                  multiline
                  style={{ height: 3, bg: "blackBright", paddingX: 1 }}
                  focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                />
              </Box>

              <Box style={{ flexDirection: "row", gap: 2 }}>
                <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
                  <Text style={{ dim: true }}>priority</Text>
                  <Select
                    items={PRIORITY_ITEMS}
                    value={priority}
                    onChange={setPriority}
                    style={{ bg: "blackBright", paddingX: 1 }}
                    focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                    dropdownStyle={{ bg: "blackBright" }}
                    highlightColor="white"
                    maxVisible={4}
                  />
                </Box>
                <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
                  <Text style={{ dim: true }}>category</Text>
                  <Select
                    items={CATEGORY_ITEMS}
                    value={category}
                    onChange={setCategory}
                    style={{ bg: "blackBright", paddingX: 1 }}
                    focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                    dropdownStyle={{ bg: "blackBright" }}
                    highlightColor="white"
                    maxVisible={4}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Button
                  onPress={handleSubmit}
                  style={{ paddingX: 2 }}
                  focusedStyle={{ bg: "white", color: "black" }}
                >
                  <Text>create</Text>
                </Button>
                <Button
                  onPress={onCancel}
                  style={{ paddingX: 2 }}
                  focusedStyle={{ bg: "blackBright" }}
                >
                  <Text style={{ dim: true }}>cancel</Text>
                </Button>
              </Box>
            </Box>
          </ScrollView>

          <Keybind keypress="escape" onPress={onCancel} />
        </FocusScope>
      </Box>
    </Portal>
  );
}

// ── Task edit modal ───────────────────────────────────────────

function TaskEditModal({
  task,
  onSave,
  onCancel,
}: {
  task: Task;
  onSave: (updated: Task) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<string>(task.status);
  const [priority, setPriority] = useState<string>(task.priority);
  const [category, setCategory] = useState<string>(task.category);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    onSave({
      ...task,
      title: title.trim(),
      description: description.trim(),
      status: status as Status,
      priority: priority as Priority,
      category: category as Category,
    });
  }, [task, title, description, status, priority, category, onSave]);

  return (
    <Portal>
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <FocusScope trap>
          <ScrollView
            style={{
              width: 56,
              height: 18,
              bg: "black",
              padding: 1,
            }}
          >
            <Box style={{ flexDirection: "column", gap: 1 }}>
              <Text style={{ bold: true }}>edit task</Text>

              <Box style={{ flexDirection: "column" }}>
                <Text style={{ dim: true }}>title</Text>
                <Input
                  value={title}
                  onChange={setTitle}
                  style={{ bg: "blackBright", paddingX: 1 }}
                  focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                />
              </Box>

              <Box style={{ flexDirection: "column" }}>
                <Text style={{ dim: true }}>description</Text>
                <Input
                  value={description}
                  onChange={setDescription}
                  placeholder="no description"
                  multiline
                  style={{ height: 3, bg: "blackBright", paddingX: 1 }}
                  focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                />
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
                  <Text style={{ dim: true }}>status</Text>
                  <Select
                    items={STATUS_ITEMS}
                    value={status}
                    onChange={setStatus}
                    style={{ bg: "blackBright", paddingX: 1 }}
                    focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                    dropdownStyle={{ bg: "blackBright" }}
                    highlightColor="white"
                    maxVisible={3}
                  />
                </Box>
                <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
                  <Text style={{ dim: true }}>priority</Text>
                  <Select
                    items={PRIORITY_ITEMS}
                    value={priority}
                    onChange={setPriority}
                    style={{ bg: "blackBright", paddingX: 1 }}
                    focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                    dropdownStyle={{ bg: "blackBright" }}
                    highlightColor="white"
                    maxVisible={4}
                  />
                </Box>
                <Box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
                  <Text style={{ dim: true }}>category</Text>
                  <Select
                    items={CATEGORY_ITEMS}
                    value={category}
                    onChange={setCategory}
                    style={{ bg: "blackBright", paddingX: 1 }}
                    focusedStyle={{ bg: "white", color: "black", paddingX: 1 }}
                    dropdownStyle={{ bg: "blackBright" }}
                    highlightColor="white"
                    maxVisible={4}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Button
                  onPress={handleSave}
                  style={{ paddingX: 2 }}
                  focusedStyle={{ bg: "white", color: "black" }}
                >
                  <Text>save</Text>
                </Button>
                <Button
                  onPress={onCancel}
                  style={{ paddingX: 2 }}
                  focusedStyle={{ bg: "blackBright" }}
                >
                  <Text style={{ dim: true }}>cancel</Text>
                </Button>
              </Box>
            </Box>
          </ScrollView>

          <Keybind keypress="escape" onPress={onCancel} />
        </FocusScope>
      </Box>
    </Portal>
  );
}

// ── App ────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>(SEED);
  const [filter, setFilter] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const anyModalOpen = showNewModal || detailTask !== null;

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const handleFilterChange = useCallback((f: string) => {
    setFilter(f);
    setSelectedIndex(0);
  }, []);

  const handleCreateTask = useCallback(
    (data: Omit<Task, "id">) => {
      const id = nextId++;
      setTasks((prev) => [{ id, ...data }, ...prev]);
      setShowNewModal(false);
      toast({
        message: data.title,
        variant: "success",
        title: "created",
      });
    },
    [toast],
  );

  const handleDeleteTask = useCallback(() => {
    const task = filteredTasks[selectedIndex];
    if (!task) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setSelectedIndex((i) => Math.min(i, filteredTasks.length - 2));
    toast({
      message: task.title,
      variant: "error",
      title: "deleted",
    });
  }, [filteredTasks, selectedIndex, toast]);

  const handleCycleStatus = useCallback(() => {
    const task = filteredTasks[selectedIndex];
    if (!task) return;
    const next: Record<Status, Status> = {
      todo: "in-progress",
      "in-progress": "done",
      done: "todo",
    };
    const newStatus = next[task.status];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );
    const label =
      newStatus === "in-progress"
        ? "active"
        : newStatus === "todo"
          ? "todo"
          : "done";
    toast({
      message: `→ ${label}`,
      variant: "info",
      title: task.title,
    });
  }, [filteredTasks, selectedIndex, toast]);

  const handleUpdateTask = useCallback(
    (updated: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)),
      );
      setDetailTask(null);
      toast({
        message: updated.title,
        variant: "success",
        title: "updated",
      });
    },
    [toast],
  );

  const handleViewTask = useCallback(
    (index: number) => {
      const task = filteredTasks[index];
      if (task) setDetailTask(task);
    },
    [filteredTasks],
  );

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <Header tasks={tasks} />

      <Box
        style={{
          flexDirection: "row",
          flexGrow: 1,
          borderColor: "blackBright",
        }}
      >
        <Sidebar
          tasks={tasks}
          filter={filter}
          onFilterChange={handleFilterChange}
        />
        <Box style={{ width: 1, bg: "blackBright" }} />
        <TaskListView
          tasks={filteredTasks}
          selectedIndex={selectedIndex}
          onSelectionChange={setSelectedIndex}
          onSelect={handleViewTask}
        />
      </Box>

      <StatusBar />

      {/* Global shortcuts — disabled when a modal is open */}
      {!anyModalOpen && (
        <Box>
          <Keybind keypress="n" onPress={() => setShowNewModal(true)} />
          <Keybind keypress="s" onPress={handleCycleStatus} />
          <Keybind keypress="d" onPress={handleDeleteTask} />
        </Box>
      )}
      <Keybind keypress="q" onPress={() => exit()} />

      {/* Modals */}
      {showNewModal && (
        <NewTaskModal
          onSubmit={handleCreateTask}
          onCancel={() => setShowNewModal(false)}
        />
      )}
      {detailTask && (
        <TaskEditModal
          task={detailTask}
          onSave={handleUpdateTask}
          onCancel={() => setDetailTask(null)}
        />
      )}
    </Box>
  );
}

// ── Root ───────────────────────────────────────────────────────

function Root() {
  return (
    <ToastHost position="top-right">
      <App />
    </ToastHost>
  );
}

render(<Root />);
