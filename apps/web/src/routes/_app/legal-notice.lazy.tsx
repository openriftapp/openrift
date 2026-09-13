import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link, createLazyFileRoute } from "@tanstack/react-router";

import { ProsePage } from "@/components/prose-page";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/legal-notice")({
  component: LegalNoticePage,
});

function LegalNoticePage() {
  return (
    <ProsePage>
      <h1>{m.legal_notice_title()}</h1>

      <h2>{m.legal_notice_responsible_heading()}</h2>
      <p>
        Eiko Wagenknecht
        <br />
        Burgwedeler Str. 77
        <br />
        30657 Hannover
        <br />
        Germany
      </p>
      <p>
        USt-ID: DE308816328
        <br />
        E-Mail: <a href="mailto:support@openrift.app">support@openrift.app</a>
      </p>

      <h2>{m.legal_notice_disclaimer_heading()}</h2>

      <h3>{m.legal_notice_content_heading()}</h3>
      <p>{m.legal_notice_content_p1()}</p>
      <p>{m.legal_notice_content_p2()}</p>

      <h3>{m.legal_notice_links_heading()}</h3>
      <p>{m.legal_notice_links_p1()}</p>
      <p>{m.legal_notice_links_p2()}</p>

      <h3>{m.legal_notice_copyright_heading()}</h3>
      <p>{m.legal_notice_copyright_p1()}</p>
      <p>{m.legal_notice_copyright_p2()}</p>
      <p>{m.legal_notice_copyright_p3()}</p>

      <h3>{m.legal_notice_riot_heading()}</h3>
      <p>{m.legal_notice_riot_p()}</p>

      <h3>{m.legal_notice_validity_heading()}</h3>
      <p>{m.legal_notice_validity_p()}</p>

      <h2>{m.legal_notice_privacy_heading()}</h2>
      <p>
        <ParaglideMessage
          message={m.legal_notice_privacy_see}
          markup={{ link: ({ children }) => <Link to="/privacy-policy">{children}</Link> }}
        />
      </p>
    </ProsePage>
  );
}
