import { LogInIcon } from "lucide-react";
import type { ReactNode } from "react";
import { siDiscord, siGoogle } from "simple-icons";
import { toast } from "sonner";

import { Heading } from "@/components/heading";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { authClient } from "@/features/account/lib/auth-client";
import { isPreview } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function AuthFormCard({
  className,
  title,
  subtitle,
  layout = "split",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: string;
  subtitle: ReactNode;
  layout?: "split" | "single";
}) {
  const split = layout === "split";
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className={cn("grid p-0", split && "md:grid-cols-2")}>
          <div className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <img
                  src="/logo-color.svg"
                  alt="OpenRift"
                  className={cn("size-12", split && "md:hidden")}
                />
                <Heading level={1}>{title}</Heading>
                <p className="text-muted-foreground text-balance">{subtitle}</p>
              </div>
              {children}
            </FieldGroup>
          </div>
          {split && (
            <div className="bg-muted relative hidden md:block">
              <img
                src="/logo-color.svg"
                alt="OpenRift"
                className="absolute inset-0 m-auto size-48 object-contain"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SocialAuthButtons({ redirectTo }: { redirectTo?: string }) {
  if (isPreview()) {
    return null;
  }
  const callbackURL = redirectTo ?? "/collections";

  async function signInWith(provider: "google" | "discord") {
    try {
      await authClient.signIn.social({ provider, callbackURL });
    } catch {
      toast.error(m.auth_social_provider_failed());
    }
  }

  return (
    <>
      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        {m.auth_or_continue_with()}
      </FieldSeparator>
      <Field className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={() => void signInWith("google")}
        >
          <BrandGlyph icon={siGoogle} fallback={LogInIcon} />
          Google
        </Button>
        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={() => void signInWith("discord")}
        >
          <BrandGlyph icon={siDiscord} fallback={LogInIcon} />
          Discord
        </Button>
      </Field>
    </>
  );
}
