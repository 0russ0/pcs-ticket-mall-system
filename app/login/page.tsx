import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold">Student Rewards</h1>
        <p className="text-gray-600">Sign in with your school Google account to continue.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" className="btn btn-primary w-full">
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
