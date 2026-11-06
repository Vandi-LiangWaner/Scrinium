import type { CardPatch } from "../app/library-save";

declare global {
  interface Window {
    literatureBox?: {
      loadCards(): Promise<unknown>;
      saveCards(cards: unknown): Promise<boolean>;
      patchCard(patch: CardPatch): Promise<boolean>;
      onCloseRequested(save: () => Promise<boolean>): () => void;
      exportFile(kind: string, body: string): Promise<boolean>;
      importFile(): Promise<unknown>;
      dataLocation(): Promise<string>;
    };
  }
}
