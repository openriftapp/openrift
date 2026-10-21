export interface SourceMappingConfig {
  source: string;
  displayName: string;
  shortName: string;
  productUrl: (id: number, language?: string | null) => string;
}
