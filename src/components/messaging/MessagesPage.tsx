"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMessagesStore, type Conversation } from "@/stores/messages-store";
import { ConversationSidebar } from "./ConversationSidebar";
import { ChatPane, ChatPaneEmpty } from "./ChatPane";
import { NewMessageDialog } from "./NewMessageDialog";
import { Header } from "@/components/ui/Header";

export function MessagesPage() {
  const { isAuthenticated } = useAuth();
  const getPrimaryConversations = useMessagesStore((s) => s.getPrimaryConversations);
  const getRequestConversations = useMessagesStore((s) => s.getRequestConversations);

  const [selectedConv, setSelectedConv] = useState<{
    otherIdentity: string;
    conversationId: number;
  } | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const handleSelectConversation = useCallback(
    (otherIdentity: string, conversationId: number) => {
      setSelectedConv({ otherIdentity, conversationId });
      setMobileShowChat(true);
    },
    []
  );

  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  const handleNewMessageSent = useCallback(
    (recipientIdentity: string) => {
      // Find the conversation for this recipient
      const allConvs = [...getPrimaryConversations(), ...getRequestConversations()];
      const conv = allConvs.find((c) => c.otherIdentity === recipientIdentity);
      if (conv) {
        setSelectedConv({ otherIdentity: recipientIdentity, conversationId: conv.id });
      } else {
        setSelectedConv({ otherIdentity: recipientIdentity, conversationId: 0 });
      }
      setMobileShowChat(true);
    },
    [getPrimaryConversations, getRequestConversations]
  );

  // Find conversation metadata for the selected conversation
  let selectedConversation: Conversation | null = null;
  if (selectedConv) {
    const allConvs = [...getPrimaryConversations(), ...getRequestConversations()];
    selectedConversation =
      allConvs.find((c) => c.otherIdentity === selectedConv.otherIdentity) || null;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Sign in to access your messages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on mobile when viewing a chat */}
        <div
          className={`w-full flex-shrink-0 md:w-[360px] ${
            mobileShowChat ? "hidden md:flex" : "flex"
          } flex-col`}
        >
          <ConversationSidebar
            selectedConversationIdentity={selectedConv?.otherIdentity || null}
            onSelectConversation={handleSelectConversation}
            onNewMessage={() => setShowNewMessage(true)}
          />
        </div>

        {/* Chat pane — hidden on mobile when viewing sidebar */}
        <div
          className={`flex-1 ${
            mobileShowChat ? "flex" : "hidden md:flex"
          } flex-col`}
        >
          {selectedConversation ? (
            <ChatPane
              key={selectedConversation.otherIdentity}
              otherIdentity={selectedConversation.otherIdentity}
              otherName={selectedConversation.otherName}
              conversationId={selectedConversation.id}
              conversationStatus={selectedConversation.status}
              requestRecipient={selectedConversation.requestRecipient}
              onBack={handleBack}
            />
          ) : selectedConv ? (
            <ChatPane
              key={selectedConv.otherIdentity}
              otherIdentity={selectedConv.otherIdentity}
              otherName={selectedConv.otherIdentity.slice(0, 8)}
              conversationId={0}
              conversationStatus="active"
              requestRecipient=""
              onBack={handleBack}
            />
          ) : (
            <ChatPaneEmpty />
          )}
        </div>
      </div>

      {/* New message dialog */}
      {showNewMessage && (
        <NewMessageDialog
          onClose={() => setShowNewMessage(false)}
          onSent={handleNewMessageSent}
        />
      )}
    </div>
  );
}
