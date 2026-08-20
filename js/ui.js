/* ==========================================================================
   ui.js — presentation helpers: formatting, icons, pills, toasts, modals,
   and small hand-rolled SVG charts. No charting library.
   ========================================================================== */

var UI = (function () {
  "use strict";

  /* ------------------------------------------------------------ escaping */

  /* Everything that reaches innerHTML goes through this. Guest names are
     free text, so treating them as trusted would be an injection hole. */
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ------------------------------------------------------------ formatting */

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function money(n) {
    var v = Math.round(Number(n) || 0);
    return "TZS " + v.toLocaleString("en-US");
  }
  function moneyShort(n) {
    var v = Math.round(Number(n) || 0);
    if (v >= 1000000) return "TZS " + (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1000) return "TZS " + Math.round(v / 1000) + "k";
    return "TZS " + v;
  }
  function dateLong(isoStr) {
    if (!isoStr) return "—";
    var d = Store.parseISO(String(isoStr).slice(0, 10));
    return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function dateShort(isoStr) {
    if (!isoStr) return "—";
    var d = Store.parseISO(String(isoStr).slice(0, 10));
    return d.getDate() + " " + MONTHS[d.getMonth()];
  }
  function dateTime(tsStr) {
    if (!tsStr) return "—";
    var datePart = String(tsStr).slice(0, 10);
    var timePart = String(tsStr).slice(11, 16);
    return dateShort(datePart) + (timePart ? ", " + timePart : "");
  }
  function timeOnly(tsStr) {
    return String(tsStr || "").slice(11, 16) || "—";
  }
  function relativeDay(isoStr) {
    if (!isoStr) return "—";
    var diff = Math.round((Store.parseISO(isoStr) - Store.parseISO(Store.today())) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 0) return "In " + diff + " days";
    return Math.abs(diff) + " days ago";
  }
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/);
    if (!parts[0]) return "?";
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }

  /* ------------------------------------------------------------ icons */

  var ICONS = {
    dashboard: '<path d="M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z"/>',
    rooms: '<path d="M3 21h18M5 21V6l7-3 7 3v15M10 10h.01M14 10h.01M10 14h.01M14 14h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    guests: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.85M16.5 3.6a4 4 0 0 1 0 6.8"/>',
    key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.5 12.5 8-8 3 3-2 2-2-2-1.5 1.5 2 2-2.5 2.5"/>',
    broom: '<path d="M12 3v9M8 12h8l1.5 9h-11z"/><path d="M10 16v5M14 16v5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 3L21 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    logout: '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    bed: '<path d="M2 18v-7h14a4 4 0 0 1 4 4v3M2 11V6M2 18h20"/><circle cx="7" cy="9" r="2"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    door: '<path d="M4 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="13.5" cy="12" r="1"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    empty: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 15h8"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.8 2.8 0 0 1-4-4z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8.2-8 9-4.5-.8-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };

  function icon(name, cls) {
    var path = ICONS[name] || ICONS.info;
    return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : "") + ' aria-hidden="true">' + path + "</svg>";
  }

  /* ------------------------------------------------------------ pills */

  var RES_STATUS = {
    "confirmed":   { cls: "pill-primary", label: "Confirmed" },
    "in-house":    { cls: "pill-info",    label: "In house" },
    "checked-out": { cls: "pill-neutral", label: "Checked out" },
    "cancelled":   { cls: "pill-neutral", label: "Cancelled" },
    "no-show":     { cls: "pill-danger",  label: "No show" }
  };
  var ROOM_STATUS = {
    "available":   { cls: "pill-ok",     label: "Available" },
    "occupied":    { cls: "pill-info",   label: "Occupied" },
    "dirty":       { cls: "pill-warn",   label: "Needs cleaning" },
    "maintenance": { cls: "pill-danger", label: "Out of order" }
  };
  var CARD_STATUS = {
    "active":  { cls: "pill-ok",      label: "Active" },
    "expired": { cls: "pill-neutral", label: "Expired" },
    "revoked": { cls: "pill-danger",  label: "Revoked" }
  };

  function pill(map, key) {
    var m = map[key] || { cls: "pill-neutral", label: key || "—" };
    return '<span class="pill ' + m.cls + '">' + esc(m.label) + "</span>";
  }
  function resPill(s) { return pill(RES_STATUS, s); }
  function roomPill(s) { return pill(ROOM_STATUS, s); }
  function cardPill(s) { return pill(CARD_STATUS, s); }

  function person(name, sub) {
    return '<div class="person">' +
      '<span class="av">' + esc(initials(name)) + "</span>" +
      '<span class="nm"><b>' + esc(name) + "</b>" +
      (sub ? "<span>" + esc(sub) + "</span>" : "") + "</span></div>";
  }

  /* ------------------------------------------------------------ toasts */

  function toast(kind, title, message) {
    var root = document.getElementById("toasts");
    if (!root) return;
    var iconName = kind === "ok" ? "checkCircle" : kind === "err" ? "alert" : kind === "warn" ? "alert" : "info";
    var el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = icon(iconName) +
      "<div><b>" + esc(title) + "</b>" + (message ? "<span>" + esc(message) + "</span>" : "") + "</div>";
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 3600);
  }

  /* ------------------------------------------------------------ modal */

  var modalRoot = null;
  var lastFocus = null;
  var onConfirm = null;

  function ensureRoot() {
    if (!modalRoot) modalRoot = document.getElementById("modalRoot");
    return modalRoot;
  }

  function openModal(opts) {
    var root = ensureRoot();
    if (!root) return;
    lastFocus = document.activeElement;
    onConfirm = opts.onConfirm || null;

    var footer = "";
    if (opts.actions !== false) {
      footer = '<div class="modal-foot">' +
        '<button class="btn btn-ghost" data-modal-close>' + esc(opts.cancelText || "Cancel") + "</button>" +
        (opts.confirmText
          ? '<button class="btn ' + (opts.confirmKind || "btn-primary") + '" data-modal-confirm>' +
            esc(opts.confirmText) + "</button>"
          : "") +
        "</div>";
    }

    root.innerHTML =
      '<div class="modal-bg" data-modal-close></div>' +
      '<div class="modal-card' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
        '<div class="modal-head">' +
          "<div><h2>" + esc(opts.title) + "</h2>" +
          (opts.subtitle ? "<p>" + esc(opts.subtitle) + "</p>" : "") + "</div>" +
          '<button class="icon-btn" data-modal-close aria-label="Close">' + icon("close") + "</button>" +
        "</div>" +
        '<div class="modal-body">' + (opts.body || "") + "</div>" +
        footer +
      "</div>";

    root.classList.add("open");
    document.body.style.overflow = "hidden";

    var focusTarget = root.querySelector("[data-autofocus]") || root.querySelector("input,select,textarea,button");
    if (focusTarget) focusTarget.focus();
  }

  function closeModal() {
    var root = ensureRoot();
    if (!root) return;
    root.classList.remove("open");
    root.innerHTML = "";
    document.body.style.overflow = "";
    onConfirm = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function confirmModal() {
    if (typeof onConfirm === "function") onConfirm();
  }

  /* ------------------------------------------------------------ charts */

  /* Vertical bars. `data` is [{label, value, sub}]. */
  function barChart(data, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var html = '<div class="chart-wrap"><div class="bars">';
    data.forEach(function (d) {
      var pct = Math.round((d.value / max) * 100);
      var title = d.label + ": " + (opts.format ? opts.format(d.value) : d.value);
      html += '<div class="bar-col">' +
        '<div class="bar-track">' +
          '<div class="bar' + (d.alt ? " alt" : "") + '" style="height:' + pct + '%" title="' + esc(title) + '"></div>' +
        "</div>" +
        '<span class="bar-lbl">' + esc(d.label) + "</span>" +
      "</div>";
    });
    html += "</div></div>";
    return html;
  }

  /* Horizontal stacked bar with a legend beneath. */
  function splitBar(rows) {
    var total = rows.reduce(function (s, r) { return s + r.value; }, 0) || 1;
    var bar = '<div class="split-bar">';
    rows.forEach(function (r) {
      var pct = (r.value / total) * 100;
      if (pct <= 0) return;
      bar += '<i style="width:' + pct.toFixed(2) + "%;background:" + r.color + '" title="' + esc(r.label) + '"></i>';
    });
    bar += "</div>";

    var legend = '<div class="split-legend">';
    rows.forEach(function (r) {
      legend += "<div><i style=\"background:" + r.color + '"></i><span>' + esc(r.label) + "</span>" +
        '<span class="v">' + esc(r.display !== undefined ? r.display : r.value) + "</span></div>";
    });
    legend += "</div>";
    return bar + legend;
  }

  function empty(title, message) {
    return '<div class="empty">' + icon("empty") + "<b>" + esc(title) + "</b>" +
      (message ? "<p>" + esc(message) + "</p>" : "") + "</div>";
  }

  /* ------------------------------------------------------------ exports */
  return {
    esc: esc,
    money: money, moneyShort: moneyShort,
    dateLong: dateLong, dateShort: dateShort, dateTime: dateTime,
    timeOnly: timeOnly, relativeDay: relativeDay, initials: initials,
    icon: icon, ICONS: ICONS,
    resPill: resPill, roomPill: roomPill, cardPill: cardPill,
    ROOM_STATUS: ROOM_STATUS, RES_STATUS: RES_STATUS,
    person: person,
    toast: toast,
    openModal: openModal, closeModal: closeModal, confirmModal: confirmModal,
    barChart: barChart, splitBar: splitBar, empty: empty
  };
})();
