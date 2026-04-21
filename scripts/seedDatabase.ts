import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.room.deleteMany({});
  await prisma.property.deleteMany({});
  console.log('✅ Cleared old data');

  const properties = [
    {
      name: 'Taj Mahal Palace Mumbai',
      address: 'Apollo Bunder, Colaba, Mumbai, Maharashtra',
      description: 'Iconic luxury hotel overlooking the Gateway of India',
      phone: '+91-22-66653366',
      email: 'taj.mumbai@tajhotels.com',
      checkInTime: '14:00',
      checkOutTime: '11:00',
      latitude: 18.922,
      longitude: 72.8332,
      images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
      features: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym'],
      rooms: [
        { roomNumber: '101', type: 'Deluxe Room', category: 'DELUXE' as const, basePrice: 20000, maxOccupancy: 2, floor: 1, status: 'AVAILABLE' as const, amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'], images: [] },
        { roomNumber: '201', type: 'Premium Suite', category: 'SUITE' as const, basePrice: 35000, maxOccupancy: 4, floor: 2, status: 'AVAILABLE' as const, amenities: ['WiFi', 'TV', 'AC', 'Jacuzzi'], images: [] },
      ],
    },
    {
      name: 'The Leela Palace New Delhi',
      address: 'Diplomatic Enclave, Chanakyapuri, New Delhi',
      description: 'Palatial luxury hotel near diplomatic area',
      phone: '+91-11-39331234',
      email: 'reservations.newdelhi@theleela.com',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      latitude: 28.5923,
      longitude: 77.1838,
      images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4'],
      features: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Bar'],
      rooms: [
        { roomNumber: '103', type: 'Grand Deluxe', category: 'DELUXE' as const, basePrice: 28000, maxOccupancy: 2, floor: 1, status: 'AVAILABLE' as const, amenities: ['WiFi', 'TV', 'AC', 'Mini Bar'], images: [] },
        { roomNumber: '203', type: 'Royal Suite', category: 'SUITE' as const, basePrice: 50000, maxOccupancy: 4, floor: 2, status: 'AVAILABLE' as const, amenities: ['WiFi', 'TV', 'AC', 'Butler Service'], images: [] },
      ],
    },
  ];

  console.log('🏨 Creating properties and rooms...');

  for (const propertyData of properties) {
    const { rooms, ...propertyInfo } = propertyData;

    const property = await prisma.property.create({
      data: { ...propertyInfo, ownerIds: [] },
    });

    console.log(`✅ Created property: ${property.name}`);

    for (const roomData of rooms) {
      await prisma.room.create({
        data: {
          ...roomData,
          propertyId: property.id,
          description: `Comfortable ${roomData.type} with modern amenities`,
        },
      });
    }

    console.log(`   ✅ Created ${rooms.length} rooms`);
  }

  console.log('\n🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
