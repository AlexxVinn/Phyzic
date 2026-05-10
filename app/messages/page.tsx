"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ChatDock from "@/components/ChatDock";

function MessagesInner() {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  return (
    <div className="app">
      <Navbar />
      <div className="shell">
        <Sidebar />
        <main className="main">
          <div className="profile-root">
            <div className="card">
              <div className="card-title">Direct Messages</div>
              <p className="text-muted" style={{ fontSize: 13, padding: "8px 0" }}>
                Use the message dock in the bottom-right corner to view conversations.
              </p>
            </div>
          </div>
        </main>
      </div>
      <ChatDock />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="app">
        <Navbar />
        <div className="shell">
          <Sidebar />
          <main className="main">
            <div className="profile-root">
              <div className="skeleton-wrap">
                <div className="skeleton-line skeleton-lg" />
                <div className="skeleton-line skeleton-md" />
              </div>
            </div>
          </main>
        </div>
      </div>
    }>
      <MessagesInner />
    </Suspense>
  );
}
