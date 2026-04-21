import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Properties...');

  const p1 = await prisma.property.create({
    data: {
      name: 'Taj Mahal Palace Hotel',
      address: 'Mumbai, Maharashtra',
      description: 'Iconic sea-facing luxury hotel with world-class amenities.',
      features: ['Pool', 'Spa', 'Free WiFi', 'Restaurant'],
      images: ['https://picsum.photos/seed/taj1/800/600', 'https://picsum.photos/seed/taj2/800/600'],
      email: 'contact@tajmumbai.fake',
      phone: '9876543210',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      ownerIds: [],
    },
  });

  const p2 = await prisma.property.create({
    data: {
      name: 'The Leela Palace',
      address: 'Bangalore, Karnataka',
      description: 'Lush green modern palace offering serene luxury.',
      features: ['Pool', 'Fitness Center', 'Free WiFi', 'Bar'],
      images: ['https://picsum.photos/seed/leela1/800/600', 'https://picsum.photos/seed/leela2/800/600'],
      email: 'stay@leela.fake',
      phone: '9876543211',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      ownerIds: [],
    },
  });

  console.log('Seeding Rooms...');

  await prisma.room.createMany({
    data: [
      {
        propertyId: p1.id,
        roomNumber: '101',
        type: 'Deluxe Sea View',
        category: 'DELUXE',
        basePrice: 15000,
        status: 'AVAILABLE',
        amenities: ['Sea View', 'King Bed', 'Bathtub'],
        images: ['https://picsum.photos/seed/room1/800/600'],
        maxOccupancy: 3,
        floor: 1,
        description: 'Enjoy the perfect sea breeze from your room.',
      },
      {
        propertyId: p1.id,
        roomNumber: '102',
        type: 'Presidential Suite',
        category: 'SUITE',
        basePrice: 50000,
        status: 'AVAILABLE',
        amenities: ['Sea View', 'Private Butler', 'Lounge access'],
        images: ['https://picsum.photos/seed/room2/800/600'],
        maxOccupancy: 4,
        floor: 5,
        description: 'Unmatched luxury at the top floor.',
      },
      {
        propertyId: p2.id,
        roomNumber: '201',
        type: 'Garden View Room',
        category: 'STANDARD',
        basePrice: 12000,
        status: 'AVAILABLE',
        amenities: ['Garden View', 'Queen Bed', 'Workspace'],
        images: ['https://picsum.photos/seed/room3/800/600'],
        maxOccupancy: 2,
        floor: 2,
        description: 'Wake up to lush green views.',
      },
    ],
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
