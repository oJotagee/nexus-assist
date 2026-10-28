import type { UserDto } from '@nexo/shared';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserDto['role'];
      department: string;
      supportLevel: UserDto['supportLevel'];
    } & DefaultSession['user'];
  }

  interface User {
    role: UserDto['role'];
    department: string;
    supportLevel: UserDto['supportLevel'];
    accessToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    role?: UserDto['role'];
    department?: string;
    supportLevel?: UserDto['supportLevel'];
  }
}
