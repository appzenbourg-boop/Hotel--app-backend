const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.rooms.findMany({ take: 1 });
  if (rooms.length > 0) {
      console.log('Room keys:', Object.keys(rooms[0]));
      console.log('Sample room:', JSON.stringify(rooms[0], (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  } else {
      console.log('No rooms found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
