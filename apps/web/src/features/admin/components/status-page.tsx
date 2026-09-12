import { formatRelativeTime } from "@openrift/shared/format-date";
import {
  ActivityIcon,
  BugIcon,
  CpuIcon,
  DatabaseIcon,
  LoaderIcon,
  ServerIcon,
  TagIcon,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { RefreshCountdownButton } from "@/features/admin/components/refresh-countdown-button";
import { useThrowInApi, useThrowInSsr } from "@/features/admin/hooks/use-sentry-test";
import {
  ADMIN_STATUS_REFRESH_INTERVAL_MS,
  useAdminStatus,
} from "@/features/admin/hooks/use-status";

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <DefinitionTerm>{label}</DefinitionTerm>
      <DefinitionDetail className="font-mono">{value}</DefinitionDetail>
    </>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="text-muted-foreground size-4" />
      {children}
    </span>
  );
}

export function StatusPage() {
  const { data, refetch, isFetching, dataUpdatedAt } = useAdminStatus();

  const topBar = (
    <AdminPageTopBar
      title="Status"
      actions={
        <RefreshCountdownButton
          onRefresh={() => void refetch()}
          isFetching={isFetching}
          dataUpdatedAt={dataUpdatedAt}
          intervalMs={ADMIN_STATUS_REFRESH_INTERVAL_MS}
        />
      }
    />
  );

  if (!data) {
    return topBar;
  }

  const { server, database, app, pricing } = data;

  return (
    <div className="flex flex-col gap-8">
      {topBar}

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
        <SettingsSection title={<SectionTitle icon={ServerIcon}>Server</SectionTitle>}>
          <DefinitionList>
            <StatRow label="Uptime" value={formatUptime(server.uptimeSeconds)} />
            <StatRow label="Environment" value={server.environment} />
            <StatRow label="Bun" value={`v${server.bunVersion}`} />
          </DefinitionList>
        </SettingsSection>

        <SettingsSection title={<SectionTitle icon={CpuIcon}>Memory</SectionTitle>}>
          <DefinitionList>
            <StatRow label="RSS" value={`${server.memoryMb.rss} MB`} />
            <StatRow label="Heap used" value={`${server.memoryMb.heapUsed} MB`} />
            <StatRow label="Heap total" value={`${server.memoryMb.heapTotal} MB`} />
          </DefinitionList>
        </SettingsSection>

        <SettingsSection title={<SectionTitle icon={DatabaseIcon}>Database</SectionTitle>}>
          <DefinitionList>
            <DefinitionTerm>Status</DefinitionTerm>
            <DefinitionDetail className="self-center">
              <Badge variant={database.status === "connected" ? "default" : "destructive"}>
                {database.status}
              </Badge>
            </DefinitionDetail>
            {database.sizeMb !== null && <StatRow label="Size" value={`${database.sizeMb} MB`} />}
            {database.activeConnections !== null && (
              <StatRow label="Connections" value={database.activeConnections} />
            )}
            <StatRow label="Migrations" value={database.totalMigrations} />
            {database.latestMigration && (
              <>
                <DefinitionTerm>Latest</DefinitionTerm>
                <DefinitionDetail className="truncate font-mono" title={database.latestMigration}>
                  {database.latestMigration}
                </DefinitionDetail>
              </>
            )}
          </DefinitionList>
        </SettingsSection>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <SettingsSection title={<SectionTitle icon={ActivityIcon}>Application</SectionTitle>}>
          <DefinitionList>
            <StatRow label="Users" value={formatNumber(app.totalUsers)} />
            <StatRow label="Signups (7d)" value={formatNumber(app.recentSignups7d)} />
            <StatRow label="Cards" value={formatNumber(app.totalCards)} />
            <StatRow label="Printings" value={formatNumber(app.totalPrintings)} />
            <StatRow label="Sets" value={formatNumber(app.totalSets)} />
            <StatRow label="Collections" value={formatNumber(app.totalCollections)} />
            <StatRow label="User decks" value={formatNumber(app.totalUserDecks)} />
            <StatRow label="Meta event decks" value={formatNumber(app.totalMetaDecks)} />
            <StatRow label="Wishlists" value={formatNumber(app.totalWishlists)} />
            <StatRow label="Tradelists" value={formatNumber(app.totalTradelists)} />
            <StatRow label="Friend groups" value={formatNumber(app.totalFriendGroups)} />
            <StatRow label="Copies" value={formatNumber(app.totalCopies)} />
          </DefinitionList>
        </SettingsSection>

        <SettingsSection title={<SectionTitle icon={TagIcon}>Pricing</SectionTitle>}>
          <DefinitionList>
            <StatRow label="Total prices" value={formatNumber(pricing.totalPrices)} />
          </DefinitionList>
          {pricing.sources.map((source) => (
            <div key={source.marketplace} className="flex flex-col gap-2">
              <SectionHeading as="h3" size="sm">
                {source.marketplace}
              </SectionHeading>
              <DefinitionList>
                <StatRow label="Products" value={formatNumber(source.products)} />
                <StatRow label="Price rows" value={formatNumber(source.prices)} />
                <DefinitionTerm>Latest price</DefinitionTerm>
                {source.latestPrice ? (
                  <DefinitionDetail className="font-mono">
                    {formatRelativeTime(source.latestPrice)}
                  </DefinitionDetail>
                ) : (
                  <DefinitionDetail className="self-center">
                    <Badge variant="secondary">none</Badge>
                  </DefinitionDetail>
                )}
              </DefinitionList>
            </div>
          ))}
          {pricing.sources.length === 0 && (
            <p className="text-muted-foreground text-sm">No marketplace data</p>
          )}
        </SettingsSection>
      </div>

      <SentrySmokeTestSection />
    </div>
  );
}

function SentrySmokeTestSection() {
  const throwSsr = useThrowInSsr();
  const throwApi = useThrowInApi();

  function handleBrowser() {
    // setTimeout so React's error boundary doesn't intercept: the Sentry
    // browser integration hooks window.onerror instead.
    setTimeout(() => {
      throw new Error(`Sentry smoke test (web-client) @ ${new Date().toISOString()}`);
    }, 0);
    toast.info("Thrown in browser — check openrift-ssr for service:web-client");
  }

  async function handleSsr() {
    try {
      await throwSsr.mutateAsync();
    } catch {
      toast.info("Thrown in SSR — check openrift-ssr for service:web-ssr");
      return;
    }
    toast.error("SSR throw returned successfully — did the server function run?");
  }

  async function handleApi() {
    try {
      await throwApi.mutateAsync();
    } catch {
      toast.info("Thrown in API — check openrift-api");
      return;
    }
    toast.error("API throw returned successfully — did the endpoint run?");
  }

  return (
    <SettingsSection
      title={<SectionTitle icon={BugIcon}>Sentry smoke test</SectionTitle>}
      description="Triggers a distinctly-tagged error on each surface so you can verify the event reaches Sentry. No-op when the DSN is unset. Each click creates a new issue (timestamp in message)."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={handleBrowser}>
          <BugIcon />
          Throw in browser
        </Button>
        <Button variant="outline" onClick={() => void handleSsr()} disabled={throwSsr.isPending}>
          {throwSsr.isPending ? <LoaderIcon className="animate-spin" /> : <BugIcon />}
          Throw in SSR
        </Button>
        <Button variant="outline" onClick={() => void handleApi()} disabled={throwApi.isPending}>
          {throwApi.isPending ? <LoaderIcon className="animate-spin" /> : <BugIcon />}
          Throw in API
        </Button>
      </div>
    </SettingsSection>
  );
}
