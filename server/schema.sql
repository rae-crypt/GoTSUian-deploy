-- GoTSUian database schema
-- Reproduces every table queried by server/controllers/authController.js.
-- This file did not exist anywhere in the repo, so the database structure
-- was only reproducible on whichever machine originally created it by hand.
--
-- Usage: run this once against an empty database matching DB_NAME in server/.env
--   mysql -u <DB_USER> -p < schema.sql

CREATE DATABASE IF NOT EXISTS gotsuian_db;
USE gotsuian_db;

-- Shared login table for students (passengers) and drivers.
-- Admins are intentionally separate (see `administrator` below) since
-- authController.loginAdmin queries a dedicated table, not this one.
CREATE TABLE IF NOT EXISTS user_account (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'driver') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  student_number VARCHAR(10) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  age INT,
  sex ENUM('male', 'female', 'other'),
  contact_number VARCHAR(20),
  current_address VARCHAR(255),
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (account_id) REFERENCES user_account(account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tricycle_driver (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  driver_license_no VARCHAR(50) NOT NULL,
  license_document_path VARCHAR(255) NULL,
  account_status ENUM('Pending', 'Active', 'Rejected') NOT NULL DEFAULT 'Pending',
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  current_lat DECIMAL(10,7) NULL,
  current_lng DECIMAL(10,7) NULL,
  location_updated_at DATETIME NULL,
  birth_date DATE,
  age INT,
  sex ENUM('male', 'female', 'other'),
  contact_number VARCHAR(20),
  current_address VARCHAR(255),
  FOREIGN KEY (account_id) REFERENCES user_account(account_id) ON DELETE CASCADE
);

-- Admin accounts live in their own table (not user_account), matching
-- authController.loginAdmin / registerAdmin.
CREATE TABLE IF NOT EXISTS administrator (
  admin_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  account_status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS administrator_profile (
  admin_id INT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  contact_number VARCHAR(20),
  FOREIGN KEY (admin_id) REFERENCES administrator(admin_id) ON DELETE CASCADE
);

-- A "Shared" pool represents one tricycle trip that can carry 2-4 students
-- going the same route. It opens when the first "Shared" rider requests that
-- route, and closes (locking in the per-rider fare) either when it fills up
-- to 4, or when a driver accepts it early with fewer riders aboard.
CREATE TABLE IF NOT EXISTS ride_pools (
  pool_id INT AUTO_INCREMENT PRIMARY KEY,
  pickup_location VARCHAR(100) NOT NULL,
  dropoff_location VARCHAR(100) NOT NULL,
  status ENUM('Open', 'Closed') NOT NULL DEFAULT 'Open',
  fare_per_rider DECIMAL(6,2) NULL,
  driver_account_id INT NULL,
  -- NULL means "leave now". A pool only ever holds riders who all picked
  -- the same departure slot (see SCHEDULE_POOL_MATCH_TOLERANCE_MINUTES in
  -- rideController.js) -- a "leave now" rider and a "scheduled in 1 hour"
  -- rider never share a pool.
  scheduled_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_account_id) REFERENCES user_account(account_id)
);

-- One row per student's booking. "Solo" rides never touch ride_pools and
-- are always fare = 60. "Shared" rides point at a ride_pools row; every
-- rider in that pool ends up with the same fare once the pool closes.
CREATE TABLE IF NOT EXISTS rides (
  ride_id INT AUTO_INCREMENT PRIMARY KEY,
  passenger_account_id INT NOT NULL,
  driver_account_id INT NULL,
  pickup_location VARCHAR(100) NOT NULL,
  dropoff_location VARCHAR(100) NOT NULL,
  pickup_lat DECIMAL(10,7) NULL,
  pickup_lng DECIMAL(10,7) NULL,
  ride_type ENUM('Solo', 'Shared') NOT NULL DEFAULT 'Solo',
  pool_id INT NULL,
  fare DECIMAL(6,2) NULL,
  status ENUM('Pending', 'Accepted', 'Picked Up', 'In Progress', 'Completed', 'Cancelled', 'Failed', 'Declined') NOT NULL DEFAULT 'Pending',
  scheduled_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (driver_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (pool_id) REFERENCES ride_pools(pool_id)
);

-- One review per completed ride, left by the passenger for the driver who
-- served it. UNIQUE(ride_id) is what stops a ride from being reviewed twice.
CREATE TABLE IF NOT EXISTS reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL UNIQUE,
  passenger_account_id INT NOT NULL,
  driver_account_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ride_id) REFERENCES rides(ride_id),
  FOREIGN KEY (passenger_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (driver_account_id) REFERENCES user_account(account_id),
  CHECK (rating BETWEEN 1 AND 5)
);

-- A passenger or driver can file a complaint against the other party,
-- optionally tied to a specific ride. Resolving a complaint can (but doesn't
-- have to) result in a row in `violations`.
CREATE TABLE IF NOT EXISTS complaints (
  complaint_id INT AUTO_INCREMENT PRIMARY KEY,
  filed_by_account_id INT NOT NULL,
  against_account_id INT NULL,
  ride_id INT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Pending', 'Reviewed', 'Resolved') NOT NULL DEFAULT 'Pending',
  admin_notes TEXT NULL,
  resolved_by_admin_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (filed_by_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (against_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (ride_id) REFERENCES rides(ride_id),
  FOREIGN KEY (resolved_by_admin_id) REFERENCES administrator(admin_id)
);

-- A warning or violation issued by an admin against a driver/passenger's
-- account. `complaint_id` is nullable — an admin can issue one directly
-- (e.g. a pattern they noticed) without a filed complaint behind it.
CREATE TABLE IF NOT EXISTS violations (
  violation_id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  issued_by_admin_id INT NOT NULL,
  complaint_id INT NULL,
  severity ENUM('Warning', 'Violation') NOT NULL,
  reason TEXT NOT NULL,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (issued_by_admin_id) REFERENCES administrator(admin_id),
  FOREIGN KEY (complaint_id) REFERENCES complaints(complaint_id)
);

-- === Auth redesign migration (run against an EXISTING database) ===
-- CREATE TABLE IF NOT EXISTS above won't touch tricycle_driver since it
-- already exists, so run this ALTER + the new email_otp table by hand in
-- MySQL Workbench:

ALTER TABLE tricycle_driver ADD COLUMN license_document_path VARCHAR(255) NULL AFTER driver_license_no;

-- Short-lived codes for verifying a passenger's personal email inbox
-- before their account is created. A row is consumed (deleted) the moment
-- registration succeeds; `verified` distinguishes an entered-correctly code
-- from one that was only ever sent.
CREATE TABLE IF NOT EXISTS email_otp (
  otp_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_otp_email (email)
);

-- === "Chat with your Rider" migration (run against an EXISTING database) ===
-- One thread per ride, between that ride's passenger and driver only.
-- `is_read` powers the unread-message badge: a message counts as read once
-- the OTHER party opens the chat for that ride (see messageController.js).
CREATE TABLE IF NOT EXISTS messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  ride_id INT NOT NULL,
  sender_account_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ride_id) REFERENCES rides(ride_id),
  FOREIGN KEY (sender_account_id) REFERENCES user_account(account_id)
);

-- === GPS pickup-spot migration (run against an EXISTING database) ===
-- A one-time snapshot of the passenger's real coordinates at the moment
-- they requested the ride (not continuously updated, unlike the driver's
-- current_lat/current_lng) — lets the driver see roughly where the
-- passenger actually is, not just the fixed campus point they picked.
ALTER TABLE rides ADD COLUMN pickup_lat DECIMAL(10,7) NULL AFTER dropoff_location;
ALTER TABLE rides ADD COLUMN pickup_lng DECIMAL(10,7) NULL AFTER pickup_lat;

-- === Driver plate number migration (run against an EXISTING database) ===
-- Shown to passengers in the "drivers available now" list so they can
-- confirm the tricycle that shows up actually matches who they were told
-- to expect (safety, not just informational). Format: 2 letters + hyphen +
-- 5 digits (e.g. CD-64318), enforced client + server side.
ALTER TABLE tricycle_driver ADD COLUMN plate_number VARCHAR(20) NULL AFTER driver_license_no;

-- === Driver body number migration (run against an EXISTING database) ===
-- The TODA-issued unit number painted on the tricycle body — a separate
-- real-world identifier from the LTO plate number above. Format: 5 digits.
ALTER TABLE tricycle_driver ADD COLUMN body_number VARCHAR(10) NULL AFTER plate_number;

-- === "Declined" ride status migration (run against an EXISTING database) ===
-- Previously a driver declining a request just set status = 'Cancelled',
-- indistinguishable from the passenger cancelling their own request — the
-- passenger got no notification either way. 'Declined' is a distinct
-- terminal status so the passenger-side milestone popup can specifically
-- say "the driver declined your request" instead of staying silent.
ALTER TABLE rides MODIFY COLUMN status ENUM('Pending', 'Accepted', 'Picked Up', 'In Progress', 'Completed', 'Cancelled', 'Failed', 'Declined') NOT NULL DEFAULT 'Pending';

-- === Warning escalation-on-repeat migration (run against an EXISTING database) ===
-- Marks a violations row as auto-escalated (a 2nd Warning on the same
-- account gets inserted as a Violation instead, per complaintController.js's
-- issueViolation) rather than an admin directly choosing "Violation" — lets
-- the account-standing UI label it distinctly and keeps this auditable.
ALTER TABLE violations ADD COLUMN escalated BOOLEAN NOT NULL DEFAULT FALSE AFTER reason;

-- === Passenger online-status migration (run against an EXISTING database) ===
-- Same is_online flag tricycle_driver already has, flipped on at
-- loginStudent and off at the new POST /api/auth/logout/student — lets
-- Admin's Passenger management panel show who's actually logged in right
-- now instead of the old "has ever booked a ride" heuristic.
ALTER TABLE student ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE;
