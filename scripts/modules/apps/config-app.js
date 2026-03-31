import { COMMON } from '../../common.js';

export class SybConfigApp extends FormApplication {
  static get getDefaults() {
    return {
      addMenuButton: true,
    };
  }

  // * Creates or removes the quick access config button
  // * @param  {Boolean} shown true to add, false to remove

  // static toggleConfigButton(shown = true) {
  //   const button = $('#SybConfigApp');
  //   if (button) button.remove();

  //   if (shown) {
  //     const title = COMMON.localize('SYB5E.setting.config-menu-label.name');

  //     $(`<button id="SybConfigApp" data-action="SybConfigApp" title="${title}">
  //        <i class="fas fa-palette"></i> ${title}
  //      </button>`)
  //       .insertAfter('button[data-action="configure"]')
  //       .on('click', (event) => {
  //         const menu = game.settings.menus.get('symbaroum5ecore.symbaroumSettings');
  //         if (!menu) return ui.notifications.error('No submenu found for the provided key');
  //         const app = new menu.type();
  //         return app.render(true);
  //       });
  //   }
  // }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: COMMON.localize('SYB5E.setting.config-menu-label.name'),
      id: 'symbaroum5ecoreSettings',
      icon: 'fas fa-cogs',
      template: `${COMMON.DATA.path}/templates/apps/config-app.html`,
      width: 700,
      closeOnSubmit: true,
    });
  }

  getData(options) {
    const newData = {
      charBGChoice: COMMON.setting('charBGChoice'),
      charTextColour: COMMON.setting('charTextColour'),
      npcBGChoice: COMMON.setting('npcBGChoice'),
      npcTextColour: COMMON.setting('npcTextColour'),
      charFontFamily: COMMON.setting('charFontFamily'),
      npcFontFamily: COMMON.setting('npcFontFamily'),
      charBorder: COMMON.setting('charBorder'),
      npcBorder: COMMON.setting('npcBorder'),
      charItemLink: COMMON.setting('charItemLink'),
      npcItemLink: COMMON.setting('npcItemLink'),
      pcTag: COMMON.setting('charTag'),
      npcTag: COMMON.setting('npcTag'),
    };
    if (COMMON.setting('charBGChoice') === 'none') {
      newData['charBGColour'] = COMMON.setting('switchCharBGColour');
    } else {
      newData['charBGColour'] = '#000000';
    }
    if (COMMON.setting('npcBGChoice') === 'none') {
      newData['npcBGColour'] = COMMON.setting('switchNpcBGColour');
    } else {
      newData['npcBGColour'] = '#000000';
    }
    COMMON.setting('charChanged', 'false');
    COMMON.setting('npcChanged', 'false');

    return foundry.utils.mergeObject(newData);
  }

  activateListeners(html) {
    super.activateListeners(html);

    /* Get root element — handle both jQuery and HTMLElement */
    const root = html instanceof HTMLElement ? html : html[0];

    root.querySelector('#charBGImage')?.addEventListener('change', (ev) => {
      this._showColOption(ev, '#pcColPanel', root.querySelector('#charBGImage').value);
    });
    root.querySelector('#npcBGImage')?.addEventListener('change', (ev) => {
      this._showColOption(ev, '#npcColPanel', root.querySelector('#npcBGImage').value);
    });

    root.querySelector('button[name="resetPC"]')?.addEventListener('click', this.onResetPC.bind(this));
    root.querySelector('button[name="resetNPC"]')?.addEventListener('click', this.onResetNPC.bind(this));
    root.querySelector('button[name="resetAll"]')?.addEventListener('click', this.onResetAll.bind(this));
    root.querySelector('button[name="dnd5eSettings"]')?.addEventListener('click', this.dnd5eSettings.bind(this));

    const charBGImageEl = root.querySelector('#charBGImage');
    const npcBGImageEl = root.querySelector('#npcBGImage');
    const charTextColourEl = root.querySelector('#charTextColour');
    const npcTextColourEl = root.querySelector('#npcTextColour');

    if (charBGImageEl) charBGImageEl.value = COMMON.setting('charBGChoice');
    if (charTextColourEl) charTextColourEl.value = COMMON.setting('charTextColour');
    if (npcBGImageEl) npcBGImageEl.value = COMMON.setting('npcBGChoice');
    if (npcTextColourEl) npcTextColourEl.value = COMMON.setting('npcTextColour');

    charBGImageEl?.addEventListener('input', function (event) {
      COMMON.setting('charChanged', event.target.options[event.target.selectedIndex].label);
    });
    npcBGImageEl?.addEventListener('input', function (event) {
      COMMON.setting('npcChanged', event.target.options[event.target.selectedIndex].label);
    });

    if (COMMON.setting('charBGChoice') === 'none') {
      const pcPanel = root.querySelector('#pcColPanel');
      if (pcPanel) pcPanel.style.display = 'block';
    }

    if (COMMON.setting('npcBGChoice') === 'none') {
      const npcPanel = root.querySelector('#npcColPanel');
      if (npcPanel) npcPanel.style.display = 'block';
    }
  }

  async onResetPC() {
    await COMMON.setting('charBGChoice', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('switchCharBGColour', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('charTextColour', '#000000');
    await COMMON.setting('charBorder', '8px solid transparent');
    await COMMON.setting('charItemLink', '#000000');
    await COMMON.setting('charTag', '#000000');
    await COMMON.setting('charFontFamily', 'Fondamento');
    location.reload();
  }

  async onResetNPC() {
    await COMMON.setting('npcBGChoice', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('switchNpcBGColour', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('npcTextColour', '#000000');
    await COMMON.setting('npcBorder', '8px solid transparent');
    await COMMON.setting('npcItemLink', '#000000');
    await COMMON.setting('npcTag', '#000000');
    await COMMON.setting('npcFontFamily', 'Fondamento');
    location.reload();
  }

  async onResetAll() {
    await COMMON.setting('charBGChoice', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('switchCharBGColour', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('charTextColour', '#000000');
    await COMMON.setting('npcBGChoice', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('switchNpcBGColour', 'url(../images/background/bg-paper.webp) repeat');
    await COMMON.setting('npcTextColour', '#000000');
    await COMMON.setting('charBorder', '8px solid transparent');
    await COMMON.setting('npcBorder', '8px solid transparent');
    await COMMON.setting('charItemLink', '#000000');
    await COMMON.setting('npcItemLink', '#000000');
    await COMMON.setting('charTag', '#000000');
    await COMMON.setting('npcTag', '#000000');
    await COMMON.setting('charFontFamily', 'Fondamento');
    await COMMON.setting('npcFontFamily', 'Fondamento');

    location.reload();
  }

  async dnd5eSettings() {
    await COMMON.setting('charBGChoice', '#dad8cc');
    await COMMON.setting('switchCharBGColour', '#dad8cc');
    await COMMON.setting('charTextColour', '#000000');
    await COMMON.setting('charBorder', 'none');
    await COMMON.setting('npcBGChoice', '#dad8cc');
    await COMMON.setting('switchNpcBGColour', '#dad8cc');
    await COMMON.setting('npcTextColour', '#000000');
    await COMMON.setting('npcBorder', 'none');
    await COMMON.setting('charFontFamily', '"Modesto Condensed", "Palatino Linotype", serif');
    await COMMON.setting('npcFontFamily', '"Modesto Condensed", "Palatino Linotype", serif');
    await COMMON.setting('charItemLink', '#000000');
    await COMMON.setting('npcItemLink', '#000000');
    await COMMON.setting('charTag', '#000000');
    await COMMON.setting('npcTag', '#000000');
    location.reload();
  }

  async _updateObject(event, formData) {
    if (COMMON.setting('charChanged') != 'false') {
      if (COMMON.setting('charChanged') === 'DnD5E Default') {
        await COMMON.setting('charBGChoice', '#dad8cc');
        await COMMON.setting('switchCharBGColour', '#dad8cc');
        await COMMON.setting('charTextColour', '#000000');
        await COMMON.setting('charBorder', 'none');
        await COMMON.setting('charFontFamily', '"Modesto Condensed", "Palatino Linotype", serif');
        await COMMON.setting('charItemLink', '#000000');
        await COMMON.setting('charTag', '#000000');
        location.reload();
      } else {
        await COMMON.setting('charItemLink', '#000000');
        await COMMON.setting('charTag', '#ffffff');
        await COMMON.setting('charBGChoice', formData.charBGImage);

        if (formData.charTextColour === '#000000') {
          await COMMON.setting('charTextColour', '#ffffff');
        } else {
          await COMMON.setting('charTextColour', formData.charTextColour);
          await COMMON.setting('charTag', formData.charTextColour);
        }
      }
    } else {
      if ((await COMMON.setting('charTextColour')) != formData.charTextColour) {
        await COMMON.setting('charTextColour', formData.charTextColour);
        await COMMON.setting('charTag', formData.charTextColour);
      }
    }

    if (COMMON.setting('npcChanged') != 'false') {
      if (COMMON.setting('npcChanged') === 'DnD5E Default') {
        await COMMON.setting('npcBGChoice', '#dad8cc');
        await COMMON.setting('switchNpcBGColour', '#dad8cc');
        await COMMON.setting('npcTextColour', '#000000');
        await COMMON.setting('npcBorder', 'none');
        await COMMON.setting('npcFontFamily', '"Modesto Condensed", "Palatino Linotype", serif');
        await COMMON.setting('npcItemLink', '#000000');
        await COMMON.setting('npcTag', '#000000');
        location.reload();
      } else {
        await COMMON.setting('npcItemLink', '#000000');
        await COMMON.setting('npcTag', '#ffffff');
        await COMMON.setting('npcBGChoice', formData.npcBGImage);

        if (formData.npcTextColour === '#000000') {
          await COMMON.setting('npcTextColour', '#ffffff');
        } else {
          await COMMON.setting('npcTextColour', formData.npcTextColour);
          await COMMON.setting('npcTag', formData.npcTextColour);
        }
      }
    } else {
      if ((await COMMON.setting('npcTextColour')) != formData.npcTextColour) {
        await COMMON.setting('npcTextColour', formData.npcTextColour);
        await COMMON.setting('npcTag', formData.npcTextColour);
      }
    }

    if (formData.charBGImage === 'none') {
      if (formData.charBGColour?.length > 0 && formData.charBGColour[0] != '#') {
        formData.charBGColour = '#000000';
      }
      await COMMON.setting('switchCharBGColour', formData.charBGColour);
    } else {
      await COMMON.setting('switchCharBGColour', formData.charBGImage);
    }

    if (formData.npcBGImage === 'none') {
      if (formData.npcBGColour?.length > 0 && formData.npcBGColour[0] != '#') {
        formData.npcBGColour = '#000000';
      }
      await COMMON.setting('switchNpcBGColour', formData.npcBGColour);
    } else {
      await COMMON.setting('switchNpcBGColour', formData.npcBGImage);
    }
    location.reload();
  }

  close() {
    super.close();
  }

  async _showColOption(event, mChild, iValue) {
    event.preventDefault();
    const li = event.currentTarget.closest('.tab-active');
    if (!li) return;
    const li2 = li.querySelector(mChild);
    if (!li2) return;
    let tHeight = parseInt(li.offsetParent?.style.height?.replace(/[^0-9]/g, '') ?? '0');
    if (li2.style.display === 'none' && iValue === 'none') {
      tHeight = tHeight + 30;
      if (li.offsetParent) li.offsetParent.style.height = tHeight.toString() + 'px';
      li2.style.display = 'block';
    } else if (li2.style.display !== 'none') {
      tHeight = tHeight - 30;
      if (li.offsetParent) li.offsetParent.style.height = tHeight.toString() + 'px';
      li2.style.display = 'none';
    }
  }
}
