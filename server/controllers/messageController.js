const db = require('../config/db');

// Confirms the requesting account is either the passenger or the driver on
// this ride before letting them read/send anything on its thread.
function findRideForParticipant(rideId, accountId, callback) {
  db.query(
    `SELECT ride_id, passenger_account_id, driver_account_id FROM rides WHERE ride_id = ?`,
    [rideId],
    (err, rows) => {
      if (err) return callback(err);
      if (!rows.length) return callback(null, null);
      const ride = rows[0];
      const isParticipant = ride.passenger_account_id === accountId || ride.driver_account_id === accountId;
      callback(null, isParticipant ? ride : null);
    }
  );
}

// GET the full message thread for one ride. Opening it also marks the OTHER
// party's messages as read, which is what clears the unread badge on their
// end (see the unread_message_count subquery in rideController.js).
exports.getMessages = (req, res) => {
  const { rideId } = req.params;
  const accountId = req.user.accountId;

  findRideForParticipant(rideId, accountId, (err, ride) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ride) return res.status(403).json({ error: 'You are not part of this ride.' });

    db.query(
      `SELECT message_id, sender_account_id, message, created_at
       FROM messages WHERE ride_id = ? ORDER BY created_at ASC`,
      [rideId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query(
          `UPDATE messages SET is_read = 1 WHERE ride_id = ? AND sender_account_id != ? AND is_read = 0`,
          [rideId, accountId]
        );

        res.status(200).json({ messages: rows });
      }
    );
  });
};

// POST a new message onto a ride's thread.
exports.sendMessage = (req, res) => {
  const { ride_id, message } = req.body;
  const accountId = req.user.accountId;

  if (!ride_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'ride_id and message are required' });
  }

  findRideForParticipant(ride_id, accountId, (err, ride) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ride) return res.status(403).json({ error: 'You are not part of this ride.' });

    db.query(
      `INSERT INTO messages (ride_id, sender_account_id, message) VALUES (?, ?, ?)`,
      [ride_id, accountId, message.trim()],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          message_id: result.insertId,
          ride_id,
          sender_account_id: accountId,
          message: message.trim()
        });
      }
    );
  });
};
