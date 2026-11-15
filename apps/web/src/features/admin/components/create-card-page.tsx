import { enumLabel } from "@openrift/shared/enum-label";
import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useCreateCard } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  MANUAL_CARD_STATS,
  useManualCardDraft,
} from "@/features/admin/hooks/use-manual-card-draft";
import { ChipInput } from "@/features/contribute/components/form-fields";
import { useEnumOrders } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";
import { parseIntegerInput } from "@/lib/integer-input";

export function CreateCardPage() {
  const navigate = useNavigate();
  const createCard = useCreateCard();
  const { orders, labels } = useEnumOrders();
  const draft = useManualCardDraft();
  const { setTypes, setDomains, setSuperTypes, setTags } = draft;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = draft.input !== undefined && !createCard.isPending;

  function handleSubmit() {
    if (draft.input === undefined || createCard.isPending) {
      return;
    }
    setErrorMsg(null);
    createCard.mutate(draft.input, {
      onSuccess: (result) => {
        void navigate({
          to: "/admin/cards/$cardSlug",
          params: { cardSlug: result.cardSlug },
        });
      },
      onError: (error) => {
        setErrorMsg(errorText(error, "Failed to create card"));
      },
    });
  }

  return (
    <div className="max-w-2xl">
      <AdminPageTopBar title="Create Card" />
      <Card>
        <CardHeader>
          <CardTitle>Create new card</CardTitle>
          <CardDescription>Slug is auto-generated from the name until you edit it.</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="create-card-name">Name *</FieldLabel>
                <Input
                  id="create-card-name"
                  value={draft.name}
                  onChange={(e) => draft.setName(e.target.value)}
                  placeholder="e.g. Jinx, Rebel"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-card-slug">Slug *</FieldLabel>
                <Input
                  id="create-card-slug"
                  value={draft.slugInput}
                  onChange={(e) => draft.setSlug(e.target.value)}
                  placeholder="auto-generated from name"
                  className="font-mono"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Types *</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={draft.types}
                onValueChange={setTypes}
                className="w-full flex-wrap"
              >
                {orders.cardTypes.map((typeSlug) => (
                  <ToggleGroupItem key={typeSlug} value={typeSlug}>
                    {enumLabel(labels.cardTypes, typeSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel>Domains *</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={draft.domains}
                onValueChange={setDomains}
                className="w-full flex-wrap"
              >
                {orders.domains.map((domainSlug) => (
                  <ToggleGroupItem key={domainSlug} value={domainSlug}>
                    {enumLabel(labels.domains, domainSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field>
              <FieldLabel>Supertypes</FieldLabel>
              <ToggleGroup
                multiple
                variant="outline"
                spacing={2}
                value={draft.superTypes}
                onValueChange={setSuperTypes}
                className="w-full flex-wrap"
              >
                {orders.superTypes.map((superTypeSlug) => (
                  <ToggleGroupItem key={superTypeSlug} value={superTypeSlug}>
                    {enumLabel(labels.superTypes, superTypeSlug)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {MANUAL_CARD_STATS.map(({ key, label }) => (
                <Field key={key} data-invalid={parseIntegerInput(draft.numeric[key]) === undefined}>
                  <FieldLabel htmlFor={`create-card-${key}`}>{label}</FieldLabel>
                  <Input
                    id={`create-card-${key}`}
                    type="number"
                    min={0}
                    aria-invalid={parseIntegerInput(draft.numeric[key]) === undefined}
                    value={draft.numeric[key]}
                    onChange={(e) => draft.setStat(key, e.target.value)}
                    className="[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  {parseIntegerInput(draft.numeric[key]) === undefined && (
                    <FieldError>Whole number</FieldError>
                  )}
                </Field>
              ))}
            </div>

            <Field>
              <FieldLabel htmlFor="create-card-tags">Tags</FieldLabel>
              <ChipInput
                id="create-card-tags"
                value={draft.tags}
                onChange={setTags}
                placeholder="Press Enter or comma to add"
              />
            </Field>

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button disabled={!canSubmit} onClick={handleSubmit}>
                <PlusIcon className="size-4" />
                Create card
              </Button>
              <Button variant="ghost" onClick={() => void navigate({ to: "/admin/cards" })}>
                Cancel
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
