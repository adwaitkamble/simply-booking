import { prisma } from '@hotel-pms/database';
import type { CreateTeamMemberPayload, UpdateTeamMemberPayload, UserDTO } from '@hotel-pms/types';
import bcrypt from 'bcryptjs';

export class TeamService {
  /**
   * Default granular permissions structure for new staff members
   */
  static getDefaultPermissions() {
    return {
      calendar: { create: true, edit: true, view: true, delete: false, list: true },
      rooms: { create: true, edit: true, view: true, delete: false, list: true },
      bookings: { create: true, edit: true, view: true, delete: false, list: true },
      invoicing: { create: true, edit: true, view: true, delete: false, list: true },
      housekeeping: { create: true, edit: true, view: true, delete: false, list: true },
      team: { create: false, edit: false, view: true, delete: false, list: true },
    };
  }

  /**
   * Create a new team member account (Admin only)
   */
  static async createMember(propertyId: string, payload: CreateTeamMemberPayload): Promise<UserDTO> {
    const { name, email, password, role = 'Staff', isActive = true, permissions } = payload;

    if (!name || !email || !password) {
      const error: any = new Error('Name, email, and password are required to create a team member.');
      error.statusCode = 400;
      throw error;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Enforce Single Admin Per Hotel Policy
    if (role === 'Admin') {
      const existingAdmin = await prisma.users.findFirst({
        where: { propertyId, role: 'Admin' },
      });

      if (existingAdmin) {
        const error: any = new Error(
          'Only 1 Administrator account (adwaitakamble007@gmail.com) is allowed per hotel property. Additional team members must be assigned the Staff role.'
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Check if user already exists
    const existing = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const error: any = new Error('An account with this email address already exists.');
      error.statusCode = 409;
      throw error;
    }

    // Hash password with bcrypt salt round 12
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userPermissions = permissions || this.getDefaultPermissions();

    const user = await prisma.users.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role as any,
        isActive,
        permissions: userPermissions as any,
        propertyId,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: (user.role as any) || 'Staff',
      isActive: user.isActive,
      permissions: user.permissions as any,
      propertyId: user.propertyId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update team member permissions & status (Admin only)
   */
  static async updateMember(userId: string, propertyId: string, payload: UpdateTeamMemberPayload): Promise<UserDTO> {
    const existing = await prisma.users.findFirst({
      where: { id: userId, propertyId },
    });

    if (!existing) {
      const error: any = new Error('Team member not found in your property.');
      error.statusCode = 404;
      throw error;
    }

    if (payload.role === 'Admin') {
      const existingAdmin = await prisma.users.findFirst({
        where: {
          propertyId,
          role: 'Admin',
          id: { not: userId },
        },
      });

      if (existingAdmin) {
        const error: any = new Error(
          'Only 1 Administrator account (adwaitakamble007@gmail.com) is allowed per hotel property.'
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const updateData: any = {};

    if (payload.name) updateData.name = payload.name.trim();
    if (payload.email) updateData.email = payload.email.toLowerCase().trim();
    if (payload.role) updateData.role = payload.role;
    if (typeof payload.isActive === 'boolean') updateData.isActive = payload.isActive;
    if (payload.permissions) updateData.permissions = payload.permissions;

    if (payload.password && payload.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(payload.password.trim(), 12);
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      mobileNumber: updated.mobileNumber,
      role: (updated.role as any) || 'Staff',
      isActive: updated.isActive,
      permissions: updated.permissions as any,
      propertyId: updated.propertyId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Fetch all team members for a property
   */
  static async listMembers(propertyId: string): Promise<UserDTO[]> {
    const users = await prisma.users.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      mobileNumber: u.mobileNumber,
      role: (u.role as any) || 'Admin',
      isActive: u.isActive,
      permissions: u.permissions as any,
      propertyId: u.propertyId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  /**
   * Delete team member (Admin only)
   */
  static async deleteMember(userId: string, propertyId: string): Promise<void> {
    const existing = await prisma.users.findFirst({
      where: { id: userId, propertyId },
    });

    if (!existing) {
      const error: any = new Error('Team member not found.');
      error.statusCode = 404;
      throw error;
    }

    await prisma.users.delete({
      where: { id: userId },
    });
  }

  /**
   * Fetch team members with subscription stats
   */
  static async getTeamData(propertyId: string) {
    const members = await this.listMembers(propertyId);
    return {
      stats: {
        used: members.length,
        limit: 50,
        isLimitReached: false,
      },
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        isActive: m.isActive,
        isPrimaryOwner: m.role === 'Admin',
      })),
    };
  }

  /**
   * Quick status toggle
   */
  static async updateMemberStatus(userId: string, isActive: boolean) {
    return prisma.users.update({
      where: { id: userId },
      data: { isActive },
    });
  }
}
