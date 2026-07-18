CREATE DATABASE IF NOT EXISTS FoodRescueDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE FoodRescueDB;

-- Disable checks only while replacing either the original supplied schema or
-- this application's newer schema. Checks are restored immediately after.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS collection_claims;
DROP TABLE IF EXISTS CollectionClaims;
DROP TABLE IF EXISTS statistics;
DROP TABLE IF EXISTS food_listings;
DROP TABLE IF EXISTS FoodListings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  mobile_number VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Donor', 'Volunteer', 'Admin') NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
);

CREATE TABLE food_listings (
  listing_id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  food_name VARCHAR(120) NOT NULL,
  food_category ENUM('Bakery', 'Cooked Food', 'Fruit & Vegetables', 'Dairy', 'Packaged Food', 'Other') NOT NULL,
  description TEXT NOT NULL,
  quantity VARCHAR(100) NOT NULL,
  meals_estimate INT NOT NULL DEFAULT 1,
  pickup_address VARCHAR(500) NOT NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  donation_date DATETIME NOT NULL,
  expiry_date DATETIME NOT NULL,
  image_url VARCHAR(500) NULL,
  status ENUM('Available', 'Claimed', 'Collected', 'Delivered', 'Completed', 'Expired') NOT NULL DEFAULT 'Available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_food_donor FOREIGN KEY (donor_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_listing_status_expiry (status, expiry_date),
  INDEX idx_listing_category (food_category),
  FULLTEXT INDEX idx_listing_search (food_name, description, pickup_address)
);

CREATE TABLE collection_claims (
  claim_id INT AUTO_INCREMENT PRIMARY KEY,
  listing_id INT NOT NULL UNIQUE,
  volunteer_id INT NOT NULL,
  collection_status ENUM('Accepted', 'Collected', 'Delivered') NOT NULL DEFAULT 'Accepted',
  collection_time DATETIME NULL,
  delivery_time DATETIME NULL,
  confirmation_code CHAR(8) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_listing FOREIGN KEY (listing_id) REFERENCES food_listings(listing_id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_volunteer FOREIGN KEY (volunteer_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_claim_volunteer (volunteer_id, collection_status)
);

CREATE TABLE statistics (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  total_donations INT NOT NULL DEFAULT 0,
  total_meals_saved INT NOT NULL DEFAULT 0,
  total_collections INT NOT NULL DEFAULT 0,
  active_listings INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO statistics (total_donations, total_meals_saved, total_collections, active_listings)
VALUES (0, 0, 0, 0);
