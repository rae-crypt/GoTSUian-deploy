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

// A driver's is_online flag only goes back off when they press Logout, so a
// driver who just closed the tab, lost signal or let their phone die stayed
// listed as online indefinitely. Passenger-facing availability therefore
// also requires a live socket: every open driver page holds one. Moving
// between pages drops and reopens it, so a driver whose last socket closes
// is kept for a grace period before being dropped from the list.
const PRESENCE_GRACE_MS = 60 * 1000;
const driverSockets = new Map();   // accountId -> number of open sockets
const driverGraceTimers = new Map();

function markDriverConnected(accountId) {
  const wasPresent = isDriverPresent(accountId);
  clearTimeout(driverGraceTimers.get(accountId));
  driverGraceTimers.delete(accountId);
  driverSockets.set(accountId, (driverSockets.get(accountId) || 0) + 1);
  if (!wasPresent) emitAvailabilityChanged();
}

function markDriverDisconnected(accountId) {
  const remaining = (driverSockets.get(accountId) || 1) - 1;
  if (remaining > 0) return driverSockets.set(accountId, remaining);
  driverSockets.delete(accountId);
  driverGraceTimers.set(accountId, setTimeout(() => {
    driverGraceTimers.delete(accountId);
    emitAvailabilityChanged();
  }, PRESENCE_GRACE_MS));
}

function isDriverPresent(accountId) {
  return driverSockets.has(accountId) || driverGraceTimers.has(accountId);
}

function getPresentDriverIds() {
  return [...new Set([...driverSockets.keys(), ...driverGraceTimers.keys()])];
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
      markDriverConnected(user.accountId);
      socket.on('disconnect', () => markDriverDisconnected(user.accountId));
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

// A certificate is granted by an admin acting on someone else's account, so
// the recipient has no reason to reload just then — without this their
// loyalty card kept showing the old count until they happened to refresh.
function emitLoyaltyGranted(accountId) {
  if (!io || !accountId) return;
  io.to(accountRoom(accountId)).emit('loyalty:granted');
}

module.exports = {
  initSocket,
  getIO,
  getPresentDriverIds,
  emitRideUpdated,
  emitNewPendingRide,
  emitDriverLocation,
  emitAvailabilityChanged,
  emitDriverAccountStatus,
  emitChatMessage,
  emitComplaintUpdated,
  emitViolationIssued,
  emitLoyaltyGranted
};
