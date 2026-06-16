import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const ALLOWED_DOMAIN = process.env.ALLOWED_GOOGLE_DOMAIN || "";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (ALLOWED_DOMAIN && !user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;

        const staff = await prisma.staff.findUnique({
          where: { googleEmail: user.email },
        });

        if (staff) {
          token.role = staff.role;
          token.schoolId = staff.schoolId;
          token.staffId = staff.id;
          token.name = `${staff.firstName ?? ""} ${staff.lastName ?? ""}`.trim() || user.name;
        } else {
          const student = await prisma.student.findUnique({
            where: { googleEmail: user.email },
          });

          if (student) {
            token.role = "student";
            token.schoolId = student.schoolId;
            token.studentId = student.id;
            token.name = `${student.firstName} ${student.lastName}`;
          } else {
            token.role = "unknown";
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.email = token.email as string;
      session.user.role = token.role as string;
      session.user.schoolId = token.schoolId as number | undefined;
      session.user.staffId = token.staffId as number | undefined;
      session.user.studentId = token.studentId as number | undefined;
      if (token.name) session.user.name = token.name as string;
      return session;
    },
  },
});
