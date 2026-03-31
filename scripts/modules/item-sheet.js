import { COMMON } from '../common.js';
import { logger } from '../logger.js';
import { SYB5E } from '../config.js';

/* Initial attempt is via injection only */
export class Syb5eItemSheet {
	static NAME = 'Syb5eItemSheet';

	static register() {
		this.hooks();
	}

	static hooks() {
		Hooks.on('renderItemSheet5e', this._renderItemSheet5e);
	}

	/* Handles injection of new SYB5E properties that are NOT handled
	 * implicitly by a game.dnd5e.config object.
	 * AppV2: html is an HTMLElement (not jQuery).
	 */
	static async _renderItemSheet5e(sheet, html /*, options*/) {
		/* need to insert checkbox for favored and put a favored 'badge' on the description tab */
		const item = sheet.item;

		const commonData = {
			edit: sheet.isEditable ?? false ? '' : 'disabled',
		};
		/* if this is an owned item, owner needs to be a SYB sheet actor
		 * if this is an unowned item, show always
		 */
		if (item.parent && !item.parent.isSybActor()) {
			logger.debug(`Item [${item.id}] with parent actor [${item.parent.id}] is not an SYB5E item`);
			return;
		}

		/* only concerned with adding favored to sybactor owned spell type items */
		if (item.type == 'spell') {
			const data = {
				...commonData,
				isFavored: item.isFavored,
				favoredPath: SYB5E.CONFIG.PATHS.favored,
				favoredValue: foundry.utils.getProperty(item, SYB5E.CONFIG.PATHS.favored) ?? 0,
				favoredStates: {
					[COMMON.localize('SYB5E.Spell.Favored')]: 1,
					[COMMON.localize('SYB5E.Spell.NotFavored')]: 0,
					[COMMON.localize('SYB5E.Spell.NeverFavored')]: -1,
				},
			};

			const favoredSelect = await renderTemplate(`${COMMON.DATA.path}/templates/items/parts/spell-favored.html`, data);
			const favoredBadge = await renderTemplate(`${COMMON.DATA.path}/templates/items/parts/spell-favored-badge.html`, data);

			/* adjust spell prep div style — vanilla DOM */
			const preparedCheckbox = html.querySelector('label.checkbox.prepared');
			if (preparedCheckbox) {
				const prepModeLineLabel = preparedCheckbox.parentElement?.previousElementSibling;
				if (prepModeLineLabel) prepModeLineLabel.style.maxWidth = 'fit-content';

				/* insert our favored select menu */
				preparedCheckbox.insertAdjacentHTML('afterend', favoredSelect);
			}

			/* insert our favored badge */
			const itemPropBadges = html.querySelectorAll('.properties-list li');
			const lastBadge = itemPropBadges[itemPropBadges.length - 1];
			if (lastBadge) lastBadge.insertAdjacentHTML('afterend', favoredBadge);

			/* find the "Cost (GP)" label (if it exists) */
			const costInput = html.querySelector('[name="system.materials.cost"]');
			const costLabel = costInput?.previousElementSibling;
			if (costLabel) {
				costLabel.textContent = COMMON.localize('SYB5E.Currency.CostThaler');
			}
		}

		/* need to rename "subclass" to "approach" */
		if (item.type == 'subclass') {
			/* get the subclass text field entry */
			const subclassLabel = html.querySelector('.header-details .item-type');
			if (subclassLabel) {
				subclassLabel.textContent = COMMON.localize('SYB5E.Item.Class.Approach');
			} else {
				logger.debug('Could not find subclass label field in class item render.');
			}

			/* remove spellcasting progression not in syb5e */
			const keepSelector = Object.keys(game.syb5e.CONFIG.SPELL_PROGRESSION)
				.map((key) => `[value="${key}"]`)
				.join(', ');
			const progressionSelect = html.querySelector('[name="system.spellcasting.progression"]');
			if (progressionSelect) {
				[...progressionSelect.children].forEach((child) => {
					if (!child.matches(keepSelector)) child.remove();
				});
			}
		}

		/* we want to add a custom corruption field if there is a general resource consumption field */
		const consumeGroup = html.querySelector('.form-group.consumption');
		if (consumeGroup) {
			const currentOverrides = item.corruptionOverride;
			let data = {
				corruptionType: {
					none: '',
					temp: COMMON.localize('SYB5E.Corruption.TemporaryFull'),
					permanent: COMMON.localize('SYB5E.Corruption.Permanent'),
				},
				corruptionModes: {
					'': CONST.ACTIVE_EFFECT_MODES.CUSTOM,
					ADD: CONST.ACTIVE_EFFECT_MODES.ADD,
					MULTIPLY: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
					OVERRIDE: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
				},
				overridePath: game.syb5e.CONFIG.PATHS.corruptionOverride.root,
				...currentOverrides,
			};

			/* non-spell items have no base corruption to modify, can only override with a custom value */
			if (item.type !== 'spell') {
				delete data.corruptionModes.ADD;
				delete data.corruptionModes.MULTIPLY;
			}

			const corruptionGroup = await renderTemplate(`${COMMON.DATA.path}/templates/items/parts/item-corruption.html`, data);
			consumeGroup.insertAdjacentHTML('afterend', corruptionGroup);
		}
	}
}
