#!/usr/bin/env node
/**
 * Seed rules script
 * Usage: node scripts/seed-rules.js
 * Inserts default rules only if they do not already exist by name
 * (existing rules are left untouched to preserve UI edits).
 */

const mongoose = require('mongoose');
const RULES = require('./rules-data.json');

async function seedRules() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/infosec');
    console.log('✅ MongoDB connected');

    const Rule = mongoose.model('AnswerRule', new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      content: { type: String, required: true },
      domain: { type: String },
      appliesTo: [{ type: String }],
      enabled: { type: Boolean, default: true },
      version: { type: Number, default: 1 },
    }, { strict: false, timestamps: true }));

    let created = 0;
    let skipped = 0;

    for (const ruleData of RULES) {
      const result = await Rule.updateOne(
        { name: ruleData.name },
        { $setOnInsert: { ...ruleData, version: 1 } },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log(`✅ Created rule: ${ruleData.name} (${ruleData.domain || 'no-domain'})`);
        created++;
      } else {
        console.log(`⚠️  Rule ${ruleData.name} already exists, skipping...`);
        skipped++;
      }
    }

    console.log(`\n🎉 Created ${created} new rules, skipped ${skipped} existing`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedRules();