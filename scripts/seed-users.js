#!/usr/bin/env node
/**
 * Seed users script
 * Usage: node scripts/seed-users.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const USERS = [
  { username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { username: 'manager', email: 'manager@example.com', password: 'manager123', role: 'manager' },
  { username: 'sme', email: 'sme@example.com', password: 'sme123', role: 'sme' }
];

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/infosec');
    console.log('✅ MongoDB connected');
    
    const User = mongoose.model('User', new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['admin', 'manager', 'sme', 'usuario'], default: 'usuario' },
      isActive: { type: Boolean, default: true }
    }, { strict: false }));
    
    let created = 0;
    for (const userData of USERS) {
      const exists = await User.findOne({ username: userData.username });
      if (exists) {
        console.log(`⚠️  User ${userData.username} already exists, skipping...`);
        continue;
      }
      
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({
        ...userData,
        password: hashedPassword,
        isActive: true
      });
      console.log(`✅ Created user: ${userData.username} (${userData.role})`);
      created++;
    }
    
    console.log(`\n🎉  Created ${created} new users`);
    console.log('You can now login with:');
    USERS.forEach(u => {
      console.log(`  - ${u.username} / ${u.password} (${u.role})`);
    });
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedUsers();
