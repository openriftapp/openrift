import type { Kysely } from "kysely";

import type { Database } from "../../db/tables.js";
import { bindEmailDeps } from "../../email.js";
import type { EmailDeps } from "../../email.js";
import { candidateCardsRepo } from "./repositories/candidate-cards.js";
import { cardSubmissionsRepo } from "./repositories/card-submissions.js";
import { ignoredCandidatesRepo } from "./repositories/ignored-candidates.js";
import { ingestRepo } from "./repositories/ingest.js";
import { notifyAdminsOfCardSubmission } from "./services/card-submission-notifications.js";
import { notifySubmitterOfCardAcceptance } from "./services/card-submission-thanks.js";

export interface CandidatesRepos {
  cardSubmissions: ReturnType<typeof cardSubmissionsRepo>;
  candidateCards: ReturnType<typeof candidateCardsRepo>;
  ignoredCandidates: ReturnType<typeof ignoredCandidatesRepo>;
  ingest: ReturnType<typeof ingestRepo>;
}

export interface CandidatesServices {
  notifyAdminsOfCardSubmission: typeof notifyAdminsOfCardSubmission;
  notifySubmitterOfCardAcceptance: typeof notifySubmitterOfCardAcceptance;
}

export function createCandidatesRepos(db: Kysely<Database>): CandidatesRepos {
  return {
    cardSubmissions: cardSubmissionsRepo(db),
    candidateCards: candidateCardsRepo(db),
    ignoredCandidates: ignoredCandidatesRepo(db),
    ingest: ingestRepo(db),
  };
}

export function createCandidatesServices(emailDeps?: EmailDeps): CandidatesServices {
  return {
    notifyAdminsOfCardSubmission: bindEmailDeps(notifyAdminsOfCardSubmission, emailDeps),
    notifySubmitterOfCardAcceptance: bindEmailDeps(notifySubmitterOfCardAcceptance, emailDeps),
  };
}
