// ErisPulse Dashboard – components/tasks (auto-split from dash.js)

export function addOrUpdateTask(id, name, status, outputLines, errorMsg) {
  let task = _tasks.find((t) => t.id === id);
  if (!task) {
    task = {
      id,
      name,
      status,
      output: [],
      startedAt: Date.now(),
      errorMsg: "",
    };
    _tasks.unshift(task);
  }
  task.status = status;
  task.output = outputLines || task.output;
  if (errorMsg) task.errorMsg = errorMsg;
  renderTaskPanel();
  renderTaskBadge();
}

export function removeTask(id) {
  _tasks = _tasks.filter((t) => t.id !== id);
  _expandedTasks.delete(id);
  renderTaskPanel();
  renderTaskBadge();
}

export function toggleTaskPanel() {
  _taskPanelOpen = !_taskPanelOpen;
  document.getElementById("taskPanel").classList.toggle("open", _taskPanelOpen);
  renderTaskPanel();
}

export function closeTaskPanel() {
  _taskPanelOpen = false;
  document.getElementById("taskPanel").classList.remove("open");
}

document.addEventListener("click", function (e) {
  if (!_taskPanelOpen) return;
  var panel = document.getElementById("taskPanel");
  var badge = document.getElementById("taskBadge");
  if (panel && !panel.contains(e.target) && badge && !badge.contains(e.target)) {
    closeTaskPanel();
  }
});;

export function clearAllTasks() {
  var removedIds = _tasks
    .filter((t) => t.status !== "running")
    .map((t) => t.id);
  removedIds.forEach(function (id) {
    _expandedTasks.delete(id);
  });
  _tasks = _tasks.filter((t) => t.status === "running");
  renderTaskPanel();
  renderTaskBadge();
}

export function renderTaskBadge() {
  const badge = document.getElementById("taskBadge");
  const count = _tasks.length;
  const hasRunning = _tasks.some((t) => t.status === "running");
  document.getElementById("taskCount").textContent = count;
  if (count > 0) {
    badge.style.display = "";
    badge.classList.toggle("pulse", hasRunning);
  } else {
    badge.style.display = "none";
    badge.classList.remove("pulse");
    _taskPanelOpen = false;
    document.getElementById("taskPanel").classList.remove("open");
  }
}

export function renderTaskPanel() {
  if (!_taskPanelOpen) return;
  var container = document.getElementById("taskList");

  var items = container.querySelectorAll(".task-item.task-expanded");
  _expandedTasks.clear();
  items.forEach(function (item) {
    if (item.dataset.taskId) _expandedTasks.add(item.dataset.taskId);
  });

  if (_tasks.length === 0) {
    container.innerHTML = '<div class="task-empty">' + t("no_data") + "</div>";
    return;
  }
  container.innerHTML = _tasks
    .map((t) => {
      let statusIcon = "";
      let statusClass = "";
      if (t.status === "running") {
        statusIcon =
          '<svg class="task-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>';
        statusClass = "task-running";
      } else if (t.status === "success") {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        statusClass = "task-success";
      } else {
        statusIcon =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        statusClass = "task-error";
      }
      var output = (t.output || []).slice(-20).join("\n");
      var detail = t.status === "error" && t.errorMsg ? "\n" + t.errorMsg : "";
      var expanded = _expandedTasks.has(t.id) ? " task-expanded" : "";
      return (
        '<div class="task-item ' +
        statusClass +
        expanded +
        '" data-task-id="' +
        esc(t.id) +
        '" onclick="toggleTaskExpand(this)">' +
        '<div class="task-item-hd">' +
        '<span class="task-icon">' +
        statusIcon +
        "</span>" +
        '<span class="task-name">' +
        esc(t.name) +
        "</span>" +
        '<span class="task-time">' +
        new Date(t.startedAt).toLocaleTimeString(getLocale()) +
        "</span>" +
        '<button class="btn-icon" onclick="event.stopPropagation();removeTask(\'' +
        esc(t.id) +
        '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        "</div>" +
        '<pre class="task-output">' +
        esc(output + detail) +
        "</pre>" +
        "</div>"
      );
    })
    .join("");
}

export function toggleTaskExpand(el) {
  el.classList.toggle("task-expanded");
  var taskId = el.dataset.taskId;
  if (!taskId) return;
  if (el.classList.contains("task-expanded")) {
    _expandedTasks.add(taskId);
  } else {
    _expandedTasks.delete(taskId);
  }
}

setInterval(function () {
  // 原自动清理逻辑
  // const now = Date.now();
  // const before = _tasks.length;
  // var removed = _tasks.filter(t => t.status !== 'running' && now - t.startedAt >= 30000);
  // removed.forEach(function(t) { _expandedTasks.delete(t.id) });
  // _tasks = _tasks.filter(t => t.status === 'running' || now - t.startedAt < 30000);
  // if (_tasks.length !== before) renderTaskBadge();
  if (_taskPanelOpen) renderTaskPanel();
}, 5000);;

