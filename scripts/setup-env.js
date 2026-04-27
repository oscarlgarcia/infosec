#!/usr/bin/env node
/**
 * InfoSec Environment Setup Script
 * Run after: docker compose up -d
 * Purpose: Initialize complete environment (users, QA, ChromaDB, Ollama)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { ChromaClient } = require('chromadb');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  mongoUri: process.env.MONGODB_URI || 'mongodb://mongo:27017/infosec',
  chromaUrl: `http://${process.env.CHROMA_HOST || 'chroma'}:${process.env.CHROMA_PORT || '8000'}`,
  ollamaHost: 'host.docker.internal',
  ollamaPort: 11434,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
};

// Users to create
const DEFAULT_USERS = [
  { username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { username: 'manager', email: 'manager@example.com', password: 'manager123', role: 'manager' },
  { username: 'sme', email: 'sme@example.com', password: 'sme123', role: 'sme' }
];

// QA file path (optional)
const QA_FILE_PATH = process.argv.find(arg => arg.startsWith('--qa-file='))?.split('=')[1] || './Q&A.txt';

// Flags
const SKIP_OLLAMA_PULL = process.argv.includes('--skip-ollama-pull');
const SKIP_QA_IMPORT = process.argv.includes('--skip-qa-import');

// Logging helpers
function log(message) { console.log(`✅ ${message}`); }
function warn(message) { console.warn(`⚠️  ${message}`); }
function error(message) { console.error(`❌ ${message}`); }
function info(message) { console.info(`ℹ️  ${message}`); }

// Validate environment
async function validateEnv() {
  info('Validating environment variables...');
  
  if (!CONFIG.jwtSecret || CONFIG.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be 32+ characters. Current: ' + CONFIG.jwtSecret);
  }
  
  if (!CONFIG.jwtRefreshSecret || CONFIG.jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be 32+ characters. Current: ' + CONFIG.jwtRefreshSecret);
  }
  
  log('Environment variables validated');
}

// Wait for service to be ready
async function waitForService(name, checkFn, maxRetries = 30, delayMs = 2000) {
  info(`Waiting for ${name} to be ready...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ready = await checkFn();
      if (ready) {
        log(`${name} is ready`);
        return true;
      }
    } catch (e) {
      // Retry
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error(`Timeout waiting for ${name}`);
}

// Check MongoDB
async function checkMongo() {
  try {
    await mongoose.connect(CONFIG.mongoUri);
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (e) {
    return false;
  }
}

// Check ChromaDB
async function checkChroma() {
  try {
    const client = new ChromaClient({ path: CONFIG.chromaUrl });
    await client.heartbeat();
    return true;
  } catch (e) {
    return false;
  }
}

// Check Ollama
async function checkOllama() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: CONFIG.ollamaHost,
      port: CONFIG.ollamaPort,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => resolve(false));
    req.end();
  });
}

// Create users
async function createUsers() {
  info('Creating default users...');
  
  const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'sme', 'usuario'], default: 'usuario' },
    isActive: { type: Boolean, default: true }
  }, { strict: false }));
  
  for (const userData of DEFAULT_USERS) {
    const exists = await User.findOne({ username: userData.username });
    if (exists) {
      warn(`User ${userData.username} already exists, skipping...`);
      continue;
    }
    
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await User.create({
      ...userData,
      password: hashedPassword,
      isActive: true
    });
    log(`Created user: ${userData.username} (${userData.role})`);
  }
}

// Parse QA file (simple format: Q: ... A: ...)
function parseQAFile(filePath) {
  if (!fs.existsSync(filePath)) {
    warn(`QA file not found: ${filePath}`);
    return [];
  }
  
  info(`Parsing QA file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const entries = [];
  
  // Simple parser for "Q: question" / "A: answer" format
  const qaRegex = /Q:\s*(.+?)\s*A:\s*([\s\S]+?)(?=\nQ:|$)/g;
  let match;
  
  while ((match = qaRegex.exec(content)) !== null) {
    entries.push({
      question: match[1].trim(),
      answer: match[2].trim(),
      infoSecDomain: 'IT General Security', // Default domain
      department: 'IT'
    });
  }
  
  log(`Parsed ${entries.length} QA entries`);
  return entries;
}

// Generate embedding via Ollama
function getOllamaEmbedding(text) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text.substring(0, 8000)
    });
    
    const req = http.request({
      hostname: CONFIG.ollamaHost,
      port: CONFIG.ollamaPort,
      path: '/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.embedding && result.embedding.length > 0) {
            resolve(result.embedding);
          } else {
            resolve([]);
          }
        } catch (e) {
          resolve([]);
        }
      });
    });
    
    req.on('error', () => resolve([]));
    req.on('timeout', () => resolve([]));
    req.write(payload);
    req.end();
  });
}

// Import QA entries and index to ChromaDB
async function importQAAndIndex() {
  if (SKIP_QA_IMPORT) {
    warn('Skipping QA import (--skip-qa-import flag set)');
    return;
  }
  
  info('Importing QA entries...');
  const qaEntries = parseQAFile(QA_FILE_PATH);
  
  if (qaEntries.length === 0) {
    warn('No QA entries to import');
    return;
  }
  
  const QAEntry = mongoose.model('QAEntry', new mongoose.Schema({
    question: { type: String, required: true },
    answer: { type: String, required: true },
    infoSecDomain: { type: String },
    department: { type: String },
    embedding: { type: [Number], default: null },
    embeddingStatus: { type: String, default: 'pending' }
  }, { strict: false }));
  
  // Insert into MongoDB
  let inserted = 0;
  for (const entry of qaEntries) {
    const exists = await QAEntry.findOne({ question: entry.question });
    if (exists) {
      continue;
    }
    await QAEntry.create(entry);
    inserted++;
  }
  log(`Inserted ${inserted} new QA entries into MongoDB`);
  
  // Get all entries and index to ChromaDB
  const allEntries = await QAEntry.find({}).lean();
  log(`Indexing ${allEntries.length} entries to ChromaDB...`);
  
  const client = new ChromaClient({ path: CONFIG.chromaUrl });
  
  // Delete and recreate qanda collection with cosine space
  try {
    await client.deleteCollection({ name: 'qanda' });
  } catch (e) {}
  
  const collection = await client.createCollection({
    name: 'qanda',
    metadata: {
      description: 'QA pairs for Gap Finder',
      'hnsw:space': 'cosine'
    }
  });
  
  let indexed = 0;
  for (const entry of allEntries) {
    try {
      const text = `${entry.question} ${entry.answer}`.trim();
      if (text.length < 5) continue;
      
      const embedding = await getOllamaEmbedding(text);
      if (!embedding || embedding.length === 0) {
        continue;
      }
      
      await collection.add({
        ids: [entry._id.toString()],
        embeddings: [embedding],
        documents: [text],
        metadatas: [{
          question: entry.question,
          answer: entry.answer,
          category: entry.infoSecDomain || '',
          source: 'qa'
        }]
      });
      
      indexed++;
      if (indexed % 20 === 0) {
        info(`Indexed ${indexed}/${allEntries.length}`);
      }
    } catch (e) {
      // Continue on error
    }
  }
  
  log(`Indexed ${indexed} QA entries to ChromaDB`);
}

// Pull Ollama model
async function pullOllamaModel() {
  if (SKIP_OLLAMA_PULL) {
    warn('Skipping Ollama model pull (--skip-ollama-pull flag set)');
    return;
  }
  
  info('Pulling Ollama model: nomic-embed-text...');
  
  return new Promise((resolve) => {
    const req = http.request({
      hostname: CONFIG.ollamaHost,
      port: CONFIG.ollamaPort,
      path: '/api/pull',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        log('Ollama model pulled successfully');
        resolve();
      });
    });
    
    req.on('error', (e) => {
      warn(`Failed to pull Ollama model: ${e.message}`);
      resolve();
    });
    
    req.write(JSON.stringify({ name: 'nomic-embed-text' }));
    req.end();
  });
}

// Main setup function
async function setup() {
  try {
    info('Starting InfoSec environment setup...');
    info('=====================================');
    
    // Step 1: Validate environment
    await validateEnv();
    
    // Step 2: Wait for MongoDB
    await waitForService('MongoDB', checkMongo);
    
    // Step 3: Wait for ChromaDB
    await waitForService('ChromaDB', checkChroma);
    
    // Step 4: Wait for Ollama (optional)
    try {
      await waitForService('Ollama', checkOllama, 15, 2000);
    } catch (e) {
      warn('Ollama not available, skipping model pull');
    }
    
    // Step 5: Create users
    await createUsers();
    
    // Step 6: Pull Ollama model
    await pullOllamaModel();
    
    // Step 7: Import QA entries
    await importQAAndIndex();
    
    // Done
    log('=====================================');
    log('Setup completed successfully!');
    log('You can now login with:');
    DEFAULT_USERS.forEach(u => {
      info(`  - ${u.username} / ${u.password} (${u.role})`);
    });
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    error('Setup failed:');
    error(error.message);
    error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run setup
setup();
