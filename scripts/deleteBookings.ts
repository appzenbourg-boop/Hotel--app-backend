import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const phoneNumber = '6388163169';

  console.log(`Finding guest with phone number: ${phoneNumber}`);
  
  const guest = await prisma.guest.findUnique({
    where: { phone: phoneNumber },
    include: { bookings: true }
  });

  if (!guest) {
    console.log(`Guest with phone number ${phoneNumber} not found.`);
    return;
  }

  console.log(`Found guest: ${guest.name}. They have ${guest.bookings.length} bookings.`);

  if (guest.bookings.length > 0) {
    console.log(`Deleting all bookings for guest ${guest.name}...`);
    const deleteResult = await prisma.booking.deleteMany({
      where: {
        guestId: guest.id
      }
    });
    console.log(`Successfully deleted ${deleteResult.count} bookings.`);
  } else {
    console.log('No bookings to delete.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
