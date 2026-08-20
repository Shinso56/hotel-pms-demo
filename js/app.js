/* ==========================================================================
   app.js — routing, rendering, and all event handling.
   Interaction uses a single delegated click listener keyed on data-action,
   so re-rendering a view never leaves stale listeners behind.
   ========================================================================== */

(function () {
  "use strict";

  var VIEWS = {
    dashboard:    { title: "Dashboard",        sub: "Today at a glance",                     render: function () { return Views.dashboard(); } },
    rooms:        { title: "Rooms",            sub: "Live status of every room",             render: function () { return Views.rooms(); } },
    reservations: { title: "Reservations",     sub: "Bookings, check-in and check-out",      render: function () { return Views.reservations(); } },
    guests:       { title: "Guests",           sub: "Directory and stay history",            render: function () { return Views.guests(); } },
    access:       { title: "Key cards & access", sub: "Credentials and the door audit trail", render: function () { return Views.access(); } },
    housekeeping: { title: "Housekeeping",     sub: "Cleaning queue and floor board",        render: function () { return Views.housekeeping(); } },
    reports:      { title: "Reports",          sub: "Occupancy, ADR and RevPAR",             render: function () { return Views.reports(); } }
  };

  var current = "dashboard";
  var contentEl, titleEl, subEl;

  /* ------------------------------------------------------------ routing */

  function viewFromHash() {
    var h = (location.hash || "").replace(/^#\/?/, "");
    return VIEWS[h] ? h : "dashboard";
  }

  function go(view) {
    if (!VIEWS[view]) view = "dashboard";
    current = view;
    if (location.hash !== "#/" + view) {
      location.hash = "#/" + view;
      return; /* hashchange will call render() */
    }
    render();
  }

  function render() {
    var v = VIEWS[current];
    titleEl.textContent = v.title;
    subEl.textContent = v.sub;
    contentEl.innerHTML = v.render();
    contentEl.scrollTop = 0;
    window.scrollTo(0, 0);
    paintNav();
  }

  function paintNav() {
    var counts = {
      reservations: Store.arrivalsToday().length,
      housekeeping: Store.statusCounts().dirty,
      access: Store.accessAnomalies().length
    };
    Array.prototype.forEach.call(document.querySelectorAll(".nav-item"), function (el) {
      var view = el.getAttribute("data-nav");
      el.classList.toggle("active", view === current);
      var badge = el.querySelector(".count");
      var n = counts[view];
      if (badge) {
        if (n) { badge.textContent = n; badge.style.display = ""; }
        else { badge.style.display = "none"; }
      }
    });
  }

  /* ------------------------------------------------------------ sidebar */

  function toggleSidebar(open) {
    var sb = document.querySelector(".sidebar");
    var scrim = document.querySelector(".scrim");
    var show = open === undefined ? !sb.classList.contains("open") : open;
    sb.classList.toggle("open", show);
    if (scrim) scrim.classList.toggle("on", show);
  }

  /* ------------------------------------------------------------ actions */

  function doCheckIn(resId) {
    var res = Store.reservationById(resId);
    if (!res) return;
    var room = Store.roomById(res.roomId);

    UI.openModal({
      title: "Check in " + res.guestName,
      subtitle: res.code + " · Room " + (room ? room.number : "—"),
      body:
        '<div class="summary-box"><dl class="detail-list">' +
          detailRow("Room", room ? UI.esc(room.number) + " · " + UI.esc(Store.ROOM_TYPES[room.type].label) : "—") +
          detailRow("Room status", room ? UI.roomPill(room.status) : "—") +
          detailRow("Staying", UI.dateLong(res.checkIn) + " &rarr; " + UI.dateLong(res.checkOut)) +
          detailRow("Nights", String(Store.nightsBetween(res.checkIn, res.checkOut))) +
          detailRow("Rate", '<span class="num">' + UI.money(res.rate) + "</span> / night") +
          detailRow("Room charges", '<span class="num">' +
            UI.money(res.rate * Store.nightsBetween(res.checkIn, res.checkOut)) + "</span>") +
        "</dl></div>" +
        '<div class="alert alert-info" style="margin-top:14px">' + UI.icon("key") +
          "<div><b>A key card will be encoded</b><p>The card is bound to lock " +
          UI.esc(room ? room.lockId : "—") + " and expires at check-out, 11:00 on " +
          UI.esc(UI.dateLong(res.checkOut)) + ".</p></div></div>",
      confirmText: "Check in & encode card",
      onConfirm: function () {
        var result = Store.checkIn(resId);
        UI.closeModal();
        if (!result.ok) {
          UI.toast("err", "Check-in blocked", result.error);
          return;
        }
        UI.toast("ok", "Checked in", res.guestName + " is now in room " + result.room.number + ".");
        showCardIssued(result.card, result.room);
        render();
      }
    });
  }

  function showCardIssued(card, room) {
    if (!card) return;
    setTimeout(function () {
      UI.openModal({
        title: "Key card encoded",
        subtitle: "Room " + room.number + " · lock " + room.lockId,
        body:
          '<div class="summary-box"><dl class="detail-list">' +
            detailRow("Card UID", '<span class="code">' + UI.esc(card.cardNumber) + "</span>") +
            detailRow("Holder", UI.esc(card.holder)) +
            detailRow("Lock", '<span class="code">' + UI.esc(card.lockId) + "</span>") +
            detailRow("Valid until", UI.dateTime(card.expiresAt)) +
            detailRow("Status", UI.cardPill(card.status)) +
          "</dl></div>" +
          '<p class="dim" style="font-size:.76rem;margin-top:12px">Every encode and every door read is written to the audit log.</p>',
        confirmText: "Open audit log",
        cancelText: "Done",
        onConfirm: function () { UI.closeModal(); go("access"); }
      });
    }, 180);
  }

  function doCheckOut(resId) {
    var res = Store.reservationById(resId);
    if (!res) return;
    var room = Store.roomById(res.roomId);
    var total = Store.folioTotal(res);

    var folio = "";
    (res.folio || []).forEach(function (i) {
      folio += '<div class="folio-row"><span class="fd">' + UI.esc(UI.dateShort(i.date)) +
        " &middot; " + UI.esc(i.desc) + '</span><span class="num">' + UI.esc(UI.money(i.amount)) + "</span></div>";
    });

    UI.openModal({
      title: "Check out " + res.guestName,
      subtitle: res.code + " · Room " + (room ? room.number : "—"),
      body:
        '<div class="summary-box">' + (folio || '<p class="dim">No charges posted.</p>') +
          '<div class="folio-total"><span>Balance due</span><span class="num">' + UI.esc(UI.money(total)) + "</span></div>" +
        "</div>" +
        '<div class="alert alert-warn" style="margin-top:14px">' + UI.icon("key") +
          "<div><b>Key card will be expired</b><p>The guest credential for lock " +
          UI.esc(room ? room.lockId : "—") + " stops working immediately, and room " +
          UI.esc(room ? room.number : "—") + " moves to the cleaning queue.</p></div></div>",
      confirmText: "Settle & check out",
      onConfirm: function () {
        var result = Store.checkOut(resId);
        UI.closeModal();
        if (!result.ok) {
          UI.toast("err", "Check-out failed", result.error);
          return;
        }
        UI.toast("ok", "Checked out", UI.money(result.total) + " settled. Room " + result.room.number + " sent to housekeeping.");
        render();
      }
    });
  }

  function doNewReservation() {
    UI.openModal({
      title: "New booking",
      subtitle: "Rooms out of order are not offered",
      wide: true,
      body: Views.newReservationForm(),
      confirmText: "Create booking",
      onConfirm: function () {
        var form = document.getElementById("resForm");
        if (!form) return;
        var data = {
          guestName: form.guestName.value,
          phone: form.phone.value,
          email: form.email.value,
          roomId: form.roomId.value,
          source: form.source.value,
          checkIn: form.checkIn.value,
          checkOut: form.checkOut.value,
          adults: form.adults.value,
          children: form.children.value,
          notes: form.notes.value
        };
        var result = Store.createReservation(data);
        if (!result.ok) {
          var box = document.getElementById("resFormError");
          if (box) {
            box.style.display = "";
            box.querySelector("p").textContent = result.error;
          }
          return;
        }
        UI.closeModal();
        UI.toast("ok", "Booking created", result.reservation.code + " for " + result.reservation.guestName + ".");
        go("reservations");
      }
    });
  }

  function doAddCharge(resId) {
    UI.openModal({
      title: "Post a charge",
      subtitle: "Adds a line to the guest folio",
      body: Views.addChargeForm(),
      confirmText: "Post charge",
      onConfirm: function () {
        var form = document.getElementById("chargeForm");
        if (!form) return;
        var desc = form.desc.value.trim();
        var amount = Number(form.amount.value);
        if (!desc || !(amount > 0)) {
          UI.toast("warn", "Check the details", "Enter a description and an amount above zero.");
          return;
        }
        Store.addFolioItem(resId, desc, amount);
        UI.closeModal();
        UI.toast("ok", "Charge posted", desc + " — " + UI.money(amount));
        render();
      }
    });
  }

  function openRoom(roomId) {
    var room = Store.roomById(roomId);
    if (!room) return;
    UI.openModal({
      title: "Room " + room.number,
      subtitle: Store.ROOM_TYPES[room.type].label + " · floor " + room.floor,
      body: Views.roomDetailBody(roomId),
      actions: false
    });
  }

  function openReservation(resId) {
    var res = Store.reservationById(resId);
    if (!res) return;
    UI.openModal({
      title: res.guestName,
      subtitle: res.code,
      wide: true,
      body: Views.reservationDetailBody(resId),
      actions: false
    });
  }

  function openGuest(guestId) {
    var g = Store.guestById(guestId);
    if (!g) return;
    UI.openModal({
      title: g.name,
      subtitle: g.nationality,
      wide: true,
      body: Views.guestDetailBody(guestId),
      actions: false
    });
  }

  function doReset() {
    UI.openModal({
      title: "Reset demo data",
      subtitle: "Restores the sample property to its starting state",
      body: '<p>Every booking, key card and door event you have created will be discarded and the ' +
            'original sample data regenerated for today&rsquo;s date.</p>',
      confirmText: "Reset data",
      confirmKind: "btn-danger",
      onConfirm: function () {
        Store.reset();
        UI.closeModal();
        UI.toast("ok", "Demo data reset", "The property is back to its starting state.");
        go("dashboard");
      }
    });
  }

  function detailRow(label, value) {
    return '<div class="detail-row"><dt>' + label + "</dt><dd>" + value + "</dd></div>";
  }

  /* ------------------------------------------------------------ events */

  function onClick(ev) {
    var t = ev.target;
    /* Clicks can land on text or SVG nodes, which have no closest(). */
    if (!t || typeof t.closest !== "function") return;

    /* modal chrome */
    if (t.closest("[data-modal-close]")) { UI.closeModal(); return; }
    if (t.closest("[data-modal-confirm]")) { UI.confirmModal(); return; }

    /* segmented controls */
    var seg = t.closest("[data-seg] button");
    if (seg) {
      var segKey = seg.parentNode.getAttribute("data-seg");
      var val = seg.getAttribute("data-value");
      Views.filters[segKey] = segKey === "reportDays" ? Number(val) : val;
      render();
      return;
    }

    /* navigation */
    var nav = t.closest("[data-nav]");
    if (nav) {
      ev.preventDefault();
      go(nav.getAttribute("data-nav"));
      if (window.innerWidth <= 900) toggleSidebar(false);
      return;
    }

    /* everything else */
    var el = t.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");
    var value = el.getAttribute("data-value");

    switch (action) {
      case "check-in":          doCheckIn(id); break;
      case "check-out":         doCheckOut(id); break;
      case "new-reservation":   doNewReservation(); break;
      case "add-charge":        UI.closeModal(); doAddCharge(id); break;
      case "room-detail":       openRoom(id); break;
      case "reservation-detail": openReservation(id); break;
      case "guest-detail":      openGuest(id); break;

      case "room-status": {
        var ok = Store.setRoomStatus(id, value);
        var room = Store.roomById(id);
        if (!ok) {
          UI.toast("warn", "Cannot change status", "Check the guest out before freeing the room.");
        } else {
          UI.toast("ok", "Room " + room.number + " updated", UI.ROOM_STATUS[value].label + ".");
        }
        UI.closeModal();
        render();
        break;
      }

      case "revoke-card": {
        var card = Store.cardById(id);
        if (Store.revokeCard(id)) {
          Store.logDoorEvent(card.roomId, card, "denied", "Credential revoked by front office");
          UI.toast("ok", "Card revoked", card.cardNumber + " will no longer open the door.");
        } else {
          UI.toast("warn", "Nothing to revoke", "That card is not active.");
        }
        render();
        break;
      }

      case "reissue-card": {
        var newCard = Store.issueCard(id, "guest");
        UI.closeModal();
        if (newCard) {
          var r = Store.roomById(newCard.roomId);
          UI.toast("ok", "New card encoded", newCard.cardNumber + " for room " + r.number + ".");
          Store.logDoorEvent(newCard.roomId, newCard, "granted", "Replacement card encoded");
        }
        render();
        break;
      }

      case "cancel-reservation": {
        if (Store.cancelReservation(id)) {
          UI.toast("ok", "Booking cancelled", "The room has been released.");
        } else {
          UI.toast("warn", "Cannot cancel", "Only confirmed bookings can be cancelled.");
        }
        UI.closeModal();
        render();
        break;
      }

      case "resync-lock": {
        Store.resyncLock(id);
        var rr = Store.roomById(id);
        UI.closeModal();
        UI.toast("ok", "Lock re-synced", "Clock on " + rr.lockId + " matches the server again.");
        render();
        break;
      }

      case "reset-demo": doReset(); break;
      default: break;
    }
  }

  /* Filters: selects and search boxes both write into Views.filters.
     Search re-renders on a short debounce so typing stays smooth. */
  var searchTimer = null;
  function onFilterChange(ev) {
    if (!ev.target || typeof ev.target.closest !== "function") return;
    var el = ev.target.closest("[data-filter]");
    if (!el) return;
    var key = el.getAttribute("data-filter");
    Views.filters[key] = el.value;

    if (el.type === "search" || el.type === "text") {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        render();
        /* Put the cursor back where it was — re-rendering replaces the node. */
        var again = document.querySelector('[data-filter="' + key + '"]');
        if (again) {
          again.focus();
          var v = again.value;
          again.value = "";
          again.value = v;
        }
      }, 260);
    } else {
      render();
    }
  }

  function onKeydown(ev) {
    if (ev.key === "Escape") {
      var root = document.getElementById("modalRoot");
      if (root && root.classList.contains("open")) { UI.closeModal(); return; }
      if (window.innerWidth <= 900) toggleSidebar(false);
    }
  }

  /* ------------------------------------------------------------ theme */

  /* With no explicit choice stamped, the page is following the OS preference,
     so read that rather than the (absent) attribute — otherwise the first
     click appears to do nothing for a viewer whose system is already dark. */
  function effectiveTheme() {
    var stamped = document.documentElement.getAttribute("data-theme");
    if (stamped) return stamped;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark" : "light";
  }

  function toggleTheme() {
    var next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pms-theme", next); } catch (e) {}
  }

  /* ------------------------------------------------------------ init */

  function init() {
    contentEl = document.getElementById("view");
    titleEl = document.getElementById("pageTitle");
    subEl = document.getElementById("pageSub");

    Store.load();

    var hotel = Store.hotel();
    document.getElementById("hotelName").textContent = hotel.name;
    document.getElementById("hotelCity").textContent = hotel.city;
    document.getElementById("clock").textContent = UI.dateLong(Store.today());

    document.addEventListener("click", onClick);
    document.addEventListener("change", onFilterChange);
    document.addEventListener("input", onFilterChange);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("hashchange", function () { current = viewFromHash(); render(); });

    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    document.getElementById("menuBtn").addEventListener("click", function () { toggleSidebar(); });
    var scrim = document.querySelector(".scrim");
    if (scrim) scrim.addEventListener("click", function () { toggleSidebar(false); });

    current = viewFromHash();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
