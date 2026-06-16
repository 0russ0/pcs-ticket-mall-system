import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role?: string;
      schoolId?: number;
      staffId?: number;
      studentId?: number;
    };
  }
}
