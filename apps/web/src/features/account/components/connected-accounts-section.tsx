import { useEffect, useState } from "react";
import { siDiscord, siGoogle } from "simple-icons";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/features/account/lib/auth-client";

const SOCIAL_PROVIDERS = [
  { id: "google", name: "Google", icon: siGoogle },
  { id: "discord", name: "Discord", icon: siDiscord },
] as const;

export function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState<{ id: string; providerId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      const result = await authClient.listAccounts().catch(() => null);
      if (!result) {
        setError("Failed to load connected accounts.");
      } else if (result.error) {
        setError(result.error.message ?? "Failed to load connected accounts.");
      } else {
        setAccounts(result.data ?? []);
      }
      setLoading(false);
    }
    void fetchAccounts();
  }, []);

  async function handleLink(provider: string) {
    setActionLoading(provider);
    setError(null);
    try {
      await authClient.linkSocial({
        provider: provider as "google" | "discord",
        callbackURL: "/profile",
      });
    } catch {
      setActionLoading(null);
      setError("Could not reach the sign-in provider. Please try again.");
    }
  }

  async function handleUnlink(providerId: string) {
    const account = accounts.find((a) => a.providerId === providerId);
    if (!account) {
      return;
    }
    setActionLoading(providerId);
    setError(null);
    const result = await authClient.unlinkAccount({ accountId: account.id }).catch(() => null);
    setActionLoading(null);
    if (!result) {
      setError("Failed to unlink account.");
      return;
    }
    if (result.error) {
      setError(result.error.message ?? "Failed to unlink account.");
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.providerId !== providerId));
  }

  const linkedProviderIds = new Set(accounts.map((a) => a.providerId));

  return (
    <SettingsSection title="Connected Accounts">
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <RowList>
            {SOCIAL_PROVIDERS.map((provider) => {
              const isLinked = linkedProviderIds.has(provider.id);
              const isOnlyAccount = accounts.length <= 1;
              return (
                <RowListItem key={provider.id} className="justify-between">
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                      <path d={provider.icon.path} fill="currentColor" />
                    </svg>
                    <span className="text-sm font-medium">{provider.name}</span>
                  </div>
                  {isLinked ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isOnlyAccount || actionLoading === provider.id}
                            onClick={() => void handleUnlink(provider.id)}
                          />
                        }
                      >
                        {actionLoading === provider.id ? "Unlinking..." : "Unlink"}
                      </TooltipTrigger>
                      {isOnlyAccount && (
                        <TooltipContent>You must have at least one linked account</TooltipContent>
                      )}
                    </Tooltip>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionLoading === provider.id}
                      onClick={() => void handleLink(provider.id)}
                    >
                      {actionLoading === provider.id ? "Connecting..." : "Connect"}
                    </Button>
                  )}
                </RowListItem>
              );
            })}
          </RowList>
        </>
      )}
    </SettingsSection>
  );
}
