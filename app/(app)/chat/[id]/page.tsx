"use client";

import { useParams } from "next/navigation";
import { ChatViewWithSessionLoader } from "@/components/chat/ChatViewWithSessionLoader";

export default function ChatDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  return <ChatViewWithSessionLoader sessionId={sessionId} />;
}
