# Pulse Adapter

This is basically an On/Off switch which turns itself off after some
configured amount of time.

This can be useful when combined with real devices using the
rules engine.

## Configuration

### name

Sets the name of the device. This must be unique

### duration

The amount of time, in seconds, before the device will turn itself off.

### invert

If checked, inverts the on/off behaviour. The device starts out on and
turning it off will trigger timer, and it will turn itself back on after
the timer expires.
