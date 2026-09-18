import type { Metadata } from "next";
import { ChatView } from "@/components/chat/ChatView";

export const metadata: Metadata = {
  title: "Chat",
  description: "Cuéntale a ELI qué no entiendes y te guía paso a paso, sin darte la respuesta.",
};

export default function ChatPage() {
  return <ChatView />;
}
