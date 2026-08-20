const db = require('../config/db');
const { emitRideUpdated, emitNewPendingRide, emitDriverLocation, emitAvailabilityChanged } = require('../socket');

// Fare per rider, keyed by how many students end up in the tricycle.
// Solo is always headcount 1. Shared settles into whichever headcount
// the pool actually closes at (2, 3, or 4).
const FARE_BY_HEADCOUNT = { 1: 60, 2: 35, 3: 25, 4: 20 };
const MAX_POOL_SIZE = 4;

// CREATE A RIDE REQUEST
exports.createRide = (req, res) => {
  const passenger_account_id = req.user.accountId;
  const {
    pickup_location,
    dropoff_location,
    pickup_lat,
    pickup_lng,
    ride_type,
    scheduled_at,
    notes
  } = req.body;

  if (!passenger_account_id || !pickup_location || !dropoff_location || !ride_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (pickup_location === dropoff_location) {
    return res.status(400).json({ error: 'Pickup and drop-off must be different' });
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
        const sql = `
          INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, ride_type, fare, status, scheduled_at, notes)
          VALUES (?, ?, ?, ?, ?, 'Solo', ?, 'Pending', ?, ?)
        `;
        db.query(
          sql,
          [passenger_account_id, pickup_location, dropoff_location, pickup_lat || null, pickup_lng || null, FARE_BY_HEADCOUNT[1], scheduled_at || null, notes || null],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Ride requested', rideId: result.insertId, fare: FARE_BY_HEADCOUNT[1] });
            emitNewPendingRide();
          }
        );
        return;
      }

      if (ride_type !== 'Shared') {
        return res.status(400).json({ error: 'ride_type must be "Solo" or "Shared"' });
      }

      // Find the oldest still-open pool for this exact route with room left.
      // A pool stays "Open" even after a driver has already accepted it early
      // (see acceptRideInternal) — a new student can still join an in-progress
      // pool right up until it fills to 4 or the driver actually departs.
      const findPoolSql = `
        SELECT rp.pool_id, rp.driver_account_id, COUNT(r.ride_id) AS rider_count
        FROM ride_pools rp
        LEFT JOIN rides r ON r.pool_id = rp.pool_id AND r.status != 'Cancelled'
        WHERE rp.status = 'Open' AND rp.pickup_location = ? AND rp.dropoff_location = ?
        GROUP BY rp.pool_id
        HAVING rider_count < ?
        ORDER BY rp.created_at ASC
        LIMIT 1
      `;

      db.query(findPoolSql, [pickup_location, dropoff_location, MAX_POOL_SIZE], (err, pools) => {
        if (err) return res.status(500).json({ error: err.message });

        const joinPool = (poolId, poolDriverId) => {
          // If a driver is already assigned to this pool (accepted it early
          // while under 4 riders), a newly-joining student slots straight in
          // as "Accepted" under that same driver instead of going through a
          // separate Pending/Accept step.
          const initialStatus = poolDriverId ? 'Accepted' : 'Pending';
          const insertRideSql = `
            INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, pickup_lat, pickup_lng, ride_type, pool_id, driver_account_id, status, scheduled_at, notes)
            VALUES (?, ?, ?, ?, ?, 'Shared', ?, ?, ?, ?, ?)
          `;
          db.query(
            insertRideSql,
            [passenger_account_id, pickup_location, dropoff_location, pickup_lat || null, pickup_lng || null, poolId, poolDriverId || null, initialStatus, scheduled_at || null, notes || null],
            (err, result) => {
              if (err) return res.status(500).json({ error: err.message });

              db.query(
                `SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`,
                [poolId],
                (err, countRows) => {
                  if (err) return res.status(500).json({ error: err.message });
                  const count = countRows[0].c;

                  // Notifies everyone already sharing this pool (fare may
                  // have just re-settled for them too), plus the assigned
                  // driver if one's already committed to this trip — or, if
                  // nobody's accepted it yet, broadcasts to every driver
                  // browsing pending requests instead of one specific room.
                  const notifyPool = () => {
                    if (poolDriverId) {
                      db.query(`SELECT passenger_account_id FROM rides WHERE pool_id = ? AND status != 'Cancelled'`, [poolId], (err, riderRows) => {
                        if (err) return;
                        riderRows.forEach(r => emitRideUpdated(r.passenger_account_id, poolDriverId));
                      });
                    } else {
                      emitNewPendingRide();
                    }
                  };

                  const respond = () => {
                    res.status(201).json({ message: 'Ride requested', rideId: result.insertId, poolId, riderCount: count });
                    notifyPool();
                  };

                  // Fare re-settles across every rider already in the pool
                  // whenever the headcount changes, either because a driver
                  // is already committed to this trip (so the tier they'll
                  // actually pay should track reality as more join) or the
                  // pool has now filled to capacity.
                  if (poolDriverId || count >= MAX_POOL_SIZE) {
                    const fare = FARE_BY_HEADCOUNT[count] || FARE_BY_HEADCOUNT[MAX_POOL_SIZE];
                    const isFull = count >= MAX_POOL_SIZE;
                    const poolUpdateSql = isFull
                      ? `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, closed_at = NOW() WHERE pool_id = ?`
                      : `UPDATE ride_pools SET fare_per_rider = ? WHERE pool_id = ?`;
                    db.query(poolUpdateSql, [fare, poolId], (err) => {
                      if (err) return res.status(500).json({ error: err.message });
                      db.query(`UPDATE rides SET fare = ? WHERE pool_id = ? AND status != 'Cancelled'`, [fare, poolId], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
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
          db.query(
            `INSERT INTO ride_pools (pickup_location, dropoff_location, status) VALUES (?, ?, 'Open')`,
            [pickup_location, dropoff_location],
            (err, poolResult) => {
              if (err) return res.status(500).json({ error: err.message });
              joinPool(poolResult.insertId, null);
            }
          );
        }
      });
    }
  );
};

// LIST PENDING RIDES — for the driver dashboard. Shared rides are grouped
// by pool so a driver sees one card per tricycle trip, not one per rider.
exports.listPendingRides = (req, res) => {
  const sql = `
    SELECT r.ride_id, r.passenger_account_id, r.pickup_location, r.dropoff_location,
           r.ride_type, r.pool_id, r.fare, r.status, r.scheduled_at, r.notes, r.created_at,
           CONCAT(s.first_name, ' ', s.last_name) AS passenger_name,
           rp.status AS pool_status
    FROM rides r
    JOIN student s ON s.account_id = r.passenger_account_id
    LEFT JOIN ride_pools rp ON rp.pool_id = r.pool_id
    WHERE r.status = 'Pending'
    ORDER BY r.created_at ASC
  `;

  db.query(sql, (err, rows) => {
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
exports.getAvailableDriversCount = (req, res) => {
  const sql = `
    SELECT
      COUNT(*) AS onlineCount,
      SUM(CASE WHEN account_id NOT IN (
        SELECT driver_account_id FROM rides
        WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress')
      ) THEN 1 ELSE 0 END) AS count
    FROM tricycle_driver
    WHERE account_status = 'Active' AND is_online = TRUE
  `;
  db.query(sql, (err, rows) => {
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
  const sql = `
    SELECT CONCAT(first_name, ' ', last_name) AS name, plate_number, body_number
    FROM tricycle_driver
    WHERE account_status = 'Active' AND is_online = TRUE
      AND account_id NOT IN (
        SELECT driver_account_id FROM rides
        WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress')
      )
    ORDER BY first_name ASC
  `;
  db.query(sql, (err, rows) => {
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
        const isFull = count >= MAX_POOL_SIZE;
        const poolUpdateSql = isFull
          ? `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, driver_account_id = ?, closed_at = NOW() WHERE pool_id = ? AND status = 'Open' AND driver_account_id IS NULL`
          : `UPDATE ride_pools SET fare_per_rider = ?, driver_account_id = ? WHERE pool_id = ? AND status = 'Open' AND driver_account_id IS NULL`;

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

  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    // 'Declined' behaves like 'Cancelled' for cascade purposes — it only
    // ever applies to a single still-Pending ride (or, for a Shared pool
    // decline, every rider's ride_id is targeted individually by the
    // frontend's own loop — see the decline-pool handler in app.js), never
    // the whole-tricycle-moves-together cascade that Picked Up/Completed use.
    const cascadeToPool = !['Cancelled', 'Declined'].includes(status) && ride.pool_id;
    // Excludes riders who already left this pool (Cancelled/Completed/Failed/
    // Declined) — otherwise a later whole-trip status change (e.g. Picked Up)
    // would sweep them back up and resurrect a ride they already cancelled.
    const sql = cascadeToPool
      ? `UPDATE rides SET status = ? WHERE pool_id = ? AND status NOT IN ('Cancelled', 'Completed', 'Failed', 'Declined')`
      : `UPDATE rides SET status = ? WHERE ride_id = ?`;
    const params = cascadeToPool ? [status, ride.pool_id] : [status, rideId];

    db.query(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });

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

// LOYALTY / REWARDS — counts a passenger's completed rides against a fixed
// threshold. No new table: completed rides are already tracked in `rides`,
// so this is a pure read, no schema change needed.
const LOYALTY_THRESHOLD = 5;

exports.getLoyaltyStatus = (req, res) => {
  const accountId = req.user.accountId;

  db.query(
    `SELECT COUNT(*) AS completedRides FROM rides WHERE passenger_account_id = ? AND status = 'Completed'`,
    [accountId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const completedRides = rows[0].completedRides;
      res.status(200).json({
        completedRides,
        threshold: LOYALTY_THRESHOLD,
        eligible: completedRides >= LOYALTY_THRESHOLD
      });
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
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const completedRides = rows[0].completedRides;
      res.status(200).json({
        completedRides,
        threshold: LOYALTY_THRESHOLD,
        eligible: completedRides >= LOYALTY_THRESHOLD
      });
    }
  );
};
