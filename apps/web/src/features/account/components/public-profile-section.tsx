import { zodResolver } from "@hookform/resolvers/zod";
import { PROFILE_BIO_MAX_LENGTH, validateProfileBio } from "@openrift/shared/profile-bio";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod/v4";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/features/account/lib/auth-client";
import { sessionQueryOptions } from "@/lib/auth-session";

export interface PublicProfileValues {
  bio: string | null;
  profileShowRiotId: boolean;
  profileShowCollection: boolean;
  profileShowLastActive: boolean;
}

type ProfileToggle = Exclude<keyof PublicProfileValues, "bio">;

const TOGGLES: { key: ProfileToggle; label: string; description: string }[] = [
  {
    key: "profileShowRiotId",
    label: "Show my Riot ID",
    description: "Your display name is always shown.",
  },
  {
    key: "profileShowCollection",
    label: "Show my collection size",
    description: "How many cards you own, never which ones.",
  },
  {
    key: "profileShowLastActive",
    label: "Show when I was last active",
    description: "Rounded to today, this week or this month.",
  },
];

export function PublicProfileSection({
  userId,
  values,
}: {
  userId: string;
  values: PublicProfileValues;
}) {
  return (
    <SettingsSection
      title="Public profile"
      description="What your share page says about you besides your lists. Contributions, tournaments and decks are counted for everyone."
      contentClassName="gap-6"
    >
      <BioForm key={userId} defaultBio={values.bio ?? ""} />
      <div className="flex flex-col gap-4">
        {TOGGLES.map((toggle) => (
          <ProfileToggleRow key={toggle.key} toggle={toggle} checked={values[toggle.key]} />
        ))}
      </div>
    </SettingsSection>
  );
}

const bioSchema = z.object({
  bio: z.string().superRefine((value, ctx) => {
    const result = validateProfileBio(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.reason });
    }
  }),
});

type BioValues = z.infer<typeof bioSchema>;

function BioForm({ defaultBio }: { defaultBio: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<BioValues>({
    resolver: zodResolver(bioSchema),
    defaultValues: { bio: defaultBio },
  });
  const watchedBio = useWatch({ control: form.control, name: "bio" });

  async function onSubmit(values: BioValues) {
    setLoading(true);
    setSuccess(false);
    // An empty string normalizes to null server-side (clears the field).
    const result = await authClient.updateUser({ bio: values.bio.trim() }).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: "Could not save. Please try again." });
      return;
    }
    const { error } = result;
    if (error) {
      form.setError(error.code === "INVALID_BIO" ? "bio" : "root", {
        message: error.message ?? "Could not save. Please try again.",
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    setSuccess(true);
  }

  return (
    <form onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} noValidate>
      <FieldGroup>
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <Controller
          name="bio"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Bio</FieldLabel>
              <Textarea
                {...field}
                id={field.name}
                rows={2}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                placeholder="Fury and Chaos player from Frankfurt. Collecting a full Origins playset."
                aria-invalid={fieldState.invalid}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldDescription>
                  One line under your name. {watchedBio.length}/{PROFILE_BIO_MAX_LENGTH}
                </FieldDescription>
                <Button type="submit" disabled={loading || watchedBio.trim() === defaultBio}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              {success && (
                <FieldDescription className="flex items-center gap-1.5">
                  <CheckIcon className="text-success size-3.5" />
                  Bio updated.
                </FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}

function ProfileToggleRow({
  toggle,
  checked,
}: {
  toggle: (typeof TOGGLES)[number];
  checked: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const queryClient = useQueryClient();
  const id = `public-profile-${toggle.key}`;

  async function onChange(next: boolean) {
    setPending(true);
    setFailed(false);
    const result = await authClient.updateUser({ [toggle.key]: next }).catch(() => null);
    if (!result || result.error) {
      setFailed(true);
    } else {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    }
    setPending(false);
  }

  return (
    <SettingsRow
      label={toggle.label}
      htmlFor={id}
      description={failed ? "Could not save. Please try again." : toggle.description}
    >
      <Switch
        id={id}
        checked={checked}
        disabled={pending}
        onCheckedChange={(next: boolean) => void onChange(next)}
      />
    </SettingsRow>
  );
}
