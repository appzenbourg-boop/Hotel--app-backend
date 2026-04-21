const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const properties = await prisma.properties.findMany();
  console.log('Total properties:', properties.length);
  for (const p of properties) {
      const rooms = await prisma.rooms.findMany({ where: { propertyId: p.id } });
      console.log(`Property: ${p.name} (ID: ${p.id}) has ${rooms.length} rooms.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
