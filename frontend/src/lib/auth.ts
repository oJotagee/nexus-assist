import Credentials from 'next-auth/providers/credentials';
import type { UserDto } from '@nexo/shared';
import { isAxiosError } from 'axios';
import NextAuth from 'next-auth';

import { api } from './api';

type LoginResponse = { accessToken: string; user: UserDto };

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-mail corporativo', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          const { data } = await api.post<LoginResponse>('/auth/login', {
            email: credentials.email,
            password: credentials.password,
          });

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            department: data.user.department,
            supportLevel: data.user.supportLevel,
            accessToken: data.accessToken,
          };
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 401) return null;
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.accessToken = user.accessToken;
        token.role = user.role;
        token.department = user.department;
        token.supportLevel = user.supportLevel;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.role = token.role as UserDto['role'];
      session.user.department = token.department as string;
      session.user.supportLevel = (token.supportLevel ?? null) as UserDto['supportLevel'];
      return session;
    },
  },
});

export function homeFor(role: UserDto['role'] | undefined): string {
  return role === 'ANALYST' ? '/console' : '/atendimento';
}
