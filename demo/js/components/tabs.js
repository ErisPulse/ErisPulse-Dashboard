// ErisPulse Dashboard – components/tabs (auto-split from dash.js)

export function switchPkgTab(tab, btn) {
  btn
    .closest(".view-toggle")
    .querySelectorAll(".view-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("pkInstalledTab").style.display =
    tab === "pk-installed" ? "block" : "none";
  document.getElementById("pkUpdatesTab").style.display =
    tab === "pk-updates" ? "block" : "none";
  document.getElementById("pkInstallNewTab").style.display =
    tab === "pk-install-new" ? "block" : "none";
  document.getElementById("pkGitTab").style.display =
    tab === "pk-git" ? "block" : "none";
  document.getElementById("pkUploadTab").style.display =
    tab === "pk-upload" ? "block" : "none";
  if (tab === "pk-updates") loadPackageUpdates();
}

export function switchMergeTab(tabPrefix, btn, onSwitch) {
  // 找到最近的 tab bar
  var bar = btn.closest(".view-toggle");
  if (bar) {
    bar.querySelectorAll(".view-btn").forEach(function (b) {
      b.classList.remove("active");
    });
  }
  btn.classList.add("active");
  // 隐藏同组所有 tab section，显示目标
  var section = document.getElementById(tabPrefix + "-tab");
  if (section) {
    var parent = section.parentElement;
    parent.querySelectorAll(".tab-section").forEach(function (s) {
      s.style.display = "none";
    });
    section.style.display = "block";
  }
  if (onSwitch) onSwitch();
}

export function switchConfigTab(tab, btn) {
  var loaders = {
    "cfg-editor": loadConfig,
    "cfg-framework": loadFrameworkConfig,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

export function switchEventTab(tab, btn) {
  var loaders = {
    "ev-stream": loadEvents,
    "ev-builder": initEventBuilder,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

export function switchStoreTab(tab, btn) {
  var loaders = {
    "st-browse": loadStore,
    "st-packages": function () {
      loadPackages();
      loadPackageUpdates();
    },
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

export function switchMonitorTab(tab, btn) {
  var loaders = {
    "mon-logs": loadLogs,
    "mon-lifecycle": loadLifecycle,
    "mon-audit": loadAuditLog,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

export function switchModuleMgmtTab(tab, btn) {
  switchMergeTab(tab, btn, null);
}

export function switchExtConfigTab(tab, btn) {
  var loaders = {
    "cfg-adapter": loadAdapterConfigPage,
    "cfg-module": loadModuleConfigPage,
  };
  switchMergeTab(tab, btn, loaders[tab]);
}

