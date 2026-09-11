import type { AdminCardResponse, CandidateCardResponse } from "@openrift/shared/types/api/admin";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";

const captured = vi.hoisted(() => ({
  spreadsheet: null as {
    fields?: { key: string }[];
    candidateRows?: unknown[];
    onCellClick?: (field: string, value: unknown, candidateId: string) => void;
    onCheck?: unknown;
    onUncheck?: unknown;
    columnActions?: React.ReactNode;
  } | null,
  acceptCardField: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: captured.toastSuccess } }));

vi.mock("@/features/admin/components/candidate-spreadsheet", () => ({
  CandidateSpreadsheet: (props: { fields?: { key: string }[] }) => {
    captured.spreadsheet = props;
    return null;
  },
}));

const stubMutation = { mutate: vi.fn(), isPending: false };
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptCardField: () => ({ mutate: captured.acceptCardField, isPending: false }),
  useCheckCandidateCard: () => stubMutation,
  useUncheckCandidateCard: () => stubMutation,
}));

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidateCard: () => stubMutation,
}));

// Stubbed so this stays a render test with no query client in scope.
vi.mock("@/features/admin/hooks/use-admin-card-submissions", () => ({
  useSubmissionForCandidate: () => ({ data: { submission: null } }),
  useSetSubmissionResolution: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardFieldsSection } from "./card-fields-section";

const card = { id: "card-uuid", name: "Yasuo", errata: null } as unknown as AdminCardResponse;

function stubSource(overrides: Partial<CandidateCardResponse> = {}): CandidateCardResponse {
  return {
    id: "cc1",
    provider: "piltover",
    externalId: "x1",
    checkedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as CandidateCardResponse;
}

const FIELDS: FieldDef<CandidateCardFieldKey>[] = [
  { key: "name", label: "Name" },
  { key: "energy", label: "Energy" },
  { key: "externalId", label: "External ID", readOnly: true },
];

function renderSection(
  props: Partial<React.ComponentProps<typeof CardFieldsSection>> = {},
): ReturnType<typeof render> {
  const noop = () => {};
  return render(
    <CardFieldsSection
      card={card}
      sources={[]}
      candidateCardFields={FIELDS}
      providerSettings={[]}
      onCheckAllSources={noop}
      isCheckingAllSources={false}
      invalidates={[]}
      isAdmin
      {...props}
    />,
  );
}

beforeEach(() => {
  captured.spreadsheet = null;
  captured.acceptCardField.mockReset();
  captured.toastSuccess.mockReset();
});

describe("CardFieldsSection", () => {
  it("shows every candidate-card field in the compare grid", () => {
    renderSection();

    expect(captured.spreadsheet?.fields?.map((f) => f.key)).toEqual([
      "name",
      "energy",
      "externalId",
    ]);
  });

  it("skips grid columns the accept endpoint cannot write", () => {
    renderSection();

    captured.spreadsheet?.onCellClick?.("externalId", "x1", "cc1");
    expect(captured.acceptCardField).not.toHaveBeenCalled();

    captured.spreadsheet?.onCellClick?.("name", "Jinx", "cc1");
    expect(captured.acceptCardField).toHaveBeenCalledWith({
      cardId: card.id,
      field: "name",
      value: "Jinx",
      source: "provider",
    });
  });

  it("offers the old value back after accepting one from a source", () => {
    renderSection({ sources: [stubSource()] });

    captured.spreadsheet?.onCellClick?.("name", "Jinx", "cc1");

    const [message, options] = captured.toastSuccess.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    expect(message).toBe("Used Name from piltover");

    options.action.onClick();
    expect(captured.acceptCardField).toHaveBeenLastCalledWith({
      cardId: card.id,
      field: "name",
      value: "Yasuo",
      source: "manual",
    });
  });

  it("renders the grid, which the nav decides to show at all", () => {
    renderSection();

    expect(captured.spreadsheet).not.toBeNull();
  });

  it("counts only the unchecked sources on the check-all button", () => {
    const onCheckAllSources = vi.fn();
    const { getByText } = renderSection({
      sources: [
        stubSource({ id: "cc1", checkedAt: null }),
        stubSource({ id: "cc2", checkedAt: null }),
        stubSource({ id: "cc3" }),
      ],
      onCheckAllSources,
    });

    getByText("Check 2 unchecked").click();
    expect(onCheckAllSources).toHaveBeenCalledTimes(1);
  });

  it("hides the check-all button once every source is checked", () => {
    const { queryByText } = renderSection({ sources: [stubSource()] });

    expect(queryByText(/unchecked/u)).toBeNull();
  });

  it("withholds the triage affordances from non-admins", () => {
    const { queryByText } = renderSection({
      isAdmin: false,
      sources: [stubSource({ checkedAt: null })],
    });

    expect(queryByText(/unchecked/u)).toBeNull();
    expect(captured.spreadsheet?.onCheck).toBeUndefined();
    expect(captured.spreadsheet?.onUncheck).toBeUndefined();
  });
});
