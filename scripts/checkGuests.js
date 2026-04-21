const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGuests() {
  try {
    const guests = await prisma.guests.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        referralCode: true,
        referredBy: true,
        createdAt: true
      }
    });
    
    console.log('=== GUESTS IN DATABASE ===');
    console.log(`Total guests: ${guests.length}\n`);
    
    guests.forEach(guest => {
      console.log(JSON.stringify(guest, null, 2));
    });
    
    // Check wallets
    const wallets = await prisma.wallets.findMany();
    console.log('\n=== WALLETS IN DATABASE ===');
    console.log(`Total wallets: ${wallets.length}\n`);
    wallets.forEach(w => console.log(JSON.stringify(w, null, 2)));
    
    // Check referrals
    const referrals = await prisma.referrals.findMany();
    console.log('\n=== REFERRALS IN DATABASE ===');
    console.log(`Total referrals: ${referrals.length}\n`);
    referrals.forEach(r => console.log(JSON.stringify(r, null, 2)));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGuests();
