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

      // Create starter room categories (Villa, Luxury Suite, Double Bed Room, Single Bed Room)
      const starterCategories = [
        {
          name: 'Villa',
          description: 'Private luxury villa with pool & terrace',
          basePrice: currency === 'USD' ? 150 : 8000,
        },
        {
          name: 'Luxury Suite',
          description: 'Executive luxury suite with king bed & lounge',
          basePrice: currency === 'USD' ? 100 : 5000,
        },
        {
          name: 'Double Bed Room',
          description: 'Spacious room with 2 double beds & desk',
          basePrice: currency === 'USD' ? 70 : 3500,
        },
        {
          name: 'Single Bed Room',
          description: 'Cozy single bedroom with essential amenities',
          basePrice: currency === 'USD' ? 50 : 2500,
        },
      ];

      for (const cat of starterCategories) {
        await tx.roomCategories.create({
          data: {
            name: cat.name,
            description: cat.description,
            basePrice: cat.basePrice,
            propertyId: property.id,
          },
        });
      }

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
      role: (result.user.role as any) || 'Admin',
      isActive: result.user.isActive ?? true,
      permissions: (result.user.permissions as any) || null,
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
        role: (result.user.role as any) || 'Admin',
        isActive: result.user.isActive ?? true,
        permissions: (result.user.permissions as any) || null,
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

    if (user.isActive === false) {
      const error: any = new Error('Your account has been deactivated. Contact property administrator.');
      error.statusCode = 403;
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
      role: (user.role as any) || 'Admin',
      isActive: user.isActive ?? true,
      permissions: (user.permissions as any) || null,
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
        role: (user.role as any) || 'Admin',
        isActive: user.isActive ?? true,
        permissions: (user.permissions as any) || null,
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

  /**
   * Change user password securely with strict password policy & bcrypt salt 12
   */
  static async changePassword(userId: string, payload: { currentPassword?: string; newPassword?: string; confirmPassword?: string }) {
    const { currentPassword, newPassword, confirmPassword } = payload;

    // 1. Input Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      const error: any = new Error('Current password, new password, and confirm password are required.');
      error.statusCode = 400;
      throw error;
    }

    if (newPassword !== confirmPassword) {
      const error: any = new Error('New password and confirm password do not match.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Password Policy Check: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const minLength = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      const error: any = new Error(
        'Password must be at least 8 characters long and include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
      );
      error.statusCode = 400;
      throw error;
    }

    // 3. Fetch user record from PostgreSQL
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: any = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    // 4. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      const error: any = new Error('Current password is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    // 5. Prevent reuse of current password
    if (currentPassword === newPassword) {
      const error: any = new Error('New password cannot be identical to current password.');
      error.statusCode = 400;
      throw error;
    }

    // 6. Hash new password with salt rounds 12 & update PostgreSQL
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await prisma.users.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}
