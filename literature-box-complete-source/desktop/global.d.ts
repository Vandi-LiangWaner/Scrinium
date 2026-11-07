import type { DesktopSaveResult, DesktopSnapshot } from "../app/library-save";

declare global {
  interface Window {
    literatureBox?: {
      loadCards(revision?: number): Promise<DesktopSnapshot | null>;
      saveCards(changes: string): Promise<DesktopSaveResult>;
      onCloseRequested(save: () => Promise<boolean>): () => void;
      exportFile(kind: string, body: string): Promise<boolean>;
      importFile(): Promise<unknown>;
      dataLocation(): Promise<string>;
    };
  }
}
