import { COMMON } from '../common.js';
import { logger } from '../logger.js';
import { SYB5E } from '../config.js';

/* Casting a Spell:
 * To cast a spell you take an appropriate action and gain tem-
 * porary Corruption. A cantrip causes 1 point of temporary
 * Corruption while a leveled spell causes 1d4 plus the spell’s
 * level points of temporary Corruption.
 *
 * When you cast a favored cantrip you gain no Corruption, and
 * when you cast a leveled favored spell you gain Corruption
 * equal only to the level of the spell.
 */

export class Spellcasting {
	static NAME = 'Spellcasting';

	static register() {
		this.patch();
		this.hooks();
	}

	static patch() {
		/* AbilityUseDialog no longer exists in dnd5e 5.x.
		 * Corruption info is now displayed via chat messages. */
	}

	static hooks() {
		/* renderAbilityUseDialog no longer exists in dnd5e 5.x.
		 * The Activity usage dialog replaces it. */
	}

	/* MECHANICS HELPERS */

	/* get max spell level based
	 * on highest class progression
	 * NOTE: this is probably excessive
	 *   but since its a single display value
	 *   we want to show the higest value
	 * @param classData {array<classItemData>}
	 */
	static _maxSpellLevelByClass(classData = []) {
		const maxLevel = classData.reduce(
			(acc, cls) => {
				const progression = cls.spellcasting.progression;
				const progressionArray = SYB5E.CONFIG.SPELL_PROGRESSION[progression] ?? false;
				if (progressionArray) {
					const spellLevel = SYB5E.CONFIG.SPELL_PROGRESSION[progression][cls.system.levels] ?? 0;

					return spellLevel > acc.level ? { level: spellLevel, fullCaster: progression == 'full' } : acc;
				}

				/* nothing to accumulate */
				return acc;
			},
			{ level: 0, fullCaster: false }
		);

		const result = {
			level: maxLevel.level,
			label: SYB5E.CONFIG.LEVEL_SHORT[maxLevel.level],
			fullCaster: maxLevel.fullCaster,
		};

		return result;
	}

	/* highest spell level for an NPC:
	 * if a leveled caster, use that level as Full Caster
	 * if not and spellcasting stat is != 'none', use CR as full caster
	 * otherwise, no spellcasting
	 *
	 * @param actor5eData {Object} (i.e. actor.system)
	 */
	static _maxSpellLevelNPC(actor5eData) {
		const casterLevel = actor5eData.details.spellLevel ?? 0;

		/* has caster levels, assume full caster */
		let result = {
			level: 0,
			label: '',
			fullCaster: casterLevel > 0,
		};

		/* modify max spell level if full caster or has a casting stat */
		if (result.fullCaster) {
			/* if we are a full caster, use our caster level */
			result.level = game.syb5e.CONFIG.SPELL_PROGRESSION.full[casterLevel];
		}

		result.label = game.syb5e.CONFIG.LEVEL_SHORT[result.level];

		return result;
	}

	static _isFavored(itemData) {
		const favored = foundry.utils.getProperty(itemData, game.syb5e.CONFIG.PATHS.favored) ?? game.syb5e.CONFIG.DEFAULT_ITEM.favored;
		return favored > 0;
	}

	static spellProgression(actor5e) {
		const result =
			actor5e.type == 'character' ? Spellcasting._maxSpellLevelByClass(Object.values(actor5e.classes)) : Spellcasting._maxSpellLevelNPC(actor5e.system);

		return result;
	}

	static _modifyDerivedProgression(actor5e) {
		const progression = Spellcasting.spellProgression(actor5e);

		/* insert our maximum spell level into the spell object */
		actor5e.system.spells.maxLevel = progression.level;

		/* ensure that all spell levels <= maxLevel have a non-zero max */
		const levels = Array.from({ length: progression.level }, (_, index) => `spell${index + 1}`);

		for (const slot of levels) {
			actor5e.system.spells[slot].max = Math.max(actor5e.system.spells[slot].max, 1);
		}
	}

	static _generateCorruptionExpression(level, favored, prepMode) {
		/* cantrips have a level of "0" (string) for some reason */
		level = parseInt(level);

		if (isNaN(level)) {
			return false;
		}

		switch (prepMode) {
			case 'atwill':
			case 'innate':
				return '0';
		}

		if (favored) {
			/* favored cantrips cost 0, favored spells cost level */
			return level == 0 ? '0' : `${level}`;
		}

		/* cantrips cost 1, leveled spells are 1d4+level */
		return level == 0 ? '1' : `1d4 + ${level}`;
	}

	static _corruptionExpression(itemData, level = itemData.system.level) {
		/* get default expression */
		let expression = itemData.type === 'spell' ? Spellcasting._generateCorruptionExpression(level, Spellcasting._isFavored(itemData)) : '0';
		let type = 'temp';

		/* has custom corruption? */
		const custom =
			foundry.utils.getProperty(itemData, game.syb5e.CONFIG.PATHS.corruptionOverride.root) ??
			foundry.utils.duplicate(game.syb5e.CONFIG.DEFAULT_ITEM.corruptionOverride);

		/* modify the expression (always round up) minimum 1 unless custom */
		if (custom.mode !== game.syb5e.CONFIG.DEFAULT_ITEM.corruptionOverride.mode) {
			//has override
			switch (custom.mode) {
				case CONST.ACTIVE_EFFECT_MODES.ADD:
					expression = `${expression} + (${custom.value})`;
					break;
				case CONST.ACTIVE_EFFECT_MODES.MULTIPLY:
					expression = `(${expression}) * (${custom.value})`;
					break;
				case CONST.ACTIVE_EFFECT_MODES.OVERRIDE:
					expression = custom.value;
					break;
			}
		}

		/* modify the target */
		if (custom.type !== game.syb5e.CONFIG.DEFAULT_ITEM.corruptionOverride.type) {
			type = custom.type;
		}

		/* after all modifications have been done, return the final expression */
		return { expression, type };
	}

	/** \MECHANICS HELPERS **/

	/** PATCH FUNCTIONS **/

	static _getUsageUpdates(item, { consumeCorruption }, messageConfig) {
		const itemUpdates = {};

		if (consumeCorruption) {
			/* Does this item produce corruption? */
			const corruptionInfo = item.corruption;

			/* Generate and simplify rolldata strings for final rollable formula post-render */
			const expression = new Roll(`${corruptionInfo.expression}`, item.getRollData()).evaluateSync({ strict: false, allowStrings: true }).formula;

			/* store this corruption expression in the chat message flags */
			const lastCorruptionField = game.syb5e.CONFIG.PATHS.corruption.root + '.last';
			if (!messageConfig.data) messageConfig.data = {};
			foundry.utils.setProperty(messageConfig.data, lastCorruptionField, {
				expression,
				type: corruptionInfo.type,
			});

			logger.debug('Cached corruption roll:', messageConfig.data[lastCorruptionField]);

		} else {
			/* clear out the previously stored corruption results, if any */
			itemUpdates[game.syb5e.CONFIG.PATHS.delete.corruption] = null;
		}

		/* some "fake" items dont have an ID, try to handle this... */
		return { itemUpdates: !!item.id ? itemUpdates : {} };
	}
}
