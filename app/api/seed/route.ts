import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Check if we already have properties to avoid duplicates
    const existingCount = await prisma.property.count();
    if (existingCount > 0) {
      return NextResponse.json({ message: `Already have ${existingCount} properties. Skipping seed.` });
    }

    // Create Property 1: Taj Mahal Palace Hotel
    const p1 = await prisma.property.create({
      data: {
        name: 'Taj Mahal Palace Hotel',
        address: 'Mumbai, Maharashtra',
        description: 'Iconic sea-facing luxury hotel with world-class amenities, fine dining, and breathtaking views of the Arabian Sea.',
        features: ['Swimming Pool', 'Spa & Wellness', 'Free WiFi', 'Fine Dining', 'Concierge', 'Business Center'],
        images: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
          'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',
        ],
        email: 'reservations@tajmumbai.com',
        phone: '9876543210',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        ownerIds: [],
      },
    });

    // Create Property 2: The Leela Palace
    const p2 = await prisma.property.create({
      data: {
        name: 'The Leela Palace',
        address: 'Bangalore, Karnataka',
        description: 'A royal retreat set amidst lush gardens in the heart of Bangalore.',
        features: ['Garden', 'Fitness Center', 'Free WiFi', 'Bar & Lounge', 'Room Service', 'Valet Parking'],
        images: [
          'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800',
          'https://images.unsplash.com/photo-1590490360182-c33d7cf4ec58?w=800',
        ],
        email: 'stay@leela.com',
        phone: '9876543211',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        ownerIds: [],
      },
    });

    // Create Property 3: ITC Grand Chola
    const p3 = await prisma.property.create({
      data: {
        name: 'ITC Grand Chola',
        address: 'Chennai, Tamil Nadu',
        description: 'Inspired by the Chola dynasty, this grand hotel blends South Indian heritage with modern luxury.',
        features: ['Rooftop Pool', 'Spa', 'Multi-cuisine Dining', 'Free WiFi', 'Banquet Hall'],
        images: [
          'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800',
          'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800',
        ],
        email: 'info@itcgrandchola.com',
        phone: '9876543212',
        checkInTime: '15:00',
        checkOutTime: '11:00',
        ownerIds: [],
      },
    });

    // Seed Rooms for each property
    await prisma.room.createMany({
      data: [
        {
          propertyId: p1.id, roomNumber: '101', type: 'Luxury Sea View Room',
          category: 'DELUXE', basePrice: 15000, status: 'AVAILABLE',
          amenities: ['Sea View', 'King Bed', 'Rain Shower', 'Mini Bar'],
          images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800'],
          maxOccupancy: 3, floor: 1,
          description: 'Wake up to stunning Arabian Sea views.',
        },
        {
          propertyId: p1.id, roomNumber: '502', type: 'Presidential Suite',
          category: 'SUITE', basePrice: 55000, status: 'AVAILABLE',
          amenities: ['Sea View', 'Private Butler', 'Lounge Access', 'Jacuzzi'],
          images: ['https://images.unsplash.com/photo-1590490360182-c33d7cf4ec58?w=800'],
          maxOccupancy: 4, floor: 5,
          description: 'The pinnacle of luxury with a private butler.',
        },
        {
          propertyId: p2.id, roomNumber: '301', type: 'Royal Garden Suite',
          category: 'SUITE', basePrice: 28000, status: 'AVAILABLE',
          amenities: ['Garden View', 'King Bed', 'Private Balcony', 'Lounge Access'],
          images: ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800'],
          maxOccupancy: 3, floor: 3,
          description: 'Luxurious suite overlooking the manicured palace gardens.',
        },
        {
          propertyId: p3.id, roomNumber: '401', type: 'Chola Club Room',
          category: 'DELUXE', basePrice: 18000, status: 'AVAILABLE',
          amenities: ['Club Lounge Access', 'King Bed', 'Bathtub', 'Mini Bar'],
          images: ['https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800'],
          maxOccupancy: 2, floor: 4,
          description: 'Experience South Indian luxury with exclusive club privileges.',
        },
      ],
    });

    // Seed Menu Items
    await prisma.menuItem.createMany({
      data: [
        {
          propertyId: p1.id, name: 'Butter Chicken', category: 'Main Course', cuisine: 'North Indian',
          description: 'Creamy tomato-based curry with tender chicken pieces', price: 650,
          isVeg: false, isAvailable: true, images: [],
        },
        {
          propertyId: p1.id, name: 'Paneer Tikka', category: 'Starters', cuisine: 'North Indian',
          description: 'Marinated cottage cheese grilled to perfection', price: 450,
          isVeg: true, isAvailable: true, images: [],
        },
        {
          propertyId: p2.id, name: 'Hyderabadi Biryani', category: 'Main Course', cuisine: 'South Indian',
          description: 'Fragrant basmati rice layered with spiced meat', price: 550,
          isVeg: false, isAvailable: true, images: [],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Seeded 3 hotels, 4 rooms, and 3 menu items successfully!',
      properties: [p1.id, p2.id, p3.id],
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Seeding failed' }, { status: 500 });
  }
}
