import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { User } from '../src/db/mongo/models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/infosec';

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'sme' | 'usuario';
}

const defaultUsers: SeedUser[] = [
  {
    username: 'admin',
    email: 'admin@infosec.local',
    password: 'Admin123!@#',
    role: 'admin',
  },
];

async function seedUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const usersArg = process.argv.find((arg) => arg.startsWith('--users='));
    let usersToCreate = defaultUsers;

    if (usersArg) {
      const usersJson = usersArg.replace('--users=', '');
      try {
        usersToCreate = JSON.parse(usersJson);
      } catch {
        console.error('❌ Invalid JSON in --users argument');
        process.exit(1);
      }
    }

    const results = {
      created: [] as string[],
      updated: [] as string[],
      skipped: [] as string[],
    };

    for (const userData of usersToCreate) {
      const existingUser = await User.findOne({
        $or: [{ username: userData.username }, { email: userData.email }],
      });

      if (existingUser) {
        console.log(`⚠️  User '${userData.username}' already exists, skipping...`);
        results.skipped.push(userData.username);
        continue;
      }

      const hashedPassword = await bcrypt.hash(userData.password, 12);

      const user = new User({
        username: userData.username,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        role: userData.role,
        isActive: true,
      });

      await user.save();
      console.log(`✅ Created user: ${userData.username} (${userData.role})`);
      results.created.push(userData.username);
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${results.created.length}`);
    console.log(`   Updated: ${results.updated.length}`);
    console.log(`   Skipped: ${results.skipped.length}`);

    if (results.created.length > 0) {
      console.log('\n🔑 Default credentials:');
      for (const userData of usersToCreate) {
        if (results.created.includes(userData.username)) {
          console.log(`   ${userData.role}: ${userData.username} / ${userData.password}`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}

seedUsers();
