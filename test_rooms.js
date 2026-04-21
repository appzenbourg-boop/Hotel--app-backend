const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.rooms.findMany({
      where: { propertyId: '698f40f2c1d818598d5213bc' }
  });
  console.log('Room count for property:', rooms.length);
  if (rooms.length > 0) {
      console.log('Sample room propertyId type:', typeof rooms[0].propertyId);
      console.log('Sample room propertyId value:', rooms[0].propertyId);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
