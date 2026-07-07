import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ChatPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold">AI Job Search</h1>
        <UserButton />
      </header>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-500">Chat interface coming in Task #3.</p>
      </div>
    </main>
  );
}
