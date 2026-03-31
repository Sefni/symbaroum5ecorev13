import { COMMON } from '../common.js';
import { logger } from '../logger.js';

export class SheetCommon {
	static NAME = 'SheetCommon';

	/** SETUP **/

	/* -------------------------------------------- */

	static register() {
		this.globals();
		this.build();
	}

	/* -------------------------------------------- */

	static build() {
		/* dnd5e 5.x: sheet classes renamed */
		const charSheet = dnd5e.applications.actor.CharacterActorSheet;
		const npcSheet = dnd5e.applications.actor.NPCActorSheet;

		this.buildCharSheet(charSheet);
		this.buildNpcSheet(npcSheet);
	}

	/* -------------------------------------------- */

	static globals() {
		game.syb5e.sheetClasses = [];
	}

	/** \SETUP **/

	/* -------------------------------------------- */

	/** DEFAULT DATA AND PATHS **/

	/* -------------------------------------------- */

	static defaults(sheetClass) {
		sheetClass['NAME'] = sheetClass.name;

		// TODO is this field in COMMON needed?
		COMMON[sheetClass.NAME] = {
			scope: 'dnd5e',
			sheetClass,
		};

		/* need to use our own defaults to set our defaults */
		COMMON[sheetClass.NAME].id = `${COMMON[sheetClass.NAME].scope}.${COMMON[sheetClass.NAME].sheetClass.name}`;

		/* store this information in a better place */
		game.syb5e.sheetClasses.push(COMMON[sheetClass.NAME]);
	}

	/** \DEFAULTS **/

	/** SYB DATA SETUP **/

	/* -------------------------------------------- */

	static _getCorruptionAbilityData(actor, contextAbilities) {
		const corruptionAbilities = Object.entries(contextAbilities).reduce((acc, [key, val]) => {
			acc.push({ ability: key, label: game.i18n.localize(`DND5E.Ability${key.capitalize()}`) });
			return acc;
		}, []);

		/* if this actor has any spellcasting, allow it to be selected as corruption stat */
		if (actor.system.attributes.spellcasting?.length > 0) {
			corruptionAbilities.push({ ability: 'spellcasting', label: COMMON.localize('DND5E.Spellcasting') });
		}

		/* add in the 'custom' option */
		corruptionAbilities.push({ ability: 'custom', label: COMMON.localize('SYB5E.Corruption.Custom') });

		/* add in the 'thoroughly corrupt' option */
		corruptionAbilities.push({ ability: 'thorough', label: COMMON.localize('SYB5E.Corruption.ThoroughShort') });

		let corruptionAbilityData = {
			path: game.syb5e.CONFIG.PATHS.corruption.ability,
			abilities: corruptionAbilities,
			current: actor.corruption.ability,
			disabled: false,
			thorough: actor.corruption.ability === 'thorough',
		};

		/* can only edit max corruption if using a custom value */
		corruptionAbilityData.disabled = corruptionAbilityData.current !== 'custom' ? 'disabled' : '';

		return corruptionAbilityData;
	}

	/* -------------------------------------------- */

	/* Common context data between characters and NPCs */
	static async _getCommonData(actor, context) {
		/* Add in our corruption values in 'data.attributes' */
		const commonData = {
			sybPaths: game.syb5e.CONFIG.PATHS,
			corruptionAbilities: SheetCommon._getCorruptionAbilityData(actor, context.system.abilities),
			system: {
				attributes: {
					corruption: actor.corruption,
				},
				details: {
					shadow: actor.shadow,
				},
			},
		};

		foundry.utils.mergeObject(context, commonData);
	}

	static async renderCurrencyRow(actor) {
		const data = {
			currency: actor.system.currency,
			labels: game.syb5e.CONFIG.CURRENCY,
		};

		COMMON.translateObject(data.labels);

		const rendered = await renderTemplate(`${COMMON.DATA.path}/templates/actors/parts/actor-currency.html`, data);

		return rendered;
	}

	/* -------------------------------------------- */

	/**
	 * Common _onRender logic for both character and NPC sheets.
	 * AppV2: replaces old _render. Called with sheet as `this`.
	 * @param {object} context - The prepared context from _prepareContext
	 */
	static _onRender(context) {
		/* suppress spell slot display */
		const spellSlots = this.element.querySelector('.spell-slots');
		if (spellSlots) spellSlots.style.display = 'none';

		/* Replace currency row (pre-rendered in _prepareContext) */
		if (context._sybCurrencyRow) {
			switch (this.actor.type) {
				case 'character': {
					const currencyEl = this.element.querySelector('.currency');
					if (currencyEl) currencyEl.outerHTML = context._sybCurrencyRow;
					break;
				}
				case 'npc': {
					const inventoryFilters = this.element.querySelector('.features .inventory-filters');
					if (inventoryFilters) inventoryFilters.insertAdjacentHTML('afterbegin', context._sybCurrencyRow);
					break;
				}
			}
		}

		/* Replace the 'Prepared (N)' text with 'Favored (M)' */
		const preparedCounter = this.element.querySelector('[data-filter="prepared"]');
		if (preparedCounter) {
			preparedCounter.textContent = `${COMMON.localize('SYB5E.Spell.Favored')} (${this._numFavored ?? 0})`;
		}

		/* currency conversion listener */
		this.element.querySelector('.currency-convert')?.addEventListener('click', SheetCommon._onSybCurrencyConvert.bind(this));

		/* spell toggle (favored) listeners */
		this.element.querySelectorAll('.item-toggle')?.forEach((el) => {
			el.addEventListener('click', (ev) => SheetCommon._onToggleItem.call(this, ev));
		});
	}

	/* -------------------------------------------- */

	static _filterForFavored(items) {
		/* now, add in our favored filter */
		const favored = items.filter((item) => {
			//Favored filter
			return foundry.utils.getProperty(item, game.syb5e.CONFIG.PATHS.favored) > 0;
		});

		return favored;
	}

	/* -------------------------------------------- */

	static _prepareItemToggleState(item) {
		if (item.type === 'spell') {
			const favoredState = foundry.utils.getProperty(item, game.syb5e.CONFIG.PATHS.favored) ?? -1;
			return {
				toggleClass: {
					1: 'active',
					0: '',
					'-1': 'fixed',
				}[favoredState],
				toggleTitle: {
					1: COMMON.localize('SYB5E.Spell.Favored'),
					0: COMMON.localize('SYB5E.Spell.NotFavored'),
					'-1': COMMON.localize('SYB5E.Spell.NeverFavored'),
				}[favoredState],
			};
		}
		return {};
	}

	/* -------------------------------------------- */

	/* targets: context.spellbook, context.preparedSpells */
	static _prepareItems(context) {
		/* zero out prepared count */
		context.preparedSpells = 0;

		let favoredSpells = 0;
		const spellbook = context.spellbook ?? [];
		spellbook.forEach((groupEntry) => {
			/* dnd5e 5.x: dataset may use 'method' instead of 'preparation.mode' */
			const prepMode = groupEntry.dataset?.['preparation.mode'] ?? groupEntry.dataset?.method;
			if (prepMode !== 'atwill' && prepMode !== 'innate' && prepMode !== 'pact') {
				/* valid group to be favored */
				groupEntry.canPrepare = this.actor.type == 'character';
				favoredSpells += (groupEntry.spells ?? []).reduce((acc, spellData) => {
					const favored = foundry.utils.getProperty(spellData, game.syb5e.CONFIG.PATHS.favored);
					return favored > 0 ? acc + 1 : acc;
				}, 0);
			}
		});

		this._numFavored = favoredSpells;
	}

	/* -------------------------------------------- */

	/**
	 * Handle toggling the state of an Owned Item within the Actor.
	 * @param {Event} event        The triggering click event.
	 * @returns {Promise<Item5e>}  Item with the updates applied.
	 */
	static _onToggleItem(event) {
		event.preventDefault();
		/* AppV2: use data-item-id or closest .item with dataset */
		const itemEl = event.currentTarget.closest('[data-item-id]') ?? event.currentTarget.closest('.item');
		const itemId = itemEl?.dataset.itemId;
		const item = this.actor.items.get(itemId);
		if (!item) return;

		/* change from dnd5e source -- modifying FAVORED rather than prepared */
		if (item.type === 'spell') {
			if ((foundry.utils.getProperty(item, game.syb5e.CONFIG.PATHS.favored) ?? 0) < 0) {
				/* "never favored" items are "locked" */
				return;
			}
			return item.update({ [game.syb5e.CONFIG.PATHS.favored]: item.isFavored ? 0 : 1 });
		} else {
			const attr = 'system.equipped';
			return item.update({ [attr]: !foundry.utils.getProperty(item, attr) });
		}
	}

	/** \COMMON **/

	/* -------------------------------------------- */

	static async _onSybCurrencyConvert(event) {
		event.preventDefault();
		/* AppV2: no _onSubmit; form auto-submits on change */
		return this.actor.convertSybCurrency();
	}

	/* -------------------------------------------- */

	static buildCharSheet(parentClass) {
		class Syb5eActorSheetCharacter extends parentClass {
			static NAME = 'Syb5eActorSheetCharacter';

			/* -------------------------------------------- */

			static register() {
				this.defaults();

				/* register our sheet */
				Actors.registerSheet(COMMON[this.NAME].scope, COMMON[this.NAME].sheetClass, {
					types: ['character'],
					makeDefault: true,
					label: COMMON.localize('SYB5E.Sheet.Character.Label'),
				});
			}

			/* -------------------------------------------- */

			static defaults() {
				SheetCommon.defaults(this);
			}

			/* -------------------------------------------- */

			/** AppV2: static DEFAULT_OPTIONS replaces static get defaultOptions() **/

			static DEFAULT_OPTIONS = {
				classes: ['syb5e'],
				position: { width: 768, height: 749 },
			};

			/* -------------------------------------------- */

			/** AppV2: static PARTS replaces template getter **/

			static PARTS = {
				main: {
					template: `${COMMON.DATA.path}/templates/actors/syb5e-character-sheet.html`,
					scrollable: [''],
				},
			};

			/* Limited view parts */
			static LIMITED_PARTS = {
				main: {
					template: `${COMMON.DATA.path}/templates/actors/syb5e-limited-sheet.html`,
					scrollable: [''],
				},
			};

			/* -------------------------------------------- */

			/** AppV2: _prepareItems is called from super._prepareContext() **/

			_prepareItems(context) {
				super._prepareItems(context);

				/* now modify spell information to replace 'prepared' with 'favored' */
				SheetCommon._prepareItems.call(this, context);
			}

			/* -------------------------------------------- */

			/** AppV2: _prepareContext replaces getData **/

			async _prepareContext(options) {
				const context = await super._prepareContext(options);

				await SheetCommon._getCommonData(this.actor, context);

				/* Pre-render currency row for injection in _onRender */
				context._sybCurrencyRow = await SheetCommon.renderCurrencyRow(this.actor);

				context.enrichedBio = await TextEditor.enrichHTML(context.system.details.biography.value, { async: true, rollData: context.rollData });
				logger.debug('_prepareContext#context:', context);
				return context;
			}

			/* -------------------------------------------- */

			/** AppV2: _onRender replaces _render. this.element is HTMLElement (not jQuery) **/

			_onRender(context, options) {
				super._onRender(context, options);

				/* call the common _onRender (currency, spell slots, favored label, listeners) */
				SheetCommon._onRender.call(this, context);

				/* Inject the extended rest button */
				const footer = this.element.querySelector('.hit-dice .attribute-footer');
				if (footer) {
					footer.insertAdjacentHTML(
						'beforeend',
						`<a class="rest extended-rest" title="${COMMON.localize('SYB5E.Rest.Extended')}">${COMMON.localize('SYB5E.Rest.ExtendedAbbr')}</a>`
					);
				}

				/* activate listener for Extended Rest Button */
				this.element.querySelector('.extended-rest')?.addEventListener('click', this._onExtendedRest.bind(this));
			}

			/* -------------------------------------------- */

			async _onExtendedRest(event) {
				event.preventDefault();
				return this.actor.extendedRest();
			}

			/* -------------------------------------------- */
		}

		Syb5eActorSheetCharacter.register();
	}

	/* -------------------------------------------- */

	static buildNpcSheet(parentClass) {
		class Syb5eActorSheetNPC extends parentClass {
			static NAME = 'Syb5eActorSheetNPC';

			/* -------------------------------------------- */

			static register() {
				this.defaults();

				/* register our sheet */
				Actors.registerSheet('dnd5e', Syb5eActorSheetNPC, {
					types: ['npc'],
					makeDefault: true,
					label: COMMON.localize('SYB5E.Sheet.NPC.Label'),
				});
			}

			/* -------------------------------------------- */

			static defaults() {
				SheetCommon.defaults(this);
			}

			/* -------------------------------------------- */

			/** AppV2: static DEFAULT_OPTIONS replaces static get defaultOptions() **/

			static DEFAULT_OPTIONS = {
				classes: ['syb5e'],
				position: { width: 635, height: 705 },
			};

			/* -------------------------------------------- */

			/** AppV2: static PARTS replaces template getter **/

			static PARTS = {
				main: {
					template: `${COMMON.DATA.path}/templates/actors/syb5e-npc-sheet.html`,
					scrollable: [''],
				},
			};

			/* Limited view parts */
			static LIMITED_PARTS = {
				main: {
					template: `${COMMON.DATA.path}/templates/actors/syb5e-limited-sheet.html`,
					scrollable: [''],
				},
			};

			/* -------------------------------------------- */

			/** AppV2: _prepareItems is called from super._prepareContext() **/

			_prepareItems(context) {
				super._prepareItems(context);

				/* now modify spell information to replace 'prepared' with 'favored' */
				SheetCommon._prepareItems.call(this, context);
			}

			/* -------------------------------------------- */

			/** AppV2: _prepareContext replaces getData **/

			async _prepareContext(options) {
				const context = await super._prepareContext(options);

				await SheetCommon._getCommonData(this.actor, context);

				/* NPCs also have 'manner' */
				foundry.utils.setProperty(context.system.details, 'manner', this.actor.manner);

				/* Pre-render currency row for injection in _onRender */
				context._sybCurrencyRow = await SheetCommon.renderCurrencyRow(this.actor);

				context.enrichedBio = await TextEditor.enrichHTML(context.system.details.biography.value, { async: true, rollData: context.rollData });
				logger.debug('_prepareContext#context:', context);
				return context;
			}

			/* -------------------------------------------- */

			/** AppV2: _onRender replaces _render. this.element is HTMLElement (not jQuery) **/

			_onRender(context, options) {
				super._onRender(context, options);

				/* call the common _onRender (currency, spell slots, favored label, listeners) */
				SheetCommon._onRender.call(this, context);
			}
		}

		Syb5eActorSheetNPC.register();
	}
}
