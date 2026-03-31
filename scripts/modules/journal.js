/* Foundry v13: JournalSheet → foundry.applications.sheets.journal.JournalEntrySheet (AppV2) */
export class SymbaroumJournalSheet extends foundry.applications.sheets.journal.JournalEntrySheet {
    get journal() {
        return this.document;
    }

    _onConfigureSheet(event) {
        event.preventDefault();
        new DocumentSheetConfig(this.journal, {
            top: this.position.top + 40,
            left: this.position.left + ((this.position.width - 400) / 2)
        }).render(true);
    };
}

export class SymbaroumWide extends SymbaroumJournalSheet {
    static NAME = 'SymbaroumWide';

    static register() {
      Journal.registerSheet('SYB5E', SymbaroumWide, { label: game.i18n.localize('SYB5E.journal.widejournal.name'), makeDefault: false });
    }

    /* AppV2: static DEFAULT_OPTIONS replaces static get defaultOptions() */
    static DEFAULT_OPTIONS = {
        classes: ['symbaroum-dnd5e-mod'],
        position: { width: 1268 },
    };
}
