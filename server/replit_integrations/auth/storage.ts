import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Pick<User, "email" | "firstName" | "lastName">>): Promise<User | undefined>;
  createUserWithPassword(data: { email: string; firstName?: string; lastName?: string; passwordHash: string }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = userData.id ? await this.getUser(userData.id) : undefined;

    if (existing) {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (!existing.firstName && userData.firstName) updateData.firstName = userData.firstName;
      if (!existing.lastName && userData.lastName) updateData.lastName = userData.lastName;
      if (userData.profileImageUrl) updateData.profileImageUrl = userData.profileImageUrl;

      const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existing.id))
        .returning();
      return user;
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<Pick<User, "email" | "firstName" | "lastName">>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createUserWithPassword(data: { email: string; firstName?: string; lastName?: string; passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        passwordHash: data.passwordHash,
        emailVerified: true,
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
