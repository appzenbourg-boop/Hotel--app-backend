const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.rooms.findMany({
      include: {
          property: true
      }
  });
  console.log('Room count:', rooms.length);
  if (rooms.length > 0) {
      console.log('First room:', JSON.stringify(rooms[0], (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
