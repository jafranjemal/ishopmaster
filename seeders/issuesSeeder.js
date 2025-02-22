const mongoose = require("mongoose");
const ReportedIssue = require("../models/ReportedIssue");
require("dotenv").config();
const MONGO_URI =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_URI
    : process.env.LOCAL_URI;

const issues = [
  "Battery Draining Fast",
  "Battery Not Charging",
  "Battery Overheating",
  "Battery Swollen",
  "Screen Cracked",
  "Screen Not Responding",
  "Dead Pixels",
  "Screen Flickering",
  "Screen Burn-In",
  "Home Button Not Working",
  "Power Button Not Working",
  "Volume Button Not Working",
  "Mute Switch Not Working",
  "Front Camera Not Working",
  "Rear Camera Not Working",
  "Camera Blurry",
  "Camera Flash Not Working",
  "Speaker Not Working",
  "Microphone Not Working",
  "Headphone Jack Not Working",
  "Audio Distorted",
  "Wi-Fi Not Connecting",
  "Bluetooth Not Connecting",
  "Cellular Signal Weak",
  "GPS Not Working",
  "Charging Port Loose",
  "Charging Port Not Working",
  "USB Port Not Working",
  "Fingerprint Sensor Not Working",
  "Face ID Not Working",
  "Proximity Sensor Not Working",
  "Gyroscope Not Working",
  "Operating System Crashing",
  "Apps Crashing",
  "Software Update Failed",
  "Device Freezing",
  "Device Bent",
  "Device Scratched",
  "Device Water Damaged",
  "Overheating",
  "Slow Performance",
  "Random Reboots",
  "Unresponsive Touchscreen",
];

const seed = async () => {
  try {
    

    await issuesSeeder();
    console.log("Database seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}



const issuesSeeder = async (connection) => {
  try {
    
    await ReportedIssue.deleteMany({});
    await ReportedIssue.insertMany(issues.map((issue) => ({ issue })));
    console.log("Seeded reported issues");
  } catch (error) {
    console.error("Error seeding reported issues:", error);
  }
};

 
module.exports = { issuesSeeder };
