const db = require('../config/db');

// Fare per rider, keyed by how many students end up in the tricycle.
// Solo is always headcount 1. Shared settles into whichever headcount
// the pool actually closes at (2, 3, or 4).
const FARE_BY_HEADCOUNT = { 1: 60, 2: 30, 3: 25, 4: 20 };
const MAX_POOL_SIZE = 4;

// CREATE A RIDE REQUEST
exports.createRide = (req, res) => {
  const {
    passenger_account_id,
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
  const { accountId } = req.params;
  const sql = `
    SELECT r.*, CONCAT(td.first_name, ' ', td.last_name) AS driver_name
    FROM rides r
    LEFT JOIN tricycle_driver td ON td.account_id = r.driver_account_id
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
  const { accountId } = req.params;
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

// ACCEPT A RIDE (solo) OR A POOL (shared — closes it early if not yet full,
// locking the fare in at whatever headcount it has right now)
exports.acceptRide = (req, res) => {
  const { rideId } = req.params;
  const { driver_account_id } = req.body;

  if (!driver_account_id) return res.status(400).json({ error: 'driver_account_id is required' });

  // A driver can log in and browse ride requests while "Pending" (the admin
  // isn't watching the system 24/7) — but accepting an actual ride is where
  // approval matters, so that's where it's enforced.
  db.query(`SELECT account_status FROM tricycle_driver WHERE account_id = ?`, [driver_account_id], (err, statusRows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!statusRows.length) return res.status(404).json({ error: 'Driver not found' });
    if (statusRows[0].account_status !== 'Active') {
      return res.status(403).json({ error: 'Your account is still pending admin approval — you can browse requests but cannot accept rides yet.' });
    }

    acceptRideInternal(rideId, driver_account_id, res);
  });
};

function acceptRideInternal(rideId, driver_account_id, res) {
  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [rideId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found' });
    const ride = rows[0];

    if (ride.ride_type === 'Solo' || !ride.pool_id) {
      db.query(
        `UPDATE rides SET status = 'Accepted', driver_account_id = ? WHERE ride_id = ?`,
        [driver_account_id, rideId],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
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

        db.query(
          `UPDATE ride_pools SET status = 'Closed', fare_per_rider = ?, driver_account_id = ?, closed_at = NOW() WHERE pool_id = ?`,
          [fare, driver_account_id, ride.pool_id],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
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
