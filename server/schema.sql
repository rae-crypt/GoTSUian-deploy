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
  FOREIGN KEY (account_id) REFERENCES user_account(account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tricycle_driver (
  driver_id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  driver_license_no VARCHAR(50) NOT NULL,
  account_status ENUM('Pending', 'Active', 'Rejected') NOT NULL DEFAULT 'Pending',
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
  ride_type ENUM('Solo', 'Shared') NOT NULL DEFAULT 'Solo',
  pool_id INT NULL,
  fare DECIMAL(6,2) NULL,
  status ENUM('Pending', 'Accepted', 'Picked Up', 'In Progress', 'Completed', 'Cancelled', 'Failed') NOT NULL DEFAULT 'Pending',
  scheduled_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (passenger_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (driver_account_id) REFERENCES user_account(account_id),
  FOREIGN KEY (pool_id) REFERENCES ride_pools(pool_id)
);
