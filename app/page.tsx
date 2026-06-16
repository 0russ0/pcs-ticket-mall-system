import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (!session.user.schoolId || session.user.role === "unknown") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold">Account not set up</h1>
          <p className="text-gray-600">
            Your account ({session.user.email}) isn&apos;t linked to a school yet. Please
            contact your school administrator.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn btn-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  redirect("/dashboard");
}
