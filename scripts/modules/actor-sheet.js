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
	 * Build compact corruption bar HTML.
	 */
	static _buildCorruptionHtml(actor) {
		const c = actor.corruption;
		const paths = game.syb5e.CONFIG.PATHS;
		const abilityData = SheetCommon._getCorruptionAbilityData(actor, actor.system.abilities);

		const abilityOptions = abilityData.abilities
			.map((a) => `<option value="${a.ability}" ${a.ability === abilityData.current ? 'selected' : ''}>${a.label}</option>`)
			.join('');

		if (abilityData.thorough) {
			return `<div class="syb5e-corruption-bar">
				<span class="syb5e-corruption-label">${COMMON.localize('SYB5E.Corruption.Label')}</span>
				<select name="${paths.corruption.ability}" class="syb5e-corruption-select">${abilityOptions}</select>
				<span class="syb5e-corruption-note">${COMMON.localize('SYB5E.Corruption.ThoroughShort')}</span>
			</div>`;
		}

		return `<div class="syb5e-corruption-bar">
			<span class="syb5e-corruption-label">${COMMON.localize('SYB5E.Corruption.Label')}</span>
			<select name="${paths.corruption.ability}" class="syb5e-corruption-select">${abilityOptions}</select>
			<div class="syb5e-corruption-fields">
				<label class="syb5e-corruption-field">
					<input type="text" name="${paths.corruption.temp}" value="${c.temp}" data-dtype="Number" placeholder="0">
					<span>${COMMON.localize('SYB5E.Corruption.Temporary')}</span>
				</label>
				<span class="syb5e-corruption-op">+</span>
				<label class="syb5e-corruption-field">
					<input type="text" name="${paths.corruption.permanent}" value="${c.permanent}" data-dtype="Number" placeholder="0">
					<span>${COMMON.localize('SYB5E.Corruption.Permanent')}</span>
				</label>
				<span class="syb5e-corruption-op">=</span>
				<label class="syb5e-corruption-field">
					<span class="syb5e-corruption-value">${c.value}</span>
					<span>${COMMON.localize('SYB5E.Corruption.Current')}</span>
				</label>
				<span class="syb5e-corruption-op">/</span>
				<label class="syb5e-corruption-field">
					<input type="text" name="${paths.corruption.max}" value="${c.max}" data-dtype="Number" ${abilityData.disabled} placeholder="0">
					<span>${COMMON.localize('SYB5E.Corruption.Threshold')}</span>
				</label>
			</div>
		</div>`;
	}

	/**
	 * Build shadow/manner HTML.
	 */
	static _buildShadowHtml(actor) {
		const paths = game.syb5e.CONFIG.PATHS;
		const shadow = actor.shadow ?? '';
		const manner = actor.manner ?? '';
		const isNPC = actor.type === 'npc';

		let html = `<div class="syb5e-shadow-section">`;
		if (isNPC) {
			html += `<label class="syb5e-shadow-field">
				<span>${COMMON.localize('SYB5E.Manner.Label')}</span>
				<textarea name="${paths.manner}">${manner}</textarea>
			</label>`;
		}
		html += `<label class="syb5e-shadow-field">
			<span>${COMMON.localize('SYB5E.Shadow.Label')}</span>
			<textarea name="${paths.shadow}">${shadow}</textarea>
		</label>`;
		html += `</div>`;
		return html;
	}

	/**
	 * Common _onRender: inject Symbaroum elements into the parent dnd5e sheet.
	 * Called with sheet as `this`.
	 */
	static _onRender(context) {
		/* Remove any previously injected elements (re-render safe) */
		this.element.querySelectorAll('.syb5e-corruption-bar, .syb5e-shadow-section').forEach((el) => el.remove());

		/* Inject corruption bar after header */
		const corruptionHtml = SheetCommon._buildCorruptionHtml(this.actor);
		const header =
			this.element.querySelector('[data-application-part="header"]') ??
			this.element.querySelector('.sheet-header') ??
			this.element.querySelector('header');
		if (header) {
			header.insertAdjacentHTML('afterend', corruptionHtml);
		}

		/* Inject shadow/manner in biography area */
		const shadowHtml = SheetCommon._buildShadowHtml(this.actor);
		const bioTab =
			this.element.querySelector('[data-application-part="biography"]') ??
			this.element.querySelector('[data-tab="biography"]');
		if (bioTab) {
			bioTab.insertAdjacentHTML('afterbegin', shadowHtml);
		}

		/* Suppress spell slot display */
		this.element.querySelectorAll('.spell-slots').forEach((el) => (el.style.display = 'none'));

		/* Replace 'Prepared' with 'Favored' */
		const preparedCounter = this.element.querySelector('[data-filter="prepared"]');
		if (preparedCounter) {
			preparedCounter.textContent = `${COMMON.localize('SYB5E.Spell.Favored')} (${this._numFavored ?? 0})`;
		}
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
				logger.debug('_prepareContext#context:', context);
				return context;
			}

			_onRender(context, options) {
				super._onRender(context, options);
				SheetCommon._onRender.call(this, context);

				/* Remove previous extended rest button */
				this.element.querySelector('.syb5e-extended-rest')?.remove();

				/* Inject extended rest button near rest buttons */
				const restBtn = this.element.querySelector('[data-type="long"]') ?? this.element.querySelector('[data-action="rest"]');
				if (restBtn) {
					restBtn.insertAdjacentHTML(
						'afterend',
						`<button type="button" class="syb5e-extended-rest" data-type="extended" title="${COMMON.localize('SYB5E.Rest.Extended')}">
							<i class="fa-solid fa-campground"></i> ${COMMON.localize('SYB5E.Rest.ExtendedAbbr')}
						</button>`
					);
				}

				this.element.querySelector('.syb5e-extended-rest')?.addEventListener('click', this._onExtendedRest.bind(this));
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
				foundry.utils.setProperty(context.system.details, 'manner', this.actor.manner);
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
