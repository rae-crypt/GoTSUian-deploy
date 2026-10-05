// Cancelling a ride needs a reason and a short explanation, answered BEFORE
// the ride is cancelled (IT expert review, 2026-10-06: a ride used to be
// cancelled first and only reported on afterwards, if at all). The lists are
// per role, since each side can only speak to what the other did.
//
// When a driver was already assigned, the cancellation reaches the admin as
// a Complaints entry (see updateRideStatus in rideController.js), filed
// against the other side only when the reason points at them. A request
// cancelled while still waiting for a driver affects nobody, so it isn't
// sent to the admin.

const PASSENGER_CANCEL_REASONS = [
  'Waiting too long for a driver',
  'Driver is taking too long',
  'Driver asked me to cancel',
  'Driver is not responding',
  'Changed my plans',
  'Booked by mistake',
  'Other'
];

const DRIVER_CANCEL_REASONS = [
  'Passenger not at the pickup point',
  'Passenger is not responding',
  'Passenger asked me to cancel',
  'Tricycle problem',
  'Other'
];

// Reasons that point at the other side of the ride.
const CANCEL_REASONS_AGAINST_OTHER = [
  'Driver asked me to cancel',
  'Driver is not responding',
  'Passenger not at the pickup point',
  'Passenger is not responding'
];

module.exports = { PASSENGER_CANCEL_REASONS, DRIVER_CANCEL_REASONS, CANCEL_REASONS_AGAINST_OTHER };
