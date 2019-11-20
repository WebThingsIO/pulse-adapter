/**
 *
 * PulseAdapter - an adapter for controlling Pulse pins.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const {Adapter, Database, Device, Event, Property} = require('gateway-addon');
const crypto = require('crypto');
const manifest = require('./manifest.json');

class PulseProperty extends Property {
  constructor(device, name, propertyDescr) {
    super(device, name, propertyDescr);
    this.value = !!this.device.pulseConfig.invert;
    this.onValue = !this.value;
    this.timeout = null;
  }

  schedulePulse() {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      this.setCachedValue(!this.onValue);
      this.device.notifyPropertyChanged(this);
      this.device.notifyEvent(this);
      this.timeout = null;
    }, this.device.pulseConfig.duration * 1000);
  }

  /**
   * @method setValue
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve) => {
      if (value !== this.value) {
        // value is changing

        if (value === this.onValue) {
          // if pulse was triggered, set the pulse timer
          this.schedulePulse();
        } else if (this.timeout !== null) {
          // if the pulse was turned off, clear the pulse timer
          clearTimeout(this.timeout);
          this.timeout = null;
        }

        this.setCachedValue(value);
        this.device.notifyEvent(this);
      } else if (value === this.onValue &&
                 this.device.pulseConfig.extendOnRetrigger) {
        // if the value isn't changing, but is being re-triggered, reset the
        // timer if configured to do so
        this.schedulePulse();
      }

      resolve(this.value);
      this.device.notifyPropertyChanged(this);
    });
  }
}

class PulseDevice extends Device {
  constructor(adapter, pulseConfig) {
    super(adapter, `pulse-${pulseConfig.id}`);

    this.pulseConfig = pulseConfig;
    this.name = pulseConfig.name;

    this.initOnOffSwitch();
    this.adapter.handleDeviceAdded(this);
  }

  asDict() {
    const dict = super.asDict();
    dict.pulseConfig = this.pulseConfig;
    return dict;
  }

  initOnOffSwitch() {
    this['@type'] = ['OnOffSwitch'];
    this.properties.set(
      'on',
      new PulseProperty(
        this,
        'on',
        {
          '@type': 'OnOffProperty',
          label: 'On/Off',
          type: 'boolean',
        }
      )
    );
    this.addEvent('turnedOn', {
      '@type': 'TurnedOnEvent',
      description: 'Pulse transitioned from off to on',
    });
    this.addEvent('turnedOff', {
      '@type': 'TurnedOffEvent',
      description: 'Pulse transitioned from on to off',
    });
  }

  notifyEvent(property) {
    const eventName = property.value ? 'turnedOn' : 'turnedOff';
    this.eventNotify(new Event(this, eventName));
  }
}

class PulseAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, manifest.id, manifest.id);
    addonManager.addAdapter(this);

    const db = new Database(manifest.id);
    db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      // An older version of this adapter naively used a hash of the name for
      // the ID. Unfortunately, if the name changed, the ID also changed.
      // However, since there are now existing devices with these IDs, use the
      // hash first and only use random bytes if a device with that ID doesn't
      // already exist. Oops.
      const later = [];
      const ids = [];

      for (const pulseConfig of config.pulses) {
        if (pulseConfig.id) {
          ids.push(pulseConfig.id);
          new PulseDevice(this, pulseConfig);
        } else {
          later.push(pulseConfig);
        }
      }

      for (const pulseConfig of later) {
        const shasum = crypto.createHash('sha1');
        shasum.update(pulseConfig.name);
        let id = shasum.digest('hex');

        if (ids.includes(id)) {
          id = crypto.randomBytes(16).toString('hex');
        }

        pulseConfig.id = id;
        new PulseDevice(this, pulseConfig);
      }

      return db.saveConfig(config);
    }).catch(console.error);
  }

  unload() {
    for (const deviceId in this.devices) {
      const device = this.devices[deviceId];
      this.handleDeviceRemoved(device);
    }
    return Promise.resolve();
  }
}

function loadPulseAdapter(addonManager) {
  new PulseAdapter(addonManager);
}

module.exports = loadPulseAdapter;
