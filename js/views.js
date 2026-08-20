/* ==========================================================================
   views.js — one render function per screen. Each returns an HTML string
   that app.js drops into the content area; interaction is handled by
   delegated listeners in app.js keyed on data-action attributes.
   ========================================================================== */

var Views = (function () {
  "use strict";

  var esc = UI.esc, icon = UI.icon, money = UI.money;

  /* Filter state persists while the user moves between screens. */
  var filters = {
    roomStatus: "all",
    roomFloor: "all",
    resStatus: "all",
    resSearch: "",
    guestSearch: "",
    cardStatus: "all",
    doorResult: "all",
    doorSearch: "",
    reportDays: 14
  };

  function kpi(o) {
    return '<div class="kpi">' +
      '<div class="kpi-top">' +
        '<span class="kpi-ico c-' + o.tone + '">' + icon(o.icon) + "</span>" +
        '<span class="kpi-label">' + esc(o.label) + "</span>" +
      "</div>" +
      '<div class="kpi-value num">' + o.value + "</div>" +
      (o.foot ? '<div class="kpi-foot">' + o.foot + "</div>" : "") +
      (o.meter !== undefined ? '<div class="meter"><i style="width:' + o.meter + '%"></i></div>' : "") +
      "</div>";
  }

  /* ==================================================================== */
  /* Dashboard                                                            */
  /* ==================================================================== */

  function dashboard() {
    var k = Store.kpis();
    var arrivals = Store.arrivalsToday();
    var departures = Store.departuresToday();
    var counts = Store.statusCounts();
    var anomalies = Store.accessAnomalies();
    var series = Store.occupancySeries(14);

    var html = '<div class="kpi-grid">' +
      kpi({ tone: "primary", icon: "chart", label: "Occupancy", value: k.occupancy + '<small>%</small>',
            foot: k.occupied + " of " + k.totalRooms + " rooms", meter: k.occupancy }) +
      kpi({ tone: "ok", icon: "login", label: "Arrivals today", value: k.arrivals,
            foot: k.arrivals ? "Awaiting check-in" : "All arrivals handled" }) +
      kpi({ tone: "info", icon: "logout", label: "Departures today", value: k.departures,
            foot: k.departures ? "Due out by 11:00" : "All departures settled" }) +
      kpi({ tone: "primary", icon: "guests", label: "Guests in house", value: k.guestsInHouse,
            foot: k.inHouse + " active reservations" }) +
      kpi({ tone: "ok", icon: "money", label: "Room revenue today", value: UI.moneyShort(k.revenueToday),
            foot: "Excludes extras and F&amp;B" }) +
      "</div>";

    /* --- arrivals / departures --- */
    html += '<div class="grid-2">';

    html += '<div class="panel"><div class="panel-head">' +
      "<h2>Arrivals today</h2>" +
      '<span class="sub">' + arrivals.length + " expected</span>" +
      "</div>";
    if (!arrivals.length) {
      html += UI.empty("No arrivals left", "Every booking due in today has been checked in.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Guest</th><th>Room</th><th>Nights</th><th></th></tr></thead><tbody>";
      arrivals.forEach(function (r) {
        var room = Store.roomById(r.roomId);
        html += "<tr>" +
          "<td>" + UI.person(r.guestName, r.code) + "</td>" +
          '<td class="strong">' + esc(room ? room.number : "—") + "</td>" +
          "<td>" + Store.nightsBetween(r.checkIn, r.checkOut) + "</td>" +
          '<td class="actions"><button class="btn btn-soft btn-sm" data-action="check-in" data-id="' + r.id + '">' +
            icon("login") + "Check in</button></td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
    }
    html += "</div>";

    html += '<div class="panel"><div class="panel-head">' +
      "<h2>Departures today</h2>" +
      '<span class="sub">' + departures.length + " due out</span>" +
      "</div>";
    if (!departures.length) {
      html += UI.empty("No departures", "Nobody is due to check out today.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Guest</th><th>Room</th><th>Folio</th><th></th></tr></thead><tbody>";
      departures.forEach(function (r) {
        var room = Store.roomById(r.roomId);
        html += "<tr>" +
          "<td>" + UI.person(r.guestName, r.code) + "</td>" +
          '<td class="strong">' + esc(room ? room.number : "—") + "</td>" +
          '<td class="num">' + esc(UI.moneyShort(Store.folioTotal(r))) + "</td>" +
          '<td class="actions"><button class="btn btn-ghost btn-sm" data-action="check-out" data-id="' + r.id + '">' +
            icon("logout") + "Check out</button></td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
    }
    html += "</div></div>";

    /* --- occupancy trend + room status --- */
    html += '<div class="grid-wide" style="margin-top:16px">';

    html += '<div class="panel"><div class="panel-head"><h2>Occupancy, last 14 days</h2>' +
      '<span class="sub">Average ' + Store.performance(14).avgOccupancy + "%</span></div>" +
      '<div class="panel-body">' +
      UI.barChart(series.map(function (d) {
        return { label: UI.dateShort(d.date).split(" ")[0], value: d.rate };
      }), { format: function (v) { return v + "%"; } }) +
      "</div></div>";

    html += '<div class="panel"><div class="panel-head"><h2>Room status</h2></div><div class="panel-body">' +
      UI.splitBar([
        { label: "Available", value: counts.available, color: "var(--ok)", display: counts.available },
        { label: "Occupied", value: counts.occupied, color: "var(--info)", display: counts.occupied },
        { label: "Needs cleaning", value: counts.dirty, color: "var(--warn)", display: counts.dirty },
        { label: "Out of order", value: counts.maintenance, color: "var(--danger)", display: counts.maintenance }
      ]) + "</div></div>";

    html += "</div>";

    /* --- access alerts --- */
    html += '<div class="panel" style="margin-top:16px"><div class="panel-head">' +
      "<h2>Access control alerts</h2>" +
      '<span class="sub">From the door audit log</span>' +
      '<button class="btn btn-ghost btn-sm" data-nav="access">Open audit log</button>' +
      "</div>";
    if (!anomalies.length) {
      html += UI.empty("Nothing flagged", "No unusual door activity in the current log.");
    } else {
      html += '<div class="panel-body"><div class="stack">';
      anomalies.slice(0, 4).forEach(function (a) {
        html += '<div class="alert alert-' + (a.severity === "high" ? "danger" : "warn") + '">' +
          icon("alert") + "<div><b>" + esc(a.title) + "</b><p>" + esc(a.detail) + "</p></div></div>";
      });
      html += "</div></div>";
    }
    html += "</div>";

    return html;
  }

  /* ==================================================================== */
  /* Rooms                                                                */
  /* ==================================================================== */

  function rooms() {
    var all = Store.rooms();
    var list = all.filter(function (r) {
      if (filters.roomStatus !== "all" && r.status !== filters.roomStatus) return false;
      if (filters.roomFloor !== "all" && String(r.floor) !== filters.roomFloor) return false;
      return true;
    });

    var floors = {};
    all.forEach(function (r) { floors[r.floor] = true; });

    var html = '<div class="panel"><div class="panel-head">' +
      "<h2>Rooms</h2>" +
      '<span class="sub">' + list.length + " of " + all.length + "</span>" +
      '<div class="filters" style="margin-left:auto">' +
        '<select class="select auto" data-filter="roomStatus">' +
          option("all", "All statuses", filters.roomStatus) +
          option("available", "Available", filters.roomStatus) +
          option("occupied", "Occupied", filters.roomStatus) +
          option("dirty", "Needs cleaning", filters.roomStatus) +
          option("maintenance", "Out of order", filters.roomStatus) +
        "</select>" +
        '<select class="select auto" data-filter="roomFloor">' +
          option("all", "All floors", filters.roomFloor) +
          Object.keys(floors).map(function (f) {
            return option(f, "Floor " + f, filters.roomFloor);
          }).join("") +
        "</select>" +
      "</div></div>";

    html += '<div class="panel-body">' +
      '<div class="legend" style="margin-bottom:14px">' +
        '<span><i class="lg-available"></i>Available</span>' +
        '<span><i class="lg-occupied"></i>Occupied</span>' +
        '<span><i class="lg-dirty"></i>Needs cleaning</span>' +
        '<span><i class="lg-maintenance"></i>Out of order</span>' +
      "</div>";

    if (!list.length) {
      html += UI.empty("No rooms match", "Try a different status or floor.");
    } else {
      html += '<div class="room-grid">';
      list.forEach(function (r) {
        var res = Store.reservationForRoom(r.id);
        var type = Store.ROOM_TYPES[r.type];
        html += '<button class="room-card" data-status="' + r.status + '" data-action="room-detail" data-id="' + r.id + '">' +
          '<div class="rc-top"><span class="rc-no num">' + esc(r.number) + "</span>" +
          '<span class="rc-type">' + esc(type.label) + "</span></div>" +
          '<div class="rc-guest">' + (res ? "<b>" + esc(res.guestName) + "</b>" : '<span class="dim">Vacant</span>') + "</div>" +
          '<div class="rc-foot">' + UI.roomPill(r.status) +
          '<span class="rc-rate num">' + esc(UI.moneyShort(r.rate)) + "</span></div>" +
          "</button>";
      });
      html += "</div>";
    }
    html += "</div></div>";
    return html;
  }

  function roomDetailBody(roomId) {
    var room = Store.roomById(roomId);
    if (!room) return UI.empty("Room not found");
    var type = Store.ROOM_TYPES[room.type];
    var res = Store.reservationForRoom(room.id);
    var card = Store.activeCardFor(room.id);
    var recent = Store.doorEvents().filter(function (e) { return e.roomId === room.id; }).slice(0, 6);

    var html = '<dl class="detail-list">' +
      row("Status", UI.roomPill(room.status)) +
      row("Room type", esc(type.label) + " &middot; " + esc(type.beds)) +
      row("Floor", esc(String(room.floor))) +
      row("Rack rate", '<span class="num">' + esc(money(room.rate)) + "</span> / night") +
      row("Max occupancy", esc(String(type.cap)) + " guests") +
      row("Door lock", '<span class="code">' + esc(room.lockId) + "</span>") +
      row("Clock drift", room.clockDriftSec > 60
        ? '<span class="pill pill-warn">' + Math.round(room.clockDriftSec / 60) + " min ahead</span>"
        : '<span class="pill pill-ok">In sync</span>') +
      "</dl>";

    if (res) {
      html += '<h3 style="margin:18px 0 10px;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Current guest</h3>' +
        '<div class="summary-box"><dl class="detail-list">' +
        row("Guest", esc(res.guestName)) +
        row("Reservation", '<span class="code">' + esc(res.code) + "</span>") +
        row("Staying", UI.dateShort(res.checkIn) + " &rarr; " + UI.dateShort(res.checkOut)) +
        row("Folio balance", '<span class="num">' + esc(money(Store.folioTotal(res))) + "</span>") +
        row("Key card", card ? '<span class="code">' + esc(card.cardNumber) + "</span>" : '<span class="dim">None issued</span>') +
        "</dl></div>";
    }

    if (recent.length) {
      html += '<h3 style="margin:18px 0 10px;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">Recent door activity</h3>' +
        '<div class="panel"><div class="event-list">';
      recent.forEach(function (e) { html += eventRow(e); });
      html += "</div></div>";
    }

    html += '<div class="btn-row" style="margin-top:18px">';
    if (room.status === "dirty") {
      html += '<button class="btn btn-soft btn-sm" data-action="room-status" data-id="' + room.id + '" data-value="available">' + icon("check") + "Mark cleaned</button>";
    }
    if (room.status === "available") {
      html += '<button class="btn btn-ghost btn-sm" data-action="room-status" data-id="' + room.id + '" data-value="dirty">' + icon("broom") + "Flag for cleaning</button>";
    }
    if (room.status !== "occupied" && room.status !== "maintenance") {
      html += '<button class="btn btn-danger btn-sm" data-action="room-status" data-id="' + room.id + '" data-value="maintenance">' + icon("wrench") + "Take out of order</button>";
    }
    if (room.status === "maintenance") {
      html += '<button class="btn btn-soft btn-sm" data-action="room-status" data-id="' + room.id + '" data-value="available">' + icon("check") + "Return to service</button>";
    }
    if (room.clockDriftSec > 60) {
      html += '<button class="btn btn-ghost btn-sm" data-action="resync-lock" data-id="' + room.id + '">' + icon("refresh") + "Re-sync lock clock</button>";
    }
    if (res) {
      html += '<button class="btn btn-ghost btn-sm" data-action="check-out" data-id="' + res.id + '">' + icon("logout") + "Check out guest</button>";
    }
    html += "</div>";

    return html;
  }

  /* ==================================================================== */
  /* Reservations                                                         */
  /* ==================================================================== */

  function reservations() {
    var all = Store.reservations();
    var q = filters.resSearch.toLowerCase().trim();

    var list = all.filter(function (r) {
      if (filters.resStatus !== "all" && r.status !== filters.resStatus) return false;
      if (!q) return true;
      var room = Store.roomById(r.roomId);
      return r.guestName.toLowerCase().indexOf(q) > -1 ||
             r.code.toLowerCase().indexOf(q) > -1 ||
             (room && room.number.indexOf(q) > -1);
    }).sort(function (a, b) { return a.checkIn < b.checkIn ? 1 : -1; });

    var html = '<div class="panel"><div class="panel-head">' +
      "<h2>Reservations</h2>" +
      '<span class="sub">' + list.length + " of " + all.length + "</span>" +
      '<div class="filters" style="margin-left:auto">' +
        '<div class="search">' + icon("search") +
          '<input class="input" type="search" placeholder="Guest, code or room" data-filter="resSearch" value="' + esc(filters.resSearch) + '">' +
        "</div>" +
        '<select class="select auto" data-filter="resStatus">' +
          option("all", "All statuses", filters.resStatus) +
          option("confirmed", "Confirmed", filters.resStatus) +
          option("in-house", "In house", filters.resStatus) +
          option("checked-out", "Checked out", filters.resStatus) +
          option("cancelled", "Cancelled", filters.resStatus) +
          option("no-show", "No show", filters.resStatus) +
        "</select>" +
        '<button class="btn btn-primary btn-sm" data-action="new-reservation">' + icon("plus") + "New booking</button>" +
      "</div></div>";

    if (!list.length) {
      html += UI.empty("No reservations match", "Adjust the search or status filter.");
    } else {
      var CAP = 100;
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Guest</th><th>Code</th><th>Room</th><th>Check-in</th><th>Check-out</th>" +
        "<th>Nights</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>";
      list.slice(0, CAP).forEach(function (r) {
        var room = Store.roomById(r.roomId);
        html += '<tr data-action="reservation-detail" data-id="' + r.id + '" style="cursor:pointer">' +
          "<td>" + UI.person(r.guestName) + "</td>" +
          '<td class="code">' + esc(r.code) + "</td>" +
          '<td class="strong num">' + esc(room ? room.number : "—") + "</td>" +
          "<td>" + esc(UI.dateShort(r.checkIn)) + '<div class="dim" style="font-size:.72rem">' + esc(UI.relativeDay(r.checkIn)) + "</div></td>" +
          "<td>" + esc(UI.dateShort(r.checkOut)) + "</td>" +
          '<td class="num">' + Store.nightsBetween(r.checkIn, r.checkOut) + "</td>" +
          '<td class="dim">' + esc(r.source) + "</td>" +
          "<td>" + UI.resPill(r.status) + "</td>" +
          '<td class="actions">' + rowAction(r) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div>";
      if (list.length > CAP) {
        html += '<div style="padding:10px 14px;font-size:.76rem" class="dim">Showing the ' + CAP +
          " most recent of " + list.length + " matching reservations. Use search to narrow the list.</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function rowAction(r) {
    if (r.status === "confirmed") {
      return '<button class="btn btn-soft btn-sm" data-action="check-in" data-id="' + r.id + '" data-stop>' + icon("login") + "Check in</button>";
    }
    if (r.status === "in-house") {
      return '<button class="btn btn-ghost btn-sm" data-action="check-out" data-id="' + r.id + '" data-stop>' + icon("logout") + "Check out</button>";
    }
    return '<span class="dim">—</span>';
  }

  function reservationDetailBody(resId) {
    var r = Store.reservationById(resId);
    if (!r) return UI.empty("Reservation not found");
    var room = Store.roomById(r.roomId);
    var guest = Store.guestById(r.guestId);
    var total = Store.folioTotal(r);
    var nights = Store.nightsBetween(r.checkIn, r.checkOut);

    var html = '<dl class="detail-list">' +
      row("Status", UI.resPill(r.status)) +
      row("Confirmation", '<span class="code">' + esc(r.code) + "</span>") +
      row("Guest", esc(r.guestName) + (guest && guest.vip ? ' <span class="pill pill-warn no-dot">VIP</span>' : "")) +
      row("Room", room ? esc(room.number) + " &middot; " + esc(Store.ROOM_TYPES[room.type].label) : "—") +
      row("Check-in", UI.dateLong(r.checkIn)) +
      row("Check-out", UI.dateLong(r.checkOut)) +
      row("Nights", String(nights)) +
      row("Party", r.adults + " adult" + (r.adults > 1 ? "s" : "") + (r.children ? ", " + r.children + " child" + (r.children > 1 ? "ren" : "") : "")) +
      row("Rate", '<span class="num">' + esc(money(r.rate)) + "</span> / night") +
      row("Booked via", esc(r.source)) +
      (r.checkedInAt ? row("Checked in at", UI.dateTime(r.checkedInAt)) : "") +
      (r.checkedOutAt ? row("Checked out at", UI.dateTime(r.checkedOutAt)) : "") +
      "</dl>";

    if (guest) {
      html += sectionTitle("Guest details") +
        '<div class="summary-box"><dl class="detail-list">' +
        row("Nationality", esc(guest.nationality)) +
        row("Phone", '<span class="code">' + esc(guest.phone) + "</span>") +
        row("Email", '<span class="code">' + esc(guest.email) + "</span>") +
        row(esc(guest.idType), '<span class="code">' + esc(guest.idNumber) + "</span>") +
        "</dl>" +
        '<p class="dim" style="font-size:.72rem;margin-top:10px">Contact and document numbers are partially masked in this demo.</p>' +
        "</div>";
    }

    if (r.notes) {
      html += sectionTitle("Notes") + '<div class="summary-box">' + esc(r.notes) + "</div>";
    }

    if (r.folio && r.folio.length) {
      html += sectionTitle("Folio");
      html += '<div class="summary-box">';
      r.folio.forEach(function (i) {
        html += '<div class="folio-row"><span class="fd">' + esc(UI.dateShort(i.date)) + " &middot; " + esc(i.desc) + "</span>" +
          '<span class="num">' + esc(money(i.amount)) + "</span></div>";
      });
      html += '<div class="folio-total"><span>Total</span><span class="num">' + esc(money(total)) + "</span></div>";
      html += "</div>";
    }

    html += '<div class="btn-row" style="margin-top:18px">';
    if (r.status === "confirmed") {
      html += '<button class="btn btn-primary btn-sm" data-action="check-in" data-id="' + r.id + '">' + icon("login") + "Check in</button>";
      html += '<button class="btn btn-danger btn-sm" data-action="cancel-reservation" data-id="' + r.id + '">' + icon("close") + "Cancel booking</button>";
    }
    if (r.status === "in-house") {
      html += '<button class="btn btn-primary btn-sm" data-action="check-out" data-id="' + r.id + '">' + icon("logout") + "Check out</button>";
      html += '<button class="btn btn-ghost btn-sm" data-action="add-charge" data-id="' + r.id + '">' + icon("plus") + "Post charge</button>";
      html += '<button class="btn btn-ghost btn-sm" data-action="reissue-card" data-id="' + r.id + '">' + icon("key") + "Re-issue key card</button>";
    }
    html += "</div>";

    return html;
  }

  /* ==================================================================== */
  /* Guests                                                               */
  /* ==================================================================== */

  function guests() {
    var q = filters.guestSearch.toLowerCase().trim();
    var all = Store.guests();
    var list = all.filter(function (g) {
      if (!q) return true;
      return g.name.toLowerCase().indexOf(q) > -1 ||
             g.nationality.toLowerCase().indexOf(q) > -1 ||
             g.email.toLowerCase().indexOf(q) > -1;
    });

    var html = '<div class="panel"><div class="panel-head">' +
      "<h2>Guest directory</h2>" +
      '<span class="sub">' + list.length + " of " + all.length + "</span>" +
      '<div class="filters" style="margin-left:auto"><div class="search">' + icon("search") +
        '<input class="input" type="search" placeholder="Name, nationality or email" data-filter="guestSearch" value="' + esc(filters.guestSearch) + '">' +
      "</div></div></div>";

    if (!list.length) {
      html += UI.empty("No guests match", "Try a different search.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Guest</th><th>Nationality</th><th>Phone</th><th>Document</th><th>Stays</th><th>Lifetime value</th></tr></thead><tbody>";
      list.forEach(function (g) {
        var stays = Store.reservations().filter(function (r) {
          return r.guestId === g.id && (r.status === "checked-out" || r.status === "in-house");
        });
        var value = stays.reduce(function (s, r) { return s + Store.folioTotal(r); }, 0);
        html += '<tr data-action="guest-detail" data-id="' + g.id + '" style="cursor:pointer">' +
          "<td>" + UI.person(g.name, g.email) +
            (g.vip ? ' <span class="pill pill-warn no-dot">VIP</span>' : "") + "</td>" +
          "<td>" + esc(g.nationality) + "</td>" +
          '<td class="code">' + esc(g.phone) + "</td>" +
          '<td class="code dim">' + esc(g.idNumber) + "</td>" +
          '<td class="num">' + stays.length + "</td>" +
          '<td class="num">' + esc(UI.moneyShort(value)) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
    }
    html += "</div>";
    return html;
  }

  function guestDetailBody(guestId) {
    var g = Store.guestById(guestId);
    if (!g) return UI.empty("Guest not found");
    var stays = Store.reservations().filter(function (r) { return r.guestId === g.id; })
      .sort(function (a, b) { return a.checkIn < b.checkIn ? 1 : -1; });
    var value = stays.reduce(function (s, r) { return s + Store.folioTotal(r); }, 0);

    var html = '<dl class="detail-list">' +
      row("Nationality", esc(g.nationality)) +
      row("Phone", '<span class="code">' + esc(g.phone) + "</span>") +
      row("Email", '<span class="code">' + esc(g.email) + "</span>") +
      row(esc(g.idType), '<span class="code">' + esc(g.idNumber) + "</span>") +
      row("Total stays", String(stays.length)) +
      row("Lifetime value", '<span class="num">' + esc(money(value)) + "</span>") +
      "</dl>" +
      '<p class="dim" style="font-size:.72rem;margin-top:8px">Contact and document numbers are partially masked in this demo.</p>';

    if (stays.length) {
      html += sectionTitle("Stay history");
      html += '<div class="panel"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Code</th><th>Room</th><th>Dates</th><th>Status</th><th>Folio</th></tr></thead><tbody>";
      stays.forEach(function (r) {
        var room = Store.roomById(r.roomId);
        html += "<tr>" +
          '<td class="code">' + esc(r.code) + "</td>" +
          '<td class="num">' + esc(room ? room.number : "—") + "</td>" +
          "<td>" + esc(UI.dateShort(r.checkIn)) + " &rarr; " + esc(UI.dateShort(r.checkOut)) + "</td>" +
          "<td>" + UI.resPill(r.status) + "</td>" +
          '<td class="num">' + esc(UI.moneyShort(Store.folioTotal(r))) + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
    }
    return html;
  }

  /* ==================================================================== */
  /* Key cards & door audit                                               */
  /* ==================================================================== */

  function access() {
    var allCards = Store.cards();
    var cardList = allCards.filter(function (c) {
      return filters.cardStatus === "all" || c.status === filters.cardStatus;
    });

    var q = filters.doorSearch.toLowerCase().trim();
    var events = Store.doorEvents().filter(function (e) {
      if (filters.doorResult !== "all" && e.result !== filters.doorResult) return false;
      if (!q) return true;
      var room = Store.roomById(e.roomId);
      return (room && room.number.indexOf(q) > -1) ||
             e.cardNumber.toLowerCase().indexOf(q) > -1 ||
             e.holder.toLowerCase().indexOf(q) > -1 ||
             e.lockId.toLowerCase().indexOf(q) > -1;
    });

    var anomalies = Store.accessAnomalies();
    var active = allCards.filter(function (c) { return c.status === "active"; }).length;
    var denied = Store.doorEvents().filter(function (e) { return e.result === "denied"; }).length;

    var html = '<div class="kpi-grid">' +
      kpi({ tone: "primary", icon: "key", label: "Active credentials", value: active,
            foot: allCards.length + " cards on file" }) +
      kpi({ tone: "info", icon: "door", label: "Door events logged", value: Store.doorEvents().length,
            foot: "Last 7 days" }) +
      kpi({ tone: "danger", icon: "shield", label: "Refused reads", value: denied,
            foot: denied ? "Review the flagged items" : "Nothing refused" }) +
      kpi({ tone: "warn", icon: "alert", label: "Open alerts", value: anomalies.length,
            foot: "Detected by audit rules" }) +
      "</div>";

    /* --- anomalies --- */
    html += '<div class="panel"><div class="panel-head"><h2>Flagged activity</h2>' +
      '<span class="sub">Rules run over the door log</span></div>';
    if (!anomalies.length) {
      html += UI.empty("Nothing flagged", "The audit rules found no unusual activity.");
    } else {
      html += '<div class="panel-body"><div class="stack">';
      anomalies.forEach(function (a) {
        html += '<div class="alert alert-' + (a.severity === "high" ? "danger" : "warn") + '">' +
          icon("alert") + "<div><b>" + esc(a.title) + "</b><p>" + esc(a.detail) + "</p></div></div>";
      });
      html += "</div></div>";
    }
    html += "</div>";

    /* --- cards --- */
    html += '<div class="panel" style="margin-top:16px"><div class="panel-head">' +
      "<h2>Key cards</h2>" +
      '<span class="sub">' + cardList.length + " shown</span>" +
      '<div class="filters" style="margin-left:auto">' +
        '<select class="select auto" data-filter="cardStatus">' +
          option("all", "All cards", filters.cardStatus) +
          option("active", "Active", filters.cardStatus) +
          option("expired", "Expired", filters.cardStatus) +
          option("revoked", "Revoked", filters.cardStatus) +
        "</select></div></div>";

    if (!cardList.length) {
      html += UI.empty("No cards match", "Change the status filter.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Card UID</th><th>Holder</th><th>Type</th><th>Room / lock</th><th>Issued</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>";
      cardList.slice(0, 60).forEach(function (c) {
        var room = c.roomId ? Store.roomById(c.roomId) : null;
        html += "<tr>" +
          '<td class="code strong">' + esc(c.cardNumber) + "</td>" +
          "<td>" + esc(c.holder) + "</td>" +
          '<td><span class="pill pill-neutral no-dot">' + esc(c.type) + "</span></td>" +
          "<td>" + (room ? esc(room.number) + ' <span class="code dim">' + esc(c.lockId) + "</span>" : '<span class="dim">All doors</span>') + "</td>" +
          "<td>" + esc(UI.dateTime(c.issuedAt)) + "</td>" +
          "<td>" + esc(UI.dateTime(c.expiresAt)) + "</td>" +
          "<td>" + UI.cardPill(c.status) + "</td>" +
          '<td class="actions">' +
            (c.status === "active"
              ? '<button class="btn btn-danger btn-sm" data-action="revoke-card" data-id="' + c.id + '">Revoke</button>'
              : '<span class="dim">—</span>') +
          "</td></tr>";
      });
      html += "</tbody></table></div></div>";
    }
    html += "</div>";

    /* --- door log --- */
    html += '<div class="panel" style="margin-top:16px"><div class="panel-head">' +
      "<h2>Door audit log</h2>" +
      '<span class="sub">' + events.length + " events</span>" +
      '<div class="filters" style="margin-left:auto">' +
        '<div class="search">' + icon("search") +
          '<input class="input" type="search" placeholder="Room, card or lock" data-filter="doorSearch" value="' + esc(filters.doorSearch) + '">' +
        "</div>" +
        '<div class="seg" data-seg="doorResult">' +
          segBtn("all", "All", filters.doorResult) +
          segBtn("granted", "Granted", filters.doorResult) +
          segBtn("denied", "Denied", filters.doorResult) +
        "</div>" +
      "</div></div>";

    if (!events.length) {
      html += UI.empty("No matching events", "Adjust the search or filter.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Time</th><th>Room</th><th>Lock</th><th>Card</th><th>Holder</th><th>Result</th><th>Note</th></tr></thead><tbody>";
      events.slice(0, 120).forEach(function (e) {
        var room = Store.roomById(e.roomId);
        html += "<tr>" +
          '<td class="nowrap">' + esc(UI.dateTime(e.ts)) + "</td>" +
          '<td class="strong num">' + esc(room ? room.number : "—") + "</td>" +
          '<td class="code dim">' + esc(e.lockId) + "</td>" +
          '<td class="code">' + esc(e.cardNumber) + "</td>" +
          "<td>" + esc(e.holder) + "</td>" +
          "<td>" + (e.result === "granted"
            ? '<span class="pill pill-ok">Granted</span>'
            : '<span class="pill pill-danger">Denied</span>') + "</td>" +
          '<td class="dim">' + esc(e.reason || "—") + "</td>" +
          "</tr>";
      });
      html += "</tbody></table></div>";
      if (events.length > 120) {
        html += '<div style="padding:10px 14px;font-size:.76rem" class="dim">Showing the 120 most recent of ' + events.length + " matching events.</div>";
      }
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  /* ==================================================================== */
  /* Housekeeping                                                         */
  /* ==================================================================== */

  function housekeeping() {
    var all = Store.rooms();
    var dirty = all.filter(function (r) { return r.status === "dirty"; });
    var maint = all.filter(function (r) { return r.status === "maintenance"; });
    var departures = Store.departuresToday();

    var html = '<div class="kpi-grid">' +
      kpi({ tone: "warn", icon: "broom", label: "Awaiting cleaning", value: dirty.length,
            foot: dirty.length ? "Blocking new arrivals" : "All rooms clean" }) +
      kpi({ tone: "danger", icon: "wrench", label: "Out of order", value: maint.length,
            foot: "Not sellable" }) +
      kpi({ tone: "info", icon: "logout", label: "Departures today", value: departures.length,
            foot: "Will need turning over" }) +
      "</div>";

    html += '<div class="panel"><div class="panel-head"><h2>Cleaning queue</h2>' +
      '<span class="sub">Rooms vacated and not yet cleaned</span></div>';
    if (!dirty.length) {
      html += UI.empty("Queue is clear", "Every vacant room is ready to sell.");
    } else {
      html += '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Room</th><th>Type</th><th>Floor</th><th>Rate</th><th></th></tr></thead><tbody>";
      dirty.forEach(function (r) {
        html += "<tr>" +
          '<td class="strong num">' + esc(r.number) + "</td>" +
          "<td>" + esc(Store.ROOM_TYPES[r.type].label) + "</td>" +
          '<td class="num">' + r.floor + "</td>" +
          '<td class="num">' + esc(UI.moneyShort(r.rate)) + "</td>" +
          '<td class="actions"><button class="btn btn-soft btn-sm" data-action="room-status" data-id="' + r.id + '" data-value="available">' +
            icon("check") + "Mark cleaned</button></td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div>";
    }
    html += "</div>";

    if (maint.length) {
      html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Out of order</h2></div>' +
        '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
        "<th>Room</th><th>Type</th><th>Floor</th><th></th></tr></thead><tbody>";
      maint.forEach(function (r) {
        html += "<tr>" +
          '<td class="strong num">' + esc(r.number) + "</td>" +
          "<td>" + esc(Store.ROOM_TYPES[r.type].label) + "</td>" +
          '<td class="num">' + r.floor + "</td>" +
          '<td class="actions"><button class="btn btn-ghost btn-sm" data-action="room-status" data-id="' + r.id + '" data-value="available">' +
            icon("check") + "Return to service</button></td>" +
          "</tr>";
      });
      html += "</tbody></table></div></div></div>";
    }

    /* Full board */
    html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Floor board</h2>' +
      '<span class="sub">Every room, current state</span></div><div class="panel-body">';
    var floors = {};
    all.forEach(function (r) { (floors[r.floor] = floors[r.floor] || []).push(r); });
    Object.keys(floors).sort().forEach(function (f) {
      html += '<h3 style="font-size:.76rem;text-transform:uppercase;letter-spacing:.09em;color:var(--text-3);margin:14px 0 9px">Floor ' + esc(f) + "</h3>";
      html += '<div class="room-grid">';
      floors[f].forEach(function (r) {
        html += '<button class="room-card" data-status="' + r.status + '" data-action="room-detail" data-id="' + r.id + '">' +
          '<div class="rc-top"><span class="rc-no num">' + esc(r.number) + "</span></div>" +
          '<div class="rc-foot" style="margin-top:9px">' + UI.roomPill(r.status) + "</div></button>";
      });
      html += "</div>";
    });
    html += "</div></div>";

    return html;
  }

  /* ==================================================================== */
  /* Reports                                                              */
  /* ==================================================================== */

  function reports() {
    var days = filters.reportDays;
    var perf = Store.performance(days);
    var byType = Store.revenueByType(days);
    var mix = Store.sourceMix();

    var html = '<div class="panel"><div class="panel-head"><h2>Performance</h2>' +
      '<div class="seg" data-seg="reportDays" style="margin-left:auto">' +
        segBtn("7", "7 days", String(days)) +
        segBtn("14", "14 days", String(days)) +
        segBtn("30", "30 days", String(days)) +
      "</div></div><div class=\"panel-body\">";

    html += '<div class="kpi-grid" style="margin-bottom:0">' +
      kpi({ tone: "primary", icon: "chart", label: "Average occupancy", value: perf.avgOccupancy + "<small>%</small>",
            foot: perf.roomNights + " room nights sold", meter: perf.avgOccupancy }) +
      kpi({ tone: "ok", icon: "money", label: "Room revenue", value: UI.moneyShort(perf.revenue),
            foot: "Over " + days + " days" }) +
      kpi({ tone: "info", icon: "trend", label: "ADR", value: UI.moneyShort(perf.adr),
            foot: "Average daily rate" }) +
      kpi({ tone: "primary", icon: "bed", label: "RevPAR", value: UI.moneyShort(perf.revpar),
            foot: "Revenue per available room" }) +
      "</div></div></div>";

    html += '<div class="grid-2" style="margin-top:16px">';

    html += '<div class="panel"><div class="panel-head"><h2>Daily occupancy</h2>' +
      '<span class="sub">Percent of rooms sold</span></div><div class="panel-body">' +
      UI.barChart(perf.series.map(function (d) {
        return { label: UI.dateShort(d.date).split(" ")[0], value: d.rate };
      }), { format: function (v) { return v + "%"; } }) + "</div></div>";

    html += '<div class="panel"><div class="panel-head"><h2>Daily room revenue</h2>' +
      '<span class="sub">' + esc(UI.moneyShort(perf.revenue)) + " total</span></div><div class=\"panel-body\">" +
      UI.barChart(perf.series.map(function (d) {
        return { label: UI.dateShort(d.date).split(" ")[0], value: d.revenue, alt: true };
      }), { format: UI.moneyShort }) + "</div></div>";

    html += "</div>";

    html += '<div class="grid-2" style="margin-top:16px">';

    var typeColors = { standard: "var(--info)", twin: "var(--ok)", deluxe: "var(--primary)", suite: "var(--warn)" };
    var typeRows = Object.keys(byType).map(function (k) {
      return {
        label: Store.ROOM_TYPES[k].label,
        value: byType[k],
        color: typeColors[k],
        display: UI.moneyShort(byType[k])
      };
    }).sort(function (a, b) { return b.value - a.value; });

    html += '<div class="panel"><div class="panel-head"><h2>Revenue by room type</h2></div>' +
      '<div class="panel-body">' + UI.splitBar(typeRows) + "</div></div>";

    var mixColors = ["var(--primary)", "var(--info)", "var(--ok)", "var(--warn)", "var(--neutral)"];
    var mixRows = Object.keys(mix).map(function (k, i) {
      return { label: k, value: mix[k], color: mixColors[i % mixColors.length], display: mix[k] };
    }).sort(function (a, b) { return b.value - a.value; });

    html += '<div class="panel"><div class="panel-head"><h2>Booking sources</h2>' +
      '<span class="sub">All reservations on file</span></div>' +
      '<div class="panel-body">' + UI.splitBar(mixRows) + "</div></div>";

    html += "</div>";

    html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h2>Daily breakdown</h2></div>' +
      '<div class="panel-body flush"><div class="table-scroll"><table class="tbl"><thead><tr>' +
      "<th>Date</th><th>Rooms sold</th><th>Occupancy</th><th>Room revenue</th><th>ADR</th></tr></thead><tbody>";
    perf.series.slice().reverse().forEach(function (d) {
      html += "<tr>" +
        "<td>" + esc(UI.dateLong(d.date)) + "</td>" +
        '<td class="num">' + d.rooms + "</td>" +
        '<td class="num">' + d.rate + "%</td>" +
        '<td class="num">' + esc(money(d.revenue)) + "</td>" +
        '<td class="num">' + esc(d.rooms ? UI.moneyShort(Math.round(d.revenue / d.rooms)) : "—") + "</td>" +
        "</tr>";
    });
    html += "</tbody></table></div></div></div>";

    return html;
  }

  /* ==================================================================== */
  /* Forms                                                                */
  /* ==================================================================== */

  function newReservationForm() {
    var t = Store.today();
    var tomorrow = Store.iso(Store.addDays(Store.parseISO(t), 1));
    var sellable = Store.rooms().filter(function (r) { return r.status !== "maintenance"; });

    return '<form id="resForm" novalidate><div class="form-grid">' +
      field("Guest name", '<input class="input" name="guestName" required data-autofocus placeholder="e.g. Amina Hassan">', "full") +
      field("Phone", '<input class="input" name="phone" placeholder="+255 7•• ••• •••">') +
      field("Email", '<input class="input" name="email" type="email" placeholder="guest@example.com">') +
      field("Room", '<select class="select" name="roomId">' +
        sellable.map(function (r) {
          return '<option value="' + r.id + '">' + esc(r.number) + " — " +
            esc(Store.ROOM_TYPES[r.type].label) + " — " + esc(UI.moneyShort(r.rate)) + "</option>";
        }).join("") + "</select>") +
      field("Source", '<select class="select" name="source">' +
        Store.SOURCES.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join("") +
        "</select>") +
      field("Check-in", '<input class="input" name="checkIn" type="date" value="' + t + '">') +
      field("Check-out", '<input class="input" name="checkOut" type="date" value="' + tomorrow + '">') +
      field("Adults", '<input class="input" name="adults" type="number" min="1" max="4" value="2">') +
      field("Children", '<input class="input" name="children" type="number" min="0" max="4" value="0">') +
      field("Notes", '<textarea class="input" name="notes" placeholder="Anything the front desk should know"></textarea>', "full") +
      "</div>" +
      '<div id="resFormError" class="alert alert-danger" style="display:none;margin-top:14px">' +
        icon("alert") + "<div><b>Could not save</b><p></p></div></div>" +
      "</form>";
  }

  function addChargeForm() {
    return '<form id="chargeForm" novalidate><div class="form-grid">' +
      field("Description", '<input class="input" name="desc" data-autofocus placeholder="e.g. Restaurant — dinner">', "full") +
      field("Amount (TZS)", '<input class="input" name="amount" type="number" min="0" step="500" placeholder="25000">', "full") +
      "</div></form>";
  }

  /* ==================================================================== */
  /* small builders                                                       */
  /* ==================================================================== */

  function row(label, value) {
    return '<div class="detail-row"><dt>' + label + "</dt><dd>" + value + "</dd></div>";
  }
  function sectionTitle(t) {
    return '<h3 style="margin:18px 0 10px;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-3)">' + esc(t) + "</h3>";
  }
  function option(value, label, current) {
    return '<option value="' + esc(value) + '"' + (String(current) === String(value) ? " selected" : "") + ">" + esc(label) + "</option>";
  }
  function segBtn(value, label, current) {
    return '<button type="button" data-value="' + esc(value) + '"' +
      (String(current) === String(value) ? ' class="on"' : "") + ">" + esc(label) + "</button>";
  }
  function field(label, control, cls) {
    return '<div class="field' + (cls ? " " + cls : "") + '"><label>' + esc(label) + "</label>" + control + "</div>";
  }
  function eventRow(e) {
    var ok = e.result === "granted";
    return '<div class="event">' +
      '<span class="ev-ico" style="background:var(--' + (ok ? "ok" : "danger") + '-soft);color:var(--' + (ok ? "ok" : "danger") + ')">' +
        icon(ok ? "check" : "close") + "</span>" +
      '<span class="ev-body"><b>' + esc(e.holder) + "</b> " +
        (ok ? "opened the door" : "was refused") +
        (e.reason ? ' <span class="dim">— ' + esc(e.reason) + "</span>" : "") +
      "</span>" +
      '<span class="ev-time">' + esc(UI.dateTime(e.ts)) + "</span>" +
      "</div>";
  }

  /* ==================================================================== */
  return {
    filters: filters,
    dashboard: dashboard,
    rooms: rooms, roomDetailBody: roomDetailBody,
    reservations: reservations, reservationDetailBody: reservationDetailBody,
    guests: guests, guestDetailBody: guestDetailBody,
    access: access,
    housekeeping: housekeeping,
    reports: reports,
    newReservationForm: newReservationForm,
    addChargeForm: addChargeForm
  };
})();
