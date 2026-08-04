import { prisma } from '@hotel-pms/database';
import type { RegisterPayload, LoginPayload, AuthResponse, AuthUserPayload } from '@hotel-pms/types';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middlewares/auth.middleware.js';

export class AuthService {
  /**
   * Register a new Tenant Property and Root Admin User
   */
  static async register(payload: RegisterPayload): Promise<AuthResponse> {
    const {
      propertyName,
      name,
      email,
      password,
      country,
      currency = 'INR',
      mobileNumber,
      city = '',
      zipCode = '',
      address = '',
    } = payload;

    if (!propertyName || !name || !email || !password || !country) {
      const error: any = new Error('Property name, user name, email, password, and country are required.');
      error.statusCode = 400;
      throw error;
    }

    if (password.length < 6) {
      const error: any = new Error('Password must be at least 6 characters long.');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const error: any = new Error('An account with this email address already exists.');
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Execute atomic creation of Chain, Property, default Category, and User
    const result = await prisma.$transaction(async (tx) => {
      const chain = await tx.chains.create({
        data: {
          name: `${propertyName} Chain`,
        },
      });

      const property = await tx.properties.create({
        data: {
          name: propertyName.trim(),
          country: country.trim(),
          currency: currency.trim() || 'INR',
          city: city.trim(),
          zipCode: zipCode.trim() || null,
          address: address.trim(),
          chainId: chain.id,
        },
      });

      // Create a starter room category so the property is ready for rooms
      await tx.roomCategories.create({
        data: {
          name: 'Standard Room',
          description: 'Standard comfortable room with essential amenities',
          basePrice: currency === 'USD' ? 50 : 2500,
          propertyId: property.id,
        },
      });

      const user = await tx.users.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          mobileNumber: mobileNumber?.trim() || null,
          propertyId: property.id,
        },
        include: {
          property: true,
        },
      });

      return { user, property };
    });

    const tokenPayload: AuthUserPayload = {
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      propertyId: result.property.id,
      propertyName: result.property.name,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

    return {
      success: true,
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        mobileNumber: result.user.mobileNumber,
        propertyId: result.user.propertyId,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
      property: {
        id: result.property.id,
        name: result.property.name,
        address: result.property.address,
        city: result.property.city,
        country: result.property.country,
        currency: result.property.currency,
        zipCode: result.property.zipCode,
        chainId: result.property.chainId,
        createdAt: result.property.createdAt,
        updatedAt: result.property.updatedAt,
      },
      message: 'Account and property successfully registered.',
    };
  }

  /**
   * Log in an existing user
   */
  static async login(payload: LoginPayload): Promise<AuthResponse> {
    const { email, password } = payload;

    if (!email || !password) {
      const error: any = new Error('Email and password are required.');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      include: {
        property: true,
      },
    });

    if (!user) {
      const error: any = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      const error: any = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const tokenPayload: AuthUserPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      propertyId: user.property.id,
      propertyName: user.property.name,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        propertyId: user.propertyId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      property: {
        id: user.property.id,
        name: user.property.name,
        address: user.property.address,
        city: user.property.city,
        country: user.property.country,
        currency: user.property.currency,
        zipCode: user.property.zipCode,
        chainId: user.property.chainId,
        createdAt: user.property.createdAt,
        updatedAt: user.property.updatedAt,
      },
      message: 'Logged in successfully.',
    };
  }

  /**
   * Fetch current user profile & property details
   */
  static async getMe(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        property: {
          include: {
            roomCategories: {
              include: {
                rooms: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      const error: any = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      propertyId: user.propertyId,
      property: user.property,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
