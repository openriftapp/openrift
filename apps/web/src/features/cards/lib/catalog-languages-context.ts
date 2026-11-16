import { createContext } from "react";

/** The languages a page shows first; a catalogue fetch started under it asks for these. Null falls back to the viewer's preferences. */
export const CatalogLanguagesContext = createContext<readonly string[] | null>(null);
