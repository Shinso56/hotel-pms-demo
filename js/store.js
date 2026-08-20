/* ==========================================================================
   store.js — data model, seed generator, persistence, queries, mutations.
   Classic script (no ES modules) so the app also runs from file:// .
   --------------------------------------------------------------------------
   ALL DATA IN THIS FILE IS SYNTHETIC. Guest names, documents, phone numbers
   and card numbers are invented for demonstration purposes. Nothing here
   comes from a real property or a real guest.
   ========================================================================== */

var Store = (function () {
  "use strict";

  var STORAGE_KEY = "kv-pms-demo-v1";
  var state = null;

  /* ------------------------------------------------------------ utilities */

  /* Deterministic PRNG (mulberry32) — a fixed seed means every visitor sees
     the same demo, which makes the project easier to talk through. */
  function makeRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function iso(d) {
    var x = new Date(d);
    var m = String(x.getMonth() + 1).padStart(2, "0");
    var day = String(x.getDate()).padStart(2, "0");
    return x.getFullYear() + "-" + m + "-" + day;
  }
  function parseISO(s) {
    var p = String(s).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function nightsBetween(a, b) {
    return Math.max(0, Math.round((parseISO(b) - parseISO(a)) / 86400000));
  }
  function today() {
    return iso(startOfDay(new Date()));
  }
  function pick(rnd, arr) {
    return arr[Math.floor(rnd() * arr.length)];
  }
  function intBetween(rnd, lo, hi) {
    return lo + Math.floor(rnd() * (hi - lo + 1));
  }

  /* ------------------------------------------------------------ reference */

  var ROOM_TYPES = {
    standard: { label: "Standard", rate: 85000, beds: "1 double", cap: 2 },
    twin:     { label: "Twin",     rate: 110000, beds: "2 singles", cap: 2 },
    deluxe:   { label: "Deluxe",   rate: 160000, beds: "1 king", cap: 3 },
    suite:    { label: "Suite",    rate: 280000, beds: "1 king + sofa", cap: 4 }
  };

  var SOURCES = ["Direct", "Walk-in", "Booking.com", "Corporate", "Travel agent"];

  var NATIONALITIES = [
    "Tanzanian", "Tanzanian", "Tanzanian", "Kenyan", "Ugandan",
    "British", "German", "Danish", "French", "Chinese", "Emirati",
    "South African", "American", "Indian"
  ];

  /* Invented names. Any resemblance to a real person is coincidental. */
  var FIRST = ["Amina","Joseph","Grace","Daniel","Neema","Baraka","Zawadi","Emmanuel",
               "Fatuma","Peter","Halima","John","Rehema","Elias","Salma","Godfrey",
               "Sarah","Lars","Mei","Ahmed","Claire","Tom","Priya","Nadia","Marcus","Ingrid"];
  var LAST  = ["Hassan","Mwakalinga","Kimaro","Mushi","Shirima","Ndosi","Massawe","Lyimo",
               "Juma","Sanga","Mrisho","Kessy","Mollel","Chuwa","Nyerere","Makene",
               "Whitfield","Andersen","Chen","Al-Rashid","Dubois","Bekker","Sharma","Okonkwo"];

  var EXTRAS = [
    { desc: "Restaurant — dinner", min: 18000, max: 65000 },
    { desc: "Restaurant — breakfast", min: 12000, max: 22000 },
    { desc: "Bar", min: 8000, max: 45000 },
    { desc: "Laundry service", min: 10000, max: 30000 },
    { desc: "Airport transfer", min: 45000, max: 80000 },
    { desc: "Minibar", min: 5000, max: 18000 },
    { desc: "Conference room hire", min: 90000, max: 180000 }
  ];

  var HOTEL = {
    name: "Kilimanjaro View Hotel",
    short: "KVH",
    city: "Moshi, Tanzania",
    currency: "TZS",
    checkInTime: "14:00",
    checkOutTime: "11:00"
  };

  /* ------------------------------------------------------------ seed */

  function buildRooms() {
    var defs = [
      [1, 101, "standard"], [1, 102, "standard"], [1, 103, "standard"], [1, 104, "standard"],
      [1, 105, "twin"],     [1, 106, "twin"],     [1, 107, "deluxe"],   [1, 108, "deluxe"],
      [2, 201, "standard"], [2, 202, "standard"], [2, 203, "standard"], [2, 204, "twin"],
      [2, 205, "twin"],     [2, 206, "deluxe"],   [2, 207, "deluxe"],   [2, 208, "deluxe"],
      [3, 301, "deluxe"],   [3, 302, "deluxe"],   [3, 303, "suite"],
      [3, 304, "suite"],    [3, 305, "suite"],    [3, 306, "suite"]
    ];
    return defs.map(function (d) {
      return {
        id: "R" + d[1],
        number: String(d[1]),
        floor: d[0],
        type: d[2],
        rate: ROOM_TYPES[d[2]].rate,
        status: "available",
        lockId: "LK-" + d[1],
        /* Firmware clock offset in seconds — the audit module watches this. */
        clockDriftSec: 0
      };
    });
  }

  function buildGuests(rnd) {
    var used = {};
    var out = [];
    for (var i = 0; i < 26; i++) {
      var name;
      do {
        name = pick(rnd, FIRST) + " " + pick(rnd, LAST);
      } while (used[name]);
      used[name] = true;

      var parts = name.split(" ");
      out.push({
        id: "G" + String(i + 1).padStart(3, "0"),
        name: name,
        /* Contact details are masked in the demo data itself, not just in the
           UI — there is no full number stored anywhere to leak. */
        phone: "+255 7" + intBetween(rnd, 10, 89) + " ••• " + intBetween(rnd, 100, 999),
        email: parts[0].toLowerCase() + "." + parts[1].toLowerCase().replace(/[^a-z]/g, "") + "@example.com",
        nationality: pick(rnd, NATIONALITIES),
        idType: rnd() > 0.45 ? "Passport" : "National ID",
        idNumber: "•••• ••• " + intBetween(rnd, 1000, 9999),
        vip: rnd() > 0.86,
        notes: ""
      });
    }
    return out;
  }

  function folioFor(rnd, res, room) {
    var items = [];
    var n = nightsBetween(res.checkIn, res.checkOut);
    for (var i = 0; i < n; i++) {
      items.push({
        date: iso(addDays(parseISO(res.checkIn), i)),
        desc: "Room charge — " + ROOM_TYPES[room.type].label + " " + room.number,
        amount: res.rate,
        kind: "room"
      });
    }
    var extraCount = intBetween(rnd, 0, 3);
    for (var e = 0; e < extraCount; e++) {
      var x = pick(rnd, EXTRAS);
      items.push({
        date: iso(addDays(parseISO(res.checkIn), intBetween(rnd, 0, Math.max(0, n - 1)))),
        desc: x.desc,
        amount: Math.round(intBetween(rnd, x.min, x.max) / 500) * 500,
        kind: "extra"
      });
    }
    items.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return items;
  }

  function seed() {
    var rnd = makeRandom(20260820);
    var t0 = startOfDay(new Date());
    var rooms = buildRooms();
    var guests = buildGuests(rnd);

    var reservations = [];
    var cards = [];
    var doorEvents = [];
    var seq = 1;
    var cardSeq = 1;
    var guestPool = guests.slice();

    function takeGuest() {
      if (!guestPool.length) guestPool = guests.slice();
      return guestPool.splice(Math.floor(rnd() * guestPool.length), 1)[0];
    }
    function makeCard(res, room, type, issuedAt, expiresAt, status) {
      var c = {
        id: "C" + String(cardSeq).padStart(4, "0"),
        cardNumber: "04:" + [0, 0, 0].map(function () {
          return intBetween(rnd, 16, 255).toString(16).toUpperCase().padStart(2, "0");
        }).join(":") + ":" + String(cardSeq).padStart(2, "0"),
        reservationId: res ? res.id : null,
        roomId: room ? room.id : null,
        lockId: room ? room.lockId : null,
        holder: res ? res.guestName : type === "master" ? "Front office master" : "Housekeeping",
        type: type,
        issuedAt: issuedAt,
        expiresAt: expiresAt,
        status: status
      };
      cardSeq++;
      cards.push(c);
      return c;
    }

    function newRes(fields) {
      var n = seq++;
      fields.id = "RS" + String(n).padStart(4, "0");
      fields.code = "KVH-" + String(1000 + n);
      return fields;
    }

    /* ---- 1. walk each room's calendar to build its stay history ----------
       Generating room by room rather than at random does two things: it makes
       double bookings structurally impossible, and it yields an occupancy
       curve that looks like a working property instead of noise. */
    var HISTORY_START = -35;
    var HORIZON = 25;

    rooms.forEach(function (room) {
      var cursor = HISTORY_START;
      while (cursor < HORIZON) {
        cursor += intBetween(rnd, 1, 4);            /* vacant nights between stays */
        if (cursor >= HORIZON) break;

        var nights = intBetween(rnd, 1, 5);
        var ciOff = cursor;
        var coOff = cursor + nights;
        cursor = coOff;

        var status = coOff < 0 ? "checked-out"
                   : ciOff >= 0 ? "confirmed"        /* arrives today or later */
                   : "in-house";                     /* stay spans today */

        var g = takeGuest();
        var ci = addDays(t0, ciOff);
        var co = addDays(t0, coOff);

        var res = newRes({
          guestId: g.id,
          guestName: g.name,
          roomId: room.id,
          checkIn: iso(ci),
          checkOut: iso(co),
          adults: intBetween(rnd, 1, 2),
          children: rnd() > 0.82 ? 1 : 0,
          rate: room.rate,
          source: pick(rnd, SOURCES),
          status: status,
          createdAt: iso(addDays(ci, -intBetween(rnd, 2, 30))),
          checkedInAt: null,
          checkedOutAt: null,
          notes: ""
        });

        if (status === "checked-out") {
          res.checkedInAt = res.checkIn + "T15:" + String(intBetween(rnd, 10, 55)).padStart(2, "0");
          res.checkedOutAt = res.checkOut + "T10:" + String(intBetween(rnd, 5, 55)).padStart(2, "0");
          res.folio = folioFor(rnd, res, room);
          /* Only keep cards for recent stays, so the card list stays readable. */
          if (coOff >= -12) makeCard(res, room, "guest", res.checkedInAt, res.checkOut + "T11:00", "expired");
        } else if (status === "in-house") {
          res.checkedInAt = res.checkIn + "T" +
            String(intBetween(rnd, 14, 20)).padStart(2, "0") + ":" +
            String(intBetween(rnd, 0, 59)).padStart(2, "0");
          res.folio = folioFor(rnd, res, room);
          room.status = "occupied";
          makeCard(res, room, "guest", res.checkedInAt, res.checkOut + "T11:00", "active");
        } else {
          res.folio = [];
          if (ciOff === 0 && rnd() > 0.6) res.notes = "Late arrival expected.";
        }

        reservations.push(res);
      }
    });

    var inHouseRooms = rooms.filter(function (r) { return r.status === "occupied"; });

    /* ---- 2. guarantee the demo always opens with arrivals to check in ----
       The calendar walk only lands a stay on today by chance, so top up to
       four arrivals using rooms that are genuinely free. */
    function arrivalCount() {
      return reservations.filter(function (r) {
        return r.status === "confirmed" && r.checkIn === today();
      }).length;
    }

    var freeToday = rooms.filter(function (room) {
      if (room.status === "occupied") return false;
      return !reservations.some(function (r) {
        return r.roomId === room.id && r.checkIn <= today() && r.checkOut > today() &&
               r.status !== "checked-out";
      });
    });

    while (arrivalCount() < 4 && freeToday.length) {
      var aroom = freeToday.shift();

      /* Cap the stay so it cannot run into this room's next booking. */
      var nextStart = reservations
        .filter(function (r) {
          return r.roomId === aroom.id && r.checkIn > today() &&
                 (r.status === "confirmed" || r.status === "in-house");
        })
        .map(function (r) { return r.checkIn; })
        .sort()[0];

      var maxNights = nextStart ? nightsBetween(today(), nextStart) : 4;
      if (maxNights < 1) continue;

      var ag = takeGuest();
      var anights = Math.min(maxNights, intBetween(rnd, 1, 4));
      var ares = newRes({
        guestId: ag.id,
        guestName: ag.name,
        roomId: aroom.id,
        checkIn: today(),
        checkOut: iso(addDays(t0, anights)),
        adults: intBetween(rnd, 1, 2),
        children: rnd() > 0.75 ? 1 : 0,
        rate: aroom.rate,
        source: pick(rnd, SOURCES),
        status: "confirmed",
        createdAt: iso(addDays(t0, -intBetween(rnd, 1, 40))),
        checkedInAt: null,
        checkedOutAt: null,
        notes: rnd() > 0.7 ? "Late arrival expected." : "",
        folio: []
      });
      reservations.push(ares);
    }

    /* ---- 3. a cancellation and a no-show, so the filters have something ----
       These never occupy a room, so they cannot clash with the walk above. */
    ["cancelled", "no-show"].forEach(function (st) {
      var room = pick(rnd, rooms);
      var g = takeGuest();
      var ci = addDays(t0, st === "cancelled" ? intBetween(rnd, 2, 10) : -intBetween(rnd, 1, 6));
      reservations.push(newRes({
        guestId: g.id,
        guestName: g.name,
        roomId: room.id,
        checkIn: iso(ci),
        checkOut: iso(addDays(ci, 2)),
        adults: 2, children: 0,
        rate: room.rate,
        source: pick(rnd, SOURCES),
        status: st,
        createdAt: iso(addDays(ci, -8)),
        checkedInAt: null, checkedOutAt: null,
        folio: [],
        notes: st === "cancelled" ? "Cancelled by guest, within free window." : "Guest did not arrive."
      }));
    });

    /* ---- 4. housekeeping states ----------------------------------------
       Only rooms with nobody arriving today get dirtied or taken out of
       service, so the check-in flow is always demonstrable on first load. */
    var arrivalRooms = {};
    reservations.forEach(function (r) {
      if (r.status === "confirmed" && r.checkIn === today()) arrivalRooms[r.roomId] = true;
    });
    var idle = rooms.filter(function (r) {
      return r.status === "available" && !arrivalRooms[r.id];
    });
    idle.slice(0, 3).forEach(function (r) { r.status = "dirty"; });
    if (idle[3]) idle[3].status = "maintenance";

    /* ---- 7. staff cards ---- */
    var masterIssued = iso(addDays(t0, -120)) + "T08:00";
    makeCard(null, null, "master", masterIssued, iso(addDays(t0, 245)) + "T08:00", "active");
    makeCard(null, null, "staff", masterIssued, iso(addDays(t0, 245)) + "T08:00", "active");
    makeCard(null, null, "staff", masterIssued, iso(addDays(t0, 245)) + "T08:00", "active");

    /* ---- 8. door access log for the last 7 days ---- */
    var evId = 1;
    function logEvent(ts, room, card, result, reason) {
      doorEvents.push({
        id: "E" + String(evId++).padStart(5, "0"),
        ts: ts,
        roomId: room ? room.id : null,
        lockId: room ? room.lockId : "LK-LOBBY",
        cardNumber: card ? card.cardNumber : "—",
        cardType: card ? card.type : "unknown",
        holder: card ? card.holder : "Unknown card",
        result: result,
        reason: reason || ""
      });
    }
    function stamp(dayOffset, hour, minute) {
      return iso(addDays(t0, dayOffset)) + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    }

    var masterCard = cards.filter(function (c) { return c.type === "master"; })[0];
    var staffCards = cards.filter(function (c) { return c.type === "staff"; });

    for (var d = -6; d <= 0; d++) {
      /* guest movements */
      inHouseRooms.forEach(function (room) {
        var card = cards.filter(function (c) { return c.roomId === room.id && c.status === "active"; })[0];
        if (!card) return;
        var trips = intBetween(rnd, 2, 5);
        for (var t = 0; t < trips; t++) {
          var hour = intBetween(rnd, 6, 23);
          logEvent(stamp(d, hour, intBetween(rnd, 0, 59)), room, card, "granted", "");
        }
        /* the occasional fumbled read */
        if (rnd() > 0.85) {
          logEvent(stamp(d, intBetween(rnd, 7, 22), intBetween(rnd, 0, 59)), room, card, "denied", "Read error — card presented too briefly");
        }
      });
      /* housekeeping rounds */
      rooms.forEach(function (room) {
        if (rnd() > 0.55) return;
        logEvent(stamp(d, intBetween(rnd, 9, 13), intBetween(rnd, 0, 59)), room,
                 pick(rnd, staffCards), "granted", "Housekeeping round");
      });
    }

    /* ---- 9. planted anomalies — the audit view exists to surface these ----
       Occupancy is generated, not fixed, so index defensively. */
    var anomalyRoom = inHouseRooms[5 % Math.max(1, inHouseRooms.length)] || rooms[0];
    var anomalyCard = cards.filter(function (c) { return c.roomId === anomalyRoom.id; })[0];

    /* (a) repeated denied reads — looks like someone testing cards on a door */
    for (var k = 0; k < 5; k++) {
      logEvent(stamp(-1, 2, 11 + k * 2), anomalyRoom, { cardNumber: "04:9F:2C:71:88", type: "unknown", holder: "Unrecognised card" },
               "denied", "Card not recognised by lock");
    }
    /* (b) expired card used after checkout */
    var oldCard = cards.filter(function (c) { return c.status === "expired"; })[0];
    if (oldCard) {
      var oldRoom = rooms.filter(function (r) { return r.id === oldCard.roomId; })[0];
      logEvent(stamp(-2, 19, 42), oldRoom, oldCard, "denied", "Card expired at checkout");
    }
    /* (c) master card used at an odd hour */
    logEvent(stamp(-3, 3, 17), pick(rnd, rooms), masterCard, "granted", "Master card used outside working hours");
    /* (d) clock drift on one lock, which corrupts audit-trail ordering */
    var driftRoom = rooms[9];
    driftRoom.clockDriftSec = 412;
    if (anomalyCard) {
      logEvent(stamp(-1, 23, 51), driftRoom, anomalyCard, "granted", "Lock clock ahead of server by 6m 52s");
    }

    doorEvents.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });

    return {
      version: 1,
      seededOn: today(),
      hotel: HOTEL,
      rooms: rooms,
      guests: guests,
      reservations: reservations,
      cards: cards,
      doorEvents: doorEvents,
      counters: { res: seq, card: cardSeq, event: evId }
    };
  }

  /* ------------------------------------------------------------ persistence */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* Private browsing or a full quota — the app keeps working in memory. */
    }
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        /* Re-seed if the data was generated on an earlier day, so the demo
           always shows arrivals and departures for the current date. */
        if (parsed && parsed.version === 1 && parsed.seededOn === today()) {
          state = parsed;
          return state;
        }
      } catch (e) {}
    }
    state = seed();
    save();
    return state;
  }

  function reset() {
    state = seed();
    save();
    return state;
  }

  /* ------------------------------------------------------------ queries */

  function rooms() { return state.rooms; }
  function guests() { return state.guests; }
  function reservations() { return state.reservations; }
  function cards() { return state.cards; }
  function doorEvents() { return state.doorEvents; }
  function hotel() { return state.hotel; }

  function roomById(id) { return state.rooms.filter(function (r) { return r.id === id; })[0] || null; }
  function guestById(id) { return state.guests.filter(function (g) { return g.id === id; })[0] || null; }
  function reservationById(id) { return state.reservations.filter(function (r) { return r.id === id; })[0] || null; }
  function cardById(id) { return state.cards.filter(function (c) { return c.id === id; })[0] || null; }

  function activeCardFor(roomId) {
    return state.cards.filter(function (c) {
      return c.roomId === roomId && c.status === "active" && c.type === "guest";
    })[0] || null;
  }

  function reservationForRoom(roomId) {
    return state.reservations.filter(function (r) {
      return r.roomId === roomId && r.status === "in-house";
    })[0] || null;
  }

  function inHouse() {
    return state.reservations.filter(function (r) { return r.status === "in-house"; });
  }
  function arrivalsToday() {
    var t = today();
    return state.reservations.filter(function (r) { return r.status === "confirmed" && r.checkIn === t; });
  }
  function departuresToday() {
    var t = today();
    return state.reservations.filter(function (r) { return r.status === "in-house" && r.checkOut === t; });
  }

  function folioTotal(res) {
    if (!res || !res.folio) return 0;
    return res.folio.reduce(function (s, i) { return s + i.amount; }, 0);
  }

  /* Rooms occupied on a given date, derived from reservations rather than
     from room.status, so historical dates report correctly. */
  function occupiedOn(dateISO) {
    return state.reservations.filter(function (r) {
      if (r.status === "cancelled" || r.status === "no-show") return false;
      return r.checkIn <= dateISO && r.checkOut > dateISO;
    }).length;
  }

  function occupancyRate(dateISO) {
    var total = state.rooms.length;
    if (!total) return 0;
    return Math.round((occupiedOn(dateISO) / total) * 100);
  }

  function roomRevenueOn(dateISO) {
    return state.reservations.reduce(function (sum, r) {
      if (r.status === "cancelled" || r.status === "no-show") return sum;
      if (r.checkIn <= dateISO && r.checkOut > dateISO) return sum + r.rate;
      return sum;
    }, 0);
  }

  function statusCounts() {
    var c = { available: 0, occupied: 0, dirty: 0, maintenance: 0 };
    state.rooms.forEach(function (r) { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }

  function kpis() {
    var t = today();
    var counts = statusCounts();
    var inh = inHouse();
    var heads = inh.reduce(function (s, r) { return s + r.adults + r.children; }, 0);
    return {
      occupancy: occupancyRate(t),
      occupied: counts.occupied,
      totalRooms: state.rooms.length,
      arrivals: arrivalsToday().length,
      departures: departuresToday().length,
      inHouse: inh.length,
      guestsInHouse: heads,
      revenueToday: roomRevenueOn(t),
      toClean: counts.dirty,
      outOfOrder: counts.maintenance
    };
  }

  /* ---- reporting series ---- */

  function occupancySeries(days) {
    var out = [];
    var t0 = startOfDay(new Date());
    for (var i = days - 1; i >= 0; i--) {
      var d = iso(addDays(t0, -i));
      out.push({ date: d, rate: occupancyRate(d), rooms: occupiedOn(d), revenue: roomRevenueOn(d) });
    }
    return out;
  }

  function performance(days) {
    var series = occupancySeries(days);
    var roomNights = series.reduce(function (s, d) { return s + d.rooms; }, 0);
    var revenue = series.reduce(function (s, d) { return s + d.revenue; }, 0);
    var available = state.rooms.length * days;
    return {
      series: series,
      roomNights: roomNights,
      revenue: revenue,
      adr: roomNights ? Math.round(revenue / roomNights) : 0,
      revpar: available ? Math.round(revenue / available) : 0,
      avgOccupancy: series.length
        ? Math.round(series.reduce(function (s, d) { return s + d.rate; }, 0) / series.length)
        : 0
    };
  }

  function revenueByType(days) {
    var t0 = startOfDay(new Date());
    var totals = {};
    Object.keys(ROOM_TYPES).forEach(function (k) { totals[k] = 0; });
    for (var i = 0; i < days; i++) {
      var d = iso(addDays(t0, -i));
      state.reservations.forEach(function (r) {
        if (r.status === "cancelled" || r.status === "no-show") return;
        if (r.checkIn <= d && r.checkOut > d) {
          var room = roomById(r.roomId);
          if (room) totals[room.type] += r.rate;
        }
      });
    }
    return totals;
  }

  function sourceMix() {
    var mix = {};
    state.reservations.forEach(function (r) {
      if (r.status === "cancelled") return;
      mix[r.source] = (mix[r.source] || 0) + 1;
    });
    return mix;
  }

  /* Anomalies in the door log. This is the module that mirrors the RFID /
     access-control work the portfolio talks about. */
  function accessAnomalies() {
    var out = [];
    var byRoomDay = {};

    state.doorEvents.forEach(function (e) {
      if (e.result !== "denied") return;
      var key = e.roomId + "|" + e.ts.slice(0, 10);
      byRoomDay[key] = byRoomDay[key] || [];
      byRoomDay[key].push(e);
    });

    Object.keys(byRoomDay).forEach(function (key) {
      var group = byRoomDay[key];
      if (group.length >= 3) {
        var room = roomById(group[0].roomId);
        out.push({
          severity: "high",
          title: "Repeated denied reads on room " + (room ? room.number : "?"),
          detail: group.length + " refusals on " + key.split("|")[1] +
                  " — consistent with someone trying unregistered cards.",
          ts: group[0].ts
        });
      }
    });

    state.doorEvents.forEach(function (e) {
      if (/expired/i.test(e.reason)) {
        var room = roomById(e.roomId);
        out.push({
          severity: "medium",
          title: "Expired card presented at room " + (room ? room.number : "?"),
          detail: "Lock correctly refused a card that expired at checkout.",
          ts: e.ts
        });
      }
      if (/outside working hours/i.test(e.reason)) {
        out.push({
          severity: "high",
          title: "Master card used at " + e.ts.slice(11),
          detail: "Master credential opened a door outside staffed hours. Confirm who held it.",
          ts: e.ts
        });
      }
    });

    state.rooms.forEach(function (r) {
      if (r.clockDriftSec > 60) {
        out.push({
          severity: "medium",
          title: "Clock drift on lock " + r.lockId,
          detail: "Lock is " + Math.round(r.clockDriftSec / 60) + " minutes ahead of the server. " +
                  "Audit trail ordering for room " + r.number + " cannot be trusted until it is re-synced.",
          ts: today() + "T00:00"
        });
      }
    });

    return out.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
  }

  /* ------------------------------------------------------------ mutations */

  function nextResId() {
    var n = state.counters.res++;
    return { id: "RS" + String(n).padStart(4, "0"), code: "KVH-" + String(1000 + n) };
  }

  function issueCard(reservationId, type) {
    var res = reservationById(reservationId);
    var room = res ? roomById(res.roomId) : null;
    if (!res || !room) return null;

    /* One active guest card per room: revoke anything still live first. */
    state.cards.forEach(function (c) {
      if (c.roomId === room.id && c.type === "guest" && c.status === "active") c.status = "revoked";
    });

    var n = state.counters.card++;
    var card = {
      id: "C" + String(n).padStart(4, "0"),
      cardNumber: "04:" + [1, 2, 3].map(function (i) {
        return ((n * 37 + i * 53) % 240 + 16).toString(16).toUpperCase().padStart(2, "0");
      }).join(":") + ":" + String(n % 100).padStart(2, "0"),
      reservationId: res.id,
      roomId: room.id,
      lockId: room.lockId,
      holder: res.guestName,
      type: type || "guest",
      issuedAt: new Date().toISOString().slice(0, 16),
      expiresAt: res.checkOut + "T11:00",
      status: "active"
    };
    state.cards.unshift(card);
    save();
    return card;
  }

  function revokeCard(cardId) {
    var c = cardById(cardId);
    if (!c || c.status !== "active") return false;
    c.status = "revoked";
    save();
    return true;
  }

  function logDoorEvent(roomId, card, result, reason) {
    var room = roomById(roomId);
    var n = state.counters.event++;
    state.doorEvents.unshift({
      id: "E" + String(n).padStart(5, "0"),
      ts: new Date().toISOString().slice(0, 16),
      roomId: roomId,
      lockId: room ? room.lockId : "—",
      cardNumber: card ? card.cardNumber : "—",
      cardType: card ? card.type : "system",
      holder: card ? card.holder : "System",
      result: result,
      reason: reason || ""
    });
    save();
  }

  function checkIn(reservationId) {
    var res = reservationById(reservationId);
    if (!res || res.status !== "confirmed") return { ok: false, error: "This reservation cannot be checked in." };
    var room = roomById(res.roomId);
    if (!room) return { ok: false, error: "No room is assigned to this reservation." };
    if (room.status === "maintenance") return { ok: false, error: "Room " + room.number + " is out of order." };
    if (room.status === "occupied") return { ok: false, error: "Room " + room.number + " is still occupied." };
    if (room.status === "dirty") return { ok: false, error: "Room " + room.number + " has not been cleaned yet." };

    res.status = "in-house";
    res.checkedInAt = new Date().toISOString().slice(0, 16);
    room.status = "occupied";

    /* Post the room charges for the stay onto the folio. */
    var nights = nightsBetween(res.checkIn, res.checkOut);
    res.folio = res.folio || [];
    for (var i = 0; i < nights; i++) {
      res.folio.push({
        date: iso(addDays(parseISO(res.checkIn), i)),
        desc: "Room charge — " + ROOM_TYPES[room.type].label + " " + room.number,
        amount: res.rate,
        kind: "room"
      });
    }

    var card = issueCard(res.id, "guest");
    logDoorEvent(room.id, card, "granted", "Key card encoded at check-in");
    save();
    return { ok: true, card: card, room: room };
  }

  function checkOut(reservationId) {
    var res = reservationById(reservationId);
    if (!res || res.status !== "in-house") return { ok: false, error: "This reservation is not currently checked in." };
    var room = roomById(res.roomId);

    res.status = "checked-out";
    res.checkedOutAt = new Date().toISOString().slice(0, 16);
    if (room) room.status = "dirty";

    state.cards.forEach(function (c) {
      if (c.reservationId === res.id && c.status === "active") c.status = "expired";
    });

    save();
    return { ok: true, total: folioTotal(res), room: room };
  }

  function createReservation(data) {
    var room = roomById(data.roomId);
    if (!room) return { ok: false, error: "Pick a room." };
    if (!data.guestName || !data.guestName.trim()) return { ok: false, error: "Enter a guest name." };
    if (!data.checkIn || !data.checkOut) return { ok: false, error: "Enter both dates." };
    if (nightsBetween(data.checkIn, data.checkOut) < 1) return { ok: false, error: "Check-out must be after check-in." };

    /* Refuse a booking that overlaps an existing one for the same room. */
    var clash = state.reservations.filter(function (r) {
      if (r.roomId !== room.id) return false;
      if (r.status === "cancelled" || r.status === "no-show" || r.status === "checked-out") return false;
      return data.checkIn < r.checkOut && r.checkIn < data.checkOut;
    })[0];
    if (clash) {
      return { ok: false, error: "Room " + room.number + " is already booked from " + clash.checkIn + " to " + clash.checkOut + "." };
    }

    var guest = state.guests.filter(function (g) {
      return g.name.toLowerCase() === data.guestName.trim().toLowerCase();
    })[0];

    if (!guest) {
      guest = {
        id: "G" + String(state.guests.length + 1).padStart(3, "0"),
        name: data.guestName.trim(),
        phone: data.phone || "—",
        email: data.email || "—",
        nationality: data.nationality || "—",
        idType: "National ID",
        idNumber: "•••• ••• ____",
        vip: false,
        notes: ""
      };
      state.guests.push(guest);
    }

    var ids = nextResId();
    var res = {
      id: ids.id,
      code: ids.code,
      guestId: guest.id,
      guestName: guest.name,
      roomId: room.id,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: Number(data.adults) || 1,
      children: Number(data.children) || 0,
      rate: room.rate,
      source: data.source || "Direct",
      status: "confirmed",
      createdAt: today(),
      checkedInAt: null,
      checkedOutAt: null,
      notes: data.notes || "",
      folio: []
    };
    state.reservations.unshift(res);
    save();
    return { ok: true, reservation: res };
  }

  function cancelReservation(id) {
    var res = reservationById(id);
    if (!res || (res.status !== "confirmed")) return false;
    res.status = "cancelled";
    save();
    return true;
  }

  function setRoomStatus(roomId, status) {
    var room = roomById(roomId);
    if (!room) return false;
    if (room.status === "occupied" && status !== "occupied") {
      /* Guard: an occupied room can't be freed without a check-out. */
      return false;
    }
    room.status = status;
    save();
    return true;
  }

  function addFolioItem(reservationId, desc, amount) {
    var res = reservationById(reservationId);
    if (!res) return false;
    res.folio = res.folio || [];
    res.folio.push({ date: today(), desc: desc, amount: Number(amount) || 0, kind: "extra" });
    save();
    return true;
  }

  function resyncLock(roomId) {
    var room = roomById(roomId);
    if (!room) return false;
    room.clockDriftSec = 0;
    logDoorEvent(roomId, null, "granted", "Lock clock re-synchronised with server");
    save();
    return true;
  }

  /* ------------------------------------------------------------ exports */
  return {
    ROOM_TYPES: ROOM_TYPES,
    SOURCES: SOURCES,

    load: load, save: save, reset: reset,

    hotel: hotel,
    rooms: rooms, guests: guests, reservations: reservations,
    cards: cards, doorEvents: doorEvents,

    roomById: roomById, guestById: guestById,
    reservationById: reservationById, cardById: cardById,
    activeCardFor: activeCardFor, reservationForRoom: reservationForRoom,

    inHouse: inHouse, arrivalsToday: arrivalsToday, departuresToday: departuresToday,
    folioTotal: folioTotal, statusCounts: statusCounts, kpis: kpis,
    occupancyRate: occupancyRate, occupiedOn: occupiedOn,
    occupancySeries: occupancySeries, performance: performance,
    revenueByType: revenueByType, sourceMix: sourceMix,
    accessAnomalies: accessAnomalies,

    checkIn: checkIn, checkOut: checkOut,
    createReservation: createReservation, cancelReservation: cancelReservation,
    setRoomStatus: setRoomStatus, issueCard: issueCard, revokeCard: revokeCard,
    addFolioItem: addFolioItem, resyncLock: resyncLock, logDoorEvent: logDoorEvent,

    today: today, iso: iso, addDays: addDays, parseISO: parseISO,
    nightsBetween: nightsBetween, startOfDay: startOfDay
  };
})();
