import { Heading } from "@/components/heading";
import { CopyField } from "@/components/ui/copy-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { chatBotSetups } from "@/lib/creator-chat-commands";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

/**
 * Client-only: `getSiteUrl()` can disagree between server and browser, and
 * this app hydrates the whole document, so rendering it during SSR risks React #418.
 */
function ChatBotSetups() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <Skeleton className="h-52" />;
  }

  return (
    <div className="flex flex-col gap-5">
      {chatBotSetups(getSiteUrl()).map((setup) => (
        <div key={setup.id} className="flex flex-col gap-2">
          <Heading level={3}>{setup.name}</Heading>
          <CopyField
            value={setup.command}
            label={m.help_chat_commands_copy_label({ name: setup.name })}
            mono
          />
          <p className="text-muted-foreground text-sm">{setup.note}</p>
        </div>
      ))}
    </div>
  );
}

export default function ChatCommandsArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        {m.help_chat_commands_intro_before()} <InlineCode>!card Jinx</InlineCode>{" "}
        {m.help_chat_commands_intro_after()}
      </p>

      <section>
        <Heading className="mb-2">{m.help_chat_commands_pick_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_chat_commands_pick_intro()}</p>
        <div className="mt-4">
          <ChatBotSetups />
        </div>
      </section>
    </div>
  );
}

function InlineCode({ children }: { children: string }) {
  return <code className="bg-muted rounded-md px-1 py-0.5 font-mono text-sm">{children}</code>;
}
