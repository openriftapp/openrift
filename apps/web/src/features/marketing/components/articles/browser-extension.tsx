import { Link } from "@tanstack/react-router";
import { InfoIcon, LinkIcon, ListIcon, ScanTextIcon, TableIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { SOCIAL_LINKS } from "@/lib/social-links";

export default function BrowserExtensionArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        OpenRift Companion is a small Firefox extension that does two things. It sends the decklist
        you&apos;re looking at on another site to OpenRift&apos;s import page, and it marks a
        Cardmarket seller&apos;s offers with how many copies you own and how many you still want.
        Clicking the icon in the toolbar opens a popup with the one action that fits the page
        you&apos;re on.
      </p>

      <section>
        <Heading className="mb-2">Install it</Heading>
        <p className="text-muted-foreground">
          Mozilla signs the add-on, but I host it myself instead of listing it on
          addons.mozilla.org, so installing takes one extra confirmation.
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title="Download the add-on"
            description="Open the link below in Firefox. It hands you the add-on file directly."
          />
          <StepRow
            step={2}
            title="Confirm the install"
            description="Firefox asks whether to add it and lists what it may access. Adding it puts an OpenRift icon in the toolbar."
          />
          <StepRow
            step={3}
            title="Pin the icon"
            description="Optional, but worth it: open the puzzle-piece menu and pin OpenRift so the popup is one click away."
          />
        </div>
        <p className="mt-3">
          <TextLink
            className="font-medium"
            href={SOCIAL_LINKS.extensionDownload}
            target="_blank"
            rel="noreferrer"
          >
            Download OpenRift Companion for Firefox
          </TextLink>
        </p>
        <p className="text-muted-foreground mt-3">
          Updates take care of themselves. Firefox checks for a newer signed build roughly once a
          day, so you only ever do this once.
        </p>
      </section>

      <section>
        <Heading className="mb-2">Import a deck</Heading>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title="Open the decklist"
            description="Any page on another site showing the deck you want, on the tab you're reading."
          />
          <StepRow
            step={2}
            title="Click the icon, then Import deck"
            description="It reads the deck from that page, once, and opens OpenRift's import page in a new tab."
          />
          <StepRow
            step={3}
            title="Review and save"
            description="The deck name comes from the page heading, and the page's own address is offered as a deck link you can keep or drop. Check the cards it matched, then save."
          />
        </div>
        <p className="text-muted-foreground mt-3">
          Signed out, the deck is saved in your browser and moves to your account the next time you
          sign in.
        </p>
      </section>

      <section>
        <Heading className="mb-2">What it can read</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<TableIcon className="size-4" />}
            title="Decklist tables"
            description="A table of card names and quantities, with zones kept apart. The common shape on deck sites."
          />
          <FeatureCard
            icon={<ListIcon className="size-4" />}
            title="Card lists with headings"
            description="A plain list of names under section headings. Sideboards stay separate; card-type groupings fold into the main deck."
          />
          <FeatureCard
            icon={<ScanTextIcon className="size-4" />}
            title="Deck codes on the page"
            description="A deck code in the address, in the text, or behind a link. It's decoded to check it really is one before anything happens."
          />
          <FeatureCard
            icon={<LinkIcon className="size-4" />}
            title="Nothing it recognizes"
            description="The popup says so and stops there. Copy the list by hand into the import page instead."
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">Your counts on Cardmarket</Heading>
        <p className="text-muted-foreground">
          Nothing about the seller, the page, or what you look at goes back to OpenRift. Your counts
          travel the other way, and the matching happens inside the Cardmarket page.
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title="Pick the wishlists to count"
            description={
              <>
                On <TextLink render={<Link to="/extension/cardmarket" />}>the counts page</TextLink>
                , every wishlist starts ticked. Untick the ones you don&apos;t want counted.
              </>
            }
          />
          <StepRow
            step={2}
            title="Let the add-on take them"
            description="Once you've allowed it access, it takes them as the page opens. Otherwise click the OpenRift icon while that page is open."
          />
          <StepRow
            step={3}
            title="Open a seller's offers"
            description={
              <>
                Every card you own or want is marked{" "}
                <span className="font-mono">own 2 · want 4</span>, with your own price beside the
                seller&apos;s asking price. Cards you neither own nor want are left alone.
              </>
            }
          />
        </div>
        <p className="text-muted-foreground mt-3">
          The price shown is whichever marketplace sits first in your marketplace order, the same
          one OpenRift prices your cards with everywhere else. The seller&apos;s asking price is
          tinted against it: green at or under, amber up to a fifth over, red beyond that.
          Cardmarket sells in euro, so a TCGplayer price is shown but never compared.
        </p>
        <p className="text-muted-foreground mt-3">
          Counts go stale as you buy and sell. The popup says how old they are and which wishlists
          they came from, and refreshes them in one click.
        </p>
      </section>

      <section>
        <Heading className="mb-2">Pick cards from a seller</Heading>
        <p className="text-muted-foreground">
          Buying from someone you know, outside Cardmarket? Pick the cards on their offers and turn
          them into a list you can send them.
        </p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title="Press + on the cards you want"
            description="Every card on a seller's offers gets a small + and − next to it. Press + once per copy. The count on the OpenRift icon keeps the total across pages."
          />
          <StepRow
            step={2}
            title="Send them to OpenRift"
            description="Open the popup and choose Send to OpenRift next to the seller's name. A review page opens with your picks matched to cards, and the picks leave the extension."
          />
          <StepRow
            step={3}
            title="Save the list and share it"
            description="Fix anything that did not match, then save. Picks go to an organize list, so your wishlists stay untouched, and the list's share link is what you send the seller."
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">What it can access</Heading>
        <p className="text-muted-foreground">
          Installing it asks for nothing but the tab you&apos;re on, in the moment you act. It has
          no list of sites, so it can&apos;t run in the background and never sees your browsing
          history.
        </p>
        <p className="text-muted-foreground mt-3">
          For the Cardmarket counts you can grant it two sites, www.cardmarket.com and this one,
          from the popup or its options page. A fresh install opens that page so the choice
          isn&apos;t buried. Granting them buys one thing: it stops needing the click. Offers pages
          get marked as they load, and your counts are picked up whenever the counts page opens.
          Decline and everything still works, one page at a time, from the popup.
        </p>
      </section>

      <section>
        <Alert>
          <InfoIcon className="text-primary" />
          <AlertDescription>
            Firefox only for now. A Chrome version is built and works, but Chrome allows no way to
            install one outside its Web Store, and I haven&apos;t taken it through that yet.
          </AlertDescription>
        </Alert>
      </section>
    </div>
  );
}
