import { ParaglideMessage } from "@inlang/paraglide-js-react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CompassIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  EllipsisVerticalIcon,
  MenuIcon,
  ShareIcon,
  SmartphoneIcon,
  SquarePlusIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { QrCode } from "@/components/ui/qr-code";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { InstallGuide, InstallPlatform } from "@/lib/install-platform";
import {
  detectInstallPlatform,
  isStandaloneDisplay,
  openInBrowserUrl,
  startHerePlacement,
} from "@/lib/install-platform";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useInstallStore } from "@/stores/install-store";

type PhoneDevice = "iphone" | "android";

function Glyph({
  icon: Icon,
  iconOnly,
  children,
}: {
  icon: LucideIcon;
  iconOnly?: boolean;
  children?: ReactNode;
}) {
  return (
    <span className="bg-muted mx-0.5 inline-flex h-6 items-center gap-1 rounded-md border px-1.5 align-middle text-sm font-medium">
      <Icon className="size-4" aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </span>
  );
}

function markupFor(menuIcon: LucideIcon) {
  return {
    more: ({ children }: { children?: ReactNode }) => (
      <Glyph icon={EllipsisIcon} iconOnly>
        {children}
      </Glyph>
    ),
    share: ({ children }: { children?: ReactNode }) => <Glyph icon={ShareIcon}>{children}</Glyph>,
    add: ({ children }: { children?: ReactNode }) => (
      <Glyph icon={SquarePlusIcon}>{children}</Glyph>
    ),
    menu: ({ children }: { children?: ReactNode }) => (
      <Glyph icon={menuIcon} iconOnly>
        {children}
      </Glyph>
    ),
    b: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    close: ({ children }: { children?: ReactNode }) => (
      <Glyph icon={XIcon} iconOnly>
        {children}
      </Glyph>
    ),
    b2: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
  };
}

const IOS_MARKUP = markupFor(EllipsisIcon);
const CHROME_MARKUP = markupFor(EllipsisVerticalIcon);
const SAMSUNG_MARKUP = markupFor(MenuIcon);

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- fixed-order static steps
        <li key={index} className="bg-card flex items-start gap-3 rounded-lg border p-3">
          <span className="border-primary text-primary flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold">
            {index + 1}
          </span>
          <span className="leading-7">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function IosSteps({ guide, ipad }: { guide: InstallGuide; ipad: boolean }) {
  let shareStep: ReactNode;
  if (ipad) {
    shareStep = <ParaglideMessage message={m.install_ios_step_share_ipad} markup={IOS_MARKUP} />;
  } else if (guide === "ios-safari") {
    shareStep = <ParaglideMessage message={m.install_ios_safari_step_share} markup={IOS_MARKUP} />;
  } else if (guide === "ios-safari-legacy") {
    shareStep = <ParaglideMessage message={m.install_ios_legacy_step_share} markup={IOS_MARKUP} />;
  } else {
    shareStep = <ParaglideMessage message={m.install_ios_other_step_share} markup={IOS_MARKUP} />;
  }
  const confirmStep =
    guide === "ios-safari" ? (
      <ParaglideMessage message={m.install_ios_safari_step_confirm} markup={IOS_MARKUP} />
    ) : (
      <ParaglideMessage message={m.install_ios_step_confirm} markup={IOS_MARKUP} />
    );
  return (
    <div className="flex flex-col gap-3">
      <Steps
        steps={[
          shareStep,
          <ParaglideMessage key="step1" message={m.install_ios_step_add} markup={IOS_MARKUP} />,
          confirmStep,
        ]}
      />
      {guide === "ios-safari" && !ipad && (
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.install_ios_safari_share_hint} markup={IOS_MARKUP} />
        </p>
      )}
      <p className="text-muted-foreground">{m.install_ios_elsewhere_hint()}</p>
    </div>
  );
}

function AndroidSteps({ guide }: { guide: InstallGuide }) {
  if (guide === "android-samsung") {
    return (
      <Steps
        steps={[
          <ParaglideMessage
            key="step1"
            message={m.install_android_samsung_step_menu}
            markup={SAMSUNG_MARKUP}
          />,
          <ParaglideMessage
            key="step2"
            message={m.install_android_samsung_step_add}
            markup={SAMSUNG_MARKUP}
          />,
          <ParaglideMessage
            key="step3"
            message={m.install_android_samsung_step_confirm}
            markup={SAMSUNG_MARKUP}
          />,
        ]}
      />
    );
  }
  if (guide === "android-other") {
    return (
      <Steps
        steps={[
          m.install_android_other_step_menu(),
          <ParaglideMessage
            key="step1"
            message={m.install_android_other_step_add}
            markup={CHROME_MARKUP}
          />,
          m.install_android_other_step_confirm(),
        ]}
      />
    );
  }
  return (
    <Steps
      steps={[
        <ParaglideMessage
          key="step1"
          message={m.install_android_chrome_step_menu}
          markup={CHROME_MARKUP}
        />,
        <ParaglideMessage
          key="step2"
          message={m.install_android_chrome_step_add}
          markup={CHROME_MARKUP}
        />,
        <ParaglideMessage
          key="step3"
          message={m.install_android_chrome_step_install}
          markup={CHROME_MARKUP}
        />,
      ]}
    />
  );
}

function InstallPromptButton({ label }: { label: string }) {
  const promptInstall = useInstallStore((state) => state.promptInstall);
  return (
    <Button size="lg" className="h-12 w-full gap-2 text-base" onClick={() => void promptInstall()}>
      <DownloadIcon className="size-5" />
      {label}
    </Button>
  );
}

function AndroidGuide({ guide }: { guide: InstallGuide }) {
  const hasPrompt = useInstallStore((state) => state.promptEvent !== null);
  return (
    <div className="flex flex-col gap-4">
      {hasPrompt && (
        <>
          <div className="flex flex-col gap-2">
            <InstallPromptButton label={m.install_android_button()} />
            <p className="text-muted-foreground text-center">{m.install_android_button_hint()}</p>
          </div>
          <div className="text-muted-foreground flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            {m.install_android_no_button()}
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}
      {!hasPrompt && <ViewerHint guide={guide} />}
      <AndroidSteps guide={guide} />
    </div>
  );
}

function ViewerHint({ guide }: { guide: InstallGuide }) {
  return (
    <Callout>
      <p className="leading-7">
        {guide === "android-other" ? (
          <ParaglideMessage
            message={m.install_android_elsewhere_hint_generic}
            markup={CHROME_MARKUP}
          />
        ) : (
          <ParaglideMessage
            message={m.install_android_elsewhere_hint}
            inputs={{ browser: guide === "android-samsung" ? "Samsung Internet" : "Chrome" }}
            markup={CHROME_MARKUP}
          />
        )}
      </p>
    </Callout>
  );
}

function CopyLinkButton({ label, className }: { label: string; className?: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button
      variant="outline"
      size="lg"
      className={cn("h-11 gap-2", className)}
      onClick={() => void copy(globalThis.location.href)}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? m.common_copied() : label}
    </Button>
  );
}

function InAppGuide({ platform }: { platform: InstallPlatform }) {
  const ios = platform.os === "ios";
  const openHref = openInBrowserUrl(ios ? "ios" : "android", globalThis.location.href);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {platform.inAppName
          ? m.install_in_app_body_named({ app: platform.inAppName })
          : m.install_in_app_body_unnamed()}
      </p>
      <div className="flex flex-col gap-2">
        <a href={openHref} className={cn(buttonVariants({ size: "lg" }), "h-12 gap-2 text-base")}>
          <CompassIcon className="size-5" />
          {ios ? m.install_in_app_open_ios() : m.install_in_app_open_android()}
        </a>
        <CopyLinkButton label={m.install_copy_link()} />
      </div>
      <Callout>
        <p className="mb-1 font-semibold">{m.install_in_app_fallback_title()}</p>
        <p className="text-muted-foreground">
          {ios ? m.install_in_app_fallback_body_ios() : m.install_in_app_fallback_body_android()}
        </p>
      </Callout>
    </div>
  );
}

function StartHereArrow({
  placement,
}: {
  placement: NonNullable<ReturnType<typeof startHerePlacement>>;
}) {
  if (placement === "top-right") {
    return (
      <ArrowUpIcon
        aria-hidden="true"
        className="text-primary pointer-events-none fixed top-1 right-2 z-60 size-6 motion-safe:animate-bounce"
      />
    );
  }
  const bottomRight = placement === "bottom-right";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-40 flex flex-col gap-1",
        bottomRight ? "right-3 items-end" : "left-1/2 -translate-x-1/2 items-center",
      )}
    >
      <span className="bg-primary text-primary-foreground rounded-md px-2.5 py-1 text-sm font-bold">
        {m.install_arrow_start()}
      </span>
      <ArrowDownIcon
        className={cn("text-primary size-8 motion-safe:animate-bounce", bottomRight && "mr-1")}
      />
    </div>
  );
}

function DeviceSwitcher({
  value,
  onChange,
}: {
  value: PhoneDevice;
  onChange: (device: PhoneDevice) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as PhoneDevice)}>
      <TabsList aria-label={m.install_switch_label()}>
        <TabsTrigger value="iphone">{m.install_device_iphone()}</TabsTrigger>
        <TabsTrigger value="android">{m.install_device_android()}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function detectedLabel(platform: InstallPlatform): string {
  let device = m.install_device_computer();
  if (platform.os === "ios") {
    device = platform.ipad ? m.install_device_ipad() : m.install_device_iphone();
  } else if (platform.os === "android") {
    device = m.install_device_android();
  }
  const browsers: Partial<Record<InstallGuide, string>> = {
    "ios-safari": "Safari",
    "ios-safari-legacy": "Safari",
    "android-chrome": "Chrome",
    "android-samsung": "Samsung Internet",
  };
  const browser =
    platform.guide === "in-app"
      ? m.install_in_app_chip({ app: platform.inAppName ?? m.install_in_app_unknown() })
      : browsers[platform.guide];
  return browser ? `${device} · ${browser}` : device;
}

function PhoneView({
  platform,
  chosen,
  onChoose,
}: {
  platform: InstallPlatform;
  chosen: PhoneDevice | null;
  onChoose: (device: PhoneDevice) => void;
}) {
  const [switching, setSwitching] = useState(false);
  const device = chosen ?? (platform.os === "ios" ? "iphone" : "android");
  const inApp = chosen === null && platform.guide === "in-app";
  const arrow = chosen === null ? startHerePlacement(platform) : null;
  let heading = m.install_heading_phone();
  if (inApp) {
    heading =
      platform.os === "ios" ? m.install_in_app_heading_ios() : m.install_in_app_heading_android();
  }

  let guide: ReactNode;
  if (inApp) {
    guide = <InAppGuide platform={platform} />;
  } else if (device === "iphone") {
    guide = (
      <IosSteps
        guide={chosen === null ? platform.guide : "ios-safari"}
        ipad={chosen === null && platform.ipad}
      />
    );
  } else {
    guide = <AndroidGuide guide={chosen === null ? platform.guide : "android-chrome"} />;
  }

  return (
    <div className={cn("flex flex-col gap-5", arrow?.startsWith("bottom") && "pb-24")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="bg-card text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm">
          <SmartphoneIcon className="size-4" aria-hidden="true" />
          {detectedLabel(platform)}
        </span>
        {!switching && (
          <Button variant="link" size="sm" onClick={() => setSwitching(true)}>
            {m.install_not_your_device()}
          </Button>
        )}
      </div>
      {switching && <DeviceSwitcher value={device} onChange={onChoose} />}
      <div className="flex flex-col gap-2">
        <Heading level={1}>{heading}</Heading>
        {!inApp && <p className="text-muted-foreground">{m.install_intro()}</p>}
      </div>
      {guide}
      {arrow && <StartHereArrow placement={arrow} />}
    </div>
  );
}

function ComputerView() {
  const hasPrompt = useInstallStore((state) => state.promptEvent !== null);
  const promptInstall = useInstallStore((state) => state.promptInstall);
  const pageUrl = globalThis.location.href;
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Heading level={1}>{m.install_heading_desktop()}</Heading>
        <p className="text-muted-foreground">{m.install_intro()}</p>
        <div className="bg-card flex flex-col items-center gap-4 rounded-lg border p-5 sm:flex-row">
          <QrCode value={pageUrl} size={144} label={m.install_qr_label()} />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{m.install_qr_title()}</p>
            <p className="text-muted-foreground">{m.install_qr_body()}</p>
          </div>
        </div>
        <p className="text-muted-foreground">
          {hasPrompt ? m.install_desktop_prompt() : m.install_desktop_no_prompt()}{" "}
          {hasPrompt && (
            <Button variant="link" className="h-auto p-0" onClick={() => void promptInstall()}>
              {m.install_desktop_button()}
            </Button>
          )}
        </p>
      </div>
      <Tabs defaultValue="iphone" className="gap-4">
        <TabsList aria-label={m.install_switch_label()}>
          <TabsTrigger value="iphone">{m.install_device_iphone()}</TabsTrigger>
          <TabsTrigger value="android">{m.install_device_android()}</TabsTrigger>
        </TabsList>
        <TabsContent value="iphone" className="text-base">
          <IosSteps guide="ios-safari" ipad={false} />
        </TabsContent>
        <TabsContent value="android" className="text-base">
          <AndroidSteps guide="android-chrome" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InstalledView() {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <span className="bg-primary/15 border-primary text-primary flex size-16 items-center justify-center rounded-full border-[1.5px]">
        <CheckIcon className="size-8" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-2">
        <Heading level={1}>{m.install_installed_heading()}</Heading>
        <p className="text-muted-foreground">{m.install_installed_body()}</p>
      </div>
      <Callout className="flex w-full flex-col gap-3 text-left">
        <p className="font-semibold">{m.install_installed_other_title()}</p>
        <p className="text-muted-foreground">{m.install_installed_other_body()}</p>
        <CopyLinkButton label={m.install_copy_page_link()} />
      </Callout>
    </div>
  );
}

export function InstallPage() {
  const [chosen, setChosen] = useState<PhoneDevice | null>(null);
  const platform = detectInstallPlatform(globalThis.navigator.userAgent, navigator.maxTouchPoints);

  let content: ReactNode;
  if (isStandaloneDisplay()) {
    content = <InstalledView />;
  } else if (platform.os === "desktop") {
    content = <ComputerView />;
  } else {
    content = <PhoneView platform={platform} chosen={chosen} onChoose={setChosen} />;
  }

  return (
    <div className={cn(PAGE_WIDTH.capped, "flex flex-1 flex-col", PAGE_PADDING)}>{content}</div>
  );
}
