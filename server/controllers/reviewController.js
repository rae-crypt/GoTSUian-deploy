const db = require('../config/db');

// PASSENGER leaves a review for the driver of one of their completed rides.
exports.createReview = (req, res) => {
  const passenger_account_id = req.user.accountId;
  const { ride_id, rating, comment } = req.body;

  const ratingNum = Number(rating);
  if (!ride_id || !ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'A ride and a rating from 1 to 5 are required.' });
  }

  db.query(`SELECT * FROM rides WHERE ride_id = ?`, [ride_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: 'Ride not found.' });
    const ride = rows[0];

    if (ride.passenger_account_id !== passenger_account_id) {
      return res.status(403).json({ error: 'You can only review your own rides.' });
    }
    if (ride.status !== 'Completed' || !ride.driver_account_id) {
      return res.status(400).json({ error: 'You can only review a ride after it has been completed.' });
    }

    db.query(
      `INSERT INTO reviews (ride_id, passenger_account_id, driver_account_id, rating, comment) VALUES (?, ?, ?, ?, ?)`,
      [ride_id, passenger_account_id, ride.driver_account_id, ratingNum, comment || null],
      (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'You already reviewed this ride.' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Review submitted' });
      }
    );
  });
};

// DRIVER views their own reviews, plus an average rating summary.
exports.getMyReviews = (req, res) => {
  const driver_account_id = req.user.accountId;

  db.query(
    `SELECT rv.rating, rv.comment, rv.created_at, CONCAT(s.first_name, ' ', s.last_name) AS passenger_name
     FROM reviews rv
     JOIN student s ON s.account_id = rv.passenger_account_id
     WHERE rv.driver_account_id = ?
     ORDER BY rv.created_at DESC`,
    [driver_account_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const count = rows.length;
      const average = count ? rows.reduce((sum, r) => sum + r.rating, 0) / count : 0;
      res.status(200).json({ reviews: rows, average: Math.round(average * 10) / 10, count });
    }
  );
};
