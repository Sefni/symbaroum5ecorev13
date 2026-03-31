import { Resting } from '../resting.js';
import { COMMON } from '../../common.js';

export class SybRestDialog extends Dialog {
	constructor({ actor, type }, /*{newDay=false, autoHD=false, autoHDThreshold=3} = {},*/ dialogData = {}, options = {}) {
		super(dialogData, options);

		/**
		 * Store a reference to the Actor entity which is resting
		 * @type {Actor5e}
		 */
		this.actor = actor;

		/**
		 * Track the most recently used HD denomination for re-rendering the form
		 * @type {string}
		 */
		this._denom = null;

		this.type = type;
	}

	/* -------------------------------------------- */

	/** @override */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			template: `${COMMON.DATA.path}/templates/apps/rest.html`,
			classes: ['dnd5e', 'dialog', 'syb5e'],
		});
	}

	/* -------------------------------------------- */

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		let healHp = html.find('#roll-hd');
		healHp.click(this._onRollHitDie.bind(this));

		let redCorr = html.find('#heal-corr');
		redCorr.click(this._onReduceCorruption.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * dnd5e 5.x: ShortRestDialog is AppV2 and no longer exposes
	 * getData or _onRollHitDie. We implement our own.
	 */
	_getCoreData() {
		const classes = this.actor.itemTypes.class;
		const availableHD = {};
		let canRoll = false;

		for (const cls of classes) {
			const denom = cls.system.hitDice;
			if (!denom) continue;
			const used = cls.system.hitDiceUsed ?? 0;
			const available = Math.max(cls.system.levels - used, 0);
			if (available > 0) canRoll = true;
			if (!availableHD[denom]) availableHD[denom] = 0;
			availableHD[denom] += available;
		}

		return {
			actor: this.actor,
			canRoll,
			denomination: this._denom || Object.keys(availableHD)[0] || 'd8',
			availableHD,
		};
	}

	async _onRollHitDie(event) {
		event.preventDefault();
		const button = event.currentTarget;
		this._denom = button.form.hd.value;
		await this.actor.rollHitDie(this._denom);
		this.render();
	}

	/* -------------------------------------------- */

	/** @override */
	getData() {
		const data = this._getCoreData();

		const restTypes = game.syb5e.CONFIG.REST_TYPES;

		data.restHint = {
			[restTypes.short]: 'SYB5E.Rest.ShortHint',
			[restTypes.long]: 'SYB5E.Rest.LongHint',
			[restTypes.extended]: 'SYB5E.Rest.ExtendedHint',
		}[this.type];

		data.isExtended = this.type === restTypes.extended;
		data.isShort = this.type === restTypes.short;
		data.promptNewDay = this.type !== restTypes.short;

		/* Rests can both roll HD for heal and corr AND
		 * automatically recover upon completion. We need
		 * to preview our totals so we dont have to do
		 * mental math
		 */
		const actor5eData = this.actor.system;

		const gain = Resting._restHpGain(this.actor, this.type);

		const corruption = this.actor.corruption;

		const corrRecovery = Resting._getCorruptionRecovery(this.actor, this.type);

		data.preview = {
			hp: actor5eData.attributes.hp.value + gain,
			maxHp: actor5eData.attributes.hp.max,
			tempCorr: Math.max(corruption.temp - corrRecovery, 0),
			//totalCorr: Math.max(corruption.value - corrRecovery, 0),
			maxCorr: corruption.max,
		};

		/* clamp HP and corruption */
		data.preview.totalCorr = data.preview.tempCorr + corruption.permanent;
		data.preview.hp = Math.min(data.preview.hp, data.preview.maxHp);

		return data;
	}
	/* -------------------------------------------- */

	async _onReduceCorruption(event) {
		event.preventDefault();
		const button = event.currentTarget;
		this._denom = button.form.hd.value;
		await Resting.corruptionHeal(this.actor, this.actor.system.attributes.prof);
		await Resting.expendHitDie(this.actor, this._denom);
		this.render();
	}

	/* -------------------------------------------- */

	static _generateDialogData(actor, restType, resolve, reject) {
		/* default data common to most rest types */
		let data = {
			title: '',
			buttons: {
				rest: {
					icon: '<i class="fas fa-bed"></i>',
					label: game.i18n.localize('DND5E.Rest'),
					callback: (html) => {
						const el = html instanceof HTMLElement ? html : html[0];
						const newDay = el?.querySelector('input[name="newDay"]')?.checked ?? false;
						resolve(newDay);
					},
				},
				cancel: {
					icon: '<i class="fas fa-times"></i>',
					label: game.i18n.localize('Cancel'),
					callback: () => reject('cancelled'),
				},
			},
			default: 'rest',
			close: () => reject('cancelled'),
		};

		/* modify the stock data with rest specific information */
		switch (restType) {
			case game.syb5e.CONFIG.REST_TYPES.short:
				data.title = `${COMMON.localize('DND5E.ShortRest')}: ${actor.name}`;

				/* this is the only rest that wont cause a new day */
				data.buttons.rest.callback = (/*html*/) => {
					const newDay = false;
					resolve(newDay);
				};

				break;
			case game.syb5e.CONFIG.REST_TYPES.long:
				data.title = `${COMMON.localize('DND5E.LongRest')}: ${actor.name}`;
				break;
			case game.syb5e.CONFIG.REST_TYPES.extended:
				data.title = `${COMMON.localize('SYB5E.Rest.Extended')}: ${actor.name}`;
				break;
		}

		return data;
	}

	/* -------------------------------------------- */

	static async restDialog({ actor, type }) {
		return new Promise((resolve, reject) => {
			/* use an IFFE such that it can access resolve and reject */
			const dialogData = SybRestDialog._generateDialogData(actor, type, resolve, reject);

			new SybRestDialog({ actor, type }, dialogData).render(true);
		});
	}
}
