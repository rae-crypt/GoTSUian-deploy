const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { emitRideUpdated, emitNewPendingRide, emitDriverLocation, emitAvailabilityChanged, getPresentDriverIds, emitNoDriversLeft, emitComplaintFiled } = require('../socket');
const { FAILED_REASONS, PASSENGER_REASONS, hasFailureColumns } = require('../rideFailures');
const { hasDeclinesTable } = require('../rideDeclines');
const { hasCertificateSeenColumn } = require('../certificateSeen');
const { hasBookedForColumns } = require('../bookedFor');
const { getFareSettings, computeFare, hasDistanceColumn } = require('../fareSettings');

// Fare per rider, keyed by how many students end up in the tricycle.
// Solo is always headcount 1. Shared settles into whichever headcount
// the pool actually closes at (2, 3, or 4).
const FARE_BY_HEADCOUNT = { 1: 60, 2: 35, 3: 25, 4: 20 };
const MAX_POOL_SIZE = 4;

// How far ahead of a scheduled pickup time a ride becomes visible to
// drivers — enough lead time to actually reach the pickup spot by the
// requested time, instead of only starting the trip once it's already due.
const SCHEDULE_LEAD_TIME_MINUTES = 10;

// How close two "In X minutes" requests have to be to count as the same
// departure slot for Shared pooling. Two students who both picked "In 15
// minutes" a minute apart shouldn't end up in separate pools just because
// their exact computed timestamps don't match to the second.
const SCHEDULE_POOL_MATCH_TOLERANCE_MINUTES = 5;

// A ride with a future scheduled_at is deliberately NOT broadcast to
// drivers the moment it's created (see createRide below) — nothing should
// point a driver toward a request whose pickup time is an hour away.
// listPendingRides' own WHERE clause is what actually keeps it hidden;
// this just decides whether to push the "new pending ride" notification
// right now or to wait.
function emitPendingOrSchedule(scheduledAt) {
  if (!scheduledAt) return emitNewPendingRide();
  const releaseAt = new Date(scheduledAt).getTime() - SCHEDULE_LEAD_TIME_MINUTES * 60000;
  if (releaseAt <= Date.now()) {
    emitNewPendingRide();
  } else {
    scheduleRideRelease(scheduledAt);
  }
}

// setTimeout only lives as long as this Node process does — a server
// restart with a scheduled ride still pending would otherwise leave it
// silently un-pushed until some unrelated socket event happened to
// refresh a driver's list. rearmScheduledRideTimers() (called once at
// server startup, see server/app.js) re-creates every pending ride's
// timer on boot; this does the same for a single newly-created ride.
function scheduleRideRelease(scheduledAt) {
  const releaseAt = new Date(scheduledAt).getTime() - SCHEDULE_LEAD_TIME_MINUTES * 60000;
  const delay = releaseAt - Date.now();
  if (delay <= 0) return;
  setTimeout(() => emitNewPendingRide(), delay);
}

exports.rearmScheduledRideTimers = function rearmScheduledRideTimers() {
  db.query(
    `SELECT scheduled_at FROM rides WHERE status = 'Pending' AND scheduled_at IS NOT NULL AND scheduled_at > NOW()`,
    (err, rows) => {
      if (err) return console.warn('Could not re-arm scheduled ride timers', err);
      rows.forEach(row => scheduleRideRelease(row.scheduled_at));
    }
  );
};

// ─── "OTHERS" DROP-OFF (Solo-only, LIVE on Railway since 2026-08-26) ────
// Lets a passenger request a drop-off beyond the normal fixed endpoint
// (e.g. SM Tarlac, past Main Campus) instead of only the two campuses.
// Fare = the flat Solo fare (₱60, unchanged) + a per-km surcharge for the
// stretch beyond the normal endpoint. The rate is grounded in Tarlac
// City's real tricycle fare ordinance (IX-4-001-2024), the student-
// discount row's "per additional kilometer" figure — ₱5/km. The
// ordinance's ₱20 "first kilometer" charge deliberately does NOT apply
// here: that's a flagdown/base fee for a trip starting at zero, and this
// isn't one — it's a continuation of a ride whose own base cost is
// already covered by the ₱60 flat fare.
const CAMPUS_COORDS = {
  sanIsidro: [15.502749, 120.578693],
  mainCampus: [15.485127, 120.587373]
};
const OTHERS_RATE_PER_KM = 5;
const MAX_OTHERS_EXTRA_KM = 5;
// Applied to the straight-line distance only when the live routing call
// fails or times out — real roads are rarely as short as a straight
// line, so this keeps the fallback from undercharging too badly.
const OTHERS_STRAIGHT_LINE_BUFFER = 1.3;

function getNormalEndpoint(pickupLocation) {
  return (pickupLocation || '').includes('San Isidro') ? CAMPUS_COORDS.mainCampus : CAMPUS_COORDS.sanIsidro;
}

// Coordinates arriving from a request body are strings as often as numbers,
// and a half-supplied pair (lat but no lng) has to read as "no point given"
// rather than silently becoming NaN somewhere downstream.
function normalizePoint(coords) {
  if (!coords) return null;
  const lat = parseFloat(coords.lat);
  const lng = parseFloat(coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bounding box for place lookups, as Nominatim wants it: lon,lat of the
// top-left corner then lon,lat of the bottom-right. These are the real
// administrative bounds of TARLAC PROVINCE (OSM relation), rounded outward
// slightly so border barangays aren't clipped.
//
// It used to be a ~33km square around Tarlac City (120.45,15.65,120.75,15.35),
// which cut the province in half: the southern edge landed at 15.35, so
// Capas stopped at Barangay Dolores (15.3696) and the whole of Concepcion
// (town proper at 15.3249), Bamban, Paniqui and Camiling were unreachable.
// Worse than unreachable, actually — `bounded=1` is a hard filter, so typing
// "Concepcion" didn't report "outside our area", it silently returned six
// roads on Concepcion's northern fringe that looked like valid answers.
const TARLAC_VIEWBOX = '120.15,15.89,120.80,15.15';

// "Book for someone else" (see bookedFor.js). A pickup the passenger picked
// from the search, rather than their own GPS, must be inside the same Tarlac
// box the search uses, and must say who is being picked up and how to reach
// them, so a driver is never sent to an unexplained address.
const [TARLAC_MIN_LNG, TARLAC_MAX_LAT, TARLAC_MAX_LNG, TARLAC_MIN_LAT] = TARLAC_VIEWBOX.split(',').map(Number);

function isInsideTarlac(point) {
  return !!point
    && point[0] >= TARLAC_MIN_LAT && point[0] <= TARLAC_MAX_LAT
    && point[1] >= TARLAC_MIN_LNG && point[1] <= TARLAC_MAX_LNG;
}

// Philippine mobile number in the 09XXXXXXXXX form, accepting spaces,
// dashes and a +63 / 63 prefix. Null if it isn't one.
function normalizePhMobile(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('63')) digits = '0' + digits.slice(2);
  return /^09\d{9}$/.test(digits) ? digits : null;
}

// A GPS pickup (the passenger's own location) is limited to the same area.
// The drop-off search was already Tarlac-only, but nothing stopped someone in
// Manila from booking a ~120 km, ~₱600 ride a Tarlac driver would never take.
// Only a known point counts as outside; no coordinates is handled elsewhere.
const GPS_OUTSIDE_AREA_MESSAGE = 'GoTSUian only serves Tarlac, and your current location is outside the service area. To book for someone in Tarlac, tap "Change pickup".';

function isOutsideServiceArea(lat, lng) {
  const point = normalizePoint({ lat, lng });
  return !!point && !isInsideTarlac(point);
}

// Checks a "someone else" pickup. Returns { error } or the cleaned values.
function checkBookedFor({ pickupPoint, name, contact }) {
  if (!pickupPoint) {
    return { error: 'Pick the pickup place from the suggestions so the driver gets the exact spot.' };
  }
  if (!isInsideTarlac(pickupPoint)) {
    return { error: 'Pickups must be within Tarlac.' };
  }
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  if (cleanName.length < 2 || cleanName.length > 100) {
    return { error: "Enter the name of the passenger you're booking for." };
  }
  const cleanContact = normalizePhMobile(contact);
  if (!cleanContact) {
    return { error: "Enter the passenger's mobile number (11 digits, starting with 09)." };
  }
  return { name: cleanName, contact: cleanContact };
}

// Nominatim (OpenStreetMap's free geocoder, no API key) — turns the
// passenger's typed "Others" text into coordinates.
async function geocodeAddress(text) {
  // Suffix is ", Tarlac" (the province), NOT ", Tarlac City". The old
  // city suffix fought the province-wide box above: "Concepcion" became
  // "Concepcion, Tarlac City", a contradiction that pushed the real town
  // down the results in favour of anything inside the city limits.
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=${TARLAC_VIEWBOX}&bounded=1&q=${encodeURIComponent(text + ', Tarlac, Philippines')}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GoTSUian/1.0 (capstone project, TSU San Isidro)' },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error('Location lookup failed');
  const results = await res.json();
  if (!results.length) throw new Error('LOCATION_NOT_FOUND');
  return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
}

// The reverse of geocodeAddress — turns the coordinates a passenger's
// browser captured into a readable place name, so a driver sees "Barangay
// Hall, Cut-cut" on the ride card instead of "15.4851, 120.5873". Proxied
// through the server rather than called from the browser so Nominatim gets
// the same identifying User-Agent it already gets from geocodeAddress
// (their usage policy asks for one) and so a rate-limit or outage is
// handled in one place.
// Every barangay in Tarlac province as OpenStreetMap maps it: a single
// point per barangay (place=village/quarter/suburb), fetched once from the
// Overpass API and saved here so lookups are instant and never depend on
// that service being up. Rows are [name, place type, lat, lng].
const TARLAC_BARANGAYS = require('../data/tarlac-barangays.json');
const BARANGAY_MAX_KM = 3;

// The barangay whose mapped point is closest. Most Tarlac barangays have no
// drawn boundary in OpenStreetMap, only that point, so Nominatim can't say
// which one contains a location: it names the nearest point of EACH kind
// separately and returns both. All of Sapang Tagalog came back as "San
// Miguel, Sapang Tagalog" (San Miguel is ~1km away), and TSU San Isidro as
// "Salapungan". Comparing distances across all kinds picks the right one.
function nearestBarangay(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const [name, , bLat, bLng] of TARLAC_BARANGAYS) {
    const km = haversineKm([lat, lng], [bLat, bLng]);
    if (km < bestKm) {
      best = name;
      bestKm = km;
    }
  }
  return bestKm <= BARANGAY_MAX_KM ? best : null;
}

// Short "place, barangay, city" label from a Nominatim result's address
// parts, instead of the first three parts of display_name, which carried
// the wrong-barangay problem above straight into the pickup box. `point` is
// the passenger's own GPS position on a reverse lookup: the result's lat/lon
// there is the matched road or building, which can sit in the next barangay.
function formatPlaceLabel(result, point) {
  const address = result.address || {};
  const [lat, lng] = point || [parseFloat(result.lat), parseFloat(result.lon)];
  const barangay = (Number.isFinite(lat) && Number.isFinite(lng) && nearestBarangay(lat, lng))
    || address.village || address.quarter || address.suburb || address.neighbourhood || address.hamlet;
  const locality = address.city || address.town || address.municipality || address.county;
  // A named spot (a mall, a school, a barangay hall) says the most; failing
  // that, the street. Area-type results name the barangay/city themselves.
  const isArea = result.class === 'place' || result.class === 'boundary';
  const spot = (!isArea && result.name) || address.road;

  const parts = [];
  for (const part of [spot, barangay, locality]) {
    if (part && !parts.some(p => p.toLowerCase() === part.toLowerCase())) parts.push(part);
  }
  if (parts.length) return parts.join(', ');
  return (result.display_name || '').split(',').slice(0, 3).map(s => s.trim()).filter(Boolean).join(', ');
}

async function reverseGeocodePoint(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GoTSUian/1.0 (capstone project, TSU San Isidro)' },
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error('Reverse lookup failed');
  const data = await res.json();
  if (!data || !data.display_name) throw new Error('REVERSE_NOT_FOUND');
  return formatPlaceLabel(data, [Number(lat), Number(lng)]);
}

// Type-ahead for the drop-off box. Same Tarlac-biased Nominatim search that
// geocodeAddress uses, but it returns several candidates instead of silently
// committing to the first: a partial string like "SM" matches plenty of
// places, and letting the passenger pick the right one beats guessing and
// sending a driver somewhere else.
//
// Failures deliberately return an empty list rather than an error status —
// this fires while someone is typing, and a red message every few keystrokes
// because a free geocoder hiccuped would be worse than no suggestions.
exports.searchPlaces = async (req, res) => {
  const query = (req.body.q || '').trim();
  if (query.length < 2) return res.status(200).json({ places: [] });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&viewbox=${TARLAC_VIEWBOX}&bounded=1&q=${encodeURIComponent(query + ', Tarlac, Philippines')}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GoTSUian/1.0 (capstone project, TSU San Isidro)' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error('Place search failed');
    const results = await response.json();

    res.status(200).json({
      places: results.map((result) => ({
        label: formatPlaceLabel(result),
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      }))
    });
  } catch (error) {
    console.warn('Place search failed:', error.message);
    res.status(200).json({ places: [] });
  }
};

// Used by the passenger booking form's "Use my current location" option.
// A failure here is never fatal to booking — the client falls back to
// showing the raw coordinates as the location label.
exports.reverseGeocode = async (req, res) => {
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }
  try {
    res.status(200).json({ label: await reverseGeocodePoint(lat, lng) });
  } catch (error) {
    res.status(502).json({ error: 'Could not look up that location name.' });
  }
};

// OSRM's public demo routing server — real road distance. Falls back to
// a buffered straight-line distance if it's slow, down, or errors, so an
// "Others" booking never just fails outright because of a free third-
// party service having a bad moment (important since this gets demoed
// live).
async function getRoadDistanceKm(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('routing request failed');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes.length) throw new Error('no route found');
    return data.routes[0].distance / 1000;
  } catch (error) {
    console.warn('OSRM lookup failed, falling back to straight-line distance:', error.message);
    return haversineKm(from, to) * OTHERS_STRAIGHT_LINE_BUFFER;
  }
}

// Computes the real fare for a custom "Others" drop-off. Throws a plain
// Error with a passenger-facing message on failure (location not found,
// or outside the service area) — callers should catch and respond 400.
async function computeOthersFare(pickupLocation, dropoffText, dropoffCoords) {
  // A drop-off picked with "Use my current location" already has exact
  // coordinates from the passenger's own device — geocoding its label back
  // into a point would only lose precision, so those are used as-is.
  let point = normalizePoint(dropoffCoords);
  if (!point) {
    try {
      point = await geocodeAddress(dropoffText);
    } catch (error) {
      throw new Error('Could not find that location. Please try a more specific address.');
    }
  }

  const normalEndpoint = getNormalEndpoint(pickupLocation);
  const straightLineKm = haversineKm(normalEndpoint, point);
  if (straightLineKm > MAX_OTHERS_EXTRA_KM) {
    throw new Error(`GoTSUian only serves drop-offs within about ${MAX_OTHERS_EXTRA_KM}km of campus. That location is too far.`);
  }

  const extraKm = await getRoadDistanceKm(normalEndpoint, point);
  const extraFare = Math.ceil(extraKm) * OTHERS_RATE_PER_KM;
  const fare = FARE_BY_HEADCOUNT[1] + extraFare;

  return { fare, extraKm: Math.round(extraKm * 100) / 100, lat: point[0], lng: point[1] };
}

// ─── DISTANCE-BASED FARE (every ride from a GPS pickup) ────────────────
// Road distance from the passenger's pickup to the drop-off, priced with the
// ordinance rates in fareSettings.js. The same trip gets the same number
// twice in a row: a quote is kept for QUOTE_TTL_MS, so the fare saved with
// the ride is the one the passenger was shown before booking, even if the
// routing server answers differently (or not at all) the second time.
const QUOTE_TTL_MS = 10 * 60 * 1000;
const fareQuoteCache = new Map();

function quoteKey(pickupPoint, dropoffPoint) {
  return [...pickupPoint, ...dropoffPoint].map(n => n.toFixed(5)).join(',');
}

async function quoteDistanceFare(pickupPoint, dropoffPoint) {
  const key = quoteKey(pickupPoint, dropoffPoint);
  const cached = fareQuoteCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.quote;

  const distanceKm = Math.round((await getRoadDistanceKm(pickupPoint, dropoffPoint)) * 100) / 100;
  const quote = { fare: computeFare(distanceKm), distanceKm };
  if (fareQuoteCache.size > 1000) fareQuoteCache.clear();
  fareQuoteCache.set(key, { quote, expires: Date.now() + QUOTE_TTL_MS });
  return quote;
}

// A pickup away from the two campuses (every pickup, now that it's always
// the passenger's GPS) is priced by distance. The drop-off is resolved to a
// point first: the coordinates of the suggestion the passenger picked, or
// failing that the typed text geocoded.
async function resolveCustomPickupDropoff(pickupPoint, dropoffText, dropoffCoords) {
  if (!pickupPoint) {
    throw new Error("We couldn't get your pickup location. Tap the pickup box to try again.");
  }
  let point = normalizePoint(dropoffCoords);
  if (!point) {
    try {
      point = await geocodeAddress(dropoffText);
    } catch (error) {
      throw new Error('Could not find that drop-off location. Please pick it from the suggestions.');
    }
  }
  const { fare, distanceKm } = await quoteDistanceFare(pickupPoint, point);
  return { fare, distanceKm, extraKm: null, lat: point[0], lng: point[1] };
}

// The pickup point for a quote or booking: the GPS coordinates sent along,
// or failing that the pickup text geocoded. Null if neither works.
async function resolvePickupPoint(pickupLocation, pickupLat, pickupLng) {
  const point = normalizePoint({ lat: pickupLat, lng: pickupLng });
  if (point) return point;
  try {
    return await geocodeAddress(pickupLocation);
  } catch (error) {
    console.warn('Could not geocode custom pickup:', error.message);
    return null;
  }
}

// PUBLIC — the current fare rates, for How It Works and the booking form.
exports.getFareSettings = (req, res) => {
  res.status(200).json(getFareSettings());
};

// QUOTE — lets the client show the real fare before the passenger
// commits, without creating a ride yet. createRide recomputes the same
// thing at actual booking time, so nothing from this response is trusted
// later — this is purely a preview.
exports.quoteOthersDropoff = async (req, res) => {
  const { pickup_location, dropoff_text, dropoff_lat, dropoff_lng, pickup_lat, pickup_lng, pickup_is_custom, pickup_from_search } = req.body;
  if (!pickup_location || !dropoff_text) {
    return res.status(400).json({ error: 'Pickup location and drop-off text are required' });
  }
  if (pickup_from_search && !isInsideTarlac(normalizePoint({ lat: pickup_lat, lng: pickup_lng }))) {
    return res.status(400).json({ error: 'Pickups must be within Tarlac.' });
  }
  if (pickup_is_custom && !pickup_from_search && isOutsideServiceArea(pickup_lat, pickup_lng)) {
    return res.status(400).json({ error: GPS_OUTSIDE_AREA_MESSAGE });
  }
  const dropoffCoords = { lat: dropoff_lat, lng: dropoff_lng };
  try {
    const quote = pickup_is_custom
      ? await resolveCustomPickupDropoff(await resolvePickupPoint(pickup_location, pickup_lat, pickup_lng), dropoff_text, dropoffCoords)
      : await computeOthersFare(pickup_location, dropoff_text, dropoffCoords);
    res.status(200).json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// CREATE A RIDE REQUEST
exports.createRide = async (req, res) => {
  const passenger_account_id = req.user.accountId;
  const {
    pickup_location,
    dropoff_location,
    pickup_lat,
    pickup_lng,
    dropoff_lat,
    dropoff_lng,
    ride_type,
    scheduled_at,
    notes,
    dropoff_is_custom,
    pickup_is_custom,
    pickup_from_search,
    booked_for_name,
    booked_for_contact
  } = req.body;

  if (!passenger_account_id || !pickup_location || !dropoff_location || !ride_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (pickup_location === dropoff_location) {
    return res.status(400).json({ error: 'Pickup and drop-off must be different' });
  }

  if (dropoff_is_custom && ride_type !== 'Solo') {
    return res.status(400).json({ error: 'A custom drop-off location is only available for Solo rides.' });
  }

  // Same reasoning as the custom drop-off rule above: Shared pooling groups
  // riders by an exact pickup/drop-off text match, which only holds for the
  // fixed campus points. A freely-entered pickup would never match another
  // rider's, so it can't be pooled.
  if (pickup_is_custom && ride_type !== 'Solo') {
    return res.status(400).json({ error: 'A custom pickup location is only available for Solo rides.' });
  }

  // Booking for someone else: a pickup chosen from the search instead of
  // the passenger's own GPS. Only Solo, inside Tarlac, and with the name and
  // number of the person being picked up.
  let bookedFor = null;
  if (pickup_from_search) {
    if (ride_type !== 'Solo') {
      return res.status(400).json({ error: 'Booking for someone else is only available for Solo rides.' });
    }
    const checked = checkBookedFor({
      pickupPoint: normalizePoint({ lat: pickup_lat, lng: pickup_lng }),
      name: booked_for_name,
      contact: booked_for_contact
    });
    if (checked.error) return res.status(400).json({ error: checked.error });
    bookedFor = checked;
  } else if (pickup_is_custom && isOutsideServiceArea(pickup_lat, pickup_lng)) {
    return res.status(400).json({ error: GPS_OUTSIDE_AREA_MESSAGE });
  }

  // A custom drop-off's fare isn't a lookup — it's geocoded and measured
  // fresh here, never trusting whatever number the client's earlier
  // /others-quote preview showed (that endpoint exists purely for UX, not
  // as a source of truth).
  // A pickup typed by hand has no coordinates of its own, so the map would
  // have nothing to draw and the driver would get only a line of text.
  // Geocoding it gives both a real point, and the start of the fare distance.
  let resolvedPickup = normalizePoint({ lat: pickup_lat, lng: pickup_lng });
  if (pickup_is_custom && !resolvedPickup) {
    resolvedPickup = await resolvePickupPoint(pickup_location);
  }
  const pickupLatValue = resolvedPickup ? resolvedPickup[0] : null;
  const pickupLngValue = resolvedPickup ? resolvedPickup[1] : null;

  let othersQuote = null;
  if (pickup_is_custom && dropoff_is_custom) {
    try {
      othersQuote = await resolveCustomPickupDropoff(resolvedPickup, dropoff_location, { lat: dropoff_lat, lng: dropoff_lng });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else if (dropoff_is_custom) {
    try {
      othersQuote = await computeOthersFare(pickup_location, dropoff_location, { lat: dropoff_lat, lng: dropoff_lng });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  // A passenger can only have one active (not yet finished) ride at a
  // time — stops accidental double-booking from tapping "Request ride"
  // more than once while an earlier request is still Pending/Accepted/etc.
  db.query(
    `SELECT ride_id FROM rides WHERE passenger_account_id = ? AND status NOT IN ('Completed', 'Cancelled', 'Failed', 'Declined') LIMIT 1`,
    [passenger_account_id],
    (err, activeRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (activeRows.length > 0) {
        return res.status(409).json({ error: 'You already have an active ride request. Please wait for it to be accepted, declined, or completed before booking another.' });
      }

      if (ride_type === 'Solo') {
        const soloFare = othersQuote ? othersQuote.fare : FARE_BY_HEADCOUNT[1];
        const dropoffLat = othersQuote ? othersQuote.lat : null;
        const dropoffLng = othersQuote ? othersQuote.lng : null;
        const extraKm = othersQuote ? othersQuote.extraKm : null;
        const distanceKm = othersQuote && othersQuote.distanceKm != null ? othersQuote.distanceKm : null;
        // distance_km only once fareSettings has confirmed the column exists.
        const withDistance = hasDistanceColumn();
        // booked_for_* only once bookedFor.js has confirmed the columns. If
        // they're missing, a "someone else" booking is refused rather than
        // saved without the details the driver needs.
        const withBookedFor = hasBookedForColumns();
        if (bookedFor && !withBookedFor) {
          return res.status(503).json({ error: 'Booking for someone else is not available right now. Please try again in a minute.' });
        }
        const sql = `
          INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, extra_km,${withDistance ? ' distance_km,' : ''}${withBookedFor ? ' booked_for_name, booked_for_contact,' : ''} ride_type, fare, status, scheduled_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?,${withDistance ? ' ?,' : ''}${withBookedFor ? ' ?, ?,' : ''} 'Solo', ?, 'Pending', ?, ?)
        `;
        const values = [passenger_account_id, pickup_location, dropoff_location, pickupLatValue, pickupLngValue, dropoffLat, dropoffLng, extraKm];
        if (withDistance) values.push(distanceKm);
        if (withBookedFor) values.push(bookedFor ? bookedFor.name : null, bookedFor ? bookedFor.contact : null);
        values.push(soloFare, scheduled_at || null, notes || null);
        db.query(
          sql,
          values,
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Ride requested', rideId: result.insertId, fare: soloFare, distanceKm });
            emitPendingOrSchedule(scheduled_at);
          }
        );
        return;
      }

      if (ride_type !== 'Shared') {
        return res.status(400).json({ error: 'ride_type must be "Solo" or "Shared"' });
      }

      // Find-or-create the pool for this route has to run under a MySQL
      // named lock keyed to the route. Without it, two passengers requesting
      // the same route within the same instant can both run the "does an
      // open pool exist?" check before either has inserted anything, both
      // see "no", and both create their own separate pool — the "pool never
      // fills up / a rider ends up in their own separate Shared ride" bug.
      // GET_LOCK/RELEASE_LOCK are tied to one physical connection, so this
      // whole section runs on a single dedicated connection rather than the
      // pool's usual "any connection per query" behavior.
      const lockName = 'shared_pool_' + crypto.createHash('md5').update(`${pickup_location}|${dropoff_location}`).digest('hex');

      db.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: err.message });

        const releaseLockAndConnection = () => {
          connection.query('SELECT RELEASE_LOCK(?)', [lockName], () => connection.release());
        };
        const failWith = (error) => {
          releaseLockAndConnection();
          res.status(500).json({ error: error.message });
        };

        connection.query('SELECT GET_LOCK(?, 10) AS got', [lockName], (err, lockRows) => {
          if (err) return failWith(err);
          if (!lockRows[0].got) {
            connection.release();
            return res.status(503).json({ error: 'This route is busy right now — please try again in a moment.' });
          }

          // Find the oldest still-open pool for this exact route, same
          // departure slot, with room left. A pool stays "Open" even after
          // a driver has already accepted it early (see acceptRideInternal)
          // — a new student can still join an in-progress pool right up
          // until it fills to 4 or the driver actually departs.
          //
          // The scheduled_at condition keeps a "leave now" request (NULL)
          // from ever pooling with a "scheduled" one, and two scheduled
          // requests only pool if they're within SCHEDULE_POOL_MATCH_
          // TOLERANCE_MINUTES of each other — otherwise a student leaving
          // now could get grouped with one who wants to leave an hour
          // later, which makes no sense for a single tricycle trip.
          const normalizedScheduledAt = scheduled_at || null;
          const findPoolSql = `
            SELECT rp.pool_id, rp.driver_account_id, COUNT(r.ride_id) AS rider_count
            FROM ride_pools rp
            LEFT JOIN rides r ON r.pool_id = rp.pool_id AND r.status != 'Cancelled'
            WHERE rp.status = 'Open' AND rp.pickup_location = ? AND rp.dropoff_location = ?
              AND (
                (rp.scheduled_at IS NULL AND ? IS NULL)
                OR (rp.scheduled_at IS NOT NULL AND ? IS NOT NULL AND ABS(TIMESTAMPDIFF(MINUTE, rp.scheduled_at, ?)) <= ?)
              )
            GROUP BY rp.pool_id
            HAVING rider_count < ?
            ORDER BY rp.created_at ASC
            LIMIT 1
          `;

          connection.query(
            findPoolSql,
            [
              pickup_location, dropoff_location,
              normalizedScheduledAt, normalizedScheduledAt, normalizedScheduledAt, SCHEDULE_POOL_MATCH_TOLERANCE_MINUTES,
              MAX_POOL_SIZE
            ],
            (err, pools) => {
            if (err) return failWith(err);

            const joinPool = (poolId, poolDriverId) => {
              // If a driver is already assigned to this pool (accepted it
              // early while under 4 riders), a newly-joining student slots
              // straight in as "Accepted" under that same driver instead of
              // going through a separate Pending/Accept step.
              const initialStatus = poolDriverId ? 'Accepted' : 'Pending';
              const insertRideSql = `
                INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, ride_type, pool_id, driver_account_id, status, scheduled_at, notes)
                VALUES (?, ?, ?, ?, ?, 'Shared', ?, ?, ?, ?, ?)
              `;
              connection.query(
                insertRideSql,
                [passenger_account_id, pickup_location, dropoff_location, pickupLatValue, pickupLngValue, poolId, poolDriverId || null, initialStatus, scheduled_at || null, notes || null],
                (err, result) => {
                  if (err) return failWith(err);

                  connection.query(
                    `SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`,
                    [poolId],
                    (err, countRows) => {
                      if (err) return failWith(err);
                      const count = countRows[0].c;

                      // Notifies everyone already sharing this pool (fare may
                      // have just re-settled for them too), plus the assigned
                      // driver if one's already committed to this trip — or,
                      // if nobody's accepted it yet, broadcasts to every
                      // driver browsing pending requests instead of one
                      // specific room. Runs after the lock is released, on
                      // the shared pool — these are just reads.
                      const notifyPool = () => {
                        if (poolDriverId) {
                          db.query(`SELECT passenger_account_id FROM rides WHERE pool_id = ? AND status != 'Cancelled'`, [poolId], (err, riderRows) => {
                            if (err) return;
                            riderRows.forEach(r => emitRideUpdated(r.passenger_account_id, poolDriverId));
                          });
                        } else {
                          emitPendingOrSchedule(scheduled_at);
                        }
                      };

                      const respond = () => {
                        releaseLockAndConnection();
                        res.status(201).json({ message: 'Ride requested', rideId: result.insertId, poolId, riderCount: count });
                        notifyPool();
                      };

                      // Fare re-settles across every rider already in the
                      // pool whenever the headcount changes, either because a
                      // driver is already committed to this trip (so the tier
                      // they'll actually pay should track reality as more
                      // join) or the pool has now filled to capacity.
                      if (poolDriverId || count >= MAX_POOL_SIZE) {
                        const fare = FARE_BY_HEADCOUNT[count] || FARE_BY_HEADCOUNT[MAX_POOL_SIZE];
                        const isFull = count >= MAX_POOL_SIZE;
                        const poolUpdateSql = isFull
                          ? `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, closed_at = NOW() WHERE pool_id = ?`
                          : `UPDATE ride_pools SET fare_per_rider = ? WHERE pool_id = ?`;
                        connection.query(poolUpdateSql, [fare, poolId], (err) => {
                          if (err) return failWith(err);
                          connection.query(`UPDATE rides SET fare = ? WHERE pool_id = ? AND status != 'Cancelled'`, [fare, poolId], (err) => {
                            if (err) return failWith(err);
                            respond();
                          });
                        });
                      } else {
                        respond();
                      }
                    }
                  );
                }
              );
            };

            if (pools.length > 0) {
              joinPool(pools[0].pool_id, pools[0].driver_account_id);
            } else {
              connection.query(
                `INSERT INTO ride_pools (pickup_location, dropoff_location, status, scheduled_at) VALUES (?, ?, 'Open', ?)`,
                [pickup_location, dropoff_location, normalizedScheduledAt],
                (err, poolResult) => {
                  if (err) return failWith(err);
                  joinPool(poolResult.insertId, null);
                }
              );
            }
          });
        });
      });
    }
  );
};

// LIST PENDING RIDES — for the driver dashboard. Shared rides are grouped
// by pool so a driver sees one card per tricycle trip, not one per rider.
// A "book for someone else" request shows the person's name but never their
// mobile number here (Data Privacy Act, RA 10173): every online driver sees
// this list, so the number is only sent to the one driver who accepts the
// ride (getDriverRides).
exports.listPendingRides = (req, res) => {
  // Hides requests this driver has already declined (see declineRide).
  const withDeclines = hasDeclinesTable();
  const sql = `
    SELECT r.ride_id, r.passenger_account_id, r.pickup_location, r.dropoff_location,
           r.ride_type, r.pool_id, r.fare,${hasDistanceColumn() ? ' r.distance_km,' : ''}${hasBookedForColumns() ? ' r.booked_for_name,' : ''} r.status, r.scheduled_at, r.notes, r.created_at,
           CONCAT(s.first_name, ' ', s.last_name) AS passenger_name,
           rp.status AS pool_status
    FROM rides r
    JOIN student s ON s.account_id = r.passenger_account_id
    LEFT JOIN ride_pools rp ON rp.pool_id = r.pool_id
    WHERE r.status = 'Pending'
      AND (r.scheduled_at IS NULL OR r.scheduled_at <= DATE_ADD(NOW(), INTERVAL ? MINUTE))
      ${withDeclines ? 'AND r.ride_id NOT IN (SELECT ride_id FROM ride_declines WHERE driver_account_id = ?)' : ''}
    ORDER BY r.created_at ASC
  `;
  const params = [SCHEDULE_LEAD_TIME_MINUTES];
  if (withDeclines) params.push(req.user.accountId);

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const pools = {};
    const grouped = [];

    rows.forEach(row => {
      if (row.ride_type === 'Solo' || !row.pool_id) {
        grouped.push({ type: 'solo', ride: row });
        return;
      }
      if (!pools[row.pool_id]) {
        pools[row.pool_id] = {
          type: 'shared',
          poolId: row.pool_id,
          pickup_location: row.pickup_location,
          dropoff_location: row.dropoff_location,
          pool_status: row.pool_status,
          scheduled_at: row.scheduled_at,
          riders: []
        };
        grouped.push(pools[row.pool_id]);
      }
      pools[row.pool_id].riders.push(row);
    });

    res.status(200).json({ rides: grouped });
  });
};

// GET A PASSENGER'S OWN RIDE HISTORY / ACTIVE RIDE
exports.getMyRides = (req, res) => {
  const accountId = req.user.accountId;
  const sql = `
    SELECT r.*, CONCAT(td.first_name, ' ', td.last_name) AS driver_name,
           td.plate_number AS driver_plate,
           rv.review_id IS NOT NULL AS has_review, rv.rating AS my_rating,
           rp.status AS pool_status,
           (SELECT COUNT(*) FROM messages m WHERE m.ride_id = r.ride_id
              AND m.sender_account_id != ? AND m.is_read = 0) AS unread_message_count,
           (SELECT COUNT(*) FROM rides r2 WHERE r2.pool_id = r.pool_id
              AND r2.status != 'Cancelled') AS pool_rider_count
    FROM rides r
    LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
    LEFT JOIN reviews rv ON rv.ride_id = r.ride_id
    LEFT JOIN ride_pools rp ON rp.pool_id = r.pool_id
    WHERE r.passenger_account_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [accountId, accountId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ rides: rows });
  });
};

// GET A DRIVER'S OWN ACCEPTED/COMPLETED RIDES
exports.getDriverRides = (req, res) => {
  const accountId = req.user.accountId;
  const sql = `
    SELECT r.*, CONCAT(s.first_name, ' ', s.last_name) AS passenger_name,
           rp.status AS pool_status,
           (SELECT COUNT(*) FROM messages m WHERE m.ride_id = r.ride_id
              AND m.sender_account_id != ? AND m.is_read = 0) AS unread_message_count
    FROM rides r
    JOIN student s ON s.account_id = r.passenger_account_id
    LEFT JOIN ride_pools rp ON rp.pool_id = r.pool_id
    WHERE r.driver_account_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [accountId, accountId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ rides: rows });
  });
};

// DRIVER checks their own current on-shift state (e.g. on dashboard load).
exports.getDriverAvailability = (req, res) => {
  const accountId = req.user.accountId;
  db.query(`SELECT is_online FROM tricycle_driver WHERE account_id = ?`, [accountId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });
    res.status(200).json({ is_online: Boolean(rows[0].is_online) });
  });
};

// DRIVER pushes their current GPS position. Called repeatedly (via
// watchPosition) only while they have an active ride — see
// setupDriverLocationSharing() on the frontend for when this actually fires.
exports.updateDriverLocation = (req, res) => {
  const accountId = req.user.accountId;
  const { lat, lng } = req.body;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  db.query(
    `UPDATE tricycle_driver SET current_lat = ?, current_lng = ?, location_updated_at = NOW() WHERE account_id = ?`,
    [lat, lng, accountId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found' });
      res.status(200).json({ message: 'Location updated' });
      recordDriverSpeedSample(accountId, lat, lng);
      db.query(
        `SELECT passenger_account_id FROM rides WHERE driver_account_id = ? AND status IN ('Accepted', 'Picked Up', 'In Progress')`,
        [accountId],
        (err2, riderRows) => {
          if (err2) return;
          riderRows.forEach(r => emitDriverLocation(r.passenger_account_id));
        }
      );
    }
  );
};

// The road a ride takes from pickup to drop-off, as [lat, lng] points for
// the maroon line on both the passenger's and the driver's map. Same public
// OSRM server getRoadDistanceKm uses; if it's slow or down the line falls
// back to a straight one between the two ends, which still shows direction.
// A road route is kept per ride, since the endpoints never change once a
// ride exists; a failure isn't, so the next map refresh tries again. That
// demo server is free and often takes several seconds, hence the long wait.
const rideRouteCache = new Map();

async function getRoadRoutePoints(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('routing request failed');
    const data = await res.json();
    const coords = data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
    if (data.code !== 'Ok' || !coords || coords.length < 2) throw new Error('no route found');
    return coords.map(([lng, lat]) => [lat, lng]);
  } catch (error) {
    console.warn('OSRM route failed, drawing a straight line:', error.message);
    return null;
  }
}

// Passenger or assigned driver only — nobody else's trip is visible.
exports.getRideRoute = (req, res) => {
  const { rideId } = req.params;
  const accountId = req.user.accountId;

  db.query(
    `SELECT pickup_lat, pickup_lng, dropoff_lat, dropoff_lng FROM rides
     WHERE ride_id = ? AND (passenger_account_id = ? OR driver_account_id = ?)`,
    [rideId, accountId, accountId],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'Ride not found.' });
      const from = normalizePoint({ lat: rows[0].pickup_lat, lng: rows[0].pickup_lng });
      const to = normalizePoint({ lat: rows[0].dropoff_lat, lng: rows[0].dropoff_lng });
      if (!from || !to) return res.status(200).json({ points: [] });

      const cacheKey = `${rideId}:${from.join(',')}:${to.join(',')}`;
      if (!rideRouteCache.has(cacheKey)) {
        const points = await getRoadRoutePoints(from, to);
        if (!points) return res.status(200).json({ points: [from, to], road: false });
        if (rideRouteCache.size > 500) rideRouteCache.clear();
        rideRouteCache.set(cacheKey, points);
      }
      res.status(200).json({ points: rideRouteCache.get(cacheKey), road: true });
    }
  );
};

// DRIVER declines a request: it leaves this driver's list only and stays
// open for everyone else (see rideDeclines.js). The passenger hears nothing
// unless no driver who could take it is left, when they get the choice to
// keep waiting or cancel.
exports.declineRide = (req, res) => {
  const { rideId } = req.params;
  const driverAccountId = req.user.accountId;
  if (req.user.role !== 'driver') return res.status(403).json({ error: 'Only drivers can decline a ride request.' });
  if (!hasDeclinesTable()) return res.status(503).json({ error: 'Declining is still starting up. Please try again in a moment.' });

  db.query(`SELECT passenger_account_id, status FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    if (rows[0].status !== 'Pending') return res.status(409).json({ error: 'This request is no longer open.' });
    const passengerAccountId = rows[0].passenger_account_id;

    db.query(
      `INSERT IGNORE INTO ride_declines (ride_id, driver_account_id) VALUES (?, ?)`,
      [rideId, driverAccountId],
      (insertErr) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(200).json({ message: 'Declined. The request stays open for other drivers.' });
        notifyIfNoDriversLeft(rideId, passengerAccountId);
      }
    );
  });
};

// Drivers who could still take the ride: approved, switched Online, with the
// app open (see getPresentDriverIds), not mid-trip, and not already declined.
function notifyIfNoDriversLeft(rideId, passengerAccountId) {
  const presentIds = getPresentDriverIds();
  if (!presentIds.length) return emitNoDriversLeft(passengerAccountId, Number(rideId));
  db.query(
    `SELECT COUNT(*) AS c FROM tricycle_driver td
     WHERE td.account_status = 'Active' AND td.is_online = TRUE AND td.account_id IN (?)
       AND td.account_id NOT IN (
         SELECT driver_account_id FROM rides
         WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress'))
       AND td.account_id NOT IN (SELECT driver_account_id FROM ride_declines WHERE ride_id = ?)`,
    [presentIds, rideId],
    (err, rows) => {
      if (err) return console.warn('Could not count remaining drivers:', err.message);
      if (Number(rows[0].c) === 0) emitNoDriversLeft(passengerAccountId, Number(rideId));
    }
  );
}

// ESTIMATED TIME OF ARRIVAL — how far the driver is, by road, from where
// they're headed next: the pickup while the ride is Accepted, the drop-off
// once the passenger is on board. Minutes come from that distance at an
// average tricycle speed rather than the routing server's own duration,
// which assumes a car. The free routing server has no traffic data, so this
// is an estimate. A result is reused while the driver hasn't moved
// ETA_MOVE_KM and it's younger than ETA_CACHE_MS, which keeps a busy trip
// from asking the routing server every few seconds.
const TRICYCLE_AVG_KMH = 20;
const ETA_CACHE_MS = 30 * 1000;
// Without the driver's own speed yet, a flat 20 km/h made long trips look
// absurd (20 km = an hour), since past the first few town streets a
// tricycle is on open highway. So the first ETA_TOWN_KM count at the town
// speed and the rest at ETA_OPEN_ROAD_KMH.
const ETA_TOWN_KM = 3;
const ETA_OPEN_ROAD_KMH = 35;
// tricycle_driver.current_lat/lng keep the driver's last position from
// whenever they last shared it, possibly another trip on another day. Older
// than this, it isn't where they are now, so the ETA waits for a fresh one.
const ETA_LOCATION_MAX_AGE_S = 120;

function defaultEtaMinutes(distanceKm) {
  const townKm = Math.min(distanceKm, ETA_TOWN_KM);
  const openKm = Math.max(0, distanceKm - ETA_TOWN_KM);
  return (townKm / TRICYCLE_AVG_KMH + openKm / ETA_OPEN_ROAD_KMH) * 60;
}

// The driver's real recent speed, from the location reports their phone
// already sends every few seconds during a trip (kept in memory only, last
// SPEED_WINDOW_MS). Lets the ETA follow actual conditions: clear roads
// shorten it, traffic lengthens it, without a paid traffic service. Bounded
// to SPEED_MIN/MAX_KMH so one red light or one fast stretch can't make the
// number jump about.
const SPEED_WINDOW_MS = 3 * 60 * 1000;
const SPEED_MIN_SPAN_MS = 60 * 1000;
const SPEED_MIN_KMH = 8;
const SPEED_MAX_KMH = 35;
const SPEED_STOPPED_KMH = 3;
const driverSpeedSamples = new Map();

function recordDriverSpeedSample(accountId, lat, lng) {
  const point = normalizePoint({ lat, lng });
  if (!point) return;
  const now = Date.now();
  const samples = (driverSpeedSamples.get(accountId) || []).filter(s => now - s.at <= SPEED_WINDOW_MS);
  samples.push({ point, at: now });
  driverSpeedSamples.set(accountId, samples);
  if (driverSpeedSamples.size > 1000) driverSpeedSamples.clear();
}

// Average km/h over the recent window, or null if there isn't a full minute
// of movement data yet (just accepted), in which case the plain average is
// used. Barely moving before pickup usually means the driver hasn't set off
// yet, so it keeps the average; barely moving with the passenger on board
// means traffic, so it drops to the slowest speed.
function estimateDriverSpeedKmh(accountId, phase) {
  const now = Date.now();
  const samples = (driverSpeedSamples.get(accountId) || []).filter(s => now - s.at <= SPEED_WINDOW_MS);
  if (samples.length < 2) return null;
  const spanMs = samples[samples.length - 1].at - samples[0].at;
  if (spanMs < SPEED_MIN_SPAN_MS) return null;
  let km = 0;
  for (let i = 1; i < samples.length; i++) km += haversineKm(samples[i - 1].point, samples[i].point);
  const observed = km / (spanMs / 3600000);
  if (observed < SPEED_STOPPED_KMH) return phase === 'to_dropoff' ? SPEED_MIN_KMH : null;
  return Math.min(SPEED_MAX_KMH, Math.max(SPEED_MIN_KMH, observed));
}
const ETA_MOVE_KM = 0.1;
const ETA_ARRIVING_KM = 0.15;
const etaCache = new Map();

exports.getRideEta = (req, res) => {
  const { rideId } = req.params;
  const accountId = req.user.accountId;

  db.query(
    `SELECT r.status, r.driver_account_id, r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng,
            td.current_lat, td.current_lng,
            TIMESTAMPDIFF(SECOND, td.location_updated_at, NOW()) AS location_age_s
     FROM rides r
     LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
     WHERE r.ride_id = ? AND (r.passenger_account_id = ? OR r.driver_account_id = ?)`,
    [rideId, accountId, accountId],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'Ride not found.' });
      const ride = rows[0];

      const phase = ride.status === 'Accepted' ? 'to_pickup'
        : ['Picked Up', 'In Progress'].includes(ride.status) ? 'to_dropoff'
        : null;
      if (!phase) return res.status(200).json({ phase: null });

      const target = phase === 'to_pickup'
        ? normalizePoint({ lat: ride.pickup_lat, lng: ride.pickup_lng })
        : normalizePoint({ lat: ride.dropoff_lat, lng: ride.dropoff_lng });
      const locationIsFresh = ride.location_age_s != null && Number(ride.location_age_s) <= ETA_LOCATION_MAX_AGE_S;
      const driverPoint = locationIsFresh ? normalizePoint({ lat: ride.current_lat, lng: ride.current_lng }) : null;
      // No fresh GPS from the driver yet (just accepted, or indoors): say so
      // rather than guess from an old position.
      if (!target || !driverPoint) return res.status(200).json({ phase, waiting: true });

      const cacheKey = `${rideId}:${phase}`;
      const cached = etaCache.get(cacheKey);
      let distanceKm;
      if (cached && Date.now() - cached.at < ETA_CACHE_MS && haversineKm(cached.from, driverPoint) < ETA_MOVE_KM) {
        distanceKm = cached.distanceKm;
      } else {
        // Already handles a slow or failed routing server with a buffered
        // straight-line distance, so an ETA never just disappears.
        distanceKm = Math.round((await getRoadDistanceKm(driverPoint, target)) * 10) / 10;
        if (etaCache.size > 500) etaCache.clear();
        etaCache.set(cacheKey, { from: driverPoint, distanceKm, at: Date.now() });
      }

      const speedKmh = estimateDriverSpeedKmh(ride.driver_account_id, phase);
      const minutes = Math.max(1, Math.round(speedKmh ? (distanceKm / speedKmh) * 60 : defaultEtaMinutes(distanceKm)));
      res.status(200).json({
        phase,
        distanceKm,
        minutes,
        arriving: phase === 'to_pickup' && distanceKm <= ETA_ARRIVING_KM
      });
    }
  );
};

// PASSENGER reads the location of the driver assigned to ONE of their own
// rides — scoped by ride_id + passenger_account_id so a passenger can never
// see a driver they aren't actually riding with.
exports.getDriverLocationForRide = (req, res) => {
  const { rideId } = req.params;
  const passengerAccountId = req.user.accountId;

  db.query(
    `SELECT td.current_lat, td.current_lng, td.location_updated_at
     FROM rides r
     JOIN tricycle_driver td ON td.account_id = r.driver_account_id
     WHERE r.ride_id = ? AND r.passenger_account_id = ?`,
    [rideId, passengerAccountId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'No assigned driver found for this ride.' });
      const row = rows[0];
      res.status(200).json({ lat: row.current_lat, lng: row.current_lng, updated_at: row.location_updated_at });
    }
  );
};

// DRIVER reads the pickup-spot GPS snapshot the passenger's browser captured
// when they requested this ride (may be null if they denied/lacked GPS) —
// scoped by ride_id + driver_account_id so a driver can only see this for a
// ride actually assigned to them.
exports.getPassengerLocationForRide = (req, res) => {
  const { rideId } = req.params;
  const driverAccountId = req.user.accountId;

  db.query(
    `SELECT pickup_lat, pickup_lng FROM rides WHERE ride_id = ? AND driver_account_id = ?`,
    [rideId, driverAccountId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows.length) return res.status(404).json({ error: 'Ride not found or not assigned to you.' });
      const row = rows[0];
      res.status(200).json({ lat: row.pickup_lat, lng: row.pickup_lng });
    }
  );
};

// PASSENGER attaches their GPS snapshot to a ride they just created. Split
// out from createRide so a slow/denied GPS lock never delays the "Ride
// requested" confirmation — the frontend fires this in the background right
// after the ride is created, once (if ever) the coordinates resolve.
exports.updateRidePickupLocation = (req, res) => {
  const { rideId } = req.params;
  const { lat, lng } = req.body;
  const passengerAccountId = req.user.accountId;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  db.query(
    `UPDATE rides SET pickup_lat = ?, pickup_lng = ? WHERE ride_id = ? AND passenger_account_id = ?`,
    [lat, lng, rideId, passengerAccountId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Ride not found' });
      res.status(200).json({ message: 'Pickup location updated' });
    }
  );
};

// DRIVER toggles whether they're currently on shift and open to new
// requests. This is separate from account_status (admin-approval, permanent)
// — is_online is the driver's own "I'm working right now" switch.
exports.updateDriverAvailability = (req, res) => {
  const accountId = req.user.accountId;
  const isOnline = Boolean(req.body.is_online);

  db.query(
    `UPDATE tricycle_driver SET is_online = ? WHERE account_id = ?`,
    [isOnline, accountId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Driver not found' });
      res.status(200).json({ is_online: isOnline });
      emitAvailabilityChanged();
    }
  );
};

// PASSENGER-FACING reassurance count — how many approved drivers are
// currently on shift AND not already in the middle of a trip. Doesn't name
// anyone (no driver-picking), just answers "is anyone around right now?".
// Also returns the total online count (busy or not) so the frontend can
// tell "nobody's online at all" apart from "drivers are online but all
// currently on a trip" — those read very differently to a waiting passenger.
// Both lists below also require the driver to have a dashboard open right now
// (see getPresentDriverIds in socket.js): is_online alone stays TRUE for a
// driver who closed the app without pressing Logout.
exports.getAvailableDriversCount = (req, res) => {
  const presentIds = getPresentDriverIds();
  if (!presentIds.length) return res.status(200).json({ count: 0, onlineCount: 0 });

  const sql = `
    SELECT
      COUNT(*) AS onlineCount,
      SUM(CASE WHEN account_id NOT IN (
        SELECT driver_account_id FROM rides
        WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress')
      ) THEN 1 ELSE 0 END) AS count
    FROM tricycle_driver
    WHERE account_status = 'Active' AND is_online = TRUE AND account_id IN (?)
  `;
  db.query(sql, [presentIds], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ count: Number(rows[0].count) || 0, onlineCount: rows[0].onlineCount });
  });
};

// PASSENGER-FACING safety list — same "available now" filter as the count
// above, but returns just enough to let a passenger confirm the tricycle
// that shows up is legit (name + plate number). Deliberately excludes
// contact number and live GPS — those stay scoped to a passenger's own
// assigned driver only (see getDriverLocationForRide), not exposed for
// every driver currently online.
exports.getAvailableDrivers = (req, res) => {
  const presentIds = getPresentDriverIds();
  if (!presentIds.length) return res.status(200).json({ drivers: [] });

  const sql = `
    SELECT CONCAT(first_name, ' ', last_name) AS name, plate_number, body_number
    FROM tricycle_driver
    WHERE account_status = 'Active' AND is_online = TRUE AND account_id IN (?)
      AND account_id NOT IN (
        SELECT driver_account_id FROM rides
        WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress')
      )
    ORDER BY first_name ASC
  `;
  db.query(sql, [presentIds], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ drivers: rows });
  });
};

// ACCEPT A RIDE (solo) OR A POOL (shared — closes it early if not yet full,
// locking the fare in at whatever headcount it has right now)
exports.acceptRide = (req, res) => {
  const { rideId } = req.params;
  const driver_account_id = req.user.accountId;

  // A driver can log in and browse ride requests while "Pending" (the admin
  // isn't watching the system 24/7) — but accepting an actual ride is where
  // approval matters, so that's where it's enforced.
  db.query(`SELECT account_status FROM tricycle_driver WHERE account_id = ?`, [driver_account_id], (err, statusRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!statusRows.length) return res.status(404).json({ error: 'Driver not found' });
    if (statusRows[0].account_status !== 'Active') {
      return res.status(403).json({ error: 'Your account is still pending admin approval — you can browse requests but cannot accept rides yet.' });
    }

    // A tricycle can only carry one trip at a time — a driver already mid-ride
    // (Accepted/Picked Up/In Progress) can't pick up a second, unrelated one
    // until the current trip is completed or cancelled.
    db.query(
      `SELECT COUNT(*) AS c FROM rides WHERE driver_account_id = ? AND status IN ('Accepted', 'Picked Up', 'In Progress')`,
      [driver_account_id],
      (err, activeRows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (activeRows[0].c > 0) {
          return res.status(409).json({ error: 'You already have an active ride — finish or cancel it before accepting another.' });
        }

        acceptRideInternal(rideId, driver_account_id, res);
      }
    );
  });
};

function acceptRideInternal(rideId, driver_account_id, res) {
  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    if (ride.ride_type === 'Solo' || !ride.pool_id) {
      // The WHERE clause only matches while the ride is still "Pending" — if
      // two drivers tap Accept on the same request at the same instant,
      // MySQL serializes the two UPDATEs against this row, so only the first
      // one actually finds status = 'Pending' and changes anything. The
      // loser's affectedRows comes back 0, telling them someone beat them to it
      // instead of both drivers being told "Ride accepted" for the same trip.
      db.query(
        `UPDATE rides SET status = 'Accepted', driver_account_id = ? WHERE ride_id = ? AND status = 'Pending'`,
        [driver_account_id, rideId],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          if (result.affectedRows === 0) {
            return res.status(409).json({ error: 'Another driver already accepted this ride.' });
          }
          res.status(200).json({ message: 'Ride accepted' });
          emitRideUpdated(ride.passenger_account_id, driver_account_id);
          emitAvailabilityChanged();
        }
      );
      return;
    }

    db.query(
      `SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`,
      [ride.pool_id],
      (err, countRows) => {
        if (err) return res.status(500).json({ error: err.message });
        const count = countRows[0].c;
        const fare = FARE_BY_HEADCOUNT[count] || FARE_BY_HEADCOUNT[1];

        // A 1-rider "Shared" pool is functionally just a Solo ride at the
        // same fare — accepting it defeats the point of the Shared option,
        // so require at least 2 riders before a driver can lock it in.
        if (count < 2) {
          return res.status(400).json({ error: 'This shared ride needs at least 2 riders before it can be accepted.' });
        }

        // Accepting early (fewer than 4 riders) does NOT close the pool —
        // other students can still join this exact trip, under this same
        // driver, right up until it fills to 4 or the driver actually
        // departs (see updateRideStatus's 'Picked Up' handling below). Only
        // a full pool closes for good here.
        //
        // The WHERE clause deliberately does NOT check status = 'Open':
        // createRide already flips a pool to 'Closed' the moment the 4th
        // rider joins, before any driver has looked at it — status tracks
        // "still taking new riders", not "already claimed by a driver".
        // Requiring 'Open' here meant a pool that filled up naturally
        // (4 passengers joining before a driver ever saw it) could never be
        // accepted by anyone — every driver's first attempt failed with
        // "Another driver already accepted", even though none had.
        // driver_account_id IS NULL is the actual, unambiguous "unclaimed"
        // check, and is sufficient on its own in every case.
        const isFull = count >= MAX_POOL_SIZE;
        const poolUpdateSql = isFull
          ? `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, driver_account_id = ?, closed_at = NOW() WHERE pool_id = ? AND driver_account_id IS NULL`
          : `UPDATE ride_pools SET fare_per_rider = ?, driver_account_id = ? WHERE pool_id = ? AND driver_account_id IS NULL`;

        // Same guard as the Solo path, applied to the pool: only succeeds if
        // no driver has claimed it yet. Checking status = 'Open' alone isn't
        // enough here — an early accept (under 4 riders) deliberately keeps
        // the pool "Open" so more riders can join, so a second driver's
        // accept would otherwise match the same row and silently overwrite
        // the first driver's claim. driver_account_id IS NULL is what
        // actually distinguishes "nobody's claimed this yet" from "still
        // accepting new riders under a driver who already has."
        db.query(
          poolUpdateSql,
          [fare, driver_account_id, ride.pool_id],
          (err, poolResult) => {
            if (err) return res.status(500).json({ error: err.message });
            if (poolResult.affectedRows === 0) {
              return res.status(409).json({ error: 'Another driver already accepted this shared ride.' });
            }
            db.query(
              `UPDATE rides SET status = 'Accepted', driver_account_id = ?, fare = ? WHERE pool_id = ? AND status != 'Cancelled'`,
              [driver_account_id, fare, ride.pool_id],
              (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(200).json({ message: 'Shared ride accepted', riderCount: count, fare, poolStillOpen: !isFull });
                db.query(`SELECT passenger_account_id FROM rides WHERE pool_id = ? AND status != 'Cancelled'`, [ride.pool_id], (err2, riderRows) => {
                  if (err2) return;
                  riderRows.forEach(r => emitRideUpdated(r.passenger_account_id, driver_account_id));
                });
                emitAvailabilityChanged();
              }
            );
          }
        );
      }
    );
  });
};

// PASSENGER escape hatch — if they're still the only rider in a Shared pool
// after waiting a while, let them switch that same request to Solo instead
// of waiting indefinitely for someone else to pick the same route.
exports.convertRideToSolo = (req, res) => {
  const { rideId } = req.params;
  const passengerAccountId = req.user.accountId;

  db.query(`SELECT * FROM rides WHERE ride_id = ? AND passenger_account_id = ?`, [rideId, passengerAccountId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    if (ride.status !== 'Pending' || ride.ride_type !== 'Shared') {
      return res.status(400).json({ error: 'This ride can no longer be converted.' });
    }

    db.query(`SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`, [ride.pool_id], (err, countRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (countRows[0].c > 1) {
        return res.status(400).json({ error: 'Other students have already joined this shared ride — it can no longer switch to Solo.' });
      }

      db.query(
        `UPDATE rides SET ride_type = 'Solo', pool_id = NULL, fare = ? WHERE ride_id = ? AND passenger_account_id = ? AND status = 'Pending'`,
        [FARE_BY_HEADCOUNT[1], rideId, passengerAccountId],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          if (result.affectedRows === 0) return res.status(409).json({ error: 'Could not convert this ride.' });
          res.status(200).json({ message: 'Switched to Solo', fare: FARE_BY_HEADCOUNT[1] });
          emitRideUpdated(passengerAccountId, null);
        }
      );
    });
  });
};

// DRIVER attaches an optional photo to a ride they just ended as Failed
// (sent separately, after the status change, so ending a ride never waits
// on an upload). Only the ride's own driver, only for a Failed ride; a new
// photo replaces the old one. The admin views it from Complaints.
exports.uploadFailedRidePhoto = (req, res) => {
  const { rideId } = req.params;
  const discard = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  if (!req.file) return res.status(400).json({ error: 'Choose a photo to upload.' });
  if (!hasFailureColumns()) {
    discard();
    return res.status(503).json({ error: 'Photos cannot be saved yet. Please try again in a minute.' });
  }

  db.query(`SELECT driver_account_id, status, failed_photo_path FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) { discard(); return res.status(500).json({ error: err.message }); }
    const ride = rows[0];
    if (!ride) { discard(); return res.status(404).json({ error: 'Ride not found' }); }
    if (String(ride.driver_account_id) !== String(req.user.accountId) || ride.status !== 'Failed') {
      discard();
      return res.status(403).json({ error: 'You can only add a photo to a ride you ended as Failed.' });
    }
    const relativePath = `uploads/failed-rides/${req.file.filename}`;
    db.query(`UPDATE rides SET failed_photo_path = ? WHERE ride_id = ?`, [relativePath, rideId], (err2) => {
      if (err2) { discard(); return res.status(500).json({ error: err2.message }); }
      if (ride.failed_photo_path) fs.unlink(path.join(__dirname, '..', ride.failed_photo_path), () => {});
      res.status(200).json({ message: 'Photo attached' });
    });
  });
};

// ADVANCE / CANCEL A RIDE'S STATUS.
// Cancelling only ever drops the one passenger who cancelled — everyone
// else in a shared trip keeps going. Every other status change (Picked Up,
// In Progress, Completed, Failed) is the whole tricycle moving together,
// so it cascades to every rider sharing that pool.
exports.updateRideStatus = (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;

  const validStatuses = ['Picked Up', 'In Progress', 'Completed', 'Cancelled', 'Failed', 'Declined'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Failed needs a reason and an explanation (see rideFailures.js).
  const failedReason = status === 'Failed' ? String(req.body.reason || '').trim() : null;
  const failedNote = status === 'Failed' ? String(req.body.note || '').trim().slice(0, 255) : null;
  if (status === 'Failed') {
    if (!FAILED_REASONS.includes(failedReason)) {
      return res.status(400).json({ error: 'Choose why the ride could not be completed.' });
    }
    if (!failedNote) {
      return res.status(400).json({ error: 'Explain briefly what happened.' });
    }
  }

  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    // A passenger already on board can't be cancelled on, by either side.
    // The driver's screen no longer offers it; this covers an old page.
    if (status === 'Cancelled' && ['Picked Up', 'In Progress'].includes(ride.status)) {
      return res.status(409).json({ error: 'This ride can no longer be cancelled because the passenger has already been picked up.' });
    }

    // Only the ride's own driver can end it as Failed.
    if (status === 'Failed' && String(ride.driver_account_id) !== String(req.user.accountId)) {
      return res.status(403).json({ error: 'Only the driver of this ride can end it as Failed.' });
    }

    // 'Declined' behaves like 'Cancelled' for cascade purposes — it only
    // ever applies to a single still-Pending ride (or, for a Shared pool
    // decline, every rider's ride_id is targeted individually by the
    // frontend's own loop — see the decline-pool handler in app.js), never
    // the whole-tricycle-moves-together cascade that Picked Up/Completed use.
    const cascadeToPool = !['Cancelled', 'Declined'].includes(status) && ride.pool_id;
    // Excludes riders who already left this pool (Cancelled/Completed/Failed/
    // Declined) — otherwise a later whole-trip status change (e.g. Picked Up)
    // would sweep them back up and resurrect a ride they already cancelled.
    // A Failed ride keeps its reason and explanation on the row (when the
    // columns exist, see rideFailures.js).
    const withFailure = status === 'Failed' && hasFailureColumns();
    const setClause = withFailure ? 'status = ?, failed_reason = ?, failed_note = ?' : 'status = ?';
    const setParams = withFailure ? [status, failedReason, failedNote] : [status];
    const sql = cascadeToPool
      ? `UPDATE rides SET ${setClause} WHERE pool_id = ? AND status NOT IN ('Cancelled', 'Completed', 'Failed', 'Declined')`
      : `UPDATE rides SET ${setClause} WHERE ride_id = ?`;
    const params = cascadeToPool ? [...setParams, ride.pool_id] : [...setParams, rideId];

    db.query(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Every Failed ride reaches the admin as a Complaints entry from the
      // driver (red "N pending" badge), against the passenger only when the
      // reason points at them, so the admin can review it and warn whoever
      // was at fault.
      if (status === 'Failed') {
        const againstPassenger = PASSENGER_REASONS.includes(failedReason);
        db.query(
          `INSERT INTO complaints (filed_by_account_id, against_account_id, ride_id, category, description)
           VALUES (?, ?, ?, ?, ?)`,
          [ride.driver_account_id, againstPassenger ? ride.passenger_account_id : null, ride.ride_id,
           `Ride failed: ${failedReason}`.slice(0, 50), failedNote],
          (complaintErr) => {
            if (complaintErr) return console.warn('Could not file the Failed-ride report', complaintErr.message);
            emitComplaintFiled();
          }
        );
      }

      // Whichever rides just changed, tell their passenger(s) + driver to
      // re-check live instead of waiting for their next poll. A terminal
      // status (Completed/Cancelled/Failed/Declined) also frees the driver
      // up, so passengers watching "N drivers available" need to know too.
      const notifyRideChange = () => {
        const freesDriver = ['Completed', 'Cancelled', 'Failed', 'Declined'].includes(status);
        if (cascadeToPool) {
          db.query(`SELECT passenger_account_id FROM rides WHERE pool_id = ? AND status != 'Cancelled'`, [ride.pool_id], (err3, riderRows) => {
            if (err3) return;
            riderRows.forEach(r => emitRideUpdated(r.passenger_account_id, ride.driver_account_id));
          });
        } else {
          emitRideUpdated(ride.passenger_account_id, ride.driver_account_id);
        }
        if (freesDriver) emitAvailabilityChanged();
      };

      // A Shared pool accepted early (under 4 riders) stays open to new
      // joiners until this exact moment — the driver actually departing.
      // From here on nobody new can join this trip, whatever headcount it
      // settled at.
      if (cascadeToPool && status === 'Picked Up') {
        db.query(
          `UPDATE ride_pools SET status = 'Closed', closed_at = COALESCE(closed_at, NOW()) WHERE pool_id = ?`,
          [ride.pool_id],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.status(200).json({ message: `Ride marked as ${status}` });
            notifyRideChange();
          }
        );
        return;
      }

      // Cancelling can leave a pool with a driver still attached but zero
      // riders left in it (everyone who was in it cancelled). An "Open" pool
      // with a driver_account_id is exactly what findPoolSql treats as
      // already-committed — so left alone, a totally unrelated future
      // request on the same route would silently inherit that stale driver
      // commitment and jump straight to "Accepted" for a trip the driver
      // never actually agreed to. Close it once it's genuinely empty.
      if (status === 'Cancelled' && ride.pool_id) {
        db.query(
          `SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`,
          [ride.pool_id],
          (err2, countRows) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const remaining = countRows[0].c;
            const finish = (err3) => {
              if (err3) return res.status(500).json({ error: err3.message });
              res.status(200).json({ message: `Ride marked as ${status}` });
              notifyRideChange();
            };
            if (remaining === 0) {
              db.query(
                `UPDATE ride_pools SET status = 'Closed', closed_at = COALESCE(closed_at, NOW()) WHERE pool_id = ? AND status = 'Open'`,
                [ride.pool_id],
                finish
              );
            } else {
              finish();
            }
          }
        );
        return;
      }

      res.status(200).json({ message: `Ride marked as ${status}` });
      notifyRideChange();
    });
  });
};

// LOYALTY / REWARDS — the certificate used to show itself automatically the
// moment a passenger/driver crossed 5 completed rides. Per the defense
// panel's actual ask, an ADMIN now has to explicitly grant it (see
// adminController.js's listLoyaltyOverview/grantLoyaltyCertificate) — this
// endpoint just reports progress and whatever was actually granted so far.
// Milestones repeat and escalate (5, then 10, then 15...), one grant row
// per certificate ever awarded, not just a single yes/no flag.
const LOYALTY_MILESTONE_STEP = 5;

function buildLoyaltyStatus(completedRides, grantRows) {
  const grantsCount = grantRows.length;
  const nextThreshold = (grantsCount + 1) * LOYALTY_MILESTONE_STEP;
  const latest = grantRows[0] || null;
  return {
    completedRides,
    nextThreshold,
    // How many of this leg's rides are already in (0-LOYALTY_MILESTONE_STEP),
    // for the progress ring/dots — always resets to a fresh 5-ride bar per
    // certificate instead of growing to fill an ever-larger threshold.
    progressWithinLeg: Math.min(LOYALTY_MILESTONE_STEP, Math.max(0, completedRides - grantsCount * LOYALTY_MILESTONE_STEP)),
    // True once they've crossed the next threshold but an admin hasn't
    // granted it yet — distinct from actually having the certificate.
    awaitingGrant: completedRides >= nextThreshold,
    // seenAt is only present once loyalty_certificates.seen_at exists (see
    // certificateSeen.js); the browser treats its absence as "can't tell".
    latestCertificate: latest ? {
      certificateId: latest.certificate_id,
      milestoneRides: latest.milestone_rides,
      grantedAt: latest.granted_at,
      ...(hasCertificateSeenColumn() ? { seenAt: latest.seen_at || null } : {})
    } : null
  };
}

// The owner has seen the "You earned a loyalty certificate!" popup for this
// certificate, so it isn't shown again on any device. Only their own.
exports.markCertificateSeen = (req, res) => {
  const { certificateId } = req.params;
  if (!hasCertificateSeenColumn()) return res.status(200).json({ saved: false });
  db.query(
    `UPDATE loyalty_certificates SET seen_at = NOW() WHERE certificate_id = ? AND account_id = ? AND seen_at IS NULL`,
    [certificateId, req.user.accountId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ saved: true });
    }
  );
};

exports.getLoyaltyStatus = (req, res) => {
  const accountId = req.user.accountId;

  db.query(
    `SELECT COUNT(*) AS completedRides FROM rides WHERE passenger_account_id = ? AND status = 'Completed'`,
    [accountId],
    (err, rideRows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(
        `SELECT certificate_id, milestone_rides, granted_at${hasCertificateSeenColumn() ? ', seen_at' : ''} FROM loyalty_certificates WHERE account_id = ? ORDER BY granted_at DESC`,
        [accountId],
        (err, certRows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json(buildLoyaltyStatus(rideRows[0].completedRides, certRows));
        }
      );
    }
  );
};

// Same milestone, counted against rides a driver has completed instead of
// requested — lets a driver earn the same in-app recognition passengers do.
exports.getDriverLoyaltyStatus = (req, res) => {
  const accountId = req.user.accountId;

  db.query(
    `SELECT COUNT(*) AS completedRides FROM rides WHERE driver_account_id = ? AND status = 'Completed'`,
    [accountId],
    (err, rideRows) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(
        `SELECT certificate_id, milestone_rides, granted_at${hasCertificateSeenColumn() ? ', seen_at' : ''} FROM loyalty_certificates WHERE account_id = ? ORDER BY granted_at DESC`,
        [accountId],
        (err, certRows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(200).json(buildLoyaltyStatus(rideRows[0].completedRides, certRows));
        }
      );
    }
  );
};
