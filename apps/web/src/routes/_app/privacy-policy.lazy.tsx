import { createLazyFileRoute } from "@tanstack/react-router";

import { ProsePage } from "@/components/prose-page";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/privacy-policy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <ProsePage>
      <h1>{m.privacy_title()}</h1>

      <h2>{m.privacy_controller_heading()}</h2>
      <p>{m.privacy_controller_intro()}</p>
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
        E-Mail: <a href="mailto:support@openrift.app">support@openrift.app</a>
      </p>

      <h2>{m.privacy_general_heading()}</h2>
      <p>{m.privacy_general_p()}</p>

      <h2>{m.privacy_legal_basis_heading()}</h2>
      <p>{m.privacy_legal_basis_p()}</p>

      <h2>{m.privacy_retention_heading()}</h2>
      <p>{m.privacy_retention_p()}</p>

      <h2>{m.privacy_logs_heading()}</h2>
      <p>{m.privacy_logs_intro()}</p>
      <ul>
        <li>{m.privacy_logs_browser()}</li>
        <li>{m.privacy_logs_os()}</li>
        <li>{m.privacy_logs_referrer()}</li>
        <li>{m.privacy_logs_ip()}</li>
        <li>{m.privacy_logs_timestamp()}</li>
      </ul>
      <p>{m.privacy_logs_p()}</p>

      <h2>{m.privacy_cookies_heading()}</h2>
      <p>{m.privacy_cookies_p1()}</p>
      <p>{m.privacy_cookies_p2()}</p>
      <p>{m.privacy_cookies_p3()}</p>

      <h2>{m.privacy_registration_heading()}</h2>
      <p>{m.privacy_registration_intro()}</p>
      <ul>
        <li>{m.privacy_registration_email()}</li>
        <li>{m.privacy_registration_display_name()}</li>
        <li>{m.privacy_registration_password()}</li>
      </ul>
      <p>{m.privacy_registration_p1()}</p>
      <p>{m.privacy_registration_p2()}</p>

      <h2>{m.privacy_oauth_heading()}</h2>
      <p>{m.privacy_oauth_p1()}</p>
      <p>{m.privacy_oauth_p2()}</p>

      <h2>{m.privacy_gravatar_heading()}</h2>
      <p>
        {m.privacy_gravatar_p1()}{" "}
        <a href="https://automattic.com/privacy/" target="_blank" rel="noreferrer">
          https://automattic.com/privacy/
        </a>
      </p>
      <p>{m.privacy_gravatar_p2()}</p>

      <h2>{m.privacy_external_links_heading()}</h2>
      <p>{m.privacy_external_links_p()}</p>

      <h2>{m.privacy_external_content_heading()}</h2>
      <p>{m.privacy_external_content_p()}</p>

      <h2>{m.privacy_extension_heading()}</h2>
      <p>{m.privacy_extension_p1()}</p>
      <p>{m.privacy_extension_p2()}</p>

      <h2>{m.privacy_rights_heading()}</h2>
      <p>{m.privacy_rights_intro()}</p>
      <ul>
        <li>{m.privacy_rights_access()}</li>
        <li>{m.privacy_rights_rectification()}</li>
        <li>{m.privacy_rights_erasure()}</li>
        <li>{m.privacy_rights_restriction()}</li>
        <li>{m.privacy_rights_portability()}</li>
        <li>{m.privacy_rights_object()}</li>
        <li>{m.privacy_rights_withdraw()}</li>
        <li>{m.privacy_rights_complaint()}</li>
      </ul>
      <p>{m.privacy_rights_p()}</p>

      <h2>{m.privacy_authority_heading()}</h2>
      <p>{m.privacy_authority_intro()}</p>
      <p>
        Die Landesbeauftragte für den Datenschutz Niedersachsen
        <br />
        Prinzenstraße 5<br />
        30159 Hannover
        <br />
        Germany
        <br />
        <a href="https://www.lfd.niedersachsen.de" target="_blank" rel="noreferrer">
          www.lfd.niedersachsen.de
        </a>
      </p>

      <h2>{m.privacy_changes_heading()}</h2>
      <p>{m.privacy_changes_p()}</p>

      <p className="text-muted-foreground text-sm">{m.privacy_last_updated()}</p>
    </ProsePage>
  );
}
