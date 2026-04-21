import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👤 Creating test user...');

  const testPhone = '9876543210';
  const testPassword = 'test123';

  // Check if user already exists
  const existing = await prisma.guest.findUnique({ where: { phone: testPhone } });

  if (existing) {
    console.log('✅ Test guest already exists!');
    console.log('📱 Phone: ' + testPhone);
    console.log('🔑 Password: ' + testPassword);
    return;
  }

  // Create test guest
  await prisma.guest.create({
    data: {
      name: 'Test User',
      phone: testPhone,
      email: 'test@hotel.com',
      checkInStatus: 'PENDING',
    },
  });

  console.log('✅ Test guest created!');

  // Also create a user for login
  try {
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    await prisma.user.create({
      data: {
        name: 'Test User',
        phone: testPhone,
        email: 'test@hotel.com',
        password: hashedPassword,
        role: 'GUEST',
        status: 'ACTIVE',
        ownedPropertyIds: [],
      },
    });

    console.log('✅ Test user created for login!');
  } catch (e) {
    console.log('ℹ️  User might already exist in users table');
  }

  console.log('\n🎉 Test account ready!');
  console.log('\n📱 LOGIN CREDENTIALS:');
  console.log('Phone: 9876543210');
  console.log('Password: test123');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
