import { COMMON } from '../common.js';
import { logger } from '../logger.js';

export class SheetCommon {
	static NAME = 'SheetCommon';

	/** SETUP **/

	static register() {
		this.globals();
		this.build();
	}

	static build() {
		/* dnd5e 5.x: sheet classes renamed */
		const charSheet = dnd5e.applications.actor.CharacterActorSheet;
		const npcSheet = dnd5e.applications.actor.NPCActorSheet;

		this.buildCharSheet(charSheet);
		this.buildNpcSheet(npcSheet);
	}

	static globals() {
		game.syb5e.sheetClasses = [];
	}

	/** DEFAULT DATA AND PATHS **/

	static defaults(sheetClass) {
		sheetClass['NAME'] = sheetClass.name;

		COMMON[sheetClass.NAME] = {
			scope: 'dnd5e',
			sheetClass,
		};

		COMMON[sheetClass.NAME].id = `${COMMON[sheetClass.NAME].scope}.${COMMON[sheetClass.NAME].sheetClass.name}`;

		game.syb5e.sheetClasses.push(COMMON[sheetClass.NAME]);
	}

	/** SYB DATA SETUP **/

	static _getCorruptionAbilityData(actor, contextAbilities) {
		const corruptionAbilities = Object.entries(contextAbilities).reduce((acc, [key, val]) => {
			acc.push({ ability: key, label: game.i18n.localize(`DND5E.Ability${key.capitalize()}`) });
			return acc;
		}, []);

		if (actor.system.attributes.spellcasting?.length > 0) {
			corruptionAbilities.push({ ability: 'spellcasting', label: COMMON.localize('DND5E.Spellcasting') });
		}

		corruptionAbilities.push({ ability: 'custom', label: COMMON.localize('SYB5E.Corruption.Custom') });
		corruptionAbilities.push({ ability: 'thorough', label: COMMON.localize('SYB5E.Corruption.ThoroughShort') });

		let corruptionAbilityData = {
			path: game.syb5e.CONFIG.PATHS.corruption.ability,
			abilities: corruptionAbilities,
			current: actor.corruption.ability,
			disabled: false,
			thorough: actor.corruption.ability === 'thorough',
		};

		corruptionAbilityData.disabled = corruptionAbilityData.current !== 'custom' ? 'disabled' : '';

		return corruptionAbilityData;
	}

	/* Common context data between characters and NPCs */
	static async _getCommonData(actor, context) {
		const commonData = {
			sybPaths: game.syb5e.CONFIG.PATHS,
			isNPC: actor.type === 'npc',
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

		return await foundry.applications.handlebars.renderTemplate(`${COMMON.DATA.path}/templates/actors/parts/actor-currency.html`, data);
	}

	/**
	 * Common _onRender: inject Symbaroum elements into the parent dnd5e sheet.
	 * Called with sheet as `this`.
	 */
	static _onRender(context) {
		/* Inject corruption section */
		if (context._sybCorruptionHtml) {
			/* Try to inject after the header or in the sidebar */
			const target =
				this.element.querySelector('.sheet-header') ??
				this.element.querySelector('.header') ??
				this.element.querySelector('[data-application-part="header"]');
			if (target) {
				target.insertAdjacentHTML('afterend', context._sybCorruptionHtml);
			}
		}

		/* Inject shadow/manner in biography area */
		if (context._sybShadowHtml) {
			const bioTab =
				this.element.querySelector('[data-tab="biography"] .characteristics') ??
				this.element.querySelector('[data-tab="biography"]') ??
				this.element.querySelector('[data-application-part="biography"]');
			if (bioTab) {
				bioTab.insertAdjacentHTML('afterbegin', context._sybShadowHtml);
			}
		}

		/* Suppress spell slot display */
		this.element.querySelectorAll('.spell-slots').forEach((el) => (el.style.display = 'none'));

		/* Replace currency row */
		if (context._sybCurrencyRow) {
			const currencyEl = this.element.querySelector('.currency');
			if (currencyEl) currencyEl.outerHTML = context._sybCurrencyRow;
		}

		/* Replace 'Prepared' with 'Favored' */
		const preparedCounter = this.element.querySelector('[data-filter="prepared"]');
		if (preparedCounter) {
			preparedCounter.textContent = `${COMMON.localize('SYB5E.Spell.Favored')} (${this._numFavored ?? 0})`;
		}

		/* Currency conversion listener */
		this.element.querySelector('.currency-convert')?.addEventListener('click', SheetCommon._onSybCurrencyConvert.bind(this));
	}

	static _prepareItems(context) {
		context.preparedSpells = 0;

		let favoredSpells = 0;
		const spellbook = context.spellbook ?? [];
		spellbook.forEach((groupEntry) => {
			const prepMode = groupEntry.dataset?.['preparation.mode'] ?? groupEntry.dataset?.method;
			if (prepMode !== 'atwill' && prepMode !== 'innate' && prepMode !== 'pact') {
				groupEntry.canPrepare = this.actor.type == 'character';
				favoredSpells += (groupEntry.spells ?? []).reduce((acc, spellData) => {
					const favored = foundry.utils.getProperty(spellData, game.syb5e.CONFIG.PATHS.favored);
					return favored > 0 ? acc + 1 : acc;
				}, 0);
			}
		});

		this._numFavored = favoredSpells;
	}

	static _onToggleItem(event) {
		event.preventDefault();
		const itemEl = event.currentTarget.closest('[data-item-id]') ?? event.currentTarget.closest('.item');
		const itemId = itemEl?.dataset.itemId;
		const item = this.actor.items.get(itemId);
		if (!item) return;

		if (item.type === 'spell') {
			if ((foundry.utils.getProperty(item, game.syb5e.CONFIG.PATHS.favored) ?? 0) < 0) return;
			return item.update({ [game.syb5e.CONFIG.PATHS.favored]: item.isFavored ? 0 : 1 });
		} else {
			const attr = 'system.equipped';
			return item.update({ [attr]: !foundry.utils.getProperty(item, attr) });
		}
	}

	static async _onSybCurrencyConvert(event) {
		event.preventDefault();
		return this.actor.convertSybCurrency();
	}

	/* -------------------------------------------- */

	static buildCharSheet(parentClass) {
		class Syb5eActorSheetCharacter extends parentClass {
			static NAME = 'Syb5eActorSheetCharacter';

			static register() {
				this.defaults();
				Actors.registerSheet(COMMON[this.NAME].scope, COMMON[this.NAME].sheetClass, {
					types: ['character'],
					makeDefault: true,
					label: COMMON.localize('SYB5E.Sheet.Character.Label'),
				});
			}

			static defaults() {
				SheetCommon.defaults(this);
			}

			/* Use parent's PARTS — no custom template override.
			 * We inject Symbaroum elements via _onRender. */

			static DEFAULT_OPTIONS = {
				classes: ['syb5e'],
			};

			_prepareItems(context) {
				super._prepareItems(context);
				SheetCommon._prepareItems.call(this, context);
			}

			async _prepareContext(options) {
				const context = await super._prepareContext(options);

				await SheetCommon._getCommonData(this.actor, context);

				/* Pre-render Symbaroum templates for injection in _onRender */
				context._sybCorruptionHtml = await foundry.applications.handlebars.renderTemplate(
					`${COMMON.DATA.path}/templates/actors/parts/actor-corruption.html`,
					context
				);
				context._sybShadowHtml = await foundry.applications.handlebars.renderTemplate(
					`${COMMON.DATA.path}/templates/actors/parts/actor-shadow.html`,
					context
				);
				context._sybCurrencyRow = await SheetCommon.renderCurrencyRow(this.actor);

				logger.debug('_prepareContext#context:', context);
				return context;
			}

			_onRender(context, options) {
				super._onRender(context, options);

				/* Inject Symbaroum elements into the parent dnd5e sheet */
				SheetCommon._onRender.call(this, context);

				/* Inject the extended rest button near HD/rest area */
				const restBtns = this.element.querySelector('.rest') ?? this.element.querySelector('[data-action="rest"]');
				if (restBtns) {
					const container = restBtns.closest('.attribute-footer') ?? restBtns.parentElement;
					if (container) {
						container.insertAdjacentHTML(
							'beforeend',
							`<a class="rest extended-rest" title="${COMMON.localize('SYB5E.Rest.Extended')}">${COMMON.localize('SYB5E.Rest.ExtendedAbbr')}</a>`
						);
					}
				}

				/* Activate listener for Extended Rest Button */
				this.element.querySelector('.extended-rest')?.addEventListener('click', this._onExtendedRest.bind(this));
			}

			async _onExtendedRest(event) {
				event.preventDefault();
				return this.actor.extendedRest();
			}
		}

		Syb5eActorSheetCharacter.register();
	}

	/* -------------------------------------------- */

	static buildNpcSheet(parentClass) {
		class Syb5eActorSheetNPC extends parentClass {
			static NAME = 'Syb5eActorSheetNPC';

			static register() {
				this.defaults();
				Actors.registerSheet('dnd5e', Syb5eActorSheetNPC, {
					types: ['npc'],
					makeDefault: true,
					label: COMMON.localize('SYB5E.Sheet.NPC.Label'),
				});
			}

			static defaults() {
				SheetCommon.defaults(this);
			}

			/* Use parent's PARTS — no custom template override. */

			static DEFAULT_OPTIONS = {
				classes: ['syb5e'],
			};

			_prepareItems(context) {
				super._prepareItems(context);
				SheetCommon._prepareItems.call(this, context);
			}

			async _prepareContext(options) {
				const context = await super._prepareContext(options);

				await SheetCommon._getCommonData(this.actor, context);

				/* NPCs also have 'manner' */
				foundry.utils.setProperty(context.system.details, 'manner', this.actor.manner);

				/* Pre-render Symbaroum templates for injection in _onRender */
				context._sybCorruptionHtml = await foundry.applications.handlebars.renderTemplate(
					`${COMMON.DATA.path}/templates/actors/parts/actor-corruption.html`,
					context
				);
				context._sybShadowHtml = await foundry.applications.handlebars.renderTemplate(
					`${COMMON.DATA.path}/templates/actors/parts/actor-shadow.html`,
					context
				);
				context._sybCurrencyRow = await SheetCommon.renderCurrencyRow(this.actor);

				logger.debug('_prepareContext#context:', context);
				return context;
			}

			_onRender(context, options) {
				super._onRender(context, options);

				/* Inject Symbaroum elements into the parent dnd5e sheet */
				SheetCommon._onRender.call(this, context);
			}
		}

		Syb5eActorSheetNPC.register();
	}
}
