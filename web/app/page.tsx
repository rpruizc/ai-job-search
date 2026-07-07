import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          AI Job Search
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Your personal job application assistant, powered by Claude.
        </p>
        <div className="flex items-center justify-center gap-4">
          <SignInButton mode="redirect">
            <button type="button" className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="redirect">
            <button type="button" className="rounded-lg border border-blue-600 px-6 py-3 font-medium text-blue-600 transition hover:bg-blue-50">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </div>
    </main>
  );
}
