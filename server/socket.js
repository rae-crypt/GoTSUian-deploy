const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

// Every push notification in this app is scoped to one of two room shapes:
// a single account (student/driver, keyed by accountId — matches JWT
// payload shape from authController.js) or a shared broadcast room for
// passengers watching driver availability. Admins join their own
// account-shaped room too (keyed by adminId, since that's what their JWT
// carries — see authController.js's loginAdmin).
function accountRoom(accountId) {
  return `account:${accountId}`;
}

// Attaches Socket.IO to the existing HTTP server. Called once from
// server/app.js after the http.createServer() wrap.
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*'
    }
  });

  // Same JWT the REST API already trusts (authMiddleware.js) — the client
  // sends the same token it already has in storage, just via the Socket.IO
  // handshake instead of an Authorization header.
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Missing auth token'));
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Invalid or expired token'));
      socket.data.user = decoded;
      next();
    });
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const id = user.role === 'admin' ? user.adminId : user.accountId;
    socket.join(accountRoom(id));
    if (user.role === 'passenger' || user.role === 'student') {
      socket.join('passengers');
    }
    if (user.role === 'driver') {
      socket.join('drivers');
    }
  });

  return io;
}

function getIO() {
  return io;
}

// A ride always has a passenger and (once accepted) a driver — this covers
// every controller spot that just changed a ride and wants both sides to
// re-check it live instead of waiting for their next poll.
function emitRideUpdated(passengerAccountId, driverAccountId) {
  if (!io) return;
  if (passengerAccountId) io.to(accountRoom(passengerAccountId)).emit('ride:updated');
  if (driverAccountId) io.to(accountRoom(driverAccountId)).emit('ride:updated');
}

// A brand-new Pending ride isn't assigned to any one driver yet — every
// online driver's dashboard is browsing the shared pending-requests list,
// so this is a broadcast rather than an account-scoped emit.
function emitNewPendingRide() {
  if (!io) return;
  io.to('drivers').emit('ride:updated');
}

function emitDriverLocation(passengerAccountId) {
  if (!io || !passengerAccountId) return;
  io.to(accountRoom(passengerAccountId)).emit('driver:location');
}

// Broadcast, not account-scoped — every passenger dashboard's "N drivers
// available" indicator cares about this regardless of which ride (if any)
// they're on.
function emitAvailabilityChanged() {
  if (!io) return;
  io.to('passengers').emit('drivers:availability-changed');
}

function emitDriverAccountStatus(driverAccountId) {
  if (!io || !driverAccountId) return;
  io.to(accountRoom(driverAccountId)).emit('driver:account-status-changed');
}

function emitChatMessage(recipientAccountId) {
  if (!io || !recipientAccountId) return;
  io.to(accountRoom(recipientAccountId)).emit('chat:message');
}

// The filer of a complaint cares the moment admin marks it Reviewed/Resolved
// — previously this only ever showed up on their next page load.
function emitComplaintUpdated(filedByAccountId) {
  if (!io || !filedByAccountId) return;
  io.to(accountRoom(filedByAccountId)).emit('complaint:updated');
}

// Same gap on the other side — a Warning/Violation should reach the
// account's standing card live, not just after their next refresh.
function emitViolationIssued(accountId) {
  if (!io || !accountId) return;
  io.to(accountRoom(accountId)).emit('violation:issued');
}

module.exports = {
  initSocket,
  getIO,
  emitRideUpdated,
  emitNewPendingRide,
  emitDriverLocation,
  emitAvailabilityChanged,
  emitDriverAccountStatus,
  emitChatMessage,
  emitComplaintUpdated,
  emitViolationIssued
};
