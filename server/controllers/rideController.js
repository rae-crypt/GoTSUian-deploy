const db = require('../config/db');

// Fare per rider, keyed by how many students end up in the tricycle.
// Solo is always headcount 1. Shared settles into whichever headcount
// the pool actually closes at (2, 3, or 4).
const FARE_BY_HEADCOUNT = { 1: 60, 2: 30, 3: 25, 4: 20 };
const MAX_POOL_SIZE = 4;

// CREATE A RIDE REQUEST
exports.createRide = (req, res) => {
  const passenger_account_id = req.user.accountId;
  const {
    pickup_location,
    dropoff_location,
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

  if (ride_type === 'Solo') {
    const sql = `
      INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, ride_type, fare, status, scheduled_at, notes)
      VALUES (?, ?, ?, 'Solo', ?, 'Pending', ?, ?)
    `;
    db.query(
      sql,
      [passenger_account_id, pickup_location, dropoff_location, FARE_BY_HEADCOUNT[1], scheduled_at || null, notes || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Ride requested', rideId: result.insertId, fare: FARE_BY_HEADCOUNT[1] });
      }
    );
    return;
  }

  if (ride_type !== 'Shared') {
    return res.status(400).json({ error: 'ride_type must be "Solo" or "Shared"' });
  }

  // Find the oldest still-open pool for this exact route with room left.
  const findPoolSql = `
    SELECT rp.pool_id, COUNT(r.ride_id) AS rider_count
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

    const joinPool = (poolId) => {
      const insertRideSql = `
        INSERT INTO rides (passenger_account_id, pickup_location, dropoff_location, ride_type, pool_id, status, scheduled_at, notes)
        VALUES (?, ?, ?, 'Shared', ?, 'Pending', ?, ?)
      `;
      db.query(
        insertRideSql,
        [passenger_account_id, pickup_location, dropoff_location, poolId, scheduled_at || null, notes || null],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });

          db.query(
            `SELECT COUNT(*) AS c FROM rides WHERE pool_id = ? AND status != 'Cancelled'`,
            [poolId],
            (err, countRows) => {
              if (err) return res.status(500).json({ error: err.message });
              const count = countRows[0].c;

              const respond = () => res.status(201).json({ message: 'Ride requested', rideId: result.insertId, poolId, riderCount: count });

              if (count >= MAX_POOL_SIZE) {
                const fare = FARE_BY_HEADCOUNT[MAX_POOL_SIZE];
                db.query(`UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, closed_at = NOW() WHERE pool_id = ?`, [fare, poolId], (err) => {
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
      joinPool(pools[0].pool_id);
    } else {
      db.query(
        `INSERT INTO ride_pools (pickup_location, dropoff_location, status) VALUES (?, ?, 'Open')`,
        [pickup_location, dropoff_location],
        (err, poolResult) => {
          if (err) return res.status(500).json({ error: err.message });
          joinPool(poolResult.insertId);
        }
      );
    }
  });
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
           td.contact_number AS driver_contact,
           rv.review_id IS NOT NULL AS has_review, rv.rating AS my_rating
    FROM rides r
    LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
    LEFT JOIN reviews rv ON rv.ride_id = r.ride_id
    WHERE r.passenger_account_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [accountId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ rides: rows });
  });
};

// GET A DRIVER'S OWN ACCEPTED/COMPLETED RIDES
exports.getDriverRides = (req, res) => {
  const accountId = req.user.accountId;
  const sql = `
    SELECT r.*, CONCAT(s.first_name, ' ', s.last_name) AS passenger_name
    FROM rides r
    JOIN student s ON s.account_id = r.passenger_account_id
    WHERE r.driver_account_id = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [accountId], (err, rows) => {
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
    }
  );
};

// PASSENGER-FACING reassurance count — how many approved drivers are
// currently on shift AND not already in the middle of a trip. Doesn't name
// anyone (no driver-picking), just answers "is anyone around right now?".
exports.getAvailableDriversCount = (req, res) => {
  const sql = `
    SELECT COUNT(*) AS count FROM tricycle_driver
    WHERE account_status = 'Active' AND is_online = TRUE
      AND account_id NOT IN (
        SELECT driver_account_id FROM rides
        WHERE driver_account_id IS NOT NULL AND status IN ('Accepted', 'Picked Up', 'In Progress')
      )
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json({ count: rows[0].count });
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

        // Same guard as the Solo path, applied to the pool: only succeeds if
        // the pool is still "Open" at the moment this UPDATE runs, so two
        // drivers racing to accept the same shared pool can't both close it.
        db.query(
          `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, driver_account_id = ?, closed_at = NOW() WHERE pool_id = ? AND status = 'Open'`,
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
                res.status(200).json({ message: 'Shared ride accepted', riderCount: count, fare });
              }
            );
          }
        );
      }
    );
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

  const validStatuses = ['Picked Up', 'In Progress', 'Completed', 'Cancelled', 'Failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    const cascadeToPool = status !== 'Cancelled' && ride.pool_id;
    const sql = cascadeToPool
      ? `UPDATE rides SET status = ? WHERE pool_id = ?`
      : `UPDATE rides SET status = ? WHERE ride_id = ?`;
    const params = cascadeToPool ? [status, ride.pool_id] : [status, rideId];

    db.query(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(200).json({ message: `Ride marked as ${status}` });
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
